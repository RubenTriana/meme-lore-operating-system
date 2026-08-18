import type { AnalysisSnapshot } from '@/analysis/types'
import type { AnalysisEngines, Universe, ValidationIssue } from '@/types/universe'
import type { PatchOperation, UniversePatch } from '@/services/patches'

export type ProposalStatus = 'imported' | 'invalid' | 'validated' | 'simulated' | 'approved' | 'rejected' | 'archived' | 'exported' | 'applied-to-workspace'
export type OperationReviewStatus = 'SAFE' | 'REVIEW REQUIRED' | 'REJECTED'
export type StructuralSafety = 'PASS' | 'PASS WITH WARNINGS' | 'FAIL'
export type ProposalDecisionKind = 'draft' | 'approved' | 'rejected' | 'archived'

export interface ProposalOperationReview {
  index: number
  operation: PatchOperation
  status: OperationReviewStatus
  message: string
  moduleId?: string
  entityId?: string
  before?: unknown
  after?: unknown
  noOp?: boolean
}

export interface ProposalDiffSnapshot {
  addedEntityIds: string[]
  modifiedEntityIds: string[]
  removedEntityIds: string[]
  affectedModuleIds: string[]
  fieldsAdded: number
  fieldsReplaced: number
  fieldsRemoved: number
  referencesAdded: number
  referencesRemoved: number
  titlesReplaced: number
  summariesReplaced: number
  mysteriesResolved: number
}

export interface ProposalValidation {
  valid: boolean
  structuralSafety: StructuralSafety
  jsonValid: boolean
  jsonSchemaValid: boolean
  zodValid: boolean
  referencesValid: boolean
  idsValid: boolean
  idempotence: 'ALREADY_APPLIED' | 'NOT_APPLIED' | 'CONFLICT'
  compatibilityScore: number
  compatibilityFormula: string
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  operationReviews: ProposalOperationReview[]
}

export interface ProposalMetrics {
  entities: number
  events: number
  modules: number
  canonicalLinks: number
  derivedEdges: number
  isolatedNodes?: number
  components?: number
  observations: number
  issues: number
  coverage: {
    temporal: number
    participants: number
    locations: number
    causality: number
    knowledge: number
    states: number
    analysis: number
  }
}

export interface ProposalComparison {
  base: ProposalMetrics
  candidate: ProposalMetrics
  newIssueIds: string[]
  resolvedIssueIds: string[]
  newObservationIds: string[]
  resolvedObservationIds: string[]
  compatibilityScore: number
  compatibilityEvidence: string[]
  coveragePercent: number
  missingCoverage: string[]
  foreshadowing: {
    baseSeeds: number
    candidateSeeds: number
    newSeedEntityIds: string[]
    referencedTargetIds: string[]
    unresolvedTargetIds: string[]
  }
  plausibility: 'not-applicable'
}

export interface ProposalSimulation {
  simulatedAt: string
  engines: AnalysisEngines
  baseHash: string
  candidateHash: string
  candidateUniverse: Universe
  baseSnapshot: AnalysisSnapshot
  candidateSnapshot: AnalysisSnapshot
  comparison: ProposalComparison
}

export interface ProposalDecision {
  kind: ProposalDecisionKind
  at: string
  note?: string
}

export interface ProposalRecord {
  id: string
  fileName: string
  importedAt: string
  updatedAt: string
  fileHash: string
  baseUniverseHash: string
  operations: number
  fileType: 'patch' | 'master'
  status: ProposalStatus
  patch?: UniversePatch
  master?: Universe
  validation: ProposalValidation
  decision?: ProposalDecision
  note?: string
  diff: ProposalDiffSnapshot
  simulation?: ProposalSimulation
}
