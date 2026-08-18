import { hashCanonical } from '../derived'
import { createAnalysisIssue, deduplicateIssues, entitiesById, sortedUnique } from '../issue-utils'
import type { AnalysisContext, AnalysisRule, ConnectionBetweennessMetric, ConnectionCycle, ConnectionDegreeMetric, ConnectionModuleDensityMetric, ConnectionNeighborhood, ConnectionObservation, ConnectionObservationKind, ConnectionPathResult, ConnectionsAnalysisResult, NarrativeIssue, RelationEdge, RelationGraph } from '../types'

export const CONNECTIONS_ENGINE_VERSION = '1.0.0'
export const DEFAULT_BETWEENNESS_NODE_LIMIT = 500
export const DEFAULT_NEIGHBORHOOD_NODE_LIMIT = 80
export const DEFAULT_PATH_VISIT_LIMIT = 2_000

export interface ConnectionTraversalOptions {
  directed?: boolean
  edgeTypes?: readonly string[]
  maxDepth?: number
  maxVisited?: number
}

export interface ConnectionsAnalysisOptions {
  betweennessNodeLimit?: number
  requiredReciprocalEdgeTypes?: readonly string[]
}

interface GraphProjection {
  nodeIds: string[]
  edges: RelationEdge[]
  outgoing: Map<string, Array<{ nodeId: string; edgeId: string }>>
  incoming: Map<string, Array<{ nodeId: string; edgeId: string }>>
  undirected: Map<string, Array<{ nodeId: string; edgeId: string }>>
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function edgeKey(edge: RelationEdge): string {
  return `${edge.sourceId}\u0000${edge.targetId}\u0000${edge.type}\u0000${edge.provenance}\u0000${edge.detail ?? ''}`
}

function addNeighbor(map: Map<string, Array<{ nodeId: string; edgeId: string }>>, sourceId: string, nodeId: string, edgeId: string): void {
  const entries = map.get(sourceId) ?? []
  if (!entries.some((entry) => entry.nodeId === nodeId && entry.edgeId === edgeId)) entries.push({ nodeId, edgeId })
  entries.sort((left, right) => compareText(left.nodeId, right.nodeId) || compareText(left.edgeId, right.edgeId))
  map.set(sourceId, entries)
}

function projectGraph(graph: RelationGraph, edgeTypes: readonly string[] = []): GraphProjection {
  const allowed = new Set(edgeTypes)
  const nodeIds = graph.nodes.map((node) => node.id).sort(compareText)
  const nodeSet = new Set(nodeIds)
  const outgoing = new Map<string, Array<{ nodeId: string; edgeId: string }>>()
  const incoming = new Map<string, Array<{ nodeId: string; edgeId: string }>>()
  const undirected = new Map<string, Array<{ nodeId: string; edgeId: string }>>()
  nodeIds.forEach((id) => { outgoing.set(id, []); incoming.set(id, []); undirected.set(id, []) })
  const edges = [...graph.edges]
    .filter((edge) => (!allowed.size || allowed.has(edge.type)) && nodeSet.has(edge.sourceId) && nodeSet.has(edge.targetId))
    .sort((left, right) => compareText(edgeKey(left), edgeKey(right)))
  edges.forEach((edge) => {
    addNeighbor(outgoing, edge.sourceId, edge.targetId, edge.id)
    addNeighbor(incoming, edge.targetId, edge.sourceId, edge.id)
    addNeighbor(undirected, edge.sourceId, edge.targetId, edge.id)
    addNeighbor(undirected, edge.targetId, edge.sourceId, edge.id)
  })
  return { nodeIds, edges, outgoing, incoming, undirected }
}

function distinctNodeIds(entries: Array<{ nodeId: string }>): string[] {
  return sortedUnique(entries.map((entry) => entry.nodeId))
}

function traversalNeighbors(projection: GraphProjection, nodeId: string, directed: boolean): Array<{ nodeId: string; edgeId: string }> {
  return directed ? projection.outgoing.get(nodeId) ?? [] : projection.undirected.get(nodeId) ?? []
}

export function isolatedNodeIds(graph: RelationGraph, edgeTypes: readonly string[] = []): string[] {
  const projection = projectGraph(graph, edgeTypes)
  return projection.nodeIds.filter((id) => !(projection.undirected.get(id)?.length))
}

export function disconnectedComponents(graph: RelationGraph, edgeTypes: readonly string[] = []): string[][] {
  const projection = projectGraph(graph, edgeTypes)
  const remaining = new Set(projection.nodeIds)
  const components: string[][] = []
  projection.nodeIds.forEach((startId) => {
    if (!remaining.has(startId)) return
    const queue = [startId]
    const component: string[] = []
    remaining.delete(startId)
    let cursor = 0
    while (cursor < queue.length) {
      const current = queue[cursor++]
      component.push(current)
      distinctNodeIds(projection.undirected.get(current) ?? []).forEach((nextId) => {
        if (!remaining.has(nextId)) return
        remaining.delete(nextId)
        queue.push(nextId)
      })
    }
    components.push(component.sort(compareText))
  })
  return components.sort((left, right) => right.length - left.length || compareText(left[0] ?? '', right[0] ?? ''))
}

export function degreeCentrality(graph: RelationGraph, edgeTypes: readonly string[] = []): ConnectionDegreeMetric[] {
  const projection = projectGraph(graph, edgeTypes)
  const denominator = Math.max(1, projection.nodeIds.length - 1)
  return projection.nodeIds.map((entityId) => {
    const incoming = distinctNodeIds(projection.incoming.get(entityId) ?? [])
    const outgoing = distinctNodeIds(projection.outgoing.get(entityId) ?? [])
    const total = sortedUnique([...incoming, ...outgoing])
    return { entityId, inDegree: incoming.length, outDegree: outgoing.length, totalDegree: total.length, centrality: total.length / denominator }
  }).sort((left, right) => right.centrality - left.centrality || compareText(left.entityId, right.entityId))
}

export function betweennessCentrality(graph: RelationGraph, nodeLimit = DEFAULT_BETWEENNESS_NODE_LIMIT, edgeTypes: readonly string[] = []): ConnectionsAnalysisResult['metrics']['betweenness'] {
  const projection = projectGraph(graph, edgeTypes)
  if (projection.nodeIds.length > nodeLimit) return { status: 'skipped', nodeLimit, reason: `Graph has ${projection.nodeIds.length} nodes; limit is ${nodeLimit}.`, values: [] }
  const scores = new Map(projection.nodeIds.map((id) => [id, 0]))
  projection.nodeIds.forEach((sourceId) => {
    const stack: string[] = []
    const predecessors = new Map(projection.nodeIds.map((id) => [id, [] as string[]]))
    const paths = new Map(projection.nodeIds.map((id) => [id, 0]))
    const distance = new Map(projection.nodeIds.map((id) => [id, -1]))
    paths.set(sourceId, 1)
    distance.set(sourceId, 0)
    const queue = [sourceId]
    while (queue.length) {
      const current = queue.shift()!
      stack.push(current)
      distinctNodeIds(projection.undirected.get(current) ?? []).forEach((nextId) => {
        if (distance.get(nextId) === -1) { queue.push(nextId); distance.set(nextId, distance.get(current)! + 1) }
        if (distance.get(nextId) === distance.get(current)! + 1) {
          paths.set(nextId, paths.get(nextId)! + paths.get(current)!)
          predecessors.get(nextId)!.push(current)
        }
      })
    }
    const dependency = new Map(projection.nodeIds.map((id) => [id, 0]))
    while (stack.length) {
      const nodeId = stack.pop()!
      predecessors.get(nodeId)!.sort(compareText).forEach((predecessorId) => {
        const nodePaths = paths.get(nodeId)!
        if (nodePaths) dependency.set(predecessorId, dependency.get(predecessorId)! + (paths.get(predecessorId)! / nodePaths) * (1 + dependency.get(nodeId)!))
      })
      if (nodeId !== sourceId) scores.set(nodeId, scores.get(nodeId)! + dependency.get(nodeId)!)
    }
  })
  const denominator = projection.nodeIds.length > 2 ? (projection.nodeIds.length - 1) * (projection.nodeIds.length - 2) : 1
  const values: ConnectionBetweennessMetric[] = projection.nodeIds.map((entityId) => ({ entityId, centrality: scores.get(entityId)! / denominator })).sort((left, right) => right.centrality - left.centrality || compareText(left.entityId, right.entityId))
  return { status: 'computed', nodeLimit, values }
}

export function shortestPath(graph: RelationGraph, sourceId: string, targetId: string, options: ConnectionTraversalOptions = {}): ConnectionPathResult {
  const projection = projectGraph(graph, options.edgeTypes)
  const maxDepth = Math.max(0, options.maxDepth ?? 8)
  const maxVisited = Math.max(1, options.maxVisited ?? DEFAULT_PATH_VISIT_LIMIT)
  if (!projection.nodeIds.includes(sourceId) || !projection.nodeIds.includes(targetId)) return { found: false, nodeIds: [], edgeIds: [], visitedCount: 0, truncated: false }
  if (sourceId === targetId) return { found: true, nodeIds: [sourceId], edgeIds: [], visitedCount: 1, truncated: false }
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: sourceId, depth: 0 }]
  const visited = new Set([sourceId])
  const parent = new Map<string, { nodeId: string; edgeId: string }>()
  let truncated = false
  while (queue.length) {
    const current = queue.shift()!
    if (current.depth >= maxDepth) { truncated = true; continue }
    for (const next of traversalNeighbors(projection, current.nodeId, options.directed ?? false)) {
      if (visited.has(next.nodeId)) continue
      if (visited.size >= maxVisited) { truncated = true; break }
      visited.add(next.nodeId)
      parent.set(next.nodeId, { nodeId: current.nodeId, edgeId: next.edgeId })
      if (next.nodeId === targetId) {
        const nodeIds = [targetId]
        const edgeIds: string[] = []
        let cursor = targetId
        while (cursor !== sourceId) {
          const step = parent.get(cursor)!
          edgeIds.unshift(step.edgeId)
          nodeIds.unshift(step.nodeId)
          cursor = step.nodeId
        }
        return { found: true, nodeIds, edgeIds, visitedCount: visited.size, truncated }
      }
      queue.push({ nodeId: next.nodeId, depth: current.depth + 1 })
    }
  }
  return { found: false, nodeIds: [], edgeIds: [], visitedCount: visited.size, truncated }
}

