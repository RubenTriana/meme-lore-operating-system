import { GenericRenderer } from './renderers/GenericRenderer'
import { CharacterRenderer } from './renderers/CharacterRenderer'
import { BeatRenderer } from './renderers/BeatRenderer'
import { RelationshipRenderer } from './renderers/RelationshipRenderer'
import { TimelineRenderer } from './renderers/TimelineRenderer'
import type { ModuleRenderer } from './types'

const renderers = new Map<string, ModuleRenderer>([
  ['knowledge', GenericRenderer],
  ['characters', CharacterRenderer],
  ['beats', BeatRenderer],
  ['relationships', RelationshipRenderer],
  ['timeline', TimelineRenderer],
])

export function registerRenderer(id: string, renderer: ModuleRenderer): void {
  renderers.set(id, renderer)
}

export function getRenderer(id: string): ModuleRenderer {
  return renderers.get(id) ?? GenericRenderer
}

export function isRendererRegistered(id: string): boolean {
  return renderers.has(id)
}

export function rendererIds(): string[] {
  return [...renderers.keys()]
}
