import { analyzeCausality } from './causality'
import { analyzeConnections } from './connections'
import { analyzeContinuity } from './continuity'
import { deduplicateIssues } from './issue-utils'
import { analyzeKnowledge } from './knowledge'
import type { AnalysisContext, ConnectionsAnalysisResult, NarrativeIssue } from './types'

export interface EnabledAnalysisResult {
  issues: NarrativeIssue[]
  connections?: ConnectionsAnalysisResult
}

export function runEnabledAnalysis(context: AnalysisContext): EnabledAnalysisResult {
  const config = context.universe.analysisConfig
  if (!config?.enabled) return { issues: [] }
  const issues: NarrativeIssue[] = []
  if (config.engines.continuity) issues.push(...analyzeContinuity(context).issues)
  if (config.engines.causality) {
    const causalityIssues = analyzeCausality(context).issues
    issues.push(...(config.engines.continuity ? causalityIssues.filter((issue) => issue.ruleId !== 'effect-before-cause') : causalityIssues))
  }
  if (config.engines.knowledge) issues.push(...analyzeKnowledge(context).issues)
  const connections = config.engines.connections ? analyzeConnections(context) : undefined
  if (connections) issues.push(...connections.issues)
  return { issues: deduplicateIssues(issues), ...(connections ? { connections } : {}) }
}

export function analyzeEnabledEngines(context: AnalysisContext): NarrativeIssue[] {
  return runEnabledAnalysis(context).issues
}
