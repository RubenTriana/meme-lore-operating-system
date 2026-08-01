import { useMemo, useState, type PropsWithChildren } from 'react'
import { useQuery } from '@tanstack/react-query'
import { loadUniverse, type LoadResult } from '@/services/universe-loader'
import { isUniversePatch } from '@/proposals/workflow'
import { UniverseContext, type BeatStatus, type UniverseContextValue } from './universe-context'

interface BeatStatusResponse {
  universe?: unknown
  error?: string
}

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
    updateBeatStatus: async (beatId: string, status: BeatStatus) => {
      if (candidateOverride) throw new Error('Vuelve al canon base antes de editar el estado de un beat.')
      const response = await fetch('/api/canon/beat-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beatId, status }),
      })
      const payload = await response.json() as BeatStatusResponse
      if (!response.ok || !payload.universe) throw new Error(payload.error ?? 'No se pudo guardar el estado en el master.')
      const result = loadUniverse(payload.universe)
      if (!result.validation.valid) throw new Error('El servidor devolvió un master que no supera la validación.')
      setBaseOverride(result)
      setLoadedAt(performance.now())
    },
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
