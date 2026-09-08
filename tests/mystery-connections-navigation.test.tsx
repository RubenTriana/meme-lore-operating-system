import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import universeData from '../data/universe_master.json'
import { buildSemanticGraphModel } from '../src/graph/semantic-graph-model'
import { MysteryRenderer } from '../src/renderer/renderers/MysteryRenderer'
import { canonicalModuleItems } from '../src/utils/canon-policy'
import { createSemanticIndex } from '../src/utils/semantic-index'
import type { Universe } from '../src/types/universe'

const universe = universeData as unknown as Universe
const mysteriesModule = universe.modules.find((module) => module.id === 'mysteries')!
const mysteries = canonicalModuleItems(universe, mysteriesModule)
const index = createSemanticIndex(universe)

async function renderMysteries(): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<MemoryRouter><MysteryRenderer module={mysteriesModule} universe={universe} index={index} /></MemoryRouter>))
  return { container, root }
}

describe('mystery connection navigation', () => {
  beforeEach(() => { ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true })

  it('publishes only mysteries admitted by canonPolicy', () => {
    expect(mysteriesModule.renderer).toBe('mysteries')
    expect(mysteries).toHaveLength(14)
    const counts = mysteries.reduce<Record<string, number>>((result, mystery) => ({ ...result, [mystery.novelRef ?? 'none']: (result[mystery.novelRef ?? 'none'] ?? 0) + 1 }), {})
    expect(counts).toEqual({ 'meme-novela-uno': 7, 'meme-novela-dos': 4, 'meme-novela-cuatro': 1, none: 2 })
  })

  it('adds a focused graph button to every mystery card', async () => {
    const rendered = await renderMysteries()
    try {
      const links = [...rendered.container.querySelectorAll<HTMLAnchorElement>('.mystery-connections-link')]
      expect(links).toHaveLength(mysteries.length)
      for (const mystery of mysteries) {
        const count = new Set(index.references.get(mystery.id) ?? []).size
        const link = links.find((candidate) => candidate.getAttribute('href') === `/module/relationships?focus=${mystery.id}`)
        expect(link?.textContent).toContain(`Conexiones ${count}`)
      }
    } finally {
      await act(async () => rendered.root.unmount())
      rendered.container.remove()
    }
  })

  it('builds an exact focused graph for every mystery', () => {
    for (const mystery of mysteries) {
      const count = new Set((index.references.get(mystery.id) ?? []).filter((id) => index.entities.has(id))).size
      const model = buildSemanticGraphModel(index, mystery.id)
      expect(count).toBeGreaterThan(0)
      expect(model.nodes).toHaveLength(count + 1)
      expect(model.edges).toHaveLength(count)
      expect(model.nodes[0].id).toBe(mystery.id)
    }
  })
})
