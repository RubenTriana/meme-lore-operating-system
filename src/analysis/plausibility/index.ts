import type { Universe, UniverseEntity } from '@/types/universe'

export const PLAUSIBILITY_ENGINE_VERSION = '1.0.0'
export const PLAUSIBILITY_WARNING = 'Evaluación estructural orientativa. No es una predicción, una probabilidad científica ni sustituye el juicio creativo del autor.'

export type PlausibilityFactorId = 'goalAlignment' | 'beliefAlignment' | 'externalPressure' | 'fearAlignment' | 'precedents' | 'foreshadowing'

export interface NarrativeHypothesis {
  id: string
  actorRef: string
  action: string
  targetRef?: string
  contextEventRef?: string
}

export type PlausibilityWeights = Record<PlausibilityFactorId, number>

export interface PlausibilityProfile {
  id: string
  name: string
  weights: PlausibilityWeights
}

export interface PlausibilityEvidence {
  sourceId: string
  field: string
  value: string
  matchedTerms: string[]
}

export interface PlausibilityFactorResult {
  id: PlausibilityFactorId
  label: string
  weight: number
  available: boolean
  score?: number
  weightedContribution: number
  evidence: PlausibilityEvidence[]
  explanation: string
}

export interface PlausibilitySensitivity {
  factorId: PlausibilityFactorId
  adjustedWeight: number
  score?: number
  delta?: number
}

export interface NarrativePlausibilityResult {
  engine: 'plausibility'
  engineVersion: string
  hypothesis: NarrativeHypothesis
  profile: PlausibilityProfile
  score?: number
  coverage: number
  factors: PlausibilityFactorResult[]
  evidence: PlausibilityEvidence[]
  missingData: string[]
  sensitivity: PlausibilitySensitivity[]
  explanation: string
  warning: string
}

export interface PlausibilityValidation { valid: boolean; errors: string[] }

export const DEFAULT_PLAUSIBILITY_PROFILE: PlausibilityProfile = {
  id: 'default-structural',
  name: 'Perfil estructural predeterminado',
  weights: { goalAlignment: 30, beliefAlignment: 20, externalPressure: 15, fearAlignment: 15, precedents: 10, foreshadowing: 10 },
}

const FACTOR_ORDER: PlausibilityFactorId[] = ['goalAlignment', 'beliefAlignment', 'externalPressure', 'fearAlignment', 'precedents', 'foreshadowing']
const FACTOR_LABELS: Record<PlausibilityFactorId, string> = {
  goalAlignment: 'Alineación con objetivo', beliefAlignment: 'Alineación con creencias', externalPressure: 'Presión externa', fearAlignment: 'Alineación con miedo', precedents: 'Precedentes', foreshadowing: 'Preparación o foreshadowing',
}
const MISSING_LABELS: Record<PlausibilityFactorId, string> = {
  goalAlignment: 'El actor no tiene objetivos estructurados.', beliefAlignment: 'El actor no tiene creencias estructuradas.', externalPressure: 'No hay restricciones o presión contextual estructurada.', fearAlignment: 'El actor no tiene miedos estructurados.', precedents: 'No hay eventos precedentes declarados para el actor.', foreshadowing: 'No hay preparación o foreshadowing estructurado relacionado.',
}
const STOP_WORDS = new Set(['a', 'al', 'and', 'ante', 'con', 'de', 'del', 'el', 'en', 'for', 'from', 'la', 'las', 'los', 'of', 'on', 'para', 'por', 'que', 'the', 'to', 'un', 'una', 'y'])

