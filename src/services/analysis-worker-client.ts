import type { AnalysisSnapshot } from '@/analysis/types'
import { ANALYSIS_WORKER_PROTOCOL_VERSION, type SerializedAnalysisError, type WorkerRequest, type WorkerResponse } from '@/analysis/worker-protocol'
import type { Universe } from '@/types/universe'

export type AnalysisProgress = Extract<WorkerResponse, { type: 'progress' }>
export type AnalysisProgressHandler = (progress: AnalysisProgress) => void

export interface AnalysisCompiler {
  compile(universe: Universe, previousSnapshot: AnalysisSnapshot | undefined, onProgress?: AnalysisProgressHandler): Promise<AnalysisSnapshot>
  cancelCompilation(): void
  dispose(): void
}

export class AnalysisWorkerError extends Error {
  constructor(public readonly detail: SerializedAnalysisError) {
    super(detail.message)
    this.name = detail.name
  }
}

interface PendingCompilation {
  resolve: (snapshot: AnalysisSnapshot) => void
  reject: (error: AnalysisWorkerError) => void
  onProgress?: AnalysisProgressHandler
}

export class AnalysisWorkerClient implements AnalysisCompiler {
  private readonly worker: Worker
  private readonly pending = new Map<string, PendingCompilation>()
  private nextRequestNumber = 1

  constructor() {
    this.worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handleResponse(event.data)
    this.worker.onerror = () => this.rejectAll({ code: 'COMPILATION_FAILED', name: 'AnalysisWorkerError', message: 'The analysis worker stopped unexpectedly.' })
  }

  compile(universe: Universe, previousSnapshot: AnalysisSnapshot | undefined, onProgress?: AnalysisProgressHandler): Promise<AnalysisSnapshot> {
    const requestId = `analysis-${this.nextRequestNumber++}`
    const request: WorkerRequest = { protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'compile', requestId, universe, previousSnapshot }
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject, onProgress })
      this.worker.postMessage(request)
    })
  }

  cancelCompilation(): void {
    this.pending.forEach((_, requestId) => {
      const request: WorkerRequest = { protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'cancel', requestId }
      this.worker.postMessage(request)
    })
  }

  dispose(): void {
    this.rejectAll({ code: 'CANCELLED', name: 'AnalysisCancelledError', message: 'The analysis worker was disposed.' })
    this.worker.terminate()
  }

  private handleResponse(response: WorkerResponse): void {
    if (response.protocolVersion !== ANALYSIS_WORKER_PROTOCOL_VERSION) return
    const pending = this.pending.get(response.requestId)
    if (!pending) return
    if (response.type === 'progress') {
      pending.onProgress?.(response)
      return
    }
    this.pending.delete(response.requestId)
    if (response.type === 'complete') pending.resolve(response.result)
    else pending.reject(new AnalysisWorkerError(response.error))
  }

  private rejectAll(detail: SerializedAnalysisError): void {
    this.pending.forEach(({ reject }) => reject(new AnalysisWorkerError(detail)))
    this.pending.clear()
  }
}
