import { readFile, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

type JsonRecord = Record<string, unknown>

interface CanonModule extends JsonRecord {
  id?: unknown
  title?: unknown
  content?: { items?: JsonRecord[] }
}

interface CanonDocument extends JsonRecord {
  metadata?: JsonRecord
  modules?: CanonModule[]
  changelog?: JsonRecord[]
}

export interface TantaloContextRequest {
  query: string
  domains: string[]
  terms?: string[]
  entityIds?: string[]
  depth?: number
  mode?: string
  workflowId?: string
  purpose?: string
  maxItems?: number
  allowFullContext?: boolean
}

interface ContextAudit {
  requestId: string
  timestamp: string
  canonVersion: unknown
  schemaVersion: unknown
  depth: number
  mode: string
  workflowId: string
  requestedDomains: string[]
  resolvedModules: string[]
  recordsConsidered: number
  recordsReturned: number
  truncated: boolean
  fullContext: boolean
  readOnly: true
}

export class TantaloContextError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message)
  }
}

const MODULE_ALIASES: Record<string, string[]> = {
  canon: ['bible', 'lore'],
  lore: ['lore'],
  continuity: ['bible', 'lore', 'relationships', 'timeline', 'save-the-cat', 'mysteries'],
  continuidad: ['bible', 'lore', 'relationships', 'timeline', 'save-the-cat', 'mysteries'],
  compatibility: ['bible', 'lore', 'relationships', 'timeline', 'save-the-cat', 'mysteries'],
  compatibilidad: ['bible', 'lore', 'relationships', 'timeline', 'save-the-cat', 'mysteries'],
  characters: ['characters', 'relationships'],
  personajes: ['characters', 'relationships'],
  psychology: ['characters', 'relationships'],
  psicologia: ['characters', 'relationships'],
  chronology: ['timeline'],
  cronologia: ['timeline'],
  structure: ['bible', 'timeline', 'save-the-cat'],
  mysteries: ['mysteries', 'symbols'],
  misterios: ['mysteries', 'symbols'],
  worldbuilding: ['lore', 'factions', 'economy', 'technology', 'companies'],
  mundo: ['lore', 'factions', 'economy', 'technology', 'companies'],
  versions: ['changelog'],
  versiones: ['changelog'],
  changelog: ['changelog'],
}

const FULL_CONTEXT_WORKFLOWS = new Set([
  'torneo-versiones',
  'torneo',
  'comparacion-ciega',
  'candidatos-abcd',
  'integrar-finalistas',
  'auditoria-canon',
  'revision-macro',
  'evaluacion-manuscrito',
])

const DEPTH_LIMITS = [0, 6, 12, 20, 32, 250] as const
const BASE_FIELDS = ['id', 'type', 'title', 'summary', 'tags', 'status', 'development', 'priority']
const CONTINUITY_FIELDS = [
  'refs', 'foreshadowing', 'novelRef', 'novelRefs', 'primaryNovelRef', 'fromRef', 'toRef',
  'relationshipType', 'sequence', 'temporal', 'era', 'act', 'plotline', 'sagaRef', 'causedByRefs',
  'effects', 'resolutionWindow',
]
const DEEP_FIELDS = [
  'desire', 'need', 'wound', 'contradiction', 'goal', 'risk', 'irreversibleChoice', 'moralLimit',
  'arc', 'crueltyProfile', 'analysis', 'authorAnswer', 'openQuestions', 'function', 'appearances',
  'usageLimit', 'axis', 'cruelty', 'beatNumber', 'fullName', 'alias',
]

function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function uniqueStrings(value: unknown, limit = 40): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))].slice(0, limit)
}

function validateRequest(value: unknown): TantaloContextRequest {
  if (!value || typeof value !== 'object') throw new TantaloContextError(400, 'INVALID_REQUEST', 'La consulta debe ser un objeto JSON.')
  const input = value as Partial<TantaloContextRequest>
  const query = typeof input.query === 'string' ? input.query.trim() : ''
  const domains = uniqueStrings(input.domains, 12)
  const depth = Number.isInteger(input.depth) ? Number(input.depth) : 1
  if (!query || query.length > 500) throw new TantaloContextError(400, 'QUERY_REQUIRED', 'Se requiere una consulta concreta de hasta 500 caracteres.')
  if (!domains.length) throw new TantaloContextError(400, 'DOMAIN_REQUIRED', 'La consulta debe declarar al menos un dominio concreto.')
  if (depth < 1 || depth > 5) throw new TantaloContextError(400, 'INVALID_DEPTH', 'La profundidad debe estar entre 1 y 5.')
  return {
    query,
    domains,
    terms: uniqueStrings(input.terms, 30),
    entityIds: uniqueStrings(input.entityIds, 30),
    depth,
    mode: typeof input.mode === 'string' ? input.mode.trim() : '',
    workflowId: typeof input.workflowId === 'string' ? input.workflowId.trim() : '',
    purpose: typeof input.purpose === 'string' ? input.purpose.trim() : '',
    maxItems: Number.isInteger(input.maxItems) ? Number(input.maxItems) : undefined,
    allowFullContext: input.allowFullContext === true,
  }
}

