import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { analysisRoute } from '../src/app/routes'
import { UniverseContext, type UniverseContextValue } from '../src/app/universe-context'
import { compileAnalysisSnapshot } from '../src/analysis/incremental'
import { defaultIssueFilters, filterIssues, isAnalysisSnapshotStale } from '../src/analysis/presentation'
import type { AnalysisSnapshot } from '../src/analysis/types'
import { AppShell } from '../src/layouts/AppShell'
import { annotationNeedsReview, readAnalysisAnnotations, writeIssueAnnotation } from '../src/services/analysis-annotations'
import type { CompileUniverseOptions, AnalysisService } from '../src/services/analysis-service'
import { AnalysisWorkerError } from '../src/services/analysis-worker-client'
import { AnalysisPage } from '../src/pages/AnalysisPage'
import { useStudioStore } from '../src/store/useStudioStore'
import type { Universe } from '../src/types/universe'
import { continuityContradictionFixture, continuityFixture } from './fixtures/continuity-v3_4'

const generatedAt = '2042-04-12T00:00:00.000Z'

class TestAnalysisService implements AnalysisService {
  calls = 0
  cancellations = 0
  disposed = false
  private latest?: AnalysisSnapshot
  private rejectPending?: (error: Error) => void

  constructor(private readonly snapshot: AnalysisSnapshot, private readonly mode: 'success' | 'pending' | 'error' = 'success') {}

  compileUniverse(_universe: Universe, options?: CompileUniverseOptions): Promise<AnalysisSnapshot> {
    this.calls += 1
    options?.onProgress?.({ protocolVersion: '1', type: 'progress', requestId: 'test', progress: 0.45, stage: 'compiling-indexes' })
    if (this.mode === 'error') return Promise.reject(new AnalysisWorkerError({ code: 'COMPILATION_FAILED', name: 'AnalysisWorkerError', message: 'Worker test failure.' }))
    if (this.mode === 'pending') {
      return new Promise((_resolve, reject) => { this.rejectPending = reject })
    }
    this.latest = this.snapshot
    return Promise.resolve(this.snapshot)
  }

  cancelCompilation(): void {
    this.cancellations += 1
    this.rejectPending?.(new AnalysisWorkerError({ code: 'CANCELLED', name: 'AnalysisCancelledError', message: 'Analysis compilation was cancelled.' }))
  }

  getLatestSnapshot(): AnalysisSnapshot | undefined {
    return this.latest
  }

  async clearAnalysisCache(): Promise<void> {
    this.latest = undefined
  }

  dispose(): void {
    this.disposed = true
  }
}

function modelFor(universe: Universe): UniverseContextValue {
  return {
    validation: { valid: true, data: universe, errors: [], warnings: [] },
    migrated: [],
    isLoading: false,
    loadedAt: 0,
    importFile: async () => undefined,
    importPayload: () => undefined,
    reset: () => undefined,
  }
}

