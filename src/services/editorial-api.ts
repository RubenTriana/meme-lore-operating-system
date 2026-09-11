import { loadUniverse } from './universe-loader'
import type { TimelineChange } from '../timeline/editing'
import type { WritingProgressData } from '../utils/writing-progress'

async function requestJson<T>(url: string, payload?: unknown): Promise<T> {
  const response = await fetch(
    url,
    payload === undefined
      ? { cache: 'no-store' }
      : {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
  )
  const data = await response.json().catch(() => {
    throw new Error('El guardado requiere el servidor local de Meme Lore System.')
  })
  if (!response.ok) throw new Error(data.error ?? 'No se pudieron guardar los cambios.')
  return data as T
}

export async function saveTimelineChange(change: TimelineChange) {
  const result = await requestJson<{ universe: unknown; backup: string }>(
    '/api/canon/timeline-unit',
    change,
  )
  const loaded = loadUniverse(result.universe)
  if (!loaded.validation.valid || !loaded.validation.data)
    throw new Error('El universo guardado no supera la validación.')
  return loaded.validation.data
}

export interface WritingProgressResponse {
  progress: WritingProgressData
  revision: string
}

export const getWritingProgress = () =>
  requestJson<WritingProgressResponse>('/api/writing-progress')
export const saveWordCount = (words: number, expectedRevision: string) =>
  requestJson<WritingProgressResponse>('/api/writing-progress', { words, expectedRevision })
