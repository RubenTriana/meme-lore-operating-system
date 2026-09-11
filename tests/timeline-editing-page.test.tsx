import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import master from '../data/universe_master.json'
import { TimelineRenderer } from '../src/renderer/renderers/TimelineRenderer'
import { Chronology } from '../src/timeline/Chronology'
import { canonicalModuleItems } from '../src/utils/canon-policy'
import { createSemanticIndex } from '../src/utils/semantic-index'
import type { Universe } from '../src/types/universe'

const universe = master as Universe
const timeline = universe.modules.find((module) => module.id === 'timeline')!
const item = canonicalModuleItems(universe, timeline)[0]
const singleItemTimeline = {
  ...timeline,
  content: { ...timeline.content, items: [item] },
}
const index = createSemanticIndex(universe)

describe('timeline unit controls', () => {
  it('opens an editor, saves the unit and exposes deletion', async () => {
    const onSave = vi.fn()
    const onDelete = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

    await act(async () =>
      root.render(
        <MemoryRouter>
          <Chronology
            items={[item]}
            index={index}
            universe={universe}
            onSave={onSave}
            onDelete={onDelete}
          />
        </MemoryRouter>,
      ),
    )

    await act(async () =>
      container.querySelector<HTMLButtonElement>('.timeline-item-edit')!.click(),
    )
    expect(container.querySelector('.timeline-edit-form')).not.toBeNull()
    expect(container.querySelector<HTMLInputElement>('.timeline-edit-title input')?.value).toBe(
      item.title,
    )

    await act(async () =>
      container.querySelector<HTMLButtonElement>('.timeline-edit-save')!.click(),
    )
    expect(onSave).toHaveBeenCalledWith(
      item.id,
      expect.objectContaining({ title: item.title, summary: item.summary }),
    )
    expect(container.querySelector('.timeline-edit-form')).toBeNull()

    await act(async () =>
      container.querySelector<HTMLButtonElement>('.timeline-item-delete')!.click(),
    )
    expect(onDelete).toHaveBeenCalledWith(item)

    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('restores saved unit changes when the timeline is reopened', async () => {
    localStorage.clear()
    const container = document.createElement('div')
    document.body.append(container)
    let root = createRoot(container)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)

    await act(async () =>
      root.render(
        <MemoryRouter>
          <TimelineRenderer module={singleItemTimeline} universe={universe} index={index} />
        </MemoryRouter>,
      ),
    )
    await act(async () =>
      container.querySelector<HTMLButtonElement>('.timeline-item-edit')!.click(),
    )
    const titleInput = container.querySelector<HTMLInputElement>('.timeline-edit-title input')!
    await act(async () => {
      const setInputValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set
      setInputValue?.call(titleInput, 'Unidad guardada localmente')
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () =>
      container.querySelector<HTMLButtonElement>('.timeline-edit-save')!.click(),
    )

    const storageKey = `meme-lore:timeline:${universe.metadata.version}:local-edits:v1`
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({
      updates: { [item.id]: { title: 'Unidad guardada localmente' } },
    })

    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () =>
      root.render(
        <MemoryRouter>
          <TimelineRenderer module={singleItemTimeline} universe={universe} index={index} />
        </MemoryRouter>,
      ),
    )
    expect(container.querySelector('.chronology-item h3')?.textContent).toBe(
      'Unidad guardada localmente',
    )

    await act(async () => root.unmount())
    container.remove()
    localStorage.clear()
    vi.unstubAllGlobals()
  })
})
