# MEME Lore Operating System

MEME LOS is a local-first TypeScript application for maintaining a canonical narrative universe and compiling deterministic, auditable analysis from it. The author remains the only canonical authority; analysis, caches, simulations, annotations, and extraction proposals are derived or local data.

## Start and verify

```bash
npm install
npm run dev
```

Release gates:

```bash
npx tsc -b --pretty false
npm run lint
npm test
npm run build
npm run analysis:build
npm run analysis:benchmark
```

## Analysis workflow

1. Load and validate `data/universe_master.json`.
2. Enable only the required engines in `analysisConfig`.
3. Open `/analysis` and select **Analizar universo**.
4. Review evidence and classify issues locally; no automatic correction exists.
5. Export diagnostics when a review artifact is needed.

The available deterministic capabilities are continuity, causality, knowledge reconstruction, connection metrics, and author-supplied Narrative Plausibility Score hypotheses. Optional assisted extraction is disabled by default and currently has only a local mock provider.

## Canon boundary

Canonical data:

- `data/universe_master.json` and an explicitly approved, validated patch applied to it by the author.

Non-canonical data:

- `data/derived/`, Worker results, IndexedDB cache, browser annotations, plausibility profiles, metrics, diagnostics, benchmarks, and extraction proposals.

Derived files may be deleted and rebuilt. No engine writes directly to the canonical file.

## Documentation

- [Analysis architecture](docs/analysis-architecture.md)
- [Schema and migrations](docs/analysis-schema.md)
- [Rules and engines](docs/analysis-rules.md)
- [Derived data and cache](docs/derived-data.md)
- [Optional AI boundary](docs/ai-boundary.md)
- [Author workflow](docs/author-workflow.md)
- [Measured benchmarks](docs/analysis-benchmarks.md)
