import prePhase11Source from './universe-v3_2-pre-phase-11.json'
import phase11PatchSource from '../../data/updates/meme-canon-enrichment-phase-11.patch.json'
import { loadUniverse } from '../../src/services/universe-loader'
import { applyPatch, type UniversePatch } from '../../src/services/patches'
import type { Universe } from '../../src/types/universe'

const phase11Patch = phase11PatchSource as unknown as UniversePatch

export function createPrePhase11Universe(): Universe {
  const loaded = loadUniverse(structuredClone(prePhase11Source))
  if (!loaded.validation.data) throw new Error('The frozen pre-Phase 11 universe must remain valid.')
  return loaded.validation.data
}

export function createPhase11Universe(): Universe {
  return applyPatch(createPrePhase11Universe(), phase11Patch)
}
