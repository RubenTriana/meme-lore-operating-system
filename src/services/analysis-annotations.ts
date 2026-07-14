import { hashCanonical } from '@/analysis/derived'
import type { NarrativeIssue } from '@/analysis/types'

const STORAGE_KEY = 'meme-los-analysis-annotations-v1'

export type IssueDecision = 'open' | 'confirmed' | 'intentional' | 'ignored' | 'resolved'

export interface IssueAnnotation {
  issueId: string
  decision: IssueDecision
  note?: string
  evidenceHash: string
  sourceHash: string
  engineVersion: string
  updatedAt: string
}

export type AnalysisAnnotations = Record<string, IssueAnnotation>

function storage(): Storage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

export function issueEvidenceHash(issue: NarrativeIssue): string {
  return hashCanonical({
    engine: issue.engine,
    ruleId: issue.ruleId,
    entityIds: [...issue.entityIds].sort(),
    sourceIds: [...issue.sourceIds].sort(),
    evidence: [...issue.evidence].sort((left, right) => `${left.sourceId}\u0000${left.field ?? ''}\u0000${left.value ?? ''}`.localeCompare(`${right.sourceId}\u0000${right.field ?? ''}\u0000${right.value ?? ''}`)),
    sourceHash: issue.sourceHash,
    engineVersion: issue.engineVersion,
  })
}

export function readAnalysisAnnotations(target: Storage | undefined = storage()): AnalysisAnnotations {
  if (!target) return {}
  try {
    const parsed = JSON.parse(target.getItem(STORAGE_KEY) ?? '{}') as unknown
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as AnalysisAnnotations : {}
  } catch {
    return {}
  }
}

export function writeIssueAnnotation(issue: NarrativeIssue, update: Pick<IssueAnnotation, 'decision' | 'note'>, now = new Date().toISOString(), target: Storage | undefined = storage()): IssueAnnotation {
  const annotation: IssueAnnotation = {
    issueId: issue.id,
    decision: update.decision,
    ...(update.note?.trim() ? { note: update.note.trim() } : {}),
    evidenceHash: issueEvidenceHash(issue),
    sourceHash: issue.sourceHash,
    engineVersion: issue.engineVersion,
    updatedAt: now,
  }
  if (target) {
    const annotations = readAnalysisAnnotations(target)
    target.setItem(STORAGE_KEY, JSON.stringify({ ...annotations, [issue.id]: annotation }))
  }
  return annotation
}

export function annotationNeedsReview(annotation: IssueAnnotation | undefined, issue: NarrativeIssue): boolean {
  return Boolean(annotation && (
    annotation.evidenceHash !== issueEvidenceHash(issue)
    || annotation.sourceHash !== issue.sourceHash
    || annotation.engineVersion !== issue.engineVersion
  ))
}

export function issueDecision(annotation: IssueAnnotation | undefined): IssueDecision {
  return annotation?.decision ?? 'open'
}
