import { CheckCircle2, CircleDashed, Flag, Sparkles } from 'lucide-react'
import { Badge, Card, Progress } from '@/components/ui'
import { EntityDetailControl } from '@/components/EntityDetailControl'
import type { RendererProps } from '../types'

export function BeatRenderer({ module, index }: RendererProps) {
  const beats = [...(module.content.items ?? [])].sort((a, b) => Number(a.sequence ?? 0) - Number(b.sequence ?? 0))
  const global = beats.length ? beats.reduce((total, beat) => total + (beat.development ?? 0), 0) / beats.length : 0
  return <div className="module-page"><header className="module-hero"><div><p className="eyebrow">Primary narrative engine</p><h1>{module.title}</h1><p>{module.description}</p></div><div className="completion-orb"><strong>{Math.round(global)}%</strong><span>global progress</span></div></header><Card className="beat-summary"><div><Sparkles size={18} /><span>Beat coverage</span><strong>{beats.length} / 15</strong></div><div><Flag size={18} /><span>Story progress</span><Progress value={global} /></div><div><CircleDashed size={18} /><span>Missing beats</span><strong>{Math.max(0, 15 - beats.length)}</strong></div></Card><div className="beat-list">{beats.map((beat) => <article key={beat.id} className="beat-row"><div className="beat-sequence">{beat.status === 'locked' ? <CheckCircle2 size={20} /> : <span>{String(beat.sequence).padStart(2, '0')}</span>}</div><div className="beat-copy"><div className="inline-meta"><Badge tone={beat.status === 'locked' ? 'green' : beat.status === 'draft' ? 'amber' : 'blue'}>{beat.status}</Badge><span>Quality {beat.quality ?? '—'}/100</span></div><h2>{beat.title}</h2><p>{beat.summary}</p></div><div className="beat-progress"><span>Development</span><strong>{beat.development}%</strong><Progress value={beat.development ?? 0} /><EntityDetailControl entity={beat} index={index} className="beat-detail-trigger" /></div></article>)}</div></div>
}
