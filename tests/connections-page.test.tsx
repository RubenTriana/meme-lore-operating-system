import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { compileAnalysisSnapshot } from '../src/analysis/incremental'
import { connectionsRoute } from '../src/app/routes'
import { UniverseContext, type UniverseContextValue } from '../src/app/universe-context'
import { ConnectionsPage } from '../src/pages/ConnectionsPage'
import type { CompileUniverseOptions, AnalysisService } from '../src/services/analysis-service'
import type { AnalysisSnapshot } from '../src/analysis/types'
import type { Universe } from '../src/types/universe'
import { useStudioStore } from '../src/store/useStudioStore'
import { connectionsFixture } from './fixtures/connections-v3_5'

const generatedAt = '2042-04-12T00:00:00.000Z'

class TestConnectionsService implements AnalysisService {
  calls = 0
  constructor(private readonly result: AnalysisSnapshot, private latest?: AnalysisSnapshot) {}
  compileUniverse(_universe: Universe, options?: CompileUniverseOptions): Promise<AnalysisSnapshot> {
    this.calls += 1
    options?.onProgress?.({ protocolVersion: '1', type: 'progress', requestId: 'connections-test', progress: 0.5, stage: 'connections' })
    this.latest = this.result
    return Promise.resolve(this.result)
  }
  cancelCompilation(): void {}
  getLatestSnapshot(): AnalysisSnapshot | undefined { return this.latest }
  async clearAnalysisCache(): Promise<void> { this.latest = undefined }
  dispose(): void {}
}

function modelFor(universe: Universe): UniverseContextValue {
  return { baseUniverse: universe, validation: { valid: true, data: universe, errors: [], warnings: [] }, migrated: [], isLoading: false, loadedAt: 0, importFile: async () => undefined, importPayload: () => undefined, workspaceState: 'base', openCandidate: () => undefined, restoreBase: () => undefined, reset: () => undefined }
}

async function renderPage(service: AnalysisService): Promise<{ container: HTMLDivElement; root: Root; cleanup: () => Promise<void> }> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => { root.render(<UniverseContext.Provider value={modelFor(connectionsFixture)}><MemoryRouter><ConnectionsPage serviceFactory={() => service} /></MemoryRouter></UniverseContext.Provider>) })
  return { container, root, cleanup: async () => { await act(async () => root.unmount()); container.remove() } }
}

function click(element: Element): void { element.dispatchEvent(new MouseEvent('click', { bubbles: true })) }
function select(element: HTMLSelectElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('connections page', () => {
  const snapshot = compileAnalysisSnapshot(structuredClone(connectionsFixture), undefined, { generatedAt })

  beforeEach(() => {
    useStudioStore.setState({ analysisEngines: { continuity: true, causality: true, knowledge: true, connections: true, plausibility: true } })
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.stubGlobal('ResizeObserver', class { observe() {}; unobserve() {}; disconnect() {} })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('exposes the connections subroute and bounded graph controls', async () => {
    expect(connectionsRoute).toBe('/analysis/connections')
    const rendered = await renderPage(new TestConnectionsService(snapshot, snapshot))
    try {
      expect(rendered.container.querySelector('[aria-label="Seleccionar entidad"]')).not.toBeNull()
      expect(rendered.container.querySelector('[aria-label="Filtrar por tipo de arista"]')).not.toBeNull()
      expect(rendered.container.querySelector('[aria-label="Limitar profundidad"]')).not.toBeNull()
      expect(rendered.container.querySelectorAll('.react-flow__node').length).toBeLessThanOrEqual(80)
      expect(rendered.container.textContent).toContain('Observaciones, no errores')
      expect(rendered.container.textContent).toContain('Isolated Character')
    } finally { await rendered.cleanup() }
  })

  it('calculates a route and filters edge provenance without recompiling', async () => {
    const service = new TestConnectionsService(snapshot, snapshot)
    const rendered = await renderPage(service)
    try {
      const target = rendered.container.querySelector<HTMLSelectElement>('[aria-label="Calcular ruta hacia"]')!
      await act(async () => select(target, 'event-gamma'))
      expect(rendered.container.textContent).toContain('pasos')
      const edgeFilter = rendered.container.querySelector<HTMLSelectElement>('[aria-label="Filtrar por tipo de arista"]')!
      await act(async () => select(edgeFilter, 'reference'))
      expect(rendered.container.textContent).toContain('refs')
      expect(service.calls).toBe(0)
    } finally { await rendered.cleanup() }
  })

  it('runs the Worker-backed application service when requested', async () => {
    const service = new TestConnectionsService(snapshot)
    const rendered = await renderPage(service)
    try {
      expect(rendered.container.textContent).toContain('Análisis no ejecutado')
      const button = rendered.container.querySelector<HTMLButtonElement>('button:not([disabled])')!
      await act(async () => { click(button); await Promise.resolve() })
      expect(service.calls).toBe(1)
      expect(rendered.container.textContent).toContain('Vecindario acotado')
    } finally { await rendered.cleanup() }
  })
})
