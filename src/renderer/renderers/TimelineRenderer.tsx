import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Card } from '@/components/ui'
import { NovelNavigator } from '@/components/NovelNavigator'
import { Chronology } from '@/timeline/Chronology'
import { getNovelDescriptors } from '@/utils/novels'
import type { RendererProps } from '../types'

export function TimelineRenderer({ module, universe, index }: RendererProps) {
  const items = module.content.items ?? []
  const novels = getNovelDescriptors(universe)
  const [selection, setSelection] = useState('all')
  const groups = [
    { id: 'pre-saga', title: 'Prehistoria · Antes de la saga', number: 0, items: items.filter((item) => !item.novelRef) },
    ...novels.map((novel) => ({ ...novel, items: items.filter((item) => item.novelRef === novel.id) })),
  ].filter((group) => group.items.length)
  const visibleGroups = selection === 'all' ? groups : groups.filter((group) => group.id === selection)
  const counts = Object.fromEntries([['all', items.length], ...groups.map((group) => [group.id, group.items.length])])

  return (
    <div className="module-page timeline-module">
      <header className="module-hero">
        <div><p className="eyebrow">Cronología canónica · Tetralogía</p><h1>{module.title}</h1><p>{module.description}</p></div>
        <CalendarDays size={30} />
      </header>
      <NovelNavigator novels={novels} selected={selection} onSelect={setSelection} counts={counts} label="Líneas de tiempo" />
      <div className="timeline-groups">
        {visibleGroups.map((group) => (
          <section key={group.id} className="timeline-group" data-novel={group.id}>
            <header>
              <div><span>{group.number ? `NOVELA ${group.number}` : 'ANTES DE LA SAGA'}</span><h2>{group.title.replace(/^Novela\s+\d+\s+[—-]\s+/i, '')}</h2></div>
              <strong>{group.items.length} eventos</strong>
            </header>
            <Card className="timeline-card"><Chronology items={group.items} index={index} /></Card>
          </section>
        ))}
      </div>
    </div>
  )
}
