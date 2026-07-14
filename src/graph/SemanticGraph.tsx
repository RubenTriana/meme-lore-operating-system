import { Background, Controls, MarkerType, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { SemanticIndex, UniverseEntity } from '@/types/universe'

const palette: Record<string, string> = {
  character: '#f59e0b',
  corporation: '#3b82f6',
  event: '#ef4444',
  mystery: '#a855f7',
  default: '#22c55e',
}

export function SemanticGraph({ index, focus }: { index: SemanticIndex; focus?: UniverseEntity[] }) {
  const sourceEntities = focus ?? [...index.entities.values()]
  const entityIds = new Set(sourceEntities.map((entity) => entity.id))
  const nodes: Node[] = sourceEntities.map((entity, position) => ({
    id: entity.id,
    position: { x: 80 + (position % 4) * 205, y: 65 + Math.floor(position / 4) * 138 },
    data: { label: <div><strong>{entity.title}</strong><span>{entity.type}</span></div> },
    style: { width: 166, borderRadius: 12, border: `1px solid ${palette[entity.type] ?? palette.default}`, background: '#191919', color: '#ececec', padding: '10px 12px', fontSize: 12 },
  }))
  const edges: Edge[] = sourceEntities.flatMap((entity) =>
    (index.references.get(entity.id) ?? [])
      .filter((target) => entityIds.has(target))
      .map((target) => ({ id: `${entity.id}-${target}`, source: entity.id, target, markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 }, style: { stroke: '#545454' } })),
  )
  return (
    <div className="semantic-graph">
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.2} maxZoom={1.3} proOptions={{ hideAttribution: true }}>
        <Background color="#2b2b2b" gap={18} />
        <Controls showInteractive={false} />
        <MiniMap nodeColor={(node) => String(node.style?.borderColor ?? '#777')} maskColor="rgba(9,9,9,.78)" />
      </ReactFlow>
    </div>
  )
}
