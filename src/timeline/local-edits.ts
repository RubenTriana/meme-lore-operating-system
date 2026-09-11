import type { UniverseEntity } from '@/types/universe'

export interface TimelineUnitPatch {
  title?: string
  summary?: string | null
  sequence?: number | null
  date?: string | null
  era?: string | null
  act?: string | null
  plotline?: string | null
}

export interface TimelineLocalEdits {
  updates: Record<string, TimelineUnitPatch>
  deletedIds: string[]
}

export function timelineLocalEditsStorageKey(universeVersion: string) {
  return `meme-lore:timeline:${universeVersion}:local-edits:v1`
}

const nullableTextFields = ['summary', 'date', 'era', 'act', 'plotline'] as const

export function createEmptyTimelineEdits(): TimelineLocalEdits {
  return { updates: {}, deletedIds: [] }
}

function parsePatch(value: unknown): TimelineUnitPatch | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  const patch: TimelineUnitPatch = {}

  if ('title' in source) {
    if (typeof source.title !== 'string' || !source.title.trim()) return undefined
    patch.title = source.title.trim()
  }
  if ('sequence' in source) {
    if (source.sequence !== null && !Number.isInteger(source.sequence)) return undefined
    patch.sequence = source.sequence as number | null
  }
  for (const field of nullableTextFields) {
    if (!(field in source)) continue
    const fieldValue = source[field]
    if (fieldValue !== null && typeof fieldValue !== 'string') return undefined
    patch[field] = fieldValue as string | null
  }
  return patch
}

export function parseTimelineLocalEdits(value: unknown): TimelineLocalEdits | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  if (!source.updates || typeof source.updates !== 'object' || Array.isArray(source.updates)) {
    return undefined
  }
  if (!Array.isArray(source.deletedIds) || !source.deletedIds.every((id) => typeof id === 'string')) {
    return undefined
  }

  const updates: Record<string, TimelineUnitPatch> = {}
  for (const [id, candidate] of Object.entries(source.updates)) {
    if (!id.trim()) return undefined
    const patch = parsePatch(candidate)
    if (!patch) return undefined
    updates[id] = patch
  }
  return { updates, deletedIds: [...new Set(source.deletedIds as string[])] }
}

export function hasTimelineLocalEdits(edits: TimelineLocalEdits) {
  return Object.keys(edits.updates).length > 0 || edits.deletedIds.length > 0
}

export function applyTimelineLocalEdits(
  items: UniverseEntity[],
  edits: TimelineLocalEdits,
): UniverseEntity[] {
  const deleted = new Set(edits.deletedIds)
  return items.filter((item) => !deleted.has(item.id)).map((item) => {
    const patch = edits.updates[item.id]
    if (!patch) return item
    const next: UniverseEntity = { ...item }
    for (const [field, value] of Object.entries(patch)) {
      if (value === null) delete next[field]
      else next[field] = value
    }
    return next
  })
}

export function saveTimelineUnitPatch(
  edits: TimelineLocalEdits,
  id: string,
  patch: TimelineUnitPatch,
): TimelineLocalEdits {
  return {
    updates: { ...edits.updates, [id]: patch },
    deletedIds: edits.deletedIds.filter((deletedId) => deletedId !== id),
  }
}

export function deleteTimelineUnitLocally(
  edits: TimelineLocalEdits,
  id: string,
): TimelineLocalEdits {
  const updates = { ...edits.updates }
  delete updates[id]
  return { updates, deletedIds: [...new Set([...edits.deletedIds, id])] }
}
