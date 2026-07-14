# Updating the schema

1. Add an ordered migration in `src/services/migrations/`.
2. Register it in `src/services/migrations/index.ts`.
3. Advance `CURRENT_SCHEMA_VERSION` and the JSON schema / Zod schema together.
4. Add migration fixtures and tests.
5. Append a canonical changelog record when a story-facing source update ships.

Migrations are pure transformations. They must accept the previous version, return a new object, and never edit files in place.

## Partial updates

Patch files use operations and are applied in Settings. Paths may address arrays by canonical ID:

```json
{
  "operations": [
    { "op": "replace", "path": "/modules/characters/content/items/meme-iris/development", "value": 95 }
  ]
}
```
