import { AlertCircle, Ban, CheckCircle2, CircleAlert, Clock3, Download, Play, Search, ShieldCheck, SlidersHorizontal, Trash2, XCircle } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useUniverseModel } from '@/app/useUniverseModel'
import { connectionsRoute, extractionRoute, plausibilityRoute } from '@/app/routes'
import { ANALYSIS_ENGINE_VERSION } from '@/analysis/derived'
import { defaultIssueFilters, filterIssues, isAnalysisSnapshotStale, issueCountByRule, issueCountBySeverity, type IssueFilters } from '@/analysis/presentation'
import type { AnalysisSnapshot, NarrativeIssue, NarrativeSeverity } from '@/analysis/types'
import { Button, Badge, Card, Progress } from '@/components/ui'
import { useVirtualWindow } from '@/hooks/useVirtualWindow'
import { annotationNeedsReview, issueDecision, readAnalysisAnnotations, writeIssueAnnotation, type AnalysisAnnotations, type IssueDecision } from '@/services/analysis-annotations'
import { createAnalysisService, type AnalysisService } from '@/services/analysis-service'
import { analysisDiagnosticBlob } from '@/services/analysis-export'
import { AnalysisWorkerError } from '@/services/analysis-worker-client'
import { downloadBlob } from '@/services/universe-loader'
import { withTemporaryEngines } from '@/proposals/workflow'
import { useStudioStore } from '@/store/useStudioStore'
import quickStartUrl from '../../docs/quick-start.md?url'
import userManualUrl from '../../docs/user-manual.md?url'

type CompilationState = 'idle' | 'compiling' | 'cancelling' | 'complete' | 'cancelled' | 'error'

export interface AnalysisPageProps {
  serviceFactory?: () => AnalysisService
}

const decisionOptions: IssueDecision[] = ['open', 'confirmed', 'intentional', 'ignored', 'resolved']
const severityOrder: NarrativeSeverity[] = ['critical', 'high', 'medium', 'low', 'info']
const emptyIssues: NarrativeIssue[] = []

function severityTone(severity: NarrativeSeverity): 'red' | 'amber' | 'blue' | 'green' | 'neutral' {
  if (severity === 'critical' || severity === 'high') return 'red'
  if (severity === 'medium') return 'amber'
  if (severity === 'low') return 'blue'
  return 'neutral'
}

function ruleExplanation(ruleId: string): string {
  const explanations: Record<string, string> = {
    'character-dead-acting': 'Compara una muerte declarada con una participación posterior cuyo momento puede ordenarse con certeza.',
    'incompatible-simultaneous-locations': 'Compara apariciones del mismo participante en ubicaciones distintas que tienen intervalos exactos superpuestos.',
    'incompatible-age': 'Contrasta una edad explícita con el rango posible calculado desde nacimiento, muerte y fecha del evento.',
    'effect-before-cause': 'Comprueba que una causa declarada no ocurra después de su efecto.',
    'missing-cause-reference': 'Verifica que cada referencia estructurada de causas o efectos apunte a un evento existente.',
    'undeclared-causal-cycle': 'Busca ciclos dirigidos de causas y efectos que no tengan una excepción estructurada.',
    'important-event-without-cause': 'Señala hechos importantes sin un antecedente causal estructurado.',
    'declared-cause-without-consequence': 'Señala pasos causales declarados que no tienen una consecuencia estructurada.',
    'broken-causal-chain': 'Compara declaraciones bidireccionales de causa y efecto cuando ambas existen.',
    'knowledge-used-before-learning': 'Compara el conocimiento requerido por un evento con los cambios de conocimiento previos del personaje.',
    'remembered-after-forgetting': 'Detecta conocimiento requerido después de un olvido estructurado sin reaprendizaje.',
    'revelation-received-after-acting': 'Muestra cuando una revelación estructurada es posterior a la acción que la requiere.',
    'knowledge-attributed-to-missing-character': 'Verifica que un cambio de conocimiento apunte a un personaje existente.',
    'temporally-ambiguous-knowledge-change': 'Señala cambios de conocimiento que no pueden colocarse en la cronología.',
  }
  return explanations[ruleId] ?? 'Esta regla usa únicamente campos canónicos y comparaciones deterministas.'
}

