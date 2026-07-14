# Creating a module

Add a record to `modules` in `data/universe_master.json`:

```json
{
  "id": "religions",
  "title": "Religions",
  "type": "world",
  "icon": "Landmark",
  "order": 95,
  "visibility": "navigation",
  "renderer": "knowledge",
  "description": "Faiths and cosmologies.",
  "content": { "items": [] }
}
```

The section appears automatically in navigation. Use `knowledge` for the generic card renderer or register a dedicated renderer as described in `creating-renderers.md`. Never duplicate entity content outside the master file.
