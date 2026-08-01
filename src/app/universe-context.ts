import { createContext } from 'react'
import type { LoadResult } from '@/services/universe-loader'
import type { Universe, ValidationResult } from '@/types/universe'

export type BeatStatus = 'outline' | 'draft' | 'seeded' | 'active' | 'locked'

export interface UniverseContextValue {
  validation: ValidationResult
  baseUniverse?: Universe
  migrated: string[]
  isLoading: boolean
  loadedAt: number
  workspaceState: 'base' | 'candidate'
  workspaceProposalId?: string
  updateBeatStatus: (beatId: string, status: BeatStatus) => Promise<void>
  importFile: (file: File) => Promise<void>
  importPayload: (payload: unknown) => void
  openCandidate: (universe: Universe, proposalId: string) => void
  restoreBase: () => void
  reset: () => void
}

export const UniverseContext = createContext<UniverseContextValue | null>(null)
export type UniverseModel = UniverseContextValue & { universe?: Universe }
export type UniverseLoad = LoadResult
