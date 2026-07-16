import { Network, RotateCcw } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Card } from '@/components/ui'
import { SemanticGraph } from '@/graph/SemanticGraph'
import { getEntityConnections } from '@/utils/semantic-index'
import type { RendererProps } from '../types'

export function RelationshipRenderer({ universe, index }: RendererProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedFocusId = searchParams.get('focus') ?? ''
  const focusEntity = index.entities.get(requestedFocusId)
  const focusId = focusEntity?.id
  const connections = focusId ? getEntityConnections(index, focusId) : []
  const linkCount = [...index.references.values()].reduce((total, refs) => total + refs.length, 0)

  return <div className="module-page">
    <header className="module-hero">
      <div>
        <p className="eyebrow">Semantic index</p>
        <h1>{focusEntity ? `${focusEntity.title} — Connections` : 'Relationships'}</h1>
        <p>{focusEntity ? `Focused view of the ${connections.length} canonical connections declared by ${focusEntity.title}.` : 'Every edge is derived from canonical refs and foreshadowing fields in the master file.'}</p>
      </div>
      {focusEntity && <Link className="button button-secondary" to="/module/relationships"><RotateCcw size={15} /> Full graph</Link>}
    </header>
    <div className="graph-stats">
      <Card><Network size={20} /><strong>{focusEntity ? connections.length : index.entities.size}</strong><span>{focusEntity ? 'focused connections' : 'indexed entities'}</span></Card>
      <Card><Network size={20} /><strong>{focusEntity ? connections.length + 1 : linkCount}</strong><span>{focusEntity ? 'visible nodes' : 'cross-references'}</span></Card>
      <Card><Network size={20} /><strong>{universe.modules.length}</strong><span>source modules</span></Card>
    </div>
    {focusEntity && <div className="graph-focus-toolbar" role="status"><Badge tone="amber">Focused</Badge><strong>{focusEntity.title}</strong><span>{connections.length} direct connections</span></div>}
    <Card className="graph-card"><SemanticGraph index={index} focusId={focusId} onNodeSelect={(entityId) => setSearchParams({ focus: entityId })} /></Card>
  </div>
}
