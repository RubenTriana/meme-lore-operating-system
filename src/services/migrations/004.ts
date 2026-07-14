import type { Migration } from './types'

export const migration004: Migration<Record<string, unknown>> = {
  id: '004-add-continuity-contract',
  from: '3.3.0',
  to: '3.4.0',
  description: 'Advances the schema for optional continuity facts without materializing them in canon.',
  migrate: (source) => ({
    ...source,
    metadata: { ...(source.metadata as Record<string, unknown>), schemaVersion: '3.4.0' },
  }),
}
