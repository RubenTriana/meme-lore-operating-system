import type { TemporalPrecision, Universe, UniverseEntity, UniverseModule } from '../types/universe'
import type {
  DependencyIndex,
  DerivedCompilation,
  DerivedIndexName,
  DerivedManifest,
  DerivedMetadata,
  EntityIndex,
  EntityIndexEntry,
  KnowledgeDeclaration,
  KnowledgeIndex,
  KnowledgeSnapshot,
  NormalizedUniverse,
  RelationEdge,
  RelationGraph,
  RelationProvenance,
  TimelineEvent,
  TimelineIndex,
  TimelinePoint,
} from './types'

export const ANALYSIS_ENGINE_VERSION = '0.4.0'

export const DERIVED_ARTIFACT_FILES: Record<DerivedIndexName, string> = {
  'entity-index': 'entity-index.json',
  'relation-graph': 'relation-graph.json',
  'timeline-index': 'timeline-index.json',
  'knowledge-index': 'knowledge-index.json',
  'dependency-index': 'dependency-index.json',
}

const derivedIndexOrder: DerivedIndexName[] = ['entity-index', 'relation-graph', 'timeline-index', 'knowledge-index', 'dependency-index']
const dayPattern = /^\d{4}-\d{2}-\d{2}$/
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/
const yearPattern = /^\d{4}$/
const exactPattern = /^\d{4}-\d{2}-\d{2}T/

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText)
}

function moduleItems(module: UniverseModule): UniverseEntity[] {
  return module.content.items ?? []
}

function compareModules(left: UniverseModule, right: UniverseModule): number {
  return left.order - right.order || compareText(left.id, right.id)
}

function compareEntities(left: UniverseEntity, right: UniverseEntity): number {
  return compareText(left.id, right.id)
}

export function normalizeUniverse(universe: Universe): NormalizedUniverse {
  const modules = [...universe.modules]
    .sort(compareModules)
    .map((module) => ({ ...module, content: { ...module.content, items: [...moduleItems(module)].sort(compareEntities) } }))
  const normalizedUniverse = { ...universe, modules }
  const entities = modules.flatMap((module) => moduleItems(module).map((entity) => ({ entity, moduleId: module.id })))
  return { universe: normalizedUniverse, entities }
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'null'
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const fields = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareText)
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    return `{${fields.join(',')}}`
  }
  throw new Error(`Cannot hash unsupported value type: ${typeof value}`)
}

export function hashCanonical(value: unknown): string {
  const source = stableStringify(value)
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < source.length; index += 1) {
    hash ^= BigInt(source.charCodeAt(index))
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return `fnv1a64-${hash.toString(16).padStart(16, '0')}`
}

export function createDerivedMetadata(universe: Universe, generatedAt: string): DerivedMetadata {
  return {
    sourceHash: hashCanonical(universe),
    schemaVersion: universe.metadata.schemaVersion,
    engineVersion: ANALYSIS_ENGINE_VERSION,
    generatedAt,
  }
}

function recordFromSets(source: Map<string, Set<string>>): Record<string, string[]> {
  return Object.fromEntries([...source.entries()].sort(([left], [right]) => compareText(left, right)).map(([key, values]) => [key, sortedUnique([...values])]))
}

function initializeEntitySets(entities: NormalizedUniverse['entities']): Map<string, Set<string>> {
  return new Map(entities.map(({ entity }) => [entity.id, new Set<string>()]))
}

export function buildEntityIndex(normalized: NormalizedUniverse, metadata: DerivedMetadata): EntityIndex {
  const byType = new Map<string, Set<string>>()
  const byModule = new Map<string, Set<string>>()
  const byTag = new Map<string, Set<string>>()
  const outgoing = initializeEntitySets(normalized.entities)
  const incoming = initializeEntitySets(normalized.entities)
  const entries: Array<[string, EntityIndexEntry]> = []

  normalized.entities.forEach(({ entity, moduleId }) => {
    const references = sortedUnique([
      ...(entity.refs ?? []), ...(entity.foreshadowing ?? []), ...(entity.locationRefs ?? []),
      ...(entity.participantRefs ?? []), ...(entity.causes ?? []), ...(entity.causedByRefs ?? []),
      ...(entity.effects ?? []), ...(entity.novelRefs ?? []), ...(entity.novelRef ? [entity.novelRef] : []),
      ...(entity.primaryNovelRef ? [entity.primaryNovelRef] : []), ...(entity.sagaRef ? [entity.sagaRef] : []),
    ])
    const tags = sortedUnique(entity.tags ?? [])
    if (!byType.has(entity.type)) byType.set(entity.type, new Set())
    byType.get(entity.type)?.add(entity.id)
    if (!byModule.has(moduleId)) byModule.set(moduleId, new Set())
    byModule.get(moduleId)?.add(entity.id)
    tags.forEach((tag) => {
      if (!byTag.has(tag)) byTag.set(tag, new Set())
      byTag.get(tag)?.add(entity.id)
    })
    references.forEach((targetId) => {
      outgoing.get(entity.id)?.add(targetId)
      incoming.get(targetId)?.add(entity.id)
    })
    entries.push([entity.id, { id: entity.id, type: entity.type, moduleId, tags, outgoingReferences: references, incomingReferences: [] }])
  })

  const outgoingReferencesByEntity = recordFromSets(outgoing)
  const incomingReferencesByEntity = recordFromSets(incoming)
  entries.forEach(([entityId, entry]) => {
    entry.incomingReferences = incomingReferencesByEntity[entityId] ?? []
  })

  return {
    metadata,
    entitiesById: Object.fromEntries(entries.sort(([left], [right]) => compareText(left, right))),
    entityIdsByType: recordFromSets(byType),
    entityIdsByModule: recordFromSets(byModule),
    entityIdsByTag: recordFromSets(byTag),
    outgoingReferencesByEntity,
    incomingReferencesByEntity,
  }
}

