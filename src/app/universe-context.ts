import { createContext } from 'react'
import type { LoadResult } from '@/services/universe-loader'
import type { Universe, ValidationResult } from '@/types/universe'

export interface UniverseContextValue {
  validation: ValidationResult
  migrated: string[]
  isLoading: boolean
  loadedAt: number
  importFile: (file: File) => Promise<void>
  importPayload: (payload: unknown) => void
  reset: () => void
}

export const UniverseContext = createContext<UniverseContextValue | null>(null)
export type UniverseModel = UniverseContextValue & { universe?: Universe }
export type UniverseLoad = LoadResult
