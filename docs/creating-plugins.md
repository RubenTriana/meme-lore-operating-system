# Creating plugins

Plugins extend the shell without editing its internals. A plugin can register renderers and optionally declare module ownership.

```ts
import { registerPlugin } from '@/plugins/registry'
import { registerRenderer } from '@/renderer/registry'

registerPlugin({
  id: 'magic-system',
  name: 'Magic System',
  version: '1.0.0',
  description: 'Ritual and magical-rule tooling.',
  modules: ['magic'],
})
registerRenderer('magic', MagicRenderer)
```

Plugins should not mutate the master universe at import time. They can interpret modules and offer optional panels; canonical edits arrive through complete imports or patches.
