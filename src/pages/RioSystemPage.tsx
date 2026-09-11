import { Activity, BookOpenCheck, Filter, Search, ShieldAlert, Waves } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Card } from '@/components/ui'
import './rio-system.css'

interface RioItem {
  id: string
  type: string
  title: string
  status: string
  canonLevel?: string
  summary?: string
  alias?: string
  aliases?: string[]
  section?: string
  plainExplanation?: string
  activation?: string
  effect?: string
  price?: string
  hardLimits?: string
  enemyCounter?: string
  evolution?: string
  counterTo?: string
}

interface RioCatalog {
  available: boolean
  id: string
  version: string
  sourceStatus: string
  sourceCanonLevel: string
  sourceHash: string
  authorDecision: { approved: string; notApproved: string }
  pendingDecisions: string[]
  items: RioItem[]
}

type FilterValue = 'all' | 'approved' | 'proposed'

function statusTone(item: RioItem) {
  return item.status.startsWith('approved') ? 'green' : item.status.includes('formalization') ? 'amber' : 'blue'
}

function Definition({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

export function RioSystemPage() {
  const [catalog, setCatalog] = useState<RioCatalog | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/tantalo/private/rio', { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json() as RioCatalog & { error?: string }
        if (!response.ok) throw new Error(payload.error || 'No se pudo abrir el catálogo RÍO.')
        setCatalog(payload)
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'No se pudo abrir el catálogo RÍO.')
      })
    return () => controller.abort()
  }, [])

  const visible = useMemo(() => {
    if (!catalog) return []
    const normalized = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    return catalog.items.filter((item) => {
      const approved = item.status.startsWith('approved')
      if (filter === 'approved' && !approved) return false
      if (filter === 'proposed' && approved) return false
      if (!normalized) return true
      return JSON.stringify(item).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalized)
    })
  }, [catalog, filter, query])

  if (error) return <div className="rio-page"><Card className="rio-empty"><ShieldAlert size={24} /><h1>RÍO no está importado</h1><p>{error}</p><p>La fuente privada permanece fuera de Git y debe restaurarse con el importador local.</p></Card></div>
  if (!catalog) return <div className="rio-page"><p className="muted">Abriendo el catálogo RÍO local…</p></div>

  const overview = catalog.items.find((item) => item.id === 'rio-system-overview')
  return <div className="rio-page">
    <header className="rio-hero">
      <div><p className="eyebrow">Categoría editorial consultable</p><h1>Modificadores de probabilidades <span>RÍO</span></h1><p>{overview?.summary}</p></div>
      <div className="rio-source"><BookOpenCheck size={20} /><strong>Fuente verificada</strong><span>v{catalog.version} · {catalog.sourceHash.slice(0, 12)}</span></div>
    </header>

    <div className="rio-boundary">
      <article><Badge tone="green">APROBADO</Badge><p>{catalog.authorDecision.approved}</p></article>
      <article><Badge tone="amber">PROPUESTA</Badge><p>{catalog.authorDecision.notApproved}</p></article>
    </div>

    <div className="rio-tools">
      <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar facultad, coste, contraataque o alias…" /></label>
      <div><Filter size={15} />{(['all', 'approved', 'proposed'] as const).map((value) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'Todo' : value === 'approved' ? 'Aprobado' : 'Propuestas'}</button>)}</div>
    </div>

    <section className="rio-grid">
      {visible.map((item) => <Card key={item.id} className={`rio-card ${item.status.startsWith('approved') ? 'is-approved' : ''}`}>
        <div className="rio-card-head"><span>{item.section ?? 'Sistema'}</span><Badge tone={statusTone(item)}>{item.status.replaceAll('_', ' ')}</Badge></div>
        <h2>{item.title}</h2>
        <p className="rio-explanation">{item.plainExplanation ?? item.summary}</p>
        {item.aliases?.length ? <div className="rio-aliases">{item.aliases.map((alias) => <span key={alias}>{alias}</span>)}</div> : null}
        <dl>
          <Definition label="Activación propuesta" value={item.activation} />
          <Definition label="Efecto" value={item.effect} />
          <Definition label="Precio" value={item.price} />
          <Definition label="Límite duro" value={item.hardLimits} />
          <Definition label="Contrarresta" value={item.counterTo} />
          <Definition label="Respuesta enemiga" value={item.enemyCounter} />
          <Definition label="Evolución" value={item.evolution} />
        </dl>
      </Card>)}
    </section>

    <Card className="rio-pending"><div><Activity size={18} /><div><p className="eyebrow">Autoridad pendiente</p><h2>Decisiones antes de canonizar facultades</h2></div></div><ol>{catalog.pendingDecisions.map((decision) => <li key={decision}>{decision.replace(/^\d+\.\s*/, '')}</li>)}</ol></Card>
    <footer className="rio-footer"><Waves size={17} /><span>RÍO está disponible para consulta y evaluación. Su presencia aquí no convierte las facultades en canon.</span></footer>
  </div>
}
