import type { LorePlugin } from './types'

const plugins = new Map<string, LorePlugin>()

export function registerPlugin(plugin: LorePlugin): void {
  if (plugins.has(plugin.id)) throw new Error(`Plugin ${plugin.id} is already registered.`)
  plugins.set(plugin.id, plugin)
}

export function getPlugins(): LorePlugin[] {
  return [...plugins.values()]
}

export function getPluginForModule(moduleId: string): LorePlugin | undefined {
  return getPlugins().find((plugin) => plugin.modules?.includes(moduleId))
}
