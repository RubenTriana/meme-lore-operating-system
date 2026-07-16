import type { SemanticIndex, Universe, UniverseEntity, UniverseModule } from '@/types/universe'

export function getModuleItems(module: UniverseModule): UniverseEntity[] {
  return module.content.items ?? []
}

export function createSemanticIndex(universe: Universe): SemanticIndex {
  const entities = new Map<string, UniverseEntity>()
  const moduleByEntity = new Map<string, UniverseModule>()
  const references = new Map<string, string[]>()
  const backlinks = new Map<string, string[]>()
  const tags = new Map<string, string[]>()

  universe.modules.forEach((module) => {
    getModuleItems(module).forEach((entity) => {
      entities.set(entity.id, entity)
      moduleByEntity.set(entity.id, module)
      const refs = [...(entity.refs ?? []), ...(entity.foreshadowing ?? [])]
      references.set(entity.id, refs)
      refs.forEach((ref) => backlinks.set(ref, [...(backlinks.get(ref) ?? []), entity.id]))
      entity.tags?.forEach((tag) => tags.set(tag, [...(tags.get(tag) ?? []), entity.id]))
    })
  })

  return { entities, moduleByEntity, references, backlinks, tags }
}

export function getEntityConnections(index: SemanticIndex, entityId: string): UniverseEntity[] {
  const connectionIds = [...new Set(index.references.get(entityId) ?? [])]
  return connectionIds.flatMap((id) => {
    const entity = index.entities.get(id)
    return entity ? [entity] : []
  })
}

export function getAllEntities(universe: Universe): UniverseEntity[] {
  return universe.modules.flatMap(getModuleItems)
}

export function searchUniverse(universe: Universe, term: string): UniverseEntity[] {
  const query = term.trim().toLocaleLowerCase()
  if (!query) return []
  return getAllEntities(universe)
    .map((entity) => {
      const title = entity.title.toLocaleLowerCase()
      const alias = entity.alias?.toLocaleLowerCase() ?? ''
      const tags = (entity.tags ?? []).join(' ').toLocaleLowerCase()
      const detail = [entity.summary, entity.type].filter(Boolean).join(' ').toLocaleLowerCase()
      const score = title.includes(query) ? title.indexOf(query) : alias.includes(query) ? 10 + alias.indexOf(query) : tags.includes(query) ? 20 + tags.indexOf(query) : detail.includes(query) ? 40 + detail.indexOf(query) : Number.POSITIVE_INFINITY
      return { entity, score }
    })
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => a.score - b.score)
    .map(({ entity }) => entity)
}
