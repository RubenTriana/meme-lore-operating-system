import { analyzeConnections, betweennessCentrality, connectionNeighborhood, degreeCentrality, directedCycles, disconnectedComponents, isolatedNodeIds, missingReciprocalEdges, moduleDensity, shortestPath } from '../src/analysis/connections'
import { compileDerived, normalizeUniverse } from '../src/analysis/derived'
import { compileAnalysisSnapshot } from '../src/analysis/incremental'
import type { AnalysisContext, RelationGraph } from '../src/analysis/types'
import type { Universe } from '../src/types/universe'
import { connectionsFixture } from './fixtures/connections-v3_5'

const generatedAt = '2042-04-12T00:00:00.000Z'

function contextFor(universe: Universe): AnalysisContext {
  const normalized = normalizeUniverse(universe)
  const compilation = compileDerived(normalized.universe, { generatedAt })
  return { universe: normalized.universe, normalized, compilation, sourceHash: compilation.metadata.sourceHash, engineVersion: compilation.metadata.engineVersion }
}

describe('connections engine', () => {
  const context = contextFor(connectionsFixture)
  const graph = context.compilation.relationGraph

  it('finds isolated nodes and stable disconnected components without treating them as errors', () => {
    expect(isolatedNodeIds(graph)).toEqual(['isolated-character'])
    expect(disconnectedComponents(graph)).toEqual([
      ['central-hero', 'event-alpha', 'event-beta', 'event-gamma'],
      ['empty-faction', 'hidden-mystery', 'signal-symbol'],
      ['isolated-character'],
    ])
    const result = analyzeConnections(context)
    expect(result.observations.some((item) => item.kind === 'isolated-entity' && item.entityIds.includes('isolated-character'))).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('calculates degree and viable betweenness centrality deterministically', () => {
    const degree = degreeCentrality(graph)
    const first = betweennessCentrality(graph)
    const second = betweennessCentrality(structuredClone(graph))
    expect(degree.find((metric) => metric.entityId === 'central-hero')).toMatchObject({ inDegree: 1, outDegree: 1, totalDegree: 2 })
    expect(first.status).toBe('computed')
    expect(first.values).toEqual(second.values)
    expect(betweennessCentrality(graph, 2)).toMatchObject({ status: 'skipped', nodeLimit: 2, values: [] })
  })

  it('finds bounded shortest paths and indirect neighborhoods', () => {
    expect(shortestPath(graph, 'central-hero', 'event-gamma', { directed: true })).toMatchObject({ found: true, nodeIds: ['central-hero', 'event-alpha', 'event-beta', 'event-gamma'] })
    expect(shortestPath(graph, 'central-hero', 'event-gamma', { directed: true, maxDepth: 2 })).toMatchObject({ found: false, truncated: true })
    expect(connectionNeighborhood(graph, 'central-hero', { maxDepth: 1 })).toMatchObject({ nodeIds: ['central-hero', 'event-alpha', 'event-beta'], truncated: false })
    expect(connectionNeighborhood(graph, 'central-hero', { maxDepth: 3, maxVisited: 2 }).truncated).toBe(true)
  })

  it('keeps directed and undirected traversal semantics explicit', () => {
    const directedGraph: RelationGraph = { ...graph, nodes: [{ id: 'central-hero', type: 'character', moduleId: 'cast' }, { id: 'isolated-character', type: 'character', moduleId: 'cast' }], edges: [{ id: 'one-way', sourceId: 'central-hero', targetId: 'isolated-character', type: 'reference', provenance: 'refs' }], edgeIdsByProvenance: { explicit: [], refs: ['one-way'], foreshadowing: [] } }
    expect(shortestPath(directedGraph, 'isolated-character', 'central-hero', { directed: true }).found).toBe(false)
    expect(shortestPath(directedGraph, 'isolated-character', 'central-hero').found).toBe(true)
  })

  it('detects directed cycles and calculates density by module', () => {
    expect(directedCycles(graph).map((cycle) => cycle.nodeIds)).toEqual(expect.arrayContaining([
      ['central-hero', 'event-alpha', 'event-beta', 'event-gamma'],
      ['hidden-mystery', 'signal-symbol'],
    ]))
    expect(moduleDensity(graph).map((metric) => metric.moduleId)).toEqual(['cast', 'motifs', 'plot'])
    expect(moduleDensity(graph).find((metric) => metric.moduleId === 'plot')).toMatchObject({ nodeCount: 3, edgeCount: 3, density: 0.5 })
  })

  it('reports missing reciprocity only for relation types that explicitly require it', () => {
    const reciprocalGraph: RelationGraph = {
      ...graph,
      nodes: graph.nodes.slice(0, 2),
      edges: [{ id: 'alliance-a-b', sourceId: 'central-hero', targetId: 'isolated-character', type: 'alliance', provenance: 'explicit' }],
      edgeIdsByProvenance: { explicit: ['alliance-a-b'], refs: [], foreshadowing: [] },
    }
    expect(missingReciprocalEdges(reciprocalGraph, [])).toEqual([])
    expect(missingReciprocalEdges(reciprocalGraph, ['alliance'])).toHaveLength(1)
    const reciprocalContext = { ...context, compilation: { ...context.compilation, relationGraph: reciprocalGraph } }
    expect(analyzeConnections(reciprocalContext, { requiredReciprocalEdgeTypes: ['alliance'] }).issues).toEqual([expect.objectContaining({ engine: 'connections', ruleId: 'missing-required-reciprocity' })])
  })

  it('does not inflate neighbor degree when duplicate connections target the same node', () => {
    const duplicateGraph: RelationGraph = { ...graph, nodes: [{ id: 'central-hero', type: 'character', moduleId: 'cast' }, { id: 'isolated-character', type: 'character', moduleId: 'cast' }], edges: [
      { id: 'duplicate-a', sourceId: 'central-hero', targetId: 'isolated-character', type: 'reference', provenance: 'refs' },
      { id: 'duplicate-b', sourceId: 'central-hero', targetId: 'isolated-character', type: 'foreshadowing', provenance: 'foreshadowing' },
    ], edgeIdsByProvenance: { explicit: [], refs: ['duplicate-a'], foreshadowing: ['duplicate-b'] } }
    expect(degreeCentrality(duplicateGraph).find((metric) => metric.entityId === 'central-hero')).toMatchObject({ outDegree: 1, totalDegree: 1 })
  })

  it('classifies central, symbol, faction, mystery, and peripheral results as observations', () => {
    const result = analyzeConnections(context)
    expect(result.observations.map((item) => item.kind)).toEqual(expect.arrayContaining(['central-character', 'symbol-without-event', 'faction-without-character', 'mystery-without-character', 'referenced-peripheral-entity']))
    expect(new Set(result.observations.map((item) => item.id)).size).toBe(result.observations.length)
  })

  it('stores connection results only when the feature flag is enabled', () => {
    const enabled = compileAnalysisSnapshot(structuredClone(connectionsFixture), undefined, { generatedAt })
    const disabledUniverse = structuredClone(connectionsFixture)
    disabledUniverse.analysisConfig!.engines.connections = false
    const disabled = compileAnalysisSnapshot(disabledUniverse, undefined, { generatedAt })
    expect(enabled.connections).toMatchObject({ engine: 'connections', engineVersion: '1.0.0' })
    expect(disabled.connections).toBeUndefined()
  })

  it('rebuilds affected connection results after modification and deletion', () => {
    const baseline = compileAnalysisSnapshot(structuredClone(connectionsFixture), undefined, { generatedAt })
    const changed = structuredClone(connectionsFixture)
    const isolated = changed.modules[0].content.items?.find((entity) => entity.id === 'isolated-character')
    if (!isolated) throw new Error('Connections fixture is incomplete.')
    isolated.refs = ['central-hero']
    const modified = compileAnalysisSnapshot(changed, baseline, { generatedAt })
    expect(modified.incremental).toMatchObject({ mode: 'partial', changes: { modified: ['isolated-character'] } })
    expect(modified.connections?.topology.isolatedNodeIds).not.toContain('isolated-character')

    const removed = structuredClone(changed)
    removed.modules[0].content.items = removed.modules[0].content.items?.filter((entity) => entity.id !== 'isolated-character')
    const afterRemoval = compileAnalysisSnapshot(removed, modified, { generatedAt })
    expect(afterRemoval.incremental).toMatchObject({ mode: 'full', changes: { removed: ['isolated-character'] } })
    expect(afterRemoval.connections?.metrics.degreeCentrality.some((metric) => metric.entityId === 'isolated-character')).toBe(false)
  })

  it('skips betweenness on a graph above the configured scale limit', () => {
    const largeGraph: RelationGraph = {
      metadata: graph.metadata,
      nodes: Array.from({ length: 501 }, (_, index) => ({ id: `node-${index}`, type: 'event', moduleId: 'large' })),
      edges: [],
      edgeIdsByProvenance: { explicit: [], refs: [], foreshadowing: [] },
    }
    expect(betweennessCentrality(largeGraph)).toMatchObject({ status: 'skipped', nodeLimit: 500, values: [] })
  })

  it('handles a 10,000-node acyclic graph without recursive cycle traversal', () => {
    const nodes = Array.from({ length: 10_000 }, (_, index) => ({ id: `scale-${index}`, type: 'event', moduleId: 'large' }))
    const edges = nodes.slice(1).map((node, index) => ({ id: `scale-edge-${index}`, sourceId: nodes[index].id, targetId: node.id, type: 'reference', provenance: 'refs' as const }))
    const largeGraph: RelationGraph = { metadata: graph.metadata, nodes, edges, edgeIdsByProvenance: { explicit: [], refs: edges.map((edge) => edge.id), foreshadowing: [] } }
    expect(directedCycles(largeGraph)).toEqual([])
  })
})