function round(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100 }
function allEntities(universe: Universe): UniverseEntity[] { return universe.modules.flatMap((module) => module.content.items ?? []) }
function cleanOptional(value: string | undefined): string | undefined { const cleaned = value?.trim(); return cleaned || undefined }
function tokens(value: string): string[] {
  return [...new Set(value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[a-z0-9]+/g)?.filter((token) => token.length > 1 && !STOP_WORDS.has(token)) ?? [])].sort()
}
function matchScore(queryTokens: string[], candidates: string[]): { score: number; matchedTerms: string[]; value: string } {
  let best = { score: 0, matchedTerms: [] as string[], value: '' }
  for (const value of [...candidates].sort()) {
    const candidateTokens = tokens(value)
    if (!candidateTokens.length) continue
    const matchedTerms = candidateTokens.filter((token) => queryTokens.includes(token))
    const score = round((matchedTerms.length / candidateTokens.length) * 100)
    if (score > best.score || (score === best.score && value.localeCompare(best.value) < 0)) best = { score, matchedTerms, value }
  }
  return best
}
function evidence(sourceId: string, field: string, match: ReturnType<typeof matchScore>): PlausibilityEvidence[] {
  return match.value ? [{ sourceId, field, value: match.value, matchedTerms: match.matchedTerms }] : []
}

export function validatePlausibilityProfile(profile: PlausibilityProfile): PlausibilityValidation {
  const errors: string[] = []
  if (!profile.id.trim()) errors.push('El perfil necesita un ID.')
  if (!profile.name.trim()) errors.push('El perfil necesita un nombre.')
  for (const factor of FACTOR_ORDER) {
    const weight = profile.weights[factor]
    if (!Number.isFinite(weight) || weight < 0 || weight > 100) errors.push(`El peso de ${FACTOR_LABELS[factor]} debe estar entre 0 y 100.`)
  }
  const total = FACTOR_ORDER.reduce((sum, factor) => sum + profile.weights[factor], 0)
  if (Math.abs(total - 100) > 0.0001) errors.push(`Los pesos deben sumar 100; actualmente suman ${round(total)}.`)
  return { valid: !errors.length, errors }
}

export function validateNarrativeHypothesis(universe: Universe, hypothesis: NarrativeHypothesis): PlausibilityValidation {
  const entities = new Map(allEntities(universe).map((entity) => [entity.id, entity]))
  const errors: string[] = []
  if (!hypothesis.id.trim()) errors.push('La hipótesis necesita un ID.')
  if (!hypothesis.action.trim()) errors.push('La hipótesis necesita una acción.')
  const actor = entities.get(hypothesis.actorRef)
  if (!actor) errors.push(`actorRef no existe: ${hypothesis.actorRef}`)
  else if (actor.type !== 'character') errors.push(`actorRef debe apuntar a un personaje: ${hypothesis.actorRef}`)
  if (hypothesis.targetRef && !entities.has(hypothesis.targetRef)) errors.push(`targetRef no existe: ${hypothesis.targetRef}`)
  if (hypothesis.contextEventRef) {
    const context = entities.get(hypothesis.contextEventRef)
    if (!context) errors.push(`contextEventRef no existe: ${hypothesis.contextEventRef}`)
    else if (context.type !== 'event') errors.push(`contextEventRef debe apuntar a un evento: ${hypothesis.contextEventRef}`)
  }
  return { valid: !errors.length, errors }
}

function makeFactor(id: PlausibilityFactorId, weight: number, available: boolean, score: number | undefined, factorEvidence: PlausibilityEvidence[], explanation: string): PlausibilityFactorResult {
  return { id, label: FACTOR_LABELS[id], weight, available, ...(score === undefined ? {} : { score }), weightedContribution: score === undefined ? 0 : round(weight * score / 100), evidence: factorEvidence, explanation }
}

function adjustedWeights(weights: PlausibilityWeights, factorId: PlausibilityFactorId): PlausibilityWeights {
  const increase = Math.min(5, 100 - weights[factorId])
  const otherTotal = 100 - weights[factorId]
  if (!increase || !otherTotal) return { ...weights }
  const next = { ...weights, [factorId]: weights[factorId] + increase }
  const others = FACTOR_ORDER.filter((factor) => factor !== factorId)
  let assigned = next[factorId]
  others.forEach((factor, index) => {
    const value = index === others.length - 1 ? 100 - assigned : round(weights[factor] - increase * (weights[factor] / otherTotal))
    next[factor] = Math.max(0, value); assigned += next[factor]
  })
  return next
}

