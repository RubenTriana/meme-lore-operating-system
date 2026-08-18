import { MockNarrativeExtractionAdapter } from '../src/extraction/mock-adapter'
import { ExtractionSecurityError, extractSelectedSource, sourceDisclosure } from '../src/extraction/security'
import type { ExtractionProposal, NarrativeExtractionAdapter, NarrativeSource } from '../src/extraction/types'
import { buildExtractionPatch, reviewProposalItem, serializeExtractionPatch } from '../src/extraction/workflow'
import { applyPatch } from '../src/services/patches'
import { useStudioStore } from '../src/store/useStudioStore'
import { plausibilityFixture } from './fixtures/plausibility-v3_5'

const emptyProposal: ExtractionProposal = { proposedEntities: [], proposedEvents: [], proposedRelations: [], warnings: [], sourceSpans: [] }

describe('optional narrative extraction boundary', () => {
  beforeEach(() => { localStorage.clear(); useStudioStore.setState({ aiExtractionEnabled: false }) })

  it('keeps the feature flag off by default', () => {
    expect(useStudioStore.getState().aiExtractionEnabled).toBe(false)
  })

  it('sends only selected fragments and never the universe to an adapter', async () => {
    let received: NarrativeSource | undefined
    const adapter: NarrativeExtractionAdapter = { extract: async (input) => { received = input; return emptyProposal } }
    const source: NarrativeSource = { id: 'source', fragments: [
      { id: 'selected', text: 'ENTITY | cast | new-ally | character | New Ally', selected: true },
      { id: 'private', text: 'ENTITY | cast | hidden | character | Hidden', selected: false },
    ] }
    await extractSelectedSource(adapter, source)
    expect(received).toEqual({ id: 'source', fragments: [{ id: 'selected', text: source.fragments[0].text, selected: true }] })
    expect(sourceDisclosure(source)).toMatchObject({ selectedFragmentIds: ['selected'], includesUniverse: false })
  })

  it('blocks likely secrets before invoking the adapter', async () => {
    let called = false
    const adapter: NarrativeExtractionAdapter = { extract: async () => { called = true; return emptyProposal } }
    const source: NarrativeSource = { id: 'source', fragments: [{ id: 'secret', text: 'api_key=top-secret-value', selected: true }] }
    await expect(extractSelectedSource(adapter, source)).rejects.toBeInstanceOf(ExtractionSecurityError)
    expect(called).toBe(false)
  })

  it('creates traceable mock proposals without completing missing information', async () => {
    const source: NarrativeSource = { id: 'source', fragments: [{ id: 'fragment', selected: true, text: 'ENTITY | cast | new-ally | character | New Ally\nEVENT | plot | incomplete\nFree prose without structure' }] }
    const proposal = await extractSelectedSource(new MockNarrativeExtractionAdapter(), source)
    expect(proposal.proposedEntities).toHaveLength(1)
    expect(proposal.proposedEntities[0]).toMatchObject({ status: 'proposed', sourceSpanIds: ['span-fragment-1'] })
    expect(proposal.sourceSpans[0]).toMatchObject({ fragmentId: 'fragment', start: 0, text: 'ENTITY | cast | new-ally | character | New Ally' })
    expect(proposal.proposedEvents).toHaveLength(0)
    expect(proposal.warnings).toHaveLength(2)
  })

  it('requires human acceptance, validates the patch, and preserves the source canon', async () => {
    const original = structuredClone(plausibilityFixture)
    const source: NarrativeSource = { id: 'source', fragments: [{ id: 'fragment', selected: true, text: 'ENTITY | cast | new-ally | character | New Ally\nEVENT | plot | new-event | New Event\nRELATION | new-event | refs | new-ally' }] }
    let proposal = await extractSelectedSource(new MockNarrativeExtractionAdapter(), source)
    const untouched = buildExtractionPatch(plausibilityFixture, proposal)
    expect(untouched.patch.operations).toHaveLength(0)
    proposal = reviewProposalItem(proposal, 'proposedEntities', 'entity-new-ally', 'accepted')
    proposal = reviewProposalItem(proposal, 'proposedEvents', 'event-new-event', 'accepted')
    proposal = reviewProposalItem(proposal, 'proposedRelations', 'relation-new-event-refs-new-ally', 'accepted')
    const result = buildExtractionPatch(plausibilityFixture, proposal)
    expect(result.validation.valid).toBe(true)
    expect(result.patch.operations).toHaveLength(3)
    expect(result.comparison).toHaveLength(3)
    expect(JSON.parse(serializeExtractionPatch(result))).toEqual(result.patch)
    const preview = applyPatch(plausibilityFixture, result.patch)
    expect(preview.modules.find((module) => module.id === 'cast')?.content.items?.some((entity) => entity.id === 'new-ally')).toBe(true)
    expect(plausibilityFixture).toEqual(original)
  })

  it('excludes rejected proposals and rejects broken accepted relations', async () => {
    const source: NarrativeSource = { id: 'source', fragments: [{ id: 'fragment', selected: true, text: 'ENTITY | cast | discarded | character | Discarded\nRELATION | clay | refs | missing-target' }] }
    let proposal = await extractSelectedSource(new MockNarrativeExtractionAdapter(), source)
    proposal = reviewProposalItem(proposal, 'proposedEntities', 'entity-discarded', 'rejected')
    proposal = reviewProposalItem(proposal, 'proposedRelations', 'relation-clay-refs-missing-target', 'accepted')
    const result = buildExtractionPatch(plausibilityFixture, proposal)
    expect(result.validation.valid).toBe(false)
    expect(result.patch.operations).toHaveLength(0)
    expect(result.validation.errors[0]?.message).toContain('missing-target')
    expect(() => serializeExtractionPatch(result)).toThrow('validación canónica')
  })
})
