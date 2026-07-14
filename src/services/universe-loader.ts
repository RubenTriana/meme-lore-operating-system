import source from '../../data/universe_master.json'
import { migrateUniverse } from '@/services/migrations'
import { validateUniverse } from '@/schemas/universe'
import type { Universe, ValidationResult } from '@/types/universe'

export interface LoadResult {
  validation: ValidationResult
  migrated: string[]
}

export function loadUniverse(raw: unknown = source): LoadResult {
  const migrateInput = raw as Record<string, unknown>
  const { data, applied } = migrateUniverse(migrateInput)
  return { validation: validateUniverse(data), migrated: applied.map((migration) => migration.id) }
}

export async function readUniverseFile(file: File): Promise<LoadResult> {
  const raw = JSON.parse(await file.text()) as unknown
  return loadUniverse(raw)
}

export function exportUniverse(universe: Universe, format: 'json' | 'markdown' | 'csv'): Blob {
  if (format === 'json') return new Blob([JSON.stringify(universe, null, 2)], { type: 'application/json' })
  const entities = universe.modules.flatMap((module) => module.content.items ?? [])
  if (format === 'csv') {
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [['id', 'type', 'title', 'status', 'development', 'tags'], ...entities.map((item) => [item.id, item.type, item.title, item.status, item.development, item.tags?.join(',')])]
    return new Blob([rows.map((row) => row.map(escape).join(',')).join('\n')], { type: 'text/csv' })
  }
  const document = [`# ${universe.metadata.title} — Universe export`, '', `Version: ${universe.metadata.version}`, '']
  universe.modules.forEach((module) => {
    document.push(`## ${module.title}`, '')
    ;(module.content.items ?? []).forEach((item) => document.push(`### ${item.title}`, item.summary ?? '', ''))
  })
  return new Blob([document.join('\n')], { type: 'text/markdown' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