function relationEdgeId(sourceId: string, targetId: string, type: string, provenance: RelationProvenance, detail?: string): string {
  return [sourceId, targetId, type, provenance, detail ?? ''].join('|')
}

function compareEdges(left: RelationEdge, right: RelationEdge): number {
  return compareText(left.sourceId, right.sourceId)
    || compareText(left.targetId, right.targetId)
    || compareText(left.provenance, right.provenance)
    || compareText(left.type, right.type)
    || compareText(left.detail ?? '', right.detail ?? '')
}

export function buildRelationGraph(normalized: NormalizedUniverse, metadata: DerivedMetadata): RelationGraph {
  const edges: RelationEdge[] = []
  const addEdge = (sourceId: string, targetId: string, type: string, provenance: RelationProvenance, detail?: string) => {
    edges.push({ id: relationEdgeId(sourceId, targetId, type, provenance, detail), sourceId, targetId, type, provenance, ...(detail ? { detail } : {}) })
  }

  normalized.entities.forEach(({ entity }) => {
    sortedUnique(entity.refs ?? []).forEach((targetId) => addEdge(entity.id, targetId, 'reference', 'refs'))
    sortedUnique(entity.foreshadowing ?? []).forEach((targetId) => addEdge(entity.id, targetId, 'foreshadowing', 'foreshadowing'))
    sortedUnique(entity.locationRefs ?? []).forEach((targetId) => addEdge(entity.id, targetId, 'location', 'explicit'))
    sortedUnique(entity.participantRefs ?? []).forEach((targetId) => addEdge(entity.id, targetId, 'participant', 'explicit'))
    sortedUnique(entity.causes ?? []).forEach((targetId) => addEdge(entity.id, targetId, 'cause', 'explicit'))
    sortedUnique(entity.causedByRefs ?? []).forEach((targetId) => addEdge(entity.id, targetId, 'cause', 'explicit', 'causedByRefs'))
    sortedUnique(entity.effects ?? []).forEach((targetId) => addEdge(entity.id, targetId, 'effect', 'explicit'))
    sortedUnique(entity.novelRefs ?? []).forEach((targetId) => addEdge(entity.id, targetId, 'novel', 'explicit'))
    if (entity.novelRef) addEdge(entity.id, entity.novelRef, 'novel', 'explicit')
    if (entity.primaryNovelRef) addEdge(entity.id, entity.primaryNovelRef, 'primary-novel', 'explicit')
    if (entity.sagaRef) addEdge(entity.id, entity.sagaRef, 'saga', 'explicit')
    entity.knowledgeChanges?.forEach((change) => addEdge(entity.id, change.characterRef, 'knowledge-change', 'explicit'))
    entity.stateChanges?.forEach((change) => addEdge(entity.id, change.entityRef, 'state-change', 'explicit', change.path))
  })

  const sortedEdges = edges.sort(compareEdges)
  const edgeIdsByProvenance: Record<RelationProvenance, string[]> = { explicit: [], refs: [], foreshadowing: [] }
  sortedEdges.forEach((edge) => edgeIdsByProvenance[edge.provenance].push(edge.id))

  return {
    metadata,
    nodes: normalized.entities.map(({ entity, moduleId }) => ({ id: entity.id, type: entity.type, moduleId })).sort((left, right) => compareText(left.id, right.id)),
    edges: sortedEdges,
    edgeIdsByProvenance,
  }
}

