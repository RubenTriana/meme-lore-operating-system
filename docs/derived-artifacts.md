# Derived narrative artifacts

`npm run analysis:build` migrates and validates `data/universe_master.json`, then writes reconstructible artifacts to `data/derived/`:

- `entity-index.json`
- `relation-graph.json`
- `timeline-index.json`
- `knowledge-index.json`
- `dependency-index.json`
- `manifest.json`

Every artifact carries the canonical `sourceHash`, schema version, engine version, and generation timestamp. The hash is produced from normalized canon only; `generatedAt` never contributes to it. `data/derived/` is ignored by Git and may be deleted and rebuilt at any time.

The compiler validates before it creates or replaces output. Files are written through same-directory temporary files and renamed atomically, so a failed validation leaves the last valid derived result intact.
