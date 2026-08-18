import { Boxes, Braces, CheckCircle2, TimerReset } from 'lucide-react'
import { useState } from 'react'
import { useUniverseModel } from '@/app/useUniverseModel'
import { Badge, Card } from '@/components/ui'
import { isRendererRegistered, rendererIds } from '@/renderer/registry'
import { getPlugins } from '@/plugins/registry'

export function DeveloperPage() {
  const { universe, validation, migrated, loadedAt } = useUniverseModel()
  const [inspectedAt] = useState(performance.now)
  if (!universe) return null
  const elapsed = Math.max(0, Math.round(inspectedAt - loadedAt))
  return <div className="module-page developer-page"><header className="module-hero"><div><p className="eyebrow">Inspection surface</p><h1>Developer mode</h1><p>Read-only diagnostics for the loaded canon, metadata renderer registry and plugin boundary.</p></div><Braces size={28} /></header><div className="developer-stats"><Card><CheckCircle2 size={20} /><strong>{validation.valid ? 'Valid' : 'Invalid'}</strong><span>last validation</span></Card><Card><Boxes size={20} /><strong>{universe.modules.length}</strong><span>registered modules</span></Card><Card><TimerReset size={20} /><strong>{elapsed}ms</strong><span>since source load</span></Card></div><div className="developer-grid"><Card><div className="section-heading"><h2>Module tree</h2><Badge tone="blue">metadata-driven</Badge></div><div className="tree-list">{[...universe.modules].sort((a, b) => a.order - b.order).map((module) => <article key={module.id}><code>{module.id}</code><span>{module.renderer}</span><Badge tone={isRendererRegistered(module.renderer) ? 'green' : 'amber'}>{isRendererRegistered(module.renderer) ? 'renderer ready' : 'generic fallback'}</Badge></article>)}</div></Card><Card><div className="section-heading"><h2>Runtime registry</h2><Badge tone="amber">{rendererIds().length} renderers</Badge></div><pre>{JSON.stringify({ version: universe.metadata.version, schemaVersion: universe.metadata.schemaVersion, renderers: rendererIds(), plugins: getPlugins().map((plugin) => plugin.id), migrationsApplied: migrated, validation: { errors: validation.errors.length, warnings: validation.warnings.length } }, null, 2)}</pre></Card></div><Card className="raw-json"><div className="section-heading"><h2>Loaded universe_master.json</h2><Badge tone="neutral">read-only</Badge></div><pre>{JSON.stringify(universe, null, 2)}</pre></Card></div>
}
