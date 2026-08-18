import { copyFile, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

export const BEAT_STATUSES = ['outline', 'draft', 'seeded', 'active', 'locked'] as const
export type BeatStatus = (typeof BEAT_STATUSES)[number]

interface CanonEntity {
  id?: unknown
  type?: unknown
  status?: unknown
}

interface CanonModule {
  id?: unknown
  content?: { items?: CanonEntity[] }
}

interface CanonDocument {
  metadata?: { updated?: unknown }
  modules?: CanonModule[]
  [key: string]: unknown
}

interface StatusChange {
  beatId: string
  status: BeatStatus
}

function isBeatStatus(value: unknown): value is BeatStatus {
  return typeof value === 'string' && BEAT_STATUSES.includes(value as BeatStatus)
}

export function updateBeatStatusDocument(
  document: unknown,
  change: StatusChange,
  updatedAt = new Date().toISOString(),
): CanonDocument {
  if (!change.beatId.trim()) throw new Error('El identificador del beat es obligatorio.')
  if (!isBeatStatus(change.status)) throw new Error(`Estado no permitido: ${String(change.status)}.`)
  if (!document || typeof document !== 'object' || !Array.isArray((document as CanonDocument).modules)) {
    throw new Error('El master no contiene una lista de módulos válida.')
  }

  const next = structuredClone(document) as CanonDocument
  const saveTheCat = next.modules?.find((module) => module.id === 'save-the-cat')
  if (!saveTheCat || !Array.isArray(saveTheCat.content?.items)) {
    throw new Error('No se encontró el módulo Save the Cat en el master.')
  }

  const matches = saveTheCat.content.items.filter((entity) => entity.id === change.beatId && entity.type === 'beat')
  if (matches.length !== 1) throw new Error(`No existe un beat único con id ${change.beatId}.`)
  matches[0].status = change.status

  if (!next.metadata || typeof next.metadata !== 'object') throw new Error('El master no contiene metadata válida.')
  next.metadata.updated = updatedAt
  return next
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 8_192) throw new Error('La solicitud supera el tamaño permitido.')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

export function canonStatusPlugin(rootDirectory = process.cwd()): Plugin {
  const masterPath = resolve(rootDirectory, 'data', 'universe_master.json')
  let writeQueue: Promise<void> = Promise.resolve()

  return {
    name: 'canon-beat-status-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/canon/beat-status', async (request, response) => {
        if (request.method !== 'PATCH') {
          response.setHeader('Allow', 'PATCH')
          sendJson(response, 405, { error: 'Método no permitido.' })
          return
        }
        if (!String(request.headers['content-type'] ?? '').startsWith('application/json')) {
          sendJson(response, 415, { error: 'El contenido debe ser JSON.' })
          return
        }

        try {
          const payload = await readJsonBody(request) as Partial<StatusChange>
          if (typeof payload.beatId !== 'string' || !isBeatStatus(payload.status)) {
            sendJson(response, 400, { error: 'Se requiere un beatId y un estado canónico válido.' })
            return
          }

          let savedDocument: CanonDocument | undefined
          const persist = async () => {
            const current = JSON.parse(await readFile(masterPath, 'utf8')) as unknown
            savedDocument = updateBeatStatusDocument(current, { beatId: payload.beatId!, status: payload.status! })
            const temporaryPath = `${masterPath}.status-write.tmp`
            await writeFile(temporaryPath, `${JSON.stringify(savedDocument, null, 2)}\n`, 'utf8')
            try {
              await copyFile(temporaryPath, masterPath)
            } finally {
              await rm(temporaryPath, { force: true })
            }
          }

          const queued = writeQueue.then(persist, persist)
          writeQueue = queued.then(() => undefined, () => undefined)
          await queued
          sendJson(response, 200, { universe: savedDocument, beatId: payload.beatId, status: payload.status })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'No se pudo actualizar el master.'
          sendJson(response, 400, { error: message })
        }
      })
    },
  }
}
