import { Archive, ArrowRight, GitCompareArrows, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useUniverseModel } from '@/app/useUniverseModel'
import { Badge, Button, Card } from '@/components/ui'
import { deleteSnapshot, getSnapshots, saveSnapshot, type UniverseSnapshot } from '@/services/snapshots'
import { diffObjects } from '@/utils/diff'

export function ChangelogPage() {
  const { universe } = useUniverseModel()
  const [snapshots, setSnapshots] = useState<UniverseSnapshot[]>(getSnapshots)
  const [compare, setCompare] = useState<string | undefined>()
  if (!universe) return null
  const selected = snapshots.find((snapshot) => snapshot.id === compare)
  const diffs = selected ? diffObjects(selected.universe, universe).slice(0, 30) : []
  const create = () => { saveSnapshot(universe); setSnapshots(getSnapshots()) }
  const remove = (id: string) => { deleteSnapshot(id); setSnapshots(getSnapshots()); if (id === compare) setCompare(undefined) }
  return <div className="module-page"><header className="module-hero"><div><p className="eyebrow">Canon history</p><h1>Changelog & snapshots</h1><p>Immutable local snapshots make it possible to review canonical changes before a source file is replaced.</p></div><Button onClick={create}><Plus size={16} /> Save snapshot</Button></header><div className="history-grid"><Card><div className="section-heading"><div><p className="eyebrow">Generated changelog</p><h2>Version history</h2></div><GitCompareArrows size={19} /></div><div className="changelog-list">{universe.changelog.map((entry) => <article key={entry.id}><div><Badge tone="amber">v{entry.version}</Badge><time>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(entry.date))}</time></div><h3>{entry.changes.join(' · ')}</h3><p>{entry.author} · {entry.modules.join(', ')}</p></article>)}</div></Card><Card><div className="section-heading"><div><p className="eyebrow">Local archive</p><h2>Snapshots</h2></div><Archive size={19} /></div><div className="snapshot-list">{snapshots.map((snapshot) => <article key={snapshot.id}><button className={compare === snapshot.id ? 'selected' : ''} onClick={() => setCompare(snapshot.id)}><strong>v{snapshot.version}</strong><span>{new Date(snapshot.createdAt).toLocaleString()}</span></button><button aria-label="Delete snapshot" onClick={() => remove(snapshot.id)}><Trash2 size={15} /></button></article>)}{!snapshots.length && <p className="muted">No local snapshots yet.</p>}</div></Card></div>{selected && <Card className="diff-card"><div className="section-heading"><div><p className="eyebrow">Snapshot comparison</p><h2>v{selected.version} <ArrowRight size={16} /> v{universe.metadata.version}</h2></div><Badge tone="blue">{diffs.length} visible changes</Badge></div><div className="diff-list">{diffs.map((diff, index) => <article key={`${diff.path}-${index}`} className={diff.kind}><code>{diff.path}</code><div>{diff.kind !== 'added' && <span>− {JSON.stringify(diff.before)}</span>}{diff.kind !== 'removed' && <span>+ {JSON.stringify(diff.after)}</span>}</div></article>)}</div></Card>}</div>
}
