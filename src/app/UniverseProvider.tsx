import { useMemo, useState, type PropsWithChildren } from 'react'
import { useQuery } from '@tanstack/react-query'
import { loadUniverse, readUniverseFile, type LoadResult } from '@/services/universe-loader'
import { applyPatch, type UniversePatch } from '@/services/patches'
import { UniverseContext, type UniverseContextValue } from './universe-context'
import type { Universe } from '@/types/universe'

function recordPatch(universe: Universe, patch: UniversePatch): Universe {
  const modules = [...new Set(patch.operations.map((operation) => operation.path.split('/')[2]).filter(Boolean))]
  return {
    ...universe,
    changelog: [{
      id: `change-auto-${Date.now()}`,
      version: universe.metadata.version,
      date: new Date().toISOString(),
      author: universe.metadata.author,
      changes: [`Applied ${patch.operations.length} partial update${patch.operations.length === 1 ? '' : 's'}`],
      modules,
    }, ...universe.changelog],
  }
}

export function UniverseProvider({ children }: PropsWithChildren) {
  const initial = useQuery({ queryKey: ['universe', 'master'], queryFn: async () => loadUniverse(), staleTime: Infinity })
  const [override, setOverride] = useState<LoadResult | null>(null)
  const [loadedAt, setLoadedAt] = useState(() => performance.now())
  const active = override ?? initial.data
  const value = useMemo<UniverseContextValue>(() => ({
    validation: active?.validation ?? { valid: false, errors: [], warnings: [] },
    migrated: active?.migrated ?? [],
    isLoading: initial.isLoading,
    loadedAt,
    importFile: async (file) => { const result = await readUniverseFile(file); setOverride(result); setLoadedAt(performance.now()) },
    importPayload: (payload) => {
      const isPatch = typeof payload === 'object' && payload !== null && Array.isArray((payload as UniversePatch).operations)
      const source = isPatch && active?.validation.data ? recordPatch(applyPatch(active.validation.data, payload as UniversePatch), payload as UniversePatch) : payload
      setOverride(loadUniverse(source))
      setLoadedAt(performance.now())
    },
    reset: () => { setOverride(null); setLoadedAt(performance.now()) },
  }), [active, initial.isLoading, loadedAt])
  return <UniverseContext.Provider value={value}>{children}</UniverseContext.Provider>
}
