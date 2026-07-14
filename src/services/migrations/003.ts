import type { Migration } from './types'

export const DEFAULT_ANALYSIS_CONFIG = {
  enabled: false,
  engines: {
    continuity: false,
    causality: false,
    knowledge: false,
    connections: false,
    plausibility: false,
  },
} as const

export const migration003: Migration<Record<string, unknown>> = {
  id: '003-add-analysis-contract',
  from: '3.2.0',
  to: '3.3.0',
  description: 'Adds the disabled analytical configuration without materializing optional entity fields.',
  migrate: (source) => ({
    ...source,
    metadata: { ...(source.metadata as Record<string, unknown>), schemaVersion: '3.3.0' },
    analysisConfig: source.analysisConfig ?? {
      enabled: false,
      engines: {
        continuity: false,
        causality: false,
        knowledge: false,
        connections: false,
        plausibility: false,
      },
    },
  }),
}
