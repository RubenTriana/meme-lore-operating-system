import { z } from 'zod'
import type { AnalysisRuleId, TemporalPrecision, Universe, ValidationIssue, ValidationResult } from '@/types/universe'

const id = z.string().regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase kebab-case ids.')
const nonEmptyString = z.string().min(1)
const stringList = z.array(nonEmptyString)
const referenceList = z.array(id)
const temporalPrecision = z.enum(['exact', 'day', 'month', 'year', 'relative', 'unknown'])
const stateValue = z.union([z.string(), z.number(), z.boolean()])
const dayPattern = /^\d{4}-\d{2}-\d{2}$/
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/
const yearPattern = /^\d{4}$/
const exactPattern = /^\d{4}-\d{2}-\d{2}T/

function calendarDayTimestamp(value: string): number | undefined {
  if (!dayPattern.test(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? timestamp : undefined
}

function temporalOrder(value: string, precision?: TemporalPrecision): { precision: string; value: number } | undefined {
  if (precision === 'relative' || precision === 'unknown') return undefined
  if (precision === 'exact') {
    const timestamp = exactPattern.test(value) ? Date.parse(value) : Number.NaN
    return Number.isNaN(timestamp) ? undefined : { precision, value: timestamp }
  }
  if (precision === 'day') {
    const timestamp = calendarDayTimestamp(value)
    return timestamp === undefined ? undefined : { precision, value: timestamp }
  }
  if (precision === 'month') {
    if (!monthPattern.test(value)) return undefined
    const [year, month] = value.split('-').map(Number)
    return { precision, value: year * 12 + month }
  }
  if (precision === 'year') return yearPattern.test(value) ? { precision, value: Number(value) } : undefined

  if (exactPattern.test(value)) {
    const timestamp = Date.parse(value)
    return Number.isNaN(timestamp) ? undefined : { precision: 'exact', value: timestamp }
  }
  const day = calendarDayTimestamp(value)
  if (day !== undefined) return { precision: 'day', value: day }
  if (monthPattern.test(value)) {
    const [year, month] = value.split('-').map(Number)
    return { precision: 'month', value: year * 12 + month }
  }
  return yearPattern.test(value) ? { precision: 'year', value: Number(value) } : undefined
}

function temporalValueIsValid(value: string, precision?: TemporalPrecision): boolean {
  if (precision === undefined || precision === 'relative' || precision === 'unknown') return true
  return temporalOrder(value, precision) !== undefined
}

const temporalSchema = z
  .object({
    start: nonEmptyString.optional(),
    end: nonEmptyString.optional(),
    precision: temporalPrecision.optional(),
  })
  .passthrough()
  .superRefine((temporal, context) => {
    if (temporal.end && !temporal.start) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['end'], message: 'Temporal end requires a temporal start.' })
    }
    ;(['start', 'end'] as const).forEach((field) => {
      const value = temporal[field]
      if (value && !temporalValueIsValid(value, temporal.precision)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: `Temporal ${field} does not match its precision.` })
      }
    })
    if (temporal.start && temporal.end) {
      const start = temporalOrder(temporal.start, temporal.precision)
      const end = temporalOrder(temporal.end, temporal.precision)
      if (start && end && start.precision === end.precision && end.value < start.value) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['end'], message: 'Temporal end cannot be earlier than temporal start.' })
      }
    }
  })

const analysisSchema = z
  .object({
    goals: stringList.optional(),
    fears: stringList.optional(),
    beliefs: stringList.optional(),
    constraints: stringList.optional(),
    requiredKnowledge: stringList.optional(),
  })
  .passthrough()

const knowledgeChangeSchema = z
  .object({
    characterRef: id,
    learns: stringList.optional(),
    forgets: stringList.optional(),
  })
  .passthrough()

const stateChangeSchema = z
  .object({
    entityRef: id,
    path: nonEmptyString,
    from: stateValue.optional(),
    to: stateValue,
  })
  .passthrough()

const continuityRuleIds = ['character-dead-acting', 'incompatible-simultaneous-locations', 'incompatible-age', 'effect-before-cause', 'missing-cause-reference', 'undeclared-causal-cycle', 'important-event-without-cause', 'declared-cause-without-consequence', 'broken-causal-chain', 'knowledge-used-before-learning', 'remembered-after-forgetting', 'revelation-received-after-acting', 'knowledge-attributed-to-missing-character', 'temporally-ambiguous-knowledge-change'] as const satisfies readonly AnalysisRuleId[]
const continuityExceptionSchema = z
  .object({
    kind: z.enum(['resurrection', 'copy', 'simulation', 'flashback', 'vision', 'non-physical-appearance', 'travel', 'duplication', 'teleportation', 'projection', 'prophecy', 'time-travel', 'retrocausality', 'causal-loop', 'world-exception']),
    ruleIds: z.array(z.enum(continuityRuleIds)).optional(),
    subjectRefs: referenceList.optional(),
    scope: z.enum(['event', 'universe']).optional(),
  })
  .passthrough()

