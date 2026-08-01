import { compileAnalysisSnapshot, planIncrementalCompilation } from '../src/analysis/incremental'
import type { AnalysisSnapshot } from '../src/analysis/types'
import { ANALYSIS_WORKER_PROTOCOL_VERSION, type WorkerRequest, type WorkerResponse } from '../src/analysis/worker-protocol'
import { AnalysisWorkerRuntime } from '../src/analysis/worker-runtime'
import { MemoryAnalysisCache, type AnalysisCache } from '../src/services/analysis-cache'
import { createAnalysisService } from '../src/services/analysis-service'
import { AnalysisWorkerClient, type AnalysisCompiler } from '../src/services/analysis-worker-client'
import type { Universe } from '../src/types/universe'
import { analysisEventFixture } from './fixtures/analysis-v3_3'
import { connectionsFixture } from './fixtures/connections-v3_5'

const generatedAt = '2042-04-12T00:00:00.000Z'

function compileRequest(universe: Universe): WorkerRequest {
  return { protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'compile', requestId: 'analysis-test', universe }
}

class TestCompiler implements AnalysisCompiler {
  calls = 0
  cancelled = false
  disposed = false

  async compile(universe: Universe, previousSnapshot: AnalysisSnapshot | undefined): Promise<AnalysisSnapshot> {
    this.calls += 1
    return compileAnalysisSnapshot(universe, previousSnapshot, { generatedAt })
  }

  cancelCompilation(): void {
    this.cancelled = true
  }

  dispose(): void {
    this.disposed = true
  }
}

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null
  onerror: (() => void) | null = null
  readonly posted: WorkerRequest[] = []
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(message: WorkerRequest): void {
    this.posted.push(message)
  }

  terminate(): void {
    this.terminated = true
  }
}

describe('analysis worker runtime', () => {
  it('reports progress before returning a completed snapshot', async () => {
    const responses: WorkerResponse[] = []
    const runtime = new AnalysisWorkerRuntime((response) => responses.push(response))

    await runtime.handle(compileRequest(structuredClone(analysisEventFixture)))

    expect(responses.filter((response) => response.type === 'progress').map((response) => response.stage)).toEqual(['queued', 'compiling-indexes', 'serializing-result'])
    expect(responses.at(-1)).toMatchObject({ type: 'complete', requestId: 'analysis-test', result: { snapshotVersion: '1' } })
  })

  it('compiles heavy connection metrics inside the Worker runtime', async () => {
    const responses: WorkerResponse[] = []
    const runtime = new AnalysisWorkerRuntime((response) => responses.push(response))

    await runtime.handle(compileRequest(structuredClone(connectionsFixture)))

    const complete = responses.find((response): response is Extract<WorkerResponse, { type: 'complete' }> => response.type === 'complete')
    expect(complete?.result.connections).toMatchObject({ engine: 'connections', metrics: { betweenness: { status: 'computed' } } })
  })

  it('cancels safely at a yield boundary without returning a partial snapshot', async () => {
    const responses: WorkerResponse[] = []
    const runtime = new AnalysisWorkerRuntime((response) => responses.push(response))
    const pending = runtime.handle(compileRequest(structuredClone(analysisEventFixture)))
    runtime.handle({ protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'cancel', requestId: 'analysis-test' })

    await pending

    expect(responses.some((response) => response.type === 'error' && response.error.code === 'CANCELLED')).toBe(true)
    expect(responses.some((response) => response.type === 'complete')).toBe(false)
  })

  it('serializes compilation failures as typed worker errors', async () => {
    const responses: WorkerResponse[] = []
    const runtime = new AnalysisWorkerRuntime((response) => responses.push(response))
    const malformed = { ...compileRequest(structuredClone(analysisEventFixture)), universe: undefined } as unknown as WorkerRequest

    await runtime.handle(malformed)

    expect(responses.at(-1)).toMatchObject({ type: 'error', error: { code: 'COMPILATION_FAILED' } })
  })

  it('rejects an incompatible Worker protocol version', () => {
    const responses: WorkerResponse[] = []
    const runtime = new AnalysisWorkerRuntime((response) => responses.push(response))
    const incompatible = { ...compileRequest(structuredClone(analysisEventFixture)), protocolVersion: '0' } as unknown as WorkerRequest

    runtime.handle(incompatible)

    expect(responses).toEqual([expect.objectContaining({ type: 'error', error: expect.objectContaining({ code: 'PROTOCOL_MISMATCH' }) })])
  })
})

describe('analysis worker client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeWorker.instances = []
  })

  it('delegates compilation to a Worker instead of running indexes on the UI thread', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const client = new AnalysisWorkerClient()
    const snapshot = compileAnalysisSnapshot(structuredClone(analysisEventFixture), undefined, { generatedAt })
    const pending = client.compile(structuredClone(analysisEventFixture), undefined)
    const worker = FakeWorker.instances[0]
    if (!worker) throw new Error('Worker client did not create a worker.')

    expect(worker.posted).toEqual([expect.objectContaining({ type: 'compile', universe: analysisEventFixture })])
    worker.onmessage?.({ data: { protocolVersion: ANALYSIS_WORKER_PROTOCOL_VERSION, type: 'complete', requestId: 'analysis-1', result: snapshot } } as MessageEvent<WorkerResponse>)

    await expect(pending).resolves.toBe(snapshot)
    client.dispose()
    expect(worker.terminated).toBe(true)
  })

  it('rejects a pending compilation when the Worker is interrupted', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const client = new AnalysisWorkerClient()
    const pending = client.compile(structuredClone(analysisEventFixture), undefined)
    const worker = FakeWorker.instances[0]
    if (!worker) throw new Error('Worker client did not create a worker.')

    worker.onerror?.()

    await expect(pending).rejects.toThrow('stopped unexpectedly')
    client.dispose()
  })
})

