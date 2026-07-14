import { migration001 } from './001'
import { migration002 } from './002'
import type { Migration } from './types'

export const migrations: Migration<Record<string, unknown>>[] = [migration001, migration002]
export const CURRENT_SCHEMA_VERSION = '3.2.0'

export function migrateUniverse(source: Record<string, unknown>): { data: Record<string, unknown>; applied: Migration<Record<string, unknown>>[] } {
  let data = structuredClone(source)
  const applied: Migration<Record<string, unknown>>[] = []
  let version = (data.metadata as { schemaVersion?: string } | undefined)?.schemaVersion ?? '1.0.0'

  while (version !== CURRENT_SCHEMA_VERSION) {
    const migration = migrations.find((candidate) => candidate.from === version)
    if (!migration) break
    data = migration.migrate(data)
    applied.push(migration)
    version = migration.to
  }
  return { data, applied }
}
