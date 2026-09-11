import { describe, expect, it } from 'vitest'
import source from '../data/universe_master.json'
import {
  canonicalDetailEntries,
  canonicalModuleItems,
  canonicalModules,
} from '../src/utils/canon-policy'
import { getAllEntities, searchUniverse } from '../src/utils/semantic-index'
import type { Universe } from '../src/types/universe'

const universe = source as unknown as Universe

describe('canon 0.11.0 visibility policy', () => {
  it('excludes planning, superseded material, proposals and open questions by default', () => {
    const modules = canonicalModules(universe)
    const entities = getAllEntities(universe)

    expect(modules).toHaveLength(17)
    expect(modules.map((module) => module.id)).not.toContain('plottr-import')
    expect(modules.map((module) => module.id)).not.toContain('canon-history')
    expect(entities).toHaveLength(231)
    expect(entities.some((entity) => entity.canonStatus === 'PROPOSAL')).toBe(false)
    expect(entities.some((entity) => entity.canonStatus === 'OPEN_QUESTION')).toBe(false)
    expect(entities.some((entity) => entity.canonStatus === 'CANON_SCRIPTURE')).toBe(true)
    expect(searchUniverse(universe, 'Causa Tardía')).toHaveLength(0)
  })

  it('shows the active outline and hides nested proposed layers from canonical details', () => {
    const canonCurrent = universe.modules.find((module) => module.id === 'canon-current')!
    const characters = universe.modules.find((module) => module.id === 'characters')!
    const clay = canonicalModuleItems(universe, characters).find(
      (entity) => entity.id === 'meme-clay',
    )!
    const visibleFields = new Set(canonicalDetailEntries(universe, clay).map(([key]) => key))

    expect(
      canonicalModuleItems(universe, canonCurrent).some(
        (entity) => entity.id === 'meme-escaleta-n1-canon',
      ),
    ).toBe(true)
    expect(visibleFields.has('rioLayer')).toBe(false)
  })
})
