import type { UniverseEntity } from '@/types/universe'

export interface CharacterProfileScores {
  development: number
  importance: number
  narrativeTime: number
  quality: number
}

const engineFields = ['desire', 'need', 'wound', 'contradiction'] as const

function clampScore(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0
}

function textDepth(value: unknown, targetLength: number) {
  if (typeof value !== 'string') return 0
  const normalized = value.trim().replace(/\s+/g, ' ')
  return Math.min(1, normalized.length / targetLength)
}

function listDepth(value: unknown, targetLength: number) {
  return Array.isArray(value) ? Math.min(1, value.length / targetLength) : 0
}

export function scoreCharacterProfile(character: UniverseEntity): CharacterProfileScores {
  const analysisGoals = character.analysis?.goals

  const development = Math.round(
    textDepth(character.summary, 140) * 8
      + textDepth(character.alias, 12) * 5
      + textDepth(character.desire, 100) * 12
      + textDepth(character.need, 100) * 12
      + textDepth(character.wound, 80) * 12
      + textDepth(character.contradiction, 110) * 12
      + textDepth(character.goal, 80) * 10
      + textDepth(character.arc, 300) * 17
      + textDepth(character.risk, 100) * 10
      + listDepth(analysisGoals, 1) * 2,
  )

  const engineQuality = engineFields.reduce((total, field) => {
    const target = field === 'wound' ? 80 : field === 'contradiction' ? 110 : 100
    return total + textDepth(character[field], target)
  }, 0) / engineFields.length

  const narrativeQuality = (
    textDepth(character.summary, 140)
      + textDepth(character.goal, 80)
      + textDepth(character.arc, 300)
      + textDepth(character.risk, 100)
  ) / 4

  const quality = Math.round(
    engineQuality * 60
      + narrativeQuality * 25
      + listDepth(character.refs, 12) * 10
      + listDepth(character.foreshadowing, 4) * 5,
  )

  return {
    development: clampScore(development),
    importance: clampScore(character.importance),
    narrativeTime: clampScore(character.narrativeTime),
    quality: clampScore(quality),
  }
}
