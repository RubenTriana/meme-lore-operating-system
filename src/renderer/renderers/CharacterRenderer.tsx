import { useState } from 'react'
import { Brain, Crosshair, HeartCrack, Network } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Card, Progress } from '@/components/ui'
import { DevelopmentRadar } from '@/charts/DevelopmentRadar'
import { EntityDetailControl } from '@/components/EntityDetailControl'
import { NovelBadges, NovelNavigator } from '@/components/NovelNavigator'
import { scoreCharacterProfile } from '@/analysis/character-profile'
import { filterByNovel, getEntityNovelRefs, getNovelDescriptors } from '@/utils/novels'
import type { RendererProps } from '../types'

const engineFields = [
  ['desire', 'Deseo', Crosshair],
  ['need', 'Necesidad', Brain],
  ['wound', 'Herida', HeartCrack],
  ['contradiction', 'Contradicción', Network],
] as const

export function CharacterRenderer({ module, universe, index }: RendererProps) {
  const characters = module.content.items ?? []
  const novels = getNovelDescriptors(universe)
  const [selection, setSelection] = useState('all')
  const visibleCharacters = filterByNovel(characters, selection)
  const counts = Object.fromEntries([
    ['all', characters.length],
    ['transversal', characters.filter((character) => !getEntityNovelRefs(character).length).length],
    ...novels.map((novel) => [novel.id, characters.filter((character) => getEntityNovelRefs(character).includes(novel.id)).length] as const),
  ])

  return (
    <div className="module-page">
      <header className="module-hero">
        <div><p className="eyebrow">Inteligencia de personajes · Tetralogía</p><h1>{module.title}</h1><p>{module.description}</p></div>
        <Badge tone="amber">{visibleCharacters.length} de {characters.length} perfiles</Badge>
      </header>
      <NovelNavigator novels={novels} selected={selection} onSelect={setSelection} counts={counts} label="Personajes por novela" />
      <div className="character-list">
        {visibleCharacters.map((character) => {
          const scores = scoreCharacterProfile(character)
          const connectionCount = new Set(index.references.get(character.id) ?? []).size
          return (
            <Card className="character-card" key={character.id}>
              <EntityDetailControl entity={character} index={index} className="character-detail-trigger" />
              <div className="character-overview">
                <div className="character-avatar">{character.title.split(' ').map((word) => word[0]).slice(0, 2).join('')}</div>
                <div>
                  <div className="inline-meta"><Badge tone={character.status === 'locked' ? 'green' : character.status === 'active' ? 'blue' : 'neutral'}>{character.status ?? 'draft'}</Badge><span>{character.alias}</span></div>
                  <h2>{character.title}</h2><p>{character.summary}</p>
                  <NovelBadges entity={character} novels={novels} />
                  <div className="tag-row">{character.tags?.map((tag) => <span key={tag}>#{tag}</span>)}</div>
                </div>
              </div>
              <div className="character-radar"><DevelopmentRadar values={scores} /></div>
              <div className="character-engine">{engineFields.map(([key, label, Icon]) => typeof character[key] === 'string' && <div key={key}><Icon size={15} /><span>{label}</span><p>{character[key] as string}</p></div>)}</div>
              <div className="character-footer">
                <div><span>Importancia narrativa</span><Progress value={scores.importance} /></div>
                <div><span>Tiempo narrativo</span><Progress value={scores.narrativeTime} /></div>
                <div><span>Desarrollo del perfil</span><Progress value={scores.development} /></div>
                <div><span>Calidad del perfil</span><Progress value={scores.quality} /></div>
                <Link className="button button-secondary character-connections-link" to={`/module/relationships?focus=${encodeURIComponent(character.id)}`} aria-label={`Mostrar ${connectionCount} conexiones de ${character.title}`}><Network size={14} /> Conexiones {connectionCount}</Link>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
