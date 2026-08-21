import { describe, expect, it } from 'vitest'
import {
  TantaloEvaluationError,
  buildEvaluationPayload,
  extractStructuredEvaluation,
  upsertEnvValue,
  validateApiKeyCandidate,
  validateEvaluationRequest,
} from '../vite-tantalo-evaluation-plugin'

const sampleText = 'Clay observó el retén desde el vehículo. Vicente sonrió sin mirarlo, como si ya conociera la pregunta que Clay todavía no se atrevía a formular.'

describe('Tántalo editorial evaluation API', () => {
  it('validates scope, focus and privacy protections', () => {
    const request = validateEvaluationRequest({ text: sampleText, scope: 'fragmento', focus: 'ritmo' })
    expect(request).toMatchObject({ scope: 'fragmento', focus: 'ritmo', protectCanon: true, protectVoice: true })
  })

  it('rejects short and oversized material before contacting a provider', () => {
    expect(() => validateEvaluationRequest({ text: 'Muy corto.', scope: 'fragmento', focus: 'general' })).toThrow(TantaloEvaluationError)
    const oversized = Array.from({ length: 1501 }, () => 'palabra').join(' ')
    expect(() => validateEvaluationRequest({ text: oversized, scope: 'fragmento', focus: 'general' })).toThrow(/1.500 palabras/)
  })

  it('builds a non-persistent structured Responses request', () => {
    const request = validateEvaluationRequest({ text: sampleText, scope: 'fragmento', focus: 'general' })
    const payload = buildEvaluationPayload(request, 'gpt-5.4-mini') as {
      store: boolean
      model: string
      text: { format: { type: string } }
      instructions: string
      input: string
    }
    expect(payload.store).toBe(false)
    expect(payload.model).toBe('gpt-5.4-mini')
    expect(payload.text.format.type).toBe('json_schema')
    expect(payload.instructions).toContain('no reescribas')
    expect(payload.input).toContain('<manuscrito_autor>')
  })

  it('extracts the structured report from Responses output', () => {
    const report = { verdict: 'Funciona.', dominant_problem: 'Ninguno grave.' }
    expect(extractStructuredEvaluation({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(report) }] }] })).toEqual(report)
  })

  it('validates project keys without exposing them and updates only the local env assignment', () => {
    const key = 'sk-proj-example_12345678901234567890'
    expect(validateApiKeyCandidate(key)).toBe(key)
    expect(() => validateApiKeyCandidate('not-a-key')).toThrow(/formato/)
    expect(upsertEnvValue('OTHER=value\nTANTALO_OPENAI_API_KEY=old\n', 'TANTALO_OPENAI_API_KEY', key)).toBe(`OTHER=value\nTANTALO_OPENAI_API_KEY=${key}\n`)
  })
})
