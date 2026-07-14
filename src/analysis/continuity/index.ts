import type { ContinuityException, ContinuityExceptionKind, ContinuityRuleId, TemporalPrecision, TemporalRange, UniverseEntity } from '@/types/universe'
import { hashCanonical } from '../derived'
import type { AnalysisContext, AnalysisRule, NarrativeEvidence, NarrativeIssue } from '../types'

export const CONTINUITY_ENGINE_VERSION = '1.1.0'

export type RuleEvaluationStatus = 'issue' | 'no-issue' | 'insufficient-data'

export interface RuleEvaluation {
  ruleId: ContinuityRuleId
  status: RuleEvaluationStatus
  issue?: NarrativeIssue
  reason?: string
}

export interface ContinuityAnalysisResult {
  engine: 'continuity'
  engineVersion: string
  issues: NarrativeIssue[]
  evaluations: RuleEvaluation[]
}

interface InspectableContinuityRule extends AnalysisRule {
  id: ContinuityRuleId
  inspect(context: AnalysisContext): RuleEvaluation[]
}

interface ComparableInterval {
  start: number
  end: number
  precision: TemporalPrecision | 'legacy'
}

interface CausalRelation {
  cause: UniverseEntity
  effect: UniverseEntity
  declarationField: 'causes' | 'effects'
}

const dayPattern = /^\d{4}-\d{2}-\d{2}$/
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/
const yearPattern = /^\d{4}$/
const exactPattern = /^\d{4}-\d{2}-\d{2}T/
const dayDuration = 24 * 60 * 60 * 1000

const actorExceptionKinds = new Set<ContinuityExceptionKind>(['resurrection', 'copy', 'simulation', 'flashback', 'vision', 'non-physical-appearance', 'world-exception'])
const locationExceptionKinds = new Set<ContinuityExceptionKind>(['travel', 'duplication', 'teleportation', 'projection', 'world-exception'])
const ageExceptionKinds = new Set<ContinuityExceptionKind>(['resurrection', 'copy', 'simulation', 'flashback', 'vision', 'non-physical-appearance', 'world-exception'])
const causalExceptionKinds = new Set<ContinuityExceptionKind>(['prophecy', 'time-travel', 'retrocausality', 'vision', 'causal-loop', 'world-exception'])

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareText)
}

function calendarDay(value: string): number | undefined {
  if (!dayPattern.test(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? timestamp : undefined
}

function inferredPrecision(value: string): TemporalPrecision | 'legacy' | undefined {
  if (exactPattern.test(value)) return 'exact'
  if (dayPattern.test(value)) return 'day'
  if (monthPattern.test(value)) return 'month'
  if (yearPattern.test(value)) return 'year'
  return undefined
}

function bounds(value: string, precision: TemporalPrecision | 'legacy'): ComparableInterval | undefined {
  if (precision === 'relative' || precision === 'unknown') return undefined
  if (precision === 'exact' || precision === 'legacy') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? undefined : { start: parsed, end: parsed, precision }
  }
  if (precision === 'day') {
    const start = calendarDay(value)
    return start === undefined ? undefined : { start, end: start + dayDuration - 1, precision }
  }
  if (precision === 'month') {
    if (!monthPattern.test(value)) return undefined
    const [year, month] = value.split('-').map(Number)
    const start = Date.UTC(year, month - 1, 1)
    return { start, end: Date.UTC(year, month, 1) - 1, precision }
  }
  if (!yearPattern.test(value)) return undefined
  const year = Number(value)
  return { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) - 1, precision }
}

function intervalFromTemporal(temporal: TemporalRange | undefined): ComparableInterval | undefined {
  if (!temporal?.start) return undefined
  const precision = temporal.precision ?? inferredPrecision(temporal.start)
  if (!precision) return undefined
  const start = bounds(temporal.start, precision)
  const end = temporal.end ? bounds(temporal.end, precision) : start
  if (!start || !end) return undefined
  return { start: start.start, end: end.end, precision }
}

function intervalForEntity(entity: UniverseEntity): ComparableInterval | undefined {
  const temporal = intervalFromTemporal(entity.temporal)
  if (temporal) return temporal
  if (!entity.date) return undefined
  const precision = inferredPrecision(entity.date) ?? 'legacy'
  return bounds(entity.date, precision)
}

