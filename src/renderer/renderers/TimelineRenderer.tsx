import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, Copy, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui'
import { NovelNavigator } from '@/components/NovelNavigator'
import { Chronology } from '@/timeline/Chronology'
import { formatChronologyBlockForClipboard } from '@/timeline/format'
import { getNovelDescriptors } from '@/utils/novels'
import { canonicalModuleItems } from '@/utils/canon-policy'
import type { RendererProps } from '../types'

async function writeTimelineToClipboard(text: string) {
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

export function TimelineRenderer({ module, universe, index }: RendererProps) {
  const items = canonicalModuleItems(universe, module)
  const novels = getNovelDescriptors(universe)
  const [selection, setSelection] = useState('all')
  const [copyState, setCopyState] = useState<{ id: string; status: 'copied' | 'error' }>()
  const feedbackTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(feedbackTimer.current), [])
  const groups = [
    {
      id: 'pre-saga',
      title: 'Prehistoria · Antes de la saga',
      number: 0,
      items: items.filter((item) => !item.novelRef),
    },
    ...novels.map((novel) => ({
      ...novel,
      items: items.filter((item) => item.novelRef === novel.id),
    })),
  ]
  const visibleGroups =
    selection === 'all' ? groups : groups.filter((group) => group.id === selection)
  const counts = Object.fromEntries([
    ['all', items.length],
    ...groups.map((group) => [group.id, group.items.length]),
  ])
  const copyTimelineBlock = async (group: (typeof groups)[number]) => {
    window.clearTimeout(feedbackTimer.current)
    try {
      const title = group.title.replace(/^Novela\s+\d+\s+[—-]\s+/i, '')
      await writeTimelineToClipboard(
        formatChronologyBlockForClipboard(title, group.number, group.items),
      )
      setCopyState({ id: group.id, status: 'copied' })
    } catch {
      setCopyState({ id: group.id, status: 'error' })
    }
    feedbackTimer.current = window.setTimeout(() => setCopyState(undefined), 1800)
  }

  return (
    <div className="module-page timeline-module">
      <header className="module-hero">
        <div>
          <p className="eyebrow">Cronología canónica · Tetralogía</p>
          <h1>{module.title}</h1>
          <p>{module.description}</p>
        </div>
        <CalendarDays size={30} />
      </header>
      <NovelNavigator
        novels={novels}
        selected={selection}
        onSelect={setSelection}
        counts={counts}
        label="Líneas de tiempo"
      />
      <div className="timeline-groups">
        {visibleGroups.map((group) => (
          <section key={group.id} className="timeline-group" data-novel={group.id}>
            <header>
              <div>
                <span>{group.number ? `NOVELA ${group.number}` : 'ANTES DE LA SAGA'}</span>
                <h2>{group.title.replace(/^Novela\s+\d+\s+[—-]\s+/i, '')}</h2>
              </div>
              <div className="timeline-group-actions">
                <strong>{group.items.length} eventos</strong>
                <button
                  className={`timeline-block-copy ${copyState?.id === group.id ? copyState.status : ''}`}
                  type="button"
                  onClick={() => void copyTimelineBlock(group)}
                  aria-label={`Copiar cronología completa de ${group.title}`}
                  title="Copiar todos los hitos de este bloque"
                >
                  {copyState?.id === group.id ? (
                    copyState.status === 'copied' ? (
                      <Check size={15} />
                    ) : (
                      <TriangleAlert size={15} />
                    )
                  ) : (
                    <Copy size={15} />
                  )}
                  <span>
                    {copyState?.id === group.id
                      ? copyState.status === 'copied'
                        ? group.number
                          ? 'Novela copiada'
                          : 'Prehistoria copiada'
                        : 'No se pudo copiar'
                      : group.number
                        ? 'Copiar novela completa'
                        : 'Copiar prehistoria completa'}
                  </span>
                </button>
              </div>
            </header>
            <Card className="timeline-card">
              <Chronology items={group.items} index={index} universe={universe} />
            </Card>
          </section>
        ))}
      </div>
    </div>
  )
}