function scoreFromFactors(factors: PlausibilityFactorResult[], weights: PlausibilityWeights): number | undefined {
  const available = factors.filter((factor) => factor.available && factor.score !== undefined)
  const availableWeight = available.reduce((sum, factor) => sum + weights[factor.id], 0)
  if (!availableWeight) return undefined
  return round(available.reduce((sum, factor) => sum + weights[factor.id] * factor.score!, 0) / availableWeight)
}

export function evaluateNarrativePlausibility(universe: Universe, input: NarrativeHypothesis, profile: PlausibilityProfile = DEFAULT_PLAUSIBILITY_PROFILE): NarrativePlausibilityResult {
  const targetRef = cleanOptional(input.targetRef)
  const contextEventRef = cleanOptional(input.contextEventRef)
  const hypothesis: NarrativeHypothesis = { id: input.id.trim(), actorRef: input.actorRef.trim(), action: input.action.trim(), ...(targetRef ? { targetRef } : {}), ...(contextEventRef ? { contextEventRef } : {}) }
  const errors = [...validatePlausibilityProfile(profile).errors, ...validateNarrativeHypothesis(universe, hypothesis).errors]
  if (errors.length) throw new Error(errors.join(' '))

  const entities = allEntities(universe)
  const byId = new Map(entities.map((entity) => [entity.id, entity]))
  const actor = byId.get(hypothesis.actorRef)!
  const target = hypothesis.targetRef ? byId.get(hypothesis.targetRef) : undefined
  const context = hypothesis.contextEventRef ? byId.get(hypothesis.contextEventRef) : undefined
  const queryTokens = tokens([hypothesis.action, target?.title ?? ''].join(' '))
  const factors: PlausibilityFactorResult[] = []

  const declaredFactors: Array<[PlausibilityFactorId, string, string[]]> = [
    ['goalAlignment', 'analysis.goals', actor.analysis?.goals ?? []],
    ['beliefAlignment', 'analysis.beliefs', actor.analysis?.beliefs ?? []],
    ['fearAlignment', 'analysis.fears', actor.analysis?.fears ?? []],
  ]
  for (const [id, field, values] of declaredFactors) {
    const match = matchScore(queryTokens, values)
    factors.push(makeFactor(id, profile.weights[id], Boolean(values.length), values.length ? match.score : undefined, evidence(actor.id, field, match), values.length ? `Coincidencia léxica declarada: ${match.matchedTerms.length ? match.matchedTerms.join(', ') : 'ninguna'}.` : MISSING_LABELS[id]))
  }

  const pressureValues = [...(actor.analysis?.constraints ?? []), ...(context?.analysis?.constraints ?? []), ...(context?.tags ?? [])]
  const pressureMatch = matchScore(queryTokens, pressureValues)
  factors.push(makeFactor('externalPressure', profile.weights.externalPressure, Boolean(pressureValues.length), pressureValues.length ? pressureMatch.score : undefined, evidence(context?.id ?? actor.id, context ? 'context.analysis.constraints/tags' : 'analysis.constraints', pressureMatch), pressureValues.length ? `La presión se contrasta con restricciones y etiquetas estructuradas; coincidencias: ${pressureMatch.matchedTerms.join(', ') || 'ninguna'}.` : MISSING_LABELS.externalPressure))

  const precedentEvents = entities.filter((entity) => entity.type === 'event' && entity.id !== context?.id && entity.participantRefs?.includes(actor.id)).sort((left, right) => left.id.localeCompare(right.id))
  let precedentBest = { score: 0, matchedTerms: [] as string[], value: '', sourceId: '' }
  for (const event of precedentEvents) {
    const match = matchScore(queryTokens, [event.title, event.summary ?? '', ...(event.tags ?? [])].filter(Boolean))
    if (match.score > precedentBest.score || (match.score === precedentBest.score && event.id.localeCompare(precedentBest.sourceId) < 0)) precedentBest = { ...match, sourceId: event.id }
  }
  factors.push(makeFactor('precedents', profile.weights.precedents, Boolean(precedentEvents.length), precedentEvents.length ? precedentBest.score : undefined, precedentBest.value ? evidence(precedentBest.sourceId, 'title/summary/tags', precedentBest) : [], precedentEvents.length ? `${precedentEvents.length} evento(s) previo(s) declarado(s) para el actor; mejor coincidencia: ${precedentBest.matchedTerms.join(', ') || 'ninguna'}.` : MISSING_LABELS.precedents))

  const relevantRefs = new Set([actor.id, hypothesis.targetRef, hypothesis.contextEventRef].filter((value): value is string => Boolean(value)))
  const foreshadowingSources = entities.filter((entity) => entity.foreshadowing?.some((reference) => relevantRefs.has(reference))).sort((left, right) => left.id.localeCompare(right.id))
  let foreshadowingBest = { score: 0, matchedTerms: [] as string[], value: '', sourceId: '' }
  for (const source of foreshadowingSources) {
    const match = matchScore(queryTokens, [source.title, source.summary ?? '', ...(source.tags ?? [])].filter(Boolean))
    const score = Math.max(50, match.score)
    if (score > foreshadowingBest.score || (score === foreshadowingBest.score && source.id.localeCompare(foreshadowingBest.sourceId) < 0)) foreshadowingBest = { ...match, score, sourceId: source.id }
  }
  const foreshadowingEvidence = foreshadowingSources.map((source) => ({ sourceId: source.id, field: 'foreshadowing', value: (source.foreshadowing ?? []).filter((reference) => relevantRefs.has(reference)).sort().join(', '), matchedTerms: source.id === foreshadowingBest.sourceId ? foreshadowingBest.matchedTerms : [] }))
  factors.push(makeFactor('foreshadowing', profile.weights.foreshadowing, Boolean(foreshadowingSources.length), foreshadowingSources.length ? foreshadowingBest.score : undefined, foreshadowingEvidence, foreshadowingSources.length ? `${foreshadowingSources.length} referencia(s) explícita(s) preparan al actor, objetivo o contexto.` : MISSING_LABELS.foreshadowing))

  factors.sort((left, right) => FACTOR_ORDER.indexOf(left.id) - FACTOR_ORDER.indexOf(right.id))
  const coverage = round(factors.filter((factor) => factor.available).reduce((sum, factor) => sum + factor.weight, 0))
  const score = scoreFromFactors(factors, profile.weights)
  const missingData = factors.filter((factor) => !factor.available).map((factor) => MISSING_LABELS[factor.id])
  const sensitivity = FACTOR_ORDER.map((factorId) => {
    const weights = adjustedWeights(profile.weights, factorId)
    const adjustedScore = scoreFromFactors(factors, weights)
    return { factorId, adjustedWeight: weights[factorId], ...(adjustedScore === undefined ? {} : { score: adjustedScore, delta: round(adjustedScore - (score ?? adjustedScore)) }) }
  })
  const explanation = score === undefined ? 'No hay datos estructurados suficientes para calcular un score. La ausencia de cobertura no implica baja plausibilidad.' : `Score ${score}/100 calculado como promedio ponderado de los factores disponibles (${coverage}% de cobertura). Los factores ausentes se excluyen del promedio y no cuentan como cero.`
  return { engine: 'plausibility', engineVersion: PLAUSIBILITY_ENGINE_VERSION, hypothesis, profile: { ...profile, weights: { ...profile.weights } }, ...(score === undefined ? {} : { score }), coverage, factors, evidence: factors.flatMap((factor) => factor.evidence), missingData, sensitivity, explanation, warning: PLAUSIBILITY_WARNING }
}
