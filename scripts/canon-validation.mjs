import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const inputPath = resolve(projectRoot, 'data/universe_master.json')
const targetIds = [
  'meme-clay',
  'meme-amaranta',
  'meme-harry',
  'meme-meme',
  'meme-la-gracia',
  'meme-nuevo-caguan',
  'meme-mercado-futuros-voluntad',
  'meme-ministerio-del-panico',
  'meme-celular-agotado-junto-a-harry',
  'meme-muerte-de-harry',
]

const list = (value) => Array.isArray(value) ? value : []
const orderedCounts = (values) => Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]))

const vite = await createServer({
  root: projectRoot,
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  resolve: { alias: { '@': resolve(projectRoot, 'src') } },
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
})
try {
  const raw = JSON.parse(await readFile(inputPath, 'utf8'))
  const [{ migrateUniverse }, { validateUniverse }, derived, continuity, causality, knowledge, connections] = await Promise.all([
    vite.ssrLoadModule('/src/services/migrations/index.ts'),
    vite.ssrLoadModule('/src/schemas/universe.ts'),
    vite.ssrLoadModule('/src/analysis/derived.ts'),
    vite.ssrLoadModule('/src/analysis/continuity/index.ts'),
    vite.ssrLoadModule('/src/analysis/causality/index.ts'),
    vite.ssrLoadModule('/src/analysis/knowledge/index.ts'),
    vite.ssrLoadModule('/src/analysis/connections/index.ts'),
  ])
  const migrated = migrateUniverse(raw)
  const validation = validateUniverse(migrated.data)
  if (!validation.valid || !validation.data) throw new Error(`Canon validation failed: ${validation.errors.map((error) => `${error.path}: ${error.message}`).join('; ')}`)

  const universe = validation.data
  const normalized = derived.normalizeUniverse(universe)
  const compilation = derived.compileDerived(universe, { generatedAt: '2026-07-14T00:00:00.000Z' })
  const context = { universe, normalized, compilation, sourceHash: compilation.metadata.sourceHash, engineVersion: compilation.metadata.engineVersion }
  const continuityResult = continuity.analyzeContinuity(context)
  const causalityResult = causality.analyzeCausality(context)
  const knowledgeResult = knowledge.analyzeKnowledge(context)
  const connectionsResult = connections.analyzeConnections(context)
  const entities = normalized.entities.map(({ entity, moduleId }) => ({ entity, moduleId }))
  const byId = new Map(entities.map((entry) => [entry.entity.id, entry]))
  const events = entities.filter(({ entity }) => entity.type === 'event')
  const narrativeIssues = [...continuityResult.issues, ...causalityResult.issues, ...knowledgeResult.issues]

  const manualVerification = targetIds.map((id) => {
    const entry = byId.get(id)
    if (!entry) return { id, found: false }
    const entity = entry.entity
    const referenceFields = Object.fromEntries(['refs', 'foreshadowing', 'locationRefs', 'participantRefs', 'causes', 'effects'].map((field) => [field, list(entity[field])]).filter(([, values]) => values.length))
    return {
      id,
      found: true,
      title: entity.title,
      moduleId: entry.moduleId,
      type: entity.type,
      referenceFields,
      incomingReferences: compilation.entityIndex.incomingReferencesByEntity[id] ?? [],
      diagnostics: narrativeIssues.filter((issue) => issue.entityIds.includes(id) || issue.sourceIds.includes(id)).map((issue) => ({ engine: issue.engine, ruleId: issue.ruleId, severity: issue.severity })),
      observations: connectionsResult.observations.filter((item) => item.entityIds.includes(id)).map((item) => item.kind),
    }
  })

  const result = {
    input: 'data/universe_master.json',
    metadata: {
      title: raw.metadata?.title,
      canonVersion: raw.metadata?.version,
      sourceSchemaVersion: raw.metadata?.schemaVersion,
      runtimeSchemaVersion: universe.metadata.schemaVersion,
      sourceHash: compilation.metadata.sourceHash,
      engineVersion: compilation.metadata.engineVersion,
      migrations: migrated.applied.map((migration) => migration.id),
    },
    structure: {
      modules: universe.modules.length,
      entities: entities.length,
      events: events.length,
      types: orderedCounts(entities.map(({ entity }) => entity.type)),
      moduleCounts: Object.fromEntries(universe.modules.map((module) => [module.id, module.content.items?.length ?? 0])),
      duplicateEntityIds: entities.map(({ entity }) => entity.id).filter((id, index, ids) => ids.indexOf(id) !== index),
      validationErrors: validation.errors,
      validationWarnings: validation.warnings.length,
    },
    derived: {
      relationEdges: compilation.manifest.counts.relationEdges,
      timelineEvents: compilation.manifest.counts.events,
      knowledgeDeclarations: compilation.manifest.counts.knowledgeDeclarations,
      isolatedNodes: connectionsResult.topology.isolatedNodeIds.length,
      disconnectedComponents: connectionsResult.topology.components.length,
      directedCycles: connectionsResult.topology.cycles.length,
      connectionObservations: orderedCounts(connectionsResult.observations.map((item) => item.kind)),
      connectionIssues: connectionsResult.issues.length,
    },
    coverage: {
      temporalEvents: events.filter(({ entity }) => entity.temporal?.start).length,
      causalEvents: events.filter(({ entity }) => list(entity.causes).length || list(entity.effects).length).length,
      knowledgeChangeEvents: events.filter(({ entity }) => list(entity.knowledgeChanges).length).length,
      requiredKnowledgeEvents: events.filter(({ entity }) => list(entity.analysis?.requiredKnowledge).length).length,
      entitiesWithAnalysis: entities.filter(({ entity }) => entity.analysis).length,
      charactersWithPlausibilityData: entities.filter(({ entity }) => entity.type === 'character' && entity.analysis && ['goals', 'beliefs', 'fears', 'constraints'].some((field) => list(entity.analysis[field]).length)).length,
      entitiesWithDeclaredConnections: entities.filter(({ entity }) => ['refs', 'foreshadowing', 'locationRefs', 'participantRefs', 'causes', 'effects'].some((field) => list(entity[field]).length)).length,
    },
    engines: {
      configured: universe.analysisConfig,
      continuity: { issues: continuityResult.issues.length, evaluations: orderedCounts(continuity.inspectContinuity(context).map((entry) => entry.status)) },
      causality: { issues: causalityResult.issues.length, evaluations: orderedCounts(causality.inspectCausality(context).map((entry) => entry.status)) },
      knowledge: { issues: knowledgeResult.issues.length, evaluations: orderedCounts(knowledge.inspectKnowledge(context).map((entry) => entry.status)) },
    },
    possibleIntentionalMysteries: entities.filter(({ entity }) => entity.type === 'mystery').map(({ entity }) => ({ id: entity.id, title: entity.title })),
    manualVerification,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} finally {
  await vite.close()
}