export function connectionNeighborhood(graph: RelationGraph, sourceId: string, options: ConnectionTraversalOptions = {}): ConnectionNeighborhood {
  const projection = projectGraph(graph, options.edgeTypes)
  const maxDepth = Math.max(0, options.maxDepth ?? 2)
  const maxVisited = Math.max(1, options.maxVisited ?? DEFAULT_NEIGHBORHOOD_NODE_LIMIT)
  const visited = new Set<string>()
  const edgeIds = new Set<string>()
  let truncated = false
  if (!projection.nodeIds.includes(sourceId)) return { sourceId, depth: maxDepth, nodeIds: [], edgeIds: [], truncated: false }
  visited.add(sourceId)
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: sourceId, depth: 0 }]
  while (queue.length) {
    const current = queue.shift()!
    if (current.depth >= maxDepth) continue
    for (const next of traversalNeighbors(projection, current.nodeId, options.directed ?? false)) {
      if (visited.has(next.nodeId)) { edgeIds.add(next.edgeId); continue }
      if (visited.size >= maxVisited) { truncated = true; continue }
      edgeIds.add(next.edgeId)
      visited.add(next.nodeId)
      queue.push({ nodeId: next.nodeId, depth: current.depth + 1 })
    }
  }
  const visibleEdges = projection.edges.filter((edge) => visited.has(edge.sourceId) && visited.has(edge.targetId)).map((edge) => edge.id)
  visibleEdges.forEach((id) => edgeIds.add(id))
  return { sourceId, depth: maxDepth, nodeIds: [...visited].sort(compareText), edgeIds: [...edgeIds].sort(compareText), truncated }
}

