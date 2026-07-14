import type { ComponentType } from 'react'
import type { UniverseModule } from '@/types/universe'

export interface LorePlugin {
  id: string
  name: string
  version: string
  description: string
  modules?: string[]
  panels?: Array<{ id: string; title: string; component: ComponentType<{ module: UniverseModule }> }>
}
