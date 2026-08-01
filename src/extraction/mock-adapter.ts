import type { ExtractionProposal, NarrativeSource, ProposedEntity, ProposedEvent, ProposedRelation, ProposedRelationField, RegisteredNarrativeExtractionAdapter, SourceSpan } from './types'

const idPattern = /^[a-z][a-z0-9-]*$/
const relationFields = new Set<ProposedRelationField>(['refs', 'foreshadowing', 'causes', 'effects'])

function linesWithOffsets(text: string): Array<{ text: string; start: number; end: number }> {
  const lines: Array<{ text: string; start: number; end: number }> = []
  let start = 0
  text.split(/\r?\n/).forEach((line) => { lines.push({ text: line, start, end: start + line.length }); start += line.length + 1 })
  return lines
}

export class MockNarrativeExtractionAdapter implements RegisteredNarrativeExtractionAdapter {
  readonly descriptor = { id: 'mock-local-v1', label: 'Mock local explícito', transport: 'local' as const }

  async extract(input: NarrativeSource): Promise<ExtractionProposal> {
    const proposedEntities: ProposedEntity[] = []
    const proposedEvents: ProposedEvent[] = []
    const proposedRelations: ProposedRelation[] = []
    const warnings: string[] = []
    const sourceSpans: SourceSpan[] = []
    const proposalIds = new Set<string>()

    input.fragments.forEach((fragment) => linesWithOffsets(fragment.text).forEach((line, lineIndex) => {
      const raw = line.text.trim()
      if (!raw) return
      const parts = raw.split('|').map((part) => part.trim())
      const kind = parts[0]?.toUpperCase()
      const spanId = `span-${fragment.id}-${lineIndex + 1}`
      const addSpan = () => sourceSpans.push({ id: spanId, fragmentId: fragment.id, start: line.start, end: line.end, text: raw })
      if (kind === 'ENTITY') {
        const [, moduleId, entityId, type, title] = parts
        if (parts.length !== 5 || !idPattern.test(moduleId ?? '') || !idPattern.test(entityId ?? '') || !type || !title) { warnings.push(`${fragment.id}:${lineIndex + 1} ENTITY incompleta o inválida; no se propuso información.`); return }
        const proposalId = `entity-${entityId}`
        if (proposalIds.has(proposalId)) { warnings.push(`${fragment.id}:${lineIndex + 1} propuesta duplicada ${proposalId}; se omitió.`); return }
        proposalIds.add(proposalId); addSpan()
        proposedEntities.push({ proposalId, status: 'proposed', moduleId, entity: { id: entityId, type, title }, sourceSpanIds: [spanId] })
        return
      }
      if (kind === 'EVENT') {
        const [, moduleId, eventId, title] = parts
        if (parts.length !== 4 || !idPattern.test(moduleId ?? '') || !idPattern.test(eventId ?? '') || !title) { warnings.push(`${fragment.id}:${lineIndex + 1} EVENT incompleto o inválido; no se propuso información.`); return }
        const proposalId = `event-${eventId}`
        if (proposalIds.has(proposalId)) { warnings.push(`${fragment.id}:${lineIndex + 1} propuesta duplicada ${proposalId}; se omitió.`); return }
        proposalIds.add(proposalId); addSpan()
        proposedEvents.push({ proposalId, status: 'proposed', moduleId, event: { id: eventId, type: 'event', title }, sourceSpanIds: [spanId] })
        return
      }
      if (kind === 'RELATION') {
        const [, sourceRef, field, targetRef] = parts
        if (parts.length !== 4 || !idPattern.test(sourceRef ?? '') || !relationFields.has(field as ProposedRelationField) || !idPattern.test(targetRef ?? '')) { warnings.push(`${fragment.id}:${lineIndex + 1} RELATION incompleta o inválida; no se propuso información.`); return }
        const proposalId = `relation-${sourceRef}-${field}-${targetRef}`
        if (proposalIds.has(proposalId)) { warnings.push(`${fragment.id}:${lineIndex + 1} propuesta duplicada ${proposalId}; se omitió.`); return }
        proposalIds.add(proposalId); addSpan()
        proposedRelations.push({ proposalId, status: 'proposed', sourceRef, targetRef, field: field as ProposedRelationField, sourceSpanIds: [spanId] })
        return
      }
      warnings.push(`${fragment.id}:${lineIndex + 1} formato no reconocido; el mock no completó ni interpretó la línea.`)
    }))

    return { proposedEntities, proposedEvents, proposedRelations, warnings, sourceSpans }
  }
}