export function directedCycles(graph: RelationGraph, edgeTypes: readonly string[] = []): ConnectionCycle[] {
  const projection = projectGraph(graph, edgeTypes)
  const visited = new Set<string>()
  const finishOrder: string[] = []
  projection.nodeIds.forEach((startId) => {
    if (visited.has(startId)) return
    visited.add(startId)
    const stack: Array<{ nodeId: string; neighbors: string[]; index: number }> = [{ nodeId: startId, neighbors: distinctNodeIds(projection.outgoing.get(startId) ?? []), index: 0 }]
    while (stack.length) {
      const frame = stack.at(-1)!
      const nextId = frame.neighbors[frame.index]
      if (nextId) {
        frame.index += 1
        if (!visited.has(nextId)) {
          visited.add(nextId)
          stack.push({ nodeId: nextId, neighbors: distinctNodeIds(projection.outgoing.get(nextId) ?? []), index: 0 })
        }
      } else {
        finishOrder.push(frame.nodeId)
        stack.pop()
      }
    }
  })

  const assigned = new Set<string>()
  const cycles: ConnectionCycle[] = []
  ;[...finishOrder].reverse().forEach((startId) => {
    if (assigned.has(startId)) return
    const component: string[] = []
    const stack = [startId]
    assigned.add(startId)
    while (stack.length) {
      const current = stack.pop()!
      component.push(current)
      const predecessors = distinctNodeIds(projection.incoming.get(current) ?? []).reverse()
      predecessors.forEach((nextId) => { if (!assigned.has(nextId)) { assigned.add(nextId); stack.push(nextId) } })
    }
    const nodeIds = component.sort(compareText)
    const selfLoop = nodeIds.length === 1 && (projection.outgoing.get(nodeIds[0]) ?? []).some((entry) => entry.nodeId === nodeIds[0])
    if (nodeIds.length > 1 || selfLoop) cycles.push({ id: `connection-cycle-${hashCanonical(nodeIds).replace('fnv1a64-', '')}`, nodeIds })
  })
  return cycles.sort((left, right) => compareText(left.id, right.id))
}

