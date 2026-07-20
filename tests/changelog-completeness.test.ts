import { describe, expect, it } from 'vitest'
import universeData from '../data/universe_master.json'
import type { Universe } from '../src/types/universe'

const universe = universeData as unknown as Universe

describe('canonical changelog completeness', () => {
  it('keeps a unique and uninterrupted change identifier sequence', () => {
    const ids = universe.changelog.map((entry) => entry.id)
    const expected = Array.from({ length: 15 }, (_, index) => `change-${String(index + 1).padStart(3, '0')}`)
    expect(ids).toEqual(expected)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('represents the official tetralogy canon and current build', () => {
    expect(universe.metadata).toMatchObject({ version: '0.8.1', build: 'canon-0.8.1-jano-entity' })
    expect(universe.changelog.at(-1)).toMatchObject({ id: 'change-015', version: universe.metadata.version })
  })

  it('records the reconstruction, consolidation and asymmetric-cruelty pass', () => {
    const byId = new Map(universe.changelog.map((entry) => [entry.id, entry]))
    expect(byId.get('change-012')?.changes.join(' ')).toContain('cuatro novelas autocontenidas')
    expect(byId.get('change-013')?.changes.join(' ')).toContain('Redujo el reparto a diez entidades')
    expect(byId.get('change-014')?.changes.join(' ')).toContain('crueldad como asignación de costes')
    expect(byId.get('change-014')?.modules).toContain('franchise')
    expect(byId.get('change-015')?.changes.join(' ')).toContain('entidad dramática consciente')
  })
})
