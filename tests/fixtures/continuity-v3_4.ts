import type { Universe } from '../../src/types/universe'

export const continuityFixture: Universe = {
  metadata: {
    title: 'Continuity fixture',
    version: '0.1.0',
    schemaVersion: '3.5.0',
    build: 'test-fixture',
    created: '2026-07-13T00:00:00.000Z',
    updated: '2026-07-13T00:00:00.000Z',
    author: 'Test author',
  },
  analysisConfig: {
    enabled: true,
    engines: {
      continuity: true,
      causality: false,
      knowledge: false,
      connections: false,
      plausibility: false,
    },
  },
  modules: [
    {
      id: 'continuity',
      title: 'Continuity',
      type: 'timeline',
      icon: 'Clock3',
      order: 10,
      visibility: 'developer',
      renderer: 'timeline',
      content: {
        items: [
          {
            id: 'dead-hero',
            type: 'character',
            title: 'Dead Hero',
            continuity: { life: { death: { start: '2030-01-01T00:00:00.000Z', precision: 'exact' } } },
          },
          { id: 'scout', type: 'character', title: 'Scout' },
          {
            id: 'child',
            type: 'character',
            title: 'Child',
            continuity: { life: { birth: { start: '2010-01-01T00:00:00.000Z', precision: 'exact' } } },
          },
          { id: 'north-base', type: 'location', title: 'North Base' },
          { id: 'south-base', type: 'location', title: 'South Base' },
          {
            id: 'hero-action',
            type: 'event',
            title: 'Hero action',
            participantRefs: ['dead-hero'],
            temporal: { start: '2029-01-01T12:00:00.000Z', end: '2029-01-01T13:00:00.000Z', precision: 'exact' },
          },
          {
            id: 'north-watch',
            type: 'event',
            title: 'North watch',
            participantRefs: ['scout'],
            locationRefs: ['north-base'],
            temporal: { start: '2028-06-01T10:00:00.000Z', end: '2028-06-01T11:00:00.000Z', precision: 'exact' },
          },
          {
            id: 'south-watch',
            type: 'event',
            title: 'South watch',
            participantRefs: ['scout'],
            locationRefs: ['south-base'],
            temporal: { start: '2028-06-01T12:00:00.000Z', end: '2028-06-01T13:00:00.000Z', precision: 'exact' },
          },
          {
            id: 'age-check',
            type: 'event',
            title: 'Age check',
            temporal: { start: '2020-01-01T00:00:00.000Z', precision: 'exact' },
            continuity: { ageAssertions: [{ entityRef: 'child', age: 10 }] },
          },
          {
            id: 'cause-event',
            type: 'event',
            title: 'Cause event',
            temporal: { start: '2024-01-01T00:00:00.000Z', precision: 'exact' },
          },
          {
            id: 'effect-event',
            type: 'event',
            title: 'Effect event',
            causes: ['cause-event'],
            temporal: { start: '2025-01-01T00:00:00.000Z', precision: 'exact' },
          },
        ],
      },
    },
  ],
  changelog: [],
}

export function continuityContradictionFixture(): Universe {
  const universe = structuredClone(continuityFixture)
  const items = universe.modules[0].content.items
  if (!items) throw new Error('Continuity fixture requires items.')
  const byId = new Map(items.map((entity) => [entity.id, entity]))
  const heroAction = byId.get('hero-action')
  const northWatch = byId.get('north-watch')
  const ageCheck = byId.get('age-check')
  const cause = byId.get('cause-event')
  const effect = byId.get('effect-event')
  if (!heroAction || !northWatch || !ageCheck || !cause || !effect) throw new Error('Continuity fixture is incomplete.')
  heroAction.temporal = { start: '2031-01-01T12:00:00.000Z', end: '2031-01-01T13:00:00.000Z', precision: 'exact' }
  northWatch.temporal = { start: '2028-06-01T12:30:00.000Z', end: '2028-06-01T13:30:00.000Z', precision: 'exact' }
  ageCheck.continuity = { ageAssertions: [{ entityRef: 'child', age: 40 }] }
  cause.temporal = { start: '2025-01-01T00:00:00.000Z', precision: 'exact' }
  effect.temporal = { start: '2024-01-01T00:00:00.000Z', precision: 'exact' }
  return universe
}
