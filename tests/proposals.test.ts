// @vitest-environment node
import acceptancePatch from '../data/updates/meme-lore-update-001-gracia-mundo-extenso.patch.json'
import multilevelPatch from '../data/updates/meme-lore-update-002-cronologia-multinivel-rey-amarillo.patch.json'
import somaContinuityPatch from '../data/updates/meme-lore-update-004-soma-continuity.patch.json'
import preSomaMergeSource from './fixtures/universe-v3_5-pre-soma-merge.json'
import { hashCanonical } from '../src/analysis/derived'
import { compileAnalysisSnapshot } from '../src/analysis/incremental'
import { MemoryProposalRepository } from '../src/proposals/repository'
import { compareProposalAnalysis, createProposal, proposalCandidate, validateProposalPatch, withTemporaryEngines } from '../src/proposals/workflow'
import { loadUniverse } from '../src/services/universe-loader'
import { createPhase11Universe } from './fixtures/historical-universes'

const generatedAt = '2042-04-12T00:00:00.000Z'
const base = createPhase11Universe()
const engines = { continuity: true, causality: true, knowledge: true, connections: true, plausibility: false }

describe('proposal quarantine workflow', () => {
  it('validates the real 22-operation patch without mutating the active base', () => {
    const before = hashCanonical(base)
    const proposal = createProposal('meme-lore-update-001-gracia-mundo-extenso.patch.json', acceptancePatch, base, generatedAt)
    const candidate = proposalCandidate(proposal, base)

    expect(proposal).toMatchObject({ status: 'validated', operations: 22, fileType: 'patch' })
    expect(proposal.validation).toMatchObject({ valid: true, structuralSafety: 'PASS', idempotence: 'ALREADY_APPLIED', zodValid: true, referencesValid: true, idsValid: true })
    expect(proposal.validation.operationReviews.every((review) => review.status === 'SAFE')).toBe(true)
    expect(proposal.diff).toMatchObject({ fieldsRemoved: 0, referencesRemoved: 0, referencesAdded: 12, titlesReplaced: 0, summariesReplaced: 0, mysteriesResolved: 0 })
    expect(proposal.diff.addedEntityIds).toHaveLength(10)
    expect(proposal.diff.modifiedEntityIds).toHaveLength(5)
    expect(base.modules.flatMap((module) => module.content.items ?? [])).toHaveLength(95)
    expect(candidate?.modules.flatMap((module) => module.content.items ?? [])).toHaveLength(105)
    expect(hashCanonical(base)).toBe(before)
  })

  it('detects destructive, duplicate, and broken operations while accepting an already-applied add as a no-op', () => {
    const destructive = validateProposalPatch(base, { operations: [{ op: 'remove', path: '/modules/lore/content/items/meme-la-gracia' }] })
    const duplicate = validateProposalPatch(base, { operations: [
      { op: 'add', path: '/modules/lore/content/items/meme-la-gracia/refs/-', value: 'meme-mundo-extenso' },
      { op: 'add', path: '/modules/lore/content/items/meme-la-gracia/refs/-', value: 'meme-mundo-extenso' },
    ] })
    const broken = validateProposalPatch(base, { operations: [{ op: 'add', path: '/modules/absent/content/items/new-entity', value: { id: 'new-entity', type: 'world-rule', title: 'Broken' } }] })
    const present = validateProposalPatch(base, { operations: [{ op: 'add', path: '/modules/lore/content/items/meme-la-gracia/refs/-', value: 'meme-meme' }] })

    for (const result of [destructive, duplicate, broken]) {
      expect(result.validation.valid).toBe(false)
      expect(result.validation.structuralSafety).toBe('FAIL')
      expect(result.validation.operationReviews.some((review) => review.status === 'REJECTED')).toBe(true)
    }
    expect(present.validation).toMatchObject({ valid: true, structuralSafety: 'PASS', idempotence: 'ALREADY_APPLIED' })
    expect(present.validation.operationReviews[0]).toMatchObject({ status: 'SAFE', noOp: true })
    expect(present.diff).toMatchObject({ addedEntityIds: [], modifiedEntityIds: [], fieldsAdded: 0, referencesAdded: 0 })
  })

  it('replays the fully applied 247-operation multilevel patch without duplicating canon data', () => {
    const currentBase = loadUniverse(preSomaMergeSource).validation.data
    if (!currentBase) throw new Error('The current master universe must be valid.')
    const before = hashCanonical(currentBase)
    const proposal = createProposal('meme-lore-update-002-cronologia-multinivel-rey-amarillo.patch.json', multilevelPatch, currentBase, generatedAt)
    const candidate = proposalCandidate(proposal, currentBase)

    expect(proposal).toMatchObject({ status: 'validated', operations: 247 })
    expect(proposal.validation).toMatchObject({ valid: true, structuralSafety: 'PASS', idempotence: 'ALREADY_APPLIED' })
    expect(proposal.validation.operationReviews.every((review) => review.status === 'SAFE' && review.noOp)).toBe(true)
    expect(proposal.diff).toMatchObject({ addedEntityIds: [], modifiedEntityIds: [], fieldsAdded: 0, fieldsReplaced: 0, referencesAdded: 0 })
    expect(candidate && hashCanonical(candidate)).toBe(before)
  })

  it('accepts the SOMA continuity patch with controlled canon header updates', () => {
    const currentBase = loadUniverse(preSomaMergeSource).validation.data
    if (!currentBase) throw new Error('The current master universe must be valid.')
    const proposal = createProposal('meme-lore-update-004-soma-continuity.patch.json', somaContinuityPatch, currentBase, generatedAt)
    const candidate = proposalCandidate(proposal, currentBase)

    expect(proposal).toMatchObject({ status: 'validated', operations: 84, fileType: 'patch' })
    expect(proposal.validation).toMatchObject({ valid: true, structuralSafety: 'PASS WITH WARNINGS', idempotence: 'ALREADY_APPLIED', zodValid: true, referencesValid: true, idsValid: true })
    expect(proposal.validation.operationReviews.slice(0, 3).every((review) => review.status === 'REVIEW REQUIRED')).toBe(true)
    expect(proposal.validation.operationReviews[3]).toMatchObject({ status: 'SAFE', operation: { path: '/changelog/change-004' } })
    expect(proposal.diff.addedEntityIds).toHaveLength(37)
    expect(candidate?.metadata).toMatchObject({ version: '0.3.0', build: 'canon-update-004-soma-continuity', updated: '2026-07-15T00:00:00.000Z' })
    expect(candidate?.changelog.at(-1)).toMatchObject({ id: 'change-004', version: '0.3.0' })
    if (!candidate) throw new Error('The SOMA continuity candidate must be valid.')
    const baseSnapshot = compileAnalysisSnapshot(withTemporaryEngines(currentBase, engines), undefined, { generatedAt })
    const candidateSnapshot = compileAnalysisSnapshot(withTemporaryEngines(candidate, engines), baseSnapshot, { generatedAt })
    const comparison = compareProposalAnalysis(currentBase, candidate, baseSnapshot, candidateSnapshot)
    expect(comparison.newIssueIds).toEqual([])
    expect(comparison.newObservationIds).toEqual([])
  })

  it('still rejects unrelated top-level mutations', () => {
    const result = validateProposalPatch(base, { operations: [{ op: 'replace', path: '/metadata/title', value: 'Unexpected title' }] })

    expect(result.validation.valid).toBe(false)
    expect(result.validation.operationReviews[0]).toMatchObject({ status: 'REJECTED' })
  })

  it('compares base and candidate deterministically with temporary engines', () => {
    const proposal = createProposal('acceptance.patch.json', acceptancePatch, base, generatedAt)
    const candidate = proposalCandidate(proposal, base)
    if (!candidate) throw new Error('Acceptance candidate must be valid.')
    const analysisBase = withTemporaryEngines(base, engines)
    const analysisCandidate = withTemporaryEngines(candidate, engines)
    const baseSnapshot = compileAnalysisSnapshot(analysisBase, undefined, { generatedAt })
    const candidateSnapshot = compileAnalysisSnapshot(analysisCandidate, baseSnapshot, { generatedAt })
    const comparison = compareProposalAnalysis(base, candidate, baseSnapshot, candidateSnapshot)

    expect(comparison.base).toMatchObject({ entities: 95, canonicalLinks: 304, derivedEdges: 343, isolatedNodes: 8, components: 9 })
    expect(comparison.candidate).toMatchObject({ entities: 105, canonicalLinks: 357, derivedEdges: 396, isolatedNodes: 8, components: 9 })
    expect(comparison.newIssueIds).toEqual([])
    expect(comparison.foreshadowing.newSeedEntityIds).toHaveLength(4)
    expect(comparison.foreshadowing.unresolvedTargetIds).toEqual([])
    expect(comparison.plausibility).toBe('not-applicable')
  })

  it('persists proposal states outside the canon', async () => {
    const repository = new MemoryProposalRepository()
    const proposal = createProposal('acceptance.patch.json', acceptancePatch, base, generatedAt)
    await repository.put(proposal)
    await repository.put({ ...proposal, status: 'rejected', decision: { kind: 'rejected', at: generatedAt, note: 'Not yet.' }, updatedAt: generatedAt })

    expect(await repository.get(proposal.id)).toMatchObject({ status: 'rejected', decision: { note: 'Not yet.' } })
    expect(await repository.list()).toHaveLength(1)
    expect(hashCanonical(base)).toBe(proposal.baseUniverseHash)
  })
})
