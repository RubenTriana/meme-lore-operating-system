# Derived data, Worker, and cache

## Rebuild artifacts

```bash
npm run analysis:build
```

This validates and migrates canon, then writes `entity-index.json`, `relation-graph.json`, `timeline-index.json`, `knowledge-index.json`, `dependency-index.json`, and `manifest.json` under ignored `data/derived/`. Each file carries the same source hash, schema version, and engine version. The build verifies that the set is complete and identities match the manifest.

Derived files never replace canon. If validation fails, the previous valid result is preserved. Delete `data/derived/` safely and rerun the command whenever reconstruction is needed.

## Browser cache

IndexedDB database `meme-lore-analysis` stores snapshots under a key containing source hash, schema version, and engine version. Damaged or incompatible entries are discarded and recompiled. Use **Limpiar caché** in `/analysis`, or call `clearAnalysisCache()` through the analysis service. Clearing cache does not affect canon or author annotations.

## Worker behavior

The Worker protocol is versioned. Compilation reports progress and supports cancellation. Interrupted Workers reject pending work; cancelled or failed builds return no partial snapshot. Heavy graph work remains outside React's rendering thread.

## Export diagnostics

After analysis, select **Exportar diagnósticos**. The JSON contains format version, export time, derived identity metadata, issues, and only annotations associated with those issues. It does not contain or modify the complete canon.

## Synthetic benchmark

```bash
npm run analysis:benchmark
```

The seed-42 generator creates exact 1,000, 5,000, and 10,000-entity universes with proportional events and relations. Current measured results are in `docs/analysis-benchmarks.md`.
