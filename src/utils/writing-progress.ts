export interface WritingSnapshot {
  date: string
  words: number
  characters?: number
  label: string
  source?: 'manual' | 'scrivener'
}

export interface WritingProgressData {
  schemaVersion: string
  status: string
  novel: {
    id: string
    title: string
    totalUnits: number
    reachedUnits: number
    completeUnits: number
    completeUnitNumbers: number[]
    partialUnits: number
    partialUnitNumbers: number[]
    untouchedUnits: number
    partialWeight: number
    unitIds?: string[]
  }
  source: {
    label: string
    binderTitle: string
    verifiedAt: string
    lastContentDate: string
    includesPlanningNotes: boolean
  }
  snapshots: WritingSnapshot[]
  forecast: {
    editorialTargetWords: number
    projectStartedAt: string
    confidence: 'low' | 'medium' | 'high'
    confidenceReason: string
    weeklyReviewDay: string
    nextReviewDate: string
  }
}

export const NOVEL_WORD_TARGET = 110_000

export function recordWordCount(
  data: WritingProgressData,
  words: number,
  date: string,
): WritingProgressData {
  if (!Number.isSafeInteger(words) || words < 0 || words > 10_000_000) {
    throw new Error('Introduce un número entero de palabras igual o mayor que cero.')
  }
  const latest = [...data.snapshots].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
  if (!latest || date < latest.date)
    throw new Error('El nuevo conteo no puede ser anterior al último registro.')
  // Repeated corrections on one day update that day's total instead of adding words twice.
  return {
    ...data,
    snapshots: [
      ...data.snapshots.filter(
        (snapshot) => !(snapshot.date === date && snapshot.source === 'manual'),
      ),
      { date, words, label: 'Conteo actualizado por el autor', source: 'manual' as const },
    ].sort((a, b) => a.date.localeCompare(b.date)),
    forecast: { ...data.forecast, editorialTargetWords: NOVEL_WORD_TARGET },
  }
}

export type WritingUnitStatus = 'complete' | 'partial' | 'untouched'

const writingUnitStatuses = new Set<WritingUnitStatus>(['complete', 'partial', 'untouched'])

export function createWritingUnitStatuses(data: WritingProgressData): WritingUnitStatus[] {
  const completeUnits = new Set(data.novel.completeUnitNumbers)
  const partialUnits = new Set(data.novel.partialUnitNumbers)

  return Array.from({ length: data.novel.totalUnits }, (_, index) => {
    const unitNumber = index + 1
    if (completeUnits.has(unitNumber)) return 'complete'
    if (partialUnits.has(unitNumber)) return 'partial'
    return 'untouched'
  })
}

export function cycleWritingUnitStatus(status: WritingUnitStatus): WritingUnitStatus {
  if (status === 'untouched') return 'partial'
  if (status === 'partial') return 'complete'
  return 'untouched'
}

export function parseWritingUnitStatuses(
  value: unknown,
  totalUnits: number,
): WritingUnitStatus[] | undefined {
  if (!Array.isArray(value) || value.length !== totalUnits) return undefined
  if (!value.every((status) => writingUnitStatuses.has(status as WritingUnitStatus))) {
    return undefined
  }
  return value as WritingUnitStatus[]
}

export function parseWritingUnitWords(value: unknown, totalUnits: number): number[] | undefined {
  if (!Array.isArray(value) || value.length !== totalUnits) return undefined
  if (!value.every((words) => typeof words === 'number' && Number.isInteger(words) && words >= 0)) {
    return undefined
  }
  return value as number[]
}

