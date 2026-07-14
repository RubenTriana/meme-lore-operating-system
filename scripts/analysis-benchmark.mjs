import { cpus, platform, release } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sizes = [1_000, 5_000, 10_000]
const generatedAt = '2026-07-14T00:00:00.000Z'
const round = (value) => Math.round(value * 100) / 100
const measure = (operation) => { const start = performance.now(); const value = operation(); return { value, milliseconds: round(performance.now() - start) } }

async function main() {
  const vite = await createServer({ root: projectRoot, configFile: false, appType: 'custom', logLevel: 'error', resolve: { alias: { '@': resolve(projectRoot, 'src') } }, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } })
  try {
    const [{ generateSyntheticUniverse }, derived, { validateUniverse }, { analyzeContinuity }, { analyzeCausality }, { analyzeKnowledge }, { analyzeConnections }] = await Promise.all([
      vite.ssrLoadModule('/src/analysis/benchmark/generator.ts'), vite.ssrLoadModule('/src/analysis/derived.ts'), vite.ssrLoadModule('/src/schemas/universe.ts'), vite.ssrLoadModule('/src/analysis/continuity/index.ts'), vite.ssrLoadModule('/src/analysis/causality/index.ts'), vite.ssrLoadModule('/src/analysis/knowledge/index.ts'), vite.ssrLoadModule('/src/analysis/connections/index.ts'),
    ])
    validateUniverse(generateSyntheticUniverse({ entityCount: 100, seed: 42 }))
    const measurements = []
    for (const entityCount of sizes) {
      global.gc?.()
      const universe = generateSyntheticUniverse({ entityCount, seed: 42 })
      const validation = measure(() => validateUniverse(universe))
      if (!validation.value.valid || !validation.value.data) throw new Error(`Synthetic ${entityCount} fixture is invalid: ${validation.value.errors.map((error) => error.message).join(', ')}`)
      const normalization = measure(() => derived.normalizeUniverse(validation.value.data))
      const metadata = measure(() => derived.createDerivedMetadata(normalization.value.universe, generatedAt))
      const entityIndex = measure(() => derived.buildEntityIndex(normalization.value, metadata.value))
      const relationGraph = measure(() => derived.buildRelationGraph(normalization.value, metadata.value))
      const timelineIndex = measure(() => derived.buildTimelineIndex(normalization.value, metadata.value))
      const knowledgeIndex = measure(() => derived.buildKnowledgeIndex(normalization.value, timelineIndex.value, metadata.value))
      const dependencyIndex = measure(() => derived.buildDependencyIndex(normalization.value, relationGraph.value, knowledgeIndex.value, metadata.value))
      const compilation = derived.assembleDerivedCompilation(normalization.value, metadata.value, entityIndex.value, relationGraph.value, timelineIndex.value, knowledgeIndex.value, dependencyIndex.value)
      const context = { universe: normalization.value.universe, normalized: normalization.value, compilation, sourceHash: metadata.value.sourceHash, engineVersion: derived.ANALYSIS_ENGINE_VERSION }
      const continuity = measure(() => analyzeContinuity(context))
      const causality = measure(() => analyzeCausality(context))
      const knowledge = measure(() => analyzeKnowledge(context))
      const connections = measure(() => analyzeConnections(context))
      const serialized = measure(() => JSON.stringify({ compilation, issues: [...continuity.value.issues, ...causality.value.issues, ...knowledge.value.issues, ...connections.value.issues], connections: connections.value }))
      measurements.push({
        entityCount,
        eventCount: compilation.manifest.counts.events,
        relationCount: compilation.manifest.counts.relationEdges,
        issueCount: continuity.value.issues.length + causality.value.issues.length + knowledge.value.issues.length + connections.value.issues.length,
        validationMs: validation.milliseconds,
        normalizationMs: normalization.milliseconds,
        hashingMs: metadata.milliseconds,
        indexingMs: round(entityIndex.milliseconds + timelineIndex.milliseconds + knowledgeIndex.milliseconds + dependencyIndex.milliseconds),
        continuityMs: continuity.milliseconds,
        causalityMs: causality.milliseconds,
        knowledgeMs: knowledge.milliseconds,
        graphsMs: round(relationGraph.milliseconds + connections.milliseconds),
        serializationMs: serialized.milliseconds,
        cachePayloadBytes: Buffer.byteLength(serialized.value),
        heapUsedBytes: process.memoryUsage().heapUsed,
      })
    }
    console.log(JSON.stringify({ measuredAt: new Date().toISOString(), seed: 42, runsPerSize: 1, environment: { node: process.version, platform: `${platform()} ${release()}`, cpu: cpus()[0]?.model ?? 'unknown', logicalCpus: cpus().length }, measurements }, null, 2))
  } finally { await vite.close() }
}

main().catch((error) => { console.error(error instanceof Error ? error.stack : error); process.exitCode = 1 })
