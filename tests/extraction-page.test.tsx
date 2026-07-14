import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { extractionRoute } from '../src/app/routes'
import { UniverseContext, type UniverseContextValue } from '../src/app/universe-context'
import { ExtractionPage } from '../src/pages/ExtractionPage'
import { useStudioStore } from '../src/store/useStudioStore'
import type { Universe } from '../src/types/universe'
import { plausibilityFixture } from './fixtures/plausibility-v3_5'

function modelFor(universe: Universe, importPayload: (payload: unknown) => void): UniverseContextValue {
  return { validation: { valid: true, data: universe, errors: [], warnings: [] }, migrated: [], isLoading: false, loadedAt: 0, importFile: async () => undefined, importPayload, reset: () => undefined }
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
  beforeEach(() => { localStorage.clear(); importPayload.mockClear(); useStudioStore.setState({ aiExtractionEnabled: false }); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })
  afterEach(async () => { if (root) await act(async () => root.unmount()); container?.remove() })

  it('exposes the route and remains disabled by default', async () => {
    await renderPage()
    expect(extractionRoute).toBe('/analysis/extraction')
    expect(container.textContent).toContain('Feature flag desactivada')
    expect(importPayload).not.toHaveBeenCalled()
  })

  it('requires review, schema validation, and explicit approval before applying a patch', async () => {
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
    const apply = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Aprobar y aplicar patch'))!
    await act(async () => apply.click())
    expect(importPayload).toHaveBeenCalledTimes(1)
    expect(importPayload.mock.calls[0]?.[0]).toMatchObject({ operations: [{ op: 'add' }] })
  })
})
