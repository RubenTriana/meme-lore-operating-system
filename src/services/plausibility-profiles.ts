import { DEFAULT_PLAUSIBILITY_PROFILE, validatePlausibilityProfile, type PlausibilityProfile } from '@/analysis/plausibility'

const STORAGE_KEY = 'meme-los-plausibility-profiles-v1'

function storage(): Storage | undefined { return typeof localStorage === 'undefined' ? undefined : localStorage }
function clone(profile: PlausibilityProfile): PlausibilityProfile { return { ...profile, weights: { ...profile.weights } } }

export function readPlausibilityProfiles(target: Storage | undefined = storage()): PlausibilityProfile[] {
  if (!target) return [clone(DEFAULT_PLAUSIBILITY_PROFILE)]
  try {
    const parsed = JSON.parse(target.getItem(STORAGE_KEY) ?? '[]') as unknown
    const saved = Array.isArray(parsed) ? parsed.filter((profile): profile is PlausibilityProfile => Boolean(profile && typeof profile === 'object' && validatePlausibilityProfile(profile as PlausibilityProfile).valid)) : []
    return [clone(DEFAULT_PLAUSIBILITY_PROFILE), ...saved.filter((profile) => profile.id !== DEFAULT_PLAUSIBILITY_PROFILE.id).map(clone).sort((left, right) => left.name.localeCompare(right.name))]
  } catch { return [clone(DEFAULT_PLAUSIBILITY_PROFILE)] }
}

export function savePlausibilityProfile(profile: PlausibilityProfile, target: Storage | undefined = storage()): PlausibilityProfile {
  const normalized = { ...profile, id: profile.id.trim(), name: profile.name.trim(), weights: { ...profile.weights } }
  const validation = validatePlausibilityProfile(normalized)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  if (normalized.id === DEFAULT_PLAUSIBILITY_PROFILE.id) throw new Error('El perfil predeterminado no puede sobrescribirse.')
  if (target) {
    const saved = readPlausibilityProfiles(target).filter((item) => item.id !== DEFAULT_PLAUSIBILITY_PROFILE.id && item.id !== normalized.id)
    target.setItem(STORAGE_KEY, JSON.stringify([...saved, normalized].sort((left, right) => left.name.localeCompare(right.name))))
  }
  return clone(normalized)
}
