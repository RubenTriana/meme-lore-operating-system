import { describe, expect, it } from 'vitest'
import universeData from '../data/universe_master.json'
import type { Universe } from '../src/types/universe'

const universe = universeData as unknown as Universe
const entities = universe.modules.flatMap((module) => module.content.items ?? [])
const characters = universe.modules.find((module) => module.id === 'characters')?.content.items ?? []

describe('Helena in canon 0.11.0', () => {
  const helena = characters.find((entity) => entity.id === 'meme-helena')

  it('keeps one definitive Helena without the retired prototype card', () => {
    expect(characters.filter((entity) => entity.id === 'meme-helena')).toHaveLength(1)
    expect(entities.some((entity) => entity.id === 'meme-captive-who-refuses-rescue')).toBe(false)
    expect(helena).toMatchObject({ title: 'Helena', type: 'character', status: 'developing', priority: 'high', canonStatus: 'OPEN_QUESTION' })
  })

  it('anchors her conflict in family substitution and material survival', () => {
    expect(helena?.summary).toContain('SOMA Clinic')
    expect(helena?.contradiction).toContain('hijo')
    expect(helena?.irreversibleChoice).toContain('Partición')
    expect(helena?.moralLimit).toContain('hijos')
    expect(helena?.refs).toEqual(expect.arrayContaining(['meme-soma-clinic', 'meme-nodo-humano', 'meme-clay']))
    expect(helena?.novelRefs).toEqual(['meme-novela-dos', 'meme-novela-tres', 'meme-novela-cuatro'])
  })

  it('contains a complete cruelty profile with a material counterweight', () => {
    expect(helena?.crueltyProfile?.method).toEqual(expect.any(String))
    expect(helena?.crueltyProfile?.justification).toEqual(expect.any(String))
    expect(helena?.crueltyProfile?.counterweight).toContain('salva pacientes')
    expect(helena?.crueltyProfile?.maximumAct).toEqual(expect.any(String))
  })
})
