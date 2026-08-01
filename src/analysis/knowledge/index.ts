import type { ContinuityExceptionKind, KnowledgeRuleId, UniverseEntity } from '@/types/universe'
import { createAnalysisIssue, deduplicateIssues, entitiesById, eventEntities, hasStructuredException, sortedUnique, timelinePointsByEvent } from '../issue-utils'
import type { AnalysisContext, AnalysisRule, NarrativeEvidence, NarrativeIssue, TimelinePoint } from '../types'

export const KNOWLEDGE_ENGINE_VERSION = '1.0.0'

export type KnowledgeEvaluationStatus = 'issue' | 'no-issue' | 'insufficient-data'
export interface KnowledgeRuleEvaluation { ruleId: KnowledgeRuleId; status: KnowledgeEvaluationStatus; issue?: NarrativeIssue; reason?: string }
export interface KnowledgeAnalysisResult { engine: 'knowledge'; engineVersion: string; issues: NarrativeIssue[]; evaluations: KnowledgeRuleEvaluation[] }

interface KnowledgeTransition { event: UniverseEntity; characterId: string; learns: string[]; forgets: string[]; point: TimelinePoint }
interface InspectableKnowledgeRule extends AnalysisRule { id: KnowledgeRuleId; inspect(context: AnalysisContext): KnowledgeRuleEvaluation[] }

const knowledgeExceptionKinds = new Set<ContinuityExceptionKind>(['flashback', 'vision', 'time-travel', 'retrocausality', 'world-exception'])

function issueEvaluation(issue: NarrativeIssue): KnowledgeRuleEvaluation { return { ruleId: issue.ruleId as KnowledgeRuleId, status: 'issue', issue } }
function noIssue(ruleId: KnowledgeRuleId): KnowledgeRuleEvaluation { return { ruleId, status: 'no-issue' } }
function insufficient(ruleId: KnowledgeRuleId, reason: string): KnowledgeRuleEvaluation { return { ruleId, status: 'insufficient-data', reason } }

function transitionsByCharacter(context: AnalysisContext): Map<string, KnowledgeTransition[]> {
  const entities = entitiesById(context)
  const points = timelinePointsByEvent(context)
  const transitions = new Map<string, KnowledgeTransition[]>()
  context.compilation.knowledgeIndex.declarations.forEach((declaration) => {
    const event = entities.get(declaration.eventId); const point = points.get(declaration.eventId)
    if (!event || !point) return
    const records = transitions.get(declaration.characterId) ?? []
    records.push({ event, characterId: declaration.characterId, learns: declaration.learns, forgets: declaration.forgets, point })
    transitions.set(declaration.characterId, records)
  })
  transitions.forEach((records) => records.sort((left, right) => left.point.value - right.point.value || left.event.id.localeCompare(right.event.id)))
  return transitions
}

function stateBefore(transitions: KnowledgeTransition[], eventId: string, position: number, fact: string): { values: Set<string>; latestForget?: KnowledgeTransition; sameMoment: boolean } {
  const values = new Set<string>()
  let latestForget: KnowledgeTransition | undefined
  let sameMoment = false
  transitions.forEach((transition) => {
    if (transition.point.value < position) {
      transition.forgets.forEach((value) => { values.delete(value); if (value === fact) latestForget = transition })
      transition.learns.forEach((value) => { values.add(value); if (value === fact) latestForget = undefined })
    } else if (transition.point.value === position && transition.event.id !== eventId) {
      sameMoment = true
    }
  })
  return { values, latestForget, sameMoment }
}

function futureLearning(transitions: KnowledgeTransition[], eventId: string, fact: string, position: number): KnowledgeTransition | undefined {
  return transitions.find((transition) => transition.event.id !== eventId && transition.point.value > position && transition.learns.includes(fact))
}

