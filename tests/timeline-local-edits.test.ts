import {
  applyTimelineLocalEdits,
  createEmptyTimelineEdits,
  deleteTimelineUnitLocally,
  hasTimelineLocalEdits,
  parseTimelineLocalEdits,
  saveTimelineUnitPatch,
} from '../src/timeline/local-edits'
import type { UniverseEntity } from '../src/types/universe'

const items: UniverseEntity[] = [
  { id: 'one', type: 'event', title: 'Unidad uno', summary: 'Original', sequence: 10 },
  { id: 'two', type: 'event', title: 'Unidad dos', summary: 'Conservar', sequence: 20 },
]

describe('local timeline editing', () => {
  it('applies saved fields without mutating canonical units', () => {
    const edits = saveTimelineUnitPatch(createEmptyTimelineEdits(), 'one', {
      title: 'Unidad editada',
      summary: 'Nuevo resumen',
      sequence: 12,
      plotline: 'Principal',
    })
    const result = applyTimelineLocalEdits(items, edits)

    expect(result[0]).toMatchObject({
      title: 'Unidad editada',
      summary: 'Nuevo resumen',
      sequence: 12,
      plotline: 'Principal',
    })
    expect(items[0]).toEqual({
      id: 'one',
      type: 'event',
      title: 'Unidad uno',
      summary: 'Original',
      sequence: 10,
    })
    expect(hasTimelineLocalEdits(edits)).toBe(true)
  })

  it('hides deleted units while preserving the source list', () => {
    const edits = deleteTimelineUnitLocally(createEmptyTimelineEdits(), 'one')
    expect(applyTimelineLocalEdits(items, edits).map((item) => item.id)).toEqual(['two'])
    expect(items).toHaveLength(2)
  })

  it('validates persisted timeline edits', () => {
    const valid = { updates: { one: { title: 'Guardada', sequence: 15 } }, deletedIds: ['two'] }
    expect(parseTimelineLocalEdits(valid)).toEqual(valid)
    expect(parseTimelineLocalEdits({ updates: [], deletedIds: [] })).toBeUndefined()
    expect(parseTimelineLocalEdits({ updates: { one: { title: '' } }, deletedIds: [] })).toBeUndefined()
  })
})
