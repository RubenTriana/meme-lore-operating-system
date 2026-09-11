import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Pencil, Save, Trash2, TriangleAlert, X } from 'lucide-react'
import type { Universe, UniverseEntity } from '@/types/universe'
import type { SemanticIndex } from '@/types/universe'
import { Badge } from '@/components/ui'
import { EntityDetailControl } from '@/components/EntityDetailControl'
import { writeTextToClipboard } from '@/timeline/clipboard'
import { formatChronologyItemForClipboard } from '@/timeline/format'
import {
  applyTimelineLocalEdits,
  type TimelineUnitPatch,
  type TimelineLocalEdits,
} from '@/timeline/local-edits'
import { linkedUnitCount, timelineDraft, type TimelineChange } from './editing'
import './editing.css'

interface TimelineUnitDraft {
  title: string
  summary: string
  sequence: string
  date: string
  stage: string
  stageField: 'act' | 'era'
  plotline: string
}

function createDraft(item: UniverseEntity): TimelineUnitDraft {
  return {
    title: item.title,
    summary: item.summary ?? '',
    sequence: item.sequence === undefined ? '' : String(item.sequence),
    date: item.date ?? item.temporal?.start ?? '',
    stage: item.act ?? item.era ?? '',
    stageField: item.act !== undefined ? 'act' : 'era',
    plotline: item.plotline ?? '',
  }
}

