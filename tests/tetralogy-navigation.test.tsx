import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import master from '../data/universe_master.json'
import { TimelineRenderer } from '../src/renderer/renderers/TimelineRenderer'
import { formatChronologyBlockForClipboard } from '../src/timeline/format'
import { canonicalModuleItems } from '../src/utils/canon-policy'
import { createSemanticIndex } from '../src/utils/semantic-index'
import { getEntityNovelRefs, getNovelDescriptors } from '../src/utils/novels'
import type { Universe } from '../src/types/universe'

const universe = master as Universe
const timeline = universe.modules.find((module) => module.id === 'timeline')!
const charactersModule = universe.modules.find((module) => module.id === 'characters')!
const characters = canonicalModuleItems(universe, charactersModule)
const timelineItems = canonicalModuleItems(universe, timeline)
const index = createSemanticIndex(universe)

describe('tetralogy navigation', () => {
  it('defines four ordered novels and five independently visible time lines', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const novels = getNovelDescriptors(universe)
    expect(novels.map((novel) => novel.number)).toEqual([1, 2, 3, 4])
    expect(novels.map((novel) => novel.id)).toEqual(['meme-novela-uno', 'meme-novela-dos', 'meme-novela-tres', 'meme-novela-cuatro'])

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    await act(async () => root.render(<MemoryRouter><TimelineRenderer module={timeline} universe={universe} index={index} /></MemoryRouter>))
    expect(container.querySelectorAll('.timeline-group')).toHaveLength(5)
    expect(container.querySelectorAll('.chronology-item')).toHaveLength(59)
    expect(container.querySelectorAll('.timeline-block-copy')).toHaveLength(5)

    const prehistoryEvents = timelineItems.filter((item) => !item.novelRef)
    const prehistoryCopyButton = container.querySelector<HTMLButtonElement>('[data-novel="pre-saga"] .timeline-block-copy')!
    await act(async () => prehistoryCopyButton.click())
    expect(writeText).toHaveBeenLastCalledWith(formatChronologyBlockForClipboard('Prehistoria · Antes de la saga', 0, prehistoryEvents))
    expect(writeText.mock.calls[0][0]).toContain('# Prehistoria · Antes de la saga')
    expect(writeText.mock.calls[0][0]).toContain('8 hitos cronológicos')
    expect(writeText.mock.calls[0][0]).toContain('1. **0100 · El capital encarga reducir el coste de cómputo**')
    expect(writeText.mock.calls[0][0]).toContain('8. **0800 · Amaranta desaparece con los fragmentos**')
    expect(prehistoryCopyButton.textContent).toContain('Prehistoria copiada')

    const novelOne = novels[0]
    const novelOneEvents = timelineItems.filter((item) => item.novelRef === novelOne.id)
    const novelOneCopyButton = container.querySelector<HTMLButtonElement>('[data-novel="meme-novela-uno"] .timeline-block-copy')!
    await act(async () => novelOneCopyButton.click())
    expect(writeText).toHaveBeenCalledWith(formatChronologyBlockForClipboard(novelOne.title.replace(/^Novela\s+\d+\s+[—-]\s+/i, ''), novelOne.number, novelOneEvents))
    expect(writeText.mock.calls[1][0]).toContain('# Novela 1 — Operación Tántalo')
    expect(writeText.mock.calls[1][0]).toContain('42 hitos cronológicos')
    expect(writeText.mock.calls[1][0]).toContain('1. **1010 · 1 — El pasajero sin nombre**')
    expect(writeText.mock.calls[1][0]).toContain('42. **1420 · 36 — Buscar sin reclamar: la voz de este lado**')
    expect(novelOneCopyButton.textContent).toContain('Novela copiada')

    const novelThree = [...container.querySelectorAll<HTMLButtonElement>('.novel-navigator button')].find((button) => button.textContent?.includes('Los Futuros del Alma'))!
    await act(async () => novelThree.click())
    expect(container.querySelectorAll('.timeline-group')).toHaveLength(1)
    expect(container.querySelector('[data-novel="meme-novela-tres"]')).not.toBeNull()
    expect(container.querySelectorAll('.chronology-item')).toHaveLength(1)

    await act(async () => root.unmount())
    container.remove()
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('assigns every character to one or more resolvable novels', () => {
    const novelIds = new Set(getNovelDescriptors(universe).map((novel) => novel.id))
    expect(characters).toHaveLength(22)
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
