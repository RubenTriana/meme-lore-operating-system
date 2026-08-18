import type { TemporalPrecision, TemporalRange, Universe, UniverseEntity } from '../types/universe'

export type DerivedIndexName = 'entity-index' | 'relation-graph' | 'timeline-index' | 'knowledge-index' | 'dependency-index'
export type RelationProvenance = 'explicit' | 'refs' | 'foreshadowing'

export interface DerivedMetadata {
  sourceHash: string
  schemaVersion: string
  engineVersion: string
  generatedAt: string
}

export interface NormalizedEntity {
  entity: UniverseEntity
  moduleId: string
}

export interface NormalizedUniverse {
  universe: Universe
  entities: NormalizedEntity[]
}

export interface EntityIndexEntry {
  id: string
  type: string
  moduleId: string
  tags: string[]
  outgoingReferences: string[]
  incomingReferences: string[]
}

export interface EntityIndex {
  metadata: DerivedMetadata
  entitiesById: Record<string, EntityIndexEntry>
  entityIdsByType: Record<string, string[]>
  entityIdsByModule: Record<string, string[]>
  entityIdsByTag: Record<string, string[]>
  outgoingReferencesByEntity: Record<string, string[]>
  incomingReferencesByEntity: Record<string, string[]>
}

export interface RelationNode {
  id: string
  type: string
  moduleId: string
}

export interface RelationEdge {
  id: string
  sourceId: string
  targetId: string
  type: string
  provenance: RelationProvenance
  detail?: string
}

export interface RelationGraph {
  metadata: DerivedMetadata
  nodes: RelationNode[]
  edges: RelationEdge[]
  edgeIdsByProvenance: Record<RelationProvenance, string[]>
}

export interface TimelinePoint {
  value: number
  precision: TemporalPrecision | 'legacy'
}

export interface TimelineEvent {
  id: string
  moduleId: string
  sequence?: number
  temporal?: TemporalRange
  point?: TimelinePoint
  hasExactDate: boolean
}

export interface TimelineIndex {
  metadata: DerivedMetadata
  events: TimelineEvent[]
  eventIdsWithoutExactDate: string[]
  eventIdsByParticipant: Record<string, string[]>
  eventIdsByLocation: Record<string, string[]>
}

export interface KnowledgeDeclaration {
  eventId: string
  characterId: string
  learns: string[]
  forgets: string[]
  point?: TimelinePoint
}

export interface KnowledgeSnapshot {
  eventId: string
  point: TimelinePoint
  knowledge: string[]
}

export interface KnowledgeIndex {
  metadata: DerivedMetadata
  declarations: KnowledgeDeclaration[]
  declarationsWithoutCalculableTime: KnowledgeDeclaration[]
  cumulativeKnowledgeByCharacter: Record<string, KnowledgeSnapshot[]>
}

export interface DependencyIndex {
  metadata: DerivedMetadata
  affectedEntityIdsByEntity: Record<string, string[]>
  rebuildIndexesByEntity: Record<string, DerivedIndexName[]>
}

export interface DerivedManifest {
  metadata: DerivedMetadata
  files: Record<DerivedIndexName, string>
  counts: {
    entities: number
    relationEdges: number
    events: number
    knowledgeDeclarations: number
  }
}

export interface DerivedCompilation {
  metadata: DerivedMetadata
  entityIndex: EntityIndex
  relationGraph: RelationGraph
  timelineIndex: TimelineIndex
  knowledgeIndex: KnowledgeIndex
  dependencyIndex: DependencyIndex
  manifest: DerivedManifest
}

export type NarrativeSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'
export type AnalysisEngine = 'continuity' | 'causality' | 'knowledge' | 'connections' | 'plausibility'

export interface NarrativeEvidence {
  sourceId: string
  field?: string
  value?: string
}

export interface NarrativeIssue {
  id: string
  engine: AnalysisEngine
  ruleId: string
  severity: NarrativeSeverity
  confidence: number
  title: string
  message: string
  entityIds: string[]
  sourceIds: string[]
  evidence: NarrativeEvidence[]
  sourceHash: string
  engineVersion: string
}

export interface AnalysisContext {
  universe: Universe
  normalized: NormalizedUniverse
  compilation: DerivedCompilation
  sourceHash: string
  engineVersion: string
}

export interface AnalysisRule {
  id: string
  engine: AnalysisEngine
  version: string
  evaluate(context: AnalysisContext): NarrativeIssue[]
}

export interface ConnectionDegreeMetric {
  entityId: string
  inDegree: number
  outDegree: number
  totalDegree: number
  centrality: number
}

export interface ConnectionBetweennessMetric {
  entityId: string
  centrality: number
}

export interface ConnectionModuleDensityMetric {
  moduleId: string
  nodeCount: number
  edgeCount: number
  density: number
}

export type ConnectionObservationKind = 'isolated-entity' | 'disconnected-component' | 'central-character' | 'symbol-without-event' | 'faction-without-character' | 'mystery-without-character' | 'referenced-peripheral-entity'

export interface ConnectionObservation {
  id: string
  kind: ConnectionObservationKind
  title: string
  message: string
  entityIds: string[]
  sourceIds: string[]
}

export interface ConnectionCycle {
  id: string
  nodeIds: string[]
}

export interface ConnectionPathResult {
  found: boolean
  nodeIds: string[]
  edgeIds: string[]
  visitedCount: number
  truncated: boolean
}

export interface ConnectionNeighborhood {
  sourceId: string
  depth: number
  nodeIds: string[]
  edgeIds: string[]
  truncated: boolean
}

export interface ConnectionsAnalysisResult {
  engine: 'connections'
  engineVersion: string
  sourceHash: string
  metrics: {
    degreeCentrality: ConnectionDegreeMetric[]
    betweenness: {
      status: 'computed' | 'skipped'
      nodeLimit: number
      reason?: string
      values: ConnectionBetweennessMetric[]
    }
    moduleDensity: ConnectionModuleDensityMetric[]
  }
  observations: ConnectionObservation[]
  issues: NarrativeIssue[]
  topology: {
    isolatedNodeIds: string[]
    components: string[][]
    cycles: ConnectionCycle[]
  }
}

export interface EntityImpactHashes {
  timeline: string
  knowledge: string
}

export interface EntityChangeSet {
  added: string[]
  modified: string[]
  removed: string[]
}

export type IncrementalMode = 'full' | 'partial' | 'unchanged'

export interface IncrementalPlan {
  mode: IncrementalMode
  reason: string
  changes: EntityChangeSet
  affectedEntityIds: string[]
  affectedIndexes: DerivedIndexName[]
}

export interface AnalysisSnapshot {
  snapshotVersion: '1'
  metadata: DerivedMetadata
  entityHashes: Record<string, string>
  entityImpactHashes: Record<string, EntityImpactHashes>
  compilation: DerivedCompilation
  incremental: IncrementalPlan
  issues: NarrativeIssue[]
  connections?: ConnectionsAnalysisResult
}

export interface AnalysisCacheIdentity {
  sourceHash: string
  schemaVersion: string
  engineVersion: string
}
