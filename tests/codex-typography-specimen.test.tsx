import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { CodexTypographySpecimen } from '../src/pages/CodexTypographySpecimen'

describe('Codex typography specimen', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    await act(async () => root.render(<MemoryRouter><CodexTypographySpecimen /></MemoryRouter>))
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('documents five hands, the selected families and the Spanish repertoire', () => {
    expect(container.querySelectorAll('.specimen-hand')).toHaveLength(5)
    expect(container.textContent).toContain('Alegreya')
    expect(container.textContent).toContain('EB Garamond')
    expect(container.textContent).toContain('á é í ó ú')
    expect(container.textContent).toContain('ñ Ñ')
    expect(container.textContent).toContain('¿?')
    expect(container.textContent).toContain('«comillas»')
  })

  it('keeps drawn capitals selectable and Seed Language non-human', () => {
    expect(container.querySelectorAll('.type-capitals .codex-drop-cap')).toHaveLength(3)
    expect(container.querySelectorAll('.type-seed-specimen .seed-glyph')).toHaveLength(8)
    expect(container.textContent).toContain('sistema vectorial propio')
  })
})
