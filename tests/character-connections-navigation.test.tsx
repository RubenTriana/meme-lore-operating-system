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
  await act(async () => root.render(<MemoryRouter><CharacterRenderer module={charactersModule} universe={universe} index={index} /></MemoryRouter>))
  return { container, root }
}

describe('character connection navigation', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.stubGlobal('ResizeObserver', class { observe() {}; unobserve() {}; disconnect() {} })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('adds a focused Relationships link to every current character card', async () => {
    const rendered = await renderCharacters()
    try {
      const links = rendered.container.querySelectorAll<HTMLAnchorElement>('.character-connections-link')
      expect(links).toHaveLength(22)
      const clayConnections = new Set(index.references.get('meme-clay') ?? []).size
      const clayLink = [...links].find((link) => link.getAttribute('href') === '/module/relationships?focus=meme-clay')
      expect(clayLink?.textContent).toContain(`Conexiones ${clayConnections}`)
    } finally {
      await act(async () => rendered.root.unmount())
      rendered.container.remove()
    }
  })

  it('builds a radial Clay graph from every resolvable canonical connection', () => {
    const connectionCount = new Set(index.references.get('meme-clay') ?? []).size
    const model = buildSemanticGraphModel(index, 'meme-clay')
    expect(connectionCount).toBeGreaterThan(4)
    expect(model.nodes).toHaveLength(connectionCount + 1)
    expect(model.edges).toHaveLength(connectionCount)
    expect(model.nodes[0].id).toBe('meme-clay')
    expect(model.edges.every((edge) => edge.source === 'meme-clay')).toBe(true)
  })

  it('falls back to the complete semantic graph for an unknown focus', () => {
    expect(buildSemanticGraphModel(index, 'missing-character').nodes).toHaveLength(index.entities.size)
  })
})