const continuitySchema = z
  .object({
    life: z.object({ birth: temporalSchema.optional(), death: temporalSchema.optional() }).passthrough().optional(),
    ageAssertions: z.array(z.object({ entityRef: id, age: z.number().int().nonnegative() }).passthrough()).optional(),
    exceptions: z.array(continuityExceptionSchema).optional(),
  })
  .passthrough()

const entitySchema = z
  .object({
    id,
    type: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
    refs: referenceList.default([]),
    foreshadowing: referenceList.default([]),
    development: z.number().min(0).max(100).optional(),
    importance: z.number().min(0).max(100).optional(),
    narrativeTime: z.number().min(0).max(100).optional(),
    quality: z.number().min(0).max(100).optional(),
    sequence: z.number().int().nonnegative().optional(),
    analysis: analysisSchema.optional(),
    temporal: temporalSchema.optional(),
    locationRefs: referenceList.optional(),
    participantRefs: referenceList.optional(),
    causes: referenceList.optional(),
    causedByRefs: referenceList.optional(),
    effects: referenceList.optional(),
    novelRef: id.nullable().optional(),
    novelRefs: referenceList.optional(),
    primaryNovelRef: id.optional(),
    sagaRef: id.optional(),
    act: nonEmptyString.optional(),
    plotline: nonEmptyString.optional(),
    beatNumber: z.number().int().positive().optional(),
    knowledgeChanges: z.array(knowledgeChangeSchema).optional(),
    stateChanges: z.array(stateChangeSchema).optional(),
    continuity: continuitySchema.optional(),
  })
  .passthrough()

const moduleSchema = z.object({
  id,
  title: z.string().min(1),
  type: z.string().min(1),
  icon: z.string().min(1),
  order: z.number(),
  visibility: z.enum(['navigation', 'hidden', 'developer']),
  renderer: z.string().min(1),
  description: z.string().optional(),
  content: z.object({ items: z.array(entitySchema).optional() }).passthrough(),
})

export const universeSchema = z.object({
  metadata: z.object({
    title: z.string().min(1),
    subtitle: z.string().optional(),
    version: z.string().regex(/^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$/, 'Use semantic versioning, e.g. 0.8.1.'),
    schemaVersion: z.string().regex(/^\d+\.\d+(\.\d+)?$/, 'Use a numeric schema version, e.g. 3.2.0.'),
    build: z.string().min(1),
    created: z.string().datetime(),
    updated: z.string().datetime(),
    author: z.string().min(1),
    description: z.string().optional(),
  }),
  analysisConfig: z
    .object({
      enabled: z.boolean(),
      engines: z.object({
        continuity: z.boolean(),
        causality: z.boolean(),
        knowledge: z.boolean(),
        connections: z.boolean(),
        plausibility: z.boolean(),
      }).passthrough(),
    })
    .passthrough()
    .optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  modules: z.array(moduleSchema).min(1),
  changelog: z.array(
    z.object({
      id,
      version: z.string(),
      date: z.string().datetime(),
      author: z.string(),
      changes: z.array(z.string()),
      modules: z.array(z.string()),
    }),
  ),
})

function issue(path: string, value: unknown, message: string, suggestion: string): ValidationIssue {
  return { path, value, message, suggestion, severity: 'error' }
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  values.forEach((value) => {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  })
  return [...duplicates]
}

function validateUniqueValues(errors: ValidationIssue[], path: string, values: readonly string[], label: string): void {
  duplicateValues(values).forEach((value) => {
    errors.push(issue(path, value, `Duplicate ${label} value.`, 'Keep each value only once.'))
  })
}

function validateReferences(errors: ValidationIssue[], entityIds: Set<string>, entityId: string, field: string, references: string[]): void {
  const path = `entity.${entityId}.${field}`
  validateUniqueValues(errors, path, references, field)
  references.forEach((reference) => {
    if (!entityIds.has(reference)) {
      errors.push(issue(path, reference, 'Broken cross-reference.', 'Create the referenced entity or remove this reference.'))
    }
  })
}

