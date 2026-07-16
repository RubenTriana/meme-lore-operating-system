import { describe, expect, it } from 'vitest'
import universeData from '../data/universe_master.json'
import { createSemanticIndex, getEntityConnections } from '../src/utils/semantic-index'
import type { Universe } from '../src/types/universe'

const universe = universeData as unknown as Universe
const allEntities = universe.modules.flatMap((module) => module.content.items ?? [])
const characters = universe.modules.find((module) => module.id === 'characters')?.content.items ?? []
const yellowKing = characters.find((entity) => entity.id === 'meme-rey-amarillo')

describe('El Rey Amarillo character integration', () => {
  it('publishes the integration as canon 0.5.3', () => {
    expect(universe.metadata.version).toBe('0.5.3')
    expect(universe.changelog).toContainEqual(expect.objectContaining({
      id: 'change-009',
      version: '0.5.3',
    }))
  })

  it('keeps one canonical entity and presents it as a character', () => {
    expect(allEntities.filter((entity) => entity.id === 'meme-rey-amarillo')).toHaveLength(1)
    expect(yellowKing).toMatchObject({
      type: 'character',
      title: 'El Rey Amarillo',
      alias: 'La máscara de los futuros abandonados',
      status: 'locked',
      priority: 'critical',
    })
  })

  it('has a complete dramatic engine without violating hidden-canon limits', () => {
    for (const field of ['desire', 'need', 'wound', 'contradiction', 'goal', 'arc', 'risk'] as const) {
      expect(yellowKing?.[field]).toEqual(expect.any(String))
      expect((yellowKing?.[field] as string).trim().length).toBeGreaterThan(60)
    }

    expect(yellowKing?.analysis?.constraints).toEqual(expect.arrayContaining([
      expect.stringContaining('No identificarlo con Dios'),
      expect.stringContaining('No atribuirle la creación de MEME'),
      expect.stringContaining('novela 1'),
    ]))
  })

  it('exposes sixteen resolvable graph connections', () => {
    const index = createSemanticIndex(universe)
    const connections = getEntityConnections(index, 'meme-rey-amarillo')

    expect(connections).toHaveLength(16)
    expect(connections.map((entity) => entity.id)).toEqual(expect.arrayContaining([
      'meme-carcosa',
      'meme-clay',
      'meme-meme',
      'meme-dafx-alimenta-residuos-contrafactuales',
      'meme-proyecto-jano',
      'meme-corona-incompleta',
    ]))
  })
})