function evidenceForKnowledge(event: UniverseEntity, characterId: string, fact: string, point: { value: number; precision: string }, state: Set<string>, introducedBy: KnowledgeTransition | undefined, uncertainty: string): NarrativeEvidence[] {
  return [
    { sourceId: event.id, field: 'analysis.requiredKnowledge', value: fact },
    { sourceId: event.id, field: 'participantRefs', value: characterId },
    { sourceId: event.id, field: 'timeline.position', value: `${point.value} (${point.precision})` },
    { sourceId: event.id, field: 'knowledge.stateBefore', value: sortedUnique(state).join(', ') || 'empty' },
    ...(introducedBy ? [{ sourceId: introducedBy.event.id, field: 'knowledgeChanges.learns', value: fact }, { sourceId: introducedBy.event.id, field: 'knowledge.introducedBy', value: introducedBy.event.id }] : []),
    { sourceId: event.id, field: 'knowledge.uncertainty', value: uncertainty },
  ]
}

function knowledgeUseEvaluations(context: AnalysisContext, ruleId: 'knowledge-used-before-learning' | 'remembered-after-forgetting' | 'revelation-received-after-acting'): KnowledgeRuleEvaluation[] {
  const entities = entitiesById(context)
  const points = timelinePointsByEvent(context)
  const transitions = transitionsByCharacter(context)
  const evaluations: KnowledgeRuleEvaluation[] = []
  let comparable = false
  eventEntities(context).forEach((event) => {
    const required = event.analysis?.requiredKnowledge ?? []
    if (!required.length) return
    const point = points.get(event.id)
    const characters = (event.participantRefs ?? []).map((id) => entities.get(id)).filter((entity): entity is UniverseEntity => entity?.type === 'character')
    if (!point || !characters.length) return
    comparable = true
    characters.forEach((character) => required.forEach((fact) => {
      if (hasStructuredException(context, ruleId, knowledgeExceptionKinds, [event, character], character.id)) return
      const history = transitions.get(character.id) ?? []
      const before = stateBefore(history, event.id, point.value, fact)
      if (before.values.has(fact) || before.sameMoment) return
      const later = futureLearning(history, event.id, fact, point.value)
      if (ruleId === 'knowledge-used-before-learning' && later) {
        evaluations.push(issueEvaluation(createAnalysisIssue(context, 'knowledge', KNOWLEDGE_ENGINE_VERSION, {
          ruleId, severity: 'high', confidence: point.precision === 'exact' && later.point.precision === 'exact' ? 1 : 0.9, title: 'Character uses knowledge before learning it', message: `${character.title} needs ${fact} in ${event.title} before the structured learning event ${later.event.title}.`, entityIds: [character.id, event.id, later.event.id], sourceIds: [character.id, event.id, later.event.id], evidence: evidenceForKnowledge(event, character.id, fact, point, before.values, later, 'Only ordered, structured knowledge changes were considered.'),
        })))
      }
      if (ruleId === 'revelation-received-after-acting' && later) {
        evaluations.push(issueEvaluation(createAnalysisIssue(context, 'knowledge', KNOWLEDGE_ENGINE_VERSION, {
          ruleId, severity: 'high', confidence: point.precision === 'exact' && later.point.precision === 'exact' ? 1 : 0.9, title: 'Revelation is received after acting on it', message: `${character.title} acts on ${fact} in ${event.title}, but the structured revelation occurs later in ${later.event.title}.`, entityIds: [character.id, event.id, later.event.id], sourceIds: [character.id, event.id, later.event.id], evidence: evidenceForKnowledge(event, character.id, fact, point, before.values, later, 'A same-time declaration is treated as ambiguous and is not reported.'),
        })))
      }
      if (ruleId === 'remembered-after-forgetting' && before.latestForget?.forgets.includes(fact) && !later) {
        evaluations.push(issueEvaluation(createAnalysisIssue(context, 'knowledge', KNOWLEDGE_ENGINE_VERSION, {
          ruleId, severity: 'high', confidence: point.precision === 'exact' && before.latestForget.point.precision === 'exact' ? 1 : 0.9, title: 'Character remembers knowledge after forgetting it', message: `${character.title} needs ${fact} in ${event.title} after forgetting it in ${before.latestForget.event.title}, without a structured relearning event.`, entityIds: [character.id, event.id, before.latestForget.event.id], sourceIds: [character.id, event.id, before.latestForget.event.id], evidence: evidenceForKnowledge(event, character.id, fact, point, before.values, before.latestForget, 'No later structured relearning event exists before this action.'),
        })))
      }
    }))
  })
  return evaluations.length ? evaluations : [comparable ? noIssue(ruleId) : insufficient(ruleId, 'Knowledge use requires an event with requiredKnowledge, character participants, and a comparable time.')]
}

