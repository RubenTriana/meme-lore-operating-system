import { z } from 'zod'
import type { Universe, ValidationIssue, ValidationResult } from '@/types/universe'

const id = z.string().regex(/^[a-z][a-z0-9-]*$/, 'Use lowercase kebab-case ids.')
const entitySchema = z
  .object({
    id,
    type: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
    refs: z.array(id).default([]),
    foreshadowing: z.array(id).default([]),
    development: z.number().min(0).max(100).optional(),
    importance: z.number().min(0).max(100).optional(),
    narrativeTime: z.number().min(0).max(100).optional(),
    quality: z.number().min(0).max(100).optional(),
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
      const references = [...(entity.refs ?? []), ...(entity.foreshadowing ?? [])]
      references.forEach((ref) => {
        if (!entityIds.has(ref)) {
          errors.push(issue(`entity.${entity.id}.refs`, ref, 'Broken cross-reference.', 'Create the referenced entity or remove this reference.'))
        }
      })
      if (!entity.summary) {
        warnings.push({ path: `entity.${entity.id}.summary`, message: 'Entity has no summary.', suggestion: 'Add a concise canonical description.', severity: 'warning' })
      }
    })
  })

  return { valid: errors.length === 0, data, errors, warnings }
}
