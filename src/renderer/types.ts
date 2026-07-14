import type { ComponentType } from 'react'
import type { SemanticIndex, Universe, UniverseModule } from '@/types/universe'

export interface RendererProps {
  module: UniverseModule
  universe: Universe
  index: SemanticIndex
}
export type ModuleRenderer = ComponentType<RendererProps>