export function Chronology({
  items,
  index,
  universe,
  onSave,
  onDelete,
  onPersist,
  localDrafts,
  readOnly = false,
}: {
  items: UniverseEntity[]
  index: SemanticIndex
  universe: Universe
  onSave: (id: string, patch: TimelineUnitPatch) => void
  onDelete: (item: UniverseEntity) => void
  onPersist?: (change: TimelineChange) => Promise<void>
  localDrafts?: TimelineLocalEdits
  readOnly?: boolean
}) {
  const [copyState, setCopyState] = useState<{ id: string; status: 'copied' | 'error' }>()
  const [savedId, setSavedId] = useState<string>()
  const [editingId, setEditingId] = useState<string>()
  const [draft, setDraft] = useState<TimelineUnitDraft>()
  const [editError, setEditError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [editVersion, setEditVersion] = useState(universe.metadata.updated)
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
      await writeTextToClipboard(formatChronologyItemForClipboard(item))
      setCopyState({ id: item.id, status: 'copied' })
    } catch {
      setCopyState({ id: item.id, status: 'error' })
    }
    feedbackTimer.current = window.setTimeout(() => setCopyState(undefined), 1800)
  }
  const beginEdit = (item: UniverseEntity) => {
    setEditingId(item.id)
    const draftItem = localDrafts
      ? applyTimelineLocalEdits([item], { ...localDrafts, deletedIds: [] })[0]
      : item
    setDraft(createDraft(draftItem))
    setEditVersion(universe.metadata.updated)
    setEditError(undefined)
  }
  const cancelEdit = () => {
    setEditingId(undefined)
    setDraft(undefined)
    setEditError(undefined)
  }
  const saveEdit = async (item: UniverseEntity) => {
    if (busy || readOnly) return
    if (!draft?.title.trim()) {
      setEditError('El título de la unidad es obligatorio.')
      return
    }
    const sequence = draft.sequence.trim() === '' ? null : Number(draft.sequence)
    if (sequence !== null && (!Number.isInteger(sequence) || sequence < 0)) {
      setEditError('El orden debe ser un número entero igual o mayor que cero.')
      return
    }
    const patch: TimelineUnitPatch = {
      title: draft.title.trim(),
      summary: draft.summary.trim() || null,
      sequence,
      date: draft.date.trim() || null,
      plotline: draft.plotline.trim() || null,
      [draft.stageField]: draft.stage.trim() || null,
    }
    setBusy(true)
    setEditError(undefined)
    try {
      if (onPersist) {
        const updated = {
          ...timelineDraft(item),
          title: patch.title ?? item.title,
          summary: patch.summary ?? '',
          sequence,
          date: patch.date ?? '',
          plotline: patch.plotline ?? '',
          [draft.stageField]: draft.stage.trim(),
        }
        await onPersist({
          action: 'edit',
          id: item.id,
          expectedUpdated: editVersion,
          draft: updated,
        })
      } else {
        await onSave(item.id, patch)
      }
      cancelEdit()
      setSavedId(item.id)
      window.clearTimeout(feedbackTimer.current)
      feedbackTimer.current = window.setTimeout(() => setSavedId(undefined), 1800)
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'No se pudo guardar la unidad.')
    } finally {
      setBusy(false)
    }
  }
  const deleteItem = async (item: UniverseEntity) => {
    if (busy || readOnly) return
    if (!onPersist) {
      onDelete(item)
      return
    }
    if (
      !window.confirm(
        `¿Eliminar “${item.title}”? Se retirarán sus enlaces desde ${linkedUnitCount(universe, item.id)} elementos y se guardará una copia de respaldo del universo.`,
      )
    )
      return
    setBusy(true)
    setEditError(undefined)
    try {
      await onPersist({ action: 'delete', id: item.id, expectedUpdated: universe.metadata.updated })
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'No se pudo eliminar la unidad.')
    } finally {
      setBusy(false)
    }
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
              <div className="timeline-item-actions">
                <button
                  className="timeline-item-edit"
                  disabled={busy || readOnly}
                  type="button"
                  onClick={() => beginEdit(item)}
                  aria-label={`Editar unidad ${item.title}`}
                  title="Editar esta unidad"
                >
                  {savedId === item.id ? <Check size={14} /> : <Pencil size={14} />}
                  <span>{savedId === item.id ? 'Guardada' : 'Editar'}</span>
                </button>
                <button
                  className={`timeline-item-copy ${copyState?.id === item.id ? copyState.status : ''}`}
                  type="button"
                  onClick={() => void copyItem(item)}
                  aria-label={`Copiar unidad ${item.title}`}
                  title="Copiar esta unidad"
                >
                  {copyState?.id === item.id ? (
                    copyState.status === 'copied' ? (
                      <Check size={14} />
                    ) : (
                      <TriangleAlert size={14} />
                    )
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
                <button
                  className="timeline-item-delete"
                  type="button"
                  disabled={busy || readOnly}
                  onClick={() => void deleteItem(item)}
                  aria-label={`Borrar unidad ${item.title}`}
                  title="Borrar esta unidad"
                >
                  <Trash2 size={14} />
                  <span>Borrar</span>
                </button>
              </div>
            </div>
            {localDrafts?.updates[item.id] && (
              <p className="timeline-draft-note">
                Borrador local pendiente: «Editar» lo recupera para revisarlo y guardarlo.
              </p>
            )}
            {localDrafts?.deletedIds.includes(item.id) && (
              <p className="timeline-draft-note">
                Borrado local pendiente: confirma «Borrar» para actualizar el universo.
              </p>
            )}
            {editError && editingId !== item.id && (
              <p role="alert" className="timeline-edit-error">
                {editError}
              </p>
            )}
            {editingId === item.id && draft ? (
              <div className="timeline-edit-form" aria-label={`Editar ${item.title}`}>
                <label className="timeline-edit-title">
                  Título
                  <input
                    value={draft.title}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  />
                </label>
                <label className="timeline-edit-summary">
                  Resumen
                  <textarea
                    value={draft.summary}
                    onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                  />
                </label>
                <div className="timeline-edit-fields">
                  <label>
                    Orden
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={draft.sequence}
                      onChange={(event) => setDraft({ ...draft, sequence: event.target.value })}
                    />
                  </label>
                  <label>
                    Posición temporal
                    <input
                      value={draft.date}
                      onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                    />
                  </label>
                  <label>
                    Acto o etapa
                    <input
                      value={draft.stage}
                      onChange={(event) => setDraft({ ...draft, stage: event.target.value })}
                    />
                  </label>
                  <label>
                    Línea narrativa
                    <input
                      value={draft.plotline}
                      onChange={(event) => setDraft({ ...draft, plotline: event.target.value })}
                    />
                  </label>
                </div>
                {editError && (
                  <p className="timeline-edit-error" role="alert">
                    {editError}
                  </p>
                )}
                <div className="timeline-edit-actions">
                  <button
                    type="button"
                    className="timeline-edit-cancel"
                    disabled={busy}
                    onClick={cancelEdit}
                  >
                    <X size={14} /> Cancelar
                  </button>
                  <button
                    type="button"
                    className="timeline-edit-save"
                    disabled={busy}
                    onClick={() => void saveEdit(item)}
                  >
                    <Save size={14} /> {busy ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3>{item.title}</h3>
                <p>{item.summary}</p>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
