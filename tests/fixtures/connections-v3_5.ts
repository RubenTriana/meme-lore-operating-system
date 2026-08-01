import type { Universe } from '../../src/types/universe'

export const connectionsFixture: Universe = {
  metadata: { title: 'Connections fixture', version: '0.1.0', schemaVersion: '3.5.0', build: 'test-fixture', created: '2026-07-14T00:00:00.000Z', updated: '2026-07-14T00:00:00.000Z', author: 'Test author' },
  analysisConfig: { enabled: true, engines: { continuity: false, causality: false, knowledge: false, connections: true, plausibility: false } },
  modules: [
    {
      id: 'cast', title: 'Cast', type: 'characters', icon: 'Users', order: 1, visibility: 'navigation', renderer: 'characters', content: { items: [
        { id: 'central-hero', type: 'character', title: 'Central Hero', refs: ['event-alpha'] },
        { id: 'isolated-character', type: 'character', title: 'Isolated Character' },
      ] },
    },
    {
      id: 'plot', title: 'Plot', type: 'timeline', icon: 'Clock3', order: 2, visibility: 'navigation', renderer: 'timeline', content: { items: [
        { id: 'event-alpha', type: 'event', title: 'Event Alpha', refs: ['event-beta'] },
        { id: 'event-beta', type: 'event', title: 'Event Beta', refs: ['event-gamma', 'central-hero'] },
        { id: 'event-gamma', type: 'event', title: 'Event Gamma', refs: ['event-alpha'] },
      ] },
    },
    {
      id: 'motifs', title: 'Motifs', type: 'lore', icon: 'Sparkles', order: 3, visibility: 'navigation', renderer: 'cards', content: { items: [
        { id: 'signal-symbol', type: 'symbol', title: 'Signal Symbol', refs: ['hidden-mystery'] },
        { id: 'hidden-mystery', type: 'mystery', title: 'Hidden Mystery', refs: ['signal-symbol'] },
        { id: 'empty-faction', type: 'faction', title: 'Empty Faction', refs: ['hidden-mystery'] },
      ] },
    },
  ],
  changelog: [],
}
