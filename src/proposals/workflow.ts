import { hashCanonical } from '@/analysis/derived'
import type { AnalysisSnapshot } from '@/analysis/types'
import { applyPatch, type PatchOperation, type UniversePatch } from '@/services/patches'
import { loadUniverse } from '@/services/universe-loader'
import type { AnalysisEngines, Universe, UniverseEntity, ValidationIssue } from '@/types/universe'
import type { OperationReviewStatus, ProposalComparison, ProposalDiffSnapshot, ProposalMetrics, ProposalOperationReview, ProposalRecord, ProposalValidation } from './types'

const emptyDiff = (): ProposalDiffSnapshot => ({ addedEntityIds: [], modifiedEntityIds: [], removedEntityIds: [], affectedModuleIds: [], fieldsAdded: 0, fieldsReplaced: 0, fieldsRemoved: 0, referencesAdded: 0, referencesRemoved: 0, titlesReplaced: 0, summariesReplaced: 0, mysteriesResolved: 0 })

function issue(path: string, message: string, suggestion: string, value?: unknown): ValidationIssue {
  return { path, message, suggestion, severity: 'error', ...(value === undefined ? {} : { value }) }
}

function segments(path: string): string[] {
  return path.split('/').filter(Boolean)
}

function resolveSegment(container: unknown, segment: string): unknown {
  if (Array.isArray(container)) return container.find((item) => typeof item === 'object' && item !== null && (item as { id?: string }).id === segment) ?? container[Number(segment)]
  if (!container || typeof container !== 'object') return undefined
  return (container as Record<string, unknown>)[segment]
}

function targetAt(root: unknown, path: string): { parent?: unknown; key?: string; value?: unknown } {
  const pathSegments = segments(path)
  const key = pathSegments.pop()
  if (!key) return {}
  let parent = root
  for (const segment of pathSegments) {
    parent = resolveSegment(parent, segment)
    if (parent === undefined) return { key }
  }
  if (key === '-' && Array.isArray(parent)) return { parent, key }
  return { parent, key, value: resolveSegment(parent, key) }
}

function serializable(value: unknown): boolean {
  try { return JSON.stringify(value) !== undefined } catch { return false }
}

function same(left: unknown, right: unknown): boolean {
  return hashCanonical(left) === hashCanonical(right)
}

function containsValue(current: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) return Array.isArray(current) && same(current, expected)
  if (expected && typeof expected === 'object') {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return false
    return Object.entries(expected as Record<string, unknown>).every(([key, value]) => containsValue((current as Record<string, unknown>)[key], value))
  }
  return same(current, expected)
}

function operationIsNoOp(root: Universe, operation: PatchOperation): boolean {
  if (operation.op === 'remove') return false
  const target = targetAt(root, operation.path)
  if (Array.isArray(target.parent) && target.key === '-') {
    return (target.parent as unknown[]).some((value) => same(value, operation.value))
  }
  return target.value !== undefined && same(target.value, operation.value)
}

function operationContext(operation: PatchOperation): { moduleId?: string; entityId?: string; field?: string } {
  const path = segments(operation.path)
  return {
    moduleId: path[0] === 'modules' ? path[1] : undefined,
    entityId: path[2] === 'content' && path[3] === 'items' ? path[4] : undefined,
    field: path[5],
  }
}

function supportedProposalPath(path: string): boolean {
  const pathSegments = segments(path)
  if (path.startsWith('/modules/')) return true
  if (pathSegments[0] === 'metadata') {
    return pathSegments.length === 2 && ['version', 'build', 'updated'].includes(pathSegments[1])
  }
  return pathSegments[0] === 'changelog' && pathSegments.length === 2
}

