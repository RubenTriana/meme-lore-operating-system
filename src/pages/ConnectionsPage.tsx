import { Background, Controls, MarkerType, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Ban, Network, Play, Route, Waypoints } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { connectionNeighborhood, shortestPath } from '@/analysis/connections'
import { isAnalysisSnapshotStale } from '@/analysis/presentation'
import type { AnalysisSnapshot, RelationEdge } from '@/analysis/types'
import { analysisRoute } from '@/app/routes'
import { useUniverseModel } from '@/app/useUniverseModel'
import { Badge, Button, Card, Progress } from '@/components/ui'
import { createAnalysisService, type AnalysisService } from '@/services/analysis-service'
import { withTemporaryEngines } from '@/proposals/workflow'
import { useStudioStore } from '@/store/useStudioStore'

export interface ConnectionsPageProps {
  serviceFactory?: () => AnalysisService
}

const nodeColors: Record<string, string> = { character: '#f59e0b', event: '#ef4444', symbol: '#8b5cf6', mystery: '#a855f7', faction: '#3b82f6', location: '#22c55e' }
const provenanceColors = { explicit: '#ef9f28', refs: '#60a5fa', foreshadowing: '#c084fc' }

function graphNodes(nodeIds: string[], selectedId: string, entities: Map<string, { title: string; type: string }>): Node[] {
  const ordered = [selectedId, ...nodeIds.filter((id) => id !== selectedId)]
  return ordered.map((id, index) => {
    const entity = entities.get(id)
    if (!index) return { id, position: { x: 360, y: 260 }, data: { label: <div><strong>{entity?.title ?? id}</strong><span>{entity?.type ?? 'entity'}</span></div> }, style: { width: 170, border: `2px solid ${nodeColors[entity?.type ?? ''] ?? '#e5a43c'}`, borderRadius: 12, background: '#21180d', color: '#fff', padding: 11 } }
    const ring = Math.floor((index - 1) / 12)
    const ringStart = ring * 12 + 1
    const ringCount = Math.min(12, ordered.length - ringStart)
    const angle = ((index - ringStart) / Math.max(1, ringCount)) * Math.PI * 2 - Math.PI / 2
    const radius = 205 + ring * 145
    return { id, position: { x: 360 + Math.cos(angle) * radius, y: 260 + Math.sin(angle) * radius }, data: { label: <div><strong>{entity?.title ?? id}</strong><span>{entity?.type ?? 'entity'}</span></div> }, style: { width: 156, border: `1px solid ${nodeColors[entity?.type ?? ''] ?? '#666'}`, borderRadius: 10, background: '#181818', color: '#ddd', padding: 10 } }
  })
}

function graphEdges(edges: RelationEdge[]): Edge[] {
  return edges.map((edge) => ({ id: edge.id, source: edge.sourceId, target: edge.targetId, label: edge.type, markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13 }, style: { stroke: provenanceColors[edge.provenance], strokeWidth: 1.4 }, labelStyle: { fill: '#aaa', fontSize: 9 }, labelBgStyle: { fill: '#121212', fillOpacity: 0.86 } }))
}

