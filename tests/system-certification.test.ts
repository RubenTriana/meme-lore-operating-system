// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import source from '../data/universe_master.json'
import { analyzeCausality } from '../src/analysis/causality'
import { analyzeConnections } from '../src/analysis/connections'
import { analyzeContinuity, inspectContinuity } from '../src/analysis/continuity'
import { compileDerived, normalizeUniverse } from '../src/analysis/derived'
import { compileAnalysisSnapshot, planIncrementalCompilation } from '../src/analysis/incremental'
import { inspectKnowledge } from '../src/analysis/knowledge'
import { evaluateNarrativePlausibility } from '../src/analysis/plausibility'
import type { AnalysisContext, AnalysisSnapshot } from '../src/analysis/types'
import { validateUniverse } from '../src/schemas/universe'
import { annotationNeedsReview, readAnalysisAnnotations, writeIssueAnnotation } from '../src/services/analysis-annotations'
import type { AnalysisCache } from '../src/services/analysis-cache'
import { createAnalysisDiagnosticExport } from '../src/services/analysis-export'
import { createAnalysisService } from '../src/services/analysis-service'
import type { AnalysisCompiler } from '../src/services/analysis-worker-client'
import { migrateUniverse } from '../src/services/migrations'
import type { Universe } from '../src/types/universe'
import { verifyDerivedArtifactSet } from '../scripts/analysis-build.mjs'
import { certifiedExpectations } from './fixtures/system-certification-expected'
import { brokenReferenceCertificationFixture, insufficientDataCertificationFixture, missingReciprocalGraph, reciprocalGraph, systemCertificationFixture, withoutEntity } from './fixtures/system-certification-v3_5'

const generatedAt = '2042-04-12T00:00:00.000Z'

function contextFor(universe: Universe): AnalysisContext {
  const normalized = normalizeUniverse(universe)
  const compilation = compileDerived(normalized.universe, { generatedAt })
  return { universe: normalized.universe, normalized, compilation, sourceHash: compilation.metadata.sourceHash, engineVersion: compilation.metadata.engineVersion }
}

function issueFor(issues: AnalysisSnapshot['issues'], engine: string, ruleId: string, sourceId: string) {
  return issues.find((issue) => issue.engine === engine && issue.ruleId === ruleId && issue.sourceIds.includes(sourceId))
}

