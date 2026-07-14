// @vitest-environment node
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import source from '../data/universe_master.json'
import patchSource from '../data/updates/meme-canon-enrichment-phase-11.patch.json'
import { analyzeCausality } from '../src/analysis/causality'
import { analyzeConnections } from '../src/analysis/connections'
import { analyzeContinuity } from '../src/analysis/continuity'
import { compileDerived, normalizeUniverse } from '../src/analysis/derived'
import { analyzeKnowledge } from '../src/analysis/knowledge'
import type { AnalysisContext } from '../src/analysis/types'
import { validateUniverse } from '../src/schemas/universe'
import { loadUniverse } from '../src/services/universe-loader'
import { applyPatch, type UniversePatch } from '../src/services/patches'
import type { Universe } from '../src/types/universe'

const executeFile = promisify(execFile)
const generatedAt = '2042-04-12T00:00:00.000Z'
const patch = patchSource as unknown as UniversePatch
const sourceBefore = structuredClone(source)

const baseSource = applyPatch(source, {
  operations: [...patch.operations].reverse().map((operation) => ({ op: 'remove' as const, path: operation.path })),
})

function contextFor(universe: Universe): AnalysisContext {
  const normalized = normalizeUniverse(universe)
  const compilation = compileDerived(normalized.universe, { generatedAt })
  return { universe: normalized.universe, normalized, compilation, sourceHash: compilation.metadata.sourceHash, engineVersion: compilation.metadata.engineVersion }
}

function entities(universe: Universe) {
  return universe.modules.flatMap((module) => module.content.items ?? [])
}

function coverage(universe: Universe) {
  const all = entities(universe)
  const events = all.filter((entity) => entity.type === 'event')
  return {
    events: events.length,
    temporalEvents: events.filter((entity) => entity.temporal?.start).length,
    participantEvents: events.filter((entity) => entity.participantRefs?.length).length,
    locationEvents: events.filter((entity) => entity.locationRefs?.length).length,
    causalEvents: events.filter((entity) => entity.causes?.length || entity.effects?.length).length,
    knowledgeEvents: events.filter((entity) => entity.knowledgeChanges?.length).length,
    stateEvents: events.filter((entity) => entity.stateChanges?.length).length,
    analyzedCharacters: all.filter((entity) => entity.type === 'character' && entity.analysis).length,
  }
}

