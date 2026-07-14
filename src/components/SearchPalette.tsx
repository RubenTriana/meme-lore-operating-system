import { Command, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUniverseModel } from '@/app/useUniverseModel'
import { searchUniverse } from '@/utils/semantic-index'
import { useStudioStore } from '@/store/useStudioStore'

export function SearchPalette() {
  const [term, setTerm] = useState('')
  const navigate = useNavigate()
  const { universe } = useUniverseModel()
  const { searchOpen, setSearchOpen, setSelectedEntity } = useStudioStore()
  const results = useMemo(() => universe ? searchUniverse(universe, term).slice(0, 8) : [], [universe, term])
  if (!searchOpen) return null
  const select = (id: string) => { const module = universe?.modules.find((candidate) => candidate.content.items?.some((entity) => entity.id === id)); setSelectedEntity(id); setSearchOpen(false); if (module) navigate(`/module/${module.id}`) }
  return <div className="palette-backdrop" onMouseDown={() => setSearchOpen(false)}><div className="palette" onMouseDown={(event) => event.stopPropagation()}><div className="palette-search"><Search size={18} /><input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Search characters, events, symbols, notes..." /><button onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={18} /></button></div><div className="palette-results">{term && results.map((result) => <button key={result.id} onClick={() => select(result.id)}><span className="result-type">{result.type}</span><strong>{result.title}</strong><small>{result.summary}</small></button>)}{term && !results.length && <p>No canonical result for “{term}”.</p>}{!term && <p><Command size={15} /> Start typing to search the semantic index.</p>}</div></div></div>
}