function reviewOperation(root: Universe, operation: PatchOperation, index: number, duplicate: boolean): ProposalOperationReview {
  const context = operationContext(operation)
  const target = targetAt(root, operation.path)
  const noOp = operationIsNoOp(root, operation)
  let status: OperationReviewStatus = 'SAFE'
  let message = 'Adición sobre una ruta existente sin reemplazar datos.'

  if (duplicate) {
    status = 'REJECTED'; message = 'La misma operación aparece más de una vez.'
  } else if (!['add', 'replace', 'remove'].includes(operation.op)) {
    status = 'REJECTED'; message = 'Tipo de operación desconocido.'
  } else if (!supportedProposalPath(operation.path)) {
    status = 'REJECTED'; message = 'La ruta no pertenece a un módulo ni a una cabecera canónica permitida.'
  } else if (target.parent === undefined || target.key === undefined) {
    status = 'REJECTED'; message = 'La ruta padre no existe en el universo base.'
  } else if (!serializable(operation.value) && operation.op !== 'remove') {
    status = 'REJECTED'; message = 'El valor no es serializable como JSON.'
  } else if (operation.op === 'remove') {
    status = 'REJECTED'; message = 'Las eliminaciones requieren una fase autoral explícita y no se permiten en cuarentena segura.'
  } else if (operation.op === 'replace') {
    status = target.value === undefined ? 'REJECTED' : 'REVIEW REQUIRED'
    message = target.value === undefined ? 'No existe un valor que reemplazar.' : 'El reemplazo es explícito, pero requiere revisión autoral antes de aprobar.'
  } else if (Array.isArray(target.parent) && target.key === '-') {
    if ((target.parent as unknown[]).some((value) => same(value, operation.value))) {
      message = 'El valor ya está aplicado; la simulación lo tratará como un no-op idempotente.'
    } else message = 'Append explícito; conserva el array existente y añade un valor único.'
  } else if (target.value !== undefined) {
    if (same(target.value, operation.value)) message = 'La operación ya está aplicada; la simulación conservará el valor existente.'
    else { status = 'REJECTED'; message = 'La adición reemplazaría silenciosamente un valor existente.' }
  } else if (Array.isArray(target.parent)) {
    const valueId = typeof operation.value === 'object' && operation.value !== null ? (operation.value as { id?: unknown }).id : undefined
    if (valueId !== target.key) {
      status = 'REJECTED'; message = 'El ID de la entidad añadida no coincide con la ruta.'
    } else message = 'Entidad nueva con ID coherente y módulo existente.'
  }

  return { index, operation, status, message, ...context, ...(target.value === undefined ? {} : { before: target.value }), ...(operation.op === 'remove' ? {} : { after: operation.value }), ...(noOp ? { noOp: true } : {}) }
}

function detectApplied(universe: Universe, patch: UniversePatch): ProposalValidation['idempotence'] {
  let applied = 0
  for (const operation of patch.operations) {
    if (operation.op === 'remove') return 'CONFLICT'
    const target = targetAt(universe, operation.path)
    if (Array.isArray(target.parent) && target.key === '-') {
      if ((target.parent as unknown[]).some((value) => same(value, operation.value))) applied += 1
      else return 'NOT_APPLIED'
    } else if (containsValue(target.value, operation.value)) applied += 1
    else if (target.value === undefined) return 'NOT_APPLIED'
    else return 'CONFLICT'
  }
  return applied === patch.operations.length ? 'ALREADY_APPLIED' : 'NOT_APPLIED'
}

