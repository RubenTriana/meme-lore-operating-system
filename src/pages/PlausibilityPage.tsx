import { AlertTriangle, ArrowLeft, Calculator, Save, Scale } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DEFAULT_PLAUSIBILITY_PROFILE, evaluateNarrativePlausibility, PLAUSIBILITY_ENGINE_VERSION, validatePlausibilityProfile, type NarrativePlausibilityResult, type PlausibilityFactorId, type PlausibilityProfile, type PlausibilityWeights } from '@/analysis/plausibility'
import { analysisRoute } from '@/app/routes'
import { useUniverseModel } from '@/app/useUniverseModel'
import { Badge, Button, Card, Progress } from '@/components/ui'
import { readPlausibilityProfiles, savePlausibilityProfile } from '@/services/plausibility-profiles'

const factorOrder: PlausibilityFactorId[] = ['goalAlignment', 'beliefAlignment', 'externalPressure', 'fearAlignment', 'precedents', 'foreshadowing']
const factorLabels: Record<PlausibilityFactorId, string> = {
  goalAlignment: 'Objetivo', beliefAlignment: 'Creencias', externalPressure: 'Presión externa', fearAlignment: 'Miedo', precedents: 'Precedentes', foreshadowing: 'Preparación',
}

function profileId(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'perfil-personalizado'
}

