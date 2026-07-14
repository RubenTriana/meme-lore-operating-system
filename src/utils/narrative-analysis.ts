import type { NarrativeInsight, Universe } from '@/types/universe'
import { createSemanticIndex, getAllEntities } from './semantic-index'

export function analyzeNarrative(universe: Universe): NarrativeInsight[] {
  const index = createSemanticIndex(universe)
  const insights: NarrativeInsight[] = []
  const entities = getAllEntities(universe)

  entities.filter((entity) => entity.type === 'character' && (entity.development ?? 0) < 70).forEach((entity) => {
    insights.push({
      id: `development-${entity.id}`,
      category: 'gap',
      title: `${entity.title} needs development`,
      detail: `This character is at ${entity.development ?? 0}% development; define the unresolved parts of their narrative engine.`,
      score: 100 - (entity.development ?? 0),
      entityIds: [entity.id],
      severity: 'medium',
    })
  })

  entities.filter((entity) => entity.type === 'character' && (index.backlinks.get(entity.id)?.length ?? 0) === 0).forEach((entity) => {
    insights.push({
      id: `orphan-${entity.id}`,
      category: 'orphan',
      title: `${entity.title} has no incoming narrative links`,
      detail: 'No other entity currently refers to this character. Validate that this isolation is intentional.',
      score: 70,
      entityIds: [entity.id],
      severity: 'low',
    })
  })

  entities.filter((entity) => entity.type === 'beat' && ((entity.quality ?? 100) < 70 || (entity.development ?? 100) < 70)).forEach((entity) => {
    insights.push({
      id: `beat-${entity.id}`,
      category: 'weak-beat',
      title: `Weak beat: ${entity.title}`,
      detail: `Quality ${entity.quality ?? 0}/100 · development ${entity.development ?? 0}/100. Strengthen conflict, dependencies or scene intent.`,
      score: 100 - Math.min(entity.quality ?? 100, entity.development ?? 100),
      entityIds: [entity.id],
      severity: (entity.quality ?? 100) < 60 ? 'high' : 'medium',
    })
  })

  entities.filter((entity) => entity.type === 'mystery' && (entity.development ?? 0) < 65).forEach((entity) => {
    insights.push({
      id: `mystery-${entity.id}`,
      category: 'gap',
      title: `Open mystery: ${entity.title}`,
      detail: 'This mystery is active but has limited development. Add clues, a payoff window or a deliberate deferral.',
      score: 100 - (entity.development ?? 0),
      entityIds: [entity.id],
      severity: 'high',
    })
  })

  entities.filter((entity) => (entity.foreshadowing?.length ?? 0) > 0 && (entity.development ?? 0) < 65).forEach((entity) => {
    insights.push({
      id: `foreshadowing-${entity.id}`,
      category: 'foreshadowing',
      title: `Underdeveloped seed: ${entity.title}`,
      detail: 'This entity carries foreshadowing but lacks enough canonical support to make the payoff feel earned.',
      score: 100 - (entity.development ?? 0),
      entityIds: [entity.id, ...(entity.foreshadowing ?? [])],
      severity: 'medium',
    })
  })

  return insights.sort((a, b) => b.score - a.score)
}
