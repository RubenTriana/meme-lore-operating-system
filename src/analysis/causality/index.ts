import type { CausalityRuleId, ContinuityExceptionKind, UniverseEntity } from '@/types/universe'
import { createAnalysisIssue, deduplicateIssues, entitiesById, eventEntities, hasStructuredException, sortedUnique, timelinePointsByEvent } from '../issue-utils'
import type { AnalysisContext, AnalysisRule, NarrativeIssue } from '../types'

export const CAUSALITY_ENGINE_VERSION = '1.0.0'

export type CausalityEvaluationStatus = 'issue' | 'no-issue' | 'insufficient-data'
export interface CausalityRuleEvaluation { ruleId: CausalityRuleId; status: CausalityEvaluationStatus; issue?: NarrativeIssue; reason?: string }
export interface CausalityAnalysisResult { engine: 'causality'; engineVersion: string; issues: NarrativeIssue[]; evaluations: CausalityRuleEvaluation[] }

interface CausalRelation { cause: UniverseEntity; effect: UniverseEntity; declarations: Array<{ sourceId: string; field: 'causes' | 'effects'; value: string }> }
interface InspectableCausalityRule extends AnalysisRule { id: CausalityRuleId; inspect(context: AnalysisContext): CausalityRuleEvaluation[] }

const temporalExceptionKinds = new Set<ContinuityExceptionKind>(['prophecy', 'time-travel', 'retrocausality', 'vision', 'causal-loop', 'world-exception'])
const cycleExceptionKinds = new Set<ContinuityExceptionKind>(['causal-loop', 'time-travel', 'retrocausality', 'world-exception'])
const optionalExceptionKinds = new Set<ContinuityExceptionKind>(['world-exception'])

function issueEvaluation(issue: NarrativeIssue): CausalityRuleEvaluation { return { ruleId: issue.ruleId as CausalityRuleId, status: 'issue', issue } }
function noIssue(ruleId: CausalityRuleId): CausalityRuleEvaluation { return { ruleId, status: 'no-issue' } }
function insufficient(ruleId: CausalityRuleId, reason: string): CausalityRuleEvaluation { return { ruleId, status: 'insufficient-data', reason } }

function collectRelations(context: AnalysisContext): { relations: CausalRelation[]; missing: Array<{ source: UniverseEntity; field: 'causes' | 'effects'; referenceId: string }> } {
  const entities = entitiesById(context)
  const relations = new Map<string, CausalRelation>()
  const missing: Array<{ source: UniverseEntity; field: 'causes' | 'effects'; referenceId: string }> = []
  eventEntities(context).forEach((event) => {
    ;(event.causes ?? []).forEach((causeId) => {
      const cause = entities.get(causeId)
      if (!cause || cause.type !== 'event') { missing.push({ source: event, field: 'causes', referenceId: causeId }); return }
      const key = `${cause.id}\u0000${event.id}`
      const relation = relations.get(key) ?? { cause, effect: event, declarations: [] }
      relation.declarations.push({ sourceId: event.id, field: 'causes', value: causeId })
      relations.set(key, relation)
    })
    ;(event.effects ?? []).forEach((effectId) => {
      const effect = entities.get(effectId)
      if (!effect || effect.type !== 'event') { missing.push({ source: event, field: 'effects', referenceId: effectId }); return }
      const key = `${event.id}\u0000${effect.id}`
      const relation = relations.get(key) ?? { cause: event, effect, declarations: [] }
      relation.declarations.push({ sourceId: event.id, field: 'effects', value: effectId })
      relations.set(key, relation)
    })
  })
  return {
    relations: [...relations.values()].map((relation) => ({ ...relation, declarations: relation.declarations.sort((left, right) => left.sourceId.localeCompare(right.sourceId) || left.field.localeCompare(right.field)) })).sort((left, right) => left.cause.id.localeCompare(right.cause.id) || left.effect.id.localeCompare(right.effect.id)),
    missing: missing.sort((left, right) => left.source.id.localeCompare(right.source.id) || left.field.localeCompare(right.field) || left.referenceId.localeCompare(right.referenceId)),
  }
}

