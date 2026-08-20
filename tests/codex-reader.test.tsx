import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { CodexReaderPage } from '../src/pages/CodexReaderPage'

function selectValue(select: HTMLSelectElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value)
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('Codex symbolic apparatus', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(<CodexReaderPage />))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('splits the eight axioms between geometric constructions and LIMEN programs', async () => {
    expect(container.querySelectorAll('.codex-math-plate')).toHaveLength(2)
    expect(container.querySelectorAll('.codex-axiom-drawing')).toHaveLength(1)
    expect(container.querySelectorAll('.codex-proto-code')).toHaveLength(1)
    expect(container.textContent).toContain('𒇷𒈨𒉡 · LIMEN')
    expect(container.textContent).toContain('𒁍 𒈨𒀀, 𒄩, 𒉿')
    const toggle = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Aparato simbólico'))!
    expect(toggle.getAttribute('aria-pressed')).toBe('true')

    await act(async () => toggle.click())
    expect(container.querySelectorAll('.codex-math-plate')).toHaveLength(0)
    expect(container.querySelectorAll('.codex-geometry-plate')).toHaveLength(0)
  })

  it('renders the geometric mandala in book II and protects the original edition', async () => {
    const [editionSelect, bookSelect] = [...container.querySelectorAll<HTMLSelectElement>('select')]
    await act(async () => selectValue(bookSelect, '1'))
    expect(container.querySelectorAll('.codex-geometry-plate')).toHaveLength(1)
    expect(container.querySelectorAll('.codex-axiom-drawing')).toHaveLength(1)
    expect(container.textContent).toContain('Mandala de las cuatro hipótesis')

    await act(async () => selectValue(editionSelect, 'master'))
    expect(container.querySelectorAll('.codex-math-plate')).toHaveLength(0)
    expect(container.querySelectorAll('.codex-geometry-plate')).toHaveLength(0)
    const toggle = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Aparato simbólico'))!
    expect(toggle.disabled).toBe(true)
  })
})
