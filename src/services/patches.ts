export interface PatchOperation { op: 'add' | 'replace' | 'remove'; path: string; value?: unknown }
export interface UniversePatch { metadata?: Record<string, unknown>; operations: PatchOperation[] }

function resolveSegment(container: unknown, segment: string): unknown {
  if (Array.isArray(container)) return container.find((item) => typeof item === 'object' && item !== null && (item as { id?: string }).id === segment) ?? container[Number(segment)]
  return (container as Record<string, unknown>)[segment]
}

export function applyPatch<T extends object>(source: T, patch: UniversePatch): T {
  const next = structuredClone(source) as Record<string, unknown>
  if (patch.metadata) next.metadata = { ...(next.metadata as Record<string, unknown>), ...patch.metadata }
  patch.operations.forEach((operation) => {
    const segments = operation.path.split('/').filter(Boolean)
    const last = segments.pop()
    if (!last) throw new Error(`Patch operation has no target: ${operation.path}`)
    let parent: unknown = next
    for (const segment of segments) {
      parent = resolveSegment(parent, segment)
      if (parent === undefined) throw new Error(`Patch path not found: ${operation.path}`)
    }
    if (Array.isArray(parent)) {
      const index = parent.findIndex((item) => typeof item === 'object' && item !== null && (item as { id?: string }).id === last)
      if (operation.op === 'remove' && index >= 0) parent.splice(index, 1)
      else if (operation.op === 'add') parent.push(operation.value)
      else if (index >= 0) parent[index] = operation.value
      else throw new Error(`Patch array target not found: ${operation.path}`)
      return
    }
    const record = parent as Record<string, unknown>
    if (operation.op === 'remove') delete record[last]
    else record[last] = operation.value
  })
  return next as T
}
