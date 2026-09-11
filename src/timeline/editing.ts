import type { Universe, UniverseEntity } from '../types/universe'

export interface TimelineDraft {
  title: string
  summary: string
  sequence: number | null
  act: string
  era: string
  plotline: string
  date: string
}

export type TimelineChange = {
  id: string
  expectedUpdated: string
} & ({ action: 'edit'; draft: TimelineDraft } | { action: 'delete' })

export function timelineDraft(item: UniverseEntity): TimelineDraft {
  return {
    title: item.title,
    summary: item.summary ?? '',
    sequence: item.sequence ?? null,
    act: item.act ?? '',
    era: item.era ?? '',
    plotline: item.plotline ?? '',
    date: item.date ?? item.temporal?.start ?? '',
  }
}

function isReferenceList(key: string) {
  return /Refs$/.test(key) || ['refs', 'foreshadowing', 'causes', 'effects'].includes(key)
}

function isReference(key: string) {
  return /Ref$/.test(key) || ['source', 'target'].includes(key)
}

// Only structured links are removed. Prose and numeric outline labels remain intact.
export function removeUnitReferences(value: unknown, id: string, key = ''): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => !(isReferenceList(key) && entry === id))
      .filter(
        (entry) =>
          !(
            entry &&
            typeof entry === 'object' &&
            (('entityRef' in entry && entry.entityRef === id) ||
              ('characterRef' in entry && entry.characterRef === id))
          ),
      )
      .map((entry) => removeUnitReferences(entry, id))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([field, entry]) => !(isReference(field) && entry === id))
        .map(([field, entry]) => [field, removeUnitReferences(entry, id, field)]),
    )
  }
  return value
}

export function linkedUnitCount(universe: Universe, id: string) {
  return universe.modules
    .flatMap((module) => module.content.items ?? [])
    .filter(
      (item) =>
        item.id !== id && JSON.stringify(item) !== JSON.stringify(removeUnitReferences(item, id)),
    ).length
}

export function applyTimelineDraft(item: UniverseEntity, draft: TimelineDraft): UniverseEntity {
  const next = structuredClone(item)
  next.title = draft.title.trim()
  next.summary = draft.summary
  if (draft.sequence === null) delete next.sequence
  else next.sequence = draft.sequence
  for (const field of ['act', 'era', 'plotline'] as const) {
    if (draft[field].trim()) next[field] = draft[field].trim()
    else delete next[field]
  }
  if (draft.date !== (item.date ?? item.temporal?.start ?? '')) {
    if ('date' in item || !item.temporal) {
      if (draft.date.trim()) next.date = draft.date.trim()
      else delete next.date
    } else if (draft.date.trim()) {
      next.temporal = { ...item.temporal, start: draft.date.trim() }
    } else {
      delete next.temporal
    }
  }
  if (next.scene && typeof next.scene === 'object' && !Array.isArray(next.scene)) {
    const scene = next.scene as Record<string, unknown>
    if (scene.physical === item.summary) scene.physical = next.summary
    if (typeof scene.title === 'string' && item.title.endsWith(scene.title)) {
      scene.title = next.title.replace(/^\s*\d+[a-z]?\s*[—-]\s*/i, '')
    }
  }
  return next
}
