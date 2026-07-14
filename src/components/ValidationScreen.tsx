import { AlertTriangle, FileWarning, RotateCcw } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { useUniverseModel } from '@/app/useUniverseModel'

export function ValidationScreen() {
  const { validation, reset } = useUniverseModel()
  return <main className="validation-screen"><Card className="validation-card"><div className="validation-icon"><FileWarning size={28} /></div><p className="eyebrow">Universe validation failed</p><h1>The canon is safe. The interface has not rendered invalid data.</h1><p>Correct the source file or import a valid universe_master.json. Every issue below points to a precise field.</p><div className="validation-list">{validation.errors.map((error, index) => <div key={`${error.path}-${index}`}><AlertTriangle size={16} /><code>{error.path}</code><span>{error.message}</span><small>{error.suggestion}</small></div>)}</div><Button onClick={reset}><RotateCcw size={16} /> Restore bundled universe</Button></Card></main>
}