function ruleLimitation(ruleId: string): string {
  if (ruleId === 'incompatible-simultaneous-locations') return 'Solo evalúa intervalos exactos con inicio y fin; no infiere viajes ni distancias.'
  if (ruleId === 'incompatible-age') return 'Con precisión anual o parcial, solo reporta una contradicción cuando ninguna edad posible coincide.'
  if (ruleId.startsWith('knowledge-') || ruleId === 'remembered-after-forgetting' || ruleId === 'revelation-received-after-acting' || ruleId === 'temporally-ambiguous-knowledge-change') return 'Solo usa requiredKnowledge y knowledgeChanges estructurados; no interpreta prosa libre ni resuelve empates temporales.'
  if (ruleId.includes('causal') || ruleId === 'effect-before-cause' || ruleId === 'missing-cause-reference') return 'Solo sigue causes y effects estructurados; una ausencia de datos se conserva como incertidumbre o severidad baja.'
  return 'Si faltan fechas o una excepción estructurada aplica, la regla no reporta una contradicción.'
}

function formatDate(value: string | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'medium' }).format(date)
}

function formatDuration(duration: number | undefined): string {
  return duration === undefined ? '—' : `${Math.max(0, Math.round(duration))} ms`
}

function workerErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'El Worker no pudo completar el análisis.'
}

function wasCancelled(error: unknown): boolean {
  return error instanceof AnalysisWorkerError && error.detail.code === 'CANCELLED'
}

