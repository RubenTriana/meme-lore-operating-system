# Updating the schema

1. Add an ordered migration in `src/services/migrations/`.
2. Register it in `src/services/migrations/index.ts`.
3. Advance `CURRENT_SCHEMA_VERSION` and the JSON schema / Zod schema together.
4. Add migration fixtures and tests.
5. Append a canonical changelog record when a story-facing source update ships.

Migrations are pure transformations. They must accept the previous version, return a new object, and never edit files in place.

## Schema 3.5.0

Migration `005-add-causality-knowledge-rule-vocabulary` upgrades `3.4.0` documents without adding entity data. It permits structured causal-loop exceptions and rule references used by the causal and knowledge engines; existing canon, IDs, and content are preserved unchanged.

## Schema 3.4.0

Migration `004-add-continuity-contract` upgrades `3.3.0` documents without adding entity data. It enables optional `continuity.life` birth/death facts, event-local age assertions, and structured exceptions. Existing canon and identifiers are preserved unchanged.

## Schema 3.3.0

Migration `003-add-analysis-contract` upgrades `3.2.0` documents by adding only `analysisConfig` with every engine disabled. It does not add `analysis`, temporal, causal, spatial, cognitive, or state fields to entities. Those fields remain optional, so legacy canon loads unchanged apart from the derived schema configuration.

New temporal values use `exact`, `day`, `month`, `year`, `relative`, or `unknown` precision. Comparable intervals must not end before they start; cross-entity references in the new event fields must resolve to existing canonical IDs.

## Partial updates

Patch files use operations and are applied in Settings. Paths may address arrays by canonical ID:

```json
{
  "operations": [
    { "op": "replace", "path": "/modules/characters/content/items/meme-iris/development", "value": 95 }
  ]
}
```
