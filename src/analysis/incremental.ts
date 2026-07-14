import type { Universe, UniverseEntity } from '../types/universe'
import {
  ANALYSIS_ENGINE_VERSION,
  assembleDerivedCompilation,
  buildDependencyIndex,
  buildEntityIndex,
  buildKnowledgeIndex,
  buildRelationGraph,
  buildTimelineIndex,
  createDerivedMetadata,
  hashCanonical,
  normalizeUniverse,
} from './derived'
import { runEnabledAnalysis } from './engines'
import type { AnalysisCacheIdentity, AnalysisSnapshot, DerivedIndexName, EntityChangeSet, EntityImpactHashes, IncrementalPlan, NormalizedUniverse } from './types'

const snapshotVersion = '1' as const
const indexOrder: DerivedIndexName[] = ['entity-index', 'relation-graph', 'timeline-index', 'knowledge-index', 'dependency-index']

function emptyChanges(): EntityChangeSet {
  return { added: [], modified: [], removed: [] }
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right))
}

function hashTimelineImpact(entity: UniverseEntity): string {
  return hashCanonical({
    type: entity.type,
    date: entity.date,
    sequence: entity.sequence,
    temporal: entity.temporal,
    participantRefs: entity.participantRefs,
    locationRefs: entity.locationRefs,
  })
}

function hashKnowledgeImpact(entity: UniverseEntity): string {
  return hashCanonical({ type: entity.type, date: entity.date, temporal: entity.temporal, knowledgeChanges: entity.knowledgeChanges })
}

export function getAnalysisCacheIdentity(universe: Universe): AnalysisCacheIdentity {
  const normalized = normalizeUniverse(universe)
  return {
    sourceHash: hashCanonical(normalized.universe),
    schemaVersion: normalized.universe.metadata.schemaVersion,
    engineVersion: ANALYSIS_ENGINE_VERSION,
  }
}

export function createEntityHashes(normalized: NormalizedUniverse): { entityHashes: Record<string, string>; entityImpactHashes: Record<string, EntityImpactHashes> } {
  const entityHashes: Record<string, string> = {}
  const entityImpactHashes: Record<string, EntityImpactHashes> = {}
  normalized.entities.forEach(({ entity, moduleId }) => {
    entityHashes[entity.id] = hashCanonical({ moduleId, entity })
    entityImpactHashes[entity.id] = { timeline: hashTimelineImpact(entity), knowledge: hashKnowledgeImpact(entity) }
  })
  return { entityHashes, entityImpactHashes }
}

function createFullPlan(reason: string, changes: EntityChangeSet, affectedEntityIds: string[]): IncrementalPlan {
  return { mode: 'full', reason, changes, affectedEntityIds, affectedIndexes: [...indexOrder] }
}

export function planIncrementalCompilation(universe: Universe, previous?: AnalysisSnapshot): { normalized: NormalizedUniverse; entityHashes: Record<string, string>; entityImpactHashes: Record<string, EntityImpactHashes>; plan: IncrementalPlan } {
  const normalized = normalizeUniverse(universe)
  const { entityHashes, entityImpactHashes } = createEntityHashes(normalized)
  if (!previous) return { normalized, entityHashes, entityImpactHashes, plan: createFullPlan('missing-previous-snapshot', emptyChanges(), []) }
  if (previous.snapshotVersion !== snapshotVersion || previous.metadata.schemaVersion !== universe.metadata.schemaVersion || previous.metadata.engineVersion !== ANALYSIS_ENGINE_VERSION) {
    return { normalized, entityHashes, entityImpactHashes, plan: createFullPlan('snapshot-version-mismatch', emptyChanges(), []) }
  }

  const previousIds = new Set(Object.keys(previous.entityHashes))
  const currentIds = new Set(Object.keys(entityHashes))
  const changes: EntityChangeSet = {
    added: sorted([...currentIds].filter((id) => !previousIds.has(id))),
    modified: sorted([...currentIds].filter((id) => previousIds.has(id) && previous.entityHashes[id] !== entityHashes[id])),
    removed: sorted([...previousIds].filter((id) => !currentIds.has(id))),
  }
  const changedIds = [...changes.added, ...changes.modified, ...changes.removed]
  if (changes.added.length || changes.removed.length) {
    return { normalized, entityHashes, entityImpactHashes, plan: createFullPlan('entity-set-changed', changes, sorted(changedIds)) }
  }
  if (!changes.modified.length && previous.metadata.sourceHash !== hashCanonical(normalized.universe)) {
    return { normalized, entityHashes, entityImpactHashes, plan: createFullPlan('non-entity-canon-changed', changes, []) }
  }
  if (!changes.modified.length) {
    return { normalized, entityHashes, entityImpactHashes, plan: { mode: 'unchanged', reason: 'entity-hashes-match', changes, affectedEntityIds: [], affectedIndexes: [] } }
  }

  const affectedEntities = new Set<string>(changes.modified)
  const affectedIndexes = new Set<DerivedIndexName>(['entity-index', 'relation-graph', 'dependency-index'])
  for (const entityId of changes.modified) {
    const previousDependencies = previous.compilation.dependencyIndex
    const rebuildIndexes = previousDependencies.rebuildIndexesByEntity[entityId]
    if (!rebuildIndexes) return { normalized, entityHashes, entityImpactHashes, plan: createFullPlan('missing-dependency-entry', changes, sorted(affectedEntities)) }
    rebuildIndexes.forEach((index) => affectedIndexes.add(index))
    ;(previousDependencies.affectedEntityIdsByEntity[entityId] ?? []).forEach((affectedId) => affectedEntities.add(affectedId))
    const previousImpact = previous.entityImpactHashes[entityId]
    const currentImpact = entityImpactHashes[entityId]
    if (!previousImpact || !currentImpact) return { normalized, entityHashes, entityImpactHashes, plan: createFullPlan('missing-impact-hash', changes, sorted(affectedEntities)) }
    if (previousImpact.timeline !== currentImpact.timeline) affectedIndexes.add('timeline-index')
    if (previousImpact.knowledge !== currentImpact.knowledge) affectedIndexes.add('knowledge-index')
  }

  return {
    normalized,
    entityHashes,
    entityImpactHashes,
    plan: { mode: 'partial', reason: 'modified-entities-with-safe-reuse', changes, affectedEntityIds: sorted(affectedEntities), affectedIndexes: indexOrder.filter((index) => affectedIndexes.has(index)) },
  }
}

