import { analyzeCausality } from './causality'
import { analyzeContinuity } from './continuity'
import { deduplicateIssues } from './issue-utils'
import { analyzeKnowledge } from './knowledge'
import type { AnalysisContext, NarrativeIssue } from './types'

export function analyzeEnabledEngines(context: AnalysisContext): NarrativeIssue[] {
  const config = context.universe.analysisConfig
  if (!config?.enabled) return []
  const issues: NarrativeIssue[] = []
  if (config.engines.continuity) issues.push(...analyzeContinuity(context).issues)
  if (config.engines.causality) {
    const causalityIssues = analyzeCausality(context).issues
    issues.push(...(config.engines.continuity ? causalityIssues.filter((issue) => issue.ruleId !== 'effect-before-cause') : causalityIssues))
  }
  if (config.engines.knowledge) issues.push(...analyzeKnowledge(context).issues)
  return deduplicateIssues(issues)
}
