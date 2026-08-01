import { useState } from 'react'
import { HelpCircle, Network } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, Progress } from '@/components/ui'
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

export function MysteryRenderer({ module, universe, index }: RendererProps) {
  const mysteries = module.content.items ?? []
  const novels = getNovelDescriptors(universe)
  const [selection, setSelection] = useState('all')
  const visibleMysteries = filterByNovel(mysteries, selection)
  const counts = Object.fromEntries([
    ['all', mysteries.length],
    ...novels.map((novel) => [novel.id, mysteries.filter((mystery) => getEntityNovelRefs(mystery).includes(novel.id)).length] as const),
  ])

  return <div className="module-page">
    <header className="module-hero mystery-hero">
      <div><p className="eyebrow">Inteligencia de misterios · Tetralogía</p><h1>{module.title}</h1><p>{module.description}</p></div>
      <Badge tone="amber">{visibleMysteries.length} de {mysteries.length} misterios</Badge>
    </header>
    <NovelNavigator novels={novels} selected={selection} onSelect={setSelection} counts={counts} label="Misterios por novela" />
    <div className="entity-grid mystery-grid">
      {visibleMysteries.map((mystery) => {
        const connectionCount = new Set(index.references.get(mystery.id) ?? []).size
        return <Card key={mystery.id} className="entity-card mystery-card">
          <div className="card-heading"><Badge tone={statusTone(mystery.status)}>{mystery.status ?? mystery.type}</Badge><EntityDetailControl entity={mystery} index={index} /></div>
          <div className="mystery-title"><HelpCircle size={17} /><h2>{mystery.title}</h2></div>
          <p>{mystery.summary}</p>
          <NovelBadges entity={mystery} novels={novels} />
          <div className="tag-row">{mystery.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>
          {typeof mystery.development === 'number' && <div className="metric-line"><span>Desarrollo</span><strong>{mystery.development}%</strong><Progress value={mystery.development} /></div>}
          <Link className="button button-secondary mystery-connections-link" to={`/module/relationships?focus=${encodeURIComponent(mystery.id)}`} aria-label={`Mostrar ${connectionCount} conexiones de ${mystery.title}`}><Network size={14} /> Conexiones {connectionCount}</Link>
        </Card>
      })}
    </div>
  </div>
}
