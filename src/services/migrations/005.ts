import type { Migration } from './types'

export const migration005: Migration<Record<string, unknown>> = {
  id: '005-add-causality-knowledge-rule-vocabulary',
  from: '3.4.0',
  to: '3.5.0',
  description: 'Advances the schema for optional causal-loop exceptions and causal or knowledge rule references without materializing canon fields.',
  migrate: (source) => ({
    ...source,
    metadata: { ...(source.metadata as Record<string, unknown>), schemaVersion: '3.5.0' },
  }),
}
