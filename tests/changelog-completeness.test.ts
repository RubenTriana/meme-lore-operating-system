import { describe, expect, it } from 'vitest'
import universeData from '../data/universe_master.json'
import type { Universe } from '../src/types/universe'

const universe = universeData as unknown as Universe

describe('canonical changelog completeness', () => {
  it('keeps a unique and uninterrupted change identifier sequence', () => {
    const ids = universe.changelog.map((entry) => entry.id)
    const expected = Array.from({ length: 11 }, (_, index) => `change-${String(index + 1).padStart(3, '0')}`)

    expect(ids).toEqual(expected)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('represents the current canon and reconciled build', () => {
    expect(universe.metadata).toMatchObject({
      version: '0.5.3',
      build: 'canon-0.5.3-changelog-reconciled',
    })
    expect(universe.changelog.some((entry) => entry.version === universe.metadata.version)).toBe(true)
  })

  it('records the recovered canon and current application capabilities', () => {
    const byId = new Map(universe.changelog.map((entry) => [entry.id, entry]))

    expect(byId.get('change-003')?.changes.join(' ')).toContain('cosmología multinivel')
    expect(byId.get('change-004')?.changes.join(' ')).toContain('SOMA Continuum')
    expect(byId.get('change-009')?.changes.join(' ')).toContain('El Rey Amarillo')
    expect(byId.get('change-010')?.changes.join(' ')).toContain('Genius')
    expect(byId.get('change-010')?.changes.join(' ')).toContain('Connections')
    expect(byId.get('change-011')?.modules).toEqual(['changelog'])
  })
})
