import source from '../data/universe_master.json'
import { validateUniverse } from '../src/schemas/universe'

describe('universe validation', () => {
  it('accepts the canonical master file', () => {
    const result = validateUniverse(source)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('reports broken cross references without crashing', () => {
    const invalid = structuredClone(source)
    invalid.modules[0].content.items[0].refs = ['missing-entity']
    const result = validateUniverse(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('Broken cross-reference')
  })
})