function createDiff(base: Universe, reviews: ProposalOperationReview[]): ProposalDiffSnapshot {
  const added = new Set<string>()
  const modified = new Set<string>()
  const removed = new Set<string>()
  const modules = new Set<string>()
  const baseIds = new Set(base.modules.flatMap((module) => module.content.items ?? []).map((entity) => entity.id))
  let fieldsAdded = 0; let fieldsReplaced = 0; let fieldsRemoved = 0; let referencesAdded = 0; let referencesRemoved = 0; let titlesReplaced = 0; let summariesReplaced = 0; let mysteriesResolved = 0
  reviews.forEach((review) => {
    if (review.noOp) return
    const { operation, moduleId, entityId } = review
    if (moduleId) modules.add(moduleId)
    if (entityId) {
      if (operation.op === 'add' && !baseIds.has(entityId) && segments(operation.path).length === 5) added.add(entityId)
      else if (baseIds.has(entityId)) modified.add(entityId)
    }
    const path = segments(operation.path)
    const field = path.at(-2) === 'refs' && path.at(-1) === '-' ? 'refs' : path.at(-1)
    if (operation.op === 'add') {
      if (field === 'refs' && path.at(-1) === '-') referencesAdded += 1
      else fieldsAdded += 1
    }
    if (operation.op === 'replace') {
      fieldsReplaced += 1
      if (field === 'title') titlesReplaced += 1
      if (field === 'summary') summariesReplaced += 1
      if (field === 'status' && operation.value === 'resolved' && moduleId === 'mysteries') mysteriesResolved += 1
    }
    if (operation.op === 'remove') {
      fieldsRemoved += 1
      if (field === 'refs') referencesRemoved += 1
      if (segments(operation.path).length === 5 && entityId) removed.add(entityId)
    }
  })
  added.forEach((id) => modified.delete(id))
  return { addedEntityIds: [...added].sort(), modifiedEntityIds: [...modified].sort(), removedEntityIds: [...removed].sort(), affectedModuleIds: [...modules].sort(), fieldsAdded, fieldsReplaced, fieldsRemoved, referencesAdded, referencesRemoved, titlesReplaced, summariesReplaced, mysteriesResolved }
}

export function isUniversePatch(payload: unknown): payload is UniversePatch {
  return typeof payload === 'object' && payload !== null && Array.isArray((payload as UniversePatch).operations)
}

export function validateProposalPatch(base: Universe, patch: UniversePatch): { validation: ProposalValidation; diff: ProposalDiffSnapshot; candidate?: Universe } {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  if (!Array.isArray(patch.operations)) errors.push(issue('operations', 'El patch no contiene un array operations.', 'Exporta un patch compatible.'))
  const signatures = patch.operations.map((operation) => hashCanonical(operation))
  const reviews: ProposalOperationReview[] = []
  let working = structuredClone(base)
  patch.operations.forEach((operation, index) => {
    const review = reviewOperation(working, operation, index, signatures.indexOf(signatures[index]) !== index)
    reviews.push(review)
    if (review.status === 'REJECTED') {
      errors.push(issue(`operations.${index}`, review.message, 'Corrige o retira esta operación.', operation))
      return
    }
    if (review.status === 'REVIEW REQUIRED') warnings.push({ ...issue(`operations.${index}`, review.message, 'Revisa explícitamente el before/after.'), severity: 'warning' })
    if (review.noOp) return
    try { working = applyPatch(working, { operations: [operation] }) }
    catch (error) { errors.push(issue(`operations.${index}`, error instanceof Error ? error.message : 'No se pudo aplicar la operación.', 'Corrige la ruta o el valor.', operation)) }
  })

  const candidateLoad = errors.length ? undefined : loadUniverse(working)
  if (candidateLoad && !candidateLoad.validation.valid) errors.push(...candidateLoad.validation.errors)
  if (candidateLoad) warnings.push(...candidateLoad.validation.warnings)
  const candidate = candidateLoad?.validation.data
  const idempotence = candidate ? detectApplied(candidate, patch) : 'CONFLICT'
  if (candidate && idempotence !== 'ALREADY_APPLIED') errors.push(issue('operations', 'La simulación no reconoce el patch como ya aplicado.', 'Revisa rutas append y operaciones no idempotentes.'))
  const rejected = reviews.filter((review) => review.status === 'REJECTED').length
  const reviewRequired = reviews.filter((review) => review.status === 'REVIEW REQUIRED').length
  const compatibilityScore = Math.max(0, 100 - rejected * 25 - reviewRequired * 5 - errors.filter((entry) => entry.message.includes('reference')).length * 25)
  const valid = Boolean(candidate && !errors.length && !rejected)
  return {
    validation: {
      valid,
      structuralSafety: valid ? (warnings.length ? 'PASS WITH WARNINGS' : 'PASS') : 'FAIL',
      jsonValid: true,
      jsonSchemaValid: Boolean(candidate),
      zodValid: Boolean(candidateLoad?.validation.valid),
      referencesValid: Boolean(candidateLoad?.validation.valid && !candidateLoad.validation.errors.some((entry) => entry.message.toLowerCase().includes('reference'))),
      idsValid: Boolean(candidateLoad?.validation.valid && !candidateLoad.validation.errors.some((entry) => entry.path.includes('.id'))),
      idempotence,
      compatibilityScore,
      compatibilityFormula: '100 − (REJECTED × 25) − (REVIEW REQUIRED × 5) − (referencias rotas × 25)',
      errors,
      warnings,
      operationReviews: reviews,
    },
    diff: createDiff(base, reviews),
    ...(candidate ? { candidate } : {}),
  }
}

