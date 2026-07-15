import source from '../data/universe_master.json'
import historicalSource from './fixtures/universe-v3_2-pre-phase-11.json'
import { loadUniverse } from '../src/services/universe-loader'
import { migrateUniverse } from '../src/services/migrations'

describe('migrations', () => {
  it('brings a legacy file to the active schema', () => {
    const result = migrateUniverse({ version: '0.1.0', metadata: { title: 'Legacy' }, modules: [] })
    expect(result.data.metadata).toMatchObject({ version: '0.1.0', schemaVersion: '3.5.0' })
    expect(result.data.analysisConfig).toEqual({
      enabled: false,
      engines: { continuity: false, causality: false, knowledge: false, connections: false, plausibility: false },
    })
    expect(result.applied.map((migration) => migration.id)).toEqual(['001-add-schema-version', '002-add-entity-arrays', '003-add-analysis-contract', '004-add-continuity-contract', '005-add-causality-knowledge-rule-vocabulary'])
  })

  it('migrates a frozen schema 3.2 universe without changing its narrative content', () => {
    const original = structuredClone(historicalSource)
    const result = migrateUniverse(historicalSource)
    const { schemaVersion, ...originalMetadata } = original.metadata
    const originalIds = original.modules.flatMap((module) => module.content.items ?? []).map((entity) => entity.id)
    const migratedIds = (result.data.modules as typeof original.modules).flatMap((module) => module.content.items ?? []).map((entity) => entity.id)

    expect(result.data.modules).toEqual(original.modules)
    expect(result.data.changelog).toEqual(original.changelog)
    expect(result.data.metadata).toMatchObject(originalMetadata)
    expect(schemaVersion).toBe('3.2.0')
    expect(result.data.metadata).toMatchObject({ schemaVersion: '3.5.0' })
    expect(result.applied.map((migration) => migration.id)).toEqual(['003-add-analysis-contract', '004-add-continuity-contract', '005-add-causality-knowledge-rule-vocabulary'])
    expect(migratedIds).toEqual(originalIds)
    expect(result.data.analysisConfig).toEqual({
      enabled: false,
      engines: { continuity: false, causality: false, knowledge: false, connections: false, plausibility: false },
    })
  })

  it('is idempotent after the analysis contract is applied', () => {
    const once = migrateUniverse(source)
    const twice = migrateUniverse(once.data)

    expect(twice.data).toEqual(once.data)
    expect(once.data).toEqual(source)
    expect(once.applied).toHaveLength(0)
    expect(twice.applied).toHaveLength(0)
  })

  it('loads the current canon with disabled analysis engines and no entity analysis', () => {
    const result = loadUniverse(source)
    const firstEntity = result.validation.data?.modules[0]?.content.items?.[0]

    expect(result.validation.valid).toBe(true)
    expect(result.validation.data?.metadata.schemaVersion).toBe('3.5.0')
    expect(result.validation.data?.analysisConfig?.enabled).toBe(false)
    expect(Object.values(result.validation.data?.analysisConfig?.engines ?? {})).toEqual([false, false, false, false, false])
    expect(firstEntity?.analysis).toBeUndefined()
  })
})