function exactDeclaredInterval(entity: UniverseEntity): ComparableInterval | undefined {
  if (entity.temporal?.precision !== 'exact' || !entity.temporal.start || !entity.temporal.end) return undefined
  return intervalFromTemporal(entity.temporal)
}

function isDefinitelyAfter(left: ComparableInterval, right: ComparableInterval): boolean {
  return left.start > right.end
}

function isDefinitelyBefore(left: ComparableInterval, right: ComparableInterval): boolean {
  return left.end < right.start
}

function overlaps(left: ComparableInterval, right: ComparableInterval): boolean {
  return left.start <= right.end && right.start <= left.end
}

function temporalValue(temporal: TemporalRange | undefined): string {
  if (!temporal?.start) return 'unknown'
  return `${temporal.start}${temporal.end ? `/${temporal.end}` : ''} (${temporal.precision ?? 'inferred'})`
}

function intervalConfidence(...intervals: ComparableInterval[]): number {
  return intervals.every((interval) => interval.precision === 'exact') ? 1 : 0.9
}

function completedYears(later: number, earlier: number): number {
  const laterDate = new Date(later)
  const earlierDate = new Date(earlier)
  let years = laterDate.getUTCFullYear() - earlierDate.getUTCFullYear()
  const anniversary = Date.UTC(laterDate.getUTCFullYear(), earlierDate.getUTCMonth(), earlierDate.getUTCDate(), earlierDate.getUTCHours(), earlierDate.getUTCMinutes(), earlierDate.getUTCSeconds(), earlierDate.getUTCMilliseconds())
  if (later < anniversary) years -= 1
  return years
}

function possibleAgeRange(birth: ComparableInterval, event: ComparableInterval): { min: number; max: number } | undefined {
  if (event.end < birth.start) return undefined
  const min = Math.max(0, completedYears(event.start, birth.end))
  const max = Math.max(0, completedYears(event.end, birth.start))
  return min <= max ? { min, max } : undefined
}

function entitiesById(context: AnalysisContext): Map<string, UniverseEntity> {
  return new Map(context.normalized.entities.map(({ entity }) => [entity.id, entity]))
}

function eventEntities(context: AnalysisContext): UniverseEntity[] {
  return context.normalized.entities.map(({ entity }) => entity).filter((entity) => entity.type === 'event').sort((left, right) => compareText(left.id, right.id))
}

function exceptionMatches(exception: ContinuityException, ruleId: ContinuityRuleId, allowedKinds: Set<ContinuityExceptionKind>, subjectId?: string): boolean {
  if (!allowedKinds.has(exception.kind)) return false
  if (exception.ruleIds?.length && !exception.ruleIds.includes(ruleId)) return false
  return !subjectId || !exception.subjectRefs?.length || exception.subjectRefs.includes(subjectId)
}

function hasException(context: AnalysisContext, ruleId: ContinuityRuleId, allowedKinds: Set<ContinuityExceptionKind>, subjectId: string | undefined, anchors: UniverseEntity[]): boolean {
  const universeExceptions = context.normalized.entities
    .map(({ entity }) => entity)
    .flatMap((entity) => (entity.continuity?.exceptions ?? []).filter((exception) => exception.scope === 'universe'))
  const anchoredExceptions = anchors.flatMap((entity) => entity.continuity?.exceptions ?? [])
  return [...anchoredExceptions, ...universeExceptions].some((exception) => exceptionMatches(exception, ruleId, allowedKinds, subjectId))
}

