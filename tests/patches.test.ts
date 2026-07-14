import source from '../data/universe_master.json'
import { applyPatch } from '../src/services/patches'

describe('patches', () => {
  it('replaces a keyed item field without replacing the universe', () => {
    const characters = source.modules.find((module) => module.id === 'characters')!
    const character = characters.content.items[0]
    if (!character) throw new Error('The test universe needs at least one character.')
    const patched = applyPatch(source, { operations: [{ op: 'replace', path: `/modules/characters/content/items/${character.id}/development`, value: 95 }] })
    expect(patched.modules.find((module) => module.id === 'characters')?.content.items?.find((item) => item.id === character.id)?.development).toBe(95)
  })
})
