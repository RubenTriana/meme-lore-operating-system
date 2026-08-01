import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const GENIUS_MODEL = 'gemini-2.5-flash'
const GENIUS_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GENIUS_MODEL}:generateContent`

interface GeniusEntityContext {
  id: string
  title: string
  type: string
  summary?: string
  status?: string
  development?: number
}

export interface GeniusRequest {
  insight: {
    id: string
    category: string
    title: string
    detail: string
    severity: string
    entityIds: string[]
  }
  entities: GeniusEntityContext[]
}

export interface GeniusPossibility {
  title: string
  explanation: string
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  error?: { message?: string }
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
    if (size > 32_768) throw new Error('La solicitud supera el tamaño permitido.')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function isGeniusRequest(value: unknown): value is GeniusRequest {
  if (!value || typeof value !== 'object') return false
  const request = value as Partial<GeniusRequest>
  const insight = request.insight
  return Boolean(
    insight
    && typeof insight.id === 'string'
    && typeof insight.category === 'string'
    && typeof insight.title === 'string'
    && typeof insight.detail === 'string'
    && typeof insight.severity === 'string'
    && Array.isArray(insight.entityIds)
    && insight.entityIds.every((id) => typeof id === 'string')
    && Array.isArray(request.entities)
    && request.entities.length <= 12
    && request.entities.every((entity) => entity && typeof entity.id === 'string' && typeof entity.title === 'string' && typeof entity.type === 'string'),
  )
}

export function parseGeniusResponse(value: unknown): GeniusPossibility[] {
  if (!value || typeof value !== 'object') throw new Error('Genius devolvió una respuesta vacía.')
  const possibilities = (value as { possibilities?: unknown }).possibilities
  if (!Array.isArray(possibilities) || possibilities.length !== 2) {
    throw new Error('Genius debe devolver exactamente dos posibilidades.')
  }
  return possibilities.map((possibility) => {
    if (!possibility || typeof possibility !== 'object') throw new Error('Una posibilidad no tiene el formato esperado.')
    const { title, explanation } = possibility as Partial<GeniusPossibility>
    if (typeof title !== 'string' || !title.trim() || typeof explanation !== 'string' || !explanation.trim()) {
      throw new Error('Una posibilidad está incompleta.')
    }
    return { title: title.trim(), explanation: explanation.trim() }
  })
}

function geniusPrompt(request: GeniusRequest): string {
  return [
    'Actúa como Genius, un editor de narrativa especulativa y continuidad.',
    'Responde en español. Propón exactamente dos posibilidades distintas para resolver o explotar este insight.',
    'Cada posibilidad debe ser lógica con la evidencia entregada, sorprendente sin ser aleatoria, y presentarse como hipótesis, nunca como hecho canónico.',
    'No inventes nombres propios adicionales. Aprovecha tensiones, causalidad, identidad, economía o simbolismo ya presentes.',
    'En explanation explica tanto el giro como la lógica que lo sostiene en 70 a 120 palabras.',
    '',
    `INSIGHT: ${JSON.stringify(request.insight)}`,
    `ENTIDADES RELACIONADAS: ${JSON.stringify(request.entities)}`,
  ].join('\n')
}

export function geniusPlugin(apiKey = process.env.GEMINI_API_KEY): Plugin {
  return {
    name: 'genius-insights-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/insights/genius', async (request, response) => {
        if (request.method !== 'POST') {
          response.setHeader('Allow', 'POST')
          sendJson(response, 405, { error: 'Método no permitido.' })
          return
        }
        if (!String(request.headers['content-type'] ?? '').startsWith('application/json')) {
          sendJson(response, 415, { error: 'El contenido debe ser JSON.' })
          return
        }
        if (!apiKey) {
          sendJson(response, 503, { error: 'Genius no tiene configurada la variable GEMINI_API_KEY.' })
          return
        }

        try {
          const payload = await readJsonBody(request)
          if (!isGeniusRequest(payload)) {
            sendJson(response, 400, { error: 'El insight o su contexto no tienen un formato válido.' })
            return
          }

          const geminiResponse = await fetch(GENIUS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: geniusPrompt(payload) }] }],
              generationConfig: {
                temperature: 1.1,
                maxOutputTokens: 2_048,
                thinkingConfig: { thinkingBudget: 0 },
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'OBJECT',
                  properties: {
                    possibilities: {
                      type: 'ARRAY',
                      minItems: 2,
                      maxItems: 2,
                      items: {
                        type: 'OBJECT',
                        properties: {
                          title: { type: 'STRING' },
                          explanation: { type: 'STRING' },
                        },
                        required: ['title', 'explanation'],
                      },
                    },
                  },
                  required: ['possibilities'],
                },
              },
            }),
            signal: AbortSignal.timeout(45_000),
          })
          const gemini = await geminiResponse.json() as GeminiResponse
          if (!geminiResponse.ok) throw new Error(gemini.error?.message ?? `Gemini respondió con estado ${geminiResponse.status}.`)
          const text = gemini.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim()
          if (!text) throw new Error('Gemini no devolvió contenido.')
          const possibilities = parseGeniusResponse(JSON.parse(text) as unknown)
          sendJson(response, 200, { possibilities, model: GENIUS_MODEL })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'No se pudo completar la generación.'
          sendJson(response, 502, { error: message })
        }
      })
    },
  }
}
