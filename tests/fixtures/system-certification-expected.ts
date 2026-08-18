export type CertifiedClassification = 'metric' | 'observation' | 'issue' | 'insufficient-data'

export interface CertifiedExpectation {
  caseId: string
  title: string
  expected: string
  mustNotTrigger: string[]
  result: 'detected' | 'not-detected' | 'rejected' | 'fallback'
  severity?: 'info' | 'low' | 'medium' | 'high' | 'critical'
  classification: CertifiedClassification
  layer: 'narrative' | 'validation' | 'operational'
  evidence: string[]
}

export const certifiedExpectations: CertifiedExpectation[] = [
  { caseId: 'dead-character-acting', title: 'Personaje muerto actuando', expected: 'character-dead-acting', mustNotTrigger: ['incompatible-age'], result: 'detected', severity: 'high', classification: 'issue', layer: 'narrative', evidence: ['dead-original', 'dead-acts', 'continuity.life.death', 'temporal'] },
  { caseId: 'simultaneous-locations', title: 'Ubicaciones simultáneas incompatibles', expected: 'incompatible-simultaneous-locations', mustNotTrigger: ['character-dead-acting'], result: 'detected', severity: 'high', classification: 'issue', layer: 'narrative', evidence: ['traveler', 'north-presence', 'south-presence', 'locationRefs', 'temporal'] },
  { caseId: 'effect-before-cause', title: 'Efecto anterior a causa', expected: 'effect-before-cause', mustNotTrigger: ['undeclared-causal-cycle'], result: 'detected', severity: 'high', classification: 'issue', layer: 'narrative', evidence: ['late-cause', 'early-effect', 'causes', 'temporal'] },
  { caseId: 'knowledge-before-learning', title: 'Conocimiento usado antes de adquirirlo', expected: 'knowledge-used-before-learning', mustNotTrigger: ['remembered-after-forgetting'], result: 'detected', severity: 'high', classification: 'issue', layer: 'narrative', evidence: ['analyst', 'use-secret', 'learn-secret', 'requiredKnowledge', 'knowledgeChanges'] },
  { caseId: 'broken-reference', title: 'Referencia inexistente', expected: 'Broken cross-reference.', mustNotTrigger: ['analysis compilation'], result: 'rejected', classification: 'issue', layer: 'validation', evidence: ['broken-reference', 'absent-entity', 'refs'] },
  { caseId: 'isolated-node', title: 'Nodo aislado', expected: 'isolated-entity', mustNotTrigger: ['missing-required-reciprocity'], result: 'detected', classification: 'observation', layer: 'narrative', evidence: ['isolated-node', 'relationGraph'] },
  { caseId: 'disconnected-components', title: 'Componentes desconectados', expected: 'disconnected-component', mustNotTrigger: ['narrative contradiction'], result: 'detected', classification: 'observation', layer: 'narrative', evidence: ['component-a', 'component-b', 'relationGraph'] },
  { caseId: 'intentional-cycle', title: 'Ciclo causal intencional', expected: 'undeclared-causal-cycle', mustNotTrigger: ['undeclared-causal-cycle'], result: 'not-detected', classification: 'issue', layer: 'narrative', evidence: ['intentional-cycle-a', 'intentional-cycle-b', 'causal-loop'] },
  { caseId: 'permitted-flashback', title: 'Flashback permitido', expected: 'character-dead-acting', mustNotTrigger: ['character-dead-acting'], result: 'not-detected', classification: 'issue', layer: 'narrative', evidence: ['permitted-flashback', 'dead-original', 'flashback'] },
  { caseId: 'digital-copy', title: 'Copia digital distinta del original', expected: 'character-dead-acting', mustNotTrigger: ['character-dead-acting'], result: 'not-detected', classification: 'issue', layer: 'narrative', evidence: ['digital-copy', 'copy-acts', 'dead-original'] },
  { caseId: 'insufficient-data', title: 'Información insuficiente', expected: 'insufficient-data', mustNotTrigger: ['knowledge-used-before-learning'], result: 'detected', classification: 'insufficient-data', layer: 'narrative', evidence: ['undated-action', 'unknown-fact', 'temporal'] },
  { caseId: 'partial-plausibility', title: 'Plausibilidad con cobertura parcial', expected: 'coverage:30', mustNotTrigger: ['automatic hypothesis'], result: 'detected', classification: 'metric', layer: 'narrative', evidence: ['sparse-actor', 'analysis.goals', 'missingData'] },
  { caseId: 'valid-reciprocity', title: 'Relación recíproca correcta', expected: 'missing-required-reciprocity', mustNotTrigger: ['missing-required-reciprocity'], result: 'not-detected', classification: 'issue', layer: 'narrative', evidence: ['ally-a-b', 'ally-b-a', 'alliance'] },
  { caseId: 'missing-reciprocity', title: 'Reciprocidad requerida ausente', expected: 'missing-required-reciprocity', mustNotTrigger: ['isolated-entity'], result: 'detected', severity: 'medium', classification: 'issue', layer: 'narrative', evidence: ['ally-a-b', 'alliance'] },
  { caseId: 'partial-derived-artifacts', title: 'Artefactos derivados parciales', expected: 'invalid-artifact-set', mustNotTrigger: ['canon deletion'], result: 'rejected', classification: 'issue', layer: 'operational', evidence: ['manifest.json', 'entity-index.json'] },
  { caseId: 'incompatible-cache', title: 'Caché incompatible', expected: 'full-recompile', mustNotTrigger: ['stale cache reuse'], result: 'fallback', classification: 'issue', layer: 'operational', evidence: ['engineVersion', 'schemaVersion', 'sourceHash'] },
]
