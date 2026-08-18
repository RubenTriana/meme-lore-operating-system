import type { ProposalRecord } from './types'

const DATABASE_NAME = 'meme-lore-proposals'
const DATABASE_VERSION = 1
const STORE_NAME = 'proposals'

export interface ProposalRepository {
  list(): Promise<ProposalRecord[]>
  get(id: string): Promise<ProposalRecord | undefined>
  put(proposal: ProposalRecord): Promise<void>
  clear(): Promise<void>
}

export class MemoryProposalRepository implements ProposalRepository {
  private readonly proposals = new Map<string, ProposalRecord>()

  async list(): Promise<ProposalRecord[]> {
    return [...this.proposals.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).map((proposal) => structuredClone(proposal))
  }

  async get(id: string): Promise<ProposalRecord | undefined> {
    const proposal = this.proposals.get(id)
    return proposal ? structuredClone(proposal) : undefined
  }

  async put(proposal: ProposalRecord): Promise<void> {
    this.proposals.set(proposal.id, structuredClone(proposal))
  }

  async clear(): Promise<void> {
    this.proposals.clear()
  }
}

export class IndexedDbProposalRepository implements ProposalRepository {
  private database?: Promise<IDBDatabase>

  async list(): Promise<ProposalRecord[]> {
    const database = await this.open()
    const proposals = await this.request<ProposalRecord[]>(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll())
    return proposals.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  async get(id: string): Promise<ProposalRecord | undefined> {
    const database = await this.open()
    return this.request<ProposalRecord | undefined>(database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id))
  }

  async put(proposal: ProposalRecord): Promise<void> {
    const database = await this.open()
    await this.request(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(structuredClone(proposal)))
  }

  async clear(): Promise<void> {
    const database = await this.open()
    await this.request(database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear())
  }

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
      request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el repositorio de propuestas.'))
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
      request.onsuccess = () => resolve(request.result)
    })
    return this.database
  }

  private request<T = undefined>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error ?? new Error('Falló una operación del repositorio de propuestas.'))
      request.onsuccess = () => resolve(request.result)
    })
  }
}

export function createProposalRepository(): ProposalRepository {
  return typeof indexedDB === 'undefined' ? new MemoryProposalRepository() : new IndexedDbProposalRepository()
}

export const proposalRepository = createProposalRepository()
