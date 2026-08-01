import { describe, expect, it } from 'vitest'
import universeData from '../data/universe_master.json'
import type { Universe } from '../src/types/universe'

const coreCharacterIds = ['meme-clay', 'meme-amaranta', 'meme-harry', 'meme-meme'] as const
const engineFields = ['desire', 'need', 'wound', 'contradiction'] as const
const universe = universeData as unknown as Universe

describe('core character profiles', () => {
  const charactersModule = universe.modules.find((module) => module.id === 'characters')
  const characters = charactersModule?.content?.items ?? []

  it.each(coreCharacterIds)('%s has a complete dramatic engine', (characterId) => {
    const character = characters.find((item) => item.id === characterId)

    expect(character).toBeDefined()
    for (const field of engineFields) {
      const value = character?.[field]
      expect(value).toEqual(expect.any(String))
      expect((value as string).trim().length).toBeGreaterThan(40)
    }
  })

  it.each(coreCharacterIds)('%s has a goal, arc and explicit narrative risk', (characterId) => {
    const character = characters.find((item) => item.id === characterId)

    expect((character?.goal as string).trim().length).toBeGreaterThan(30)
    expect((character?.arc as string).trim().length).toBeGreaterThan(120)
    expect((character?.risk as string).trim().length).toBeGreaterThan(40)
  })

  it('keeps every added character reference resolvable', () => {
    const allEntityIds = new Set(
      universe.modules.flatMap((module) => module.content.items ?? []).map((item) => item.id),
    )

    for (const characterId of coreCharacterIds) {
      const character = characters.find((item) => item.id === characterId)
      expect(character?.refs?.every((ref) => allEntityIds.has(ref))).toBe(true)
    }
  })
})
