import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import master from '../data/universe_master.json'
import { CharacterRenderer } from '../src/renderer/renderers/CharacterRenderer'
import { createSemanticIndex } from '../src/utils/semantic-index'
import type { Universe } from '../src/types/universe'

vi.mock('../src/charts/DevelopmentRadar', () => ({ DevelopmentRadar: () => <div data-testid="radar-placeholder" /> }))

const universe = master as Universe
const charactersModule = universe.modules.find((module) => module.id === 'characters')!
const characters = charactersModule.content.items ?? []
const jano = characters.find((character) => character.id === 'meme-jano-entidad')

describe('JANO character entity', () => {
  it('defines a complete synthetic-interdimensional dramatic profile', () => {
    expect(jano).toBeDefined()
    expect(jano?.type).toBe('synthetic-interdimensional-entity')
    expect(jano?.alias).toBe('Entidad sintético-interdimensional')
    expect(jano?.tags).toEqual(expect.arrayContaining(['character', 'synthetic', 'interdimensional']))
    expect(jano?.novelRefs).toHaveLength(4)
    expect((jano?.goal as string).length).toBeGreaterThan(80)
    expect((jano?.arc as string).length).toBeGreaterThan(250)
    expect(jano?.summary).toContain('No procede de otro universo ni contiene Gracia')
    expect(jano?.irreversibleChoice).toContain('sin consentimiento')
  })

  it('keeps the entity distinct from its technological origin and connects both nodes', () => {
    const project = universe.modules
      .find((module) => module.id === 'technology')
      ?.content.items?.find((entity) => entity.id === 'meme-proyecto-jano')

    expect(project).toBeDefined()
    expect(project?.type).toBe('research-program')
    expect(jano?.refs).toContain(project?.id)
    expect(project?.refs).toContain(jano?.id)
    expect(jano?.refs).toEqual(expect.arrayContaining([
      'meme-meme',
      'meme-la-gracia',
      'meme-harry',
      'meme-protocolo-cero',
      'meme-clay-sintetico',
    ]))
  })

  it('renders JANO as an individual character card with its connection control', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

    await act(async () => root.render(
      <MemoryRouter>
        <CharacterRenderer module={charactersModule} universe={universe} index={createSemanticIndex(universe)} />
      </MemoryRouter>,
    ))

    const janoHeading = [...container.querySelectorAll('h2')].find((heading) => heading.textContent === 'JANO')
    const janoCard = janoHeading?.closest('.character-card')
    expect(janoCard).not.toBeNull()
    expect(janoCard?.textContent).toContain('Entidad sintético-interdimensional')
    expect(janoCard?.textContent).toContain('Conexiones')
    expect(janoCard?.querySelector('a')?.getAttribute('href')).toBe('/module/relationships?focus=meme-jano-entidad')

    await act(async () => root.unmount())
    container.remove()
  })
})
