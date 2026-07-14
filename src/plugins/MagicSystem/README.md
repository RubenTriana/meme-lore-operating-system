# Magic System plugin boundary

This folder illustrates the plugin boundary. A production plugin owns its renderer and registers a `LorePlugin` through `src/plugins/registry.ts`; it does not store canonical world data. Add the corresponding `magic` module to `universe_master.json` to activate it.
