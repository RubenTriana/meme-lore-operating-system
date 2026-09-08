import { describe, expect, it } from 'vitest'
import universeData from '../data/universe_master.json'
import type { Universe } from '../src/types/universe'

const universe = universeData as unknown as Universe

describe('canonical changelog completeness', () => {
  it('keeps the historical sequence plus the explicit canon approval entry', () => {
    const ids = universe.changelog.map((entry) => entry.id)
    const expected = Array.from({ length: 17 }, (_, index) => `change-${String(index + 1).padStart(3, '0')}`)
    expect(ids.slice(0, 17)).toEqual(expected)
    expect(ids.at(-1)).toBe('change-011-canon-escaleta-v05')
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('represents the official tetralogy canon and current build', () => {
    expect(universe.metadata).toMatchObject({ version: '0.11.0', build: 'canon-0.11.0-escaleta-0.5', canonStatus: 'CANON' })
    expect(universe.changelog.at(-1)).toMatchObject({ id: 'change-011-canon-escaleta-v05', version: universe.metadata.version })
  })

  it('records the reconstruction, consolidation and asymmetric-cruelty pass', () => {
    const byId = new Map(universe.changelog.map((entry) => [entry.id, entry]))
    expect(byId.get('change-012')?.changes.join(' ')).toContain('cuatro novelas autocontenidas')
    expect(byId.get('change-013')?.changes.join(' ')).toContain('Redujo el reparto a diez entidades')
    expect(byId.get('change-014')?.changes.join(' ')).toContain('crueldad como asignación de costes')
    expect(byId.get('change-014')?.modules).toContain('franchise')
    expect(byId.get('change-015')?.changes.join(' ')).toContain('entidad dramática consciente')
    expect(byId.get('change-016')?.changes.join(' ')).toContain('Vicente')
    expect(byId.get('change-016')?.changes.join(' ')).toContain('Ruth')
  })
})
