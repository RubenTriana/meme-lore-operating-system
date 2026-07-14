import { getAnalysisCacheIdentity } from '@/analysis/incremental'
import type { AnalysisSnapshot } from '@/analysis/types'
import type { Universe } from '@/types/universe'
import { createAnalysisCache, type AnalysisCache } from './analysis-cache'
import { AnalysisWorkerClient, type AnalysisCompiler, type AnalysisProgressHandler } from './analysis-worker-client'

export interface CompileUniverseOptions {
  onProgress?: AnalysisProgressHandler
}

export interface AnalysisService {
  compileUniverse(universe: Universe, options?: CompileUniverseOptions): Promise<AnalysisSnapshot>
  cancelCompilation(): void
  getLatestSnapshot(): AnalysisSnapshot | undefined
  clearAnalysisCache(): Promise<void>
  dispose(): void
}

export interface AnalysisServiceOptions {
  cache?: AnalysisCache
  compiler?: AnalysisCompiler
}

export function createAnalysisService(options: AnalysisServiceOptions = {}): AnalysisService {
  const cache = options.cache ?? createAnalysisCache()
  let compiler = options.compiler
  let latestSnapshot: AnalysisSnapshot | undefined

  function getCompiler(): AnalysisCompiler {
    compiler ??= new AnalysisWorkerClient()
    return compiler
  }

  async function readCachedSnapshot(universe: Universe): Promise<AnalysisSnapshot | undefined> {
    try {
      return await cache.get(getAnalysisCacheIdentity(universe))
    } catch {
      return undefined
    }
  }

  return {
    async compileUniverse(universe, options = {}) {
      const cached = await readCachedSnapshot(universe)
      if (cached) {
        latestSnapshot = cached
        return cached
      }
      const identity = getAnalysisCacheIdentity(universe)
      const snapshot = await getCompiler().compile(universe, latestSnapshot, options.onProgress)
      latestSnapshot = snapshot
      try {
        await cache.set(identity, snapshot)
      } catch {
        // A storage failure must not prevent a valid local compilation from reaching the UI.
      }
      return snapshot
    },

    cancelCompilation() {
      compiler?.cancelCompilation()
    },

    getLatestSnapshot() {
      return latestSnapshot
    },

    async clearAnalysisCache() {
      await cache.clear()
      latestSnapshot = undefined
    },

    dispose() {
      compiler?.dispose()
      compiler = undefined
      latestSnapshot = undefined
    },
  }
}
