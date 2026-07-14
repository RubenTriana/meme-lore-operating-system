import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileCheck2, Plus, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { analysisRoute, proposalsRoute } from '@/app/routes'
import { useUniverseModel } from '@/app/useUniverseModel'
import { Badge, Button, Card } from '@/components/ui'
import { MockNarrativeExtractionAdapter } from '@/extraction/mock-adapter'
import { extractSelectedSource, sourceDisclosure } from '@/extraction/security'
import type { ExtractionPatchResult, ExtractionProposal, NarrativeSource, ProposalStatus } from '@/extraction/types'
import { buildExtractionPatch, reviewProposalItem, serializeExtractionPatch } from '@/extraction/workflow'
import { downloadBlob } from '@/services/universe-loader'
import { useStudioStore } from '@/store/useStudioStore'
import { createProposal } from '@/proposals/workflow'
import { proposalRepository } from '@/proposals/repository'

const statusOptions: ProposalStatus[] = ['proposed', 'accepted', 'rejected']

export function ExtractionPage() {
  const { universe, baseUniverse, validation } = useUniverseModel()
  const navigate = useNavigate()
  const enabled = useStudioStore((state) => state.aiExtractionEnabled)
  const [source, setSource] = useState<NarrativeSource>({ id: 'manual-source', fragments: [{ id: 'fragment-1', text: '', selected: true, sourceLabel: 'Fragmento manual 1' }] })
  const [proposal, setProposal] = useState<ExtractionProposal>()
  const [patchResult, setPatchResult] = useState<ExtractionPatchResult>()
  const [approved, setApproved] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string>()
  const adapter = useMemo(() => new MockNarrativeExtractionAdapter(), [])
  const disclosure = useMemo(() => sourceDisclosure(source), [source])

  if (!validation.valid || !universe) return <Card className="analysis-empty-state"><h2>Canon inválido</h2><p>La revisión de patches requiere un canon válido como base.</p></Card>

  const changeFragment = (id: string, update: Partial<NarrativeSource['fragments'][number]>) => {
    setSource((current) => ({ ...current, fragments: current.fragments.map((fragment) => fragment.id === id ? { ...fragment, ...update } : fragment) }))
    setProposal(undefined); setPatchResult(undefined); setApproved(false); setApplied(false)
  }
  const addFragment = () => setSource((current) => ({ ...current, fragments: [...current.fragments, { id: `fragment-${current.fragments.length + 1}`, text: '', selected: false, sourceLabel: `Fragmento manual ${current.fragments.length + 1}` }] }))
  const extract = async () => {
    try { setProposal(await extractSelectedSource(adapter, source)); setPatchResult(undefined); setApproved(false); setApplied(false); setError(undefined) }
    catch (caught) { setProposal(undefined); setError(caught instanceof Error ? caught.message : 'No se pudo generar la propuesta.') }
  }
  const review = (collection: 'proposedEntities' | 'proposedEvents' | 'proposedRelations', proposalId: string, status: ProposalStatus) => {
    if (!proposal) return
    setProposal(reviewProposalItem(proposal, collection, proposalId, status)); setPatchResult(undefined); setApproved(false); setApplied(false)
  }
  const preparePatch = () => { if (proposal) { setPatchResult(buildExtractionPatch(universe, proposal)); setApproved(false); setApplied(false) } }
  const exportPatch = () => {
    if (!patchResult) return
    try { downloadBlob(new Blob([serializeExtractionPatch(patchResult)], { type: 'application/json' }), `extraction-${source.id}-patch.json`); setError(undefined) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo exportar el patch.') }
  }
  const applyApprovedPatch = async () => {
    if (!patchResult?.validation.valid || !approved || !baseUniverse) return
    const quarantined = createProposal('assisted-extraction.patch.json', patchResult.patch, baseUniverse)
    await proposalRepository.put(quarantined)
    setApplied(true); setError(undefined); navigate(`${proposalsRoute}/${quarantined.id}`)
  }
  const spans = new Map(proposal?.sourceSpans.map((span) => [span.id, span]) ?? [])
  const itemCount = proposal ? proposal.proposedEntities.length + proposal.proposedEvents.length + proposal.proposedRelations.length : 0
  const acceptedCount = proposal ? [...proposal.proposedEntities, ...proposal.proposedEvents, ...proposal.proposedRelations].filter((item) => item.status === 'accepted').length : 0

  return <div className="extraction-page">
    <header className="module-hero analysis-hero"><div><p className="eyebrow">Frontera opcional de importación</p><h1>Propuestas de extracción narrativa</h1><p>Fuente → propuesta → revisión humana → validación → patch → aprobación explícita → canon.</p></div><div className="analysis-actions"><Link className="button button-secondary" to={analysisRoute}><ArrowLeft size={16} /> Diagnósticos</Link></div></header>
    {!enabled && <Card className="analysis-empty-state"><ShieldCheck size={28} /><h2>Feature flag desactivada</h2><p>Activa Assisted extraction en Settings. Está desactivada por defecto y no existe ningún proveedor remoto configurado.</p></Card>}
    {enabled && <>
      <section className="extraction-grid">
        <Card className="extraction-card"><div className="section-heading"><div><p className="eyebrow">1 · Fuente seleccionada</p><h2>Fragmentos narrativos</h2></div><Badge tone="green">solo texto elegido</Badge></div><p className="extraction-guide">Mock explícito: <code>ENTITY | módulo | id | tipo | título</code>, <code>EVENT | módulo | id | título</code> o <code>RELATION | origen | refs | destino</code>. Las líneas incompletas no se rellenan.</p><div className="extraction-fragments">{source.fragments.map((fragment) => <article key={fragment.id}><label className="extraction-select"><input type="checkbox" aria-label={`Seleccionar ${fragment.id}`} checked={fragment.selected} onChange={(event) => changeFragment(fragment.id, { selected: event.target.checked })} /><span>Incluir {fragment.sourceLabel}</span></label><textarea aria-label={`Texto ${fragment.id}`} value={fragment.text} onChange={(event) => changeFragment(fragment.id, { text: event.target.value })} placeholder="Pega únicamente el fragmento que deseas revisar" /></article>)}</div><Button type="button" className="button-secondary" onClick={addFragment}><Plus size={15} /> Añadir fragmento</Button></Card>
        <Card className="extraction-card"><div className="section-heading"><div><p className="eyebrow">Divulgación previa</p><h2>Qué saldría del dispositivo</h2></div><Badge tone="blue">{adapter.descriptor.transport}</Badge></div><dl className="extraction-disclosure"><div><dt>Proveedor</dt><dd>{adapter.descriptor.label}</dd></div><div><dt>Fragmentos</dt><dd>{disclosure.selectedLabels.join(', ') || 'ninguno'}</dd></div><div><dt>Caracteres</dt><dd>{disclosure.characterCount}</dd></div><div><dt>Universo completo</dt><dd>No</dd></div><div><dt>Red</dt><dd>No; mock local</dd></div></dl>{disclosure.sensitiveMatches.length > 0 && <p className="extraction-security-error" role="alert"><AlertTriangle size={15} /> Posibles secretos bloqueados: {disclosure.sensitiveMatches.join(', ')}</p>}<Button onClick={extract} disabled={!disclosure.selectedFragmentIds.length || disclosure.sensitiveMatches.length > 0}><FileCheck2 size={16} /> Generar propuesta local</Button></Card>
      </section>
      {error && <Card className="plausibility-error" role="alert"><AlertTriangle size={18} /><p>{error}</p></Card>}
      {proposal && <Card className="extraction-review"><div className="section-heading"><div><p className="eyebrow">2 · Revisión humana</p><h2>Propuesta, no canon</h2></div><Badge tone="amber">{acceptedCount}/{itemCount} aceptadas</Badge></div>{proposal.warnings.length > 0 && <ul className="extraction-warnings">{proposal.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}<div className="extraction-proposals">
        {proposal.proposedEntities.map((item) => <article key={item.proposalId}><Badge tone="blue">entity</Badge><div><strong>{item.entity.title}</strong><code>{item.entity.id} → {item.moduleId}</code><small>{item.sourceSpanIds.map((id) => spans.get(id)?.text).filter(Boolean).join(' · ')}</small></div><select aria-label={`Estado ${item.proposalId}`} value={item.status} onChange={(event) => review('proposedEntities', item.proposalId, event.target.value as ProposalStatus)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></article>)}
        {proposal.proposedEvents.map((item) => <article key={item.proposalId}><Badge tone="amber">event</Badge><div><strong>{item.event.title}</strong><code>{item.event.id} → {item.moduleId}</code><small>{item.sourceSpanIds.map((id) => spans.get(id)?.text).filter(Boolean).join(' · ')}</small></div><select aria-label={`Estado ${item.proposalId}`} value={item.status} onChange={(event) => review('proposedEvents', item.proposalId, event.target.value as ProposalStatus)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></article>)}
        {proposal.proposedRelations.map((item) => <article key={item.proposalId}><Badge tone="green">relation</Badge><div><strong>{item.sourceRef} → {item.targetRef}</strong><code>{item.field}</code><small>{item.sourceSpanIds.map((id) => spans.get(id)?.text).filter(Boolean).join(' · ')}</small></div><select aria-label={`Estado ${item.proposalId}`} value={item.status} onChange={(event) => review('proposedRelations', item.proposalId, event.target.value as ProposalStatus)}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></article>)}
      </div>{!itemCount && <p className="muted">El mock no encontró declaraciones explícitas completas.</p>}<Button onClick={preparePatch} disabled={!acceptedCount}><FileCheck2 size={16} /> Validar y preparar patch</Button></Card>}
      {patchResult && <Card className="extraction-patch"><div className="section-heading"><div><p className="eyebrow">3–6 · Validación y aprobación</p><h2>Comparación antes / después</h2></div><Badge tone={patchResult.validation.valid ? 'green' : 'red'}>{patchResult.validation.valid ? 'schema valid' : 'invalid'}</Badge></div>{!patchResult.validation.valid && <ul className="extraction-warnings">{patchResult.validation.errors.map((issue) => <li key={`${issue.path}-${issue.message}`}><code>{issue.path}</code> {issue.message}</li>)}</ul>}<div className="extraction-comparison">{patchResult.comparison.map((item) => <article key={item.path}><code>{item.path}</code><div><span>Antes: {JSON.stringify(item.before) ?? '—'}</span><span>Después: {JSON.stringify(item.after) ?? '—'}</span></div></article>)}</div>{patchResult.validation.valid && <div className="extraction-approval"><Button className="button-secondary" onClick={exportPatch}><Download size={15} /> Exportar patch</Button><label><input type="checkbox" aria-label="Aprobar patch explícitamente" checked={approved} onChange={(event) => setApproved(event.target.checked)} /> Confirmo que revisé la comparación y autorizo enviarla a cuarentena.</label><Button onClick={() => void applyApprovedPatch()} disabled={!approved || applied}><CheckCircle2 size={16} /> {applied ? 'Enviada a Propuestas' : 'Enviar al Centro de propuestas'}</Button></div>}<p className="extraction-canon-note">Aprobar aquí no aplica el patch. La propuesta entra en cuarentena para validación, simulación y decisión autoral.</p></Card>}
    </>}
  </div>
}