export function validateUniverse(input: unknown): ValidationResult {
  const parsed = universeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((error) =>
        issue(error.path.join('.') || 'root', undefined, error.message, 'Correct this field and reload the file.'),
      ),
      warnings: [],
    }
  }

  const data = parsed.data as Universe
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const moduleIds = new Set<string>()
  const entityIds = new Set<string>()

  data.modules.forEach((module, moduleIndex) => {
    if (moduleIds.has(module.id)) {
      errors.push(issue(`modules.${moduleIndex}.id`, module.id, 'Duplicate module id.', 'Assign a unique module id.'))
    }
    moduleIds.add(module.id)
    module.content.items?.forEach((entity, entityIndex) => {
      if (entityIds.has(entity.id)) {
        errors.push(issue(`modules.${module.id}.items.${entityIndex}.id`, entity.id, 'Duplicate entity id.', 'IDs must be globally unique.'))
      }
      entityIds.add(entity.id)
    })
  })

  data.modules.forEach((module) => {
    module.content.items?.forEach((entity) => {
      const referenceFields: Array<[string, string[]]> = [
        ['refs', entity.refs ?? []],
        ['foreshadowing', entity.foreshadowing ?? []],
        ['locationRefs', entity.locationRefs ?? []],
        ['participantRefs', entity.participantRefs ?? []],
        ['causes', entity.causes ?? []],
        ['causedByRefs', entity.causedByRefs ?? []],
        ['effects', entity.effects ?? []],
        ['novelRef', entity.novelRef ? [entity.novelRef] : []],
        ['novelRefs', entity.novelRefs ?? []],
        ['primaryNovelRef', entity.primaryNovelRef ? [entity.primaryNovelRef] : []],
        ['sagaRef', entity.sagaRef ? [entity.sagaRef] : []],
      ]
      referenceFields.forEach(([field, references]) => {
        validateReferences(errors, entityIds, entity.id, field, references)
      })

      const knowledgeChangeRefs = new Set<string>()
      entity.knowledgeChanges?.forEach((change, changeIndex) => {
        const path = `entity.${entity.id}.knowledgeChanges.${changeIndex}`
        if (!entityIds.has(change.characterRef)) {
          errors.push(issue(`${path}.characterRef`, change.characterRef, 'Broken character reference.', 'Reference an existing entity.'))
        }
        if (knowledgeChangeRefs.has(change.characterRef)) {
          errors.push(issue(`${path}.characterRef`, change.characterRef, 'Duplicate knowledge change character reference.', 'Combine changes for the same character.'))
        }
        knowledgeChangeRefs.add(change.characterRef)
        validateUniqueValues(errors, `${path}.learns`, change.learns ?? [], 'knowledge change')
        validateUniqueValues(errors, `${path}.forgets`, change.forgets ?? [], 'knowledge change')
        const forgotten = new Set(change.forgets ?? [])
        ;(change.learns ?? []).forEach((knowledge) => {
          if (forgotten.has(knowledge)) {
            errors.push(issue(path, knowledge, 'Knowledge cannot be learned and forgotten in the same change.', 'Keep a knowledge value in only one direction.'))
          }
        })
      })

      const stateChangeKeys = new Set<string>()
      entity.stateChanges?.forEach((change, changeIndex) => {
        const path = `entity.${entity.id}.stateChanges.${changeIndex}`
        if (!entityIds.has(change.entityRef)) {
          errors.push(issue(`${path}.entityRef`, change.entityRef, 'Broken state change entity reference.', 'Reference an existing entity.'))
        }
        const key = `${change.entityRef}\u0000${change.path}`
        if (stateChangeKeys.has(key)) {
          errors.push(issue(path, key, 'Duplicate state change target.', 'Keep one state change per entity path.'))
        }
        stateChangeKeys.add(key)
      })

      const ageAssertionRefs = new Set<string>()
      entity.continuity?.ageAssertions?.forEach((assertion, assertionIndex) => {
        const path = `entity.${entity.id}.continuity.ageAssertions.${assertionIndex}`
        if (!entityIds.has(assertion.entityRef)) {
          errors.push(issue(`${path}.entityRef`, assertion.entityRef, 'Broken age assertion entity reference.', 'Reference an existing entity.'))
        }
        if (ageAssertionRefs.has(assertion.entityRef)) {
          errors.push(issue(`${path}.entityRef`, assertion.entityRef, 'Duplicate age assertion entity reference.', 'Keep one age assertion per entity and event.'))
        }
        ageAssertionRefs.add(assertion.entityRef)
      })

      entity.continuity?.exceptions?.forEach((exception, exceptionIndex) => {
        const path = `entity.${entity.id}.continuity.exceptions.${exceptionIndex}`
        validateUniqueValues(errors, `${path}.subjectRefs`, exception.subjectRefs ?? [], 'continuity exception subject reference')
        exception.subjectRefs?.forEach((reference) => {
          if (!entityIds.has(reference)) {
            errors.push(issue(`${path}.subjectRefs`, reference, 'Broken continuity exception subject reference.', 'Reference an existing entity.'))
          }
        })
        validateUniqueValues(errors, `${path}.ruleIds`, exception.ruleIds ?? [], 'continuity exception rule')
      })

      if (!entity.summary) {
        warnings.push({ path: `entity.${entity.id}.summary`, message: 'Entity has no summary.', suggestion: 'Add a concise canonical description.', severity: 'warning' })
      }
    })
  })

  return { valid: errors.length === 0, data, errors, warnings }
}
