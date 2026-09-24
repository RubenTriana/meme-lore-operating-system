import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { vi } from 'vitest'
import { WritingProgressPage } from '../src/pages/WritingProgressPage'
import progress from '../data/writing_progress.json'
import master from '../data/universe_master.json'
import { UniverseContext, type UniverseContextValue } from '../src/app/universe-context'
import type { Universe } from '../src/types/universe'

const storageKey = 'meme-lore:writing-progress:meme-novela-uno:unit-statuses:v1'
const wordsStorageKey = 'meme-lore:writing-progress:meme-novela-uno:unit-words:v1'
const latestSavedSnapshot = progress.snapshots.at(-1)!
const latestSavedWords = new Intl.NumberFormat('es-CO').format(latestSavedSnapshot.words)
const latestSavedSource =
  latestSavedSnapshot.source === 'manual' ? 'registradas por ti' : 'verificadas'

// The chart's layout is independent of status persistence and has no size in jsdom.
vi.mock('recharts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: () => null,
}))

describe('manual writing progress', () => {
  let container: HTMLDivElement
  let root: Root
  const fetchMock = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ progress, revision: 'a'.repeat(64) }),
    })
    vi.stubGlobal('fetch', fetchMock)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  const unitNine = () =>
    container.querySelector<HTMLButtonElement>('button[aria-label^="Unidad 9:"]')!

  it('stores words per unit and restores a manually completed unit when reopened', async () => {
    await act(async () => root.render(<WritingProgressPage />))
    expect(unitNine().getAttribute('aria-label')).toContain('sin iniciar')
    await act(async () => unitNine().click())
    const wordsInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Palabras escritas en unidad 9"]',
    )!
    await act(async () => {
      const setInputValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set
      setInputValue?.call(wordsInput, '1234')
      wordsInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(unitNine().getAttribute('aria-label')).toContain('parcial')
    expect(container.querySelector('.unit-count')?.textContent).toContain('1.234')
    const completed = container.querySelector<HTMLInputElement>(
      'input[aria-label="Marcar unidad 9 como completada"]',
    )!
    await act(async () => completed.click())
    expect(unitNine().getAttribute('aria-label')).toContain('completa')

    await act(async () => root.unmount())
    root = createRoot(container)
    await act(async () => root.render(<WritingProgressPage />))

    expect(unitNine().getAttribute('aria-label')).toContain('completa')
    expect(container.querySelector('.unit-map')?.getAttribute('aria-label')).toBe(
      '6 unidades completas, 3 parciales y 34 sin iniciar',
    )
    expect(container.querySelector('.forecast-orb strong')?.textContent).toBe('17,4%')
    expect(container.querySelector('.forecast-progress-line')?.textContent).toContain(
      `${latestSavedWords} palabras ${latestSavedSource}`,
    )
    await act(async () => unitNine().click())
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Palabras escritas en unidad 9"]')
        ?.value,
    ).toBe('1234')
    expect(JSON.parse(localStorage.getItem(storageKey)!)[8]).toBe('complete')
    expect(JSON.parse(localStorage.getItem(wordsStorageKey)!)[8]).toBe(1234)

    const restoredCompleted = container.querySelector<HTMLInputElement>(
      'input[aria-label="Marcar unidad 9 como completada"]',
    )!
    await act(async () => restoredCompleted.click())
    expect(container.querySelector('.forecast-orb strong')?.textContent).toBe('16,3%')
    expect(JSON.parse(localStorage.getItem(storageKey)!)[8]).toBe('partial')
  })

  it('shows an empty map without a fabricated forecast after reloading saved states', async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify(Array(progress.novel.totalUnits).fill('untouched')),
    )
    await act(async () => root.render(<WritingProgressPage />))

    expect(container.querySelector('.forecast-orb strong')?.textContent).toBe('0%')
    expect(container.querySelector('.forecast-copy')?.textContent).toContain(
      'Sin avance suficiente',
    )
    expect(container.querySelector('.forecast-copy')?.textContent).not.toContain('Proyección de')
    expect(container.querySelector('.unit-map')?.getAttribute('aria-label')).toBe(
      '0 unidades completas, 0 parciales y 43 sin iniciar',
    )
  })

  it('inserts the new canonical unit without shifting legacy local marks', async () => {
    const legacyStatuses = Array(progress.novel.totalUnits - 1).fill('untouched')
    const legacyWords = Array(progress.novel.totalUnits - 1).fill(0)
    legacyStatuses[19] = 'complete'
    legacyWords[19] = 777
    localStorage.setItem(storageKey, JSON.stringify(legacyStatuses))
    localStorage.setItem(wordsStorageKey, JSON.stringify(legacyWords))

    await act(async () => root.render(<WritingProgressPage />))

    expect(
      container
        .querySelector<HTMLButtonElement>('button[aria-label^="Unidad 20:"]')
        ?.getAttribute('aria-label'),
    ).toContain('sin iniciar')
    const shiftedUnit = container.querySelector<HTMLButtonElement>(
      'button[aria-label^="Unidad 21:"]',
    )!
    expect(shiftedUnit.getAttribute('aria-label')).toContain('completa')
    await act(async () => shiftedUnit.click())
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Palabras escritas en unidad 21"]')
        ?.value,
    ).toBe('777')
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toHaveLength(
      progress.novel.totalUnits,
    )
    expect(JSON.parse(localStorage.getItem(wordsStorageKey)!)).toHaveLength(
      progress.novel.totalUnits,
    )
  })

  it('saves a total and immediately compares it with the 110000-word goal', async () => {
    await act(async () => root.render(<WritingProgressPage />))
    const input = container.querySelector<HTMLInputElement>('#written-words')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        '55000',
      )
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        progress: {
          ...progress,
          snapshots: [
            ...progress.snapshots,
            {
              date: new Date(
                Math.max(...progress.snapshots.map((snapshot) => Date.parse(snapshot.date))) +
                  86_400_000,
              ).toISOString().slice(0, 10),
              words: 55000,
              source: 'manual',
              label: 'Conteo actualizado por el autor',
            },
          ],
        },
        revision: 'b'.repeat(64),
      }),
    })
    await act(async () => {
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/writing-progress',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ words: 55000, expectedRevision: 'a'.repeat(64) }),
      }),
    )
    expect(container.querySelector('.writing-word-comparison')?.textContent).toContain(
      '50% de la meta',
    )
    expect(container.textContent).toContain('Faltan 55.000 palabras')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Conteo guardado')
    expect(container.querySelector('.forecast-progress-line')?.textContent).toContain(
      '55.000 palabras registradas por ti',
    )
  })

  it('keeps the saved metrics when the server rejects a count', async () => {
    await act(async () => root.render(<WritingProgressPage />))
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'El conteo cambió en otra ventana.' }),
    })
    await act(async () => {
      container
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('otra ventana')
    expect(container.querySelector('.writing-word-comparison')?.textContent).toContain(
      `${latestSavedWords} / 110.000 palabras`,
    )
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('keeps marks attached to their units after a deletion and a reordering', async () => {
    const universe = structuredClone(master) as Universe
    const timeline = universe.modules.find((module) => module.id === 'timeline')!
    timeline.content.items = timeline.content.items!.filter(
      (item) => item.id !== 'meme-n1-escena-02',
    )
    timeline.content.items.find((item) => item.id === 'meme-n1-escena-03')!.sequence = 9999
    const model: UniverseContextValue = {
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
    await act(async () =>
      root.render(
        <UniverseContext.Provider value={model}>
          <WritingProgressPage />
        </UniverseContext.Provider>,
      ),
    )
    expect(container.querySelectorAll('.unit-map button')).toHaveLength(
      progress.novel.totalUnits,
    )
    const deletedUnit = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Unidad 2: borrada u oculta."]',
    )!
    expect(deletedUnit.classList.contains('hidden')).toBe(true)
    expect(deletedUnit.disabled).toBe(true)
    expect(deletedUnit.querySelector('.unit-hidden-mark')).not.toBeNull()
    expect(
      container.querySelector('button[aria-label^="Unidad 3:"]')?.classList.contains('complete'),
    ).toBe(true)
    expect(container.querySelector('.unit-map')?.getAttribute('aria-label')).toBe(
      '5 unidades completas, 2 parciales y 35 sin iniciar, 1 unidad borrada u oculta',
    )
  })

  it('marks a locally hidden chronology unit in red without counting it as active', async () => {
    const universe = structuredClone(master) as Universe
    const model: UniverseContextValue = {
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
    localStorage.setItem(
      `meme-lore:timeline:${universe.metadata.version}:local-edits:v1`,
      JSON.stringify({ updates: {}, deletedIds: ['meme-n1-escena-09'] }),
    )

    await act(async () =>
      root.render(
        <UniverseContext.Provider value={model}>
          <WritingProgressPage />
        </UniverseContext.Provider>,
      ),
    )

    const hiddenUnit = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Unidad 9: borrada u oculta."]',
    )!
    expect(hiddenUnit.classList.contains('hidden')).toBe(true)
    expect(hiddenUnit.disabled).toBe(true)
    expect(container.querySelector('.unit-legend')?.textContent).toContain(
      '1 unidad borrada u oculta',
    )
    expect(container.querySelector('.unit-map')?.getAttribute('aria-label')).toContain(
      '1 unidad borrada u oculta',
    )
  })
})