function EmptyState({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return <Card className="analysis-empty-state"><div>{icon}</div><h2>{title}</h2><p>{detail}</p></Card>
}

export function AnalysisPage({ serviceFactory = createAnalysisService }: AnalysisPageProps) {
  const { universe, validation } = useUniverseModel()
  const { analysisEngines, setAnalysisLastRunAt } = useStudioStore()
  const [service] = useState<AnalysisService>(serviceFactory)
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot | undefined>(() => service.getLatestSnapshot())
  const [state, setState] = useState<CompilationState>('idle')
  const [progress, setProgress] = useState({ value: 0, stage: 'en espera' })
  const [duration, setDuration] = useState<number>()
  const [error, setError] = useState<string>()
  const [filters, setFilters] = useState<IssueFilters>(defaultIssueFilters)
  const [annotations, setAnnotations] = useState<AnalysisAnnotations>(() => readAnalysisAnnotations())
  const [selectedIssueId, setSelectedIssueId] = useState<string>()
  const listRef = useRef<HTMLDivElement>(null)
  const [listOffset, setListOffset] = useState(0)

  useEffect(() => () => { service.dispose() }, [service])

  const analysisUniverse = useMemo(() => universe ? withTemporaryEngines(universe, analysisEngines) : undefined, [universe, analysisEngines])
  const analysisEnabled = Object.values(analysisEngines).some(Boolean)
  const stale = useMemo(() => analysisUniverse ? isAnalysisSnapshotStale(snapshot, analysisUniverse) : false, [snapshot, analysisUniverse])
  const issues = snapshot?.issues ?? emptyIssues
  const filteredIssues = useMemo(() => filterIssues(issues, annotations, filters), [issues, annotations, filters])
  const severityCounts = useMemo(() => issueCountBySeverity(issues), [issues])
  const ruleCounts = useMemo(() => issueCountByRule(issues), [issues])
  const selectedIssue = filteredIssues.find((issue) => issue.id === selectedIssueId) ?? filteredIssues[0]
  const shouldVirtualize = filteredIssues.length > 60
  const virtualWindow = useVirtualWindow(shouldVirtualize ? filteredIssues.length : 0, 116, 6, listOffset)
  const visibleIssues = shouldVirtualize ? filteredIssues.slice(virtualWindow.start, virtualWindow.end) : filteredIssues

  useLayoutEffect(() => {
    const updateOffset = () => {
      if (listRef.current) setListOffset(listRef.current.getBoundingClientRect().top + window.scrollY)
    }
    updateOffset()
    window.addEventListener('resize', updateOffset)
    return () => window.removeEventListener('resize', updateOffset)
  }, [filteredIssues.length, snapshot])

  const updateFilter = <K extends keyof IssueFilters>(key: K, value: IssueFilters[K]) => setFilters((current) => ({ ...current, [key]: value }))
  const saveAnnotation = (issue: NarrativeIssue, decision: IssueDecision, note?: string) => {
    const annotation = writeIssueAnnotation(issue, { decision, note })
    setAnnotations((current) => ({ ...current, [issue.id]: annotation }))
  }

  const analyze = async () => {
    if (!analysisEnabled || !analysisUniverse) return
    const startedAt = performance.now()
    setError(undefined)
    setProgress({ value: 0.01, stage: 'en cola' })
    setState('compiling')
    try {
      const compiled = await service.compileUniverse(analysisUniverse, {
        onProgress: (next) => setProgress({ value: next.progress, stage: next.stage }),
      })
      setSnapshot(compiled)
      setDuration(performance.now() - startedAt)
      setSelectedIssueId(compiled.issues[0]?.id)
      setState('complete')
      setProgress({ value: 1, stage: 'completado' })
      setAnalysisLastRunAt(compiled.metadata.generatedAt)
    } catch (caught) {
      setDuration(performance.now() - startedAt)
      if (wasCancelled(caught)) {
        setState('cancelled')
        setProgress({ value: 0, stage: 'cancelado' })
      } else {
        setState('error')
        setError(workerErrorMessage(caught))
      }
    }
  }

  const cancel = () => {
    service.cancelCompilation()
    setState('cancelling')
    setProgress((current) => ({ ...current, stage: 'cancelando' }))
  }
  const clearCache = async () => {
    await service.clearAnalysisCache()
    setSnapshot(undefined); setSelectedIssueId(undefined); setState('idle'); setProgress({ value: 0, stage: 'en espera' }); setDuration(undefined); setError(undefined)
  }
  const exportDiagnostics = () => {
    if (!snapshot) return
    downloadBlob(analysisDiagnosticBlob(snapshot, annotations), `analysis-diagnostics-${snapshot.metadata.sourceHash}.json`)
  }

  if (!validation.valid || !universe) {
    return <EmptyState icon={<XCircle size={28} />} title="Canon inválido" detail="Corrige los errores de validación antes de ejecutar análisis narrativo." />
  }

  const meta = snapshot?.metadata
  return <div className="analysis-page">
    <header className="module-hero analysis-hero">
      <div><p className="eyebrow">Sistema analítico local</p><h1>Centro de diagnósticos</h1><p>Revisa señales deterministas vinculadas al canon. Las decisiones autorales se guardan solo en este navegador.</p></div>
      <div className="analysis-actions"><a className="button button-secondary" href={quickStartUrl} target="_blank" rel="noreferrer">Guía rápida</a><a className="button button-secondary" href={userManualUrl} target="_blank" rel="noreferrer">Manual</a><Link className="button button-secondary" to={connectionsRoute}>Explorar conexiones</Link><Link className="button button-secondary" to={plausibilityRoute}>Evaluar plausibilidad</Link><Link className="button button-secondary" to={extractionRoute}>Importación asistida</Link>{snapshot && <Button className="button-secondary" onClick={exportDiagnostics}><Download size={16} /> Exportar diagnósticos</Button>}<Button className="button-secondary" onClick={clearCache}><Trash2 size={16} /> Limpiar caché</Button><Button onClick={analyze} disabled={!analysisEnabled || state === 'compiling' || state === 'cancelling'} aria-label="Analizar universo"><Play size={16} /> Analizar universo</Button>{(state === 'compiling' || state === 'cancelling') && <Button className="button-secondary" onClick={cancel} aria-label="Cancelar análisis"><Ban size={16} /> Cancelar</Button>}</div>
    </header>

    <Card className="analysis-help-card"><ShieldCheck size={18} /><div><strong>El canon no se modifica</strong><p><span title="Medida numérica calculada desde el grafo o el canon">Métrica</span>: medida. <span title="Señal descriptiva que no implica error">Observación</span>: señal. <span title="Condición de una regla que requiere revisión autoral">Issue</span>: diagnóstico revisable. Información insuficiente nunca se convierte en contradicción.</p></div></Card>

    <Card className="analysis-runtime-card" aria-live="polite"><div className="analysis-runtime-heading"><div><p className="eyebrow">Compilador local</p><h2>{state === 'compiling' ? 'Analizando universo' : state === 'cancelling' ? 'Cancelando análisis' : state === 'complete' ? 'Análisis completado' : state === 'cancelled' ? 'Análisis cancelado' : state === 'error' ? 'Error del Worker' : 'Análisis no ejecutado'}</h2></div><Badge tone={state === 'error' ? 'red' : state === 'complete' ? 'green' : state === 'cancelled' ? 'amber' : 'blue'}>{state}</Badge></div>{(state === 'compiling' || state === 'cancelling') && <div className="analysis-progress"><div><span>{progress.stage}</span><strong>{Math.round(progress.value * 100)}%</strong></div><Progress value={progress.value * 100} /></div>}{error && <p className="analysis-error" role="alert"><AlertCircle size={16} /> {error}</p>}</Card>

    <section className="analysis-meta-grid" aria-label="Metadatos del análisis">
      <Card><span>Hash del canon</span><strong>{meta?.sourceHash ?? '—'}</strong></Card><Card><span>Esquema / motor</span><strong>{meta ? `${meta.schemaVersion} / ${meta.engineVersion}` : `${universe.metadata.schemaVersion} / ${ANALYSIS_ENGINE_VERSION}`}</strong></Card><Card><span>Último análisis</span><strong>{formatDate(meta?.generatedAt)}</strong></Card><Card><span>Duración</span><strong>{formatDuration(duration)}</strong></Card><Card><span>Entidades / eventos</span><strong>{meta ? `${snapshot?.compilation.manifest.counts.entities ?? 0} / ${snapshot?.compilation.manifest.counts.events ?? 0}` : '—'}</strong></Card>
    </section>

    {!analysisEnabled && <EmptyState icon={<ShieldCheck size={28} />} title="Motor desactivado" detail="Activa uno o más motores locales en Settings. Esta preferencia no modifica analysisConfig ni el canon." />}
    {analysisEnabled && state === 'cancelled' && <EmptyState icon={<Ban size={28} />} title="Análisis cancelado" detail="No se guardaron resultados parciales. Puedes iniciar un análisis nuevo cuando quieras." />}
    {analysisEnabled && state === 'error' && <EmptyState icon={<AlertCircle size={28} />} title="El Worker informó un error" detail={error ?? 'Reintenta el análisis; el canon y los últimos resultados válidos se preservan.'} />}
    {analysisEnabled && !snapshot && state !== 'cancelled' && state !== 'error' && <EmptyState icon={<Clock3 size={28} />} title="Análisis no ejecutado" detail="Ejecuta el Worker local para generar índices y diagnósticos de los motores habilitados." />}

    {analysisEnabled && snapshot && <>
      {stale && <Card className="analysis-stale" role="status"><CircleAlert size={18} /><div><strong>Resultados obsoletos</strong><p>El hash del canon cargado cambió. Revisa o vuelve a analizar antes de decidir.</p></div></Card>}
      {!stale && !issues.length && <EmptyState icon={<CheckCircle2 size={28} />} title="Sin problemas detectados" detail="Las reglas habilitadas no encontraron contradicciones con información suficiente." />}
      <section className="analysis-count-grid" aria-label="Resumen de issues"><Card><span>Issues visibles</span><strong>{filteredIssues.length}</strong><small>de {issues.length} totales</small></Card>{severityOrder.map((severity) => <Card key={severity}><span>{severity}</span><strong>{severityCounts[severity]}</strong></Card>)}</section>
      {!!issues.length && <Card className="analysis-rule-summary"><span>Issues por regla</span><div>{ruleCounts.map((rule) => <Badge key={rule.ruleId} tone="blue">{rule.ruleId}: {rule.count}</Badge>)}</div></Card>}
      {!!issues.length && <section className="analysis-workspace">
        <Card className="analysis-issue-list-card"><div className="section-heading"><div><p className="eyebrow">Cola de revisión</p><h2>Issues</h2></div><Badge tone="amber">{filteredIssues.length} filtrados</Badge></div><div className="analysis-filters"><label><Search size={15} /><input aria-label="Buscar issues" value={filters.search} placeholder="Buscar mensaje, entidad o evidencia" onChange={(event) => updateFilter('search', event.target.value)} /></label><label><SlidersHorizontal size={15} /><select aria-label="Filtrar por severidad" value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value as IssueFilters['severity'])}><option value="all">Toda severidad</option>{severityOrder.map((severity) => <option key={severity} value={severity}>{severity}</option>)}</select></label><select aria-label="Filtrar por regla" value={filters.ruleId} onChange={(event) => updateFilter('ruleId', event.target.value)}><option value="all">Todas las reglas</option>{ruleCounts.map((rule) => <option key={rule.ruleId} value={rule.ruleId}>{rule.ruleId} ({rule.count})</option>)}</select><select aria-label="Filtrar por decisión" value={filters.decision} onChange={(event) => updateFilter('decision', event.target.value as IssueFilters['decision'])}><option value="all">Todas las decisiones</option>{decisionOptions.map((decision) => <option key={decision} value={decision}>{decision}</option>)}</select><select aria-label="Filtrar por revisión" value={filters.review} onChange={(event) => updateFilter('review', event.target.value as IssueFilters['review'])}><option value="all">Estado de evidencia</option><option value="needs-review">Requiere revisión</option></select></div><div className="analysis-issue-list" ref={listRef}>{shouldVirtualize && <div style={{ height: virtualWindow.offsetTop }} />}{visibleIssues.map((issue) => { const annotation = annotations[issue.id]; const review = annotationNeedsReview(annotation, issue); return <button key={issue.id} className={`analysis-issue-row ${selectedIssue?.id === issue.id ? 'selected' : ''}`} onClick={() => setSelectedIssueId(issue.id)} aria-pressed={selectedIssue?.id === issue.id}><div><Badge tone={severityTone(issue.severity)}>{issue.severity}</Badge>{review && <Badge tone="amber">revisar</Badge>}</div><strong>{issue.title}</strong><p>{issue.message}</p><span>{issue.ruleId} · {issueDecision(annotation)}</span></button> })}{shouldVirtualize && <div style={{ height: virtualWindow.offsetBottom }} />}{!filteredIssues.length && <p className="analysis-no-filter-results">Ningún issue coincide con los filtros actuales.</p>}</div></Card>
        <Card className="analysis-detail" aria-label="Detalle del issue">{selectedIssue ? (() => { const annotation = annotations[selectedIssue.id]; const decision = issueDecision(annotation); const review = annotationNeedsReview(annotation, selectedIssue); return <><div className="section-heading"><div><p className="eyebrow">Detalle de issue</p><h2>{selectedIssue.title}</h2></div><Badge tone={severityTone(selectedIssue.severity)}>{selectedIssue.severity}</Badge></div><p className="analysis-detail-message">{selectedIssue.message}</p><dl className="analysis-detail-facts"><div><dt>Confianza</dt><dd>{Math.round(selectedIssue.confidence * 100)}%</dd></div><div><dt>Regla</dt><dd>{selectedIssue.ruleId}</dd></div><div><dt>Entidades</dt><dd>{selectedIssue.entityIds.join(', ')}</dd></div><div><dt>Fuentes</dt><dd>{selectedIssue.sourceIds.join(', ')}</dd></div></dl><section><h3>Por qué se activó</h3><p>{ruleExplanation(selectedIssue.ruleId)}</p></section><section><h3>Limitaciones</h3><p>{ruleLimitation(selectedIssue.ruleId)}</p></section><section><h3>Evidencia canónica</h3><ul className="analysis-evidence">{selectedIssue.evidence.map((evidence, index) => <li key={`${evidence.sourceId}-${evidence.field ?? 'value'}-${index}`}><code>{evidence.sourceId}</code><span>{evidence.field ?? 'campo'}{evidence.value ? `: ${evidence.value}` : ''}</span></li>)}</ul></section><section className="analysis-author-decision"><h3>Decisión autoral</h3>{review && <p className="analysis-review-note">La evidencia cambió desde la última decisión; revísala antes de conservarla.</p>}<label>Estado<select aria-label={`Decisión para ${selectedIssue.title}`} value={decision} onChange={(event) => saveAnnotation(selectedIssue, event.target.value as IssueDecision, annotation?.note)}>{decisionOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label>Nota opcional<textarea aria-label={`Nota de autor para ${selectedIssue.title}`} value={annotation?.note ?? ''} placeholder="Contexto de la decisión local" onChange={(event) => saveAnnotation(selectedIssue, decision, event.target.value)} /></label></section></> })() : <EmptyState icon={<Search size={24} />} title="Selecciona un issue" detail="El detalle incluirá evidencia y controles de decisión local." />}</Card>
      </section>}
    </>}
  </div>
}