export function moduleDensity(graph: RelationGraph, edgeTypes: readonly string[] = []): ConnectionModuleDensityMetric[] {
  const projection = projectGraph(graph, edgeTypes)
  const moduleByNode = new Map(graph.nodes.map((node) => [node.id, node.moduleId]))
  const nodesByModule = new Map<string, string[]>()
  graph.nodes.forEach((node) => nodesByModule.set(node.moduleId, [...(nodesByModule.get(node.moduleId) ?? []), node.id]))
  return [...nodesByModule.entries()].sort(([left], [right]) => compareText(left, right)).map(([moduleId, nodeIds]) => {
    const members = new Set(nodeIds)
    const pairs = new Set(projection.edges.filter((edge) => edge.sourceId !== edge.targetId && members.has(edge.sourceId) && members.has(edge.targetId) && moduleByNode.get(edge.sourceId) === moduleId).map((edge) => `${edge.sourceId}\u0000${edge.targetId}`))
    const possible = nodeIds.length * Math.max(0, nodeIds.length - 1)
    return { moduleId, nodeCount: nodeIds.length, edgeCount: pairs.size, density: possible ? pairs.size / possible : 0 }
  })
}

export function missingReciprocalEdges(graph: RelationGraph, requiredEdgeTypes: readonly string[]): RelationEdge[] {
  const required = new Set(requiredEdgeTypes)
  const relevant = graph.edges.filter((edge) => required.has(edge.type))
  const signatures = new Set(relevant.map((edge) => `${edge.sourceId}\u0000${edge.targetId}\u0000${edge.type}`))
  return relevant.filter((edge) => !signatures.has(`${edge.targetId}\u0000${edge.sourceId}\u0000${edge.type}`)).sort((left, right) => compareText(edgeKey(left), edgeKey(right)))
}

function observation(kind: ConnectionObservationKind, title: string, message: string, entityIds: string[]): ConnectionObservation {
  const ordered = sortedUnique(entityIds)
  return { id: `connections-${kind}-${hashCanonical({ kind, entityIds: ordered }).replace('fnv1a64-', '')}`, kind, title, message, entityIds: ordered, sourceIds: ordered }
}