function causalCycles(relations: CausalRelation[]): string[][] {
  const adjacency = new Map<string, string[]>()
  const reverse = new Map<string, string[]>()
  relations.forEach(({ cause, effect }) => {
    const next = adjacency.get(cause.id) ?? []
    next.push(effect.id)
    adjacency.set(cause.id, sortedUnique(next))
    if (!adjacency.has(effect.id)) adjacency.set(effect.id, [])
    const previous = reverse.get(effect.id) ?? []
    previous.push(cause.id)
    reverse.set(effect.id, sortedUnique(previous))
    if (!reverse.has(cause.id)) reverse.set(cause.id, [])
  })
  const visited = new Set<string>()
  const finishOrder: string[] = []
  ;[...adjacency.keys()].sort().forEach((start) => {
    if (visited.has(start)) return
    visited.add(start)
    const stack: Array<{ node: string; index: number }> = [{ node: start, index: 0 }]
    while (stack.length) {
      const frame = stack.at(-1)!
      const next = (adjacency.get(frame.node) ?? [])[frame.index]
      if (next !== undefined) {
        frame.index += 1
        if (!visited.has(next)) { visited.add(next); stack.push({ node: next, index: 0 }) }
      } else { finishOrder.push(frame.node); stack.pop() }
    }
  })
  const assigned = new Set<string>()
  const cycles: string[][] = []
  ;[...finishOrder].reverse().forEach((start) => {
    if (assigned.has(start)) return
    const component: string[] = []
    const stack = [start]
    assigned.add(start)
    while (stack.length) {
      const node = stack.pop()!
      component.push(node)
      ;(reverse.get(node) ?? []).forEach((previous) => { if (!assigned.has(previous)) { assigned.add(previous); stack.push(previous) } })
    }
    const ordered = sortedUnique(component)
    if (ordered.length > 1 || (adjacency.get(start) ?? []).includes(start)) cycles.push(ordered)
  })
  return cycles.sort((left, right) => left.join('\u0000').localeCompare(right.join('\u0000')))
}

function exactEndPoint(event: UniverseEntity, fallback: number): number | undefined {
  if (!event.temporal?.end) return fallback
  if (event.temporal.precision !== 'exact') return undefined
  const parsed = Date.parse(event.temporal.end)
  return Number.isNaN(parsed) ? undefined : parsed
}

const missingCauseReferenceRule: InspectableCausalityRule = {
  id: 'missing-cause-reference', engine: 'causality', version: CAUSALITY_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) {
    const missing = collectRelations(context).missing
    if (!missing.length) return [noIssue(this.id)]
    return missing.map(({ source, field, referenceId }) => issueEvaluation(createAnalysisIssue(context, 'causality', CAUSALITY_ENGINE_VERSION, {
      ruleId: this.id, severity: 'high', confidence: 1, title: 'Causal reference does not resolve',
      message: `${source.title} declares ${referenceId} in ${field}, but that causal event does not exist.`, entityIds: [source.id, referenceId], sourceIds: [source.id], evidence: [{ sourceId: source.id, field, value: referenceId }],
    })))
  },
}

const effectBeforeCauseRule: InspectableCausalityRule = {
  id: 'effect-before-cause', engine: 'causality', version: CAUSALITY_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) {
    const points = timelinePointsByEvent(context)
    const relations = collectRelations(context).relations
    const evaluations: CausalityRuleEvaluation[] = []
    let comparable = false
    relations.forEach((relation) => {
      const causePoint = points.get(relation.cause.id); const effectPoint = points.get(relation.effect.id)
      if (!causePoint || !effectPoint) return
      comparable = true
      const effectEnd = exactEndPoint(relation.effect, effectPoint.value)
      if (effectEnd === undefined || causePoint.value <= effectEnd || hasStructuredException(context, this.id, temporalExceptionKinds, [relation.cause, relation.effect])) return
      evaluations.push(issueEvaluation(createAnalysisIssue(context, 'causality', CAUSALITY_ENGINE_VERSION, {
        ruleId: this.id, severity: 'high', confidence: causePoint.precision === 'exact' && effectPoint.precision === 'exact' ? 1 : 0.9, title: 'Declared cause occurs after its effect',
        message: `${relation.cause.title} is later than its declared effect ${relation.effect.title}.`, entityIds: [relation.cause.id, relation.effect.id], sourceIds: [relation.cause.id, relation.effect.id], evidence: [{ sourceId: relation.cause.id, field: 'temporal', value: `${causePoint.value} (${causePoint.precision})` }, ...relation.declarations, { sourceId: relation.effect.id, field: 'temporal', value: `${effectPoint.value} (${effectPoint.precision})` }],
      })))
    })
    return evaluations.length ? evaluations : [comparable ? noIssue(this.id) : insufficient(this.id, 'Declared causal pairs require comparable event times.')]
  },
}

