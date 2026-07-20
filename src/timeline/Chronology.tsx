import type { UniverseEntity } from '@/types/universe'
import type { SemanticIndex } from '@/types/universe'
import { Badge } from '@/components/ui'
import { EntityDetailControl } from '@/components/EntityDetailControl'

export function Chronology({ items, index }: { items: UniverseEntity[]; index: SemanticIndex }) {
  const chronologic = [...items].sort((a, b) => {
    const sequence = (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER)
    return sequence || String(a.date ?? a.temporal?.start ?? '').localeCompare(String(b.date ?? b.temporal?.start ?? '')) || a.title.localeCompare(b.title)
  })
  return (
    <div className="chronology">
      {chronologic.map((item) => (
        <article className="chronology-item" key={item.id}>
          <div className="chronology-date"><span>{item.sequence !== undefined ? String(item.sequence).padStart(4, '0') : item.date?.slice(0, 4) ?? '—'}</span><i /></div>
          <div className="chronology-content"><div className="inline-meta"><Badge tone="blue">{item.act ?? item.era ?? item.type}</Badge>{item.plotline && <span className="timeline-plotline">{item.plotline}</span>}<span>{item.date ?? item.temporal?.start}</span><EntityDetailControl entity={item} index={index} className="timeline-detail-trigger" /></div><h3>{item.title}</h3><p>{item.summary}</p></div>
        </article>
      ))}
    </div>
  )
}
