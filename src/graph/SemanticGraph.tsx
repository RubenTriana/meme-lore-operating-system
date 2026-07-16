import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { SemanticIndex } from '@/types/universe'
import { buildSemanticGraphModel } from './semantic-graph-model'

export function SemanticGraph({ index, focusId, onNodeSelect }: { index: SemanticIndex; focusId?: string; onNodeSelect?: (entityId: string) => void }) {
  const { nodes, edges } = buildSemanticGraphModel(index, focusId)
  return (
    <div className="semantic-graph">
      <ReactFlow nodes={nodes} edges={edges} fitView minZoom={0.12} maxZoom={1.3} proOptions={{ hideAttribution: true }} onNodeClick={(_event, node) => onNodeSelect?.(node.id)}>
        <Background color="#2b2b2b" gap={18} />
        <Controls showInteractive={false} />
        <MiniMap nodeColor={(node) => String(node.style?.borderColor ?? '#777')} maskColor="rgba(9,9,9,.78)" />
      </ReactFlow>
    </div>
  )
}
