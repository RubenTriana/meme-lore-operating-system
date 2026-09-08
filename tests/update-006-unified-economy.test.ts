import master from '../data/universe_master.json'
import { analyzeCausality } from '../src/analysis/causality'
import { compileDerived, normalizeUniverse } from '../src/analysis/derived'
import { validateUniverse } from '../src/schemas/universe'
import type { AnalysisContext } from '../src/analysis/types'
import type { Universe } from '../src/types/universe'

const universe = master as Universe
const entities = new Map(universe.modules.flatMap((module) => module.content.items ?? []).map((entity) => [entity.id, entity]))
const canonicalStatuses = new Set(['CANON', 'INHERITED_CANON', 'CANON_DIRECTION', 'CANON_CATEGORY', 'CANON_SCRIPTURE'])

function contextFor(value: Universe): AnalysisContext {
  const normalized = normalizeUniverse(value)
  const compilation = compileDerived(normalized.universe, { generatedAt: '2042-04-12T00:00:00.000Z' })
  return { universe: normalized.universe, normalized, compilation, sourceHash: compilation.metadata.sourceHash, engineVersion: compilation.metadata.engineVersion }
}

describe('canon 0.8.0 unified human-compute economy', () => {
  const economy = universe.modules.find((module) => module.id === 'economy')!

  it('keeps one economy module and removes the redundant market taxonomy', () => {
    expect(universe.modules.some((module) => module.id === 'market')).toBe(false)
    expect(economy.title).toBe('Economía del Cómputo Humano')
    expect(economy.content.items).toHaveLength(9)
    expect(economy.content.items?.filter((entity) => entity.type === 'economic-system').map((entity) => entity.id)).toEqual(['meme-mercado-capacidad-humana'])
  })

  it('separates adoption in novel two from financialization in novel three', () => {
    const byNovel = (economy.content.items ?? []).reduce<Record<string, number>>((result, entity) => ({ ...result, [entity.primaryNovelRef ?? 'none']: (result[entity.primaryNovelRef ?? 'none'] ?? 0) + 1 }), {})
    expect(byNovel['meme-novela-dos']).toBe(4)
    expect(byNovel['meme-novela-tres']).toBe(5)
    expect(byNovel.none).toBeUndefined()
    expect(entities.get('meme-dividendo-nodo')?.primaryNovelRef).toBe('meme-novela-dos')
    expect(entities.get('meme-mercado-capacidad-humana')?.primaryNovelRef).toBe('meme-novela-tres')
  })

  it('retires the superseded DAFX instruments instead of preserving duplicate economies', () => {
    for (const retiredId of ['meme-mercado-futuros-voluntad', 'meme-economia-de-presencia', 'meme-economia-del-terror', 'meme-cuota-futuro-conductual-cfc']) {
      expect(entities.has(retiredId)).toBe(false)
    }
  })

  it('orders the launch promise before the actual exchange opens', () => {
    const announcement = entities.get('meme-n2-anuncio-dafx')!
    const opening = entities.get('meme-n3-apertura-dafx')!
    expect(announcement.sequence).toBeLessThan(opening.sequence!)
    expect(announcement.refs).toContain('meme-dafx-exchange')
    expect(opening.refs).toContain('meme-dafx-exchange')
    expect(announcement.novelRef).toBe('meme-novela-dos')
    expect(opening.novelRef).toBe('meme-novela-tres')
  })

  it('passes schema, references and causal analysis', () => {
    const validation = validateUniverse(universe)
    expect(validation.valid).toBe(true)
    expect(validation.errors).toEqual([])
    const issues = analyzeCausality(contextFor(universe)).issues
    expect(issues.every((issue) => issue.entityIds.some((id) => !canonicalStatuses.has(String(entities.get(id)?.canonStatus))))).toBe(true)
  })
})
