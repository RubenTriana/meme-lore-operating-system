import { Network } from 'lucide-react'
import { Card } from '@/components/ui'
import { SemanticGraph } from '@/graph/SemanticGraph'
import type { RendererProps } from '../types'

export function RelationshipRenderer({ universe, index }: RendererProps) {
  const linkCount = [...index.references.values()].reduce((total, refs) => total + refs.length, 0)
  return <div className="module-page"><header className="module-hero"><div><p className="eyebrow">Semantic index</p><h1>Relationships</h1><p>Every edge is derived from canonical refs and foreshadowing fields in the master file.</p></div></header><div className="graph-stats"><Card><Network size={20} /><strong>{index.entities.size}</strong><span>indexed entities</span></Card><Card><Network size={20} /><strong>{linkCount}</strong><span>cross-references</span></Card><Card><Network size={20} /><strong>{universe.modules.length}</strong><span>source modules</span></Card></div><Card className="graph-card"><SemanticGraph index={index} /></Card></div>
}
