import type { RelationGraph } from '../../src/analysis/types'
import type { Universe, UniverseEntity } from '../../src/types/universe'

const created = '2026-07-14T00:00:00.000Z'

function module(id: string, type: string, renderer: string, items: UniverseEntity[]) {
  return {
    id,
    title: id,
    type,
    icon: 'Circle',
    order: id === 'cast' ? 1 : id === 'places' ? 2 : 3,
    visibility: 'developer' as const,
    renderer,
    content: { items },
  }
}

export const systemCertificationFixture: Universe = {
  metadata: {
    title: 'Certified system fixture',
    version: '0.2.0-experimental.0',
    schemaVersion: '3.5.0',
    build: 'system-certification',
    created,
    updated: created,
    author: 'Certification fixture',
  },
  analysisConfig: {
    enabled: true,
    engines: { continuity: true, causality: true, knowledge: true, connections: true, plausibility: true },
  },
  modules: [
    module('cast', 'characters', 'characters', [
      { id: 'dead-original', type: 'character', title: 'Dead original', continuity: { life: { death: { start: '2030-01-01T00:00:00.000Z', precision: 'exact' } } } },
      { id: 'digital-copy', type: 'character', title: 'Digital copy' },
      { id: 'traveler', type: 'character', title: 'Traveler' },
      { id: 'analyst', type: 'character', title: 'Analyst' },
      { id: 'sparse-actor', type: 'character', title: 'Sparse actor', analysis: { goals: ['protect refuge'] } },
      { id: 'isolated-node', type: 'character', title: 'Isolated node' },
    ]),
    module('places', 'locations', 'cards', [
      { id: 'north-base', type: 'location', title: 'North base' },
      { id: 'south-base', type: 'location', title: 'South base' },
      { id: 'refuge', type: 'location', title: 'Refuge' },
    ]),
    module('events', 'timeline', 'timeline', [
      { id: 'dead-acts', type: 'event', title: 'Dead original acts', participantRefs: ['dead-original'], temporal: { start: '2031-01-01T10:00:00.000Z', end: '2031-01-01T11:00:00.000Z', precision: 'exact' } },
      { id: 'permitted-flashback', type: 'event', title: 'Permitted flashback', participantRefs: ['dead-original'], temporal: { start: '2032-01-01T10:00:00.000Z', end: '2032-01-01T11:00:00.000Z', precision: 'exact' }, continuity: { exceptions: [{ kind: 'flashback', subjectRefs: ['dead-original'] }] } },
      { id: 'copy-acts', type: 'event', title: 'Digital copy acts', participantRefs: ['digital-copy'], temporal: { start: '2032-02-01T10:00:00.000Z', end: '2032-02-01T11:00:00.000Z', precision: 'exact' } },
      { id: 'north-presence', type: 'event', title: 'North presence', participantRefs: ['traveler'], locationRefs: ['north-base'], temporal: { start: '2033-01-01T10:00:00.000Z', end: '2033-01-01T12:00:00.000Z', precision: 'exact' } },
      { id: 'south-presence', type: 'event', title: 'South presence', participantRefs: ['traveler'], locationRefs: ['south-base'], temporal: { start: '2033-01-01T11:00:00.000Z', end: '2033-01-01T13:00:00.000Z', precision: 'exact' } },
      { id: 'late-cause', type: 'event', title: 'Late cause', temporal: { start: '2035-01-01T00:00:00.000Z', precision: 'exact' }, effects: ['early-effect'] },
      { id: 'early-effect', type: 'event', title: 'Early effect', temporal: { start: '2034-01-01T00:00:00.000Z', precision: 'exact' }, causes: ['late-cause'] },
      { id: 'learn-secret', type: 'event', title: 'Learn secret', temporal: { start: '2037-01-01T00:00:00.000Z', precision: 'exact' }, knowledgeChanges: [{ characterRef: 'analyst', learns: ['secret'] }] },
      { id: 'use-secret', type: 'event', title: 'Use secret', temporal: { start: '2036-01-01T00:00:00.000Z', precision: 'exact' }, participantRefs: ['analyst'], analysis: { requiredKnowledge: ['secret'] } },
      { id: 'intentional-cycle-a', type: 'event', title: 'Intentional cycle A', effects: ['intentional-cycle-b'], continuity: { exceptions: [{ kind: 'causal-loop', ruleIds: ['undeclared-causal-cycle'] }] } },
      { id: 'intentional-cycle-b', type: 'event', title: 'Intentional cycle B', effects: ['intentional-cycle-a'] },
      { id: 'component-a', type: 'event', title: 'Component A', refs: ['component-b'] },
      { id: 'component-b', type: 'event', title: 'Component B' },
      { id: 'undated-action', type: 'event', title: 'Undated action', participantRefs: ['analyst'], analysis: { requiredKnowledge: ['unknown-fact'] } },
    ]),
  ],
  changelog: [],
}

export function brokenReferenceCertificationFixture(): Universe {
  const universe = structuredClone(systemCertificationFixture)
  universe.modules[2].content.items?.push({ id: 'broken-reference', type: 'event', title: 'Broken reference', refs: ['absent-entity'] })
  return universe
}

export function insufficientDataCertificationFixture(): Universe {
  const universe = structuredClone(systemCertificationFixture)
  universe.modules = [module('events', 'timeline', 'timeline', [
    { id: 'analyst', type: 'character', title: 'Analyst' },
    { id: 'undated-action', type: 'event', title: 'Undated action', participantRefs: ['analyst'], analysis: { requiredKnowledge: ['unknown-fact'] } },
  ])]
  return universe
}

export function withoutEntity(universe: Universe, entityId: string): Universe {
  const next = structuredClone(universe)
  next.modules.forEach((entry) => {
    entry.content.items = entry.content.items?.filter((entity) => entity.id !== entityId)
  })
  return next
}

const graphMetadata = { sourceHash: 'certified-graph', schemaVersion: '3.5.0', engineVersion: '1.0.0', generatedAt: created }

export const reciprocalGraph: RelationGraph = {
  metadata: graphMetadata,
  nodes: [
    { id: 'ally-a', type: 'character', moduleId: 'cast' },
    { id: 'ally-b', type: 'character', moduleId: 'cast' },
  ],
  edges: [
    { id: 'ally-a-b', sourceId: 'ally-a', targetId: 'ally-b', type: 'alliance', provenance: 'explicit' },
    { id: 'ally-b-a', sourceId: 'ally-b', targetId: 'ally-a', type: 'alliance', provenance: 'explicit' },
  ],
  edgeIdsByProvenance: { explicit: ['ally-a-b', 'ally-b-a'], refs: [], foreshadowing: [] },
}

export const missingReciprocalGraph: RelationGraph = {
  ...reciprocalGraph,
  edges: reciprocalGraph.edges.slice(0, 1),
  edgeIdsByProvenance: { explicit: ['ally-a-b'], refs: [], foreshadowing: [] },
}
