import type { AnalysisSnapshot } from '@/analysis/types'
import type { AnalysisAnnotations } from './analysis-annotations'

export interface AnalysisDiagnosticExport {
  formatVersion: '1'
  exportedAt: string
  metadata: AnalysisSnapshot['metadata']
  issues: AnalysisSnapshot['issues']
  annotations: AnalysisAnnotations
}

export function createAnalysisDiagnosticExport(snapshot: AnalysisSnapshot, annotations: AnalysisAnnotations, exportedAt = new Date().toISOString()): AnalysisDiagnosticExport {
  const issueIds = new Set(snapshot.issues.map((issue) => issue.id))
  const includedAnnotations = Object.fromEntries(Object.entries(annotations).filter(([issueId]) => issueIds.has(issueId)).sort(([left], [right]) => left.localeCompare(right)))
  return { formatVersion: '1', exportedAt, metadata: snapshot.metadata, issues: snapshot.issues, annotations: includedAnnotations }
}

export function analysisDiagnosticBlob(snapshot: AnalysisSnapshot, annotations: AnalysisAnnotations): Blob {
  return new Blob([`${JSON.stringify(createAnalysisDiagnosticExport(snapshot, annotations), null, 2)}\n`], { type: 'application/json' })
}
