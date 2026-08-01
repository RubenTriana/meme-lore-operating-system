import { AnalysisWorkerRuntime } from '@/analysis/worker-runtime'
import type { WorkerRequest } from '@/analysis/worker-protocol'

const runtime = new AnalysisWorkerRuntime((response) => self.postMessage(response))

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void runtime.handle(event.data)
}
