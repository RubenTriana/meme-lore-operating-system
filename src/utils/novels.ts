import type { Universe, UniverseEntity } from '@/types/universe'
import { canonicalModuleItems } from '@/utils/canon-policy'

export interface NovelDescriptor {
  id: string
  title: string
  shortTitle: string
  number: number
}

const tagToNovelId: Record<string, string> = {
  'novela-uno': 'meme-novela-uno',
  'novela-dos': 'meme-novela-dos',
  'novela-tres': 'meme-novela-tres',
  'novela-cuatro': 'meme-novela-cuatro',
}

function novelNumber(entity: UniverseEntity): number {
  const titleMatch = entity.title.match(/Novela\s+(\d+)/i)
  if (titleMatch) return Number(titleMatch[1])
  const words = ['uno', 'dos', 'tres', 'cuatro']
  const word = words.findIndex((candidate) => entity.id.endsWith(`-${candidate}`))
  return word < 0 ? Number.MAX_SAFE_INTEGER : word + 1
}

export function getNovelDescriptors(universe: Universe): NovelDescriptor[] {
  const module = universe.modules.find((candidate) => candidate.id === 'franchise')
  const entries = module
    ? canonicalModuleItems(universe, module).filter(
        (entity) => entity.type === 'franchise-entry' && /^meme-novela-/.test(entity.id),
      )
    : []

  return entries
    .map((entity) => {
      const number = novelNumber(entity)
      return {
        id: entity.id,
        title: entity.title,
        shortTitle: entity.title.replace(/^Novela\s+\d+\s+[—-]\s+/i, ''),
        number,
      }
    })
    .sort((left, right) => left.number - right.number || left.title.localeCompare(right.title))
}

export function getEntityNovelRefs(entity: UniverseEntity): string[] {
  const refs = new Set<string>()
  if (entity.novelRef) refs.add(entity.novelRef)
  if (entity.primaryNovelRef) refs.add(entity.primaryNovelRef)
  entity.novelRefs?.forEach((reference) => refs.add(reference))
  entity.tags?.forEach((tag) => {
    if (tagToNovelId[tag]) refs.add(tagToNovelId[tag])
    if (/^meme-novela-(uno|dos|tres|cuatro)$/.test(tag)) refs.add(tag)
  })
  if (entity.type === 'franchise-entry' && /^meme-novela-/.test(entity.id)) refs.add(entity.id)
  return [...refs]
}

export function novelLabelMap(novels: NovelDescriptor[]): Map<string, string> {
  return new Map(novels.map((novel) => [novel.id, `N${novel.number} · ${novel.shortTitle}`]))
}

export function filterByNovel(items: UniverseEntity[], selection: string): UniverseEntity[] {
  if (selection === 'all') return items
  if (selection === 'transversal')
    return items.filter((entity) => getEntityNovelRefs(entity).length === 0)
  return items.filter((entity) => getEntityNovelRefs(entity).includes(selection))
}
