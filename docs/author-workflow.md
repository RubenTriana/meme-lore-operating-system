# Author workflow

## Analyze canon

1. Keep confirmed narrative facts in `data/universe_master.json`.
2. Enable only desired engines in `analysisConfig`; migrated canon defaults to all engines off.
3. Run `npm run analysis:build` for filesystem artifacts or use **Analizar universo** at `/analysis` for Worker-backed diagnostics.
4. Review evidence before marking an issue `confirmed`, `intentional`, `ignored`, or `resolved`. Decisions and notes remain browser-local.
5. Export diagnostics when sharing a review record. Re-run when the UI marks evidence stale.

Use `/analysis/connections` for bounded neighborhoods and paths. Use `/analysis/plausibility` only for hypotheses you write yourself; low coverage means missing data, not low plausibility.

## Create fixtures

- Keep fixtures minimal and deterministic under `tests/fixtures/`.
- Include only entities needed for the behavior under test.
- Use globally unique kebab-case IDs and valid references.
- Test valid, invalid, insufficient, exception, deterministic ordering/ID, and no-duplicate cases.
- Use `generateSyntheticUniverse({ entityCount, seed })` only for scale and robustness tests, not canonical examples.

## Import assisted proposals

Enable the local preference in Settings, select only intended fragments, review outbound disclosure, and generate a proposal. Set every item to proposed, accepted, or rejected. Prepare and validate the patch, inspect before/after values, export it if desired, then use the explicit approval checkbox. The proposal itself is never saved as canon.

## Recover and clean

- **Limpiar caché** removes only analysis snapshots.
- Deleting `data/derived/` removes only reconstructible artifacts; rerun `npm run analysis:build`.
- Browser annotations and plausibility profiles are separate localStorage records.
- Invalid canon is isolated by the validation screen; restore a valid file instead of bypassing validation.

Canon is author-confirmed narrative data. Diagnostics, scores, observations, simulations, caches, source spans, proposals, annotations, and benchmark fixtures are not canon.
