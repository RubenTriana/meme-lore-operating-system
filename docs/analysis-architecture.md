# Analysis architecture

## Data flow

```text
universe_master.json or imported payload
  → ordered migrations
  → Zod plus referential validation
  → stable normalization and source hash
  → derived indexes
  → deterministic engines in a Web Worker
  → versioned IndexedDB cache
  → diagnostics, metrics and local author decisions
```

The pure core under `src/analysis/` has no React, browser storage, filesystem, or network dependency. It is reused by Node commands, Vitest, the Worker, and the application. `generatedAt` is trace metadata and never contributes to `sourceHash`.

## Boundaries

- Canon: `data/universe_master.json`, loaded through migrations and `validateUniverse`.
- Core: normalization, hashing, indexes, incremental planning, rules, graphs, and scoring.
- Worker: versioned compile/cancel/progress/error protocol.
- Services: cache, Worker client, diagnostic export, and browser-local annotations.
- UI: `/analysis`, `/analysis/connections`, `/analysis/plausibility`, and `/analysis/extraction`.
- Optional extraction: `src/extraction/`; it produces proposals and validated patches, never canon.

## Incremental compilation

Stable hashes are calculated per entity and per timeline/knowledge impact. Modified entities use `DependencyIndex` to identify affected indexes. Additions, removals, schema/engine mismatches, missing dependency metadata, or unsafe changes fall back to a full rebuild.

## Adding an engine

1. Add its serializable result contracts to `src/analysis/types.ts`.
2. Implement pure functions in a dedicated `src/analysis/<engine>/` directory.
3. Give the engine and every diagnostic stable versions and IDs.
4. Register it in `runEnabledAnalysis` and the root feature flags.
5. Update cache/engine versioning if snapshot behavior changes.
6. Add minimal valid, invalid, insufficient-data, exception, Worker, and UI tests.
7. Document rules and limitations before enabling it for existing canon.

Do not call `applyPatch`, storage, React, filesystem APIs, or remote services from an engine.
