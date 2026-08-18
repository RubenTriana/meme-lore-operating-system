import { describe, expect, it } from 'vitest'
import { updateBeatStatusDocument } from '../vite-canon-status-plugin'

function master() {
  return {
    metadata: { updated: '2026-01-01T00:00:00.000Z' },
    modules: [
      { id: 'save-the-cat', content: { items: [
        { id: 'beat-01', type: 'beat', status: 'draft' },
        { id: 'note-01', type: 'note', status: 'draft' },
      ] } },
    ],
  }
}

describe('canon beat status writer', () => {
  it('updates one existing beat and the master timestamp without mutating the input', () => {
    const source = master()
    const result = updateBeatStatusDocument(source, { beatId: 'beat-01', status: 'locked' }, '2026-07-15T22:00:00.000Z')

    expect(source.modules[0].content.items[0].status).toBe('draft')
    expect(result.modules?.[0].content?.items?.[0].status).toBe('locked')
    expect(result.metadata?.updated).toBe('2026-07-15T22:00:00.000Z')
  })

  it('rejects statuses outside the canonical list', () => {
    expect(() => updateBeatStatusDocument(master(), { beatId: 'beat-01', status: 'published' as 'draft' })).toThrow('Estado no permitido')
  })

  it('rejects missing beats and non-beat entities', () => {
    expect(() => updateBeatStatusDocument(master(), { beatId: 'missing', status: 'locked' })).toThrow('No existe un beat único')
    expect(() => updateBeatStatusDocument(master(), { beatId: 'note-01', status: 'locked' })).toThrow('No existe un beat único')
  })
})