export function createProposal(fileName: string, payload: unknown, base: Universe, now = new Date().toISOString()): ProposalRecord {
  const fileHash = hashCanonical(payload)
  const baseUniverseHash = hashCanonical(base)
  const id = `proposal-${fileHash.replace('fnv1a64-', '')}-${baseUniverseHash.replace('fnv1a64-', '')}`
  if (isUniversePatch(payload)) {
    const result = validateProposalPatch(base, payload)
    return { id, fileName, importedAt: now, updatedAt: now, fileHash, baseUniverseHash, operations: payload.operations.length, fileType: 'patch', status: result.validation.valid ? 'validated' : 'invalid', patch: structuredClone(payload), validation: result.validation, diff: result.diff }
  }
  const loaded = loadUniverse(payload)
  const validation: ProposalValidation = {
    valid: loaded.validation.valid,
    structuralSafety: loaded.validation.valid ? (loaded.validation.warnings.length ? 'PASS WITH WARNINGS' : 'PASS') : 'FAIL',
    jsonValid: true,
    jsonSchemaValid: loaded.validation.valid,
    zodValid: loaded.validation.valid,
    referencesValid: loaded.validation.valid,
    idsValid: loaded.validation.valid,
    idempotence: 'NOT_APPLIED',
    compatibilityScore: loaded.validation.valid ? 100 : 0,
    compatibilityFormula: 'Masters completos requieren confirmación explícita y no se tratan como patches.',
    errors: loaded.validation.errors,
    warnings: loaded.validation.warnings,
    operationReviews: [],
  }
  return { id, fileName, importedAt: now, updatedAt: now, fileHash, baseUniverseHash, operations: 0, fileType: 'master', status: validation.valid ? 'imported' : 'invalid', ...(loaded.validation.data ? { master: loaded.validation.data } : {}), validation, diff: emptyDiff() }
}

export function proposalCandidate(proposal: ProposalRecord, base: Universe): Universe | undefined {
  if (proposal.baseUniverseHash !== hashCanonical(base)) return undefined
  if (proposal.master) return structuredClone(proposal.master)
  if (!proposal.patch) return undefined
  return validateProposalPatch(base, proposal.patch).candidate
}

export function withTemporaryEngines(universe: Universe, engines: AnalysisEngines): Universe {
  return { ...structuredClone(universe), analysisConfig: { enabled: Object.values(engines).some(Boolean), engines: { ...engines } } }
}

function entities(universe: Universe): UniverseEntity[] {
  return universe.modules.flatMap((module) => module.content.items ?? [])
}

function canonicalLinkCount(universe: Universe): number {
  return entities(universe).reduce((total, entity) => total + (entity.refs?.length ?? 0) + (entity.foreshadowing?.length ?? 0), 0)
}

