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

function withEditorialGaps(): Universe {
  const fixture = structuredClone(universe)
  const characters = fixture.modules.find((module) => module.id === 'characters')?.content.items ?? []
  characters.filter((character) => ['meme-clay', 'meme-amaranta'].includes(character.id)).forEach((character) => { character.development = 40 })
  return fixture
}

function model(value: Universe): UniverseContextValue {
  return {
    baseUniverse: value,
    validation: { valid: true, data: value, errors: [], warnings: [] },
    migrated: [], isLoading: false, loadedAt: 0, workspaceState: 'base',
    updateBeatStatus: async () => undefined, importFile: async () => undefined, importPayload: () => undefined,
    openCandidate: () => undefined, restoreBase: () => undefined, reset: () => undefined,
  }
}

async function renderInsights(value: Universe): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  await act(async () => root.render(<UniverseContext.Provider value={model(value)}><MemoryRouter><InsightsPage /></MemoryRouter></UniverseContext.Provider>))
  return { container, root }
}

describe('Genius insights', () => {
  it('accepts exactly two complete possibilities', () => {
    expect(parseGeniusResponse({ possibilities: [
      { title: 'Primera', explanation: 'Explicación lógica.' },
      { title: 'Segunda', explanation: 'Explicación sorprendente.' },
    ] })).toHaveLength(2)
    expect(() => parseGeniusResponse({ possibilities: [{ title: 'Única', explanation: 'Insuficiente.' }] })).toThrow('exactamente dos')
  })

  it('surfaces the deliberate development gaps in the current canon', async () => {
    expect(analyzeNarrative(universe).map((insight) => insight.id)).toEqual([
      'development-meme-ruth',
      'foreshadowing-meme-ruth',
      'development-meme-vicente',
    ])
    const rendered = await renderInsights(universe)
    expect(rendered.container.querySelectorAll('.genius-button')).toHaveLength(3)
    expect(rendered.container.textContent).toContain('Ruth needs development')
    expect(rendered.container.textContent).toContain('Vicente needs development')
    await act(async () => rendered.root.unmount())
    rendered.container.remove()
  })

  it('renders one Genius workspace per deterministic insight and isolates its response', async () => {
    const fixture = withEditorialGaps()
    const insightCount = analyzeNarrative(fixture).length
    expect(insightCount).toBeGreaterThanOrEqual(2)
    const response = { possibilities: [
      { title: 'Hipótesis A', explanation: 'Una lógica posible.' },
      { title: 'Hipótesis B', explanation: 'Una sorpresa coherente.' },
    ] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => response }))
    const rendered = await renderInsights(fixture)
    const buttons = rendered.container.querySelectorAll<HTMLButtonElement>('.genius-button')
    const boxes = rendered.container.querySelectorAll<HTMLTextAreaElement>('.genius-response')
    expect(buttons).toHaveLength(insightCount)
    expect(boxes).toHaveLength(insightCount)
    await act(async () => buttons[0].click())
    expect(boxes[0].value).toContain('1. Hipótesis A')
    expect(boxes[0].value).toContain('2. Hipótesis B')
    expect(boxes[1].value).toBe('')
    await act(async () => rendered.root.unmount())
    rendered.container.remove()
    vi.unstubAllGlobals()
  })
})