function connectionObservations(context: AnalysisContext, degree: ConnectionDegreeMetric[], components: string[][]): ConnectionObservation[] {
  const entities = entitiesById(context)
  const graph = context.compilation.relationGraph
  const projection = projectGraph(graph)
  const degreeById = new Map(degree.map((metric) => [metric.entityId, metric]))
  const observations: ConnectionObservation[] = []
  degree.filter((metric) => metric.totalDegree === 0).forEach((metric) => {
    const entity = entities.get(metric.entityId)
    observations.push(observation('isolated-entity', entity?.type === 'character' ? 'Isolated character' : 'Isolated entity', `${entity?.title ?? metric.entityId} has no declared graph connections. This is an observation, not an error.`, [metric.entityId]))
  })
  components.slice(1).forEach((component) => observations.push(observation('disconnected-component', 'Disconnected narrative component', `${component.length} entities form a component outside the largest connected group.`, component)))
  const centralCharacter = degree.find((metric) => entities.get(metric.entityId)?.type === 'character' && metric.totalDegree > 0)
  if (centralCharacter) observations.push(observation('central-character', 'Central character', `${entities.get(centralCharacter.entityId)?.title ?? centralCharacter.entityId} has the highest character degree centrality (${centralCharacter.centrality.toFixed(3)}).`, [centralCharacter.entityId]))
  graph.nodes.forEach((node) => {
    const entity = entities.get(node.id)
    const neighborTypes = new Set(distinctNodeIds(projection.undirected.get(node.id) ?? []).map((id) => entities.get(id)?.type).filter((type): type is string => Boolean(type)))
    if (entity?.type === 'symbol' && !neighborTypes.has('event')) observations.push(observation('symbol-without-event', 'Symbol without event connection', `${entity.title} is not connected to an event.`, [entity.id]))
    if (entity?.type === 'mystery' && !neighborTypes.has('character')) observations.push(observation('mystery-without-character', 'Mystery without character connection', `${entity.title} is not connected to a character.`, [entity.id]))
    if (entity?.type === 'faction' && !neighborTypes.has('character')) observations.push(observation('faction-without-character', 'Faction without character connection', `${entity.title} has no connected character member or participant.`, [entity.id]))
    const incomingRefs = context.compilation.entityIndex.incomingReferencesByEntity[node.id] ?? []
    if (incomingRefs.length && (degreeById.get(node.id)?.totalDegree ?? 0) <= 1) observations.push(observation('referenced-peripheral-entity', 'Referenced but peripheral entity', `${entity?.title ?? node.id} is referenced but remains at the graph periphery.`, [node.id, ...incomingRefs]))
  })
  return [...new Map(observations.map((item) => [item.id, item])).values()].sort((left, right) => compareText(left.id, right.id))
}

function reciprocityIssues(context: AnalysisContext, requiredTypes: readonly string[]): NarrativeIssue[] {
  return missingReciprocalEdges(context.compilation.relationGraph, requiredTypes).map((edge) => createAnalysisIssue(context, 'connections', CONNECTIONS_ENGINE_VERSION, {
    ruleId: 'missing-required-reciprocity', severity: 'medium', confidence: 1, title: 'Required reciprocal relationship is missing', message: `${edge.type} from ${edge.sourceId} to ${edge.targetId} requires a matching reverse declaration.`, entityIds: [edge.sourceId, edge.targetId], sourceIds: [edge.sourceId, edge.targetId], evidence: [{ sourceId: edge.sourceId, field: `relationGraph.${edge.type}`, value: edge.targetId }],
  }))
}

const missingReciprocityRule: AnalysisRule = {
  id: 'missing-required-reciprocity', engine: 'connections', version: CONNECTIONS_ENGINE_VERSION,
  evaluate(context) { return reciprocityIssues(context, []) },
}

export const connectionRules: readonly AnalysisRule[] = [missingReciprocityRule]

export function analyzeConnections(context: AnalysisContext, options: ConnectionsAnalysisOptions = {}): ConnectionsAnalysisResult {
  const graph = context.compilation.relationGraph
  const degree = degreeCentrality(graph)
  const components = disconnectedComponents(graph)
  const isolated = isolatedNodeIds(graph)
  const requiredTypes = options.requiredReciprocalEdgeTypes ?? []
  return {
    engine: 'connections', engineVersion: CONNECTIONS_ENGINE_VERSION, sourceHash: context.sourceHash,
    metrics: { degreeCentrality: degree, betweenness: betweennessCentrality(graph, options.betweennessNodeLimit ?? DEFAULT_BETWEENNESS_NODE_LIMIT), moduleDensity: moduleDensity(graph) },
    observations: connectionObservations(context, degree, components), issues: deduplicateIssues(reciprocityIssues(context, requiredTypes)),
    topology: { isolatedNodeIds: isolated, components, cycles: directedCycles(graph) },
  }
}
