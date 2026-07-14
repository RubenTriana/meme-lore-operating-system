import { analyzeContinuity, CONTINUITY_ENGINE_VERSION, inspectContinuity } from '../src/analysis/continuity'
import { compileDerived, normalizeUniverse } from '../src/analysis/derived'
import { compileAnalysisSnapshot } from '../src/analysis/incremental'
import { validateUniverse } from '../src/schemas/universe'
import type { AnalysisContext } from '../src/analysis/types'
import type { Universe } from '../src/types/universe'
import { continuityContradictionFixture, continuityFixture } from './fixtures/continuity-v3_4'

const generatedAt = '2042-04-12T00:00:00.000Z'

function contextFor(universe: Universe): AnalysisContext {
  const normalized = normalizeUniverse(universe)
  const compilation = compileDerived(normalized.universe, { generatedAt })
  return {
    universe: normalized.universe,
    normalized,
    compilation,
    sourceHash: compilation.metadata.sourceHash,
    engineVersion: compilation.metadata.engineVersion,
  }
}

function entity(universe: Universe, id: string) {
  const found = universe.modules.flatMap((module) => module.content.items ?? []).find((item) => item.id === id)
  if (!found) throw new Error(`Missing fixture entity: ${id}`)
  return found
}

describe('continuity analysis MVP', () => {
  it('accepts the additive continuity contract and reports no issue for a valid canon', () => {
    const universe = structuredClone(continuityFixture)

    expect(validateUniverse(universe).valid).toBe(true)
    expect(analyzeContinuity(contextFor(universe)).issues).toEqual([])
  })

  it('detects all four explicit continuity contradictions with canonical evidence', () => {
    const result = analyzeContinuity(contextFor(continuityContradictionFixture()))

    expect(result.issues.map((issue) => issue.ruleId)).toEqual([
      'character-dead-acting',
      'effect-before-cause',
      'incompatible-age',
      'incompatible-simultaneous-locations',
    ])
    result.issues.forEach((issue) => {
      expect(issue).toMatchObject({ engine: 'continuity', sourceHash: result.issues[0]?.sourceHash, engineVersion: CONTINUITY_ENGINE_VERSION })
      expect(issue.evidence.length).toBeGreaterThan(0)
    })
  })

  it('returns insufficient-data rather than a contradiction when facts are absent', () => {
    const universe = structuredClone(continuityFixture)
    universe.modules[0].content.items = [{ id: 'unknown-character', type: 'character', title: 'Unknown character' }]

    const result = analyzeContinuity(contextFor(universe))

    expect(result.issues).toEqual([])
    expect(inspectContinuity(contextFor(universe)).every((evaluation) => evaluation.status === 'insufficient-data')).toBe(true)
  })

  it('honors intentional structured exceptions for every MVP rule', () => {
    const universe = continuityContradictionFixture()
    entity(universe, 'hero-action').continuity = { exceptions: [{ kind: 'resurrection', subjectRefs: ['dead-hero'] }] }
    entity(universe, 'north-watch').continuity = { exceptions: [{ kind: 'teleportation', subjectRefs: ['scout'] }] }
    entity(universe, 'age-check').continuity = { ageAssertions: [{ entityRef: 'child', age: 40 }], exceptions: [{ kind: 'world-exception', ruleIds: ['incompatible-age'] }] }
    entity(universe, 'effect-event').continuity = { exceptions: [{ kind: 'time-travel', ruleIds: ['effect-before-cause'] }] }

    expect(analyzeContinuity(contextFor(universe)).issues).toEqual([])
  })

  it('includes enabled continuity issues in the worker snapshot contract', () => {
    const snapshot = compileAnalysisSnapshot(continuityContradictionFixture(), undefined, { generatedAt })

    expect(snapshot.issues.map((issue) => issue.ruleId)).toHaveLength(4)
  })
})
