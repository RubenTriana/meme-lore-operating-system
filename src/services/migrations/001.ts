import type { Migration } from './types'

export const migration001: Migration<Record<string, unknown>> = {
  id: '001-add-schema-version',
  from: '1.0.0',
  to: '2.0.0',
  description: 'Moves the legacy top-level version into metadata and adds schemaVersion.',
  migrate: (source) => {
    const legacyVersion = typeof source.version === 'string' ? source.version : '0.1.0'
    const metadata = { ...(source.metadata as Record<string, unknown>), version: legacyVersion, schemaVersion: '2.0.0' }
    const rest = { ...source }
    delete rest.version
    return { ...rest, metadata }
  },
}
