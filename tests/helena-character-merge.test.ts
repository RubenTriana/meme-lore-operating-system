import { describe, expect, it } from 'vitest'
import universeData from '../data/universe_master.json'
import type { Universe } from '../src/types/universe'

const universe = universeData as unknown as Universe
const allEntities = universe.modules.flatMap((module) => module.content.items ?? [])
const characters = universe.modules.find((module) => module.id === 'characters')?.content.items ?? []

describe('Helena character merge', () => {
  it('keeps Helena as the only canonical card for the paid captive archetype', () => {
    const helena = characters.find((entity) => entity.id === 'meme-helena')

    expect(characters.some((entity) => entity.id === 'meme-captive-who-refuses-rescue')).toBe(false)
    expect(helena).toMatchObject({
      title: 'Helena',
      alias: 'La mujer que no puede permitirse ser rescatada',
      type: 'character',
      status: 'active',
    })
    expect(helena?.summary).toContain('antigua cobaya remunerada')
    expect(helena?.arc).toContain('Distrito Cero')
  })

  it('absorbs the prototype conflict, signature line and system connections', () => {
    const helena = characters.find((entity) => entity.id === 'meme-helena')!
    const analysis = helena.analysis

    expect(analysis?.beliefs).toContain('Aquí me hacen daño, pero afuera vuelvo a no valer nada.')
    expect(analysis?.constraints).toContain('Sabe que está siendo utilizada.')
    expect(helena.tags).toEqual(expect.arrayContaining(['cobaya-remunerada', 'dos-caguan']))
    expect(helena.refs).toEqual(expect.arrayContaining([
      'meme-soma-basic',
      'meme-distrito-cero',
      'meme-participacion-continuidad-intensiva',
      'meme-renta-conductual',
    ]))
  })

  it('leaves no canonical reference to the removed card while preserving source-dossier provenance', () => {
    const referenceFields = ['refs', 'foreshadowing', 'participantRefs', 'causes', 'effects'] as const
    for (const entity of allEntities) {
      for (const field of referenceFields) {
        expect(entity[field] ?? []).not.toContain('meme-captive-who-refuses-rescue')
      }
    }

    expect(JSON.stringify(universeData)).toContain('captive_who_refuses_rescue')
  })
})
