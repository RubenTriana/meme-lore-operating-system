import type { AnalysisCacheIdentity, AnalysisSnapshot } from '@/analysis/types'

const DATABASE_NAME = 'meme-lore-analysis'
const DATABASE_VERSION = 1
const STORE_NAME = 'snapshots'
const CACHE_PREFIX = 'analysis-v1'

interface StoredSnapshot {
  key: string
  snapshot: AnalysisSnapshot
}

export interface AnalysisCache {
  get(identity: AnalysisCacheIdentity): Promise<AnalysisSnapshot | undefined>
  set(identity: AnalysisCacheIdentity, snapshot: AnalysisSnapshot): Promise<void>
  clear(): Promise<void>
}

export function analysisCacheKey(identity: AnalysisCacheIdentity): string {
  return [CACHE_PREFIX, identity.engineVersion, identity.schemaVersion, identity.sourceHash].join(':')
}

export class MemoryAnalysisCache implements AnalysisCache {
  private readonly entries = new Map<string, AnalysisSnapshot>()

  async get(identity: AnalysisCacheIdentity): Promise<AnalysisSnapshot | undefined> {
    return this.entries.get(analysisCacheKey(identity))
  }

  async set(identity: AnalysisCacheIdentity, snapshot: AnalysisSnapshot): Promise<void> {
    this.entries.set(analysisCacheKey(identity), snapshot)
  }

  async clear(): Promise<void> {
    this.entries.clear()
  }
}

export class IndexedDbAnalysisCache implements AnalysisCache {
  private database?: Promise<IDBDatabase>

  async get(identity: AnalysisCacheIdentity): Promise<AnalysisSnapshot | undefined> {
    const database = await this.open()
    const record = await this.request<StoredSnapshot | undefined>(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(analysisCacheKey(identity)))
    return record?.snapshot
  }

  async set(identity: AnalysisCacheIdentity, snapshot: AnalysisSnapshot): Promise<void> {
    const database = await this.open()
    await this.request(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put({ key: analysisCacheKey(identity), snapshot } satisfies StoredSnapshot))
  }

  async clear(): Promise<void> {
    const database = await this.open()
    await this.request(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear())
  }

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onerror = () => reject(request.error ?? new Error('Unable to open the analysis cache.'))
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
      request.onsuccess = () => resolve(request.result)
    })
    return this.database
  }

  private request<T = undefined>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error ?? new Error('Analysis cache request failed.'))
      request.onsuccess = () => resolve(request.result)
    })
  }
}

export function createAnalysisCache(): AnalysisCache {
  return typeof indexedDB === 'undefined' ? new MemoryAnalysisCache() : new IndexedDbAnalysisCache()
}
