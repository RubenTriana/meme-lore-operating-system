import { useState } from 'react'
import { CheckCircle2, CircleDashed, Flag, Sparkles } from 'lucide-react'
import { useUniverseModel } from '@/app/useUniverseModel'
import type { BeatStatus } from '@/app/universe-context'
import { Badge, Card, Progress } from '@/components/ui'
import { EntityDetailControl } from '@/components/EntityDetailControl'
import { NovelBadges } from '@/components/NovelNavigator'
import { getNovelDescriptors } from '@/utils/novels'
import { canonicalModuleItems } from '@/utils/canon-policy'
import type { RendererProps } from '../types'

const STATUS_OPTIONS: Array<{ value: BeatStatus; label: string }> = [
  { value: 'outline', label: 'Outline' },
  { value: 'draft', label: 'Draft' },
  { value: 'seeded', label: 'Seeded' },
  { value: 'active', label: 'Active' },
  { value: 'locked', label: 'Locked' },
]

export function BeatRenderer({ module, universe, index }: RendererProps) {
  const { updateBeatStatus, workspaceState } = useUniverseModel()
  const [savingId, setSavingId] = useState<string>()
  const [feedback, setFeedback] = useState<
    Record<string, { tone: 'success' | 'error'; text: string }>
  >({})
  const novels = getNovelDescriptors(universe)
  const beats = canonicalModuleItems(universe, module).sort(
    (a, b) => Number(a.beatNumber ?? a.sequence ?? 0) - Number(b.beatNumber ?? b.sequence ?? 0),
  )
  const global = beats.length
    ? beats.reduce((total, beat) => total + (beat.development ?? 0), 0) / beats.length
    : 0

  const changeStatus = async (beatId: string, status: BeatStatus) => {
    setSavingId(beatId)
    setFeedback((current) => ({ ...current, [beatId]: { tone: 'success', text: 'Guardando…' } }))
    try {
      await updateBeatStatus(beatId, status)
      setFeedback((current) => ({
        ...current,
        [beatId]: { tone: 'success', text: 'Guardado en master' },
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar.'
      setFeedback((current) => ({ ...current, [beatId]: { tone: 'error', text: message } }))
    } finally {
      setSavingId(undefined)
    }
  }

  return (
    <div className="module-page">
      <header className="module-hero">
        <div>
          <p className="eyebrow">Primary narrative engine</p>
          <h1>{module.title}</h1>
          <p>{module.description}</p>
        </div>
        <div className="completion-orb">
          <strong>{Math.round(global)}%</strong>
          <span>global progress</span>
        </div>
      </header>
      <Card className="beat-summary">
        <div>
          <Sparkles size={18} />
          <span>Beat coverage</span>
          <strong>{beats.length} / 15</strong>
        </div>
        <div>
          <Flag size={18} />
          <span>Story progress</span>
          <Progress value={global} />
        </div>
        <div>
          <CircleDashed size={18} />
          <span>Missing beats</span>
          <strong>{Math.max(0, 15 - beats.length)}</strong>
        </div>
      </Card>
      <div className="beat-list">
        {beats.map((beat) => {
          const currentStatus = STATUS_OPTIONS.some((option) => option.value === beat.status)
            ? (beat.status as BeatStatus)
            : 'draft'
          const isSaving = savingId === beat.id
          return (
            <article key={beat.id} className="beat-row">
              <div className="beat-sequence">
                {beat.status === 'locked' ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <span>{String(beat.beatNumber ?? beat.sequence ?? '—').padStart(2, '0')}</span>
                )}
              </div>
              <div className="beat-copy">
                <div className="inline-meta">
                  <Badge
                    tone={
                      beat.status === 'locked'
                        ? 'green'
                        : beat.status === 'draft'
                          ? 'amber'
                          : 'blue'
                    }
                  >
                    {beat.status}
                  </Badge>
                  <span>Quality {beat.quality ?? '—'}/100</span>
                </div>
                <h2>{beat.title}</h2>
                <p>{beat.summary}</p>
                <NovelBadges entity={beat} novels={novels} />
              </div>
              <div className="beat-progress">
                <span>Development</span>
                <strong>{beat.development}%</strong>
                <Progress value={beat.development ?? 0} />
                <div className="beat-actions">
                  <label className="beat-status-editor">
                    <span>Estado</span>
                    <select
                      aria-label={`Estado de ${beat.title}`}
                      value={currentStatus}
                      disabled={isSaving || workspaceState === 'candidate'}
                      onChange={(event) =>
                        void changeStatus(beat.id, event.target.value as BeatStatus)
                      }
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <EntityDetailControl
                    entity={beat}
                    index={index}
                    universe={universe}
                    className="beat-detail-trigger"
                  />
                </div>
                {feedback[beat.id] && (
                  <span className={`beat-save-feedback ${feedback[beat.id].tone}`} role="status">
                    {feedback[beat.id].text}
                  </span>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
