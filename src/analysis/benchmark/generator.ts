import type { Universe, UniverseEntity, UniverseModule } from '@/types/universe'

export interface SyntheticUniverseOptions {
  entityCount: number
  seed?: number
}

function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5
    return (state >>> 0) / 0x1_0000_0000
  }
}

function module(id: string, title: string, type: string, order: number, renderer: string, items: UniverseEntity[]): UniverseModule {
  return { id, title, type, icon: 'Database', order, visibility: 'developer', renderer, content: { items } }
}

export function generateSyntheticUniverse({ entityCount, seed = 42 }: SyntheticUniverseOptions): Universe {
  if (!Number.isInteger(entityCount) || entityCount < 10) throw new Error('Synthetic universes require at least 10 entities.')
  const random = createRandom(seed)
  const characterCount = Math.max(2, Math.floor(entityCount * 0.08))
  const locationCount = Math.max(2, Math.floor(entityCount * 0.04))
  const eventCount = Math.max(4, Math.floor(entityCount * 0.5))
  const loreCount = entityCount - characterCount - locationCount - eventCount
  const characters: UniverseEntity[] = Array.from({ length: characterCount }, (_, index) => ({
    id: `synthetic-character-${index}`,
    type: 'character',
    title: `Synthetic Character ${index}`,
    tags: [`cohort-${index % 8}`],
    analysis: { goals: [`complete objective ${index % 20}`], beliefs: [`system principle ${index % 12}`], fears: [`risk ${index % 10}`] },
    continuity: { life: { birth: { start: String(1900 + index % 80), precision: 'year' } } },
  }))
  const locations: UniverseEntity[] = Array.from({ length: locationCount }, (_, index) => ({ id: `synthetic-location-${index}`, type: 'location', title: `Synthetic Location ${index}`, tags: [`region-${index % 10}`] }))
  const lore: UniverseEntity[] = Array.from({ length: loreCount }, (_, index) => ({
    id: `synthetic-lore-${index}`,
    type: index % 7 === 0 ? 'symbol' : index % 11 === 0 ? 'mystery' : 'lore',
    title: `Synthetic Lore ${index}`,
    tags: [`theme-${index % 24}`],
    refs: index ? [`synthetic-lore-${Math.floor(random() * index)}`] : [],
  }))
  const events: UniverseEntity[] = Array.from({ length: eventCount }, (_, index) => {
    const participant = `synthetic-character-${index % characterCount}`
    const nextLore = `synthetic-lore-${index % Math.max(1, loreCount)}`
    const instant = new Date(Date.UTC(2000, 0, 1) + index * 86_400_000).toISOString()
    return {
      id: `synthetic-event-${index}`,
      type: 'event',
      title: `Synthetic Event ${index}`,
      tags: [`arc-${index % 16}`],
      refs: loreCount ? [nextLore] : [],
      foreshadowing: index + 5 < eventCount && index % 5 === 0 ? [`synthetic-event-${index + 5}`] : [],
      participantRefs: [participant],
      locationRefs: [`synthetic-location-${index % locationCount}`],
      temporal: { start: instant, end: instant, precision: 'exact' },
      causes: index ? [`synthetic-event-${index - 1}`] : [],
      effects: index + 1 < eventCount ? [`synthetic-event-${index + 1}`] : [],
      importance: index % 50 === 0 ? 90 : 50,
      analysis: index % 10 === 0 ? { requiredKnowledge: [`fact-${index}`] } : undefined,
      knowledgeChanges: index % 10 === 0 ? [{ characterRef: participant, learns: [`fact-${index}`] }] : undefined,
    }
  })
  return {
    metadata: { title: `Synthetic benchmark ${entityCount}`, version: '0.0.0-benchmark', schemaVersion: '3.5.0', build: `synthetic-seed-${seed}`, created: '2026-07-14T00:00:00.000Z', updated: '2026-07-14T00:00:00.000Z', author: 'Deterministic benchmark generator' },
    analysisConfig: { enabled: true, engines: { continuity: true, causality: true, knowledge: true, connections: true, plausibility: false } },
    modules: [module('synthetic-characters', 'Characters', 'characters', 1, 'characters', characters), module('synthetic-locations', 'Locations', 'locations', 2, 'cards', locations), module('synthetic-events', 'Events', 'timeline', 3, 'timeline', events), module('synthetic-lore', 'Lore', 'lore', 4, 'cards', lore)],
    changelog: [],
  }
}
