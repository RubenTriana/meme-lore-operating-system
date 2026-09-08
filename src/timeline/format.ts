import type { UniverseEntity } from '@/types/universe'

function compareChronologyItems(a: UniverseEntity, b: UniverseEntity) {
  const sequence = (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER)
  return sequence || String(a.date ?? a.temporal?.start ?? '').localeCompare(String(b.date ?? b.temporal?.start ?? '')) || a.title.localeCompare(b.title)
}

function formatChronologyMilestone(item: UniverseEntity, position: number) {
  const sequence = item.sequence !== undefined ? String(item.sequence).padStart(4, '0') : item.date?.slice(0, 4) ?? '—'
  const details = [
    item.act ?? item.era ? `Acto o etapa: ${item.act ?? item.era}` : undefined,
    item.plotline ? `Línea narrativa: ${item.plotline}` : undefined,
    item.date ?? item.temporal?.start ? `Posición temporal: ${item.date ?? item.temporal?.start}` : undefined,
  ].filter(Boolean)

  return [
    `${position}. **${sequence} · ${item.title}**`,
    ...details.map((detail) => `   - ${detail}`),
    `   - Hito: ${item.summary}`,
    `   - ID: ${item.id}`,
  ].join('\n')
}

export function formatChronologyBlockForClipboard(title: string, novelNumber: number, items: UniverseEntity[]) {
  const chronologic = [...items].sort(compareChronologyItems)
  return [
    novelNumber > 0 ? `# Novela ${novelNumber} — ${title}` : `# ${title}`,
    '',
    `${chronologic.length} hitos cronológicos`,
    '',
    ...chronologic.flatMap((item, index) => [formatChronologyMilestone(item, index + 1), '']),
  ].join('\n').trim()
}
