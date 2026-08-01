export type EntityStatus = 'outline' | 'draft' | 'seeded' | 'active' | 'locked' | string
export type Priority = 'low' | 'medium' | 'high' | 'critical' | string
export type TemporalPrecision = 'exact' | 'day' | 'month' | 'year' | 'relative' | 'unknown'
export type StateValue = string | number | boolean
export type ContinuityRuleId = 'character-dead-acting' | 'incompatible-simultaneous-locations' | 'incompatible-age' | 'effect-before-cause'
export type CausalityRuleId = 'missing-cause-reference' | 'effect-before-cause' | 'undeclared-causal-cycle' | 'important-event-without-cause' | 'declared-cause-without-consequence' | 'broken-causal-chain'
export type KnowledgeRuleId = 'knowledge-used-before-learning' | 'remembered-after-forgetting' | 'revelation-received-after-acting' | 'knowledge-attributed-to-missing-character' | 'temporally-ambiguous-knowledge-change'
export type AnalysisRuleId = ContinuityRuleId | CausalityRuleId | KnowledgeRuleId
export type ContinuityExceptionKind = 'resurrection' | 'copy' | 'simulation' | 'flashback' | 'vision' | 'non-physical-appearance' | 'travel' | 'duplication' | 'teleportation' | 'projection' | 'prophecy' | 'time-travel' | 'retrocausality' | 'causal-loop' | 'world-exception'

export interface AnalysisEngines {
  continuity: boolean
  causality: boolean
  knowledge: boolean
  connections: boolean
  plausibility: boolean
}

export interface AnalysisConfig {
  enabled: boolean
  engines: AnalysisEngines
}

export interface EntityAnalysis {
  goals?: string[]
  fears?: string[]
  beliefs?: string[]
  constraints?: string[]
  requiredKnowledge?: string[]
}

export interface TemporalRange {
  start?: string
  end?: string
  precision?: TemporalPrecision
}

export interface KnowledgeChange {
  characterRef: string
  learns?: string[]
  forgets?: string[]
}

export interface StateChange {
  entityRef: string
  path: string
  from?: StateValue
  to: StateValue
}

export interface ContinuityLife {
  birth?: TemporalRange
  death?: TemporalRange
}

export interface AgeAssertion {
  entityRef: string
  age: number
}

export interface ContinuityException {
  kind: ContinuityExceptionKind
  ruleIds?: AnalysisRuleId[]
  subjectRefs?: string[]
  scope?: 'event' | 'universe'
}

export interface ContinuityData {
  life?: ContinuityLife
  ageAssertions?: AgeAssertion[]
  exceptions?: ContinuityException[]
}

export interface UniverseMetadata {
  title: string
  subtitle?: string
  version: string
  schemaVersion: string
  build: string
  created: string
  updated: string
  author: string
  description?: string
}

export interface UniverseEntity {
  id: string
  type: string
  title: string
  summary?: string
  alias?: string
  date?: string
  era?: string
  sequence?: number
  quality?: number
  development?: number
  importance?: number
  narrativeTime?: number
  status?: EntityStatus
  priority?: Priority
  tags?: string[]
  refs?: string[]
  foreshadowing?: string[]
  analysis?: EntityAnalysis
  temporal?: TemporalRange
  locationRefs?: string[]
  participantRefs?: string[]
  causes?: string[]
  causedByRefs?: string[]
  effects?: string[]
  novelRef?: string | null
  novelRefs?: string[]
  primaryNovelRef?: string
  sagaRef?: string
  act?: string
  plotline?: string
  beatNumber?: number
  desire?: string
  need?: string
  wound?: string
  contradiction?: string
  goal?: string
  arc?: string
  risk?: string
  irreversibleChoice?: string
  moralLimit?: string
  crueltyProfile?: {
    method?: string
    justification?: string
    counterweight?: string
    maximumAct?: string
  }
  knowledgeChanges?: KnowledgeChange[]
  stateChanges?: StateChange[]
  continuity?: ContinuityData
  [key: string]: unknown
}

export interface UniverseModule {
  id: string
  title: string
  type: string
  icon: string
  order: number
  visibility: 'navigation' | 'hidden' | 'developer'
  renderer: string
  description?: string
  content: { items?: UniverseEntity[]; [key: string]: unknown }
}

export interface ChangeLogEntry {
  id: string
  version: string
  date: string
  author: string
  changes: string[]
  modules: string[]
}

export interface Universe {
  metadata: UniverseMetadata
  analysisConfig?: AnalysisConfig
  settings?: Record<string, unknown>
  modules: UniverseModule[]
  changelog: ChangeLogEntry[]
}

export interface ValidationIssue {
  path: string
  value?: unknown
  message: string
  suggestion: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  valid: boolean
  data?: Universe
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export interface SemanticIndex {
  entities: Map<string, UniverseEntity>
  moduleByEntity: Map<string, UniverseModule>
  references: Map<string, string[]>
  backlinks: Map<string, string[]>
  tags: Map<string, string[]>
}

export interface NarrativeInsight {
  id: string
  category: 'gap' | 'orphan' | 'weak-beat' | 'contradiction' | 'foreshadowing' | 'redundancy'
  title: string
  detail: string
  score: number
  entityIds: string[]
  severity: 'high' | 'medium' | 'low'
}
