import { useEffect, useRef, useState } from 'react'
import { Check, Copy, TriangleAlert } from 'lucide-react'
import type { Universe, UniverseEntity } from '@/types/universe'
import type { SemanticIndex } from '@/types/universe'
import { Badge } from '@/components/ui'
import { EntityDetailControl } from '@/components/EntityDetailControl'
import { formatChronologyItemForClipboard } from '@/timeline/format'

const narrativeFieldLabels = [
  ['intervencionPalimpsesto', 'Intervención de Palimpsesto'],
  ['cambioDramatico', 'Cambio dramático'],
  ['directrizDeProsa', 'Directriz de prosa'],
  ['decisionIrreversible', 'Decisión irreversible dentro del hito'],
] as const

function NarrativeUnitFields({ item }: { item: UniverseEntity }) {
  const fields = narrativeFieldLabels.flatMap(([key, label]) => {
    const value = item[key]
    return typeof value === 'string' && value.trim() ? [{ key, label, value }] : []
  })
  if (!fields.length) return null
  return (
    <dl className="timeline-narrative-fields">
      {fields.map((field) => (
        <div key={field.key}>
          <dt>{field.label}</dt>
          <dd>{field.value}</dd>
        </div>
      ))}
    </dl>
  )
}

async function writeItemToClipboard(text: string) {
  const transfer = document.createElement('textarea')
  transfer.value = text
  transfer.setAttribute('readonly', '')
  transfer.style.position = 'fixed'
  transfer.style.opacity = '0'
  document.body.append(transfer)
  transfer.select()
  const copied = typeof document.execCommand === 'function' && document.execCommand('copy')
  transfer.remove()

  if (copied) return
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
  await navigator.clipboard.writeText(text)
}

export function Chronology({
  items,
  index,
  universe,
}: {
  items: UniverseEntity[]
  index: SemanticIndex
  universe: Universe
}) {
  const [copyState, setCopyState] = useState<{ id: string; status: 'copied' | 'error' }>()
  const feedbackTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(feedbackTimer.current), [])
  const chronologic = [...items].sort((a, b) => {
    const sequence =
      (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER)
    return (
      sequence ||
      String(a.date ?? a.temporal?.start ?? '').localeCompare(
        String(b.date ?? b.temporal?.start ?? ''),
      ) ||
      a.title.localeCompare(b.title)
    )
  })
  const copyItem = async (item: UniverseEntity) => {
    window.clearTimeout(feedbackTimer.current)
    try {
      await writeItemToClipboard(formatChronologyItemForClipboard(item))
      setCopyState({ id: item.id, status: 'copied' })
    } catch {
      setCopyState({ id: item.id, status: 'error' })
    }
    feedbackTimer.current = window.setTimeout(() => setCopyState(undefined), 1800)
  }
  return (
    <div className="chronology">
      {chronologic.map((item) => (
        <article className="chronology-item" key={item.id}>
          <div className="chronology-date">
            <span>
              {item.sequence !== undefined
                ? String(item.sequence).padStart(4, '0')
                : (item.date?.slice(0, 4) ?? '—')}
            </span>
            <i />
          </div>
          <div className="chronology-content">
            <div className="inline-meta">
              <Badge tone="blue">{item.act ?? item.era ?? item.type}</Badge>
              {item.plotline && <span className="timeline-plotline">{item.plotline}</span>}
              <span>{item.date ?? item.temporal?.start}</span>
              <button
                className={`timeline-item-copy ${copyState?.id === item.id ? copyState.status : ''}`}
                type="button"
                onClick={() => void copyItem(item)}
                aria-label={`Copiar unidad ${item.title}`}
                title="Copiar esta unidad"
              >
                {copyState?.id === item.id ? (
                  copyState.status === 'copied' ? <Check size={14} /> : <TriangleAlert size={14} />
                ) : (
                  <Copy size={14} />
                )}
                <span>
                  {copyState?.id === item.id
                    ? copyState.status === 'copied'
                      ? 'Copiada'
                      : 'Error'
                    : 'Copiar'}
                </span>
              </button>
              <EntityDetailControl
                entity={item}
                index={index}
                universe={universe}
                className="timeline-detail-trigger"
              />
            </div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <NarrativeUnitFields item={item} />
          </div>
        </article>
      ))}
    </div>
  )
}
