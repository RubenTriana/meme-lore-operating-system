import { Maximize2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { SemanticIndex, UniverseEntity } from '@/types/universe'
import { Badge } from '@/components/ui'

interface EntityDetailControlProps {
  entity: UniverseEntity
  index: SemanticIndex
  className?: string
}

const omittedKeys = new Set(['id', 'type', 'title', 'summary', 'alias', 'tags', 'refs', 'foreshadowing', 'status', 'priority', 'development', 'importance', 'narrativeTime', 'quality'])

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replaceAll('-', ' ').replace(/^./, (letter) => letter.toUpperCase())
}

function displayValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return JSON.stringify(value)
}

/** Opens canonical content as a full-viewport reader, keeping all data in the master JSON. */
export function EntityDetailControl({ entity, index, className }: EntityDetailControlProps) {
  const [open, setOpen] = useState(false)
  const fields = Object.entries(entity).filter(([key, value]) => !omittedKeys.has(key) && value !== undefined && value !== null)
  const refs = [...new Set([...(entity.refs ?? []), ...(entity.foreshadowing ?? [])])]

  useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return <><button className={`detail-trigger ${className ?? ''}`} aria-label={`Open ${entity.title} in full screen`} title="Open full-screen reader" onClick={() => setOpen(true)}><Maximize2 size={15} /><span>Detail</span></button>{open && <section className="entity-detail-screen" role="dialog" aria-modal="true" aria-label={`${entity.title} full-screen detail`}><header className="entity-detail-header"><div><p className="eyebrow">{entity.type} · {entity.id}</p><h2>{entity.title}</h2>{entity.alias && <span>{entity.alias}</span>}</div><button className="detail-close" onClick={() => setOpen(false)} aria-label="Close full-screen detail" title="Close"><X size={19} /><span>Close</span></button></header><div className="entity-detail-reader"><article><div className="detail-badges"><Badge tone={entity.status === 'locked' ? 'green' : entity.status === 'active' ? 'blue' : 'amber'}>{entity.status ?? entity.type}</Badge>{entity.priority && <Badge tone="neutral">{entity.priority}</Badge>}</div>{entity.summary && <p className="detail-summary">{entity.summary}</p>}{fields.length > 0 && <dl className="detail-fields">{fields.map(([key, value]) => <div key={key}><dt>{formatKey(key)}</dt><dd>{displayValue(value)}</dd></div>)}</dl>}{entity.tags?.length ? <section className="detail-section"><h3>Tags</h3><div className="tag-row">{entity.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></section> : null}{refs.length ? <section className="detail-section"><h3>Canonical links</h3><div className="detail-links">{refs.map((reference) => { const target = index.entities.get(reference); return <div key={reference}><strong>{target?.title ?? reference}</strong><span>{target?.type ?? 'reference'} · {reference}</span></div> })}</div></section> : null}</article></div></section>}</>
}
