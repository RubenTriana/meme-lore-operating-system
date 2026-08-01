# Phase 6 completion

## Status

- Closed: 2026-07-14.
- Branch: `version-2-experimental`.
- Previous base commit: `6658560d82293216545f76a20d43b5fa5eff4f09` (`chore: establish MEME Lore OS baseline`).
- Current schema: `3.5.0`; migrations are ordered through `005-add-causality-knowledge-rule-vocabulary`.
- Versions: derived analysis `0.3.0`; continuity `1.1.0`; causality `1.0.0`; knowledge `1.0.0`.
- Canon identity: `hashCanonical` produces a stable FNV-1a 64-bit source hash from the normalized universe. The verified `analysis:build` result was `fnv1a64-e020c17d2e15924d`; `generatedAt` is metadata and is not part of this identity.

## Completed capabilities

- Pure analytical core and normalized derived indexes: entity, relation graph, timeline, knowledge, and dependency indexes.
- Atomic Node build to ignored `data/derived/` artifacts; the canonical source is never replaced.
- Versioned Worker protocol, progress, cancellation, typed errors, and a browser service API.
- IndexedDB cache with an in-memory fallback, keyed by source hash, schema version, and analysis-engine version.
- Conservative incremental planning from stable entity and impact hashes, with full rebuild fallbacks.
- Continuity diagnostics, the `/analysis` diagnostics center, browser-local author annotations, causal diagnostics, and knowledge diagnostics.

## Available rules

### Continuity

- `character-dead-acting`
- `incompatible-simultaneous-locations`
- `incompatible-age`
- `effect-before-cause`

### Causality

- `missing-cause-reference`
- `effect-before-cause`
- `undeclared-causal-cycle`
- `important-event-without-cause`
- `declared-cause-without-consequence`
- `broken-causal-chain`

### Knowledge

- `knowledge-used-before-learning`
- `remembered-after-forgetting`
- `revelation-received-after-acting`
- `knowledge-attributed-to-missing-character`
- `temporally-ambiguous-knowledge-change`

Each issue has a deterministic ID based on engine, rule, ordered entities, and ordered sources; it also records evidence, confidence, source hash, and engine version. When continuity and causality are both enabled, the shared `effect-before-cause` diagnosis is emitted once by continuity to avoid duplicate review work.

## Verification

- `npx tsc -b --pretty false`: passed. The repository has no dedicated `typecheck` script.
- Directed `npm test -- --run ...`: 45 tests in migrations, schema/Zod, derived indexes, Worker/cache/incrementality, continuity, causality/knowledge, and diagnostics center passed.
- `npm test`: 48 tests passed in 9 files.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run analysis:build`: passed and wrote six ignored derived files.
- No integration or end-to-end script is configured in `package.json`.
- No pre-existing failures were observed in these checks.

Known limits: only structured fields are evaluated; free prose is not interpreted. Structural broken references normally stop validation before regular compilation. `important-event-without-cause` uses the fixed deterministic threshold `importance >= 80`. Causal and knowledge rules deliberately prefer insufficient data over inference.

## Author boundary

- `data/universe_master.json` was checked and has no working-tree modification; migrations, Worker, cache, diagnostics, tests, and `analysis:build` do not write it.
- Derived artifacts remain rebuildable and ignored by Git under `data/derived/`.
- Issues are diagnostics, not corrections. `open`, `confirmed`, `intentional`, `ignored`, and `resolved` annotations plus optional notes are stored separately in browser `localStorage` under `meme-los-analysis-annotations-v1` and are reviewed when their evidence changes.
- AI is not part of the analytical core.
