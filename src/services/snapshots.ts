import type { Universe } from '@/types/universe'

const KEY = 'meme-los-snapshots'
export interface UniverseSnapshot { id: string; version: string; createdAt: string; universe: Universe }

export function getSnapshots(): UniverseSnapshot[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as UniverseSnapshot[] } catch { return [] }
}

export function saveSnapshot(universe: Universe): UniverseSnapshot {
  const snapshot: UniverseSnapshot = { id: crypto.randomUUID(), version: universe.metadata.version, createdAt: new Date().toISOString(), universe: structuredClone(universe) }
  localStorage.setItem(KEY, JSON.stringify([snapshot, ...getSnapshots()].slice(0, 20)))
  return snapshot
}

export function deleteSnapshot(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(getSnapshots().filter((snapshot) => snapshot.id !== id)))
}
