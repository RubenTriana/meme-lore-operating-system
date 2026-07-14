import type { NarrativeExtractionAdapter, NarrativeSource, SourceDisclosure } from './types'

const sensitivePatterns: Array<[string, RegExp]> = [
  ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/i],
  ['credencial con prefijo sk-', /\bsk-[a-z0-9_-]{16,}\b/i],
  ['cabecera de autorización', /authorization\s*:\s*bearer\s+\S+/i],
  ['secreto asignado', /\b(api[_ -]?key|password|secret|token)\s*[:=]\s*\S+/i],
]

export class ExtractionSecurityError extends Error {
  constructor(message: string) { super(message); this.name = 'ExtractionSecurityError' }
}

export function sourceDisclosure(source: NarrativeSource): SourceDisclosure {
  const selected = source.fragments.filter((fragment) => fragment.selected)
  const sensitiveMatches = [...new Set(selected.flatMap((fragment) => sensitivePatterns.filter(([, pattern]) => pattern.test(fragment.text)).map(([label]) => `${fragment.id}: ${label}`)))].sort()
  return {
    selectedFragmentIds: selected.map((fragment) => fragment.id).sort(),
    selectedLabels: selected.map((fragment) => fragment.sourceLabel ?? fragment.id).sort(),
    characterCount: selected.reduce((sum, fragment) => sum + fragment.text.length, 0),
    includesUniverse: false,
    sensitiveMatches,
  }
}

export function selectedNarrativeSource(source: NarrativeSource): NarrativeSource {
  return { id: source.id, fragments: source.fragments.filter((fragment) => fragment.selected).map((fragment) => ({ ...fragment, selected: true })) }
}

export async function extractSelectedSource(adapter: NarrativeExtractionAdapter, source: NarrativeSource): Promise<ReturnType<NarrativeExtractionAdapter['extract']> extends Promise<infer T> ? T : never> {
  const disclosure = sourceDisclosure(source)
  if (!disclosure.selectedFragmentIds.length) throw new ExtractionSecurityError('Selecciona al menos un fragmento antes de extraer.')
  if (disclosure.sensitiveMatches.length) throw new ExtractionSecurityError(`La selección contiene posibles secretos: ${disclosure.sensitiveMatches.join(', ')}.`)
  return adapter.extract(selectedNarrativeSource(source))
}
