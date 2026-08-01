import { useMemo, useState } from 'react'
import { ArrowUpRight, BrainCircuit, CheckCircle2, LoaderCircle, Sparkles, WandSparkles } from 'lucide-react'
import { useUniverseModel } from '@/app/useUniverseModel'
import { Badge, Card } from '@/components/ui'
import type { NarrativeInsight, UniverseEntity } from '@/types/universe'
import { analyzeNarrative } from '@/utils/narrative-analysis'
import { getAllEntities } from '@/utils/semantic-index'

interface GeniusPossibility {
  title: string
  explanation: string
}

interface GeniusCardState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  possibilities: GeniusPossibility[]
  error?: string
}

interface GeniusResponse {
  possibilities?: GeniusPossibility[]
  error?: string
}

function entityContext(entity: UniverseEntity) {
  return {
    id: entity.id,
    title: entity.title,
    type: entity.type,
    ...(entity.summary ? { summary: entity.summary } : {}),
    ...(entity.status ? { status: entity.status } : {}),
    ...(typeof entity.development === 'number' ? { development: entity.development } : {}),
  }
}

function formatPossibilities(possibilities: GeniusPossibility[]): string {
  return possibilities.map((possibility, index) => `${index + 1}. ${possibility.title}\n${possibility.explanation}`).join('\n\n')
}

export function InsightsPage() {
  const { universe } = useUniverseModel()
  const [geniusByInsight, setGeniusByInsight] = useState<Record<string, GeniusCardState>>({})
  const insights = useMemo(() => universe ? analyzeNarrative(universe) : [], [universe])
  const entities = useMemo(() => universe ? new Map(getAllEntities(universe).map((entity) => [entity.id, entity])) : new Map<string, UniverseEntity>(), [universe])
  if (!universe) return null
  const score = Math.max(0, Math.round(100 - (insights.reduce((sum, insight) => sum + insight.score, 0) / Math.max(1, insights.length)) * 0.38))

  const runGenius = async (insight: NarrativeInsight) => {
    setGeniusByInsight((current) => ({ ...current, [insight.id]: { status: 'loading', possibilities: current[insight.id]?.possibilities ?? [] } }))
    try {
      const response = await fetch('/api/insights/genius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insight,
          entities: insight.entityIds.map((id) => entities.get(id)).filter((entity): entity is UniverseEntity => Boolean(entity)).slice(0, 12).map(entityContext),
        }),
      })
      const payload = await response.json() as GeniusResponse
      if (!response.ok || !payload.possibilities || payload.possibilities.length !== 2) {
        throw new Error(payload.error ?? 'Genius no devolvió dos posibilidades.')
      }
      setGeniusByInsight((current) => ({ ...current, [insight.id]: { status: 'ready', possibilities: payload.possibilities! } }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo generar la respuesta.'
      setGeniusByInsight((current) => ({ ...current, [insight.id]: { status: 'error', possibilities: current[insight.id]?.possibilities ?? [], error: message } }))
    }
  }

  return (
    <div className="module-page">
      <header className="module-hero">
        <div>
          <p className="eyebrow">Narrative intelligence · Canon-grounded</p>
          <h1>AI Insights</h1>
          <p>Los hallazgos se derivan del master. Genius propone dos hipótesis creativas por petición sin escribirlas en el canon.</p>
        </div>
        <div className="insight-score"><BrainCircuit size={20} /><strong>{score}</strong><span>narrative health</span></div>
      </header>
      <div className="analysis-note"><Sparkles size={16} /> {insights.length} insights activos · Cada respuesta Genius usa el insight y sus entidades relacionadas como contexto.</div>
      <div className="insights-grid genius-grid">
        {insights.map((insight) => {
          const genius = geniusByInsight[insight.id] ?? { status: 'idle', possibilities: [] }
          const isLoading = genius.status === 'loading'
          return (
            <Card key={insight.id} className="insight-card genius-card">
              <div className="card-heading">
                <Badge tone={insight.severity === 'high' ? 'red' : insight.severity === 'medium' ? 'amber' : 'blue'}>{insight.category.replace('-', ' ')}</Badge>
                <span className="insight-priority">{insight.score}</span>
              </div>
              <h2>{insight.title}</h2>
              <p>{insight.detail}</p>
              <div className="insight-footer"><span>{insight.entityIds.length} related entities</span><ArrowUpRight size={16} /></div>
              <div className="genius-panel">
                <div className="genius-panel-heading">
                  <span>Respuesta creativa</span>
                  <button className="genius-button" type="button" disabled={isLoading} onClick={() => void runGenius(insight)} aria-label={`Genius para ${insight.title}`}>
                    {isLoading ? <LoaderCircle className="spin" size={14} /> : <WandSparkles size={14} />}
                    Genius
                  </button>
                </div>
                <textarea
                  className="genius-response"
                  aria-label={`Respuesta Genius para ${insight.title}`}
                  value={formatPossibilities(genius.possibilities)}
                  placeholder={isLoading ? 'Genius está explorando dos posibilidades…' : 'Pulsa Genius para generar dos posibilidades lógicas y sorprendentes.'}
                  readOnly
                />
                {genius.status === 'error' && <p className="genius-error" role="alert">{genius.error}</p>}
                {genius.status === 'ready' && <span className="genius-disclaimer">Hipótesis creativas · No forman parte del canon</span>}
              </div>
            </Card>
          )
        })}
      </div>
      {!insights.length && <Card className="empty-state"><CheckCircle2 size={26} /><h2>Canon is structurally healthy</h2><p>No deterministic gaps were found in the current master file.</p></Card>}
    </div>
  )
}
