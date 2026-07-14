import type { Universe, UniverseEntity } from '../../src/types/universe'

export const causalityKnowledgeFixture: Universe = {
  metadata: { title: 'Causality and knowledge fixture', version: '0.1.0', schemaVersion: '3.5.0', build: 'test-fixture', created: '2026-07-13T00:00:00.000Z', updated: '2026-07-13T00:00:00.000Z', author: 'Test author' },
  analysisConfig: { enabled: true, engines: { continuity: false, causality: true, knowledge: true, connections: false, plausibility: false } },
  modules: [{
    id: 'analysis', title: 'Analysis', type: 'timeline', icon: 'Clock3', order: 10, visibility: 'developer', renderer: 'timeline',
    content: { items: [
      { id: 'analyst', type: 'character', title: 'Analyst' },
      { id: 'origin', type: 'event', title: 'Origin', temporal: { start: '2020-01-01T00:00:00.000Z', precision: 'exact' }, effects: ['briefing'], knowledgeChanges: [{ characterRef: 'analyst', learns: ['cipher'] }] },
      { id: 'briefing', type: 'event', title: 'Briefing', temporal: { start: '2021-01-01T00:00:00.000Z', precision: 'exact' }, causes: ['origin'], effects: ['operation'] },
      { id: 'operation', type: 'event', title: 'Operation', temporal: { start: '2022-01-01T00:00:00.000Z', precision: 'exact' }, causes: ['briefing'], effects: ['outcome'], participantRefs: ['analyst'], analysis: { requiredKnowledge: ['cipher'] } },
      { id: 'outcome', type: 'event', title: 'Outcome', temporal: { start: '2023-01-01T00:00:00.000Z', precision: 'exact' } },
    ] },
  }],
  changelog: [],
}

function entity(universe: Universe, id: string): UniverseEntity {
  const found = universe.modules.flatMap((module) => module.content.items ?? []).find((item) => item.id === id)
  if (!found) throw new Error(`Missing fixture entity: ${id}`)
  return found
}

export function causalityContradictionFixture(): Universe {
  const universe = structuredClone(causalityKnowledgeFixture)
  const items = universe.modules[0].content.items!
  items.push(
    { id: 'late-cause', type: 'event', title: 'Late cause', temporal: { start: '2030-01-01T00:00:00.000Z', precision: 'exact' } },
    { id: 'early-effect', type: 'event', title: 'Early effect', temporal: { start: '2024-01-01T00:00:00.000Z', precision: 'exact' }, causes: ['late-cause'] },
    { id: 'cycle-a', type: 'event', title: 'Cycle A', effects: ['cycle-b'] },
    { id: 'cycle-b', type: 'event', title: 'Cycle B', effects: ['cycle-a'] },
    { id: 'important-isolated', type: 'event', title: 'Important isolated event', importance: 90 },
    { id: 'orphan-step', type: 'event', title: 'Orphan causal step', causes: ['origin'] },
    { id: 'inconsistent-cause', type: 'event', title: 'Inconsistent cause', effects: ['different-effect'] },
    { id: 'inconsistent-effect', type: 'event', title: 'Inconsistent effect', causes: ['inconsistent-cause'] },
    { id: 'different-effect', type: 'event', title: 'Different effect' },
    { id: 'broken-reference', type: 'event', title: 'Broken reference', causes: ['absent-cause'] },
  )
  return universe
}

export function knowledgeContradictionFixture(): Universe {
  const universe = structuredClone(causalityKnowledgeFixture)
  const items = universe.modules[0].content.items!
  items.push(
    { id: 'act-before-revelation', type: 'event', title: 'Act before revelation', temporal: { start: '2020-06-01T00:00:00.000Z', precision: 'exact' }, participantRefs: ['analyst'], analysis: { requiredKnowledge: ['secret'] } },
    { id: 'reveal-secret', type: 'event', title: 'Reveal secret', temporal: { start: '2021-06-01T00:00:00.000Z', precision: 'exact' }, knowledgeChanges: [{ characterRef: 'analyst', learns: ['secret'] }] },
    { id: 'forget-cipher', type: 'event', title: 'Forget cipher', temporal: { start: '2024-01-01T00:00:00.000Z', precision: 'exact' }, knowledgeChanges: [{ characterRef: 'analyst', forgets: ['cipher'] }] },
    { id: 'remember-cipher', type: 'event', title: 'Remember cipher', temporal: { start: '2025-01-01T00:00:00.000Z', precision: 'exact' }, participantRefs: ['analyst'], analysis: { requiredKnowledge: ['cipher'] } },
    { id: 'missing-knowledge-character', type: 'event', title: 'Missing knowledge character', temporal: { start: '2026-01-01T00:00:00.000Z', precision: 'exact' }, knowledgeChanges: [{ characterRef: 'missing-analyst', learns: ['secret'] }] },
    { id: 'undated-knowledge', type: 'event', title: 'Undated knowledge', knowledgeChanges: [{ characterRef: 'analyst', learns: ['undated-fact'] }] },
  )
  return universe
}

export function flashbackKnowledgeFixture(): Universe {
  const universe = knowledgeContradictionFixture()
  entity(universe, 'act-before-revelation').continuity = { exceptions: [{ kind: 'flashback', ruleIds: ['knowledge-used-before-learning', 'revelation-received-after-acting'] }] }
  return universe
}
