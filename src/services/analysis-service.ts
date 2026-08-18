import { getAnalysisCacheIdentity } from '@/analysis/incremental'
import type { AnalysisCacheIdentity, AnalysisSnapshot } from '@/analysis/types'
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

function isCompatibleSnapshot(value: unknown, identity: AnalysisCacheIdentity): value is AnalysisSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<AnalysisSnapshot>
  return snapshot.snapshotVersion === '1'
    && snapshot.metadata?.sourceHash === identity.sourceHash
    && snapshot.metadata.schemaVersion === identity.schemaVersion
    && snapshot.metadata.engineVersion === identity.engineVersion
    && snapshot.compilation?.metadata?.sourceHash === identity.sourceHash
    && Array.isArray(snapshot.issues)
    && typeof snapshot.entityHashes === 'object'
    && snapshot.entityHashes !== null
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
    const identity = getAnalysisCacheIdentity(universe)
    try {
      const cached = await cache.get(identity)
      if (!cached || isCompatibleSnapshot(cached, identity)) return cached
      await cache.clear().catch(() => undefined)
      return undefined
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
