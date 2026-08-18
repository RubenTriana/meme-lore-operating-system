import type { Universe } from '../types/universe'
import type { AnalysisSnapshot } from './types'

export const ANALYSIS_WORKER_PROTOCOL_VERSION = '1' as const

export interface SerializedAnalysisError {
  code: 'CANCELLED' | 'COMPILATION_FAILED' | 'PROTOCOL_MISMATCH'
  name: string
  message: string
}

export type WorkerRequest =
  | {
      protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION
      type: 'compile'
      requestId: string
      universe: Universe
      previousSnapshot?: AnalysisSnapshot
    }
  | {
      protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION
      type: 'cancel'
      requestId: string
    }

export type WorkerResponse =
  | {
      protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION
      type: 'progress'
      requestId: string
      progress: number
      stage: string
    }
  | {
      protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION
      type: 'complete'
      requestId: string
      result: AnalysisSnapshot
    }
  | {
      protocolVersion: typeof ANALYSIS_WORKER_PROTOCOL_VERSION
      type: 'error'
      requestId: string
      error: SerializedAnalysisError
    }