function createIssue(
  context: AnalysisContext,
  ruleId: ContinuityRuleId,
  severity: NarrativeIssue['severity'],
  confidence: number,
  title: string,
  message: string,
  entityIds: string[],
  sourceIds: string[],
  evidence: NarrativeEvidence[],
): NarrativeIssue {
  const orderedEntityIds = sortedUnique(entityIds)
  const orderedSourceIds = sortedUnique(sourceIds)
  const orderedEvidence = [...evidence].sort((left, right) => compareText(`${left.sourceId}\u0000${left.field ?? ''}\u0000${left.value ?? ''}`, `${right.sourceId}\u0000${right.field ?? ''}\u0000${right.value ?? ''}`))
  const deterministicPart = hashCanonical({ engine: 'continuity', ruleId, entityIds: orderedEntityIds, sourceIds: orderedSourceIds }).replace('fnv1a64-', '')
  return {
    id: `continuity-${ruleId}-${deterministicPart}`,
    engine: 'continuity',
    ruleId,
    severity,
    confidence,
    title,
    message,
    entityIds: orderedEntityIds,
    sourceIds: orderedSourceIds,
    evidence: orderedEvidence,
    sourceHash: context.sourceHash,
    engineVersion: CONTINUITY_ENGINE_VERSION,
  }
}

function issueEvaluation(issue: NarrativeIssue): RuleEvaluation {
  return { ruleId: issue.ruleId as ContinuityRuleId, status: 'issue', issue }
}

function noIssue(ruleId: ContinuityRuleId): RuleEvaluation {
  return { ruleId, status: 'no-issue' }
}

function insufficient(ruleId: ContinuityRuleId, reason: string): RuleEvaluation {
  return { ruleId, status: 'insufficient-data', reason }
}

const characterDeadActingRule: InspectableContinuityRule = {
  id: 'character-dead-acting',
  engine: 'continuity',
  version: CONTINUITY_ENGINE_VERSION,
  evaluate(context) {
    return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : [])
  },
  inspect(context) {
    const evaluations: RuleEvaluation[] = []
    const events = eventEntities(context)
    let comparablePairFound = false
    let missingData = false
    context.normalized.entities
      .map(({ entity }) => entity)
      .filter((entity) => entity.type === 'character' && entity.continuity?.life?.death)
      .sort((left, right) => compareText(left.id, right.id))
      .forEach((character) => {
        const death = intervalFromTemporal(character.continuity?.life?.death)
        if (!death) {
          missingData = true
          return
        }
        events.filter((event) => event.participantRefs?.includes(character.id)).forEach((event) => {
          const eventInterval = intervalForEntity(event)
          if (!eventInterval) {
            missingData = true
            return
          }
          comparablePairFound = true
          if (!isDefinitelyAfter(eventInterval, death) || hasException(context, this.id, actorExceptionKinds, character.id, [character, event])) return
          evaluations.push(issueEvaluation(createIssue(
            context,
            this.id,
            'high',
            intervalConfidence(death, eventInterval),
            'Character acts after declared death',
            `${character.title} participates in ${event.title} after the declared death interval.`,
            [character.id, event.id],
            [character.id, event.id],
            [
              { sourceId: character.id, field: 'continuity.life.death', value: temporalValue(character.continuity?.life?.death) },
              { sourceId: event.id, field: 'participantRefs', value: character.id },
              { sourceId: event.id, field: 'temporal', value: temporalValue(event.temporal) },
            ],
          )))
        })
      })
    if (evaluations.length) return evaluations
    if (comparablePairFound) return [noIssue(this.id)]
    return [insufficient(this.id, missingData ? 'A death or participant event lacks a comparable date.' : 'No character with a declared death participates in an event.')]
  },
}

