import { Brain, Crosshair, HeartCrack, Network } from 'lucide-react'
import { Badge, Card, Progress } from '@/components/ui'
import { DevelopmentRadar } from '@/charts/DevelopmentRadar'
import { EntityDetailControl } from '@/components/EntityDetailControl'
import type { RendererProps } from '../types'

const engineFields = [
  ['desire', 'Desire', Crosshair],
  ['need', 'Need', Brain],
  ['wound', 'Wound', HeartCrack],
  ['contradiction', 'Contradiction', Network],
] as const

export function CharacterRenderer({ module, index }: RendererProps) {
  const characters = module.content.items ?? []
  return <div className="module-page"><header className="module-hero"><div><p className="eyebrow">Character intelligence</p><h1>{module.title}</h1><p>{module.description}</p></div><Badge tone="amber">{characters.length} active engines</Badge></header><div className="character-list">{characters.map((character) => <Card className="character-card" key={character.id}><EntityDetailControl entity={character} index={index} className="character-detail-trigger" /><div className="character-overview"><div className="character-avatar">{character.title.split(' ').map((word) => word[0]).slice(0, 2).join('')}</div><div><div className="inline-meta"><Badge tone={character.status === 'active' ? 'blue' : 'neutral'}>{character.status ?? 'draft'}</Badge><span>{character.alias}</span></div><h2>{character.title}</h2><p>{character.summary}</p><div className="tag-row">{character.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div></div></div><div className="character-radar"><DevelopmentRadar values={character} /></div><div className="character-engine">{engineFields.map(([key, label, Icon]) => typeof character[key] === 'string' && <div key={key}><Icon size={15} /><span>{label}</span><p>{character[key] as string}</p></div>)}</div><div className="character-footer"><div><span>Story importance</span><Progress value={character.importance ?? 0} /></div><div><span>Narrative time</span><Progress value={character.narrativeTime ?? 0} /></div><div><span>Development</span><Progress value={character.development ?? 0} /></div><p>{index.references.get(character.id)?.length ?? 0} graph relationships</p></div></Card>)}</div></div>
}
