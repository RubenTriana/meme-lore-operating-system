# MEME Lore Operating System

MEME LOS is a data-driven operating system for a long-lived narrative franchise. It renders the complete workspace from one canonical file: [`data/universe_master.json`](data/universe_master.json).

## Quick start

```bash
npm install
npm run dev
```

Quality gates:

```bash
npm run lint
npm run test
npm run build
```

## Core guarantees

- **One canonical source** — UI content comes from `universe_master.json`; components contain no canonical entities or story values.
- **Metadata-first navigation** — module `icon`, `order`, `visibility`, and `renderer` decide where and how a section appears.
- **Safe ingestion** — Zod validates every loaded file and isolates invalid canon behind a diagnostic screen.
- **Cross-reference index** — entities use global IDs and `refs`; the index powers semantic search, the relationship graph, and analysis.
- **Evolution path** — versioning, migrations, partial patches, browser-local snapshots, exports, plugins, and renderer registration are built into the foundation.

## Data model

Every canonical entity is stored under a module's `content.items` array and has at minimum `id`, `type`, and `title`. IDs are global lowercase kebab-case identifiers. Relationships are expressed only with IDs:

```json
{
  "id": "meme-iris",
  "type": "character",
  "title": "Iris Vale",
  "refs": ["meme-nocturne", "meme-market"]
}
```

See the focused guides in [`docs/`](docs/architecture.md).
