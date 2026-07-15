import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import acceptancePatch from '../data/updates/meme-lore-update-001-gracia-mundo-extenso.patch.json'
import { hashCanonical } from '../src/analysis/derived'
import { compileAnalysisSnapshot } from '../src/analysis/incremental'
import { proposalsRoute } from '../src/app/routes'
import { UniverseContext, type UniverseContextValue } from '../src/app/universe-context'
import { ProposalDetailPage } from '../src/pages/ProposalDetailPage'
import { ProposalListPage } from '../src/pages/ProposalListPage'
import { proposalRepository } from '../src/proposals/repository'
import { compareProposalAnalysis, createProposal, proposalCandidate, withTemporaryEngines } from '../src/proposals/workflow'
import type { CompileUniverseOptions, AnalysisService } from '../src/services/analysis-service'
import { useStudioStore } from '../src/store/useStudioStore'
import type { AnalysisSnapshot } from '../src/analysis/types'
import type { Universe } from '../src/types/universe'
import { createPhase11Universe } from './fixtures/historical-universes'

const generatedAt = '2042-04-12T00:00:00.000Z'
const base = createPhase11Universe()
const engines = { continuity: true, causality: true, knowledge: true, connections: true, plausibility: false }

class InlineAnalysisService implements AnalysisService {
  latest?: AnalysisSnapshot
  compileUniverse(universe: Universe, options?: CompileUniverseOptions): Promise<AnalysisSnapshot> {
    options?.onProgress?.({ protocolVersion: '1', type: 'progress', requestId: 'proposal-test', progress: 1, stage: 'complete' })
    this.latest = compileAnalysisSnapshot(universe, this.latest, { generatedAt })
    return Promise.resolve(this.latest)
  }
  cancelCompilation(): void {}
  getLatestSnapshot(): AnalysisSnapshot | undefined { return this.latest }
  async clearAnalysisCache(): Promise<void> { this.latest = undefined }
  dispose(): void {}
}

function model(overrides: Partial<UniverseContextValue> = {}): UniverseContextValue {
  return {
    baseUniverse: base,
    validation: { valid: true, data: base, errors: [], warnings: [] },
    migrated: [],
    isLoading: false,
    loadedAt: 0,
    workspaceState: 'base',
    importFile: async () => undefined,
    importPayload: () => undefined,
    openCandidate: () => undefined,
    restoreBase: () => undefined,
    reset: () => undefined,
    ...overrides,
  }
}

async function simulatedProposal() {
  const proposal = createProposal('meme-lore-update-001-gracia-mundo-extenso.patch.json', acceptancePatch, base, generatedAt)
  const candidate = proposalCandidate(proposal, base)
  if (!candidate) throw new Error('Acceptance candidate must be valid.')
  const baseSnapshot = compileAnalysisSnapshot(withTemporaryEngines(base, engines), undefined, { generatedAt })
  const candidateSnapshot = compileAnalysisSnapshot(withTemporaryEngines(candidate, engines), baseSnapshot, { generatedAt })
  return {
    ...proposal,
    status: 'simulated' as const,
    simulation: {
      simulatedAt: generatedAt,
      engines,
      baseHash: proposal.baseUniverseHash,
      candidateHash: hashCanonical(candidate),
      candidateUniverse: candidate,
      baseSnapshot,
      candidateSnapshot,
      comparison: compareProposalAnalysis(base, candidate, baseSnapshot, candidateSnapshot),
    },
  }
}

function click(element?: Element | null): void {
  if (!element) throw new Error('Expected element to exist.')
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('proposal center UI', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    localStorage.clear()
    await proposalRepository.clear()
    useStudioStore.setState({ analysisEngines: engines })
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    await proposalRepository.clear()
    localStorage.clear()
    container.remove()
  })

  it('imports the real patch into quarantine without changing the active universe', async () => {
    const before = hashCanonical(base)
    await act(async () => root.render(<UniverseContext.Provider value={model()}><MemoryRouter initialEntries={[proposalsRoute]}><Routes><Route path={proposalsRoute} element={<ProposalListPage />} /><Route path={`${proposalsRoute}/:proposalId`} element={<div>Propuesta en cuarentena</div>} /></Routes></MemoryRouter></UniverseContext.Provider>))
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const file = { name: 'meme-lore-update-001-gracia-mundo-extenso.patch.json', text: async () => JSON.stringify(acceptancePatch) } as File
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 10)) })

    expect(await proposalRepository.list()).toHaveLength(1)
    expect((await proposalRepository.list())[0]).toMatchObject({ operations: 22, status: 'validated' })
    expect(hashCanonical(base)).toBe(before)
    expect(base.modules.flatMap((module) => module.content.items ?? [])).toHaveLength(95)
  })

  it('supports author approval, candidate opening, and base restoration as separate actions', async () => {
    const proposal = await simulatedProposal()
    await proposalRepository.put(proposal)
    const openCandidate = vi.fn()
    const restoreBase = vi.fn()
    await act(async () => {
      root.render(<UniverseContext.Provider value={model({ openCandidate, restoreBase })}><MemoryRouter initialEntries={[`${proposalsRoute}/${proposal.id}`]}><Routes><Route path={`${proposalsRoute}/:proposalId`} element={<ProposalDetailPage serviceFactory={() => new InlineAnalysisService()} />} /></Routes></MemoryRouter></UniverseContext.Provider>)
      await Promise.resolve()
    })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    await act(async () => click([...container.querySelectorAll('button')].find((button) => button.textContent === 'Decisión')))
    await act(async () => click(container.querySelector<HTMLInputElement>('.proposal-confirm input')))
    await act(async () => click([...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Aprobar')))
    expect(await proposalRepository.get(proposal.id)).toMatchObject({ status: 'approved', decision: { kind: 'approved' } })
    expect(openCandidate).not.toHaveBeenCalled()

    await act(async () => click([...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Abrir candidato'))))
    expect(openCandidate).toHaveBeenCalledWith(expect.objectContaining({ modules: expect.any(Array) }), proposal.id)
    expect(await proposalRepository.get(proposal.id)).toMatchObject({ status: 'applied-to-workspace' })

    await act(async () => root.render(<UniverseContext.Provider value={model({ workspaceState: 'candidate', workspaceProposalId: proposal.id, openCandidate, restoreBase })}><MemoryRouter initialEntries={[`${proposalsRoute}/${proposal.id}`]}><Routes><Route path={`${proposalsRoute}/:proposalId`} element={<ProposalDetailPage serviceFactory={() => new InlineAnalysisService()} />} /></Routes></MemoryRouter></UniverseContext.Provider>))
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    await act(async () => click([...container.querySelectorAll('button')].find((button) => button.textContent === 'Decisión')))
    await act(async () => click([...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Restaurar canon base'))))
    expect(restoreBase).toHaveBeenCalled()
  })
})
