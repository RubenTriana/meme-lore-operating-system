import { describe, expect, it } from 'vitest'
import universeData from '../data/universe_master.json'
import { scoreCharacterProfile } from '../src/analysis/character-profile'
import type { Universe, UniverseEntity } from '../src/types/universe'

const universe = universeData as unknown as Universe
const characters = universe.modules.find((module) => module.id === 'characters')?.content.items ?? []

describe('character profile scoring', () => {
  it('preserves editorial importance and narrative-time values', () => {
    const scores = scoreCharacterProfile({
      id: 'test-character',
      type: 'character',
      title: 'Test',
      importance: 86,
      narrativeTime: 54,
    })

    expect(scores.importance).toBe(86)
    expect(scores.narrativeTime).toBe(54)
  })

  it('derives missing editorial axes from priority, connectivity, and novel presence', () => {
    const scores = scoreCharacterProfile({
      id: 'tetralogy-character', type: 'character', title: 'Tetralogy', priority: 'critical',
      refs: ['one', 'two', 'three', 'four'], novelRefs: ['n1', 'n2', 'n3', 'n4'],
    })
    expect(scores.importance).toBeGreaterThanOrEqual(90)
    expect(scores.narrativeTime).toBeGreaterThanOrEqual(95)
  })

  it('rewards a complete dramatic engine over a minimal profile', () => {
    const minimal: UniverseEntity = { id: 'minimal', type: 'character', title: 'Minimal', summary: 'Breve.' }
    const complete: UniverseEntity = {
      id: 'complete',
      type: 'character',
      title: 'Complete',
      summary: 'Un personaje plenamente conectado con el conflicto principal y con una función narrativa definida dentro del universo canónico.'.repeat(2),
      alias: 'La continuidad completa',
      desire: 'Desea recuperar una vida que el sistema convirtió en una variable negociable sin perder su libertad ni la de quienes ama.',
      need: 'Necesita aceptar que proteger a los demás no le permite reemplazar sus decisiones ni cerrar las posibilidades que todavía pueden elegir.',
      wound: 'La pérdida de su familia y la apropiación institucional de sus recuerdos destruyeron su confianza en toda forma de continuidad.',
      contradiction: 'Combate la administración de la voluntad, pero utiliza el mismo poder de predicción y control cuando teme perder nuevamente a quienes ama.',
      goal: 'Romper el contrato que convierte su identidad futura en propiedad del sistema sin destruir a quienes dependen materialmente de él.',
      arc: 'Comienza buscando restaurar el pasado y termina comprendiendo que ninguna continuidad puede ser libre si está obligada a reproducir una versión anterior de sí misma.'.repeat(3),
      risk: 'Puede convertirse en el instrumento humano que complete el sistema que juró destruir y clausure las alternativas de toda una población.',
      irreversibleChoice: 'Desconecta una región después de comprobar que el sistema no puede preservar a todos y asume personalmente la responsabilidad por las vidas perdidas.',
      moralLimit: 'No convertir a ninguna persona en instrumento de otra, incluso cuando la infraestructura dependa materialmente de esa decisión.',
      novelRefs: ['meme-novela-uno', 'meme-novela-dos', 'meme-novela-tres', 'meme-novela-cuatro'],
      crueltyProfile: {
        method: 'Retirar opciones y asignar el coste de supervivencia a quienes tienen menos capacidad de rechazarlo.',
        justification: 'Sostener hospitales, alimentos y energía durante una crisis que no permite conservar todos los servicios.',
        counterweight: 'La elección salva vidas concretas y deja víctimas reales que no consintieron el precio pagado.',
        maximumAct: 'Borrar a la persona que ama y decidir qué región pierde coordinación durante la Partición.',
      },
      refs: Array.from({ length: 12 }, (_, index) => `ref-${index}`),
      foreshadowing: ['one', 'two', 'three', 'four'],
      analysis: { goals: ['Resolver el conflicto central'] },
    }

    expect(scoreCharacterProfile(complete).development).toBeGreaterThan(90)
    expect(scoreCharacterProfile(complete).quality).toBeGreaterThan(90)
    expect(scoreCharacterProfile(complete).development).toBeGreaterThan(scoreCharacterProfile(minimal).development)
    expect(scoreCharacterProfile(complete).quality).toBeGreaterThan(scoreCharacterProfile(minimal).quality)
  })

  it('scores every current character on one fixed 0–100 scale', () => {
    expect(characters).toHaveLength(11)
    for (const character of characters) {
      const scores = scoreCharacterProfile(character)
      for (const value of Object.values(scores)) {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
      expect(scores.quality).toBeGreaterThan(0)
    }
  })

  it.each(['meme-clay', 'meme-amaranta', 'meme-harry', 'meme-meme'])('%s reflects its completed core profile', (characterId) => {
    const character = characters.find((item) => item.id === characterId)
    expect(character).toBeDefined()
    const scores = scoreCharacterProfile(character!)
    expect(scores.development).toBeGreaterThanOrEqual(85)
    expect(scores.quality).toBeGreaterThanOrEqual(85)
  })
})
