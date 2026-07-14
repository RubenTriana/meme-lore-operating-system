import { analyzeCausality } from '../src/analysis/causality'
import { compileDerived, normalizeUniverse } from '../src/analysis/derived'
import { compileAnalysisSnapshot } from '../src/analysis/incremental'
import { analyzeKnowledge, inspectKnowledge } from '../src/analysis/knowledge'
import { validateUniverse } from '../src/schemas/universe'
import type { AnalysisContext } from '../src/analysis/types'
import type { Universe } from '../src/types/universe'
import { continuityContradictionFixture } from './fixtures/continuity-v3_4'
import { causalityContradictionFixture, causalityKnowledgeFixture, flashbackKnowledgeFixture, knowledgeContradictionFixture } from './fixtures/causality-knowledge-v3_5'

const generatedAt = '2042-04-12T00:00:00.000Z'

function contextFor(universe: Universe): AnalysisContext {
  const normalized = normalizeUniverse(universe)
  const compilation = compileDerived(normalized.universe, { generatedAt })
  return { universe: normalized.universe, normalized, compilation, sourceHash: compilation.metadata.sourceHash, engineVersion: compilation.metadata.engineVersion }
}

describe('causality and knowledge analysis', () => {
  it('keeps a fully declared causal and knowledge chain valid', () => {
    expect(validateUniverse(causalityKnowledgeFixture).valid).toBe(true)
    expect(analyzeCausality(contextFor(causalityKnowledgeFixture)).issues).toEqual([])
    expect(analyzeKnowledge(contextFor(causalityKnowledgeFixture)).issues).toEqual([])
  })

  it('detects the six causal rule classes with deterministic evidence', () => {
    const universe = causalityContradictionFixture()
    const result = analyzeCausality(contextFor(universe))
    const repeated = analyzeCausality(contextFor(structuredClone(universe)))
    expect(result.issues.map((issue) => issue.ruleId)).toEqual(expect.arrayContaining([
      'missing-cause-reference', 'effect-before-cause', 'undeclared-causal-cycle', 'important-event-without-cause', 'declared-cause-without-consequence', 'broken-causal-chain',
    ]))
    expect(new Set(result.issues.map((issue) => issue.id)).size).toBe(result.issues.length)
    expect(result.issues.map((issue) => issue.id)).toEqual(repeated.issues.map((issue) => issue.id))
    expect(result.issues.find((issue) => issue.ruleId === 'effect-before-cause')?.evidence.map((evidence) => evidence.field)).toContain('temporal')
  })

  it('honors an intentional structured causal cycle', () => {
    const universe = causalityContradictionFixture()
    const cycleA = universe.modules[0].content.items?.find((item) => item.id === 'cycle-a')
    if (!cycleA) throw new Error('Cycle fixture is incomplete.')
    cycleA.continuity = { exceptions: [{ kind: 'causal-loop', ruleIds: ['undeclared-causal-cycle'] }] }
    expect(analyzeCausality(contextFor(universe)).issues.some((issue) => issue.ruleId === 'undeclared-causal-cycle')).toBe(false)
  })

  it('reconstructs structured knowledge before actions and exposes uncertainty', () => {
    const result = analyzeKnowledge(contextFor(knowledgeContradictionFixture()))
    expect(result.issues.map((issue) => issue.ruleId)).toEqual(expect.arrayContaining([
      'knowledge-used-before-learning', 'remembered-after-forgetting', 'revelation-received-after-acting', 'knowledge-attributed-to-missing-character', 'temporally-ambiguous-knowledge-change',
    ]))
    const useBeforeLearning = result.issues.find((issue) => issue.ruleId === 'knowledge-used-before-learning')
    expect(useBeforeLearning?.evidence.map((evidence) => evidence.field)).toEqual(expect.arrayContaining(['knowledge.stateBefore', 'knowledge.introducedBy', 'timeline.position', 'knowledge.uncertainty']))
  })

  it('treats flashbacks and missing chronology as exceptions or insufficient data', () => {
    const flashback = analyzeKnowledge(contextFor(flashbackKnowledgeFixture()))
    expect(flashback.issues.some((issue) => issue.ruleId === 'knowledge-used-before-learning' || issue.ruleId === 'revelation-received-after-acting')).toBe(false)
    const insufficient = structuredClone(causalityKnowledgeFixture)
    insufficient.modules[0].content.items = [
      { id: 'analyst', type: 'character', title: 'Analyst' },
      { id: 'undated-action', type: 'event', title: 'Undated action', participantRefs: ['analyst'], analysis: { requiredKnowledge: ['unknown-fact'] } },
    ]
    expect(inspectKnowledge(contextFor(insufficient)).some((evaluation) => evaluation.status === 'insufficient-data')).toBe(true)
  })

  it('combines continuity and causality in the snapshot registry', () => {
    const universe = continuityContradictionFixture()
    universe.analysisConfig!.engines.causality = true
    universe.modules[0].content.items?.push({ id: 'causal-important', type: 'event', title: 'Causal important event', importance: 90 })
    const snapshot = compileAnalysisSnapshot(universe, undefined, { generatedAt })
    expect(snapshot.issues.map((issue) => issue.engine)).toEqual(expect.arrayContaining(['continuity', 'causality']))
    expect(snapshot.issues.some((issue) => issue.ruleId === 'important-event-without-cause' && issue.engine === 'causality')).toBe(true)
    expect(snapshot.issues.filter((issue) => issue.ruleId === 'effect-before-cause')).toHaveLength(1)
  })
})
