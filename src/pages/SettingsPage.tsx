import { Braces, Download, FileUp, Gauge, Moon, RotateCcw, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import packageJson from '../../package.json'
import { ANALYSIS_ENGINE_VERSION, hashCanonical } from '@/analysis/derived'
import { proposalsRoute } from '@/app/routes'
import { useUniverseModel } from '@/app/useUniverseModel'
import { Badge, Button, Card } from '@/components/ui'
import { createProposal, isUniversePatch } from '@/proposals/workflow'
import { proposalRepository } from '@/proposals/repository'
import { downloadBlob, exportUniverse } from '@/services/universe-loader'
import { ANALYSIS_PRESETS, useStudioStore, type AnalysisPreset } from '@/store/useStudioStore'
import type { AnalysisEngines } from '@/types/universe'

const engineLabels: Record<keyof AnalysisEngines, string> = { continuity: 'Continuidad', causality: 'Causalidad', knowledge: 'Conocimiento', connections: 'Conexiones', plausibility: 'Plausibilidad' }
const presetLabels: Record<AnalysisPreset, string> = { quick: 'Validación rápida', full: 'Análisis completo', continuity: 'Solo continuidad', connections: 'Solo conexiones' }

export function SettingsPage() {
  const { universe, baseUniverse, importPayload, reset, restoreBase, workspaceState, migrated } = useUniverseModel()
  const { developerMode, setDeveloperMode, dashboardLayout, setDashboardLayout, aiExtractionEnabled, setAiExtractionEnabled, analysisEngines, setAnalysisEngine, applyAnalysisPreset, analysisLastRunAt } = useStudioStore()
  const [message, setMessage] = useState<string>()
  const [pendingMaster, setPendingMaster] = useState<{ fileName: string; payload: unknown }>()
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  if (!universe || !baseUniverse) return null

  const importSource = async (file?: File) => {
    if (!file) return
    try {
      const payload = JSON.parse(await file.text()) as unknown
      if (isUniversePatch(payload)) {
        const proposal = createProposal(file.name, payload, baseUniverse)
        await proposalRepository.put(proposal)
        setMessage(`${file.name} quedó en cuarentena; el workspace no cambió.`)
        navigate(`${proposalsRoute}/${proposal.id}`)
      } else {
        const review = createProposal(file.name, payload, baseUniverse)
        if (!review.validation.valid) throw new Error(review.validation.errors[0]?.message ?? 'El master no es válido.')
        setPendingMaster({ fileName: file.name, payload })
        setMessage('Master completo validado. Confirma explícitamente antes de sustituir el workspace base.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The file could not be read as JSON.')
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  const confirmMaster = () => {
    if (!pendingMaster) return
    importPayload(pendingMaster.payload)
    setMessage(`${pendingMaster.fileName} sustituyó el workspace base después de confirmación explícita.`)
    setPendingMaster(undefined)
  }
  const exportFile = (format: 'json' | 'markdown' | 'csv') => downloadBlob(exportUniverse(universe, format), `meme-universe-${universe.metadata.version}.${format === 'markdown' ? 'md' : format}`)
  const enginesActive = Object.values(analysisEngines).filter(Boolean).length

  return <div className="module-page settings-page">
    <header className="module-hero"><div><p className="eyebrow">Preferencias locales del workspace</p><h1>Settings</h1><p>El canon permanece en el JSON maestro. Patches, propuestas, motores y candidatos se gestionan en capas locales separadas.</p></div><Link className="button button-secondary" to={proposalsRoute}>Abrir Propuestas</Link></header>
    <div className="settings-grid">
      <Card><div className="section-heading"><div><p className="eyebrow">Transporte de datos</p><h2>Importar y exportar</h2></div><FileUp size={19} /></div><p className="settings-copy">Los patches siempre entran en cuarentena. Un master completo requiere confirmación antes de sustituir el workspace base.</p><input ref={input} type="file" accept="application/json,.json" hidden onChange={(event) => void importSource(event.target.files?.[0])} /><div className="button-row"><Button onClick={() => input.current?.click()}><Upload size={16} /> Importar JSON / patch</Button><Button className="button-secondary" onClick={() => exportFile('json')}><Download size={16} /> JSON</Button><Button className="button-secondary" onClick={() => exportFile('markdown')}>Markdown</Button><Button className="button-secondary" onClick={() => exportFile('csv')}>CSV</Button></div>{message && <p className="import-message" role="status">{message}</p>}{pendingMaster && <div className="settings-confirm"><strong>Confirmar sustitución de workspace</strong><p>{pendingMaster.fileName} es un master completo. Esta acción no escribe en el repositorio, pero reemplaza la base visible del navegador.</p><div className="button-row"><Button onClick={confirmMaster}>Confirmar master</Button><Button className="button-secondary" onClick={() => setPendingMaster(undefined)}>Cancelar</Button></div></div>}{workspaceState === 'candidate' && <Button className="text-button" onClick={() => { restoreBase(); setMessage('Canon base restaurado; la propuesta se conserva.') }}><RotateCcw size={15} /> Restaurar canon base</Button>}<Button className="text-button" onClick={() => { reset(); setMessage('Bundled universe restored.') }}><RotateCcw size={15} /> Restore bundled universe</Button>{migrated.length > 0 && <p className="import-message">Migrated automatically: {migrated.join(', ')}</p>}</Card>

      <Card className="analysis-engine-settings"><div className="section-heading"><div><p className="eyebrow">Ejecución local</p><h2>Motores de análisis</h2></div><Badge tone={enginesActive ? 'green' : 'neutral'}>{enginesActive ? `${enginesActive} activos` : 'desactivados'}</Badge></div><p className="settings-copy">Estas preferencias ejecutan motores temporalmente y nunca modifican `analysisConfig` del canon.</p><div className="engine-preset-row">{(Object.keys(ANALYSIS_PRESETS) as AnalysisPreset[]).map((preset) => <Button key={preset} className="button-secondary" onClick={() => applyAnalysisPreset(preset)}>{presetLabels[preset]}</Button>)}</div><div className="engine-setting-list">{(Object.keys(engineLabels) as Array<keyof AnalysisEngines>).map((engine) => <div className="setting-row" key={engine}><div><strong>{engineLabels[engine]}</strong><p>{engine === 'plausibility' ? 'Disponible solo para hipótesis estructuradas.' : `Motor determinista ${ANALYSIS_ENGINE_VERSION}.`}</p></div><div className="engine-setting-state"><Badge tone={analysisEngines[engine] ? 'green' : 'neutral'}>{analysisEngines[engine] ? 'Activo' : engine === 'plausibility' ? 'No aplicable sin hipótesis' : 'Desactivado'}</Badge><button className={`switch ${analysisEngines[engine] ? 'on' : ''}`} aria-label={`Toggle ${engine} engine`} onClick={() => setAnalysisEngine(engine, !analysisEngines[engine])}><span /></button></div></div>)}</div><p className="import-message">Última ejecución: {analysisLastRunAt ? new Date(analysisLastRunAt).toLocaleString() : 'No ejecutado'}</p></Card>

      <Card className="version-settings"><div className="section-heading"><div><p className="eyebrow">Identidad del sistema</p><h2>Versiones y estado</h2></div><Gauge size={19} /></div><dl><div><dt>App version</dt><dd>{packageJson.version}</dd></div><div><dt>Canon version</dt><dd>{universe.metadata.version}</dd></div><div><dt>Schema version</dt><dd>{universe.metadata.schemaVersion}</dd></div><div><dt>Analysis engine</dt><dd>{ANALYSIS_ENGINE_VERSION}</dd></div><div><dt>Canon hash</dt><dd>{hashCanonical(baseUniverse)}</dd></div><div><dt>Workspace state</dt><dd>{workspaceState === 'candidate' ? 'CANDIDATE — NO CANÓNICO' : 'BASE CANÓNICA'}</dd></div></dl></Card>

      <Card><div className="section-heading"><div><p className="eyebrow">Workspace</p><h2>Interface preference</h2></div><Moon size={19} /></div><div className="setting-row"><div><strong>Dark system surface</strong><p>MEME LOS defaults to the canonical dark interface.</p></div><Badge tone="green">Active</Badge></div><div className="setting-row"><div><strong>Dashboard density</strong><p>Stored locally on this device.</p></div><select value={dashboardLayout} onChange={(event) => setDashboardLayout(event.target.value as 'comfort' | 'compact')}><option value="comfort">Comfort</option><option value="compact">Compact</option></select></div></Card>
      <Card><div className="section-heading"><div><p className="eyebrow">Optional AI boundary</p><h2>Assisted extraction</h2></div><Badge tone={aiExtractionEnabled ? 'amber' : 'neutral'}>{aiExtractionEnabled ? 'Enabled' : 'Off by default'}</Badge></div><div className="setting-row"><div><strong>Enable proposal workflow</strong><p>Only selected text fragments reach the configured adapter. The current provider is a local mock and performs no network calls.</p></div><button className={`switch ${aiExtractionEnabled ? 'on' : ''}`} aria-label="Toggle assisted extraction" onClick={() => setAiExtractionEnabled(!aiExtractionEnabled)}><span /></button></div></Card>
      <Card><div className="section-heading"><div><p className="eyebrow">System tooling</p><h2>Developer mode</h2></div><Braces size={19} /></div><div className="setting-row"><div><strong>Inspect the loaded universe</strong><p>Exposes validation, module registry and raw JSON. This preference stays local.</p></div><button className={`switch ${developerMode ? 'on' : ''}`} aria-label="Toggle developer mode" onClick={() => setDeveloperMode(!developerMode)}><span /></button></div></Card>
    </div>
  </div>
}
