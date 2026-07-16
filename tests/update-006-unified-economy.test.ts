import master from '../data/universe_master.json'
import update006 from '../data/updates/meme-lore-update-006-bolsa-futuros-atencion-profunda.patch.json'
import { analyzeCausality } from '../src/analysis/causality'
import { compileDerived, normalizeUniverse } from '../src/analysis/derived'
import { validateUniverse } from '../src/schemas/universe'
import type { AnalysisContext } from '../src/analysis/types'
import type { Universe } from '../src/types/universe'

const universe = master as Universe

function contextFor(value: Universe): AnalysisContext {
  const normalized = normalizeUniverse(value)
  const compilation = compileDerived(normalized.universe, { generatedAt: '2042-04-12T00:00:00.000Z' })
  return { universe: normalized.universe, normalized, compilation, sourceHash: compilation.metadata.sourceHash, engineVersion: compilation.metadata.engineVersion }
}

describe('update 006 unified deep-attention economy', () => {
  const economy = universe.modules.find((module) => module.id === 'economy')!
  const entities = new Map(universe.modules.flatMap((module) => module.content.items ?? []).map((entity) => [entity.id, entity]))

  it('keeps one economy module and one second-novel economic system', () => {
    expect(universe.changelog).toContainEqual(expect.objectContaining({ id: 'change-006', version: '0.5.0' }))
    expect(universe.modules.some((module) => module.id === 'market')).toBe(false)
    expect(economy.title).toBe('Economía de Futuros de Atención Profunda — DAFX')
    const novelTwoSystems = economy.content.items?.filter((entity) => entity.type === 'economic-system' && entity.tags?.includes('novela-dos')) ?? []
    expect(novelTwoSystems.map((entity) => entity.id)).toEqual(['meme-mercado-futuros-voluntad'])
  })

  it('subordinates the earlier economies without rewriting the first novel', () => {
    expect(entities.get('meme-economia-de-presencia')).toMatchObject({ type: 'economic-predecessor', title: 'Economía de Presencia — antecedente de la Novela 1' })
    expect(entities.get('meme-dividendo-presencia')?.type).toBe('economic-mechanism')
    expect(entities.get('meme-financiarizacion-de-la-voluntad')?.type).toBe('economic-mechanism')
    expect(entities.get('meme-economia-del-terror')).toMatchObject({ type: 'economic-mechanism', title: 'Cobertura del miedo — mecanismo DAFX' })
  })

  it('integrates every entity supplied by the patch even when market entities move to economy', () => {
    const patchEntityIds = update006.operations.flatMap((operation) => {
      const value = operation.value as { id?: string } | string
      return typeof value === 'object' && value?.id && operation.path.includes('/content/items/') ? [value.id] : []
    })
    expect(patchEntityIds.length).toBeGreaterThan(70)
    expect(patchEntityIds.filter((id) => !entities.has(id))).toEqual([])
    expect(economy.content.items?.some((entity) => entity.id === 'meme-cuota-futuro-conductual-cfc')).toBe(true)
    expect(economy.content.items?.some((entity) => entity.id === 'meme-maker-oscuro-de-clay')).toBe(true)
  })

  it('defines MEME, SOMA and Clay as roles in one value cycle limited to novel two', () => {
    const system = entities.get('meme-mercado-futuros-voluntad')!
    const analysis = system.analysis as typeof system.analysis & { scope?: string; roles?: Record<string, string>; valueCycle?: string[] }
    expect(analysis.scope).toBe('Novela 2 exclusivamente')
    expect(Object.keys(analysis.roles ?? {})).toEqual(['MEME', 'SOMA', 'Clay'])
    expect(analysis.valueCycle).toHaveLength(6)
    expect(entities.get('meme-novela-dos')?.summary).toContain('único sistema económico de la segunda novela')
  })

  it('orders the launch before underwriting and the auction without adding causal issues', () => {
    const inauguration = entities.get('meme-inauguracion-dafx')!
    const underwriting = entities.get('meme-clay-monetiza-el-deseo')!
    const auction = entities.get('meme-primera-subasta-poblaciones')!
    expect([inauguration.sequence, underwriting.sequence, auction.sequence]).toEqual([4000, 4020, 4040])

    const updateEventIds = new Set(update006.operations
      .filter((operation) => operation.path.startsWith('/modules/timeline/content/items/'))
      .map((operation) => (operation.value as { id: string }).id))
    const newIssues = analyzeCausality(contextFor(universe)).issues.filter((issue) => issue.entityIds.some((id) => updateEventIds.has(id)))
    expect(newIssues).toEqual([])
  })

  it('passes schema and cross-reference validation', () => {
    const validation = validateUniverse(universe)
    expect(validation.valid).toBe(true)
    expect(validation.errors).toEqual([])
    expect(entities.get('meme-soma-continuum')?.refs).toContain('meme-canon-soma-continuum-organigrama')
    expect(entities.get('meme-soma-continuum')?.refs).not.toContain('meme-arquitectura-gobierno-soma')
  })
})