describe('Phase 11 applied canonical enrichment', () => {
  const loaded = loadUniverse(baseSource)
  if (!loaded.validation.data) throw new Error('The certified MEME canon must load before previewing the patch.')
  const base = loaded.validation.data
  const preview = applyPatch(base, patch)
  const current = loadUniverse(source).validation.data

  it('contains only additive, unique, reviewable field operations', () => {
    expect(patch.operations).toHaveLength(47)
    expect(patch.operations.every((operation) => operation.op === 'add')).toBe(true)
    expect(new Set(patch.operations.map((operation) => operation.path)).size).toBe(patch.operations.length)
    expect(patch.operations.some((operation) => operation.path.includes('/summary'))).toBe(false)
    expect(patch.operations.some((operation) => operation.path.includes('/refs'))).toBe(false)
  })

  it('validates the in-memory preview without changing IDs or summaries', () => {
    const validation = validateUniverse(preview)
    expect(validation.valid).toBe(true)
    expect(entities(preview).map((entity) => entity.id)).toEqual(entities(base).map((entity) => entity.id))
    expect(entities(preview).map((entity) => [entity.id, entity.summary])).toEqual(entities(base).map((entity) => [entity.id, entity.summary]))
    expect(source.metadata.schemaVersion).toBe('3.2.0')
    expect(source).toEqual(sourceBefore)
  })

  it('matches the persisted canon and remains idempotent when evaluated twice', () => {
    expect(current).toEqual(preview)
    const reapplied = applyPatch(preview, patch)
    expect(reapplied).toEqual(preview)
    const all = entities(reapplied)
    all.forEach((entity) => {
      for (const field of ['participantRefs', 'locationRefs', 'causes', 'effects'] as const) {
        const values = entity[field] ?? []
        expect(new Set(values).size).toBe(values.length)
      }
    })
  })

  it('raises measured structural coverage without inventing calculable calendar dates', () => {
    expect(coverage(base)).toEqual({ events: 17, temporalEvents: 0, participantEvents: 0, locationEvents: 0, causalEvents: 0, knowledgeEvents: 0, stateEvents: 0, analyzedCharacters: 0 })
    expect(coverage(preview)).toEqual({ events: 17, temporalEvents: 17, participantEvents: 17, locationEvents: 2, causalEvents: 2, knowledgeEvents: 3, stateEvents: 3, analyzedCharacters: 3 })
    const compilation = compileDerived(preview, { generatedAt })
    expect(compilation.timelineIndex.events.every((event) => event.temporal?.precision === 'relative')).toBe(true)
    expect(compilation.timelineIndex.events.every((event) => event.point === undefined)).toBe(true)
    expect(compilation.knowledgeIndex.declarations).toHaveLength(3)
    expect(compilation.knowledgeIndex.declarationsWithoutCalculableTime).toHaveLength(3)
  })

  it('adds only two causal pairs from their confirmed causes', () => {
    const byId = new Map(entities(preview).map((entity) => [entity.id, entity]))
    expect(byId.get('meme-mision-dea-para-clay')?.effects).toEqual(['meme-llegada-de-clay-a-nuevo-caguan'])
    expect(byId.get('meme-llegada-de-clay-a-nuevo-caguan')?.causes).toBeUndefined()
    expect(byId.get('meme-acto-de-gracia-de-clay')?.effects).toEqual(['meme-nacimiento-del-destructor-de-voluntades'])
    expect(byId.get('meme-nacimiento-del-destructor-de-voluntades')?.causes).toBeUndefined()
  })

  it('introduces no continuity or causality contradiction and only expected temporal knowledge ambiguity', () => {
    const context = contextFor(preview)
    expect(analyzeContinuity(context).issues).toEqual([])
    expect(analyzeCausality(context).issues).toEqual([])
    const knowledgeIssues = analyzeKnowledge(context).issues
    expect(knowledgeIssues).toHaveLength(3)
    expect(knowledgeIssues.every((issue) => issue.ruleId === 'temporally-ambiguous-knowledge-change' && issue.severity === 'info')).toBe(true)
  })

  it('does not connect the eight intentionally unpatched isolated entities', () => {
    const before = analyzeConnections(contextFor(base))
    const after = analyzeConnections(contextFor(preview))
    expect(before.topology.isolatedNodeIds).toEqual([
      'meme-beat-05-debate',
      'meme-beat-06-break-into-two',
      'meme-beat-07-b-story',
      'meme-beat-08-fun-and-games',
      'meme-beat-11-all-is-lost',
      'meme-beat-12-dark-night-of-the-soul',
      'meme-beat-13-break-into-three',
      'meme-publico-objetivo',
    ])
    expect(after.topology.isolatedNodeIds).toEqual(before.topology.isolatedNodeIds)
    expect(after.topology.components).toHaveLength(9)
  })

  it('builds all derived artifacts from a temporary applied copy', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meme-phase-11-'))
    try {
      const inputPath = join(directory, 'patched-preview.json')
      const outputPath = join(directory, 'derived')
      await writeFile(inputPath, JSON.stringify(preview), 'utf8')
      const { stdout } = await executeFile(process.execPath, [join(process.cwd(), 'scripts/analysis-build.mjs'), '--input', inputPath, '--output', outputPath, '--generated-at', generatedAt], { cwd: process.cwd() })
      expect(stdout).toContain('Derived analysis built:')
      const manifest = JSON.parse(await readFile(join(outputPath, 'manifest.json'), 'utf8')) as { counts: { entities: number; events: number; knowledgeDeclarations: number } }
      expect(manifest.counts).toMatchObject({ entities: 95, events: 17, knowledgeDeclarations: 3 })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 15_000)
})
