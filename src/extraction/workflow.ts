import { validateUniverse } from '@/schemas/universe'
import { applyPatch, type PatchOperation, type UniversePatch } from '@/services/patches'
import type { Universe, UniverseEntity, ValidationIssue, ValidationResult } from '@/types/universe'
import type { ExtractionPatchResult, ExtractionProposal, PatchComparison, ProposalStatus, ProposedRelation } from './types'

type ProposalCollection = 'proposedEntities' | 'proposedEvents' | 'proposedRelations'

function workflowIssue(path: string, message: string, suggestion: string): ValidationIssue {
  return { path, message, suggestion, severity: 'error' }
}

function invalid(errors: ValidationIssue[]): ValidationResult { return { valid: false, errors, warnings: [] } }
function entities(universe: Universe): UniverseEntity[] { return universe.modules.flatMap((module) => module.content.items ?? []) }
function entityLocation(universe: Universe, id: string): { moduleId: string; entity: UniverseEntity } | undefined {
  for (const module of universe.modules) {
    const entity = module.content.items?.find((item) => item.id === id)
    if (entity) return { moduleId: module.id, entity }
  }
  return undefined
}

export function reviewProposalItem(proposal: ExtractionProposal, collection: ProposalCollection, proposalId: string, status: ProposalStatus): ExtractionProposal {
  return {
    ...proposal,
    proposedEntities: proposal.proposedEntities.map((item) => collection === 'proposedEntities' && item.proposalId === proposalId ? { ...item, status } : item),
    proposedEvents: proposal.proposedEvents.map((item) => collection === 'proposedEvents' && item.proposalId === proposalId ? { ...item, status } : item),
    proposedRelations: proposal.proposedRelations.map((item) => collection === 'proposedRelations' && item.proposalId === proposalId ? { ...item, status } : item),
  }
}

function relationOperation(universe: Universe, relation: ProposedRelation): { operation?: PatchOperation; comparison?: PatchComparison; errors: ValidationIssue[] } {
  const source = entityLocation(universe, relation.sourceRef)
  const target = entityLocation(universe, relation.targetRef)
  const errors: ValidationIssue[] = []
  if (!source) errors.push(workflowIssue(`proposal.${relation.proposalId}.sourceRef`, `La fuente ${relation.sourceRef} no existe en el resultado propuesto.`, 'Acepta una entidad fuente válida o rechaza la relación.'))
  if (!target) errors.push(workflowIssue(`proposal.${relation.proposalId}.targetRef`, `El destino ${relation.targetRef} no existe en el resultado propuesto.`, 'Acepta una entidad destino válida o rechaza la relación.'))
  if (!source || !target) return { errors }
  if ((relation.field === 'causes' || relation.field === 'effects') && (source.entity.type !== 'event' || target.entity.type !== 'event')) {
    return { errors: [workflowIssue(`proposal.${relation.proposalId}.field`, `${relation.field} solo puede conectar eventos.`, 'Usa refs para relaciones generales o selecciona eventos.') ] }
  }
  const before = Array.isArray(source.entity[relation.field]) ? [...source.entity[relation.field] as string[]] : []
  const after = [...new Set([...before, relation.targetRef])].sort()
  const path = `/modules/${source.moduleId}/content/items/${source.entity.id}/${relation.field}`
  return { operation: { op: 'replace', path, value: after }, comparison: { path, before, after }, errors }
}

export function buildExtractionPatch(universe: Universe, proposal: ExtractionProposal): ExtractionPatchResult {
  const errors: ValidationIssue[] = []
  const operations: PatchOperation[] = []
  const comparison: PatchComparison[] = []
  const knownSpanIds = new Set(proposal.sourceSpans.map((span) => span.id))
  const existingIds = new Set(entities(universe).map((entity) => entity.id))
  const proposedIds = new Set<string>()
  const acceptedItems = [
    ...proposal.proposedEntities.filter((item) => item.status === 'accepted').map((item) => ({ proposalId: item.proposalId, moduleId: item.moduleId, entity: item.entity, sourceSpanIds: item.sourceSpanIds })),
    ...proposal.proposedEvents.filter((item) => item.status === 'accepted').map((item) => ({ proposalId: item.proposalId, moduleId: item.moduleId, entity: item.event, sourceSpanIds: item.sourceSpanIds })),
  ]

  acceptedItems.forEach((item) => {
    if (!item.sourceSpanIds.length || item.sourceSpanIds.some((spanId) => !knownSpanIds.has(spanId))) errors.push(workflowIssue(`proposal.${item.proposalId}.sourceSpanIds`, 'La propuesta aceptada no tiene trazabilidad válida.', 'Conserva al menos un fragmento de fuente verificable.'))
    if (!universe.modules.some((module) => module.id === item.moduleId)) errors.push(workflowIssue(`proposal.${item.proposalId}.moduleId`, `El módulo ${item.moduleId} no existe.`, 'Selecciona un módulo canónico existente.'))
    if (existingIds.has(item.entity.id) || proposedIds.has(item.entity.id)) errors.push(workflowIssue(`proposal.${item.proposalId}.id`, `El ID ${item.entity.id} ya existe.`, 'Usa un ID nuevo o rechaza la propuesta.'))
    proposedIds.add(item.entity.id)
  })
  if (errors.length) return { patch: { operations }, validation: invalid(errors), comparison }

  acceptedItems.forEach((item) => {
    const path = `/modules/${item.moduleId}/content/items/${item.entity.id}`
    operations.push({ op: 'add', path, value: item.entity }); comparison.push({ path, after: item.entity })
  })
  let preview = applyPatch(universe, { operations })

  proposal.proposedRelations.filter((relation) => relation.status === 'accepted').forEach((relation) => {
    if (!relation.sourceSpanIds.length || relation.sourceSpanIds.some((spanId) => !knownSpanIds.has(spanId))) {
      errors.push(workflowIssue(`proposal.${relation.proposalId}.sourceSpanIds`, 'La relación aceptada no tiene trazabilidad válida.', 'Conserva al menos un fragmento de fuente verificable.'))
      return
    }
    const result = relationOperation(preview, relation)
    errors.push(...result.errors)
    if (result.operation && result.comparison) {
      operations.push(result.operation); comparison.push(result.comparison); preview = applyPatch(preview, { operations: [result.operation] })
    }
  })
  if (errors.length) return { patch: { operations }, validation: invalid(errors), comparison }

  const patch: UniversePatch = { operations }
  const finalPreview = applyPatch(universe, patch)
  return { patch, validation: validateUniverse(finalPreview), comparison }
}

export function serializeExtractionPatch(result: ExtractionPatchResult): string {
  if (!result.validation.valid) throw new Error('No se puede exportar un patch que no supera la validación canónica.')
  return JSON.stringify(result.patch, null, 2)
}
