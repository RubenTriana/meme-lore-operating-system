# Runtime de análisis local

La aplicación usa un Web Worker para compilar índices derivados fuera del hilo de React. El protocolo está versionado en `src/analysis/worker-protocol.ts`; los mensajes de progreso, finalización, cancelación y error llevan el mismo `requestId`.

`createAnalysisService()` expone `compileUniverse()`, `cancelCompilation()`, `getLatestSnapshot()` y `clearAnalysisCache()`. No actualiza el canon ni integra una pantalla: la UI o el store podrán consumir esta capa en una fase posterior.

Cuando `analysisConfig.enabled` y `analysisConfig.engines.continuity` están activos, el snapshot incluye los diagnósticos deterministas de continuidad. El canon actual permanece con el motor desactivado tras la migración.

Los snapshots derivados se guardan en IndexedDB cuando está disponible, con la clave `hash del canon + versión del esquema + versión del motor`. La caché contiene únicamente snapshots e índices derivados; nunca el canon. Si IndexedDB no está disponible o falla, se compila normalmente sin caché persistente.

La primera política incremental usa hashes estables por entidad. Altas, bajas, versiones incompatibles o información de dependencia incompleta realizan una compilación total. Para modificaciones, solo reutiliza los índices cuyo hash de impacto no cambió; la reconstrucción conservadora mantiene la corrección como prioridad.
