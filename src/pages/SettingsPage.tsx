import { Braces, Download, FileUp, Moon, RotateCcw, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useUniverseModel } from '@/app/useUniverseModel'
import { Badge, Button, Card } from '@/components/ui'
import { downloadBlob, exportUniverse } from '@/services/universe-loader'
import { useStudioStore } from '@/store/useStudioStore'

export function SettingsPage() {
  const { universe, importPayload, reset, migrated } = useUniverseModel()
  const { developerMode, setDeveloperMode, dashboardLayout, setDashboardLayout } = useStudioStore()
  const [message, setMessage] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  if (!universe) return null
  const importSource = async (file?: File) => {
    if (!file) return
    try { importPayload(JSON.parse(await file.text())); setMessage(`${file.name} loaded and validated.`) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'The file could not be read as JSON.') }
  }
  const exportFile = (format: 'json' | 'markdown' | 'csv') => downloadBlob(exportUniverse(universe, format), `meme-universe-${universe.metadata.version}.${format === 'markdown' ? 'md' : format}`)
  return <div className="module-page"><header className="module-hero"><div><p className="eyebrow">Local workspace preferences</p><h1>Settings</h1><p>Canon remains in the master JSON. These controls only affect this browser workspace.</p></div></header><div className="settings-grid"><Card><div className="section-heading"><div><p className="eyebrow">Data transport</p><h2>Import & export</h2></div><FileUp size={19} /></div><p className="settings-copy">Import a complete universe_master.json or a patch.json with operations. Invalid files are isolated by the validation screen.</p><input ref={input} type="file" accept="application/json,.json" hidden onChange={(event) => importSource(event.target.files?.[0])} /><div className="button-row"><Button onClick={() => input.current?.click()}><Upload size={16} /> Import JSON / patch</Button><Button className="button-secondary" onClick={() => exportFile('json')}><Download size={16} /> JSON</Button><Button className="button-secondary" onClick={() => exportFile('markdown')}>Markdown</Button><Button className="button-secondary" onClick={() => exportFile('csv')}>CSV</Button></div>{message && <p className="import-message">{message}</p>}<Button className="text-button" onClick={() => { reset(); setMessage('Bundled universe restored.') }}><RotateCcw size={15} /> Restore bundled universe</Button>{migrated.length > 0 && <p className="import-message">Migrated automatically: {migrated.join(', ')}</p>}</Card><Card><div className="section-heading"><div><p className="eyebrow">Workspace</p><h2>Interface preference</h2></div><Moon size={19} /></div><div className="setting-row"><div><strong>Dark system surface</strong><p>MEME LOS defaults to the canonical dark interface.</p></div><Badge tone="green">Active</Badge></div><div className="setting-row"><div><strong>Dashboard density</strong><p>Stored locally on this device.</p></div><select value={dashboardLayout} onChange={(event) => setDashboardLayout(event.target.value as 'comfort' | 'compact')}><option value="comfort">Comfort</option><option value="compact">Compact</option></select></div></Card><Card><div className="section-heading"><div><p className="eyebrow">System tooling</p><h2>Developer mode</h2></div><Braces size={19} /></div><div className="setting-row"><div><strong>Inspect the loaded universe</strong><p>Exposes validation, module registry and raw JSON. This preference stays local.</p></div><button className={`switch ${developerMode ? 'on' : ''}`} aria-label="Toggle developer mode" onClick={() => setDeveloperMode(!developerMode)}><span /></button></div></Card></div></div>
}
