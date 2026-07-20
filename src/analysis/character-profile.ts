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
  const cruelty = character.crueltyProfile
  const priorityBase: Record<string, number> = { critical: 90, high: 76, medium: 62, low: 45 }
  const inferredImportance = (priorityBase[character.priority ?? ''] ?? 55) + listDepth(character.refs, 8) * 10
  const inferredNarrativeTime = 30 + listDepth(character.novelRefs, 4) * 65 + listDepth(character.refs, 8) * 5

  const development = Math.round(
    textDepth(character.summary, 140) * 8
      + textDepth(character.desire, 100) * 10
      + textDepth(character.need, 100) * 10
      + textDepth(character.wound, 80) * 10
      + textDepth(character.contradiction, 110) * 10
      + textDepth(character.goal, 80) * 10
      + textDepth(character.risk, 100) * 8
      + textDepth(character.irreversibleChoice, 120) * 10
      + textDepth(character.moralLimit, 100) * 8
      + textDepth(character.arc, 180) * 6
      + listDepth(character.novelRefs, 2) * 4
      + ((textDepth(cruelty?.method, 90) + textDepth(cruelty?.counterweight, 90)) / 2) * 6,
  )

  const engineQuality = engineFields.reduce((total, field) => {
    const target = field === 'wound' ? 80 : field === 'contradiction' ? 110 : 100
    return total + textDepth(character[field], target)
  }, 0) / engineFields.length

  const stakesQuality = (textDepth(character.goal, 80) + textDepth(character.risk, 100) + textDepth(character.irreversibleChoice, 120) + textDepth(character.moralLimit, 100)) / 4
  const crueltyQuality = (textDepth(cruelty?.method, 90) + textDepth(cruelty?.justification, 90) + textDepth(cruelty?.counterweight, 90) + textDepth(cruelty?.maximumAct, 80)) / 4

  const quality = Math.round(
    engineQuality * 45
      + stakesQuality * 25
      + crueltyQuality * 20
      + listDepth(character.refs, 8) * 10,
  )

  return {
    development: clampScore(development),
    importance: clampScore(character.importance ?? inferredImportance),
    narrativeTime: clampScore(character.narrativeTime ?? inferredNarrativeTime),
    quality: clampScore(quality),
  }
}
