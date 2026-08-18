import { FileSearch, Inbox, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { proposalsRoute } from '@/app/routes'
import { useUniverseModel } from '@/app/useUniverseModel'
import { Badge, Button, Card } from '@/components/ui'
import { proposalRepository } from '@/proposals/repository'
import type { ProposalRecord, ProposalStatus } from '@/proposals/types'
import { createProposal } from '@/proposals/workflow'

const statusTone = (status: ProposalStatus): 'neutral' | 'amber' | 'green' | 'blue' | 'red' => status === 'invalid' || status === 'rejected' ? 'red' : status === 'approved' || status === 'exported' ? 'green' : status === 'simulated' || status === 'applied-to-workspace' ? 'blue' : status === 'archived' ? 'neutral' : 'amber'

export function ProposalListPage() {
  const { baseUniverse } = useUniverseModel()
  const [proposals, setProposals] = useState<ProposalRecord[]>([])
  const [filter, setFilter] = useState<'all' | ProposalStatus>('all')
  const [error, setError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const refresh = async () => setProposals(await proposalRepository.list())
  useEffect(() => {
    let active = true
    void proposalRepository.list().then((records) => { if (active) setProposals(records) })
    return () => { active = false }
  }, [])
  const visible = useMemo(() => filter === 'all' ? proposals : proposals.filter((proposal) => proposal.status === filter), [filter, proposals])

  const importFile = async (file?: File) => {
    if (!file || !baseUniverse) return
    try {
      const proposal = createProposal(file.name, JSON.parse(await file.text()) as unknown, baseUniverse)
      await proposalRepository.put(proposal)
      await refresh()
      navigate(`${proposalsRoute}/${proposal.id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo importar la propuesta.')
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return <div className="proposal-page">
    <header className="module-hero"><div><p className="eyebrow">Cuarentena autoral</p><h1>Centro de propuestas</h1><p>Importa, valida, simula y compara cambios sin modificar el workspace activo ni el archivo canónico.</p></div><div className="analysis-actions"><input ref={input} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} /><Button onClick={() => input.current?.click()}><Upload size={16} /> Importar propuesta</Button></div></header>
    <Card className="analysis-help-card"><Inbox size={18} /><div><strong>Importar no significa aplicar</strong><p>Los patches quedan en IndexedDB. Solo una simulación aprobada puede abrirse temporalmente como candidato o exportarse para promoción.</p></div></Card>
    {error && <Card role="alert" className="analysis-runtime-card"><p className="analysis-error">{error}</p></Card>}
    <Card className="proposal-filter-bar"><label>Estado<select aria-label="Filtrar propuestas por estado" value={filter} onChange={(event) => setFilter(event.target.value as 'all' | ProposalStatus)}><option value="all">Todos</option>{['imported', 'invalid', 'validated', 'simulated', 'approved', 'rejected', 'archived', 'exported', 'applied-to-workspace'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label><span>{visible.length} propuestas</span></Card>
    <section className="proposal-grid">{visible.map((proposal) => <Card key={proposal.id} className="proposal-card"><div className="card-heading"><Badge tone={statusTone(proposal.status)}>{proposal.status}</Badge><span>{proposal.operations} ops</span></div><h2>{proposal.fileName}</h2><p><code>{proposal.fileHash}</code></p><dl><div><dt>Seguridad</dt><dd>{proposal.validation.structuralSafety}</dd></div><div><dt>Entidades nuevas</dt><dd>{proposal.diff.addedEntityIds.length}</dd></div><div><dt>Modificadas</dt><dd>{proposal.diff.modifiedEntityIds.length}</dd></div></dl><Link className="button button-secondary" to={`${proposalsRoute}/${proposal.id}`}><FileSearch size={15} /> Revisar propuesta</Link></Card>)}</section>
    {!visible.length && <Card className="analysis-empty-state"><Inbox size={28} /><h2>Sin propuestas</h2><p>Importa un patch para iniciar una revisión aislada.</p></Card>}
  </div>
}
