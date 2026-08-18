# Architecture

```
data/universe_master.json  ->  migrations  ->  Zod validation  ->  semantic index
                                                              ->  renderers / pages
                                                              ->  search / graphs / insights
```

`src/services/universe-loader.ts` owns ingestion. It first runs ordered migrations, then Zod plus referential validation. A failed parse never reaches a renderer.

`src/utils/semantic-index.ts` builds entity, reference, backlink, tag, and owning-module maps from the validated universe. It has no React dependency, making it safe for workers or future AI tooling.

`src/renderer/registry.tsx` maps the `renderer` metadata field to presentational components. Unregistered modules still receive the generic renderer, so new data never breaks navigation.

System pages are intentionally limited to workflow functions: overview, insights, changelog/snapshots, settings, and developer diagnostics. Every universe page is module-driven.
## Canon 0.8.0: tetralogy-aware presentation

The canonical source remains `data/universe_master.json`. Narrative ownership is declared with `novelRef`, `novelRefs`, or `primaryNovelRef`; saga-wide entities remain unassigned and are presented as transversal. Timeline events use `sequence` as their stable relative order and `causedByRefs` as the canonical predecessor field.

The UI derives a single four-novel navigator from the `franchise-entry` entities. Timeline, character, mystery, knowledge, faction, economy, company, symbol, and relationship views reuse that derived mapping rather than maintaining parallel lists. The full chronology is rendered as five independent lines: prehistory plus one line for each novel.
