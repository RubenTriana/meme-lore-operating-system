import { useMemo, useState, type PropsWithChildren } from 'react'
import { useQuery } from '@tanstack/react-query'
import { loadUniverse, type LoadResult } from '@/services/universe-loader'
import { isUniversePatch } from '@/proposals/workflow'
import { UniverseContext, type UniverseContextValue } from './universe-context'

export function UniverseProvider({ children }: PropsWithChildren) {
  const initial = useQuery({ queryKey: ['universe', 'master'], queryFn: async () => loadUniverse(), staleTime: Infinity })
  const [baseOverride, setBaseOverride] = useState<LoadResult | null>(null)
  const [candidateOverride, setCandidateOverride] = useState<{ proposalId: string; result: LoadResult } | null>(null)
  const [loadedAt, setLoadedAt] = useState(() => performance.now())
  const base = baseOverride ?? initial.data
  const active = candidateOverride?.result ?? base
  const value = useMemo<UniverseContextValue>(() => ({
    validation: active?.validation ?? { valid: false, errors: [], warnings: [] },
    baseUniverse: base?.validation.data,
    migrated: active?.migrated ?? [],
    isLoading: initial.isLoading,
    loadedAt,
    workspaceState: candidateOverride ? 'candidate' : 'base',
    ...(candidateOverride ? { workspaceProposalId: candidateOverride.proposalId } : {}),
    importFile: async (file) => {
      const payload = JSON.parse(await file.text()) as unknown
      if (isUniversePatch(payload)) throw new Error('Los patches deben importarse desde el Centro de propuestas.')
      setBaseOverride(loadUniverse(payload)); setCandidateOverride(null); setLoadedAt(performance.now())
    },
    importPayload: (payload) => {
      if (isUniversePatch(payload)) throw new Error('La importación de patches está en cuarentena; crea una propuesta antes de simularla.')
      setBaseOverride(loadUniverse(payload)); setCandidateOverride(null); setLoadedAt(performance.now())
    },
    openCandidate: (universe, proposalId) => { setCandidateOverride({ proposalId, result: loadUniverse(universe) }); setLoadedAt(performance.now()) },
    restoreBase: () => { setCandidateOverride(null); setLoadedAt(performance.now()) },
    reset: () => { setBaseOverride(null); setCandidateOverride(null); setLoadedAt(performance.now()) },
  }), [active, base, candidateOverride, initial.isLoading, loadedAt])
  return <UniverseContext.Provider value={value}>{children}</UniverseContext.Provider>
}
