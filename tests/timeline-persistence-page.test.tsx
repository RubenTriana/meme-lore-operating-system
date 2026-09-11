import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import master from '../data/universe_master.json'
import { TimelineRenderer } from '../src/renderer/renderers/TimelineRenderer'
import { UniverseContext, type UniverseContextValue } from '../src/app/universe-context'
import { createSemanticIndex } from '../src/utils/semantic-index'
import type { Universe } from '../src/types/universe'

const universe = master as Universe
const timeline = universe.modules.find((module) => module.id === 'timeline')!
const item = timeline.content.items![0]
const storageKey = `meme-lore:timeline:${universe.metadata.version}:local-edits:v1`

function Harness() {
  const [active, setActive] = useState(universe)
  const model: UniverseContextValue = {
    baseUniverse: active,
    validation: { valid: true, data: active, errors: [], warnings: [] },
    migrated: [],
    isLoading: false,
    loadedAt: 0,
    workspaceState: 'base',
    updateBeatStatus: async () => undefined,
    importFile: async () => undefined,
    importPayload: (value) => setActive(value as Universe),
    openCandidate: () => undefined,
    restoreBase: () => undefined,
    reset: () => undefined,
  }
  return (
    <UniverseContext.Provider value={model}>
      <MemoryRouter>
        <TimelineRenderer
          universe={active}
          module={active.modules.find((module) => module.id === 'timeline')!}
          index={createSemanticIndex(active)}
        />
      </MemoryRouter>
    </UniverseContext.Provider>
  )
}

describe('timeline saves to the project', () => {
  let container: HTMLDivElement
  let root: Root
  const fetchMock = vi.fn()
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  const click = async (selector: string) => {
    await act(async () => container.querySelector<HTMLButtonElement>(selector)!.click())
  }

  it('recovers a local draft, saves it to the API and refreshes the visible universe', async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ updates: { [item.id]: { title: 'Título recuperado' } }, deletedIds: [] }),
    )
    await act(async () => root.render(<Harness />))
    expect(container.querySelector('.chronology-item h3')?.textContent).toBe(item.title)
    await click('.timeline-item-edit')
    expect(container.querySelector<HTMLInputElement>('.timeline-edit-title input')?.value).toBe(
      'Título recuperado',
    )
    const saved = structuredClone(universe)
    saved.modules.find((module) => module.id === 'timeline')!.content.items![0].title =
      'Título recuperado'
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ universe: saved, backup: 'respaldo.json' }),
    })
    await click('.timeline-edit-save')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/canon/timeline-unit',
      expect.objectContaining({ method: 'PATCH' }),
    )
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent).toMatchObject({
      action: 'edit',
      id: item.id,
      expectedUpdated: universe.metadata.updated,
      draft: { title: 'Título recuperado' },
    })
    expect(container.querySelector('.chronology-item h3')?.textContent).toBe('Título recuperado')
    expect(container.querySelector('.timeline-save-notice')?.textContent).toContain('guardados')
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('keeps failed edits available for correction without claiming they were saved', async () => {
    await act(async () => root.render(<Harness />))
    await click('.timeline-item-edit')
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'La cronología cambió. Recarga antes de guardar.' }),
    })
    await click('.timeline-edit-save')
    expect(container.querySelector('.timeline-edit-form')).not.toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Recarga')
    expect(container.querySelector('.timeline-save-notice')).toBeNull()
  })

  it('does not send a deletion when confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await act(async () => root.render(<Harness />))
    await click('.timeline-item-delete')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(container.querySelector('.chronology-item h3')?.textContent).toBe(item.title)
  })
})
