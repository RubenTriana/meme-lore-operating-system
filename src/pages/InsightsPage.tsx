import { ArrowUpRight, BrainCircuit, CheckCircle2, Sparkles } from 'lucide-react'
import { useUniverseModel } from '@/app/useUniverseModel'
import { Badge, Card } from '@/components/ui'
import { analyzeNarrative } from '@/utils/narrative-analysis'

export function InsightsPage() {
  const { universe } = useUniverseModel()
  if (!universe) return null
  const insights = analyzeNarrative(universe)
  const score = Math.max(0, Math.round(100 - (insights.reduce((sum, insight) => sum + insight.score, 0) / Math.max(1, insights.length)) * 0.38))
  return <div className="module-page"><header className="module-hero"><div><p className="eyebrow">Deterministic narrative analysis</p><h1>AI Insights</h1><p>Evidence-led signals derived only from universe_master.json. Nothing is invented or written back to canon.</p></div><div className="insight-score"><BrainCircuit size={20} /><strong>{score}</strong><span>narrative health</span></div></header><div className="analysis-note"><Sparkles size={16} /> This analysis inspects development, relationships, beats, mysteries and explicit foreshadowing references.</div><div className="insights-grid">{insights.map((insight) => <Card key={insight.id} className="insight-card"><div className="card-heading"><Badge tone={insight.severity === 'high' ? 'red' : insight.severity === 'medium' ? 'amber' : 'blue'}>{insight.category.replace('-', ' ')}</Badge><span className="insight-priority">{insight.score}</span></div><h2>{insight.title}</h2><p>{insight.detail}</p><div className="insight-footer"><span>{insight.entityIds.length} related entities</span><ArrowUpRight size={16} /></div></Card>)}</div>{!insights.length && <Card className="empty-state"><CheckCircle2 size={26} /><h2>Canon is structurally healthy</h2><p>No deterministic gaps were found in the current master file.</p></Card>}</div>
}