class CountingCompiler implements AnalysisCompiler {
  calls = 0
  async compile(universe: Universe, previous: AnalysisSnapshot | undefined): Promise<AnalysisSnapshot> {
    this.calls += 1
    return compileAnalysisSnapshot(universe, previous, { generatedAt })
  }
  cancelCompilation() {}
  dispose() {}
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('final experimental system certification', () => {
  it('keeps an independent manifest of exactly sixteen controlled expectations', () => {
    expect(certifiedExpectations).toHaveLength(16)
    expect(new Set(certifiedExpectations.map((entry) => entry.caseId)).size).toBe(16)
    certifiedExpectations.forEach((entry) => {
      expect(entry.expected).not.toBe('')
      expect(entry.mustNotTrigger.length).toBeGreaterThan(0)
      expect(entry.evidence.length).toBeGreaterThan(0)
      expect(['metric', 'observation', 'issue', 'insufficient-data']).toContain(entry.classification)
    })
  })

  it('ships the author manual, ten-step quick start, acceptance matrix, and canon report', async () => {
    const [manual, quickStart, matrix, report] = await Promise.all([
      readFile(join(process.cwd(), 'docs/user-manual.md'), 'utf8'),
      readFile(join(process.cwd(), 'docs/quick-start.md'), 'utf8'),
      readFile(join(process.cwd(), 'docs/system-acceptance-matrix.md'), 'utf8'),
      readFile(join(process.cwd(), 'docs/meme-canon-validation-report.md'), 'utf8'),
    ])
    expect(manual.match(/^## \d+\./gm)).toHaveLength(26)
    expect(quickStart.match(/^\d+\./gm)).toHaveLength(10)
    expect(matrix).toContain('PASS WITH LIMITATIONS')
    expect(matrix).toContain('Protección del canon')
    expect(report).toContain('fnv1a64-e020c17d2e15924d')
    expect(report).toContain('Muerte de Harry')
  })

  it('validates the certified fixture and rejects its isolated broken-reference variant', () => {
    expect(validateUniverse(systemCertificationFixture).valid).toBe(true)
    const invalid = validateUniverse(brokenReferenceCertificationFixture())
    expect(invalid.valid).toBe(false)
    expect(invalid.errors).toContainEqual(expect.objectContaining({ value: 'absent-entity', message: 'Broken cross-reference.' }))
  })

  it('detects the four controlled contradictions with stable IDs and evidence', () => {
    const first = compileAnalysisSnapshot(structuredClone(systemCertificationFixture), undefined, { generatedAt })
    const second = compileAnalysisSnapshot(structuredClone(systemCertificationFixture), undefined, { generatedAt: '2050-01-01T00:00:00.000Z' })
    const expected = [
      ['continuity', 'character-dead-acting', 'dead-acts'],
      ['continuity', 'incompatible-simultaneous-locations', 'north-presence'],
      ['continuity', 'effect-before-cause', 'early-effect'],
      ['knowledge', 'knowledge-used-before-learning', 'use-secret'],
    ] as const

    expected.forEach(([engine, ruleId, sourceId]) => {
      const issue = issueFor(first.issues, engine, ruleId, sourceId)
      expect(issue).toBeDefined()
      expect(issue?.evidence.length).toBeGreaterThan(0)
      expect(issueFor(second.issues, engine, ruleId, sourceId)?.id).toBe(issue?.id)
    })
    expect(second.metadata.sourceHash).toBe(first.metadata.sourceHash)
  })

  it('does not turn intentional exceptions or a distinct digital copy into false positives', () => {
    const context = contextFor(systemCertificationFixture)
    const continuity = analyzeContinuity(context).issues
    const causality = analyzeCausality(context).issues

    expect(continuity.some((issue) => issue.sourceIds.includes('permitted-flashback') && issue.ruleId === 'character-dead-acting')).toBe(false)
    expect(continuity.some((issue) => issue.sourceIds.includes('copy-acts') && issue.ruleId === 'character-dead-acting')).toBe(false)
    expect(causality.some((issue) => issue.ruleId === 'undeclared-causal-cycle' && issue.entityIds.includes('intentional-cycle-a'))).toBe(false)
  })

  it('classifies graph signals as metrics, observations, or issues without conflating them', () => {
    const context = contextFor(systemCertificationFixture)
    const result = analyzeConnections(context)
    expect(result.metrics.degreeCentrality.some((metric) => metric.entityId === 'component-a')).toBe(true)
    expect(result.observations.some((item) => item.kind === 'isolated-entity' && item.entityIds.includes('isolated-node'))).toBe(true)
    expect(result.observations.some((item) => item.kind === 'disconnected-component' && item.entityIds.includes('component-a'))).toBe(true)

    const reciprocalContext = { ...context, compilation: { ...context.compilation, relationGraph: reciprocalGraph } }
    const missingContext = { ...context, compilation: { ...context.compilation, relationGraph: missingReciprocalGraph } }
    expect(analyzeConnections(reciprocalContext, { requiredReciprocalEdgeTypes: ['alliance'] }).issues).toEqual([])
    expect(analyzeConnections(missingContext, { requiredReciprocalEdgeTypes: ['alliance'] }).issues).toEqual([
      expect.objectContaining({ ruleId: 'missing-required-reciprocity', severity: 'medium' }),
    ])
  })

  it('reports insufficient data and keeps partial plausibility coverage separate from score', () => {
    const context = contextFor(insufficientDataCertificationFixture())
    expect(inspectContinuity(context).some((entry) => entry.status === 'insufficient-data')).toBe(true)
    expect(inspectKnowledge(context).some((entry) => entry.status === 'insufficient-data')).toBe(true)

    const plausibility = evaluateNarrativePlausibility(systemCertificationFixture, { id: 'partial-coverage', actorRef: 'sparse-actor', action: 'protect refuge', targetRef: 'refuge' })
    expect(plausibility.coverage).toBe(30)
    expect(plausibility.score).toBe(100)
    expect(plausibility.missingData).toHaveLength(5)
  })

  it('preserves the real canon through migration and deterministic compilation', () => {
    const before = structuredClone(source)
    const once = migrateUniverse(source)
    const twice = migrateUniverse(once.data)
    const firstValidation = validateUniverse(once.data)
    const secondValidation = validateUniverse(twice.data)
    if (!firstValidation.data || !secondValidation.data) throw new Error('Migrated canon must remain valid.')
    const first = compileDerived(firstValidation.data, { generatedAt })
    const second = compileDerived(secondValidation.data, { generatedAt: '2050-01-01T00:00:00.000Z' })

    expect(source).toEqual(before)
    expect(twice.data).toEqual(once.data)
    expect(twice.applied).toEqual([])
    expect(second.metadata.sourceHash).toBe(first.metadata.sourceHash)
    expect(second.manifest.counts).toEqual(first.manifest.counts)
  })

  it('uses dependency-aware incremental plans and removes deleted connections safely', () => {
    const baseline = compileAnalysisSnapshot(structuredClone(systemCertificationFixture), undefined, { generatedAt })
    const modified = structuredClone(systemCertificationFixture)
    const component = modified.modules[2].content.items?.find((entity) => entity.id === 'component-a')
    if (!component) throw new Error('Certified component is missing.')
    component.title = 'Modified component A'
    expect(planIncrementalCompilation(modified, baseline).plan).toMatchObject({ mode: 'partial', changes: { modified: ['component-a'] } })

    const removed = withoutEntity(modified, 'isolated-node')
    const rebuilt = compileAnalysisSnapshot(removed, baseline, { generatedAt })
    expect(rebuilt.incremental).toMatchObject({ mode: 'full', changes: { removed: ['isolated-node'] } })
    expect(rebuilt.compilation.relationGraph.nodes.some((node) => node.id === 'isolated-node')).toBe(false)
  })

  it('rejects partial derived artifacts rather than accepting a broken build', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-system-certification-'))
    try {
      await writeFile(join(directory, 'manifest.json'), JSON.stringify({ metadata: { sourceHash: 'partial', schemaVersion: '3.5.0', engineVersion: 'test' } }), 'utf8')
      const verification = await verifyDerivedArtifactSet(directory)
      expect(verification.valid).toBe(false)
      expect(verification.errors.some((error) => error.startsWith('entity-index.json:'))).toBe(true)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('invalidates an incompatible cache and recompiles a complete snapshot', async () => {
    let clears = 0
    const incompatible = compileAnalysisSnapshot(structuredClone(systemCertificationFixture), undefined, { generatedAt })
    incompatible.metadata.engineVersion = 'incompatible'
    const cache: AnalysisCache = {
      async get() { return incompatible },
      async set() {},
      async clear() { clears += 1 },
    }
    const compiler = new CountingCompiler()
    const service = createAnalysisService({ cache, compiler })
    const result = await service.compileUniverse(structuredClone(systemCertificationFixture))

    expect(clears).toBe(1)
    expect(compiler.calls).toBe(1)
    expect(result.metadata.engineVersion).not.toBe('incompatible')
  })

  it('persists reviewable annotations separately and exports only matching issue decisions', () => {
    const snapshot = compileAnalysisSnapshot(structuredClone(systemCertificationFixture), undefined, { generatedAt })
    const issue = snapshot.issues.find((entry) => entry.ruleId === 'character-dead-acting')
    if (!issue) throw new Error('Certified continuity issue is missing.')
    const storage = new MemoryStorage()
    const annotation = writeIssueAnnotation(issue, { decision: 'intentional', note: 'Revisado por el autor.' }, generatedAt, storage)
    const stored = readAnalysisAnnotations(storage)
    const exported = createAnalysisDiagnosticExport(snapshot, stored, generatedAt)

    expect(stored[issue.id]).toEqual(annotation)
    expect(exported.annotations).toEqual({ [issue.id]: annotation })
    expect(annotationNeedsReview(annotation, { ...issue, evidence: [...issue.evidence, { sourceId: 'dead-acts', field: 'changed' }] })).toBe(true)
    expect(source).not.toHaveProperty('analysisAnnotations')
  })
})