export function PlausibilityPage() {
  const { universe, validation } = useUniverseModel()
  const [profiles, setProfiles] = useState(() => readPlausibilityProfiles())
  const [selectedProfileId, setSelectedProfileId] = useState(DEFAULT_PLAUSIBILITY_PROFILE.id)
  const [profileName, setProfileName] = useState('')
  const [weights, setWeights] = useState<PlausibilityWeights>({ ...DEFAULT_PLAUSIBILITY_PROFILE.weights })
  const [hypothesis, setHypothesis] = useState({ id: '', actorRef: '', action: '', targetRef: '', contextEventRef: '' })
  const [result, setResult] = useState<NarrativePlausibilityResult>()
  const [error, setError] = useState<string>()

  const entities = useMemo(() => universe?.modules.flatMap((module) => module.content.items ?? []).sort((left, right) => left.title.localeCompare(right.title)) ?? [], [universe])
  const characters = entities.filter((entity) => entity.type === 'character')
  const events = entities.filter((entity) => entity.type === 'event')
  const enabled = Boolean(universe?.analysisConfig?.enabled && universe.analysisConfig.engines.plausibility)
  const draftProfile: PlausibilityProfile = { id: selectedProfileId, name: profiles.find((profile) => profile.id === selectedProfileId)?.name ?? (profileName || 'Perfil en edición'), weights }
  const profileValidation = validatePlausibilityProfile(draftProfile)
  const weightTotal = factorOrder.reduce((sum, factor) => sum + weights[factor], 0)

  const chooseProfile = (id: string) => {
    const profile = profiles.find((item) => item.id === id) ?? DEFAULT_PLAUSIBILITY_PROFILE
    setSelectedProfileId(profile.id); setWeights({ ...profile.weights }); setProfileName(profile.id === DEFAULT_PLAUSIBILITY_PROFILE.id ? '' : profile.name); setResult(undefined); setError(undefined)
  }
  const updateWeight = (factor: PlausibilityFactorId, value: string) => setWeights((current) => ({ ...current, [factor]: Number(value) }))
  const saveProfile = () => {
    try {
      const saved = savePlausibilityProfile({ id: profileId(profileName), name: profileName, weights })
      const next = readPlausibilityProfiles(); setProfiles(next); setSelectedProfileId(saved.id); setError(undefined)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo guardar el perfil.') }
  }
  const evaluate = (event: FormEvent) => {
    event.preventDefault()
    if (!universe || !enabled) return
    try {
      const profile: PlausibilityProfile = { id: draftProfile.id, name: draftProfile.name, weights: { ...weights } }
      setResult(evaluateNarrativePlausibility(universe, hypothesis, profile)); setError(undefined)
    } catch (caught) { setResult(undefined); setError(caught instanceof Error ? caught.message : 'No se pudo evaluar la hipótesis.') }
  }

  if (!validation.valid || !universe) return <Card className="analysis-empty-state"><h2>Canon inválido</h2><p>Corrige el canon antes de evaluar una hipótesis.</p></Card>

  return <div className="plausibility-page">
    <header className="module-hero analysis-hero"><div><p className="eyebrow">Evaluación determinista</p><h1>Narrative Plausibility Score</h1><p>Contrasta una hipótesis escrita por el autor con señales estructuradas. El sistema no propone acciones ni modifica el canon.</p></div><div className="analysis-actions"><Link className="button button-secondary" to={analysisRoute}><ArrowLeft size={16} /> Diagnósticos</Link></div></header>
    {!enabled && <Card className="analysis-empty-state"><Scale size={28} /><h2>Motor desactivado</h2><p>Activa `analysisConfig.engines.plausibility` para evaluar hipótesis estructuradas.</p></Card>}
    {enabled && <form className="plausibility-layout" onSubmit={evaluate}>
      <div className="plausibility-inputs">
        <Card className="plausibility-card"><div className="section-heading"><div><p className="eyebrow">Entrada autoral</p><h2>Hipótesis estructurada</h2></div><Badge tone="blue">manual</Badge></div><div className="plausibility-form-grid"><label>ID de hipótesis<input aria-label="ID de hipótesis" value={hypothesis.id} onChange={(event) => setHypothesis((current) => ({ ...current, id: event.target.value }))} placeholder="clay-protege-refugio" /></label><label>Actor<select aria-label="Actor" value={hypothesis.actorRef} onChange={(event) => setHypothesis((current) => ({ ...current, actorRef: event.target.value }))}><option value="">Seleccionar personaje</option>{characters.map((entity) => <option key={entity.id} value={entity.id}>{entity.title}</option>)}</select></label><label className="plausibility-wide">Acción<textarea aria-label="Acción" value={hypothesis.action} onChange={(event) => setHypothesis((current) => ({ ...current, action: event.target.value }))} placeholder="Describe la acción que quieres evaluar" /></label><label>Objetivo opcional<select aria-label="Objetivo opcional" value={hypothesis.targetRef} onChange={(event) => setHypothesis((current) => ({ ...current, targetRef: event.target.value }))}><option value="">Sin objetivo</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.title}</option>)}</select></label><label>Evento de contexto opcional<select aria-label="Evento de contexto opcional" value={hypothesis.contextEventRef} onChange={(event) => setHypothesis((current) => ({ ...current, contextEventRef: event.target.value }))}><option value="">Sin contexto</option>{events.map((entity) => <option key={entity.id} value={entity.id}>{entity.title}</option>)}</select></label></div></Card>
        <Card className="plausibility-card"><div className="section-heading"><div><p className="eyebrow">Perfil local</p><h2>Pesos configurables</h2></div><Badge tone={profileValidation.valid ? 'green' : 'red'}>{weightTotal}/100</Badge></div><div className="plausibility-profile-row"><label>Perfil<select aria-label="Perfil de plausibilidad" value={selectedProfileId} onChange={(event) => chooseProfile(event.target.value)}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label><label>Guardar como<input aria-label="Nombre del perfil" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Perfil de tensión alta" /></label><Button type="button" className="button-secondary" onClick={saveProfile} disabled={!profileName.trim() || !profileValidation.valid}><Save size={15} /> Guardar perfil</Button></div><div className="plausibility-weights">{factorOrder.map((factor) => <label key={factor}><span>{factorLabels[factor]}</span><input aria-label={`Peso ${factorLabels[factor]}`} type="number" min="0" max="100" step="1" value={weights[factor]} onChange={(event) => updateWeight(factor, event.target.value)} /><small>%</small></label>)}</div>{!profileValidation.valid && <p className="plausibility-validation" role="alert">{profileValidation.errors.join(' ')}</p>}<p className="plausibility-storage-note">Los perfiles se guardan en este navegador y permanecen separados del canon.</p></Card>
        {error && <Card className="plausibility-error" role="alert"><AlertTriangle size={18} /><p>{error}</p></Card>}
        <Button type="submit" disabled={!profileValidation.valid}><Calculator size={16} /> Evaluar hipótesis</Button>
      </div>
      <div className="plausibility-results" aria-live="polite">
        {!result && <Card className="analysis-empty-state"><Calculator size={28} /><h2>Hipótesis no evaluada</h2><p>Completa la entrada y ejecuta el cálculo. El sistema nunca genera hipótesis automáticamente.</p></Card>}
        {result && <><Card className="plausibility-score-card"><div><p className="eyebrow">Plausibilidad estructural</p><strong>{result.score === undefined ? '—' : `${Math.round(result.score)}/100`}</strong><span>{result.profile.name}</span></div><div><p>Cobertura de datos: {Math.round(result.coverage)}%</p><Progress value={result.coverage} /><small>La cobertura mide disponibilidad de datos, no plausibilidad.</small></div></Card><Card className="plausibility-warning"><AlertTriangle size={18} /><p>{result.warning}</p></Card><section className="plausibility-factor-grid">{result.factors.map((factor) => <Card key={factor.id}><div><span>{factor.label}</span><Badge tone={factor.available ? 'blue' : 'neutral'}>{factor.weight}%</Badge></div><strong>{factor.score === undefined ? 'Sin datos' : `${Math.round(factor.score)}/100`}</strong><Progress value={factor.score ?? 0} /><p>{factor.explanation}</p>{factor.evidence.map((item) => <small key={`${item.sourceId}-${item.field}`}><code>{item.sourceId}</code> · {item.field}: {item.value}{item.matchedTerms.length ? ` · coincide: ${item.matchedTerms.join(', ')}` : ''}</small>)}</Card>)}</section><Card className="plausibility-detail"><h2>Explicación del cálculo</h2><p>{result.explanation}</p><h3>Datos ausentes</h3>{result.missingData.length ? <ul>{result.missingData.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Cobertura estructural completa bajo este perfil.</p>}<h3>Sensibilidad a pesos</h3><div className="plausibility-sensitivity">{result.sensitivity.map((item) => <div key={item.factorId}><span>{factorLabels[item.factorId]} a {item.adjustedWeight}%</span><strong>{item.score === undefined ? '—' : `${item.score}/100`}</strong><small>{item.delta === undefined ? 'sin cálculo' : `${item.delta >= 0 ? '+' : ''}${item.delta} puntos`}</small></div>)}</div><footer>Motor {PLAUSIBILITY_ENGINE_VERSION} · cálculo reproducible a partir de la misma hipótesis, canon y perfil.</footer></Card></>}
      </div>
    </form>}
  </div>
}
