export type DiffKind = 'added' | 'removed' | 'changed'
export interface DiffEntry { path: string; before?: unknown; after?: unknown; kind: DiffKind }

export function diffObjects(before: unknown, after: unknown, path = ''): DiffEntry[] {
  if (Object.is(before, after)) return []
  if (typeof before !== 'object' || before === null || typeof after !== 'object' || after === null) {
    return [{ path: path || 'root', before, after, kind: 'changed' }]
  }
  if (Array.isArray(before) || Array.isArray(after)) {
    return [{ path: path || 'root', before, after, kind: 'changed' }]
  }
  const previous = before as Record<string, unknown>
  const next = after as Record<string, unknown>
  return Array.from(new Set([...Object.keys(previous), ...Object.keys(next)])).flatMap((key) => {
    const childPath = path ? `${path}.${key}` : key
    if (!(key in previous)) return [{ path: childPath, after: next[key], kind: 'added' }]
    if (!(key in next)) return [{ path: childPath, before: previous[key], kind: 'removed' }]
    return diffObjects(previous[key], next[key], childPath)
  })
}
