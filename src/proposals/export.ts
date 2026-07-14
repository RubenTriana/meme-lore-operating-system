import type { ProposalRecord } from './types'

function blob(value: unknown, type = 'application/json'): Blob {
  return new Blob([typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`], { type })
}

export function proposalPatchBlob(proposal: ProposalRecord): Blob {
  return blob(proposal.patch ?? { operations: [] })
}

export function proposalCandidateBlob(proposal: ProposalRecord): Blob | undefined {
  return proposal.simulation ? blob(proposal.simulation.candidateUniverse) : undefined
}

export function proposalManifest(proposal: ProposalRecord): Record<string, unknown> {
  return {
    formatVersion: '1',
    proposalId: proposal.id,
    fileName: proposal.fileName,
    baseHash: proposal.baseUniverseHash,
    candidateHash: proposal.simulation?.candidateHash,
    operations: proposal.operations,
    validation: proposal.validation,
    decision: proposal.decision,
    exportedAt: new Date().toISOString(),
    author: proposal.simulation?.candidateUniverse.metadata.author,
  }
}

export function proposalManifestBlob(proposal: ProposalRecord): Blob {
  return blob(proposalManifest(proposal))
}

export function proposalReportBlob(proposal: ProposalRecord): Blob {
  const comparison = proposal.simulation?.comparison
  const lines = [
    `# Promoción canónica — ${proposal.fileName}`,
    '',
    `- Propuesta: \`${proposal.id}\``,
    `- Estado: ${proposal.status}`,
    `- Hash base: \`${proposal.baseUniverseHash}\``,
    `- Hash candidato: \`${proposal.simulation?.candidateHash ?? 'sin simulación'}\``,
    `- Operaciones: ${proposal.operations}`,
    `- Seguridad estructural: ${proposal.validation.structuralSafety}`,
    `- Decisión: ${proposal.decision?.kind ?? 'pendiente'}`,
    '',
    '## Diff',
    '',
    `- Entidades añadidas: ${proposal.diff.addedEntityIds.length}`,
    `- Entidades modificadas: ${proposal.diff.modifiedEntityIds.length}`,
    `- Referencias añadidas: ${proposal.diff.referencesAdded}`,
    `- Eliminaciones: ${proposal.diff.removedEntityIds.length + proposal.diff.fieldsRemoved}`,
    '',
    '## Simulación',
    '',
    comparison ? `- Entidades: ${comparison.base.entities} → ${comparison.candidate.entities}` : '- No ejecutada',
    comparison ? `- Enlaces canónicos: ${comparison.base.canonicalLinks} → ${comparison.candidate.canonicalLinks}` : '',
    comparison ? `- Aristas derivadas: ${comparison.base.derivedEdges} → ${comparison.candidate.derivedEdges}` : '',
    comparison ? `- Nuevos issues: ${comparison.newIssueIds.length}` : '',
    '',
    'Este informe prepara una promoción para revisión y commit. No afirma que el archivo canónico haya sido escrito.',
  ].filter(Boolean)
  return blob(`${lines.join('\n')}\n`, 'text/markdown')
}