const causalCycleRule: InspectableCausalityRule = {
  id: 'undeclared-causal-cycle', engine: 'causality', version: CAUSALITY_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) {
    const entities = entitiesById(context)
    const cycles = causalCycles(collectRelations(context).relations)
    if (!cycles.length) return [noIssue(this.id)]
    return cycles.flatMap((cycle) => {
      const anchors = cycle.flatMap((id) => entities.get(id) ? [entities.get(id)!] : [])
      if (hasStructuredException(context, this.id, cycleExceptionKinds, anchors)) return []
      return [issueEvaluation(createAnalysisIssue(context, 'causality', CAUSALITY_ENGINE_VERSION, {
        ruleId: this.id, severity: 'high', confidence: 1, title: 'Causal cycle is not declared intentional', message: `The causal graph closes a cycle across ${cycle.join(', ')} without a structured causal-loop exception.`, entityIds: cycle, sourceIds: cycle, evidence: cycle.map((id) => ({ sourceId: id, field: 'causes/effects', value: 'cycle member' })),
      }))]
    })
  },
}

const importantEventWithoutCauseRule: InspectableCausalityRule = {
  id: 'important-event-without-cause', engine: 'causality', version: CAUSALITY_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) {
    const relations = collectRelations(context).relations
    const inbound = new Set(relations.map((relation) => relation.effect.id))
    const candidates = eventEntities(context).filter((event) => (event.importance ?? 0) >= 80 && !inbound.has(event.id) && !(event.causes?.length) && !hasStructuredException(context, this.id, optionalExceptionKinds, [event]))
    return candidates.length ? candidates.map((event) => issueEvaluation(createAnalysisIssue(context, 'causality', CAUSALITY_ENGINE_VERSION, {
      ruleId: this.id, severity: 'low', confidence: 1, title: 'Important event has no declared cause', message: `${event.title} is marked important but has no structured causal predecessor.`, entityIds: [event.id], sourceIds: [event.id], evidence: [{ sourceId: event.id, field: 'importance', value: String(event.importance) }],
    }))) : [noIssue(this.id)]
  },
}

const declaredCauseWithoutConsequenceRule: InspectableCausalityRule = {
  id: 'declared-cause-without-consequence', engine: 'causality', version: CAUSALITY_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) {
    const relations = collectRelations(context).relations
    const outbound = new Set(relations.map((relation) => relation.cause.id))
    const candidates = eventEntities(context).filter((event) => (event.causes?.length ?? 0) > 0 && !outbound.has(event.id) && !(event.effects?.length) && !hasStructuredException(context, this.id, optionalExceptionKinds, [event]))
    return candidates.length ? candidates.map((event) => issueEvaluation(createAnalysisIssue(context, 'causality', CAUSALITY_ENGINE_VERSION, {
      ruleId: this.id, severity: 'low', confidence: 1, title: 'Declared causal step has no consequence', message: `${event.title} declares a cause but no structured effect or downstream consequence.`, entityIds: [event.id, ...(event.causes ?? [])], sourceIds: [event.id], evidence: [{ sourceId: event.id, field: 'causes', value: (event.causes ?? []).join(', ') }],
    }))) : [noIssue(this.id)]
  },
}

const brokenCausalChainRule: InspectableCausalityRule = {
  id: 'broken-causal-chain', engine: 'causality', version: CAUSALITY_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) {
    const evaluations: CausalityRuleEvaluation[] = []
    collectRelations(context).relations.forEach((relation) => {
      const causeEffects = relation.cause.effects ?? []
      const effectCauses = relation.effect.causes ?? []
      if (causeEffects.length && !causeEffects.includes(relation.effect.id) || effectCauses.length && !effectCauses.includes(relation.cause.id)) {
        evaluations.push(issueEvaluation(createAnalysisIssue(context, 'causality', CAUSALITY_ENGINE_VERSION, {
          ruleId: this.id, severity: 'medium', confidence: 1, title: 'Causal declarations disagree', message: `${relation.cause.title} and ${relation.effect.title} provide incompatible explicit links in the causal chain.`, entityIds: [relation.cause.id, relation.effect.id], sourceIds: [relation.cause.id, relation.effect.id], evidence: [{ sourceId: relation.cause.id, field: 'effects', value: causeEffects.join(', ') }, { sourceId: relation.effect.id, field: 'causes', value: effectCauses.join(', ') }],
        })))
      }
    })
    return evaluations.length ? evaluations : [noIssue(this.id)]
  },
}

export const causalityRules: readonly AnalysisRule[] = [missingCauseReferenceRule, effectBeforeCauseRule, causalCycleRule, importantEventWithoutCauseRule, declaredCauseWithoutConsequenceRule, brokenCausalChainRule]

export function inspectCausality(context: AnalysisContext): CausalityRuleEvaluation[] { return causalityRules.flatMap((rule) => (rule as InspectableCausalityRule).inspect(context)) }
export function analyzeCausality(context: AnalysisContext): CausalityAnalysisResult {
  const evaluations = inspectCausality(context)
  return { engine: 'causality', engineVersion: CAUSALITY_ENGINE_VERSION, issues: deduplicateIssues(evaluations.flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : [])), evaluations }
}