function resolveModules(domains: string[], available: Set<string>): string[] {
  const resolved = new Set<string>()
  for (const rawDomain of domains) {
    const domain = normalize(rawDomain)
    const mapped = MODULE_ALIASES[domain] ?? (available.has(domain) ? [domain] : null)
    if (!mapped) throw new TantaloContextError(400, 'UNKNOWN_DOMAIN', `Dominio no permitido: ${rawDomain}.`)
    mapped.forEach((moduleId) => resolved.add(moduleId))
  }
  return [...resolved]
}

function contextFields(depth: number): Set<string> | null {
  if (depth >= 4) return null
  return new Set([
    ...BASE_FIELDS,
    ...(depth >= 2 ? CONTINUITY_FIELDS : []),
    ...(depth >= 3 ? DEEP_FIELDS : []),
  ])
}

function sanitizeEntity(entity: JsonRecord, depth: number): JsonRecord {
  const fields = contextFields(depth)
  if (!fields) return structuredClone(entity)
  return Object.fromEntries(Object.entries(entity).filter(([key]) => fields.has(key)))
}

function searchableText(entity: JsonRecord): string {
  return normalize(JSON.stringify(entity))
}

function entityScore(entity: JsonRecord, terms: string[], entityIds: Set<string>): number {
  const id = String(entity.id ?? '')
  if (entityIds.has(id)) return 1_000
  if (!terms.length) return 1
  const title = normalize(entity.title)
  const tags = normalize(Array.isArray(entity.tags) ? entity.tags.join(' ') : '')
  const refs = normalize(Array.isArray(entity.refs) ? entity.refs.join(' ') : '')
  const all = searchableText(entity)
  return terms.reduce((score, term) => {
    if (!term) return score
    if (normalize(id) === term) return score + 120
    if (title.includes(term)) return score + 30
    if (tags.includes(term)) return score + 14
    if (refs.includes(term)) return score + 9
    if (all.includes(term)) return score + 3
    return score
  }, 0)
}

function fullAccessAllowed(request: TantaloContextRequest): boolean {
  return request.depth === 5
    && request.mode === 'Profundo'
    && FULL_CONTEXT_WORKFLOWS.has(request.workflowId ?? '')
    && request.allowFullContext === true
}

