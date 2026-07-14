import { createSemanticIndex } from '@/utils/semantic-index'
import type { Universe } from '@/types/universe'

/** Lightweight worker boundary for moving index statistics off the main thread at franchise scale. */
self.onmessage = (event: MessageEvent<Universe>) => {
  const index = createSemanticIndex(event.data)
  const edgeCount = [...index.references.values()].reduce((total, refs) => total + refs.length, 0)
  self.postMessage({ entities: index.entities.size, tags: index.tags.size, edges: edgeCount })
}
