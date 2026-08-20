import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { CodexReaderPage } from '../src/pages/CodexReaderPage'

function selectValue(select: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('Codex stratified artifact', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(<MemoryRouter><CodexReaderPage /></MemoryRouter>))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('opens as a material reconstruction with a native Seed Language fragment', () => {
    expect(container.querySelector('.codex-artifact')?.getAttribute('data-fragment')).toBe('CVI-F01')
    expect(container.querySelectorAll('.seed-inscription')).toHaveLength(1)
    expect(container.querySelectorAll('.seed-glyph').length).toBeGreaterThan(8)
    expect(container.textContent).toContain('Mano del Custodio')
    expect(container.textContent).not.toContain('𒇷𒈨𒉡 · LIMEN')
    expect(container.querySelector('.codex-collation')?.hasAttribute('open')).toBe(false)
  })

  it('varies the page archetype and separates Clay mathematics into modern scholia', async () => {
    const [editionSelect, bookSelect] = [...container.querySelectorAll<HTMLSelectElement>('select')]
    await act(async () => selectValue(bookSelect, '1'))
    expect(container.querySelector('.codex-artifact')?.classList.contains('archetype-ritual-diagram')).toBe(true)
    expect(container.querySelectorAll('.ritual-diagram')).toHaveLength(1)
    expect(container.textContent).toContain('quinto radio')

    await act(async () => selectValue(editionSelect, 'clay-memoir'))
    expect(container.querySelectorAll('.seed-inscription')).toHaveLength(0)
    expect(container.querySelector('.modern-scholia')).not.toBeNull()
    expect(container.textContent).toContain('Escolios matemáticos de atribución dudosa')
  })

  it('translates anachronisms in the artifact layer and exposes print export', async () => {
    const [, bookSelect] = [...container.querySelectorAll<HTMLSelectElement>('select')]
    await act(async () => selectValue(bookSelect, '8'))
    expect(container.textContent).toContain('tres dientes en una caja sin aliento')
    expect(container.textContent).not.toContain('tres interruptores')

    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const printButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Imprimir / PDF'))!
    await act(async () => printButton.click())
    expect(printSpy).toHaveBeenCalledOnce()
    printSpy.mockRestore()
  })
})
