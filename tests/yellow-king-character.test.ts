import { describe, expect, it } from 'vitest'
import universeData from '../data/universe_master.json'
import type { Universe } from '../src/types/universe'

const universe = universeData as unknown as Universe
const allEntities = universe.modules.flatMap((module) => module.content.items ?? [])

describe('retired Yellow King branch', () => {
  it('records its former integration and explicit retirement from the active tetralogy', () => {
    expect(universe.changelog).toContainEqual(expect.objectContaining({ id: 'change-009', version: '0.5.3' }))
    expect(universe.changelog.find((entry) => entry.id === 'change-013')?.changes.join(' ')).toContain('Retiró Carcosa, El Rey Amarillo')
  })

  it('removes the character and every live reference to the retired branch', () => {
    expect(allEntities.some((entity) => entity.id === 'meme-rey-amarillo')).toBe(false)
    expect(allEntities.some((entity) => entity.id === 'meme-carcosa')).toBe(false)
    for (const entity of allEntities) {
      expect(entity.refs ?? []).not.toContain('meme-rey-amarillo')
      expect(entity.foreshadowing ?? []).not.toContain('meme-rey-amarillo')
    }
  })

  it('publishes the replacement canon as version 0.8.1', () => {
    expect(universe.metadata).toMatchObject({ version: '0.8.1', build: 'canon-0.8.1-jano-entity' })
  })
})
