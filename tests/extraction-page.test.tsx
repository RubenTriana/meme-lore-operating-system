import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { extractionRoute } from '../src/app/routes'
import { UniverseContext, type UniverseContextValue } from '../src/app/universe-context'
import { ExtractionPage } from '../src/pages/ExtractionPage'
import { proposalRepository } from '../src/proposals/repository'
import { useStudioStore } from '../src/store/useStudioStore'
import type { Universe } from '../src/types/universe'
import { plausibilityFixture } from './fixtures/plausibility-v3_5'

function modelFor(universe: Universe, importPayload: (payload: unknown) => void): UniverseContextValue {
  return { baseUniverse: universe, validation: { valid: true, data: universe, errors: [], warnings: [] }, migrated: [], isLoading: false, loadedAt: 0, updateBeatStatus: async () => undefined, importFile: async () => undefined, importPayload, workspaceState: 'base', openCandidate: () => undefined, restoreBase: () => undefined, reset: () => undefined }
}
function setValue(element: HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}

describe('extraction proposal page', () => {
  let container: HTMLDivElement
  let root: Root
  const importPayload = vi.fn()
  const renderPage = async () => {
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root.render(<UniverseContext.Provider value={modelFor(plausibilityFixture, importPayload)}><MemoryRouter><ExtractionPage /></MemoryRouter></UniverseContext.Provider>))
  }
  beforeEach(async () => { localStorage.clear(); importPayload.mockClear(); await proposalRepository.clear(); useStudioStore.setState({ aiExtractionEnabled: false }); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
  afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove() })

  it('exposes the route and remains disabled by default', async () => {
    await renderPage()
    expect(extractionRoute).toBe('/analysis/extraction')
    expect(container.textContent).toContain('Feature flag desactivada')
    expect(importPayload).not.toHaveBeenCalled()
  })

  it('requires review, schema validation, and explicit approval before quarantining a patch', async () => {
    useStudioStore.setState({ aiExtractionEnabled: true }); await renderPage()
    await act(async () => setValue(container.querySelector('[aria-label="Texto fragment-1"]')!, 'ENTITY | cast | new-ally | character | New Ally'))
    const generate = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Generar propuesta local'))!
    await act(async () => { generate.click(); await Promise.resolve() })
    expect(container.textContent).toContain('Propuesta, no canon')
    await act(async () => setValue(container.querySelector('[aria-label="Estado entity-new-ally"]')!, 'accepted'))
    expect(importPayload).not.toHaveBeenCalled()
    const prepare = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Validar y preparar patch'))!
    await act(async () => prepare.click())
    expect(container.textContent).toContain('schema valid')
    expect(container.textContent).toContain('Comparación antes / después')
    expect(importPayload).not.toHaveBeenCalled()
    const approval = container.querySelector<HTMLInputElement>('[aria-label="Aprobar patch explícitamente"]')!
    await act(async () => approval.click())
    const quarantine = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Enviar al Centro de propuestas'))!
    await act(async () => { quarantine.click(); await Promise.resolve() })
    expect(importPayload).not.toHaveBeenCalled()
    expect(await proposalRepository.list()).toHaveLength(1)
    expect((await proposalRepository.list())[0]?.patch?.operations[0]).toMatchObject({ op: 'add' })
  })
})