function reuseWithMetadata<T extends { metadata: AnalysisSnapshot['metadata'] }>(value: T, metadata: AnalysisSnapshot['metadata']): T {
  return { ...value, metadata }
}

export function compileAnalysisSnapshot(universe: Universe, previous?: AnalysisSnapshot, options: { generatedAt?: string } = {}): AnalysisSnapshot {
  const prepared = planIncrementalCompilation(universe, previous)
  if (prepared.plan.mode === 'unchanged' && previous) return previous
  const metadata = createDerivedMetadata(prepared.normalized.universe, options.generatedAt ?? new Date().toISOString())
  let compilation
  if (prepared.plan.mode === 'full' || !previous) {
    const entityIndex = buildEntityIndex(prepared.normalized, metadata)
    const relationGraph = buildRelationGraph(prepared.normalized, metadata)
    const timelineIndex = buildTimelineIndex(prepared.normalized, metadata)
    const knowledgeIndex = buildKnowledgeIndex(prepared.normalized, timelineIndex, metadata)
    const dependencyIndex = buildDependencyIndex(prepared.normalized, relationGraph, knowledgeIndex, metadata)
    compilation = assembleDerivedCompilation(prepared.normalized, metadata, entityIndex, relationGraph, timelineIndex, knowledgeIndex, dependencyIndex)
  } else {
    const affected = new Set(prepared.plan.affectedIndexes)
    const entityIndex = buildEntityIndex(prepared.normalized, metadata)
    const relationGraph = affected.has('relation-graph') ? buildRelationGraph(prepared.normalized, metadata) : reuseWithMetadata(previous.compilation.relationGraph, metadata)
    const timelineIndex = affected.has('timeline-index') ? buildTimelineIndex(prepared.normalized, metadata) : reuseWithMetadata(previous.compilation.timelineIndex, metadata)
    const knowledgeIndex = affected.has('knowledge-index') || affected.has('timeline-index')
      ? buildKnowledgeIndex(prepared.normalized, timelineIndex, metadata)
      : reuseWithMetadata(previous.compilation.knowledgeIndex, metadata)
    const dependencyIndex = buildDependencyIndex(prepared.normalized, relationGraph, knowledgeIndex, metadata)
    compilation = assembleDerivedCompilation(prepared.normalized, metadata, entityIndex, relationGraph, timelineIndex, knowledgeIndex, dependencyIndex)
  }
  const analysis = runEnabledAnalysis({
    universe: prepared.normalized.universe,
    normalized: prepared.normalized,
    compilation,
    sourceHash: metadata.sourceHash,
    engineVersion: ANALYSIS_ENGINE_VERSION,
  })
  return { snapshotVersion, metadata, entityHashes: prepared.entityHashes, entityImpactHashes: prepared.entityImpactHashes, compilation, incremental: prepared.plan, issues: analysis.issues, ...(analysis.connections ? { connections: analysis.connections } : {}) }
}
