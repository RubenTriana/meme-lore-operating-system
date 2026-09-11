import { describe, expect, it } from 'vitest'
import source from '../data/universe_master.json'
import { validateUniverse } from '../src/schemas/universe'
import type { Universe, UniverseEntity } from '../src/types/universe'

const universe = source as unknown as Universe
const entities = universe.modules.flatMap((module) => module.content.items ?? [])
const byId = new Map(entities.map((entity) => [entity.id, entity]))
const entity = (id: string) => {
  const found = byId.get(id)
  if (!found) throw new Error(`Missing acceptance entity: ${id}`)
  return found as UniverseEntity & Record<string, unknown>
}

const newCharacterIds = [
  'meme-ines',
  'meme-hermano-ines',
  'meme-operadora-llamada',
  'meme-conductor-comunitario',
  'meme-administrador',
  'meme-abelardo',
  'meme-hombre-bloqueo',
  'meme-mujer-hombre-bloqueo',
  'meme-desconocida-bloqueo',
  'meme-intermediaria-amaranta',
  'meme-anfitriona-cafetal',
  'meme-pareja-anfitriona-cafetal',
  'meme-enlace-vaticano',
  'meme-enlace-autentico-clay',
]

const reconciledCharacterIds = [
  'meme-clay',
  'meme-bartolomeo',
  'meme-vicente',
  'meme-ruth',
  'meme-identidad-el-americano',
]

