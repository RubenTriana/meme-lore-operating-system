import { useContext } from 'react'
import { UniverseContext, type UniverseModel } from './universe-context'

export function useUniverseModel(): UniverseModel {
  const context = useContext(UniverseContext)
  if (!context) throw new Error('useUniverseModel must be used inside UniverseProvider.')
  return { ...context, universe: context.validation.data }
}
