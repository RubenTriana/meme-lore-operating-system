import type { UniverseEntity, ValidationResult } from '@/types/universe'
import type { UniversePatch } from '@/services/patches'

export type ProposalStatus = 'proposed' | 'accepted' | 'rejected'
export type ProposedRelationField = 'refs' | 'foreshadowing' | 'causes' | 'effects'

export interface NarrativeSourceFragment {
  id: string
  text: string
  selected: boolean
  sourceLabel?: string
}

export interface NarrativeSource {
  id: string
  fragments: NarrativeSourceFragment[]
}

export interface SourceSpan {
  id: string
  fragmentId: string
  start: number
  end: number
  text: string
}

interface ProposedItem {
  proposalId: string
  status: ProposalStatus
  sourceSpanIds: string[]
}

export interface ProposedEntity extends ProposedItem {
  moduleId: string
  entity: UniverseEntity
}

export interface ProposedEvent extends ProposedItem {
  moduleId: string
  event: UniverseEntity & { type: 'event' }
}

export interface ProposedRelation extends ProposedItem {
  sourceRef: string
  targetRef: string
  field: ProposedRelationField
}

export interface ExtractionProposal {
  proposedEntities: ProposedEntity[]
  proposedEvents: ProposedEvent[]
  proposedRelations: ProposedRelation[]
  warnings: string[]
  sourceSpans: SourceSpan[]
}

export interface NarrativeExtractionAdapter {
  extract(input: NarrativeSource): Promise<ExtractionProposal>
}

export interface ExtractionAdapterDescriptor {
  id: string
  label: string
  transport: 'local' | 'remote'
}

export interface RegisteredNarrativeExtractionAdapter extends NarrativeExtractionAdapter {
  descriptor: ExtractionAdapterDescriptor
}

export interface SourceDisclosure {
  selectedFragmentIds: string[]
  selectedLabels: string[]
  characterCount: number
  includesUniverse: false
  sensitiveMatches: string[]
}

export interface PatchComparison {
  path: string
  before?: unknown
  after?: unknown
}

export interface ExtractionPatchResult {
  patch: UniversePatch
  validation: ValidationResult
  comparison: PatchComparison[]
}
