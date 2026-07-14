export interface Migration<T = unknown> {
  id: string
  from: string
  to: string
  description: string
  migrate: (source: T) => T
}
