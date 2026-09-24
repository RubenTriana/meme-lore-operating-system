import { useContext, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
  CalendarClock,
  CalendarDays,
  CircleGauge,
  Clock3,
  Feather,
  Flag,
  Layers3,
  RefreshCw,
  TrendingUp,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import progressSource from '../../data/writing_progress.json'
import { Badge, Button, Card, Progress } from '@/components/ui'
import { UniverseContext } from '@/app/universe-context'
import { canonicalModuleItems } from '@/utils/canon-policy'
import { getWritingProgress, saveWordCount } from '@/services/editorial-api'
import {
  parseTimelineLocalEdits,
  timelineLocalEditsStorageKey,
} from '@/timeline/local-edits'
import {
  applyWritingUnitStatuses,
  calculateWritingMetrics,
  createWritingUnitStatuses,
  normalizeWritingUnitWords,
  parseWritingUnitWords,
  totalWritingUnitWords,
  parseWritingUnitStatuses,
  NOVEL_WORD_TARGET,
  type WritingProgressData,
  type WritingUnitStatus,
} from '@/utils/writing-progress'
import './writing-progress.css'

const initialProgressData = progressSource as WritingProgressData
const unitStatusStorageKey = `meme-lore:writing-progress:${initialProgressData.novel.id}:unit-statuses:v1`

const unitWordsStorageKey = `meme-lore:writing-progress:${initialProgressData.novel.id}:unit-words:v1`
const insertedUnitId = 'meme-n1-escena-20-ultimo-oficio-roma'
const compactNumber = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
const date = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

function formatDate(value: string | null) {
  if (!value) return 'Sin ritmo suficiente'
  return date.format(new Date(`${value}T00:00:00Z`))
}

const unitStatusLabels: Record<WritingUnitStatus, string> = {
  complete: 'completa',
  partial: 'parcial',
  untouched: 'sin iniciar',
}

function migrateLegacyUnitVector<T>(value: unknown, insertedValue: T) {
  const unitIds = initialProgressData.novel.unitIds
  const insertionIndex = unitIds?.indexOf(insertedUnitId) ?? -1
  if (
    !Array.isArray(value) ||
    insertionIndex < 0 ||
    value.length !== initialProgressData.novel.totalUnits - 1
  ) {
    return value
  }
  return [...value.slice(0, insertionIndex), insertedValue, ...value.slice(insertionIndex)]
}

function initialWritingUnitStatuses() {
  const fallback = createWritingUnitStatuses(initialProgressData)
  if (typeof localStorage === 'undefined') return fallback

  try {
    const stored = JSON.parse(localStorage.getItem(unitStatusStorageKey) ?? 'null')
    return (
      parseWritingUnitStatuses(
        migrateLegacyUnitVector(stored, 'untouched'),
        initialProgressData.novel.totalUnits,
      ) ?? fallback
    )
  } catch {
    return fallback
  }
}

function initialWritingUnitWords() {
  const fallback = Array.from({ length: initialProgressData.novel.totalUnits }, () => 0)
  if (typeof localStorage === 'undefined') return fallback

  try {
    const stored = JSON.parse(localStorage.getItem(unitWordsStorageKey) ?? 'null')
    return (
      parseWritingUnitWords(
        migrateLegacyUnitVector(stored, 0),
        initialProgressData.novel.totalUnits,
      ) ?? fallback
    )
  } catch {
    return fallback
  }
}

export function WritingProgressPage() {
  const [progressData, setProgressData] = useState(initialProgressData)
  const [revision, setRevision] = useState('')
  const [wordInput, setWordInput] = useState(
    String(initialProgressData.snapshots.at(-1)?.words ?? 0),
  )
  const [wordBusy, setWordBusy] = useState(false)
  const [wordError, setWordError] = useState('')
  const [wordNotice, setWordNotice] = useState('')
  const universeModel = useContext(UniverseContext)
  const universe = universeModel?.baseUniverse
  const [unitCells, setUnitCells] = useState(initialWritingUnitStatuses)
  const [unitWords, setUnitWords] = useState(initialWritingUnitWords)
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0)
  useEffect(() => {
    let active = true
    getWritingProgress()
      .then((saved) => {
        if (!active) return
        setProgressData(saved.progress)
        setRevision(saved.revision)
        const latest = [...saved.progress.snapshots]
          .sort((a, b) => a.date.localeCompare(b.date))
          .at(-1)
        setWordInput(String(latest?.words ?? 0))
      })
      .catch((error: unknown) => {
        if (active)
          setWordError(
            error instanceof Error ? error.message : 'No se pudo cargar el conteo guardado.',
          )
      })
    return () => {
      active = false
    }
  }, [])
  const visibleUnits = useMemo(() => {
    const sourceIds = progressData.novel.unitIds ?? unitCells.map((_, index) => String(index + 1))
    const timeline = universe?.modules.find((module) => module.id === 'timeline')
    if (universe && timeline) {
      const timelineItems = canonicalModuleItems(universe, timeline)
        .filter((item) => item.novelRef === progressData.novel.id)
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      const itemsById = new Map(timelineItems.map((item) => [item.id, item]))
      let locallyDeletedIds = new Set<string>()
      try {
        const stored = parseTimelineLocalEdits(
          JSON.parse(
            localStorage.getItem(timelineLocalEditsStorageKey(universe.metadata.version)) ??
              'null',
          ),
        )
        locallyDeletedIds = new Set(stored?.deletedIds ?? [])
      } catch {
        // Canonical deletions are still represented when browser storage is unavailable.
      }
      const knownIds = new Set(sourceIds)
      const knownUnits = sourceIds.map((id, sourceIndex) => {
        const item = itemsById.get(id)
        return {
          id,
          label: String(item?.outlineUnit ?? sourceIndex + 1),
          title: item?.title ?? '',
          sourceIndex,
          hidden:
            !item ||
            locallyDeletedIds.has(id) ||
            item.visibility === 'hidden' ||
            item.hidden === true,
        }
      })
      const additionalUnits = timelineItems
        .filter((item) => !knownIds.has(item.id))
        .map((item, index) => ({
          id: item.id,
          label: String(item.outlineUnit ?? sourceIds.length + index + 1),
          title: item.title,
          sourceIndex: -1,
          hidden:
            locallyDeletedIds.has(item.id) ||
            item.visibility === 'hidden' ||
            item.hidden === true,
        }))
      return [...knownUnits, ...additionalUnits]
    }
    return sourceIds.map((id, sourceIndex) => ({
      id,
      label: String(sourceIndex + 1),
      title: '',
      sourceIndex,
      hidden: false,
    }))
  }, [progressData.novel, unitCells, universe])
  const activeUnits = useMemo(
    () => visibleUnits.filter((unit) => !unit.hidden),
    [visibleUnits],
  )
  const hiddenUnitCount = visibleUnits.length - activeUnits.length
  const hiddenUnitsLabel =
    hiddenUnitCount === 1
      ? '1 unidad borrada u oculta'
      : `${hiddenUnitCount} unidades borradas u ocultas`
  const currentProgressData = useMemo(
    () =>
      applyWritingUnitStatuses(
        { ...progressData, novel: { ...progressData.novel, totalUnits: activeUnits.length } },
        activeUnits.map((unit) => unitCells[unit.sourceIndex] ?? 'untouched'),
      ),
    [activeUnits, progressData, unitCells],
  )
  const metrics = useMemo(
    () => calculateWritingMetrics(currentProgressData, NOVEL_WORD_TARGET),
    [currentProgressData],
  )
  const saveWords = async (event: FormEvent) => {
    event.preventDefault()
    const words = Number(wordInput)
    if (!wordInput.trim() || !Number.isSafeInteger(words) || words < 0 || words > 10_000_000) {
      setWordError('Introduce un número entero de palabras igual o mayor que cero.')
      return
    }
    if (wordBusy || !revision) return
    setWordBusy(true)
    setWordError('')
    setWordNotice('')
    try {
      const saved = await saveWordCount(words, revision)
      setProgressData(saved.progress)
      setRevision(saved.revision)
      setWordNotice('Conteo guardado. Métricas actualizadas.')
    } catch (error) {
      setWordError(error instanceof Error ? error.message : 'No se pudo guardar el conteo.')
    } finally {
      setWordBusy(false)
    }
  }
  useEffect(() => {
    try {
      localStorage.setItem(unitStatusStorageKey, JSON.stringify(unitCells))
    } catch {
      // The interface remains reactive even when browser storage is unavailable.
    }
  }, [unitCells])
  useEffect(() => {
    try {
      localStorage.setItem(unitWordsStorageKey, JSON.stringify(unitWords))
    } catch {
      // The interface remains reactive even when browser storage is unavailable.
    }
  }, [unitWords])
  const manualWordsTotal = useMemo(
    () => totalWritingUnitWords(activeUnits.map((unit) => unitWords[unit.sourceIndex] ?? 0)),
    [activeUnits, unitWords],
  )
  const selectedUnit =
    activeUnits.find((unit) => unit.sourceIndex === selectedUnitIndex) ?? activeUnits[0]
  const changeUnitWords = (index: number, value: number) => {
    const words = normalizeWritingUnitWords(value)
    setUnitWords((current) =>
      current.map((unitWordCount, currentIndex) =>
        currentIndex === index ? words : unitWordCount,
      ),
    )
    setUnitCells((current) =>
      current.map((status, currentIndex) =>
        currentIndex === index && status !== 'complete'
          ? words > 0
            ? 'partial'
            : 'untouched'
          : status,
      ),
    )
  }
  const toggleUnitCompleted = (index: number) => {
    setUnitCells((current) =>
      current.map((status, currentIndex) =>
        currentIndex === index
          ? status === 'complete'
            ? unitWords[index] > 0
              ? 'partial'
              : 'untouched'
            : 'complete'
          : status,
      ),
    )
  }
  const chartData = progressData.snapshots.map((snapshot) => ({
    ...snapshot,
    shortDate: date.format(new Date(`${snapshot.date}T00:00:00Z`)),
  }))

  return (
    <div className="writing-progress-page">
      <header className="writing-progress-hero">
        <div>
          <p className="eyebrow">Ritmo de escritura · Operación Tántalo</p>
          <h1>Progreso y pronóstico</h1>
          <p>
            Sigue el avance de tu novela con las unidades escritas, los checkpoints de Scrivener y
            tus conteos de palabras. Meta de extensión: 110.000 palabras.
          </p>
        </div>
        <div className="writing-refresh-status">
          <RefreshCw size={16} />
          <div>
            <span>Revisión semanal</span>
            <strong>{formatDate(progressData.forecast.nextReviewDate)}</strong>
          </div>
          <Badge tone="green">Activa</Badge>
        </div>
      </header>

      <section className="writing-kpi-grid" aria-label="Resumen de progreso de escritura">
        <Card>
          <div className="writing-kpi-icon amber">
            <Layers3 size={18} />
          </div>
          <span>Unidades alcanzadas</span>
          <strong>
            {currentProgressData.novel.reachedUnits}
            <small> / {currentProgressData.novel.totalUnits}</small>
          </strong>
          <p>
            {currentProgressData.novel.completeUnits} completas ·{' '}
            {currentProgressData.novel.partialUnits} parciales
          </p>
        </Card>
        <Card>
          <div className="writing-kpi-icon blue">
            <Flag size={18} />
          </div>
          <span>Unidades por cerrar</span>
          <strong>{metrics.strictRemainingUnits}</strong>
          <p>{currentProgressData.novel.untouchedUnits} aún no iniciadas</p>
        </Card>
        <Card>
          <div className="writing-kpi-icon green">
            <TrendingUp size={18} />
          </div>
          <span>Promedio diario reciente</span>
          <strong>
            {number.format(metrics.recentDailyWords)}
            <small> palabras</small>
          </strong>
          <p>
            +{number.format(metrics.recentWords)} en {metrics.recentDays} días
          </p>
        </Card>
        <Card>
          <div className="writing-kpi-icon violet">
            <CalendarDays size={18} />
          </div>
          <span>Ritmo semanal</span>
          <strong>
            {number.format(metrics.weeklyWords)}
            <small> palabras</small>
          </strong>
          <p>Promedio global: {number.format(metrics.overallDailyWords)} al día</p>
        </Card>
      </section>

      <section className="writing-main-grid">
        <Card className="forecast-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pronóstico principal</p>
              <h2>Final estructural de la escaleta</h2>
            </div>
            <Badge tone="amber">Confianza baja</Badge>
          </div>
          <div className="forecast-focus">
            <div
              className="forecast-orb"
              style={{ '--progress': `${metrics.completionPercent * 3.6}deg` } as CSSProperties}
            >
              <div>
                <strong>{decimal.format(metrics.completionPercent)}%</strong>
                <span>avance equivalente</span>
              </div>
            </div>
            <div className="forecast-copy">
              <span>Si conservas el ritmo reciente</span>
              <strong>{metrics.structuralWeeksRemaining ?? '—'} semanas</strong>
              <p>
                Final estimado:{' '}
                {metrics.weightedCompletedUnits === 0
                  ? 'Sin avance suficiente'
                  : formatDate(metrics.structuralFinishDate)}
              </p>
              <small>
                {metrics.structuralTargetWords === null || metrics.wordsPerWeightedUnit === null ? (
                  'Marca al menos una unidad como parcial o completa para calcular la proyección.'
                ) : (
                  <>
                    Proyección de {number.format(metrics.structuralTargetWords)} palabras, obtenida
                    al extender la densidad actual de {number.format(metrics.wordsPerWeightedUnit)}{' '}
                    palabras por unidad equivalente.
                  </>
                )}
              </small>
            </div>
          </div>
          <div className="forecast-progress-line">
            <span>
              {number.format(metrics.latest.words)} palabras{' '}
              {metrics.latest.source === 'manual' ? 'registradas por ti' : 'verificadas'}
            </span>
            <strong>
              {decimal.format(metrics.weightedCompletedUnits)} /{' '}
              {currentProgressData.novel.totalUnits} unidades equivalentes
            </strong>
          </div>
          <Progress value={metrics.completionPercent} />
        </Card>

        <Card className="editorial-target-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Meta de la novela</p>
              <h2>110.000 palabras</h2>
            </div>
            <CircleGauge size={19} />
          </div>
          <form className="writing-word-form" onSubmit={(event) => void saveWords(event)}>
            <label htmlFor="written-words">
              Palabras escritas
              <input
                id="written-words"
                type="number"
                min={0}
                max={10000000}
                step={1}
                required
                value={wordInput}
                disabled={wordBusy || !revision}
                onChange={(event) => {
                  setWordInput(event.target.value)
                  setWordNotice('')
                }}
              />
            </label>
            <Button type="submit" disabled={wordBusy || !revision}>
              {wordBusy ? 'Guardando…' : 'Guardar conteo'}
            </Button>
            <Button
              type="button"
              disabled={wordBusy || !revision}
              onClick={() => {
                setWordInput(String(manualWordsTotal))
                setWordNotice('')
              }}
            >
              Usar suma de unidades ({number.format(manualWordsTotal)})
            </Button>
          </form>
          {wordError && (
            <p className="writing-word-error" role="alert">
              {wordError}
            </p>
          )}
          {wordNotice && (
            <p className="writing-word-notice" role="status">
              {wordNotice}
            </p>
          )}
          <div className="writing-word-comparison" aria-live="polite">
            <strong>{decimal.format(metrics.editorialCompletionPercent)}% de la meta</strong>
            <span>
              {number.format(metrics.latest.words)} / {number.format(NOVEL_WORD_TARGET)} palabras
            </span>
            <Progress value={metrics.editorialCompletionPercent} />
          </div>
          <div className="editorial-forecast">
            <strong>{metrics.editorialWeeksRemaining ?? '—'} semanas</strong>
            <span>{formatDate(metrics.editorialFinishDate)}</span>
          </div>
          <p>
            {metrics.editorialRemainingWords > 0
              ? `Faltan ${number.format(metrics.editorialRemainingWords)} palabras para la meta.`
              : 'Meta de palabras alcanzada.'}{' '}
            El pronóstico usa el ritmo de tus conteos guardados.
          </p>
          <div className="confidence-note">
            <Clock3 size={15} />
            <span>{progressData.forecast.confidenceReason}</span>
          </div>
        </Card>
      </section>

      <section className="writing-detail-grid">
        <Card className="unit-map-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{visibleUnits.length} unidades en el mapa</p>
              <h2>Mapa de avance</h2>
            </div>
            <span className="unit-count" aria-live="polite">
              {number.format(manualWordsTotal)} palabras registradas
            </span>
          </div>
          <p className="unit-map-help">
            Selecciona una unidad para registrar sus palabras y marcarla como completada. Las
            borradas u ocultas permanecen en rojo con una X.
          </p>
          <div
            className="unit-map"
            aria-label={`${currentProgressData.novel.completeUnits} unidades completas, ${currentProgressData.novel.partialUnits} parciales y ${currentProgressData.novel.untouchedUnits} sin iniciar${hiddenUnitCount ? `, ${hiddenUnitsLabel}` : ''}`}
          >
            {visibleUnits.map((unit) => {
              const status = unitCells[unit.sourceIndex] ?? 'untouched'
              const words = unitWords[unit.sourceIndex] ?? 0
              const unitLabel = unit.hidden
                ? `Unidad ${unit.label}: borrada u oculta.`
                : `Unidad ${unit.label}: ${unitStatusLabels[status]}, ${number.format(words)} palabras. Seleccionar para editar.`
              return (
                <button
                  key={unit.id}
                  type="button"
                  className={`${unit.hidden ? 'hidden' : status} ${!unit.hidden && selectedUnit?.id === unit.id ? 'selected' : ''}`}
                  title={
                    unit.hidden
                      ? `${unit.title || `Unidad ${unit.label}`}: borrada u oculta.`
                      : `${unit.title || `Unidad ${unit.label}`}: ${unitStatusLabels[status]}, ${number.format(words)} palabras. Seleccionar para editar.`
                  }
                  aria-label={unitLabel}
                  aria-pressed={!unit.hidden && selectedUnit?.id === unit.id}
                  disabled={unit.hidden || unit.sourceIndex < 0}
                  onClick={() => setSelectedUnitIndex(unit.sourceIndex)}
                >
                  <span className="unit-map-number">{unit.label}</span>
                  {unit.hidden ? (
                    <X className="unit-hidden-mark" size={25} strokeWidth={2.4} aria-hidden="true" />
                  ) : (
                    words > 0 && <small>{compactNumber.format(words)} p</small>
                  )}
                </button>
              )
            })}
          </div>
          {selectedUnit && selectedUnit.sourceIndex >= 0 && (
            <div className="unit-editor" aria-label={`Editar unidad ${selectedUnit.label}`}>
              <div className="unit-editor-heading">
                <span>Unidad seleccionada</span>
                <strong>Unidad {selectedUnit.label}</strong>
                <small>{unitStatusLabels[unitCells[selectedUnit.sourceIndex]]}</small>
              </div>
              <label>
                Palabras escritas
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={unitWords[selectedUnit.sourceIndex]}
                  aria-label={`Palabras escritas en unidad ${selectedUnit.label}`}
                  onChange={(event) =>
                    changeUnitWords(selectedUnit.sourceIndex, Number(event.target.value) || 0)
                  }
                />
              </label>
              <label className="unit-completed-control">
                <input
                  type="checkbox"
                  checked={unitCells[selectedUnit.sourceIndex] === 'complete'}
                  aria-label={`Marcar unidad ${selectedUnit.label} como completada`}
                  onChange={() => toggleUnitCompleted(selectedUnit.sourceIndex)}
                />
                <span>Marcar unidad como completada</span>
              </label>
            </div>
          )}
          <div className="unit-legend">
            <span>
              <i className="complete" /> Completas: {currentProgressData.novel.completeUnits}
            </span>
            <span>
              <i className="partial" /> Parciales: {currentProgressData.novel.partialUnits}
            </span>
            <span>
              <i className="untouched" /> Sin iniciar: {currentProgressData.novel.untouchedUnits}
            </span>
            {hiddenUnitCount > 0 && (
              <span>
                <i className="hidden" /> {hiddenUnitsLabel}
              </span>
            )}
            <span>{number.format(manualWordsTotal)} palabras registradas</span>
          </div>
        </Card>

        <Card className="writing-history-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Historial de conteos</p>
              <h2>Crecimiento del manuscrito</h2>
            </div>
            <Feather size={19} />
          </div>
          <div className="writing-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="writingWords" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#292929" vertical={false} />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fill: '#777', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fill: '#777', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#171717',
                    border: '1px solid #333',
                    borderRadius: 9,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="words"
                  stroke="#f5aa24"
                  strokeWidth={2}
                  fill="url(#writingWords)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <Card className="writing-method-card">
        <CalendarClock size={20} />
        <div>
          <strong>Cómo se calcula</strong>
          <p>
            El ritmo compara los últimos conteos de días distintos. Las unidades parciales pesan 50%
            y sus marcas y conteos individuales se guardan en este navegador. El conteo de palabras
            se guarda en el proyecto y actualiza el historial, el porcentaje sobre 110.000 palabras
            y el pronóstico. Actualizar varias veces en un día corrige el total de ese día.
          </p>
        </div>
        <Badge tone="blue">Métrica editorial derivada</Badge>
      </Card>
    </div>
  )
}
