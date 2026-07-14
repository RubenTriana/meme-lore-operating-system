export type EntityStatus = 'outline' | 'draft' | 'seeded' | 'active' | 'locked' | string
export type Priority = 'low' | 'medium' | 'high' | 'critical' | string

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
