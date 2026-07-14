import { compileAnalysisSnapshot } from '../src/analysis/incremental'
import type { AnalysisAnnotations } from '../src/services/analysis-annotations'
import { analysisDiagnosticBlob, createAnalysisDiagnosticExport } from '../src/services/analysis-export'
import { continuityContradictionFixture } from './fixtures/continuity-v3_4'

describe('diagnostic export', () => {
  it('exports deterministic analysis identity and only matching local annotations', async () => {
    const snapshot = compileAnalysisSnapshot(continuityContradictionFixture(), undefined, { generatedAt: '2042-04-12T00:00:00.000Z' })
    const issue = snapshot.issues[0]
    if (!issue) throw new Error('The continuity fixture must produce an issue.')
    const annotations: AnalysisAnnotations = {
      [issue.id]: { issueId: issue.id, decision: 'confirmed', evidenceHash: 'evidence', sourceHash: issue.sourceHash, engineVersion: issue.engineVersion, updatedAt: '2042-04-12T00:00:00.000Z' },
      unrelated: { issueId: 'unrelated', decision: 'ignored', evidenceHash: 'other', sourceHash: 'other', engineVersion: 'other', updatedAt: '2042-04-12T00:00:00.000Z' },
    }
    const exported = createAnalysisDiagnosticExport(snapshot, annotations, '2042-04-13T00:00:00.000Z')

    expect(exported).toMatchObject({ formatVersion: '1', exportedAt: '2042-04-13T00:00:00.000Z', metadata: snapshot.metadata })
    expect(exported.annotations).toEqual({ [issue.id]: annotations[issue.id] })
    const blob = analysisDiagnosticBlob(snapshot, annotations)
    expect(blob.type).toBe('application/json')
    expect(blob.size).toBeGreaterThan(0)
  })
})
