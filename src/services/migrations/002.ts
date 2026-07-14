import type { Migration } from './types'

export const migration002: Migration<Record<string, unknown>> = {
  id: '002-add-entity-arrays',
  from: '2.0.0',
  to: '3.2.0',
  description: 'Normalizes module content into a renderer-friendly items array.',
  migrate: (source) => ({
    ...source,
    metadata: { ...(source.metadata as Record<string, unknown>), schemaVersion: '3.2.0' },
    modules: Array.isArray(source.modules)
      ? source.modules.map((module) => {
          const current = module as Record<string, unknown>
          return { ...current, content: current.content ?? { items: [] } }
        })
      : [],
  }),
}