function calendarDayTimestamp(value: string): number | undefined {
  if (!dayPattern.test(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? timestamp : undefined
}

function temporalPoint(value: string, precision?: TemporalPrecision): TimelinePoint | undefined {
  if (precision === 'relative' || precision === 'unknown') return undefined
  if (precision === 'exact') {
    const parsed = exactPattern.test(value) ? Date.parse(value) : Number.NaN
    return Number.isNaN(parsed) ? undefined : { value: parsed, precision }
  }
  if (precision === 'day') {
    const parsed = calendarDayTimestamp(value)
    return parsed === undefined ? undefined : { value: parsed, precision }
  }
  if (precision === 'month') {
    if (!monthPattern.test(value)) return undefined
    const [year, month] = value.split('-').map(Number)
    return { value: Date.UTC(year, month - 1, 1), precision }
  }
  if (precision === 'year') return yearPattern.test(value) ? { value: Date.UTC(Number(value), 0, 1), precision } : undefined

  if (exactPattern.test(value)) {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? undefined : { value: parsed, precision: 'exact' }
  }
  const day = calendarDayTimestamp(value)
  if (day !== undefined) return { value: day, precision: 'day' }
  if (monthPattern.test(value)) {
    const [year, month] = value.split('-').map(Number)
    return { value: Date.UTC(year, month - 1, 1), precision: 'month' }
  }
  return yearPattern.test(value) ? { value: Date.UTC(Number(value), 0, 1), precision: 'year' } : undefined
}

function pointForEntity(entity: UniverseEntity): TimelinePoint | undefined {
  if (entity.temporal?.start) {
    const point = temporalPoint(entity.temporal.start, entity.temporal.precision)
    if (point) return point
  }
  if (entity.date) {
    const parsed = Date.parse(entity.date)
    if (!Number.isNaN(parsed)) return { value: parsed, precision: 'legacy' }
  }
  return entity.sequence === undefined ? undefined : { value: entity.sequence, precision: 'relative' }
}

function compareTimelineEvents(left: TimelineEvent, right: TimelineEvent): number {
  if (left.point && right.point) return left.point.value - right.point.value || compareText(left.id, right.id)
  if (left.point) return -1
  if (right.point) return 1
  return (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER) || compareText(left.id, right.id)
}

export function buildTimelineIndex(normalized: NormalizedUniverse, metadata: DerivedMetadata): TimelineIndex {
  const participants = new Map<string, Set<string>>()
  const locations = new Map<string, Set<string>>()
  const events = normalized.entities
    .filter(({ entity }) => entity.type === 'event')
    .map(({ entity, moduleId }) => {
      const point = pointForEntity(entity)
      const event: TimelineEvent = { id: entity.id, moduleId, hasExactDate: point?.precision === 'exact', ...(entity.sequence === undefined ? {} : { sequence: entity.sequence }), ...(entity.temporal ? { temporal: entity.temporal } : {}), ...(point ? { point } : {}) }
      sortedUnique(entity.participantRefs ?? []).forEach((participantId) => {
        if (!participants.has(participantId)) participants.set(participantId, new Set())
        participants.get(participantId)?.add(entity.id)
      })
      sortedUnique(entity.locationRefs ?? []).forEach((locationId) => {
        if (!locations.has(locationId)) locations.set(locationId, new Set())
        locations.get(locationId)?.add(entity.id)
      })
      return event
    })
    .sort(compareTimelineEvents)

  return {
    metadata,
    events,
    eventIdsWithoutExactDate: events.filter((event) => !event.hasExactDate).map((event) => event.id),
    eventIdsByParticipant: recordFromSets(participants),
    eventIdsByLocation: recordFromSets(locations),
  }
}

export function buildKnowledgeIndex(normalized: NormalizedUniverse, timeline: TimelineIndex, metadata: DerivedMetadata): KnowledgeIndex {
  const entitiesById = new Map(normalized.entities.map(({ entity }) => [entity.id, entity]))
  const declarations: KnowledgeDeclaration[] = []

  timeline.events.forEach((timelineEvent) => {
    const event = entitiesById.get(timelineEvent.id)
    event?.knowledgeChanges?.forEach((change) => {
      declarations.push({
        eventId: timelineEvent.id,
        characterId: change.characterRef,
        learns: sortedUnique(change.learns ?? []),
        forgets: sortedUnique(change.forgets ?? []),
        ...(timelineEvent.point ? { point: timelineEvent.point } : {}),
      })
    })
  })

  const declarationsWithoutCalculableTime: KnowledgeDeclaration[] = []
  const knowledgeByCharacter = new Map<string, Set<string>>()
  const snapshotsByCharacter = new Map<string, KnowledgeSnapshot[]>()
  declarations.forEach((declaration) => {
    if (!declaration.point) {
      declarationsWithoutCalculableTime.push(declaration)
      return
    }
    if (!knowledgeByCharacter.has(declaration.characterId)) knowledgeByCharacter.set(declaration.characterId, new Set())
    const knowledge = knowledgeByCharacter.get(declaration.characterId)!
    declaration.forgets.forEach((value) => knowledge.delete(value))
    declaration.learns.forEach((value) => knowledge.add(value))
    if (!snapshotsByCharacter.has(declaration.characterId)) snapshotsByCharacter.set(declaration.characterId, [])
    snapshotsByCharacter.get(declaration.characterId)?.push({ eventId: declaration.eventId, point: declaration.point, knowledge: sortedUnique([...knowledge]) })
  })

  return {
    metadata,
    declarations,
    declarationsWithoutCalculableTime,
    cumulativeKnowledgeByCharacter: Object.fromEntries([...snapshotsByCharacter.entries()].sort(([left], [right]) => compareText(left, right))),
  }
}

export function buildDependencyIndex(normalized: NormalizedUniverse, graph: RelationGraph, knowledge: KnowledgeIndex, metadata: DerivedMetadata): DependencyIndex {
  const affected = initializeEntitySets(normalized.entities)
  graph.edges.forEach((edge) => {
    affected.get(edge.sourceId)?.add(edge.targetId)
    affected.get(edge.targetId)?.add(edge.sourceId)
  })
  const knowledgeCharacterIds = new Set(knowledge.declarations.map((declaration) => declaration.characterId))
  const rebuildEntries: Array<[string, DerivedIndexName[]]> = normalized.entities.map(({ entity }) => {
    const rebuild = new Set<DerivedIndexName>(['entity-index', 'relation-graph', 'dependency-index'])
    if (entity.type === 'event' || entity.temporal) rebuild.add('timeline-index')
    if ((entity.knowledgeChanges?.length ?? 0) > 0 || knowledgeCharacterIds.has(entity.id)) rebuild.add('knowledge-index')
    return [entity.id, derivedIndexOrder.filter((index) => rebuild.has(index))]
  })
  const rebuildIndexesByEntity = Object.fromEntries(rebuildEntries.sort(([left], [right]) => compareText(left, right)))

  return {
    metadata,
    affectedEntityIdsByEntity: recordFromSets(affected),
    rebuildIndexesByEntity,
  }
}

export function assembleDerivedCompilation(
  normalized: NormalizedUniverse,
  metadata: DerivedMetadata,
  entityIndex: EntityIndex,
  relationGraph: RelationGraph,
  timelineIndex: TimelineIndex,
  knowledgeIndex: KnowledgeIndex,
  dependencyIndex: DependencyIndex,
): DerivedCompilation {
  const manifest: DerivedManifest = {
    metadata,
    files: DERIVED_ARTIFACT_FILES,
    counts: {
      entities: normalized.entities.length,
      relationEdges: relationGraph.edges.length,
      events: timelineIndex.events.length,
      knowledgeDeclarations: knowledgeIndex.declarations.length,
    },
  }
  return { metadata, entityIndex, relationGraph, timelineIndex, knowledgeIndex, dependencyIndex, manifest }
}

export function compileDerived(universe: Universe, options: { generatedAt?: string } = {}): DerivedCompilation {
  const normalized = normalizeUniverse(universe)
  const metadata = createDerivedMetadata(normalized.universe, options.generatedAt ?? new Date().toISOString())
  const entityIndex = buildEntityIndex(normalized, metadata)
  const relationGraph = buildRelationGraph(normalized, metadata)
  const timelineIndex = buildTimelineIndex(normalized, metadata)
  const knowledgeIndex = buildKnowledgeIndex(normalized, timelineIndex, metadata)
  const dependencyIndex = buildDependencyIndex(normalized, relationGraph, knowledgeIndex, metadata)
  return assembleDerivedCompilation(normalized, metadata, entityIndex, relationGraph, timelineIndex, knowledgeIndex, dependencyIndex)
}

export function derivedArtifacts(compilation: DerivedCompilation): Record<string, unknown> {
  return {
    [DERIVED_ARTIFACT_FILES['entity-index']]: compilation.entityIndex,
    [DERIVED_ARTIFACT_FILES['relation-graph']]: compilation.relationGraph,
    [DERIVED_ARTIFACT_FILES['timeline-index']]: compilation.timelineIndex,
    [DERIVED_ARTIFACT_FILES['knowledge-index']]: compilation.knowledgeIndex,
    [DERIVED_ARTIFACT_FILES['dependency-index']]: compilation.dependencyIndex,
    'manifest.json': compilation.manifest,
  }
}