function metrics(universe: Universe, snapshot: AnalysisSnapshot): ProposalMetrics {
  const all = entities(universe)
  const events = all.filter((entity) => entity.type === 'event')
  return {
    entities: all.length,
    events: events.length,
    modules: universe.modules.length,
    canonicalLinks: canonicalLinkCount(universe),
    derivedEdges: snapshot.compilation.manifest.counts.relationEdges,
    ...(snapshot.connections ? { isolatedNodes: snapshot.connections.topology.isolatedNodeIds.length, components: snapshot.connections.topology.components.length } : {}),
    observations: snapshot.connections?.observations.length ?? 0,
    issues: snapshot.issues.length,
    coverage: {
      temporal: events.filter((entity) => entity.temporal?.start).length,
      participants: events.filter((entity) => entity.participantRefs?.length).length,
      locations: events.filter((entity) => entity.locationRefs?.length).length,
      causality: events.filter((entity) => entity.causes?.length || entity.effects?.length).length,
      knowledge: events.filter((entity) => entity.knowledgeChanges?.length).length,
      states: events.filter((entity) => entity.stateChanges?.length).length,
      analysis: all.filter((entity) => entity.analysis).length,
    },
  }
}

export function compareProposalAnalysis(base: Universe, candidate: Universe, baseSnapshot: AnalysisSnapshot, candidateSnapshot: AnalysisSnapshot): ProposalComparison {
  const baseIssueIds = new Set(baseSnapshot.issues.map((entry) => entry.id))
  const candidateIssueIds = new Set(candidateSnapshot.issues.map((entry) => entry.id))
  const baseObservationIds = new Set(baseSnapshot.connections?.observations.map((entry) => entry.id) ?? [])
  const candidateObservationIds = new Set(candidateSnapshot.connections?.observations.map((entry) => entry.id) ?? [])
  const newIssues = candidateSnapshot.issues.filter((entry) => !baseIssueIds.has(entry.id))
  const penalty = newIssues.reduce((total, entry) => total + (entry.severity === 'critical' || entry.severity === 'high' ? 10 : entry.severity === 'medium' ? 5 : entry.severity === 'low' ? 2 : 0), 0)
  const candidateMetrics = metrics(candidate, candidateSnapshot)
  const coverageSlots = candidateMetrics.events * 6 + candidateMetrics.entities
  const coverageUsed = Object.values(candidateMetrics.coverage).reduce((sum, value) => sum + value, 0)
  const coveragePercent = Math.round(coverageUsed / Math.max(1, coverageSlots) * 100)
  const missingCoverage = Object.entries(candidateMetrics.coverage).filter(([, value]) => value === 0).map(([key]) => key)
  const baseEntities = entities(base)
  const candidateEntities = entities(candidate)
  const baseSeedIds = new Set(baseEntities.filter((entity) => entity.foreshadowing?.length).map((entity) => entity.id))
  const candidateSeedEntities = candidateEntities.filter((entity) => entity.foreshadowing?.length)
  const candidateIds = new Set(candidateEntities.map((entity) => entity.id))
  const referencedTargetIds = [...new Set(candidateSeedEntities.flatMap((entity) => entity.foreshadowing ?? []))].sort()
  return {
    base: metrics(base, baseSnapshot),
    candidate: candidateMetrics,
    newIssueIds: newIssues.map((entry) => entry.id).sort(),
    resolvedIssueIds: baseSnapshot.issues.filter((entry) => !candidateIssueIds.has(entry.id)).map((entry) => entry.id).sort(),
    newObservationIds: [...candidateObservationIds].filter((id) => !baseObservationIds.has(id)).sort(),
    resolvedObservationIds: [...baseObservationIds].filter((id) => !candidateObservationIds.has(id)).sort(),
    compatibilityScore: Math.max(0, 100 - penalty),
    compatibilityEvidence: [`Nuevos issues: ${newIssues.length}`, `Penalización por severidad demostrable: ${penalty}`, 'Referencias rotas e IDs duplicados se controlan antes de simular.'],
    coveragePercent,
    missingCoverage,
    foreshadowing: {
      baseSeeds: baseSeedIds.size,
      candidateSeeds: candidateSeedEntities.length,
      newSeedEntityIds: candidateSeedEntities.map((entity) => entity.id).filter((id) => !baseSeedIds.has(id)).sort(),
      referencedTargetIds,
      unresolvedTargetIds: referencedTargetIds.filter((id) => !candidateIds.has(id)),
    },
    plausibility: 'not-applicable',
  }
}