describe('canon 0.11.1 acceptance', () => {
  it('preserves the approved release, structure and unique entity identities', () => {
    const ids = entities.map((item) => item.id)

    expect(universe.metadata.version).toBe('0.11.1')
    expect(universe.metadata.schemaVersion).toBe('3.5.0')
    expect(universe.metadata.releaseStatus).toBe('CANON')
    expect(universe.modules).toHaveLength(19)
    expect(entities).toHaveLength(499)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('materializes the 42-unit outline in its exact approved order', () => {
    const outline = entity('meme-escaleta-n1-canon')
    const orderedSceneRefs = outline.orderedSceneRefs as string[]
    const activeScenes = entities
      .filter(
        (item) =>
          item.type === 'event' &&
          item.novelRef === 'meme-novela-uno' &&
          item.outlineVersion === 'v2' &&
          item.canonStatus === 'CANON',
      )
      .sort((a, b) => Number(a.outlineOrder) - Number(b.outlineOrder))

    expect(outline.unitCount).toBe(42)
    expect(orderedSceneRefs).toHaveLength(42)
    expect(activeScenes.map((item) => item.id)).toEqual(orderedSceneRefs)
    expect(orderedSceneRefs.filter((id) => /(?:18a|21a|23a|24a|28a|35a)$/.test(id))).toEqual([
      'meme-n1-escena-18a',
      'meme-n1-escena-21a',
      'meme-n1-escena-23a',
      'meme-n1-escena-24a',
      'meme-n1-escena-28a',
      'meme-n1-escena-35a',
    ])
    expect(outline).toMatchObject({
      title: 'Unidades narrativas canónicas v2 — 42 unidades',
      outlineVersion: 'v2',
      approvalRef: 'meme-canon-aprobacion-20260910-unidades-v2',
    })
    expect(outline.sourceHash).toBe(
      '6fa78716f86d8108e99be5f9ef67cb830d137772aa9820a0897b6f2added4647',
    )
    expect(activeScenes.filter((item) => typeof item.cambioDramatico === 'string')).toHaveLength(28)
    expect(activeScenes.filter((item) => typeof item.directrizDeProsa === 'string')).toHaveLength(28)
    expect(activeScenes.filter((item) => typeof item.intervencionPalimpsesto === 'string')).toHaveLength(18)
    expect(activeScenes.filter((item) => typeof item.decisionIrreversible === 'string')).toHaveLength(1)
  })

  it('keeps the approved beats and character inventory without identity merges', () => {
    const activeBeats = universe.modules
      .find((module) => module.id === 'save-the-cat')!
      .content.items?.filter((item) => item.type === 'beat')

    expect(activeBeats).toHaveLength(15)
    for (const id of newCharacterIds) {
      expect(entity(id)).toMatchObject({ type: 'character', canonStatus: 'CANON' })
    }
    for (const id of reconciledCharacterIds.slice(0, 4)) {
      expect(entity(id).type).toBe('character')
    }
    expect(entity('meme-identidad-el-americano').type).toBe('constructed-identity')
    expect(new Set(newCharacterIds)).toHaveLength(14)
    expect(entity('meme-administrador').id).not.toBe(entity('meme-abelardo').id)
    expect(entity('meme-administrador').id).not.toBe(entity('meme-vicente').id)
    expect(entity('meme-identidad-el-americano').refs).toContain('meme-clay')
  })

  it('protects the approved narrative limits and regression answers', () => {
    const scene06 = entity('meme-n1-escena-06')
    const scene07 = entity('meme-n1-escena-07')
    const scene08 = entity('meme-n1-escena-08')
    const scene10 = entity('meme-n1-escena-10')
    const scene11 = entity('meme-n1-escena-11')
    const scene16 = entity('meme-n1-escena-16')
    const scene19 = entity('meme-n1-escena-19')
    const scene34 = entity('meme-n1-escena-34')
    const scene36 = entity('meme-n1-escena-36')
    const clay = entity('meme-clay')
    const bartolomeo = entity('meme-bartolomeo')

    expect(scene06.effects).toContain('meme-n1-escena-07')
    expect(scene07).toMatchObject({ outlineOrder: 7 })
    expect(scene07.characterRefs).toContain('meme-administrador')
    expect(scene08.summary).toContain('SOMA')
    expect(scene10).toMatchObject({ outlineUnit: '10', outlineOrder: 10, canonStatus: 'CANON' })
    expect(scene11).toMatchObject({ outlineUnit: '11', outlineOrder: 11, canonStatus: 'CANON' })
    expect(scene16.title).toBe('16 — La mujer que no puede salir del encuadre')
    expect(scene16.intervencionPalimpsesto).toContain('una llamada de Abelardo')
    expect(scene19).toMatchObject({ outlineUnit: '19', outlineOrder: 20 })
    expect(scene19.characterRefs).toContain('meme-bartolomeo')
    expect((bartolomeo.powers as Record<string, string[]>).approvedNovelOneRefs).toEqual([
      'meme-bartolomeo-escucha-proxima',
      'meme-bartolomeo-lectura-funcional',
      'meme-bartolomeo-restitucion-incipiente',
    ])
    expect((clay.analysis as Record<string, string>).novelOnePowerStatus).toContain(
      'HUMAN_SKILLS_ONLY',
    )
    expect(entity('meme-harry').summary).toContain('MEME fabricó su muerte')
    expect(scene34.title).toBe('34 — La salvación se hace viral')
    expect(scene34.summary).toContain('lote sellado')
    expect(scene36.title).toBe('36 — La libertad que dejó a otro encerrado')
    expect(scene36.summary).toContain('Mateo')
    expect(entity('meme-estado-escritura-actual').currentManuscriptVerified).toBe(false)
  })

  it('validates idempotently while preserving approval metadata and settings', () => {
    const first = validateUniverse(structuredClone(source))
    expect(first.valid).toBe(true)
    const second = validateUniverse(structuredClone(first.data))

    expect(second.valid).toBe(true)
    expect(second.data?.modules).toHaveLength(19)
    expect(second.data?.modules.flatMap((module) => module.content.items ?? [])).toHaveLength(499)
    expect(second.data?.metadata.releaseStatus).toBe('CANON')
    expect(second.data?.metadata.sourceManifest).toEqual(first.data?.metadata.sourceManifest)
    expect(second.data?.settings?.canonPolicy).toEqual(first.data?.settings?.canonPolicy)
    expect(second.data?.settings?.canonApproval).toEqual(first.data?.settings?.canonApproval)
  })
})