const simultaneousLocationsRule: InspectableContinuityRule = {
  id: 'incompatible-simultaneous-locations',
  engine: 'continuity',
  version: CONTINUITY_ENGINE_VERSION,
  evaluate(context) {
    return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : [])
  },
  inspect(context) {
    const presences = new Map<string, Array<{ event: UniverseEntity; locationId: string; interval: ComparableInterval }>>()
    let missingData = false
    eventEntities(context).forEach((event) => {
      const participants = event.participantRefs ?? []
      const locations = event.locationRefs ?? []
      if (!participants.length || !locations.length) return
      const interval = exactDeclaredInterval(event)
      if (!interval) {
        missingData = true
        return
      }
      participants.forEach((participantId) => {
        const records = presences.get(participantId) ?? []
        locations.forEach((locationId) => records.push({ event, locationId, interval }))
        presences.set(participantId, records)
      })
    })

    const evaluations: RuleEvaluation[] = []
    let comparablePairFound = false
    presences.forEach((records, participantId) => {
      const ordered = [...records].sort((left, right) => compareText(left.event.id, right.event.id) || compareText(left.locationId, right.locationId))
      for (let leftIndex = 0; leftIndex < ordered.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < ordered.length; rightIndex += 1) {
          const left = ordered[leftIndex]
          const right = ordered[rightIndex]
          if (left.event.id === right.event.id || left.locationId === right.locationId) continue
          comparablePairFound = true
          if (!overlaps(left.interval, right.interval) || hasException(context, this.id, locationExceptionKinds, participantId, [left.event, right.event])) continue
          evaluations.push(issueEvaluation(createIssue(
            context,
            this.id,
            'high',
            1,
            'Entity appears in incompatible simultaneous locations',
            `${participantId} is declared in ${left.locationId} and ${right.locationId} during overlapping exact intervals.`,
            [participantId, left.event.id, right.event.id, left.locationId, right.locationId],
            [participantId, left.event.id, right.event.id, left.locationId, right.locationId],
            [
              { sourceId: left.event.id, field: 'locationRefs', value: left.locationId },
              { sourceId: left.event.id, field: 'temporal', value: temporalValue(left.event.temporal) },
              { sourceId: right.event.id, field: 'locationRefs', value: right.locationId },
              { sourceId: right.event.id, field: 'temporal', value: temporalValue(right.event.temporal) },
            ],
          )))
        }
      }
    })
    if (evaluations.length) return evaluations
    if (comparablePairFound) return [noIssue(this.id)]
    return [insufficient(this.id, missingData ? 'Location appearances require explicit exact start and end intervals.' : 'No entity has two dated location appearances to compare.')]
  },
}

const incompatibleAgeRule: InspectableContinuityRule = {
  id: 'incompatible-age',
  engine: 'continuity',
  version: CONTINUITY_ENGINE_VERSION,
  evaluate(context) {
    return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : [])
  },
  inspect(context) {
    const entities = entitiesById(context)
    const evaluations: RuleEvaluation[] = []
    let comparableAssertionFound = false
    let missingData = false
    eventEntities(context).forEach((event) => {
      event.continuity?.ageAssertions?.forEach((assertion) => {
        const character = entities.get(assertion.entityRef)
        const birth = intervalFromTemporal(character?.continuity?.life?.birth)
        const eventInterval = intervalForEntity(event)
        if (!character || !birth || !eventInterval) {
          missingData = true
          return
        }
        comparableAssertionFound = true
        if (hasException(context, this.id, ageExceptionKinds, character.id, [character, event])) return
        const death = intervalFromTemporal(character.continuity?.life?.death)
        const ageRange = possibleAgeRange(birth, eventInterval)
        const afterDeath = death && isDefinitelyAfter(eventInterval, death)
        if (!ageRange || afterDeath || assertion.age < ageRange.min || assertion.age > ageRange.max) {
          const expected = ageRange ? `${ageRange.min}-${ageRange.max}` : 'no possible age'
          evaluations.push(issueEvaluation(createIssue(
            context,
            this.id,
            'high',
            intervalConfidence(birth, eventInterval, ...(death ? [death] : [])),
            'Declared age is incompatible with canonical time',
            `${character.title} is declared age ${assertion.age} in ${event.title}, while canonical time permits ${afterDeath ? 'no age after declared death' : expected}.`,
            [character.id, event.id],
            [character.id, event.id],
            [
              { sourceId: character.id, field: 'continuity.life.birth', value: temporalValue(character.continuity?.life?.birth) },
              ...(death ? [{ sourceId: character.id, field: 'continuity.life.death', value: temporalValue(character.continuity?.life?.death) }] : []),
              { sourceId: event.id, field: 'continuity.ageAssertions', value: `${character.id}:${assertion.age}` },
              { sourceId: event.id, field: 'temporal', value: temporalValue(event.temporal) },
            ],
          )))
        }
      })
    })
    if (evaluations.length) return evaluations
    if (comparableAssertionFound) return [noIssue(this.id)]
    return [insufficient(this.id, missingData ? 'An age assertion lacks a comparable birth or event date.' : 'No explicit age assertions are declared.')]
  },
}