function auditBase(document: CanonDocument, request: TantaloContextRequest, timestamp: string): Omit<ContextAudit, 'resolvedModules' | 'recordsConsidered' | 'recordsReturned' | 'truncated' | 'fullContext'> {
  return {
    requestId: `tantalo-${Date.parse(timestamp).toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    canonVersion: document.metadata?.version ?? null,
    schemaVersion: document.metadata?.schemaVersion ?? null,
    depth: request.depth ?? 1,
    mode: request.mode ?? '',
    workflowId: request.workflowId ?? '',
    requestedDomains: request.domains,
    readOnly: true,
  }
}

export function queryTantaloContext(documentValue: unknown, requestValue: unknown, timestamp = new Date().toISOString()): { context: JsonRecord; audit: ContextAudit } {
  if (!documentValue || typeof documentValue !== 'object') throw new TantaloContextError(500, 'INVALID_CANON', 'LoreSystem no contiene un documento canónico válido.')
  const document = documentValue as CanonDocument
  const modules = Array.isArray(document.modules) ? document.modules : []
  const request = validateRequest(requestValue)
  const available = new Set([...modules.map((module) => String(module.id ?? '')), 'changelog'])
  const resolvedModules = resolveModules(request.domains, available)

  if (request.allowFullContext) {
    if (!fullAccessAllowed(request)) {
      throw new TantaloContextError(403, 'FULL_CONTEXT_FORBIDDEN', 'El contexto integral exige profundidad 5, modo Profundo y una skill autorizada.')
    }
    const records = modules.reduce((sum, module) => sum + (Array.isArray(module.content?.items) ? module.content.items.length : 0), 0) + (document.changelog?.length ?? 0)
    return {
      context: { fullDocument: structuredClone(document) },
      audit: { ...auditBase(document, request, timestamp), resolvedModules: ['*'], recordsConsidered: records, recordsReturned: records, truncated: false, fullContext: true },
    }
  }

  const depth = request.depth ?? 1
  const requestedLimit = request.maxItems ?? DEPTH_LIMITS[depth]
  const limit = Math.max(1, Math.min(requestedLimit, DEPTH_LIMITS[depth]))
  const rawTerms = [request.query, ...(request.terms ?? [])]
  const terms = [...new Set(rawTerms.flatMap((term) => normalize(term).split(/[^a-z0-9]+/)).filter((term) => term.length >= 3))]
  const entityIds = new Set(request.entityIds ?? [])
  const candidates: Array<{ moduleId: string; moduleTitle: string; entity: JsonRecord; score: number }> = []
  let recordsConsidered = 0

  for (const moduleId of resolvedModules.filter((id) => id !== 'changelog')) {
    const module = modules.find((entry) => entry.id === moduleId)
    if (!module) continue
    const items = Array.isArray(module.content?.items) ? module.content.items : []
    recordsConsidered += items.length
    for (const entity of items) {
      const score = entityScore(entity, terms, entityIds)
      if (score > 0) candidates.push({ moduleId, moduleTitle: String(module.title ?? moduleId), entity, score })
    }
  }

  if (resolvedModules.includes('changelog')) {
    const entries = Array.isArray(document.changelog) ? document.changelog : []
    recordsConsidered += entries.length
    for (const entry of entries) {
      const score = entityScore({ ...entry, id: entry.id ?? entry.version, title: `Versión ${String(entry.version ?? '')}`, summary: entry.changes }, terms, entityIds)
      if (score > 0) candidates.push({ moduleId: 'changelog', moduleTitle: 'Versiones', entity: entry, score })
    }
  }

  candidates.sort((a, b) => b.score - a.score || String(a.entity.title ?? a.entity.id).localeCompare(String(b.entity.title ?? b.entity.id), 'es'))
  const selected = candidates.slice(0, limit)
  const grouped = new Map<string, { id: string; title: string; items: JsonRecord[] }>()
  for (const candidate of selected) {
    const group = grouped.get(candidate.moduleId) ?? { id: candidate.moduleId, title: candidate.moduleTitle, items: [] }
    const entity = candidate.moduleId === 'changelog'
      ? Object.fromEntries(Object.entries(candidate.entity).filter(([key]) => ['id', 'version', 'date', 'changes', 'modules'].includes(key)))
      : sanitizeEntity(candidate.entity, depth)
    group.items.push(entity)
    grouped.set(candidate.moduleId, group)
  }

  return {
    context: {
      metadata: {
        title: document.metadata?.title ?? null,
        version: document.metadata?.version ?? null,
        schemaVersion: document.metadata?.schemaVersion ?? null,
        build: document.metadata?.build ?? null,
      },
      modules: [...grouped.values()],
    },
    audit: {
      ...auditBase(document, request, timestamp),
      resolvedModules,
      recordsConsidered,
      recordsReturned: selected.length,
      truncated: candidates.length > selected.length,
      fullContext: false,
    },
  }
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function allowLocalCors(request: IncomingMessage, response: ServerResponse): boolean {
  const remote = request.socket.remoteAddress ?? ''
  const localRemote = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)
  if (!localRemote) return false
  const origin = String(request.headers.origin ?? '')
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) return false
  if (origin) response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Vary', 'Origin')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  return true
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 65_536) throw new TantaloContextError(413, 'REQUEST_TOO_LARGE', 'La consulta supera el tamaño permitido.')
    chunks.push(buffer)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } catch {
    throw new TantaloContextError(400, 'INVALID_JSON', 'El cuerpo no contiene JSON válido.')
  }
}

export function tantaloContextPlugin(rootDirectory = process.cwd()): Plugin {
  const masterPath = resolve(rootDirectory, 'data', 'universe_master.json')
  let cachedMtime = -1
  let cachedDocument: unknown

  const loadDocument = async () => {
    const info = await stat(masterPath)
    if (!cachedDocument || info.mtimeMs !== cachedMtime) {
      cachedDocument = JSON.parse(await readFile(masterPath, 'utf8')) as unknown
      cachedMtime = info.mtimeMs
    }
    return cachedDocument
  }

  return {
    name: 'tantalo-selective-context-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/tantalo/context/health', async (request, response) => {
        if (!allowLocalCors(request, response)) return sendJson(response, 403, { error: 'Solo se permiten conexiones locales.' })
        if (request.method === 'OPTIONS') return sendJson(response, 204, {})
        if (request.method !== 'GET') return sendJson(response, 405, { error: 'Método no permitido.' })
        try {
          const document = await loadDocument() as CanonDocument
          sendJson(response, 200, {
            status: 'ready',
            readOnly: true,
            canonVersion: document.metadata?.version ?? null,
            schemaVersion: document.metadata?.schemaVersion ?? null,
            selectiveByDefault: true,
            fullContextGate: { depth: 5, mode: 'Profundo', explicitPermission: true, workflows: [...FULL_CONTEXT_WORKFLOWS] },
            domains: Object.keys(MODULE_ALIASES),
          })
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : 'No se pudo abrir el canon.' })
        }
      })

      server.middlewares.use('/api/tantalo/context/query', async (request, response) => {
        if (!allowLocalCors(request, response)) return sendJson(response, 403, { error: 'Solo se permiten conexiones locales.' })
        if (request.method === 'OPTIONS') return sendJson(response, 204, {})
        if (request.method !== 'POST') return sendJson(response, 405, { error: 'Método no permitido.' })
        if (!String(request.headers['content-type'] ?? '').startsWith('application/json')) return sendJson(response, 415, { error: 'El contenido debe ser JSON.' })
        try {
          const result = queryTantaloContext(await loadDocument(), await readJsonBody(request))
          sendJson(response, 200, result)
        } catch (error) {
          if (error instanceof TantaloContextError) return sendJson(response, error.statusCode, { code: error.code, error: error.message })
          sendJson(response, 500, { error: error instanceof Error ? error.message : 'No se pudo consultar LoreSystem.' })
        }
      })
    },
  }
}
