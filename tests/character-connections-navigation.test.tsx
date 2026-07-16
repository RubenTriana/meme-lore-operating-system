import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import universeData from '../data/universe_master.json'
import { buildSemanticGraphModel } from '../src/graph/semantic-graph-model'
import { CharacterRenderer } from '../src/renderer/renderers/CharacterRenderer'
import { createSemanticIndex } from '../src/utils/semantic-index'
import type { Universe } from '../src/types/universe'

vi.mock('../src/charts/DevelopmentRadar', () => ({ DevelopmentRadar: () => <div data-testid="radar-placeholder" /> }))

const universe = universeData as unknown as Universe
const charactersModule = universe.modules.find((module) => module.id === 'characters')!
const index = createSemanticIndex(universe)

async function renderCharacters(): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(<MemoryRouter><CharacterRenderer module={charactersModule} universe={universe} index={index} /></MemoryRouter>)
  })
  return { container, root }
}

describe('character connection navigation', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.stubGlobal('ResizeObserver', class { observe() {}; unobserve() {}; disconnect() {} })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('adds a focused Relationships link to every character card', async () => {
    const rendered = await renderCharacters()
    try {
      const links = rendered.container.querySelectorAll<HTMLAnchorElement>('.character-connections-link')
      expect(links).toHaveLength(charactersModule.content.items?.length ?? 0)
      const clayLink = rendered.container.querySelector<HTMLAnchorElement>('[aria-label="Show 33 connections for Clay"]')
      expect(clayLink?.getAttribute('href')).toBe('/module/relationships?focus=meme-clay')
      expect(clayLink?.textContent).toContain('Connections 33')
    } finally {
      await act(async () => rendered.root.unmount())
      rendered.container.remove()
    }
  })

  it('builds a radial Clay graph with one central node and its 33 declared connections', () => {
    const model = buildSemanticGraphModel(index, 'meme-clay')

    expect(model.nodes).toHaveLength(34)
    expect(model.edges).toHaveLength(33)
    expect(model.nodes[0].id).toBe('meme-clay')
    expect(model.edges.every((edge) => edge.source === 'meme-clay')).toBe(true)
  })

  it('falls back to the complete semantic graph for an unknown focus', () => {
    const model = buildSemanticGraphModel(index, 'missing-character')
    expect(model.nodes).toHaveLength(index.entities.size)
  })
})