const knowledgeUsedBeforeLearningRule: InspectableKnowledgeRule = {
  id: 'knowledge-used-before-learning', engine: 'knowledge', version: KNOWLEDGE_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) { return knowledgeUseEvaluations(context, 'knowledge-used-before-learning') },
}

const rememberedAfterForgettingRule: InspectableKnowledgeRule = {
  id: 'remembered-after-forgetting', engine: 'knowledge', version: KNOWLEDGE_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) { return knowledgeUseEvaluations(context, 'remembered-after-forgetting') },
}

const revelationAfterActingRule: InspectableKnowledgeRule = {
  id: 'revelation-received-after-acting', engine: 'knowledge', version: KNOWLEDGE_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) { return knowledgeUseEvaluations(context, 'revelation-received-after-acting') },
}

const missingKnowledgeCharacterRule: InspectableKnowledgeRule = {
  id: 'knowledge-attributed-to-missing-character', engine: 'knowledge', version: KNOWLEDGE_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) {
    const entities = entitiesById(context)
    const missing = eventEntities(context).flatMap((event) => (event.knowledgeChanges ?? []).filter((change) => !entities.has(change.characterRef)).map((change) => ({ event, characterId: change.characterRef })))
    return missing.length ? missing.map(({ event, characterId }) => issueEvaluation(createAnalysisIssue(context, 'knowledge', KNOWLEDGE_ENGINE_VERSION, {
      ruleId: this.id, severity: 'high', confidence: 1, title: 'Knowledge is attributed to a missing character', message: `${event.title} assigns a knowledge change to ${characterId}, but that character does not exist.`, entityIds: [event.id, characterId], sourceIds: [event.id], evidence: [{ sourceId: event.id, field: 'knowledgeChanges.characterRef', value: characterId }],
    }))) : [noIssue(this.id)]
  },
}

const ambiguousKnowledgeChangeRule: InspectableKnowledgeRule = {
  id: 'temporally-ambiguous-knowledge-change', engine: 'knowledge', version: KNOWLEDGE_ENGINE_VERSION,
  evaluate(context) { return this.inspect(context).flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : []) },
  inspect(context) {
    const declarations = context.compilation.knowledgeIndex.declarationsWithoutCalculableTime
    return declarations.length ? declarations.map((declaration) => issueEvaluation(createAnalysisIssue(context, 'knowledge', KNOWLEDGE_ENGINE_VERSION, {
      ruleId: this.id, severity: 'info', confidence: 1, title: 'Knowledge change has no comparable time', message: `The knowledge change for ${declaration.characterId} in ${declaration.eventId} cannot be placed in the cumulative timeline.`, entityIds: [declaration.eventId, declaration.characterId], sourceIds: [declaration.eventId], evidence: [{ sourceId: declaration.eventId, field: 'knowledgeChanges', value: declaration.characterId }, { sourceId: declaration.eventId, field: 'knowledge.uncertainty', value: 'The event has no calculable temporal point.' }],
    }))) : [noIssue(this.id)]
  },
}

export const knowledgeRules: readonly AnalysisRule[] = [knowledgeUsedBeforeLearningRule, rememberedAfterForgettingRule, revelationAfterActingRule, missingKnowledgeCharacterRule, ambiguousKnowledgeChangeRule]
export function inspectKnowledge(context: AnalysisContext): KnowledgeRuleEvaluation[] { return knowledgeRules.flatMap((rule) => (rule as InspectableKnowledgeRule).inspect(context)) }
export function analyzeKnowledge(context: AnalysisContext): KnowledgeAnalysisResult {
  const evaluations = inspectKnowledge(context)
  return { engine: 'knowledge', engineVersion: KNOWLEDGE_ENGINE_VERSION, issues: deduplicateIssues(evaluations.flatMap((evaluation) => evaluation.issue ? [evaluation.issue] : [])), evaluations }
}
