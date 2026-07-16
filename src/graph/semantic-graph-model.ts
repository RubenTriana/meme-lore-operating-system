import { createElement } from 'react'
import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { SemanticIndex, UniverseEntity } from '@/types/universe'
import { getEntityConnections } from '@/utils/semantic-index'

const palette: Record<string, string> = {
  character: '#f59e0b',
  corporation: '#3b82f6',
  event: '#ef4444',
  mystery: '#a855f7',
  default: '#22c55e',
}

export interface SemanticGraphModel {
  nodes: Node[]
  edges: Edge[]
  entities: UniverseEntity[]
}

function focusedPosition(position: number, total: number) {
  if (!position) return { x: 420, y: 310 }
  const ring = Math.floor((position - 1) / 12)
  const ringStart = ring * 12 + 1
  const ringCount = Math.min(12, total - ringStart)
  const angle = ((position - ringStart) / Math.max(1, ringCount)) * Math.PI * 2 - Math.PI / 2
  const radius = 220 + ring * 150
  return { x: 420 + Math.cos(angle) * radius, y: 310 + Math.sin(angle) * radius }
}

function nodeLabel(entity: UniverseEntity) {
  return createElement('div', null, createElement('strong', null, entity.title), createElement('span', null, entity.type))
}

export function buildSemanticGraphModel(index: SemanticIndex, focusId?: string): SemanticGraphModel {
  const focusedEntity = focusId ? index.entities.get(focusId) : undefined
  const sourceEntities = focusedEntity ? [focusedEntity, ...getEntityConnections(index, focusedEntity.id)] : [...index.entities.values()]
  const entityIds = new Set(sourceEntities.map((entity) => entity.id))
  const nodes: Node[] = sourceEntities.map((entity, position) => ({
    id: entity.id,
    position: focusedEntity ? focusedPosition(position, sourceEntities.length) : { x: 80 + (position % 4) * 205, y: 65 + Math.floor(position / 4) * 138 },
    data: { label: nodeLabel(entity) },
    style: { width: position === 0 && focusedEntity ? 184 : 166, borderRadius: 12, border: `${position === 0 && focusedEntity ? 2 : 1}px solid ${palette[entity.type] ?? palette.default}`, background: position === 0 && focusedEntity ? '#2a1d0b' : '#191919', color: '#ececec', padding: '10px 12px', fontSize: 12 },
  }))
  const edgeSources = focusedEntity ? [focusedEntity] : sourceEntities
  const edges: Edge[] = edgeSources.flatMap((entity) => [...new Set(index.references.get(entity.id) ?? [])]
    .filter((target) => entityIds.has(target))
    .map((target) => ({ id: `${entity.id}-${target}`, source: entity.id, target, markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 }, style: { stroke: focusedEntity ? '#b7791f' : '#545454', strokeWidth: focusedEntity ? 1.7 : 1 } })))
  return { nodes, edges, entities: sourceEntities }
}
