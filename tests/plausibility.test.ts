import { DEFAULT_PLAUSIBILITY_PROFILE, evaluateNarrativePlausibility, validateNarrativeHypothesis, validatePlausibilityProfile, type NarrativeHypothesis, type PlausibilityProfile } from '../src/analysis/plausibility'
import { readPlausibilityProfiles, savePlausibilityProfile } from '../src/services/plausibility-profiles'
import { plausibilityFixture } from './fixtures/plausibility-v3_5'

const hypothesis: NarrativeHypothesis = { id: 'clay-protects-refuge', actorRef: 'clay', action: 'protect refuge during enemy siege', targetRef: 'refuge', contextEventRef: 'siege' }

describe('Narrative Plausibility Score', () => {
  beforeEach(() => localStorage.clear())

  it('accepts the default weights and rejects totals other than 100', () => {
    expect(validatePlausibilityProfile(DEFAULT_PLAUSIBILITY_PROFILE)).toEqual({ valid: true, errors: [] })
    const invalid = { ...DEFAULT_PLAUSIBILITY_PROFILE, weights: { ...DEFAULT_PLAUSIBILITY_PROFILE.weights, goalAlignment: 31 } }
    expect(validatePlausibilityProfile(invalid).valid).toBe(false)
    expect(validatePlausibilityProfile(invalid).errors).toContain('Los pesos deben sumar 100; actualmente suman 101.')
  })

  it('returns stable scores, evidence, sensitivity, and reproducible explanations', () => {
    const first = evaluateNarrativePlausibility(plausibilityFixture, hypothesis)
    const second = evaluateNarrativePlausibility(structuredClone(plausibilityFixture), { ...hypothesis })
    expect(second).toEqual(first)
    expect(first.score).toBeGreaterThan(0)
    expect(first.coverage).toBe(100)
    expect(first.factors).toHaveLength(6)
    expect(first.evidence.some((item) => item.sourceId === 'clay' && item.field === 'analysis.goals')).toBe(true)
    expect(first.sensitivity).toHaveLength(6)
    expect(first.explanation).toContain('promedio ponderado')
    expect(first.warning).toContain('No es una predicción')
  })

  it('separates incomplete coverage from plausibility', () => {
    const result = evaluateNarrativePlausibility(plausibilityFixture, { id: 'sparse', actorRef: 'sparse-actor', action: 'protect refuge' })
    expect(result.score).toBe(100)
    expect(result.coverage).toBe(30)
    expect(result.missingData).toHaveLength(5)
    expect(result.explanation).toContain('no cuentan como cero')
  })

  it('changes the result under a different valid profile without changing canon', () => {
    const canonBefore = structuredClone(plausibilityFixture)
    const profile: PlausibilityProfile = { id: 'belief-first', name: 'Belief first', weights: { goalAlignment: 0, beliefAlignment: 80, externalPressure: 0, fearAlignment: 0, precedents: 10, foreshadowing: 10 } }
    const baseline = evaluateNarrativePlausibility(plausibilityFixture, hypothesis)
    const adjusted = evaluateNarrativePlausibility(plausibilityFixture, hypothesis, profile)
    expect(adjusted.score).not.toBe(baseline.score)
    expect(plausibilityFixture).toEqual(canonBefore)
  })

  it('rejects a hypothesis whose entity does not exist', () => {
    const invalid = { ...hypothesis, actorRef: 'missing-character' }
    expect(validateNarrativeHypothesis(plausibilityFixture, invalid).errors).toContain('actorRef no existe: missing-character')
    expect(() => evaluateNarrativePlausibility(plausibilityFixture, invalid)).toThrow('actorRef no existe')
  })

  it('persists valid profiles outside the canon', () => {
    const profile: PlausibilityProfile = { id: 'custom', name: 'Custom', weights: { ...DEFAULT_PLAUSIBILITY_PROFILE.weights } }
    savePlausibilityProfile(profile)
    expect(readPlausibilityProfiles().map((item) => item.id)).toEqual(['default-structural', 'custom'])
    expect(plausibilityFixture.analysisConfig?.engines.plausibility).toBe(true)
  })
})
