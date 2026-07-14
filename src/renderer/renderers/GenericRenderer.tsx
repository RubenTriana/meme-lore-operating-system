import { Link2 } from 'lucide-react'
import { Badge, Card, Progress } from '@/components/ui'
import { DynamicIcon } from '@/components/icon'
import { EntityDetailControl } from '@/components/EntityDetailControl'
import type { RendererProps } from '../types'

function statusTone(status?: string): 'amber' | 'green' | 'blue' | 'red' | 'neutral' {
  if (status === 'locked') return 'green'
  if (status === 'active') return 'blue'
  if (status === 'outline') return 'amber'
  return 'neutral'
}

export function GenericRenderer({ module, index }: RendererProps) {
  const items = module.content.items ?? []
  return (
    <div className="module-page">
      <header className="module-hero"><div className="module-hero-icon"><DynamicIcon name={module.icon} size={22} /></div><div><p className="eyebrow">{module.type} module</p><h1>{module.title}</h1><p>{module.description ?? 'This data-driven module has no description yet.'}</p></div></header>
      <div className="entity-grid">
        {items.map((item) => <Card key={item.id} className="entity-card"><div className="card-heading"><Badge tone={statusTone(item.status)}>{item.status ?? item.type}</Badge><EntityDetailControl entity={item} index={index} /></div><h2>{item.title}</h2><p>{item.summary}</p><div className="tag-row">{item.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>{typeof item.development === 'number' && <div className="metric-line"><span>Development</span><strong>{item.development}%</strong><Progress value={item.development} /></div>}<div className="reference-line"><Link2 size={13} /> {index.references.get(item.id)?.length ?? 0} canonical links</div></Card>)}
      </div>
      {items.length === 0 && <Card className="empty-state"><DynamicIcon name={module.icon} size={25} /><h2>No canonical entries</h2><p>Add items to this module in universe_master.json. The interface will update without a new component.</p></Card>}
    </div>
  )
}
