import type { Universe, UniverseEntity, UniverseModule } from '@/types/universe'

interface CanonPolicy {
  defaultIncludeCanonStatuses?: unknown
  defaultExcludeCanonStatuses?: unknown
  excludeModulesByDefault?: unknown
  scriptureStatus?: unknown
  proposedNestedFieldsMustRemainExcluded?: unknown
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

function policy(universe: Universe): CanonPolicy | undefined {
  const value = universe.settings?.canonPolicy
  return value && typeof value === 'object' ? (value as CanonPolicy) : undefined
}

export function isCanonicalModule(universe: Universe, module: UniverseModule): boolean {
  const active = policy(universe)
  if (!active) return true
  return !new Set(strings(active.excludeModulesByDefault)).has(module.id)
}

export function isCanonicalEntity(universe: Universe, entity: UniverseEntity): boolean {
  const active = policy(universe)
  if (!active) return true
  const status = typeof entity.canonStatus === 'string' ? entity.canonStatus : ''
  const included = new Set(strings(active.defaultIncludeCanonStatuses))
  const excluded = new Set(strings(active.defaultExcludeCanonStatuses))
  const scripture =
    typeof active.scriptureStatus === 'string' ? active.scriptureStatus : 'CANON_SCRIPTURE'
  if (status === scripture) return true
  if (!status || excluded.has(status)) return false
  return included.has(status)
}

export function canonicalModuleItems(universe: Universe, module: UniverseModule): UniverseEntity[] {
  if (!isCanonicalModule(universe, module)) return []
  return (module.content.items ?? []).filter((entity) => isCanonicalEntity(universe, entity))
}

export function canonicalModules(universe: Universe): UniverseModule[] {
  return universe.modules.filter((module) => isCanonicalModule(universe, module))
}

export function canonicalDetailEntries(
  universe: Universe,
  entity: UniverseEntity,
): Array<[string, unknown]> {
  const hidden = new Set(strings(policy(universe)?.proposedNestedFieldsMustRemainExcluded))
  return Object.entries(entity).filter(([key]) => !hidden.has(key))
}
