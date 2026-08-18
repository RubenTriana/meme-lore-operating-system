import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import master from '../data/universe_master.json'
import { TimelineRenderer } from '../src/renderer/renderers/TimelineRenderer'
import { createSemanticIndex } from '../src/utils/semantic-index'
import { getEntityNovelRefs, getNovelDescriptors } from '../src/utils/novels'
import type { Universe } from '../src/types/universe'

const universe = master as Universe
const timeline = universe.modules.find((module) => module.id === 'timeline')!
const characters = universe.modules.find((module) => module.id === 'characters')?.content.items ?? []
const index = createSemanticIndex(universe)

describe('tetralogy navigation', () => {
  it('defines four ordered novels and five independently visible time lines', async () => {
    const novels = getNovelDescriptors(universe)
    expect(novels.map((novel) => novel.number)).toEqual([1, 2, 3, 4])
    expect(novels.map((novel) => novel.id)).toEqual(['meme-novela-uno', 'meme-novela-dos', 'meme-novela-tres', 'meme-novela-cuatro'])

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    await act(async () => root.render(<MemoryRouter><TimelineRenderer module={timeline} universe={universe} index={index} /></MemoryRouter>))
    expect(container.querySelectorAll('.timeline-group')).toHaveLength(5)
    expect(container.querySelectorAll('.chronology-item')).toHaveLength(96)

    const novelThree = [...container.querySelectorAll<HTMLButtonElement>('.novel-navigator button')].find((button) => button.textContent?.includes('La Bolsa de las Voluntades'))!
    await act(async () => novelThree.click())
    expect(container.querySelectorAll('.timeline-group')).toHaveLength(1)
    expect(container.querySelector('[data-novel="meme-novela-tres"]')).not.toBeNull()
    expect(container.querySelectorAll('.chronology-item')).toHaveLength(21)

    await act(async () => root.unmount())
    container.remove()
  })

  it('assigns every character to one or more resolvable novels', () => {
    const novelIds = new Set(getNovelDescriptors(universe).map((novel) => novel.id))
    expect(characters).toHaveLength(13)
    for (const character of characters) {
      const references = getEntityNovelRefs(character)
      expect(references.length).toBeGreaterThan(0)
      expect(references.every((reference) => novelIds.has(reference))).toBe(true)
    }
  })

  it('keeps every narrative ownership field resolvable in the semantic graph', () => {
    for (const entity of index.entities.values()) {
      for (const reference of getEntityNovelRefs(entity)) expect(index.entities.has(reference)).toBe(true)
      if (entity.sagaRef) expect(index.entities.has(entity.sagaRef)).toBe(true)
      for (const cause of entity.causedByRefs ?? []) expect(index.entities.has(cause)).toBe(true)
    }
  })
})
