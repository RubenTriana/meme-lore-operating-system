# Analysis schema

## Current version

The runtime schema is `3.5.0`. The bundled canon remains at `3.2.0` and is migrated in memory without changing narrative content or IDs. Migrations add only safe defaults; every analysis engine is disabled by default.

Root configuration:

```ts
analysisConfig?: {
  enabled: boolean
  engines: {
    continuity: boolean
    causality: boolean
    knowledge: boolean
    connections: boolean
    plausibility: boolean
  }
}
```

Entities may optionally declare `analysis`, `temporal`, locations, participants, causes, effects, knowledge changes, state changes, and structured continuity data. Missing optional information remains missing; migrations do not invent arrays, dates, motives, or narrative facts.

## Updating the schema

1. Make additions optional and backward compatible when possible.
2. Update `src/types/universe.ts` and `src/schemas/universe.ts` together.
3. Add one ordered, idempotent migration in `src/services/migrations/`.
4. Increment `CURRENT_SCHEMA_VERSION`; never infer the number from documentation.
5. Preserve unknown fields, entity IDs, narrative text, and existing arrays.
6. Update canonical and analytical fixtures without rewriting the bundled canon unnecessarily.
7. Test old input, current input, double migration, broken references, duplicates, and invalid temporal ranges.
8. Run all release gates and rebuild derived data.

`null` is not used for absent analytical fields. References must resolve globally and consistency-affecting arrays must not contain duplicates.