function causalRelations(context: AnalysisContext): { relations: CausalRelation[]; missingReferences: boolean } {
  const entities = entitiesById(context)
  const relations = new Map<string, CausalRelation>()
  let missingReferences = false
  eventEntities(context).forEach((event) => {
    ;(event.causes ?? []).sort(compareText).forEach((causeId) => {
      const cause = entities.get(causeId)
      if (!cause || cause.type !== 'event') { missingReferences = true; return }
      const key = `${cause.id}\u0000${event.id}`
      relations.set(key, relations.get(key) ?? { cause, effect: event, declarationField: 'causes' })
    })
    ;(event.effects ?? []).sort(compareText).forEach((effectId) => {
      const effect = entities.get(effectId)
      if (!effect || effect.type !== 'event') { missingReferences = true; return }
      const key = `${event.id}\u0000${effect.id}`
      relations.set(key, relations.get(key) ?? { cause: event, effect, declarationField: 'effects' })
    })
  })
  return { relations: [...relations.values()].sort((left, right) => compareText(left.cause.id, right.cause.id) || compareText(left.effect.id, right.effect.id)), missingReferences }
}

const effectBeforeCauseRule: InspectableContinuityRule = {
  id: 'effect-before-cause', engine: 'continuity', version: CONTINUITY_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) {
    const { relations, missingReferences } = causalRelations(context)
    const evaluations: RuleEvaluation[] = []
    let comparableRelationFound = false
    let missingData = missingReferences
    relations.forEach((relation) => {
      const causeInterval = intervalForEntity(relation.cause); const effectInterval = intervalForEntity(relation.effect)
      if (!causeInterval || !effectInterval) { missingData = true; return }
      comparableRelationFound = true
      if (!isDefinitelyBefore(effectInterval, causeInterval) || hasException(context, this.id, causalExceptionKinds, undefined, [relation.cause, relation.effect])) return
      evaluations.push(issueEvaluation(createIssue(context, this.id, 'high', intervalConfidence(causeInterval, effectInterval), 'Declared effect occurs before its cause', `${relation.effect.title} is declared as an effect of ${relation.cause.title}, but its interval ends before the cause begins.`, [relation.cause.id, relation.effect.id], [relation.cause.id, relation.effect.id], [
        { sourceId: relation.cause.id, field: 'temporal', value: temporalValue(relation.cause.temporal) },
        { sourceId: relation.declarationField === 'causes' ? relation.effect.id : relation.cause.id, field: relation.declarationField, value: relation.declarationField === 'causes' ? relation.cause.id : relation.effect.id },
        { sourceId: relation.effect.id, field: 'temporal', value: temporalValue(relation.effect.temporal) },
      ])))
    })
    if (evaluations.length) return evaluations
    if (comparableRelationFound) return [noIssue(this.id)]
    return [insufficient(this.id, missingData ? 'A declared cause/effect pair lacks comparable event dates.' : 'No declared cause/effect pairs exist.')]
  },
}

export const continuityRules: readonly AnalysisRule[] = [characterDeadActingRule, simultaneousLocationsRule, incompatibleAgeRule, effectBeforeCauseRule]

function deduplicateIssues(issues: NarrativeIssue[]): NarrativeIssue[] {
  const byId = new Map<string, NarrativeIssue>()
  issues.forEach((issue) => {
    const current = byId.get(issue.id)
    if (!current || compareText(JSON.stringify(issue.evidence), JSON.stringify(current.evidence)) < 0) byId.set(issue.id, issue)
  })
  return [...byId.values()].sort((left, right) => compareText(left.id, right.id))
}

export function inspectContinuity(context: AnalysisContext): RuleEvaluation[] {
  return continuityRules.flatMap((rule) => (rule as InspectableContinuityRule).inspect(context))
}

export function analyzeContinuity(context: AnalysisContext): ContinuityAnalysisResult {
  const evaluations = inspectContinuity(context)
  return {
    engine: 'continuity',
    engineVersion: CONTINUITY_ENGINE_VERSION,
    issues: deduplicateIssues(evaluations.flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : [])),
    evaluations,
  }
}
