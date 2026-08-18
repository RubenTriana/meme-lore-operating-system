import source from '../data/universe_master.json'
import { generateSyntheticUniverse } from '../src/analysis/benchmark/generator'
import { analyzeCausality } from '../src/analysis/causality'
import { ANALYSIS_ENGINE_VERSION, compileDerived, normalizeUniverse } from '../src/analysis/derived'
import { deduplicateIssues } from '../src/analysis/issue-utils'
import type { AnalysisContext, NarrativeIssue } from '../src/analysis/types'
import { validateUniverse } from '../src/schemas/universe'
import { loadUniverse } from '../src/services/universe-loader'

describe('analysis release hardening', () => {
  it('isolates corrupt canon and keeps the bundled canonical fixture valid', () => {
    expect(() => loadUniverse({ corrupt: true })).not.toThrow()
    expect(loadUniverse({ corrupt: true }).validation.valid).toBe(false)
    expect(validateUniverse(source).valid).toBe(true)
  })

  it('generates reproducible, valid synthetic universes with exact sizes', () => {
    const first = generateSyntheticUniverse({ entityCount: 1_000, seed: 42 })
    const second = generateSyntheticUniverse({ entityCount: 1_000, seed: 42 })
    expect(second).toEqual(first)
    expect(first.modules.flatMap((module) => module.content.items ?? [])).toHaveLength(1_000)
    expect(validateUniverse(first).valid).toBe(true)
  })

  it('handles a 10,000-entity causal chain without recursive stack overflow', () => {
    const universe = generateSyntheticUniverse({ entityCount: 10_000, seed: 42 })
    const normalized = normalizeUniverse(universe)
    const compilation = compileDerived(universe, { generatedAt: '2026-07-14T00:00:00.000Z' })
    const context: AnalysisContext = { universe: normalized.universe, normalized, compilation, sourceHash: compilation.metadata.sourceHash, engineVersion: ANALYSIS_ENGINE_VERSION }

    expect(() => analyzeCausality(context)).not.toThrow()
  }, 10_000)

  it('deduplicates and orders thousands of issues deterministically', () => {
    const issues: NarrativeIssue[] = Array.from({ length: 5_000 }, (_, index) => ({ id: `issue-${String(index).padStart(5, '0')}`, engine: 'continuity', ruleId: 'stress-fixture', severity: 'low', confidence: 1, title: 'Synthetic issue', message: 'Stress fixture only.', entityIds: [], sourceIds: [], evidence: [], sourceHash: 'fixture', engineVersion: 'fixture' }))
    const result = deduplicateIssues([...issues].reverse().flatMap((issue) => [issue, structuredClone(issue)]))

    expect(result).toHaveLength(5_000)
    expect(result[0]?.id).toBe('issue-00000')
    expect(result.at(-1)?.id).toBe('issue-04999')
  })
})
