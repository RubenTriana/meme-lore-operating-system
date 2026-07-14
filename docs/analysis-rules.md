# Analysis rules

Rules return an issue, no issue, or insufficient data. Absence of structured information is never treated as a contradiction. Every issue has a deterministic ID, engine/rule version, severity, confidence, entity/source IDs, canonical evidence, and source hash.

## Registered deterministic behavior

- Continuity: dead character acting, incompatible simultaneous locations, incompatible age, and effect before cause.
- Causality: missing cause reference, cause after effect, undeclared causal cycle, important event without cause, cause without consequence, and broken chain.
- Knowledge: use before learning, remembering after forgetting, revelation after action, missing character attribution, and ambiguous temporal change.
- Connections: topology and centrality metrics, shortest paths, cycles, density, bounded neighborhoods, observations, and required-reciprocity issues. Isolation is an observation, not automatically an error.
- Plausibility: an author-supplied hypothesis receives a structural score and separate data coverage. It is not a probability or prediction.

Only structured fields are evaluated. Free prose, distance, intent, semantic equivalence, and missing chronology are not inferred.

## Adding a rule

1. Give it a stable kebab-case `ruleId` and engine version.
2. Implement the existing rule contract in the relevant engine directory.
3. Return insufficient data when required fields cannot be ordered or resolved.
4. Use `createAnalysisIssue` for stable identity and sorted evidence.
5. Declare structured exceptions explicitly; do not search prose for exemptions.
6. Add fixtures for valid, contradiction, insufficient, intentional exception, stable ID, and duplicate suppression.
7. Add the explanation and limitation shown by the diagnostics center.

Changing rule semantics requires a rule or engine version change so caches and author decisions can be reviewed.