describe('analysis service cache and incremental plans', () => {
  it('uses a valid cache entry rather than recompiling', async () => {
    const compiler = new TestCompiler()
    const service = createAnalysisService({ cache: new MemoryAnalysisCache(), compiler })

    const first = await service.compileUniverse(structuredClone(analysisEventFixture))
    const second = await service.compileUniverse(structuredClone(analysisEventFixture))

    expect(compiler.calls).toBe(1)
    expect(second).toBe(first)
    expect(service.getLatestSnapshot()).toBe(first)
  })

  it('clears a damaged cache entry and recompiles instead of trusting it', async () => {
    let clears = 0
    const damagedCache: AnalysisCache = {
      async get() { return { snapshotVersion: '1', metadata: { sourceHash: 'wrong' } } as AnalysisSnapshot },
      async set() {},
      async clear() { clears += 1 },
    }
    const compiler = new TestCompiler()
    const service = createAnalysisService({ cache: damagedCache, compiler })

    const snapshot = await service.compileUniverse(structuredClone(analysisEventFixture))

    expect(snapshot.metadata.sourceHash).not.toBe('wrong')
    expect(compiler.calls).toBe(1)
    expect(clears).toBe(1)
  })

  it('invalidates a cache entry when the schema version changes', async () => {
    const compiler = new TestCompiler()
    const service = createAnalysisService({ cache: new MemoryAnalysisCache(), compiler })
    const changedVersion = structuredClone(analysisEventFixture)
    changedVersion.metadata.schemaVersion = '3.3.1'

    await service.compileUniverse(structuredClone(analysisEventFixture))
    await service.compileUniverse(changedVersion)

    expect(compiler.calls).toBe(2)
  })

  it('marks dependency-connected entities after a safe modification', () => {
    const baseline = compileAnalysisSnapshot(structuredClone(analysisEventFixture), undefined, { generatedAt })
    const changed = structuredClone(analysisEventFixture)
    const observatory = changed.modules[0].content.items?.find((entity) => entity.id === 'meme-observatory')
    if (!observatory) throw new Error('Fixture location is required.')
    observatory.title = 'Renamed observatory'

    const { plan } = planIncrementalCompilation(changed, baseline)

    expect(plan).toMatchObject({ mode: 'partial', changes: { modified: ['meme-observatory'] } })
    expect(plan.affectedEntityIds).toEqual(expect.arrayContaining(['meme-observatory', 'meme-revelation']))
    expect(plan.affectedIndexes).toEqual(['entity-index', 'relation-graph', 'dependency-index'])
  })

  it('uses a full rebuild for removals and does not retain deleted connections', () => {
    const baseline = compileAnalysisSnapshot(structuredClone(analysisEventFixture), undefined, { generatedAt })
    const changed = structuredClone(analysisEventFixture)
    const items = changed.modules[0].content.items
    if (!items) throw new Error('Fixture entities are required.')
    changed.modules[0].content.items = items
      .filter((entity) => entity.id !== 'meme-outcome')
      .map((entity) => entity.id === 'meme-revelation' ? { ...entity, foreshadowing: [], effects: [] } : entity)

    const snapshot = compileAnalysisSnapshot(changed, baseline, { generatedAt })

    expect(snapshot.incremental).toMatchObject({ mode: 'full', reason: 'entity-set-changed', changes: { removed: ['meme-outcome'] } })
    expect(snapshot.compilation.relationGraph.nodes.map((node) => node.id)).not.toContain('meme-outcome')
    expect(snapshot.compilation.relationGraph.edges.some((edge) => edge.targetId === 'meme-outcome' || edge.sourceId === 'meme-outcome')).toBe(false)
    expect(snapshot.compilation.dependencyIndex.affectedEntityIdsByEntity['meme-outcome']).toBeUndefined()
  })

  it('falls back to a full rebuild when engine versions are incompatible', () => {
    const baseline = compileAnalysisSnapshot(structuredClone(analysisEventFixture), undefined, { generatedAt })
    const incompatible = structuredClone(baseline)
    incompatible.metadata.engineVersion = 'legacy'

    expect(planIncrementalCompilation(structuredClone(analysisEventFixture), incompatible).plan).toMatchObject({ mode: 'full', reason: 'snapshot-version-mismatch' })
  })

  it('exposes cancellation and cache clearing through the application API', async () => {
    const compiler = new TestCompiler()
    const service = createAnalysisService({ cache: new MemoryAnalysisCache(), compiler })

    await service.compileUniverse(structuredClone(analysisEventFixture))
    service.cancelCompilation()
    await service.clearAnalysisCache()
    await service.compileUniverse(structuredClone(analysisEventFixture))
    service.dispose()

    expect(compiler.cancelled).toBe(true)
    expect(compiler.calls).toBe(2)
    expect(service.getLatestSnapshot()).toBeUndefined()
    expect(compiler.disposed).toBe(true)
  })
})
