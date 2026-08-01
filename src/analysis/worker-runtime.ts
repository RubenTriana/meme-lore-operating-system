import { compileAnalysisSnapshot } from './incremental'
import { ANALYSIS_WORKER_PROTOCOL_VERSION, type SerializedAnalysisError, type WorkerRequest, type WorkerResponse } from './worker-protocol'

export type WorkerResponseSink = (response: WorkerResponse) => void

function nextTurn(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function serializeError(error: unknown, code: SerializedAnalysisError['code']): SerializedAnalysisError {
  if (error instanceof Error) return { code, name: error.name, message: error.message }
  return { code, name: 'AnalysisError', message: String(error) }
}

export class AnalysisWorkerRuntime {
  private readonly cancelled = new Set<string>()
  private readonly active = new Set<string>()

  constructor(private readonly post: WorkerResponseSink) {}

  handle(request: WorkerRequest): Promise<void> | void {
    if (request.protocolVersion !== ANALYSIS_WORKER_PROTOCOL_VERSION) {
      this.post({ protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'error', requestId: request.requestId, error: { code: 'PROTOCOL_MISMATCH', name: 'ProtocolMismatchError', message: 'Unsupported analysis worker protocol version.' } })
      return
    }
    if (request.type === 'cancel') {
      if (this.active.has(request.requestId)) this.cancelled.add(request.requestId)
      return
    }
    this.active.add(request.requestId)
    return this.compile(request)
  }

  private isCancelled(requestId: string): boolean {
    return this.cancelled.has(requestId)
  }

  private postCancellation(requestId: string): void {
    this.post({ protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'error', requestId, error: { code: 'CANCELLED', name: 'AnalysisCancelledError', message: 'Analysis compilation was cancelled.' } })
  }

  private async compile(request: Extract<WorkerRequest, { type: 'compile' }>): Promise<void> {
    try {
      this.post({ protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'progress', requestId: request.requestId, progress: 0.05, stage: 'queued' })
      await nextTurn()
      if (this.isCancelled(request.requestId)) {
        this.postCancellation(request.requestId)
        return
      }
      this.post({ protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'progress', requestId: request.requestId, progress: 0.2, stage: 'compiling-indexes' })
      await nextTurn()
      if (this.isCancelled(request.requestId)) {
        this.postCancellation(request.requestId)
        return
      }
      const result = compileAnalysisSnapshot(request.universe, request.previousSnapshot)
      if (this.isCancelled(request.requestId)) {
        this.postCancellation(request.requestId)
        return
      }
      this.post({ protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'progress', requestId: request.requestId, progress: 0.9, stage: 'serializing-result' })
      await nextTurn()
      if (this.isCancelled(request.requestId)) {
        this.postCancellation(request.requestId)
        return
      }
      this.post({ protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'complete', requestId: request.requestId, result })
    } catch (error) {
      this.post({ protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'error', requestId: request.requestId, error: serializeError(error, 'COMPILATION_FAILED') })
    } finally {
      this.active.delete(request.requestId)
      this.cancelled.delete(request.requestId)
    }
  }
}
