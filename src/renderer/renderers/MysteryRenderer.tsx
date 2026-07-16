import { HelpCircle, Network } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, Progress } from '@/components/ui'
import { EntityDetailControl } from '@/components/EntityDetailControl'
import type { RendererProps } from '../types'

function statusTone(status?: string): 'amber' | 'green' | 'blue' | 'red' | 'neutral' {
  if (status === 'locked') return 'green'
  if (status === 'active') return 'blue'
  if (status === 'outline') return 'amber'
  return 'neutral'
}

export function MysteryRenderer({ module, index }: RendererProps) {
  const mysteries = module.content.items ?? []

  return <div className="module-page">
    <header className="module-hero mystery-hero">
      <div><p className="eyebrow">Mystery intelligence</p><h1>{module.title}</h1><p>{module.description}</p></div>
      <Badge tone="amber">{mysteries.length} open questions</Badge>
    </header>
    <div className="entity-grid mystery-grid">
      {mysteries.map((mystery) => {
        const connectionCount = new Set(index.references.get(mystery.id) ?? []).size
        return <Card key={mystery.id} className="entity-card mystery-card">
          <div className="card-heading"><Badge tone={statusTone(mystery.status)}>{mystery.status ?? mystery.type}</Badge><EntityDetailControl entity={mystery} index={index} /></div>
          <div className="mystery-title"><HelpCircle size={17} /><h2>{mystery.title}</h2></div>
          <p>{mystery.summary}</p>
          <div className="tag-row">{mystery.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>
          {typeof mystery.development === 'number' && <div className="metric-line"><span>Development</span><strong>{mystery.development}%</strong><Progress value={mystery.development} /></div>}
          <Link className="button button-secondary mystery-connections-link" to={`/module/relationships?focus=${encodeURIComponent(mystery.id)}`} aria-label={`Show ${connectionCount} connections for ${mystery.title}`}><Network size={14} /> Connections {connectionCount}</Link>
        </Card>
      })}
    </div>
  </div>
}
