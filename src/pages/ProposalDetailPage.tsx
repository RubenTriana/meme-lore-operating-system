import { Archive, ArrowLeft, CheckCircle2, Download, Eye, FileCheck2, FlaskConical, RotateCcw, Save, ShieldCheck, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { hashCanonical } from '@/analysis/derived'
import { proposalsRoute } from '@/app/routes'
import { useUniverseModel } from '@/app/useUniverseModel'
import { Badge, Button, Card, Progress } from '@/components/ui'
import { proposalCandidateBlob, proposalManifestBlob, proposalPatchBlob, proposalReportBlob } from '@/proposals/export'
import { proposalRepository } from '@/proposals/repository'
import type { ProposalRecord, ProposalStatus } from '@/proposals/types'
import { compareProposalAnalysis, proposalCandidate, withTemporaryEngines } from '@/proposals/workflow'
import { createAnalysisService } from '@/services/analysis-service'
import type { AnalysisService } from '@/services/analysis-service'
import { downloadBlob } from '@/services/universe-loader'
import { saveSnapshot } from '@/services/snapshots'
import { ANALYSIS_PRESETS, useStudioStore } from '@/store/useStudioStore'
import type { AnalysisEngines } from '@/types/universe'

type TabId = 'summary' | 'validation' | 'changes' | 'simulation' | 'analysis' | 'decision'
const tabs: Array<[TabId, string]> = [['summary', 'Resumen'], ['validation', 'Validación'], ['changes', 'Cambios'], ['simulation', 'Simulación'], ['analysis', 'Análisis'], ['decision', 'Decisión']]
const statusTone = (status: ProposalStatus): 'neutral' | 'amber' | 'green' | 'blue' | 'red' => status === 'invalid' || status === 'rejected' ? 'red' : status === 'approved' || status === 'exported' ? 'green' : status === 'simulated' || status === 'applied-to-workspace' ? 'blue' : 'amber'

export function ProposalDetailPage({ serviceFactory = createAnalysisService }: { serviceFactory?: () => AnalysisService } = {}) {
  const { proposalId } = useParams()
  const { baseUniverse, openCandidate, restoreBase, workspaceState, workspaceProposalId } = useUniverseModel()
  const studio = useStudioStore()
  const [proposal, setProposal] = useState<ProposalRecord>()
  const [tab, setTab] = useState<TabId>('summary')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ value: 0, stage: 'en espera' })
  const [message, setMessage] = useState<string>()
  const [note, setNote] = useState('')
  const [confirmApproval, setConfirmApproval] = useState(false)
  const [snapshotBeforeOpen, setSnapshotBeforeOpen] = useState(true)
  const [moduleFilter, setModuleFilter] = useState('all')
  const [operationFilter, setOperationFilter] = useState('all')
  const serviceRef = useRef(serviceFactory())
  const selectedEngines = useMemo<AnalysisEngines>(() => Object.values(studio.analysisEngines).some(Boolean) ? studio.analysisEngines : ANALYSIS_PRESETS.full, [studio.analysisEngines])

  useEffect(() => {
    const service = serviceRef.current
    if (proposalId) void proposalRepository.get(proposalId).then((loaded) => { setProposal(loaded); setNote(loaded?.note ?? '') })
    return () => service.dispose()
  }, [proposalId])

  const persist = async (next: ProposalRecord) => { await proposalRepository.put(next); setProposal(next) }
  const changeStatus = async (status: ProposalStatus, kind?: 'draft' | 'approved' | 'rejected' | 'archived') => {
    if (!proposal) return
    const now = new Date().toISOString()
    await persist({ ...proposal, status, updatedAt: now, note: note.trim() || undefined, ...(kind ? { decision: { kind, at: now, ...(note.trim() ? { note: note.trim() } : {}) } } : {}) })
  }

  const simulate = async () => {
    if (!proposal || !baseUniverse) return
    const candidate = proposalCandidate(proposal, baseUniverse)
    if (!candidate) { setMessage('El hash base cambió o el patch ya no produce un candidato válido.'); return }
    setBusy(true); setMessage(undefined); setProgress({ value: 0.01, stage: 'preparando base' })
    try {
      const analysisBase = withTemporaryEngines(baseUniverse, selectedEngines)
      const analysisCandidate = withTemporaryEngines(candidate, selectedEngines)
      const baseSnapshot = await serviceRef.current.compileUniverse(analysisBase, { onProgress: (next) => setProgress({ value: next.progress * 0.45, stage: `base · ${next.stage}` }) })
      const candidateSnapshot = await serviceRef.current.compileUniverse(analysisCandidate, { onProgress: (next) => setProgress({ value: 0.5 + next.progress * 0.5, stage: `candidato · ${next.stage}` }) })
      const now = new Date().toISOString()
      const simulation = { simulatedAt: now, engines: { ...selectedEngines }, baseHash: proposal.baseUniverseHash, candidateHash: hashCanonical(candidate), candidateUniverse: candidate, baseSnapshot, candidateSnapshot, comparison: compareProposalAnalysis(baseUniverse, candidate, baseSnapshot, candidateSnapshot) }
      await persist({ ...proposal, status: 'simulated', updatedAt: now, simulation })
      studio.setAnalysisLastRunAt(candidateSnapshot.metadata.generatedAt)
      setProgress({ value: 1, stage: 'completado' }); setMessage('Simulación completada. El workspace activo no cambió.'); setTab('simulation')
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'La simulación no pudo completarse.')
    } finally { setBusy(false) }
  }

  const approve = async () => {
    if (!proposal || !baseUniverse || !confirmApproval) return
    const currentBaseHash = hashCanonical(baseUniverse)
    if (!proposal.validation.valid || !proposal.simulation || proposal.baseUniverseHash !== currentBaseHash || proposal.simulation.baseHash !== currentBaseHash) { setMessage('La aprobación exige validación, simulación vigente y hash base coincidente.'); return }
    await changeStatus('approved', 'approved'); setMessage('Propuesta aprobada. El workspace y el archivo fuente permanecen sin cambios.')
  }

  const openInWorkspace = async () => {
    if (!proposal?.simulation || !baseUniverse) return
    if (snapshotBeforeOpen) saveSnapshot(baseUniverse)
    openCandidate(proposal.simulation.candidateUniverse, proposal.id)
    await persist({ ...proposal, status: 'applied-to-workspace', updatedAt: new Date().toISOString() })
    setMessage('Workspace candidato abierto. El archivo canónico del repositorio no ha sido modificado.')
  }

  const restore = async () => {
    if (!proposal) return
    restoreBase()
    const status: ProposalStatus = proposal.decision?.kind === 'approved' ? 'approved' : 'simulated'
    await persist({ ...proposal, status, updatedAt: new Date().toISOString() })
    setMessage('Canon base restaurado; la propuesta y su simulación se conservan.')
  }

  const discardSimulation = async () => {
    if (!proposal) return
    if (workspaceProposalId === proposal.id) restoreBase()
    const withoutSimulation: ProposalRecord = { ...proposal, simulation: undefined, status: proposal.validation.valid ? 'validated' : 'invalid', updatedAt: new Date().toISOString() }
    await persist(withoutSimulation)
    setMessage('SimulaciÃ³n descartada. La propuesta importada permanece en cuarentena.')
  }

  const snapshotCandidate = () => {
    if (!proposal?.simulation) return
    saveSnapshot(proposal.simulation.candidateUniverse)
    setMessage('Snapshot local del candidato creado sin modificar el canon base.')
  }

  const exportPromotion = async (kind: 'patch' | 'normalized' | 'candidate' | 'report' | 'manifest') => {
    if (!proposal) return
    const candidateBlob = proposalCandidateBlob(proposal)
    if (kind === 'candidate' && !candidateBlob) return
    const exports = {
      patch: [proposalPatchBlob(proposal), proposal.fileName],
      normalized: [proposalPatchBlob(proposal), `${proposal.id}.normalized.patch.json`],
      candidate: [candidateBlob!, `${proposal.id}.universe_master.candidate.json`],
      report: [proposalReportBlob(proposal), `${proposal.id}.md`],
      manifest: [proposalManifestBlob(proposal), `${proposal.id}.manifest.json`],
    } as const
    downloadBlob(exports[kind][0], exports[kind][1])
    await persist({ ...proposal, status: 'exported', updatedAt: new Date().toISOString() })
  }

  if (!proposal || !baseUniverse) return <Card className="analysis-empty-state"><FileCheck2 size={28} /><h2>Propuesta no encontrada</h2><p>Regresa a la bandeja y vuelve a importarla.</p></Card>
  const visibleReviews = proposal.validation.operationReviews.filter((review) => (moduleFilter === 'all' || review.moduleId === moduleFilter) && (operationFilter === 'all' || review.operation.op === operationFilter))
  const comparison = proposal.simulation?.comparison
  const canPromote = ['approved', 'applied-to-workspace', 'exported'].includes(proposal.status)
  const candidateIsOpen = workspaceState === 'candidate' && workspaceProposalId === proposal.id

  return <div className="proposal-page proposal-detail-page">
    <header className="module-hero"><div><p className="eyebrow">Revisión aislada</p><h1>{proposal.fileName}</h1><p><code>{proposal.id}</code></p></div><div className="analysis-actions"><Link className="button button-secondary" to={proposalsRoute}><ArrowLeft size={16} /> Propuestas</Link><Button onClick={() => void simulate()} disabled={busy || !proposal.validation.valid}><FlaskConical size={16} /> {proposal.simulation ? 'Volver a simular' : 'Simular propuesta'}</Button></div></header>
    <Card className="proposal-status-strip"><Badge tone={statusTone(proposal.status)}>{proposal.status}</Badge><span>{proposal.operations} operaciones</span><span>{proposal.validation.structuralSafety}</span><span>Base {proposal.baseUniverseHash}</span></Card>
    {message && <Card className="analysis-runtime-card" role="status"><p>{message}</p></Card>}
    {busy && <Card className="analysis-runtime-card"><div className="analysis-runtime-heading"><strong>{progress.stage}</strong><span>{Math.round(progress.value * 100)}%</span></div><Progress value={progress.value * 100} /></Card>}
    <nav className="proposal-tabs" aria-label="Secciones de la propuesta">{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>

    {tab === 'summary' && <section className="proposal-summary-grid"><Card><span>Archivo</span><strong>{proposal.fileName}</strong><small>{proposal.fileHash}</small></Card><Card><span>Universo base</span><strong>{proposal.baseUniverseHash}</strong></Card><Card><span>Entidades afectadas</span><strong>{proposal.diff.addedEntityIds.length + proposal.diff.modifiedEntityIds.length}</strong><small>{proposal.diff.addedEntityIds.length} nuevas · {proposal.diff.modifiedEntityIds.length} modificadas</small></Card><Card><span>Módulos</span><strong>{proposal.diff.affectedModuleIds.join(', ') || '—'}</strong></Card><Card><span>Errores / warnings</span><strong>{proposal.validation.errors.length} / {proposal.validation.warnings.length}</strong></Card><Card><span>Compatibilidad</span><strong>{proposal.validation.compatibilityScore}/100</strong><small>{proposal.validation.compatibilityFormula}</small></Card></section>}

    {tab === 'validation' && <><section className="analysis-meta-grid"><Card><span>JSON</span><strong>{proposal.validation.jsonValid ? 'PASS' : 'FAIL'}</strong></Card><Card><span>JSON Schema / Zod</span><strong>{proposal.validation.jsonSchemaValid && proposal.validation.zodValid ? 'PASS' : 'FAIL'}</strong></Card><Card><span>Referencias / IDs</span><strong>{proposal.validation.referencesValid && proposal.validation.idsValid ? 'PASS' : 'FAIL'}</strong></Card><Card><span>Idempotencia</span><strong>{proposal.validation.idempotence}</strong></Card></section><Card className="proposal-operation-list"><div className="section-heading"><h2>Clasificación de operaciones</h2><Badge tone={proposal.validation.valid ? 'green' : 'red'}>{proposal.validation.operationReviews.length}</Badge></div>{proposal.validation.operationReviews.map((review) => <article key={`${review.index}-${review.operation.path}`}><Badge tone={review.status === 'SAFE' ? 'green' : review.status === 'REJECTED' ? 'red' : 'amber'}>{review.status}</Badge><code>{review.operation.op} {review.operation.path}</code><p>{review.message}</p></article>)}</Card></>}

    {tab === 'changes' && <><Card className="proposal-filter-bar"><label>Módulo<select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}><option value="all">Todos</option>{proposal.diff.affectedModuleIds.map((id) => <option key={id}>{id}</option>)}</select></label><label>Operación<select value={operationFilter} onChange={(event) => setOperationFilter(event.target.value)}><option value="all">Todas</option><option value="add">add</option><option value="replace">replace</option><option value="remove">remove</option></select></label></Card><section className="proposal-diff-summary"><Card><span>Entidades añadidas</span><strong>{proposal.diff.addedEntityIds.length}</strong></Card><Card><span>Entidades modificadas</span><strong>{proposal.diff.modifiedEntityIds.length}</strong></Card><Card><span>Append refs</span><strong>{proposal.diff.referencesAdded}</strong></Card><Card><span>Eliminaciones</span><strong>{proposal.diff.fieldsRemoved + proposal.diff.removedEntityIds.length}</strong></Card><Card><span>Títulos / summaries reemplazados</span><strong>{proposal.diff.titlesReplaced} / {proposal.diff.summariesReplaced}</strong></Card></section><Card className="proposal-operation-list">{visibleReviews.map((review) => <article key={`${review.index}-${review.operation.path}`}><code>{review.operation.path}</code><div className="proposal-before-after"><span>Antes: {JSON.stringify(review.before) ?? '—'}</span><span>Después: {JSON.stringify(review.after) ?? '—'}</span></div></article>)}</Card></>}

    {tab === 'simulation' && <>{!comparison && <Card className="analysis-empty-state"><FlaskConical size={28} /><h2>Simulación no ejecutada</h2><p>La simulación clona la base, aplica el patch, valida, construye índices y ejecuta motores sin cambiar el workspace.</p></Card>}{comparison && <><section className="proposal-comparison"><Card><span>Métrica</span><strong>Base</strong><strong>Candidato</strong></Card>{[['Entidades', comparison.base.entities, comparison.candidate.entities], ['Eventos', comparison.base.events, comparison.candidate.events], ['Módulos', comparison.base.modules, comparison.candidate.modules], ['Enlaces canónicos', comparison.base.canonicalLinks, comparison.candidate.canonicalLinks], ['Aristas derivadas', comparison.base.derivedEdges, comparison.candidate.derivedEdges], ['Nodos aislados', comparison.base.isolatedNodes ?? 'N/A', comparison.candidate.isolatedNodes ?? 'N/A'], ['Componentes', comparison.base.components ?? 'N/A', comparison.candidate.components ?? 'N/A']].map(([label, before, after]) => <Card key={label}><span>{label}</span><strong>{before}</strong><strong>{after}</strong></Card>)}</section><Card className="candidate-reader"><div className="section-heading"><div><p className="eyebrow">CANDIDATO SIMULADO — NO CANÓNICO</p><h2>Entidades nuevas</h2></div><Badge tone="blue">solo lectura</Badge></div>{proposal.diff.addedEntityIds.map((id) => { const entity = proposal.simulation?.candidateUniverse.modules.flatMap((module) => module.content.items ?? []).find((item) => item.id === id); return <article key={id}><strong>{entity?.title ?? id}</strong><p>{entity?.summary}</p></article> })}</Card><Card><div className="section-heading"><div><p className="eyebrow">Foreshadowing estructurado</p><h2>Semillas y destinos</h2></div><Badge tone={comparison.foreshadowing.unresolvedTargetIds.length ? 'amber' : 'green'}>{comparison.foreshadowing.unresolvedTargetIds.length ? 'Revisar destinos' : 'Destinos resueltos'}</Badge></div><p>{comparison.foreshadowing.baseSeeds} → {comparison.foreshadowing.candidateSeeds} entidades con semillas.</p><p>Nuevas: {comparison.foreshadowing.newSeedEntityIds.join(', ') || 'ninguna'}.</p><p>Destinos referenciados: {comparison.foreshadowing.referencedTargetIds.join(', ') || 'ninguno'}.</p><p>Semillas sin destino existente: {comparison.foreshadowing.unresolvedTargetIds.join(', ') || 'ninguna'}.</p></Card><div className="button-row"><Button className="button-secondary" onClick={snapshotCandidate}>Crear snapshot del candidato</Button><Button className="button-secondary" onClick={() => void discardSimulation()}>Descartar simulación</Button></div></>}</>}

    {tab === 'analysis' && <>{!comparison ? <Card className="analysis-empty-state"><ShieldCheck size={28} /><h2>Sin comparación analítica</h2><p>Simula la propuesta para comparar diagnósticos y cobertura.</p></Card> : <><section className="proposal-summary-grid"><Card><span>Nuevos issues</span><strong>{comparison.newIssueIds.length}</strong></Card><Card><span>Issues resueltos</span><strong>{comparison.resolvedIssueIds.length}</strong></Card><Card><span>Observaciones nuevas</span><strong>{comparison.newObservationIds.length}</strong></Card><Card><span>Compatibilidad canónica</span><strong>{comparison.compatibilityScore}/100</strong></Card><Card><span>Cobertura analítica</span><strong>{comparison.coveragePercent}%</strong><small>Ausentes: {comparison.missingCoverage.join(', ') || 'ninguno'}</small></Card></section><Card><h2>Plausibilidad narrativa</h2><p>No aplicable — esta propuesta amplía lore y foreshadowing, pero no representa una acción hipotética de personaje.</p></Card></>}</>}

    {tab === 'decision' && <section className="proposal-decision-layout"><Card><div className="section-heading"><h2>Decisión autoral</h2><Badge tone={statusTone(proposal.status)}>{proposal.status}</Badge></div><label>Nota opcional<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Motivo o contexto autoral" /></label><label className="proposal-confirm"><input type="checkbox" checked={confirmApproval} onChange={(event) => setConfirmApproval(event.target.checked)} /> Confirmo que revisé validación, diff, simulación y evidencia.</label><div className="button-row"><Button className="button-secondary" onClick={() => void changeStatus('validated', 'draft')}><Save size={15} /> Conservar como borrador</Button><Button onClick={() => void approve()} disabled={!confirmApproval || !proposal.simulation || !proposal.validation.valid}><CheckCircle2 size={15} /> Aprobar</Button><Button className="button-secondary" onClick={() => void changeStatus('rejected', 'rejected')}><XCircle size={15} /> Rechazar</Button><Button className="button-secondary" onClick={() => void changeStatus('archived', 'archived')}><Archive size={15} /> Archivar</Button></div></Card><Card><div className="section-heading"><h2>Workspace candidato</h2><Eye size={18} /></div><label className="proposal-confirm"><input type="checkbox" checked={snapshotBeforeOpen} onChange={(event) => setSnapshotBeforeOpen(event.target.checked)} /> Crear snapshot local de la base antes de abrir.</label><div className="button-row"><Button onClick={() => void openInWorkspace()} disabled={!proposal.simulation || proposal.status === 'rejected' || proposal.status === 'invalid'}>Abrir candidato en workspace</Button>{candidateIsOpen && <Button className="button-secondary" onClick={() => void restore()}><RotateCcw size={15} /> Restaurar canon base</Button>}</div><p>Esta acción solo cambia el navegador. Nunca escribe `data/universe_master.json`.</p></Card><Card><div className="section-heading"><h2>Preparar promoción canónica</h2><Download size={18} /></div><p>Disponible después de aprobar. Exporta artefactos para revisión y commit; no escribe el repositorio.</p><div className="button-row"><Button disabled={!canPromote} onClick={() => void exportPromotion('patch')}>Patch original</Button><Button className="button-secondary" disabled={!canPromote} onClick={() => void exportPromotion('normalized')}>Patch normalizado</Button><Button className="button-secondary" disabled={!canPromote} onClick={() => void exportPromotion('candidate')}>Master candidato</Button><Button className="button-secondary" disabled={!canPromote} onClick={() => void exportPromotion('report')}>Informe</Button><Button className="button-secondary" disabled={!canPromote} onClick={() => void exportPromotion('manifest')}>Manifiesto</Button></div></Card></section>}
  </div>
}
