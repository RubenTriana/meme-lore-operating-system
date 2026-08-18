import type { AnalysisRuleId, ContinuityExceptionKind, UniverseEntity } from '@/types/universe'
import { hashCanonical } from './derived'
import type { AnalysisContext, AnalysisEngine, NarrativeEvidence, NarrativeIssue } from './types'

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

export function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareText)
}

export function entitiesById(context: AnalysisContext): Map<string, UniverseEntity> {
  return new Map(context.normalized.entities.map(({ entity }) => [entity.id, entity]))
}

export function eventEntities(context: AnalysisContext): UniverseEntity[] {
  return context.normalized.entities.map(({ entity }) => entity).filter((entity) => entity.type === 'event').sort((left, right) => compareText(left.id, right.id))
}

export function timelinePointsByEvent(context: AnalysisContext): Map<string, NonNullable<AnalysisContext['compilation']['timelineIndex']['events'][number]['point']>> {
  return new Map(context.compilation.timelineIndex.events.flatMap((event) => event.point ? [[event.id, event.point] as const] : []))
}

export function hasStructuredException(context: AnalysisContext, ruleId: AnalysisRuleId, allowedKinds: ReadonlySet<ContinuityExceptionKind>, anchors: UniverseEntity[], subjectId?: string): boolean {
  const universeExceptions = context.normalized.entities
    .map(({ entity }) => entity)
    .flatMap((entity) => (entity.continuity?.exceptions ?? []).filter((exception) => exception.scope === 'universe'))
  return [...anchors.flatMap((entity) => entity.continuity?.exceptions ?? []), ...universeExceptions].some((exception) => {
    if (!allowedKinds.has(exception.kind)) return false
    if (exception.ruleIds?.length && !exception.ruleIds.includes(ruleId)) return false
    return !subjectId || !exception.subjectRefs?.length || exception.subjectRefs.includes(subjectId)
  })
}

export function createAnalysisIssue(
  context: AnalysisContext,
  engine: AnalysisEngine,
  engineVersion: string,
  input: Omit<NarrativeIssue, 'id' | 'engine' | 'engineVersion' | 'sourceHash' | 'entityIds' | 'sourceIds' | 'evidence'> & { entityIds: string[]; sourceIds: string[]; evidence: NarrativeEvidence[] },
): NarrativeIssue {
  const entityIds = sortedUnique(input.entityIds)
  const sourceIds = sortedUnique(input.sourceIds)
  const evidence = [...input.evidence].sort((left, right) => compareText(`${left.sourceId}\u0000${left.field ?? ''}\u0000${left.value ?? ''}`, `${right.sourceId}\u0000${right.field ?? ''}\u0000${right.value ?? ''}`))
  const suffix = hashCanonical({ engine, ruleId: input.ruleId, entityIds, sourceIds }).replace('fnv1a64-', '')
  return { ...input, id: `${engine}-${input.ruleId}-${suffix}`, engine, engineVersion, entityIds, sourceIds, evidence, sourceHash: context.sourceHash }
}

export function deduplicateIssues(issues: NarrativeIssue[]): NarrativeIssue[] {
  const byId = new Map<string, NarrativeIssue>()
  issues.forEach((issue) => {
    const existing = byId.get(issue.id)
    if (!existing || JSON.stringify(issue.evidence) < JSON.stringify(existing.evidence)) byId.set(issue.id, issue)
  })
  return [...byId.values()].sort((left, right) => compareText(left.id, right.id))
}
