import type { UniverseEntity } from '@/types/universe'
import { getEntityNovelRefs, novelLabelMap, type NovelDescriptor } from '@/utils/novels'

interface NovelNavigatorProps {
  novels: NovelDescriptor[]
  selected: string
  onSelect: (selection: string) => void
  counts: Record<string, number>
  includeTransversal?: boolean
  label?: string
}

export function NovelNavigator({ novels, selected, onSelect, counts, includeTransversal = false, label = 'Navegación por novela' }: NovelNavigatorProps) {
  return (
    <nav className="novel-navigator" aria-label={label}>
      <span>{label}</span>
      <div>
        <button type="button" className={selected === 'all' ? 'active' : ''} aria-pressed={selected === 'all'} onClick={() => onSelect('all')}>
          Tetralogía <strong>{counts.all ?? 0}</strong>
        </button>
        {novels.map((novel) => (
          <button key={novel.id} type="button" className={selected === novel.id ? 'active' : ''} aria-pressed={selected === novel.id} onClick={() => onSelect(novel.id)}>
            N{novel.number} <small>{novel.shortTitle}</small><strong>{counts[novel.id] ?? 0}</strong>
          </button>
        ))}
        {includeTransversal && (
          <button type="button" className={selected === 'transversal' ? 'active' : ''} aria-pressed={selected === 'transversal'} onClick={() => onSelect('transversal')}>
            Transversal <strong>{counts.transversal ?? 0}</strong>
          </button>
        )}
      </div>
    </nav>
  )
}

export function NovelBadges({ entity, novels }: { entity: UniverseEntity; novels: NovelDescriptor[] }) {
  const labels = novelLabelMap(novels)
  const references = getEntityNovelRefs(entity)
  return (
    <div className="novel-badges" aria-label="Presencia por novela">
      {references.length
        ? references.map((reference) => <span key={reference}>{labels.get(reference) ?? reference}</span>)
        : <span className="transversal">Saga transversal</span>}
    </div>
  )
}
