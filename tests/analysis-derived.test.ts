// @vitest-environment node
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import source from '../data/universe_master.json'
import { compileDerived } from '../src/analysis/derived'
import { analysisEventFixture } from './fixtures/analysis-v3_3'
import { verifyDerivedArtifactSet } from '../scripts/analysis-build.mjs'

const generatedAt = '2042-04-12T00:00:00.000Z'
const executeFile = promisify(execFile)

function runAnalysisBuild(inputPath: string, outputDirectory: string) {
  return executeFile(process.execPath, [join(process.cwd(), 'scripts/analysis-build.mjs'), '--input', inputPath, '--output', outputDirectory, '--generated-at', generatedAt], { cwd: process.cwd() })
}

function fixtureWithUndatedKnowledge() {
  const universe = structuredClone(analysisEventFixture)
  const trigger = universe.modules[0].content.items?.find((entity) => entity.id === 'meme-trigger')
  if (!trigger) throw new Error('The analytical fixture needs a trigger event.')
  trigger.knowledgeChanges = [{ characterRef: 'meme-operator', learns: ['Unplaced fact'] }]
  return universe
}

describe('derived narrative indexes', () => {
  it('is deterministic for the same normalized canon', () => {
    const universe = fixtureWithUndatedKnowledge()
    const first = compileDerived(universe, { generatedAt })
    const second = compileDerived(structuredClone(universe), { generatedAt })

    expect(first).toEqual(second)
    expect(first.metadata.sourceHash).toMatch(/^fnv1a64-[0-9a-f]{16}$/)
  })

  it('indexes entities, tags, and both reference directions', () => {
    const entityIndex = compileDerived(fixtureWithUndatedKnowledge(), { generatedAt }).entityIndex

    expect(entityIndex.entitiesById['meme-revelation']).toMatchObject({ type: 'event', moduleId: 'timeline', tags: ['analysis', 'event'] })
    expect(entityIndex.entityIdsByTag.analysis).toEqual(['meme-revelation'])
    expect(entityIndex.outgoingReferencesByEntity['meme-revelation']).toEqual(['meme-outcome', 'meme-trigger'])
    expect(entityIndex.incomingReferencesByEntity['meme-trigger']).toEqual(['meme-revelation'])
  })

  it('builds stable explicit, reference, and foreshadowing edges', () => {
    const graph = compileDerived(fixtureWithUndatedKnowledge(), { generatedAt }).relationGraph

    expect(graph.edges).toEqual(compileDerived(fixtureWithUndatedKnowledge(), { generatedAt }).relationGraph.edges)
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: 'meme-revelation', targetId: 'meme-trigger', provenance: 'refs', type: 'reference' }),
      expect.objectContaining({ sourceId: 'meme-revelation', targetId: 'meme-outcome', provenance: 'foreshadowing', type: 'foreshadowing' }),
      expect.objectContaining({ sourceId: 'meme-revelation', targetId: 'meme-operator', provenance: 'explicit', type: 'participant' }),
    ]))
  })

  it('orders dated events while preserving events without an exact date', () => {
    const timeline = compileDerived(fixtureWithUndatedKnowledge(), { generatedAt }).timelineIndex

    expect(timeline.events[0]?.id).toBe('meme-revelation')
    expect(timeline.events.map((event) => event.id)).toContain('meme-trigger')
    expect(timeline.eventIdsWithoutExactDate).toEqual(expect.arrayContaining(['meme-revelation', 'meme-trigger', 'meme-outcome']))
    expect(timeline.eventIdsByParticipant['meme-operator']).toEqual(['meme-revelation'])
    expect(timeline.eventIdsByLocation['meme-observatory']).toEqual(['meme-revelation'])
  })

  it('tracks declared knowledge and calculates only time-resolvable cumulative states', () => {
    const knowledge = compileDerived(fixtureWithUndatedKnowledge(), { generatedAt }).knowledgeIndex

    expect(knowledge.declarations).toHaveLength(2)
    expect(knowledge.declarationsWithoutCalculableTime).toMatchObject([{ eventId: 'meme-trigger', characterId: 'meme-operator' }])
    expect(knowledge.cumulativeKnowledgeByCharacter['meme-operator']).toMatchObject([
      { eventId: 'meme-revelation', knowledge: ['Signal protocol'] },
    ])
  })

  it('maps affected entities and conservative rebuild targets', () => {
    const dependency = compileDerived(fixtureWithUndatedKnowledge(), { generatedAt }).dependencyIndex

    expect(dependency.affectedEntityIdsByEntity['meme-revelation']).toEqual(expect.arrayContaining(['meme-observatory', 'meme-operator', 'meme-outcome', 'meme-trigger']))
    expect(dependency.rebuildIndexesByEntity['meme-revelation']).toEqual(['entity-index', 'relation-graph', 'timeline-index', 'knowledge-index', 'dependency-index'])
    expect(dependency.rebuildIndexesByEntity['meme-operator']).toEqual(['entity-index', 'relation-graph', 'knowledge-index', 'dependency-index'])
  })
})

describe('analysis:build', () => {
  let temporaryDirectory: string | undefined

  afterEach(async () => {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
    temporaryDirectory = undefined
  })

  it('writes all derived artifacts and preserves the last valid output when validation fails', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'meme-analysis-'))
    const inputPath = join(temporaryDirectory, 'universe.json')
    const outputDirectory = join(temporaryDirectory, 'derived')
    await writeFile(inputPath, JSON.stringify(source), 'utf8')

    await runAnalysisBuild(inputPath, outputDirectory)
    const firstManifest = await readFile(join(outputDirectory, 'manifest.json'), 'utf8')
    expect(JSON.parse(firstManifest)).toMatchObject({ metadata: { generatedAt } })

    const invalid = structuredClone(source)
    invalid.modules[0].content.items[0].refs = ['missing-entity']
    await writeFile(inputPath, JSON.stringify(invalid), 'utf8')

    const failure = await runAnalysisBuild(inputPath, outputDirectory).then(() => undefined, (error) => error)
    expect(failure).toBeDefined()
    expect(String(failure?.stderr)).toContain('Canon validation failed.')
    expect(await readFile(join(outputDirectory, 'manifest.json'), 'utf8')).toBe(firstManifest)
  }, 15_000)

  it('detects a partial derived artifact set', async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'meme-analysis-partial-'))
    await writeFile(join(temporaryDirectory, 'manifest.json'), JSON.stringify({ metadata: { sourceHash: 'hash', schemaVersion: '3.5.0', engineVersion: 'test' } }), 'utf8')

    const verification = await verifyDerivedArtifactSet(temporaryDirectory)

    expect(verification.valid).toBe(false)
    expect(verification.errors.some((error) => error.startsWith('entity-index.json:'))).toBe(true)
  })
})
