# Narrative Analysis Audit — V2 Baseline

**Scope:** Phase 0 audit only. No application code, canonical data, schema, routes, or UI were changed.

## Baseline recorded

- Repository: `C:/Users/ruben/OneDrive/Documents/meme_LoreSystem_v2`
- Active branch: `version-2-experimental`; working tree was clean before this report.
- Package declarations: React `^19.1.0`, Vite `^6.3.5`, TypeScript `~5.8.3`. Resolved baseline after `npm ci`: React `19.2.7`, Vite `6.4.3`, TypeScript `5.8.3`.
- Canon: `data/universe_master.json`, schema `3.2.0`, 15 modules and 95 entities.
- No application test, type, lint, or build errors were found. Installation emitted third-party deprecation notices for `whatwg-encoding@3.1.1` and Recharts 2.x.

## Architecture map

```text
data/universe_master.json
  -> src/services/migrations (001, 002; current schema 3.2.0)
  -> src/schemas/universe (Zod + ID/reference validation)
  -> UniverseProvider / useUniverseModel
  -> React Router + renderers, search, graph, timeline, insights
  -> derived semantic index / deterministic insight rules
```

- `src/app/`: query-backed load lifecycle, canonical override/import boundary, router, and context.
- `src/types/universe.ts` and `src/schemas/universe.ts`: compatible TypeScript/Zod contracts; entities remain passthrough records with required global IDs.
- `src/services/`: migrations, loading/export, patches, and browser-local snapshots. `applyPatch` clones input; it is the only present path that can create an in-memory canonical override.
- `src/store/useStudioStore.ts`: persisted UI preferences only; it must not become canonical or diagnostic storage.
- `src/renderer/`, `src/graph/`, and `src/timeline/`: presentation consumers of validated canon and `SemanticIndex`.
- `src/utils/semantic-index.ts`: pure canonical-reference index. `src/utils/narrative-analysis.ts` already provides five deterministic advisory checks for the Insights UI.
- `src/workers/semantic.worker.ts`: a lightweight index-statistics worker boundary. No `new Worker` usage exists in `src/` or `tests/`, so it is not active in the current runtime flow.
- `src/plugins/`: read-only plugin registry/boundary; plugins own renderers and do not own canonical data.

## Current canonical load flow and safety boundaries

`loadUniverse` clones/migrates the imported or bundled JSON, then validates it before exposing `validation.data`. Invalid input is held behind `ValidationScreen`; no renderer receives it. `UniverseProvider` may hold an imported file or patched result in memory, while `reset` restores the bundled source. Browser-local snapshots, semantic indexes, graph nodes, searches, and insights are derived data and remain reconstructible.

Safe extension points are: pure functions adjacent to `semantic-index`, the existing worker protocol, `InsightsPage` as a read-only consumer, developer diagnostics, and the test suite. Future diagnostics must return plain serializable results with rule IDs, severity, affected entity IDs, and canonical evidence paths/values; they must never call `applyPatch`, `importPayload`, or write `universe_master.json`.

## Compatibility risks

- The schema currently requires global kebab-case entity IDs and validates only `refs`/`foreshadowing`; additive fields need Zod support, TypeScript types, migration coverage, and referential tests together.
- `UniverseEntity` is intentionally passthrough. This protects unknown canonical fields, but untyped analysis input must be narrowed before use.
- The existing `analyzeNarrative` output is deterministic but has no explicit evidence payload beyond `entityIds`; its declared categories include values not yet emitted. Future work should not silently reinterpret those categories.
- Renderer pages build the semantic index on render. Large-universe analysis must move work behind a worker boundary without changing current presentation behavior.
- `tsconfig.app.json` targets browser DOM APIs; `vite.config.ts` is the Node-side configuration. The existing tests run in Vitest/JSDOM. Shared analysis code cannot depend on `window`, `self`, `File`, `localStorage`, filesystem APIs, or React.
- `package.json` has no separate `typecheck` script; `tsc -b` is the baseline check and is already included in `npm run build`.

## Recommended analytical core (future phase only)

Create a pure `src/analysis/` boundary when a phase explicitly authorizes it: serializable diagnostic types, deterministic rule functions, an orchestration function, and evidence helpers. It should accept a validated `Universe` and return immutable, structured diagnostics; it must not mutate input or import UI/store modules.

Node tests should import this pure boundary directly. A later `src/workers/narrative-analysis.worker.ts` adapter can receive a structured-cloned `Universe`, invoke the same boundary, and post only serializable diagnostics. The UI would consume the worker result through a small adapter with a synchronous fallback only if an approved phase requires one. This shares rules without Node/browser divergence.

Keep schema `3.2.0` for derived diagnostics. Recommend `3.3.0` only when an approved additive canonical input field is required; include a forward migration from `3.2.0`, retain all fields, and test both the migrated and current documents. Rule configuration that is purely derived should remain outside the canonical schema.

## Reusable verification and existing dependencies

- Reuse `universe.schema.test.ts` for canonical validity and broken references, `migrations.test.ts` for migration chains, `patches.test.ts` for in-memory patch safety, and `semantic-index.test.ts` for bidirectional references/search.
- Available scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `lint`, and `format`.
- Do not duplicate existing capabilities: Zod validation, Zustand persistence, TanStack Query lifecycle, React Router navigation, React Flow graph rendering, Recharts, Framer Motion, or Vitest/JSDOM. Phase 1 analysis can be implemented with TypeScript and the installed toolchain alone.

## Baseline command results

| Check | Result |
| --- | --- |
| `tsc -b` | Passed |
| Directed Vitest run | 4 files, 6 tests passed |
| `npm run test` | 4 files, 6 tests passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; production bundle generated |
