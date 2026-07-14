import source from '../data/universe_master.json'
import { validateUniverse } from '../src/schemas/universe'
import { createSemanticIndex, searchUniverse } from '../src/utils/semantic-index'

const universe = validateUniverse(source).data!

describe('semantic index', () => {
  it('creates both reference directions from canon', () => {
    const index = createSemanticIndex(universe)
    const source = universe.modules.flatMap((module) => module.content.items ?? []).find((entity) => (entity.refs?.length ?? 0) > 0)
    if (!source?.refs?.[0]) throw new Error('The test universe needs at least one cross-reference.')
    const targetId = source.refs[0]
    expect(index.references.get(source.id)).toContain(targetId)
    expect(index.backlinks.get(targetId)).toContain(source.id)
  })

  it('searches titles, summaries and tags', () => {
    const entity = universe.modules.flatMap((module) => module.content.items ?? []).find((item) => item.title.length > 4)
    if (!entity) throw new Error('The test universe needs a searchable entity.')
    expect(searchUniverse(universe, entity.title).some((result) => result.id === entity.id)).toBe(true)
  })
})
