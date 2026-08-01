import type { Universe } from '../../src/types/universe'

export const analysisEventFixture: Universe = {
  metadata: {
    title: 'Analysis fixture',
    version: '0.1.0',
    schemaVersion: '3.5.0',
    build: 'test-fixture',
    created: '2026-07-13T00:00:00.000Z',
    updated: '2026-07-13T00:00:00.000Z',
    author: 'Test author',
  },
  analysisConfig: {
    enabled: false,
    engines: {
      continuity: false,
      causality: false,
      knowledge: false,
      connections: false,
      plausibility: false,
    },
  },
  modules: [
    {
      id: 'timeline',
      title: 'Timeline',
      type: 'timeline',
      icon: 'CalendarDays',
      order: 10,
      visibility: 'navigation',
      renderer: 'timeline',
      content: {
        items: [
          {
            id: 'meme-revelation',
            type: 'event',
            title: 'The revelation',
            tags: ['analysis', 'event'],
            refs: ['meme-trigger'],
            foreshadowing: ['meme-outcome'],
            analysis: {
              goals: ['Protect the signal'],
              fears: ['Exposure'],
              beliefs: ['The signal is true'],
              constraints: ['The window is brief'],
              requiredKnowledge: ['Signal protocol'],
            },
            temporal: { start: '2042-04-11', end: '2042-04-12', precision: 'day' },
            locationRefs: ['meme-observatory'],
            participantRefs: ['meme-operator'],
            causes: ['meme-trigger'],
            effects: ['meme-outcome'],
            knowledgeChanges: [{ characterRef: 'meme-operator', learns: ['Signal protocol'] }],
            stateChanges: [{ entityRef: 'meme-trigger', path: 'status', from: 'open', to: 'resolved' }],
          },
          { id: 'meme-observatory', type: 'location', title: 'Observatory' },
          { id: 'meme-operator', type: 'character', title: 'Operator' },
          { id: 'meme-trigger', type: 'event', title: 'Trigger' },
          { id: 'meme-outcome', type: 'event', title: 'Outcome' },
        ],
      },
    },
  ],
  changelog: [],
}
