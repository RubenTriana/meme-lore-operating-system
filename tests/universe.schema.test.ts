import source from '../data/universe_master.json'
import { validateUniverse } from '../src/schemas/universe'
import { analysisEventFixture } from './fixtures/analysis-v3_3'

describe('universe validation', () => {
  it('accepts the canonical master file without entity analysis', () => {
    const result = validateUniverse(source)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.data?.metadata.releaseStatus).toBe('CANON')
    expect(result.data?.metadata.sourceManifest).toHaveLength(9)
    expect(result.data?.settings?.canonApproval).toBeDefined()
    expect(result.data?.changelog.find((entry) => entry.id === 'change-017')?.status).toBe(
      'CANDIDATO_PARA_APROBACION',
    )
  })

  it('reports broken cross references without crashing', () => {
    const invalid = structuredClone(source)
    invalid.modules[0].content.items[0].refs = ['missing-entity']
    const result = validateUniverse(invalid)
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('Broken cross-reference')
  })

  it('accepts an event with optional analytical, temporal, causal, spatial, and cognitive fields', () => {
    const result = validateUniverse(analysisEventFixture)

    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('accepts structured causal-loop and knowledge-rule exceptions', () => {
    const valid = structuredClone(analysisEventFixture)
    const event = valid.modules[0].content.items?.[0]
    if (!event) throw new Error('The analytical fixture needs an event.')
    event.continuity = {
      exceptions: [
        {
          kind: 'causal-loop',
          ruleIds: ['undeclared-causal-cycle', 'knowledge-used-before-learning'],
        },
      ],
    }

    expect(validateUniverse(valid).valid).toBe(true)
  })

  it('rejects missing entity IDs in new reference fields', () => {
    const invalid = structuredClone(analysisEventFixture)
    const event = invalid.modules[0].content.items?.[0]
    if (!event) throw new Error('The analytical fixture needs an event.')
    event.locationRefs = ['missing-location']
    event.knowledgeChanges = [{ characterRef: 'missing-character' }]
    event.stateChanges = [{ entityRef: 'missing-entity', path: 'status', to: 'resolved' }]

    const result = validateUniverse(invalid)

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        'Broken cross-reference.',
        'Broken character reference.',
        'Broken state change entity reference.',
      ]),
    )
  })

  it('rejects invalid temporal intervals and temporal sequences', () => {
    const invalid = structuredClone(analysisEventFixture)
    const event = invalid.modules[0].content.items?.[0]
    if (!event) throw new Error('The analytical fixture needs an event.')
    event.temporal = { start: '2042-04-12', end: '2042-04-11', precision: 'day' }

    const intervalResult = validateUniverse(invalid)
    expect(intervalResult.valid).toBe(false)
    expect(
      intervalResult.errors.some(
        (error) => error.message === 'Temporal end cannot be earlier than temporal start.',
      ),
    ).toBe(true)

    event.temporal = { end: '2042-04-12', precision: 'day' }
    const sequenceResult = validateUniverse(invalid)
    expect(sequenceResult.valid).toBe(false)
    expect(
      sequenceResult.errors.some(
        (error) => error.message === 'Temporal end requires a temporal start.',
      ),
    ).toBe(true)
  })

  it('rejects duplicate values that would create ambiguous references', () => {
    const invalid = structuredClone(analysisEventFixture)
    const event = invalid.modules[0].content.items?.[0]
    if (!event) throw new Error('The analytical fixture needs an event.')
    event.participantRefs = ['meme-operator', 'meme-operator']

    const result = validateUniverse(invalid)

    expect(result.valid).toBe(false)
    expect(
      result.errors.some((error) => error.message === 'Duplicate participantRefs value.'),
    ).toBe(true)
  })
})
