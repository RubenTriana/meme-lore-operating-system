import type { Universe } from '../../src/types/universe'

export const plausibilityFixture: Universe = {
  metadata: { title: 'Plausibility fixture', version: '0.1.0', schemaVersion: '3.5.0', build: 'test-fixture', created: '2026-07-14T00:00:00.000Z', updated: '2026-07-14T00:00:00.000Z', author: 'Test author' },
  analysisConfig: { enabled: true, engines: { continuity: false, causality: false, knowledge: false, connections: false, plausibility: true } },
  modules: [
    { id: 'cast', title: 'Cast', type: 'characters', icon: 'Users', order: 1, visibility: 'navigation', renderer: 'characters', content: { items: [
      { id: 'clay', type: 'character', title: 'Clay', analysis: { goals: ['protect refuge'], beliefs: ['unity ensures survival'], fears: ['losing family'], constraints: ['enemy siege'] } },
      { id: 'sparse-actor', type: 'character', title: 'Sparse Actor', analysis: { goals: ['protect refuge'] } },
    ] } },
    { id: 'plot', title: 'Plot', type: 'timeline', icon: 'Clock3', order: 2, visibility: 'navigation', renderer: 'timeline', content: { items: [
      { id: 'refuge', type: 'location', title: 'Ember Refuge' },
      { id: 'protect-convoy', type: 'event', title: 'Protect convoy', participantRefs: ['clay'], tags: ['protect'] },
      { id: 'siege', type: 'event', title: 'Enemy siege', participantRefs: ['clay'], tags: ['enemy siege'], analysis: { constraints: ['enemy siege'] } },
      { id: 'promise', type: 'event', title: 'Promise to protect refuge', foreshadowing: ['refuge'] },
    ] } },
  ],
  changelog: [],
}
