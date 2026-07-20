import { useState } from 'react'
import { Link2 } from 'lucide-react'
import { Badge, Card, Progress } from '@/components/ui'
import { DynamicIcon } from '@/components/icon'
import { EntityDetailControl } from '@/components/EntityDetailControl'
import { NovelBadges, NovelNavigator } from '@/components/NovelNavigator'
import { filterByNovel, getEntityNovelRefs, getNovelDescriptors } from '@/utils/novels'
import type { RendererProps } from '../types'

function statusTone(status?: string): 'amber' | 'green' | 'blue' | 'red' | 'neutral' {
  if (status === 'locked') return 'green'
  if (status === 'active') return 'blue'
  if (status === 'outline') return 'amber'
  return 'neutral'
}

export function GenericRenderer({ module, universe, index }: RendererProps) {
  const items = module.content.items ?? []
  const novels = getNovelDescriptors(universe)
  const [selection, setSelection] = useState('all')
  const classifiedCount = items.filter((item) => getEntityNovelRefs(item).length).length
  const transversalCount = items.length - classifiedCount
  const visibleItems = filterByNovel(items, selection)
  const counts = Object.fromEntries([
    ['all', items.length],
    ['transversal', transversalCount],
    ...novels.map((novel) => [novel.id, items.filter((item) => getEntityNovelRefs(item).includes(novel.id)).length] as const),
  ])

  return (
    <div className="module-page">
      <header className="module-hero"><div className="module-hero-icon"><DynamicIcon name={module.icon} size={22} /></div><div><p className="eyebrow">{module.type} · canon 0.8.0</p><h1>{module.title}</h1><p>{module.description ?? 'Módulo gobernado por el canon oficial.'}</p></div></header>
      {items.length > 0 && novels.length > 0 && <NovelNavigator novels={novels} selected={selection} onSelect={setSelection} counts={counts} includeTransversal={transversalCount > 0} label={`${module.title} por novela`} />}
      <div className="entity-grid">
        {visibleItems.map((item) => (
          <Card key={item.id} className="entity-card">
            <div className="card-heading"><Badge tone={statusTone(item.status)}>{item.status ?? item.type}</Badge><EntityDetailControl entity={item} index={index} /></div>
            <h2>{item.title}</h2><p>{item.summary}</p>
            <NovelBadges entity={item} novels={novels} />
            <div className="tag-row">{item.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>
            {typeof item.development === 'number' && <div className="metric-line"><span>Desarrollo</span><strong>{item.development}%</strong><Progress value={item.development} /></div>}
            <div className="reference-line"><Link2 size={13} /> {index.references.get(item.id)?.length ?? 0} vínculos canónicos</div>
          </Card>
        ))}
      </div>
      {items.length === 0 && <Card className="empty-state"><DynamicIcon name={module.icon} size={25} /><h2>Sin entradas canónicas</h2><p>Este módulo permanece reservado para futuras expansiones.</p></Card>}
      {items.length > 0 && visibleItems.length === 0 && <Card className="empty-state"><DynamicIcon name={module.icon} size={25} /><h2>Sin elementos en esta novela</h2><p>El canon no asigna entradas de {module.title} a este volumen.</p></Card>}
    </div>
  )
}
