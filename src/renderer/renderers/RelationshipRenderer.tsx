import { useMemo, useState } from 'react'
import { Network, RotateCcw } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Card } from '@/components/ui'
import { NovelNavigator } from '@/components/NovelNavigator'
import { SemanticGraph } from '@/graph/SemanticGraph'
import { getEntityConnections } from '@/utils/semantic-index'
import { getEntityNovelRefs, getNovelDescriptors } from '@/utils/novels'
import type { RendererProps } from '../types'

export function RelationshipRenderer({ universe, index }: RendererProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [novelSelection, setNovelSelection] = useState('all')
  const novels = getNovelDescriptors(universe)
  const requestedFocusId = searchParams.get('focus') ?? ''
  const focusEntity = index.entities.get(requestedFocusId)
  const focusId = focusEntity?.id
  const allowedIds = useMemo(() => {
    if (novelSelection === 'all') return undefined
    const seedIds = [...index.entities.values()].filter((entity) => getEntityNovelRefs(entity).includes(novelSelection)).map((entity) => entity.id)
    const contextual = new Set(seedIds)
    contextual.add(novelSelection)
    seedIds.forEach((id) => {
      index.references.get(id)?.forEach((reference) => contextual.add(reference))
      index.backlinks.get(id)?.forEach((reference) => contextual.add(reference))
    })
    return contextual
  }, [index, novelSelection])
  const connections = focusId ? getEntityConnections(index, focusId).filter((entity) => !allowedIds || allowedIds.has(entity.id)) : []
  const visibleEntities = allowedIds?.size ?? index.entities.size
  const linkCount = [...index.references.entries()].reduce((total, [sourceId, refs]) => {
    if (allowedIds && !allowedIds.has(sourceId)) return total
    return total + refs.filter((targetId) => !allowedIds || allowedIds.has(targetId)).length
  }, 0)
  const counts = Object.fromEntries([
    ['all', index.entities.size],
    ...novels.map((novel) => [novel.id, [...index.entities.values()].filter((entity) => getEntityNovelRefs(entity).includes(novel.id)).length] as const),
  ])

  return <div className="module-page">
    <header className="module-hero">
      <div>
        <p className="eyebrow">Índice semántico · Tetralogía</p>
        <h1>{focusEntity ? `${focusEntity.title} — Conexiones` : 'Relaciones'}</h1>
        <p>{focusEntity ? `Vista focal de las ${connections.length} conexiones canónicas de ${focusEntity.title}.` : 'Cada arista se deriva del master, incluidos vínculos narrativos, causales y de pertenencia a novela.'}</p>
      </div>
      {focusEntity && <Link className="button button-secondary" to="/module/relationships"><RotateCcw size={15} /> Grafo completo</Link>}
    </header>
    <NovelNavigator novels={novels} selected={novelSelection} onSelect={setNovelSelection} counts={counts} label="Grafo por novela" />
    <div className="graph-stats">
      <Card><Network size={20} /><strong>{focusEntity ? connections.length : visibleEntities}</strong><span>{focusEntity ? 'conexiones focales' : 'entidades visibles'}</span></Card>
      <Card><Network size={20} /><strong>{focusEntity ? connections.length + 1 : linkCount}</strong><span>{focusEntity ? 'nodos visibles' : 'referencias cruzadas'}</span></Card>
      <Card><Network size={20} /><strong>{universe.modules.length}</strong><span>módulos fuente</span></Card>
    </div>
    {focusEntity && <div className="graph-focus-toolbar" role="status"><Badge tone="amber">Focalizado</Badge><strong>{focusEntity.title}</strong><span>{connections.length} conexiones directas</span></div>}
    <Card className="graph-card"><SemanticGraph index={index} focusId={focusId} allowedIds={allowedIds} onNodeSelect={(entityId) => setSearchParams({ focus: entityId })} /></Card>
  </div>
}