export function normalizeWritingUnitWords(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function totalWritingUnitWords(words: number[]) {
  return words.reduce((total, unitWords) => total + normalizeWritingUnitWords(unitWords), 0)
}

export function applyWritingUnitStatuses(
  data: WritingProgressData,
  statuses: WritingUnitStatus[],
): WritingProgressData {
  const normalized = parseWritingUnitStatuses(statuses, data.novel.totalUnits)
  if (!normalized) throw new Error('Writing unit statuses must match the configured unit count.')

  const completeUnitNumbers = normalized.flatMap((status, index) =>
    status === 'complete' ? [index + 1] : [],
  )
  const partialUnitNumbers = normalized.flatMap((status, index) =>
    status === 'partial' ? [index + 1] : [],
  )
  const completeUnits = completeUnitNumbers.length
  const partialUnits = partialUnitNumbers.length

  return {
    ...data,
    novel: {
      ...data.novel,
      reachedUnits: completeUnits + partialUnits,
      completeUnits,
      completeUnitNumbers,
      partialUnits,
      partialUnitNumbers,
      untouchedUnits: data.novel.totalUnits - completeUnits - partialUnits,
    },
  }
}

const millisecondsPerDay = 86_400_000

function utcDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function differenceInDays(from: string, to: string) {
  return Math.max(
    1,
    Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / millisecondsPerDay),
  )
}

function addDays(value: string, days: number) {
  const date = utcDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function calculateWritingMetrics(
  data: WritingProgressData,
  editorialTargetWords = data.forecast.editorialTargetWords,
) {
  const snapshots = [...data.snapshots].sort((left, right) => left.date.localeCompare(right.date))
  const first = snapshots[0]
  const latest = snapshots.at(-1)
  const previous =
    [...snapshots].reverse().find((snapshot) => latest && snapshot.date < latest.date) ?? first
  if (!first || !latest || !previous)
    throw new Error('Writing progress requires at least one snapshot.')

  const recentDays = differenceInDays(previous.date, latest.date)
  const recentWords = Math.max(0, latest.words - previous.words)
  const recentDailyWords = recentWords / recentDays
  const overallDays = differenceInDays(data.forecast.projectStartedAt, latest.date)
  const overallDailyWords = latest.words / overallDays
  const weeklyWords = recentDailyWords * 7
  const weightedCompletedUnits =
    data.novel.completeUnits + data.novel.partialUnits * data.novel.partialWeight
  const weightedRemainingUnits = Math.max(0, data.novel.totalUnits - weightedCompletedUnits)
  const strictRemainingUnits = Math.max(0, data.novel.totalUnits - data.novel.completeUnits)
  const wordsPerWeightedUnit =
    weightedCompletedUnits > 0 ? latest.words / weightedCompletedUnits : null
  const structuralTargetWords =
    wordsPerWeightedUnit === null ? null : Math.round(wordsPerWeightedUnit * data.novel.totalUnits)
  const structuralRemainingWords =
    structuralTargetWords === null ? null : Math.max(0, structuralTargetWords - latest.words)
  const structuralDaysRemaining =
    weightedRemainingUnits === 0
      ? 0
      : structuralRemainingWords !== null && recentDailyWords > 0
        ? Math.ceil(structuralRemainingWords / recentDailyWords)
        : null
  const editorialRemainingWords = Math.max(0, editorialTargetWords - latest.words)
  const editorialDaysRemaining =
    editorialRemainingWords === 0
      ? 0
      : recentDailyWords > 0
        ? Math.ceil(editorialRemainingWords / recentDailyWords)
        : null

  return {
    first,
    previous,
    latest,
    recentDays,
    recentWords,
    recentDailyWords,
    overallDailyWords,
    weeklyWords,
    weightedCompletedUnits,
    weightedRemainingUnits,
    strictRemainingUnits,
    wordsPerWeightedUnit,
    structuralTargetWords,
    structuralRemainingWords,
    structuralDaysRemaining,
    structuralWeeksRemaining:
      structuralDaysRemaining === null ? null : Math.ceil(structuralDaysRemaining / 7),
    structuralFinishDate:
      structuralDaysRemaining === null ? null : addDays(latest.date, structuralDaysRemaining),
    editorialTargetWords,
    editorialCompletionPercent:
      editorialTargetWords > 0 ? (latest.words / editorialTargetWords) * 100 : 0,
    editorialRemainingWords,
    editorialDaysRemaining,
    editorialWeeksRemaining:
      editorialDaysRemaining === null ? null : Math.ceil(editorialDaysRemaining / 7),
    editorialFinishDate:
      editorialDaysRemaining === null ? null : addDays(latest.date, editorialDaysRemaining),
    completionPercent:
      data.novel.totalUnits > 0 ? (weightedCompletedUnits / data.novel.totalUnits) * 100 : 0,
  }
}