export function ConnectionsPage({ serviceFactory = createAnalysisService }: ConnectionsPageProps) {
  const { universe, validation } = useUniverseModel()
  const { analysisEngines, setAnalysisLastRunAt } = useStudioStore()
  const [service] = useState<AnalysisService>(serviceFactory)
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | undefined>(() => service.getLatestSnapshot())
  const [compiling, setCompiling] = useState(false)
  const [progress, setProgress] = useState({ value: 0, stage: 'en espera' })
  const [error, setError] = useState<string>()
  const [selectedId, setSelectedId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [edgeType, setEdgeType] = useState('all')
  const [depth, setDepth] = useState(2)
  useEffect(() => () => service.dispose(), [service])

  const analysisUniverse = useMemo(() => universe ? withTemporaryEngines(universe, analysisEngines) : undefined, [universe, analysisEngines])
  const enabled = analysisEngines.connections
  const graph = snapshot?.compilation.relationGraph
  const connections = snapshot?.connections
  const entities = useMemo(() => new Map((universe?.modules ?? []).flatMap((module) => (module.content.items ?? []).map((entity) => [entity.id, { title: entity.title, type: entity.type }] as const))), [universe])
  const entityIds = graph?.nodes.map((node) => node.id) ?? []
  const activeId = selectedId && entityIds.includes(selectedId) ? selectedId : entityIds[0] ?? ''
  const edgeTypes = useMemo(() => [...new Set(graph?.edges.map((edge) => edge.type) ?? [])].sort(), [graph])
  const filterTypes = edgeType === 'all' ? [] : [edgeType]
  const neighborhood = graph && activeId ? connectionNeighborhood(graph, activeId, { maxDepth: depth, maxVisited: 80, edgeTypes: filterTypes }) : undefined
  const directNeighborhood = graph && activeId ? connectionNeighborhood(graph, activeId, { maxDepth: 1, maxVisited: 80, edgeTypes: filterTypes }) : undefined
  const visibleNodeIds = neighborhood?.nodeIds ?? []
  const visibleNodeSet = new Set(visibleNodeIds)
  const visibleEdgeIds = new Set(neighborhood?.edgeIds ?? [])
  const visibleRelations = graph?.edges.filter((edge) => visibleEdgeIds.has(edge.id) && visibleNodeSet.has(edge.sourceId) && visibleNodeSet.has(edge.targetId)) ?? []
  const nodes = activeId ? graphNodes(visibleNodeIds, activeId, entities) : []
  const edges = graphEdges(visibleRelations)
  const directIds = new Set(directNeighborhood?.nodeIds ?? [])
  const directNodeIds = [...directIds].filter((id) => id !== activeId).sort()
  const indirectIds = visibleNodeIds.filter((id) => id !== activeId && !directIds.has(id))
  const path = graph && activeId && targetId ? shortestPath(graph, activeId, targetId, { edgeTypes: filterTypes, maxDepth: 8, maxVisited: 2_000 }) : undefined
  const stale = Boolean(analysisUniverse && isAnalysisSnapshotStale(snapshot, analysisUniverse))

  const compile = async () => {
    if (!analysisUniverse || !enabled) return
    setCompiling(true); setError(undefined); setProgress({ value: 0.01, stage: 'en cola' })
    try {
      const result = await service.compileUniverse(analysisUniverse, { onProgress: (next) => setProgress({ value: next.progress, stage: next.stage }) })
      setSnapshot(result); setProgress({ value: 1, stage: 'completado' })
      setAnalysisLastRunAt(result.metadata.generatedAt)
      const firstId = result.compilation.relationGraph.nodes[0]?.id ?? ''
      setSelectedId((current) => current || firstId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo compilar el grafo de conexiones.')
    } finally { setCompiling(false) }
  }

  if (!validation.valid || !universe) return <Card className="analysis-empty-state"><h2>Canon inválido</h2><p>Corrige el canon antes de explorar conexiones.</p></Card>
  const central = connections?.metrics.degreeCentrality[0]
  const centralTitle = central ? entities.get(central.entityId)?.title ?? central.entityId : '—'
  return <div className="connections-page">
    <header className="module-hero analysis-hero"><div><p className="eyebrow">Análisis determinista</p><h1>Motor de conexiones</h1><p>Explora aislamiento, dependencia, centralidad y caminos sin interpretar prosa ni modificar el canon.</p></div><div className="analysis-actions"><Link className="button button-secondary" to={analysisRoute}><ArrowLeft size={16} /> Diagnósticos</Link><Button onClick={compile} disabled={!enabled || compiling}><Play size={16} /> Analizar conexiones</Button>{compiling && <Button className="button-secondary" onClick={() => service.cancelCompilation()}><Ban size={16} /> Cancelar</Button>}</div></header>
    {!enabled && <Card className="analysis-empty-state"><Network size={28} /><h2>Motor desactivado</h2><p>Activa Conexiones en Settings. La preferencia local no modifica el canon.</p></Card>}
    {compiling && <Card className="analysis-runtime-card"><div className="analysis-runtime-heading"><h2>{progress.stage}</h2><strong>{Math.round(progress.value * 100)}%</strong></div><Progress value={progress.value * 100} /></Card>}
    {error && <Card className="analysis-runtime-card" role="alert"><p className="analysis-error">{error}</p></Card>}
    {enabled && !connections && !compiling && <Card className="analysis-empty-state"><Waypoints size={28} /><h2>Análisis no ejecutado</h2><p>Compila el universo para construir el instrumento de conexiones.</p></Card>}
    {connections && graph && <>
      {stale && <Card className="analysis-stale" role="status"><strong>Resultados obsoletos</strong><p>El canon cambió desde esta compilación.</p></Card>}
      <section className="connections-metric-grid" aria-label="Métricas de conexiones"><Card><span>Nodos aislados</span><strong>{connections.topology.isolatedNodeIds.length}</strong></Card><Card><span>Componentes</span><strong>{connections.topology.components.length}</strong></Card><Card><span>Ciclos dirigidos</span><strong>{connections.topology.cycles.length}</strong></Card><Card><span>Entidad central</span><strong>{centralTitle}</strong></Card><Card><span>Intermediación</span><strong>{connections.metrics.betweenness.status}</strong></Card></section>
      <Card className="connections-controls"><label>Entidad<select aria-label="Seleccionar entidad" value={activeId} onChange={(event) => { setSelectedId(event.target.value); setTargetId('') }}>{entityIds.map((id) => <option key={id} value={id}>{entities.get(id)?.title ?? id}</option>)}</select></label><label>Tipo de arista<select aria-label="Filtrar por tipo de arista" value={edgeType} onChange={(event) => setEdgeType(event.target.value)}><option value="all">Todos</option>{edgeTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label>Profundidad<select aria-label="Limitar profundidad" value={depth} onChange={(event) => setDepth(Number(event.target.value))}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Ruta hacia<select aria-label="Calcular ruta hacia" value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">Seleccionar destino</option>{entityIds.filter((id) => id !== activeId).map((id) => <option key={id} value={id}>{entities.get(id)?.title ?? id}</option>)}</select></label></Card>
      {path && <Card className="connections-path" aria-live="polite"><Route size={18} /><div><strong>{path.found ? `${path.nodeIds.length - 1} pasos` : 'Sin ruta dentro del límite'}</strong><p>{path.found ? path.nodeIds.map((id) => entities.get(id)?.title ?? id).join(' → ') : `${path.visitedCount} nodos visitados${path.truncated ? '; búsqueda truncada' : ''}.`}</p></div></Card>}
      <section className="connections-layout"><Card className="connections-graph-card"><div className="section-heading"><div><p className="eyebrow">Vecindario acotado</p><h2>{entities.get(activeId)?.title ?? activeId}</h2></div><Badge tone={neighborhood?.truncated ? 'amber' : 'blue'}>{visibleNodeIds.length} nodos</Badge></div><div className="connections-graph" aria-label="Grafo de vecindario"><ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.12} maxZoom={1.6} proOptions={{ hideAttribution: true }} onNodeClick={(_event, node) => { setSelectedId(node.id); setTargetId('') }}><Background color="#292929" gap={20} /><Controls showInteractive={false} /><MiniMap nodeColor="#b67b22" maskColor="rgba(8,8,8,.8)" /></ReactFlow></div>{neighborhood?.truncated && <p className="connections-limit-note">Vecindario truncado al límite de 80 nodos.</p>}</Card>
        <div className="connections-side"><Card><div className="section-heading"><h2>Conexiones</h2><Badge tone="blue">{visibleRelations.length}</Badge></div><div className="connections-relation-list">{visibleRelations.slice(0, 100).map((edge) => <article key={edge.id}><span style={{ background: provenanceColors[edge.provenance] }} /><div><strong>{entities.get(edge.sourceId)?.title ?? edge.sourceId} → {entities.get(edge.targetId)?.title ?? edge.targetId}</strong><p>{edge.type} · {edge.provenance}{edge.detail ? ` · ${edge.detail}` : ''}</p></div></article>)}</div></Card><Card><h2>Vecinos directos</h2><div className="connections-chip-list">{directNodeIds.map((id) => <button key={id} onClick={() => setSelectedId(id)}>{entities.get(id)?.title ?? id}</button>)}{!directNodeIds.length && <p>Sin vecinos para este filtro.</p>}</div></Card><Card><h2>Indirectas</h2><div className="connections-chip-list">{indirectIds.slice(0, 40).map((id) => <button key={id} onClick={() => setSelectedId(id)}>{entities.get(id)?.title ?? id}</button>)}{!indirectIds.length && <p>Sin conexiones indirectas en esta profundidad.</p>}</div></Card></div>
      </section>
      <section className="connections-results"><Card><div className="section-heading"><div><p className="eyebrow">Observaciones, no errores</p><h2>Señales estructurales</h2></div><Badge tone="amber">{connections.observations.length}</Badge></div><div className="connections-observation-list">{connections.observations.slice(0, 60).map((item) => <article key={item.id}><Badge tone={item.kind === 'isolated-entity' ? 'amber' : 'neutral'}>{item.kind}</Badge><div><strong>{item.title}</strong><p>{item.message}</p></div></article>)}</div>{connections.observations.length > 60 && <p className="connections-limit-note">Mostrando 60 de {connections.observations.length} observaciones.</p>}</Card><div className="connections-side"><Card><div className="section-heading"><h2>Densidad por módulo</h2><Badge tone="blue">métrica</Badge></div><div className="connections-density-list">{connections.metrics.moduleDensity.map((metric) => <article key={metric.moduleId}><span>{metric.moduleId}</span><strong>{(metric.density * 100).toFixed(1)}%</strong><small>{metric.edgeCount} / {metric.nodeCount * Math.max(0, metric.nodeCount - 1)}</small></article>)}</div></Card><Card><div className="section-heading"><h2>Centralidad de grado</h2><Badge tone="blue">métrica</Badge></div><div className="connections-density-list">{connections.metrics.degreeCentrality.slice(0, 10).map((metric) => <article key={metric.entityId}><span>{entities.get(metric.entityId)?.title ?? metric.entityId}</span><strong>{metric.centrality.toFixed(3)}</strong><small>entrada {metric.inDegree} · salida {metric.outDegree}</small></article>)}</div></Card><Card><div className="section-heading"><h2>Issues estructurales</h2><Badge tone={connections.issues.length ? 'red' : 'green'}>{connections.issues.length}</Badge></div>{connections.issues.length ? <div className="connections-observation-list">{connections.issues.map((issue) => <article key={issue.id}><Badge tone="red">{issue.severity}</Badge><div><strong>{issue.title}</strong><p>{issue.message}</p></div></article>)}</div> : <p className="connections-limit-note">Ningún tipo de relación recíproca declarada presenta inconsistencias.</p>}</Card></div></section>
    </>}
  </div>
}
