import { useContext, useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, Copy, RotateCcw, TriangleAlert } from 'lucide-react'
import { Badge, Card } from '@/components/ui'
import { NovelNavigator } from '@/components/NovelNavigator'
import { Chronology } from '@/timeline/Chronology'
import { writeTextToClipboard } from '@/timeline/clipboard'
import { formatChronologyBlockForClipboard } from '@/timeline/format'
import {
  applyTimelineLocalEdits,
  createEmptyTimelineEdits,
  deleteTimelineUnitLocally,
  hasTimelineLocalEdits,
  parseTimelineLocalEdits,
  saveTimelineUnitPatch,
  timelineLocalEditsStorageKey,
  type TimelineLocalEdits,
  type TimelineUnitPatch,
} from '@/timeline/local-edits'
import { getNovelDescriptors } from '@/utils/novels'
import { canonicalModuleItems } from '@/utils/canon-policy'
import type { RendererProps } from '../types'
import { UniverseContext } from '@/app/universe-context'
import { saveTimelineChange } from '@/services/editorial-api'
import type { TimelineChange } from '@/timeline/editing'

export function TimelineRenderer({ module, universe, index }: RendererProps) {
  const model = useContext(UniverseContext)
  const [saveNotice, setSaveNotice] = useState('')
  const storageKey = timelineLocalEditsStorageKey(universe.metadata.version)
  const [localEdits, setLocalEdits] = useState<TimelineLocalEdits>(() => {
    if (typeof localStorage === 'undefined') return createEmptyTimelineEdits()
    try {
      return (
        parseTimelineLocalEdits(JSON.parse(localStorage.getItem(storageKey) ?? 'null')) ??
        createEmptyTimelineEdits()
      )
    } catch {
      return createEmptyTimelineEdits()
    }
  })
  useEffect(() => {
    try {
      if (hasTimelineLocalEdits(localEdits)) {
        localStorage.setItem(storageKey, JSON.stringify(localEdits))
      } else {
        localStorage.removeItem(storageKey)
      }
    } catch {
      // Editing remains available for the current session when storage is unavailable.
    }
  }, [localEdits, storageKey])
  const canonicalItems = canonicalModuleItems(universe, module)
  const items = model ? canonicalItems : applyTimelineLocalEdits(canonicalItems, localEdits)
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
      await writeTextToClipboard(
        formatChronologyBlockForClipboard(title, group.number, group.items),
      )
      setCopyState({ id: group.id, status: 'copied' })
    } catch {
      setCopyState({ id: group.id, status: 'error' })
    }
    feedbackTimer.current = window.setTimeout(() => setCopyState(undefined), 1800)
  }
  const saveUnit = (id: string, patch: TimelineUnitPatch) => {
    setLocalEdits((current) => saveTimelineUnitPatch(current, id, patch))
  }
  const deleteUnit = (item: (typeof items)[number]) => {
    const confirmed = window.confirm(
      `¿Borrar “${item.title}” de esta cronología local? El canon original permanecerá intacto.`,
    )
    if (confirmed) setLocalEdits((current) => deleteTimelineUnitLocally(current, item.id))
  }
  const persistUnit = async (change: TimelineChange) => {
    if (!model || model.workspaceState !== 'base')
      throw new Error('Vuelve al universo base para guardar cambios.')
    const saved = await saveTimelineChange(change)
    model.importPayload(saved)
    setLocalEdits((current) => {
      const updates = { ...current.updates }
      delete updates[change.id]
      return { updates, deletedIds: current.deletedIds.filter((id) => id !== change.id) }
    })
    setSaveNotice(
      change.action === 'delete'
        ? 'Unidad eliminada. Universo actualizado y respaldo guardado.'
        : 'Cambios guardados en el universo.',
    )
  }
  const restoreCanonicalUnits = () => {
    const confirmed = window.confirm(
      '¿Descartar todas las ediciones y unidades borradas localmente para restaurar la cronología canónica?',
    )
    if (confirmed) setLocalEdits(createEmptyTimelineEdits())
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
      <div className="timeline-local-editing-note" role="status">
        <div>
          <strong>{model ? 'Edición del universo' : 'Edición local'}</strong>
          <span>
            {model
              ? 'Guardar cambios y borrar actualizan el JSON del proyecto. Cada operación conserva un respaldo.'
              : 'Los cambios se guardan en este navegador y no modifican el canon.'}
          </span>
        </div>
        {hasTimelineLocalEdits(localEdits) && (
          <>
            <Badge tone="amber">
              {Object.keys(localEdits.updates).length} ediciones locales ·{' '}
              {localEdits.deletedIds.length} borrados locales pendientes
            </Badge>
            <button type="button" onClick={restoreCanonicalUnits}>
              <RotateCcw size={14} />{' '}
              {model ? 'Descartar borradores locales' : 'Restaurar originales'}
            </button>
          </>
        )}
      </div>
      {saveNotice && (
        <p className="timeline-save-notice" role="status">
          {saveNotice}
        </p>
      )}
      {model?.workspaceState === 'candidate' && (
        <p>Vuelve al universo base para editar o eliminar unidades.</p>
      )}
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
              <Chronology
                items={group.items}
                index={index}
                universe={universe}
                onSave={saveUnit}
                onDelete={deleteUnit}
                onPersist={model?.workspaceState === 'base' ? persistUnit : undefined}
                readOnly={model?.workspaceState === 'candidate'}
                localDrafts={model ? localEdits : undefined}
              />
            </Card>
          </section>
        ))}
      </div>
    </div>
  )
}
