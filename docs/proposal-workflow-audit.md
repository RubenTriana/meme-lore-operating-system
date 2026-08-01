# Auditoría del flujo de propuestas — Fase 12

## Flujo actual

- El selector de archivos está en `SettingsPage`; lee texto, ejecuta `JSON.parse` y llama `importPayload`.
- `UniverseProvider.importPayload` distingue un patch por la presencia de `operations`.
- Un patch se aplica inmediatamente con `applyPatch` sobre `active.validation.data`, se agrega un changelog temporal y el resultado pasa a `override`.
- El override vive únicamente en estado React. No se persiste en LocalStorage ni IndexedDB y nunca escribe `data/universe_master.json`.
- `Restore bundled universe` elimina el override y vuelve al JSON empaquetado.
- Un master completo también sustituye el workspace sin confirmación específica.
- La exportación JSON serializa el universo activo del navegador; Markdown y CSV hacen lo mismo en formatos reducidos.
- Los snapshots se guardan separados del canon en LocalStorage bajo `meme-los-snapshots`.
- Las anotaciones analíticas y preferencias también son locales y separadas; la caché analítica usa IndexedDB.
- `/analysis` y `/analysis/connections` bloquean la ejecución cuando `analysisConfig` está desactivado, aunque el Worker puede compilar cualquier copia que reciba.

## Respuestas de alto impacto

1. La importación de patch sí muta inmediatamente el estado global visible del workspace, pero no el archivo fuente.
2. El universo importado solo permanece en memoria React; se pierde al recargar o restaurar.
3. El Worker puede analizar un candidato aislado si recibe una copia con configuración temporal de motores; no necesita cambiar el canon.
4. La restauración segura consiste en conservar una base inmutable separada del candidato y retirar únicamente el override candidato.
5. La interfaz actual mezcla versión del canon y esquema migrado; no expone de forma conjunta versión de app, canon, esquema, motor, hash y estado del workspace.

## Puntos de extensión seguros

- Reutilizar `applyPatch`, `loadUniverse`, Zod, validación referencial, hashing, Worker, `AnalysisService`, snapshots y exportadores.
- Crear un repositorio IndexedDB independiente para propuestas y simulaciones.
- Mantener en `UniverseProvider` dos estados explícitos: universo base y candidato temporal.
- Poner patches en cuarentena desde Settings y desde la extracción asistida.
- Ejecutar comparación y análisis sobre copias, nunca sobre el store activo.

## Métrica del patch de aceptación

La medición real distingue dos capas: enlaces semánticos simples del dashboard, 304 → 357; aristas completas del índice derivado, 343 → 396. El candidato tiene 105 entidades, 8 nodos aislados y 9 componentes. La interfaz debe nombrar ambas métricas para evitar confundirlas.