async function renderAnalysis(service: AnalysisService, universe: Universe = continuityFixture): Promise<{ container: HTMLDivElement; root: Root; cleanup: () => Promise<void> }> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(<UniverseContext.Provider value={modelFor(universe)}><AnalysisPage serviceFactory={() => service} /></UniverseContext.Provider>)
  })
  return {
    container,
    root,
    cleanup: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

function click(element: Element): void {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function setInputValue(element: HTMLInputElement | HTMLSelectElement, value: string): void {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('analysis center', () => {
  const snapshot = compileAnalysisSnapshot(continuityContradictionFixture(), undefined, { generatedAt })

  beforeEach(() => {
    localStorage.clear()
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  it('exposes the analysis navigation route', () => {
    expect(analysisRoute).toBe('/analysis')
  })

  it('navigates through the existing shell to the analysis route', async () => {
    useStudioStore.setState({ sidebarCollapsed: false, searchOpen: false })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    try {
      await act(async () => {
        root.render(<UniverseContext.Provider value={modelFor(continuityFixture)}><MemoryRouter initialEntries={[analysisRoute]}><Routes><Route element={<AppShell />}><Route path={analysisRoute.slice(1)} element={<p>Analysis route target</p>} /></Route></Routes></MemoryRouter></UniverseContext.Provider>)
      })
      expect(container.querySelector<HTMLAnchorElement>(`a[href="${analysisRoute}"]`)?.textContent).toContain('Analysis')
      expect(container.textContent).toContain('Analysis route target')
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('runs the local compiler, supports filters, persists a decision, and exposes labelled controls', async () => {
    const service = new TestAnalysisService(snapshot)
    const rendered = await renderAnalysis(service, continuityContradictionFixture())
    try {
      const analyze = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Analizar universo"]')
      expect(analyze).not.toBeNull()
      await act(async () => { click(analyze!) })

      expect(service.calls).toBe(1)
      expect(rendered.container.querySelectorAll('.analysis-issue-row')).toHaveLength(4)
      const search = rendered.container.querySelector<HTMLInputElement>('input[aria-label="Buscar issues"]')
      expect(search).not.toBeNull()
      await act(async () => { setInputValue(search!, 'age 40') })
      expect(rendered.container.querySelectorAll('.analysis-issue-row')).toHaveLength(1)

      const issueRow = rendered.container.querySelector<HTMLElement>('.analysis-issue-row')
      await act(async () => { click(issueRow!) })
      const decision = rendered.container.querySelector<HTMLSelectElement>('select[aria-label^="Decisión para"]')
      await act(async () => { setInputValue(decision!, 'intentional') })

      const selectedIssue = snapshot.issues.find((issue) => issue.ruleId === 'incompatible-age')
      if (!selectedIssue) throw new Error('The continuity fixture needs an age issue.')
      expect(readAnalysisAnnotations()[selectedIssue.id]).toMatchObject({ decision: 'intentional', issueId: selectedIssue.id })
      expect(rendered.container.querySelector('[aria-label="Filtrar por severidad"]')).not.toBeNull()
    } finally {
      await rendered.cleanup()
    }
  })

  it('shows an accessible progress state and handles cancellation without a partial result', async () => {
    const service = new TestAnalysisService(snapshot, 'pending')
    const rendered = await renderAnalysis(service, continuityContradictionFixture())
    try {
      const analyze = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Analizar universo"]')
      await act(async () => { click(analyze!); await Promise.resolve() })
      expect(rendered.container.querySelector('[role="progressbar"]')).not.toBeNull()

      const cancel = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Cancelar análisis"]')
      await act(async () => { click(cancel!); await Promise.resolve() })

      expect(service.cancellations).toBe(1)
      expect(rendered.container.textContent).toContain('Análisis cancelado')
      expect(rendered.container.querySelectorAll('.analysis-issue-row')).toHaveLength(0)
    } finally {
      await rendered.cleanup()
    }
  })

  it('reports a Worker error without breaking the page', async () => {
    const service = new TestAnalysisService(snapshot, 'error')
    const rendered = await renderAnalysis(service, continuityContradictionFixture())
    try {
      const analyze = rendered.container.querySelector<HTMLButtonElement>('button[aria-label="Analizar universo"]')
      await act(async () => { click(analyze!) })

      expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain('Worker test failure.')
      expect(rendered.container.textContent).toContain('El Worker informó un error')
    } finally {
      await rendered.cleanup()
    }
  })

  it('marks prior author decisions for review when issue evidence changes', () => {
    const issue = snapshot.issues[0]
    if (!issue) throw new Error('The continuity fixture needs an issue.')
    const annotation = writeIssueAnnotation(issue, { decision: 'confirmed', note: 'Checked locally.' }, generatedAt)
    const changedEvidence = { ...issue, evidence: [...issue.evidence, { sourceId: 'new-source', field: 'temporal', value: 'changed' }] }

    expect(annotationNeedsReview(annotation, issue)).toBe(false)
    expect(annotationNeedsReview(annotation, changedEvidence)).toBe(true)
    expect(filterIssues(snapshot.issues, { [issue.id]: annotation }, { ...defaultIssueFilters, decision: 'confirmed' })).toEqual([issue])
    expect(isAnalysisSnapshotStale(snapshot, { ...continuityContradictionFixture(), metadata: { ...continuityContradictionFixture().metadata, title: 'Changed canon' } })).toBe(true)
  })
})
