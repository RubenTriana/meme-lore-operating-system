import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import master from '../data/universe_master.json'
import { UniverseContext, type UniverseContextValue } from '../src/app/universe-context'
import { InsightsPage } from '../src/pages/InsightsPage'
import type { Universe } from '../src/types/universe'
import { analyzeNarrative } from '../src/utils/narrative-analysis'
import { parseGeniusResponse } from '../vite-genius-plugin'

const universe = master as Universe

function model(): UniverseContextValue {
  return {
    baseUniverse: universe,
    validation: { valid: true, data: universe, errors: [], warnings: [] },
    migrated: [],
    isLoading: false,
    loadedAt: 0,
    workspaceState: 'base',
    updateBeatStatus: async () => undefined,
    importFile: async () => undefined,
    importPayload: () => undefined,
    openCandidate: () => undefined,
    restoreBase: () => undefined,
    reset: () => undefined,
  }
}

describe('Genius insights', () => {
  it('accepts exactly two complete possibilities', () => {
    expect(parseGeniusResponse({ possibilities: [
      { title: 'Primera', explanation: 'Explicación lógica.' },
      { title: 'Segunda', explanation: 'Explicación sorprendente.' },
    ] })).toHaveLength(2)
    expect(() => parseGeniusResponse({ possibilities: [{ title: 'Única', explanation: 'Insuficiente.' }] })).toThrow('exactamente dos')
  })

  it('renders one Genius control and one response box for each of the 28 current insights', async () => {
    expect(analyzeNarrative(universe)).toHaveLength(28)
    const container = document.createElement('div')
    document.body.append(container)
    const root: Root = createRoot(container)
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    await act(async () => root.render(<UniverseContext.Provider value={model()}><MemoryRouter><InsightsPage /></MemoryRouter></UniverseContext.Provider>))

    expect(container.querySelectorAll('.genius-button')).toHaveLength(28)
    expect(container.querySelectorAll('.genius-response')).toHaveLength(28)

    await act(async () => root.unmount())
    container.remove()
  })

  it('writes the two generated possibilities only into the selected card', async () => {
    const response = { possibilities: [
      { title: 'Hipótesis A', explanation: 'Una lógica posible.' },
      { title: 'Hipótesis B', explanation: 'Una sorpresa coherente.' },
    ] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => response }))
    const container = document.createElement('div')
    document.body.append(container)
    const root: Root = createRoot(container)
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    await act(async () => root.render(<UniverseContext.Provider value={model()}><MemoryRouter><InsightsPage /></MemoryRouter></UniverseContext.Provider>))
    const buttons = container.querySelectorAll<HTMLButtonElement>('.genius-button')
    await act(async () => buttons[0].click())

    const boxes = container.querySelectorAll<HTMLTextAreaElement>('.genius-response')
    expect(boxes[0].value).toContain('1. Hipótesis A')
    expect(boxes[0].value).toContain('2. Hipótesis B')
    expect(boxes[1].value).toBe('')

    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })
})
