import type { UniverseEntity } from '@/types/universe'
import type { SemanticIndex } from '@/types/universe'
import { Badge } from '@/components/ui'
import { EntityDetailControl } from '@/components/EntityDetailControl'

export function Chronology({ items, index }: { items: UniverseEntity[]; index: SemanticIndex }) {
  const chronologic = [...items].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))
  return (
    <div className="chronology">
      {chronologic.map((item) => (
        <article className="chronology-item" key={item.id}>
          <div className="chronology-date"><span>{item.date?.slice(0, 4) ?? '—'}</span><i /></div>
          <div className="chronology-content"><div className="inline-meta"><Badge tone="blue">{item.era ?? item.type}</Badge><span>{item.date}</span><EntityDetailControl entity={item} index={index} className="timeline-detail-trigger" /></div><h3>{item.title}</h3><p>{item.summary}</p></div>
        </article>
      ))}
    </div>
  )
}
