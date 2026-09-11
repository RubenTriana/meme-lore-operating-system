import progressSource from '../data/writing_progress.json'
import {
  applyWritingUnitStatuses,
  calculateWritingMetrics,
  createWritingUnitStatuses,
  cycleWritingUnitStatus,
  parseWritingUnitStatuses,
  normalizeWritingUnitWords,
  parseWritingUnitWords,
  totalWritingUnitWords,
  recordWordCount,
  NOVEL_WORD_TARGET,
  type WritingProgressData,
} from '../src/utils/writing-progress'

// Forecast tests use the two immutable Scrivener checkpoints. The live data file may
// add manual snapshots as the author writes, which must not change these fixtures.
const progress = {
  ...progressSource,
  snapshots: progressSource.snapshots.filter((snapshot) => snapshot.date <= '2026-09-08'),
} as WritingProgressData

describe('writing progress forecast', () => {
  it('keeps complete, partial and untouched units distinct', () => {
    const metrics = calculateWritingMetrics(progress)

    expect(progress.novel.totalUnits).toBe(42)
    expect(progress.novel.completeUnits).toBe(5)
    expect(progress.novel.completeUnitNumbers).toEqual([3, 4, 5, 6, 7])
    expect(progress.novel.partialUnits).toBe(3)
    expect(progress.novel.partialUnitNumbers).toEqual([1, 2, 8])
    expect(progress.novel.untouchedUnits).toBe(34)
    expect(metrics.strictRemainingUnits).toBe(37)
    expect(metrics.weightedCompletedUnits).toBe(6.5)
  })

  it('calculates the recent daily and weekly pace from verified checkpoints', () => {
    const metrics = calculateWritingMetrics(progress)

    expect(metrics.recentWords).toBe(1040)
    expect(metrics.recentDays).toBe(8)
    expect(metrics.recentDailyWords).toBe(130)
    expect(metrics.weeklyWords).toBe(910)
  })

  it('keeps the structural forecast separate from an editable editorial target', () => {
    const metrics = calculateWritingMetrics(progress, 80000)

    expect(metrics.structuralTargetWords).toBe(26195)
    expect(metrics.structuralDaysRemaining).toBe(171)
    expect(metrics.structuralWeeksRemaining).toBe(25)
    expect(metrics.editorialTargetWords).toBe(80000)
    expect(metrics.editorialDaysRemaining).toBeGreaterThan(metrics.structuralDaysRemaining ?? 0)
  })

  it('recalculates every unit-derived metric after a manual status change', () => {
    const statuses = createWritingUnitStatuses(progress)
    expect(statuses[0]).toBe('partial')
    expect(cycleWritingUnitStatus(statuses[0])).toBe('complete')

    statuses[0] = cycleWritingUnitStatus(statuses[0])
    statuses[8] = cycleWritingUnitStatus(statuses[8])
    const edited = applyWritingUnitStatuses(progress, statuses)
    const metrics = calculateWritingMetrics(edited)

    expect(edited.novel.completeUnitNumbers).toEqual([1, 3, 4, 5, 6, 7])
    expect(edited.novel.partialUnitNumbers).toEqual([2, 8, 9])
    expect(edited.novel.completeUnits).toBe(6)
    expect(edited.novel.partialUnits).toBe(3)
    expect(edited.novel.reachedUnits).toBe(9)
    expect(edited.novel.untouchedUnits).toBe(33)
    expect(metrics.strictRemainingUnits).toBe(36)
    expect(metrics.weightedCompletedUnits).toBe(7.5)
    expect(metrics.completionPercent).toBeCloseTo(17.857)
    expect(metrics.structuralTargetWords).toBe(22702)
  })

  it('rejects stored unit states that do not match the configured map', () => {
    expect(parseWritingUnitStatuses(['complete'], progress.novel.totalUnits)).toBeUndefined()
    expect(
      parseWritingUnitStatuses(
        Array.from({ length: progress.novel.totalUnits }, () => 'invalid'),
        progress.novel.totalUnits,
      ),
    ).toBeUndefined()
  })

  it('validates and totals manual word counts per unit', () => {
    const words = Array.from({ length: progress.novel.totalUnits }, () => 0)
    words[0] = 850
    words[8] = 1250

    expect(parseWritingUnitWords(words, progress.novel.totalUnits)).toEqual(words)
    expect(totalWritingUnitWords(words)).toBe(2100)
    expect(normalizeWritingUnitWords(-25)).toBe(0)
    expect(normalizeWritingUnitWords(12.9)).toBe(12)
    expect(parseWritingUnitWords(['850'], progress.novel.totalUnits)).toBeUndefined()
  })

  it('does not forecast a manuscript size before any unit is started', () => {
    const edited = applyWritingUnitStatuses(progress, Array(42).fill('untouched'))
    const metrics = calculateWritingMetrics(edited)

    expect(metrics.completionPercent).toBe(0)
    expect(metrics.strictRemainingUnits).toBe(42)
    expect(metrics.wordsPerWeightedUnit).toBeNull()
    expect(metrics.structuralTargetWords).toBeNull()
    expect(metrics.structuralWeeksRemaining).toBeNull()
    expect(metrics.structuralFinishDate).toBeNull()
    expect(metrics.latest.words).toBe(4054)
    expect(metrics.editorialRemainingWords).toBe(105946)
  })

  it('uses half a unit as the density basis when only one unit is partial', () => {
    const statuses = createWritingUnitStatuses(progress).map(() => 'untouched' as const)
    const edited = applyWritingUnitStatuses(progress, ['partial', ...statuses.slice(1)])
    const metrics = calculateWritingMetrics(edited)

    expect(metrics.weightedCompletedUnits).toBe(0.5)
    expect(metrics.wordsPerWeightedUnit).toBe(8108)
    expect(metrics.structuralTargetWords).toBe(340536)
  })

  it('reports completed goals even without a recent writing pace', () => {
    const edited = applyWritingUnitStatuses(progress, Array(42).fill('complete'))
    edited.snapshots = [progress.snapshots[1]]
    const metrics = calculateWritingMetrics(edited, 4054)

    expect(metrics.recentDailyWords).toBe(0)
    expect(metrics.completionPercent).toBe(100)
    expect(metrics.strictRemainingUnits).toBe(0)
    expect(metrics.structuralWeeksRemaining).toBe(0)
    expect(metrics.editorialWeeksRemaining).toBe(0)
  })

  it('records an absolute word count against the 110000-word goal', () => {
    const updated = recordWordCount(progress, 11000, '2026-09-10')
    const metrics = calculateWritingMetrics(updated)
    expect(metrics.editorialTargetWords).toBe(NOVEL_WORD_TARGET)
    expect(metrics.latest.words).toBe(11000)
    expect(metrics.latest.source).toBe('manual')
    expect(metrics.editorialRemainingWords).toBe(99000)
    expect(metrics.editorialCompletionPercent).toBe(10)
    expect(progress.snapshots).toHaveLength(2)
  })

  it('updates the same day without double-counting and preserves Scrivener checkpoints', () => {
    const first = recordWordCount(progress, 5000, '2026-09-08')
    const corrected = recordWordCount(first, 4800, '2026-09-08')
    const metrics = calculateWritingMetrics(corrected)
    expect(corrected.snapshots.filter((snapshot) => snapshot.source === 'manual')).toHaveLength(1)
    expect(corrected.snapshots).toContainEqual(progress.snapshots[1])
    expect(metrics.latest.words).toBe(4800)
    expect(metrics.recentDays).toBe(8)
    expect(metrics.recentWords).toBe(1786)
  })

  it('rejects invalid totals and permits exceeding the word goal', () => {
    expect(() => recordWordCount(progress, -1, '2026-09-10')).toThrow()
    expect(() => recordWordCount(progress, 1.5, '2026-09-10')).toThrow()
    expect(() => recordWordCount(progress, 0, '2026-08-01')).toThrow()
    const metrics = calculateWritingMetrics(recordWordCount(progress, 121000, '2026-09-10'))
    expect(metrics.editorialRemainingWords).toBe(0)
    expect(metrics.editorialCompletionPercent).toBeCloseTo(110)
  })
})
