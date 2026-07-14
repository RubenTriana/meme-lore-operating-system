import { migrateUniverse } from '../src/services/migrations'

describe('migrations', () => {
  it('brings a legacy file to the active schema', () => {
    const result = migrateUniverse({ version: '0.1.0', metadata: { title: 'Legacy' }, modules: [] })
    expect(result.data.metadata).toMatchObject({ version: '0.1.0', schemaVersion: '3.2.0' })
    expect(result.applied.map((migration) => migration.id)).toEqual(['001-add-schema-version', '002-add-entity-arrays'])
  })
})
