import { getAnalysisCacheIdentity } from './incremental'
import type { AnalysisSnapshot, NarrativeIssue, NarrativeSeverity } from './types'
import type { Universe } from '@/types/universe'
import { annotationNeedsReview, issueDecision, type AnalysisAnnotations, type IssueDecision } from '@/services/analysis-annotations'

export interface IssueFilters {
  search: string
  severity: 'all' | NarrativeSeverity
  ruleId: 'all' | string
  decision: 'all' | IssueDecision
  review: 'all' | 'needs-review'
}

export const defaultIssueFilters: IssueFilters = {
  search: '',
  severity: 'all',
  ruleId: 'all',
  decision: 'all',
  review: 'all',
}

export function filterIssues(issues: NarrativeIssue[], annotations: AnalysisAnnotations, filters: IssueFilters): NarrativeIssue[] {
  const search = filters.search.trim().toLocaleLowerCase()
  return issues.filter((issue) => {
    const annotation = annotations[issue.id]
    const haystack = [issue.title, issue.message, issue.ruleId, ...issue.entityIds, ...issue.sourceIds, ...issue.evidence.flatMap((evidence) => [evidence.field ?? '', evidence.value ?? ''])].join(' ').toLocaleLowerCase()
    return (filters.severity === 'all' || issue.severity === filters.severity)
      && (filters.ruleId === 'all' || issue.ruleId === filters.ruleId)
      && (filters.decision === 'all' || issueDecision(annotation) === filters.decision)
      && (filters.review === 'all' || annotationNeedsReview(annotation, issue))
      && (!search || haystack.includes(search))
  })
}

export function isAnalysisSnapshotStale(snapshot: AnalysisSnapshot | undefined, universe: Universe): boolean {
  return Boolean(snapshot && snapshot.metadata.sourceHash !== getAnalysisCacheIdentity(universe).sourceHash)
}

export function issueCountBySeverity(issues: NarrativeIssue[]): Record<NarrativeSeverity, number> {
  const counts: Record<NarrativeSeverity, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 }
  issues.forEach((issue) => { counts[issue.severity] += 1 })
  return counts
}

export function issueCountByRule(issues: NarrativeIssue[]): Array<{ ruleId: string; count: number }> {
  const counts = new Map<string, number>()
  issues.forEach((issue) => counts.set(issue.ruleId, (counts.get(issue.ruleId) ?? 0) + 1))
  return [...counts.entries()].map(([ruleId, count]) => ({ ruleId, count })).sort((left, right) => left.ruleId.localeCompare(right.ruleId))
}
