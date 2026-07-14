import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { plausibilityRoute } from '../src/app/routes'
import { UniverseContext, type UniverseContextValue } from '../src/app/universe-context'
import { PlausibilityPage } from '../src/pages/PlausibilityPage'
import type { Universe } from '../src/types/universe'
import { plausibilityFixture } from './fixtures/plausibility-v3_5'

function modelFor(universe: Universe): UniverseContextValue {
  return { baseUniverse: universe, validation: { valid: true, data: universe, errors: [], warnings: [] }, migrated: [], isLoading: false, loadedAt: 0, importFile: async () => undefined, importPayload: () => undefined, workspaceState: 'base', openCandidate: () => undefined, restoreBase: () => undefined, reset: () => undefined }
}
function setValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}

describe('plausibility page', () => {
  let container: HTMLDivElement
  let root: Root
  beforeEach(async () => {
    localStorage.clear(); (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root.render(<UniverseContext.Provider value={modelFor(plausibilityFixture)}><MemoryRouter><PlausibilityPage /></MemoryRouter></UniverseContext.Provider>))
  })
  afterEach(async () => { await act(async () => root.unmount()); container.remove() })

  it('exposes the route, requires an author hypothesis, and displays score plus coverage', async () => {
    expect(plausibilityRoute).toBe('/analysis/plausibility')
    expect(container.textContent).toContain('El sistema nunca genera hipótesis automáticamente')
    await act(async () => {
      setValue(container.querySelector('[aria-label="ID de hipótesis"]')!, 'clay-protects-refuge')
      setValue(container.querySelector('[aria-label="Actor"]')!, 'clay')
      setValue(container.querySelector('[aria-label="Acción"]')!, 'protect refuge during enemy siege')
      setValue(container.querySelector('[aria-label="Objetivo opcional"]')!, 'refuge')
      setValue(container.querySelector('[aria-label="Evento de contexto opcional"]')!, 'siege')
    })
    await act(async () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!.click())
    expect(container.textContent).toContain('/100')
    expect(container.textContent).toContain('Cobertura de datos: 100%')
    expect(container.textContent).toContain('No es una predicción')
    expect(container.textContent).toContain('Sensibilidad a pesos')
  })

  it('saves an editable profile in browser-local storage', async () => {
    await act(async () => setValue(container.querySelector('[aria-label="Nombre del perfil"]')!, 'Perfil alternativo'))
    const save = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Guardar perfil'))!
    await act(async () => save.click())
    expect(container.querySelector<HTMLSelectElement>('[aria-label="Perfil de plausibilidad"]')?.value).toBe('perfil-alternativo')
    expect(localStorage.length).toBe(1)
  })
})
