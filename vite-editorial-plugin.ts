import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { z } from 'zod'
import { validateUniverse } from './src/schemas/universe'
import { applyTimelineDraft, removeUnitReferences } from './src/timeline/editing'
import {
  NOVEL_WORD_TARGET,
  recordWordCount,
  type WritingProgressData,
} from './src/utils/writing-progress'
import type { Universe } from './src/types/universe'
import { EditorialError, readJsonDocument, updateJsonDocument } from './server/json-store'

const identity = {
  id: z.string().min(1).max(160),
  expectedUpdated: z.string().datetime(),
}
const changeSchema = z.discriminatedUnion('action', [
  z.object({ ...identity, action: z.literal('delete') }).strict(),
  z
    .object({
      ...identity,
      action: z.literal('edit'),
      draft: z
        .object({
          title: z.string().trim().min(1, 'El título es obligatorio.').max(1000),
          summary: z.string().max(100_000),
          sequence: z.number().int().nonnegative().nullable(),
          act: z.string().max(1000),
          era: z.string().max(1000),
          plotline: z.string().max(1000),
          date: z.string().max(1000),
        })
        .strict(),
    })
    .strict(),
])
const wordSchema = z
  .object({
    words: z.number().int().min(0).max(10_000_000),
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

export function changeTimelineDocument(document: unknown, payload: unknown): Universe {
  const change = changeSchema.parse(payload)
  const current = document as Universe
  if (current.metadata?.updated !== change.expectedUpdated) {
    throw new EditorialError(
      'La cronología cambió desde que la abriste. Recarga antes de guardar.',
      409,
    )
  }
  let next = structuredClone(current)
  const timeline = next.modules.find((module) => module.id === 'timeline')
  const items = timeline?.content.items
  const position = items?.findIndex((item) => item.id === change.id) ?? -1
  if (!items || position < 0) throw new EditorialError('La unidad ya no existe en Cronología.', 404)
  if (change.action === 'edit') {
    items[position] = applyTimelineDraft(items[position], change.draft)
  } else {
    items.splice(position, 1)
    // Restrict link cleanup to active entities, preserving provenance and changelog text.
    next = {
      ...next,
      modules: next.modules.map((module) => ({
        ...module,
        content: {
          ...module.content,
          ...(module.content.items
            ? {
                items: module.content.items.map(
                  (item) => removeUnitReferences(item, change.id) as typeof item,
                ),
              }
            : {}),
        },
      })),
    }
  }
  next.metadata.updated = new Date(
    Math.max(Date.now(), Date.parse(current.metadata.updated) + 1),
  ).toISOString()
  const validation = validateUniverse(next)
  if (!validation.valid) {
    throw new EditorialError(
      `No se guardó porque quedarían datos inválidos: ${validation.errors
        .slice(0, 3)
        .map((error) => `${error.path}: ${error.message}`)
        .join('; ')}`,
    )
  }
  return next
}

function send(response: ServerResponse, status: number, data: unknown) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(data))
}

async function body(request: IncomingMessage) {
  if (!String(request.headers['content-type'] ?? '').startsWith('application/json')) {
    throw new EditorialError('La solicitud debe contener JSON.', 415)
  }
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buffer.length
    if (length > 512_000) throw new EditorialError('La unidad supera el tamaño permitido.', 413)
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

export function editorialPlugin(rootDirectory: string): Plugin {
  const masterPath = resolve(rootDirectory, 'data/universe_master.json')
  const progressPath = resolve(rootDirectory, 'data/writing_progress.json')
  const install = (middlewares: Connect.Server) => {
    middlewares.use(async (request, response, next) => {
      const path = request.url?.split('?')[0]
      if (
        !['/api/canon/universe', '/api/canon/timeline-unit', '/api/writing-progress'].includes(
          path ?? '',
        )
      ) {
        next()
        return
      }
      try {
        const host = new URL(`http://${request.headers.host ?? ''}`)
        if (
          !['localhost', '127.0.0.1', '[::1]'].includes(host.hostname) ||
          request.headers['sec-fetch-site'] === 'cross-site' ||
          (request.headers.origin && new URL(request.headers.origin).host !== host.host)
        ) {
          throw new EditorialError('Solo se admiten cambios desde la aplicación local.', 403)
        }
        if (path === '/api/canon/universe' && request.method === 'GET') {
          send(response, 200, { universe: (await readJsonDocument(masterPath)).document })
        } else if (path === '/api/canon/timeline-unit' && request.method === 'PATCH') {
          const change = changeSchema.parse(await body(request))
          const saved = await updateJsonDocument(masterPath, (document) =>
            changeTimelineDocument(document, change),
          )
          send(response, 200, { universe: saved.document, backup: saved.backup })
        } else if (path === '/api/writing-progress' && request.method === 'GET') {
          const saved = await readJsonDocument<WritingProgressData>(progressPath)
          send(response, 200, { progress: saved.document, revision: saved.revision })
        } else if (path === '/api/writing-progress' && request.method === 'PATCH') {
          const change = wordSchema.parse(await body(request))
          const saved = await updateJsonDocument(progressPath, (document, revision) => {
            if (revision !== change.expectedRevision)
              throw new EditorialError(
                'El conteo cambió en otra ventana. Recarga para actualizarlo.',
                409,
              )
            const today = new Intl.DateTimeFormat('en-CA', {
              timeZone: 'America/Bogota',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(new Date())
            const updated = recordWordCount(document as WritingProgressData, change.words, today)
            updated.forecast.editorialTargetWords = NOVEL_WORD_TARGET
            return updated
          })
          send(response, 200, { progress: saved.document, revision: saved.revision })
        } else {
          response.setHeader(
            'Allow',
            path === '/api/canon/universe'
              ? 'GET'
              : path === '/api/canon/timeline-unit'
                ? 'PATCH'
                : 'GET, PATCH',
          )
          send(response, 405, { error: 'Método no permitido.' })
        }
      } catch (error) {
        const status =
          error instanceof EditorialError
            ? error.status
            : error instanceof z.ZodError || error instanceof SyntaxError
              ? 400
              : 500
        const message =
          error instanceof z.ZodError
            ? error.issues[0]?.message
            : error instanceof Error
              ? error.message
              : 'No se pudo guardar.'
        send(response, status, { error: message })
      }
    })
  }
  return {
    name: 'meme-editorial-api',
    configureServer(server) {
      install(server.middlewares)
    },
    configurePreviewServer(server) {
      install(server.middlewares)
    },
    // Keep an active editor open while its save request updates the backing JSON.
    handleHotUpdate(context) {
      if ([masterPath, progressPath].includes(resolve(context.file))) return []
    },
  }
}
