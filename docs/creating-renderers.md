# Creating renderers

Create a React component that accepts `RendererProps`, then register it during application bootstrap:

```tsx
import { registerRenderer } from '@/renderer/registry'
import { ReligionRenderer } from './ReligionRenderer'

registerRenderer('religions', ReligionRenderer)
```

Set `"renderer": "religions"` in the module metadata. Rendering must derive items from `module.content`; do not add canonical fixtures to the component. If a renderer is unavailable, the generic renderer is deliberately used as a safe fallback.
