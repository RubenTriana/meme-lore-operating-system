# Fuentes e inventario inicial

## Canon y narrativa

- `data/universe_master.json`: canon activo v0.9.0; 14 módulos, 228 entidades, 96 eventos.
- `data/updates/universe_master_0.9.0_operacion_tantalo.json`: copia idéntica del canon activo.
- `data/updates/universe_master-007.json`: versión 0.8.1 pese a su nombre.
- Diez copias `data/universe_master.backup-*.json`: estados históricos recuperables.
- Nueve patches narrativos, dos masters de actualización y un manifiesto de propuesta en `data/updates/`.

## Sistema técnico reutilizado

- Aplicación React/TypeScript, esquema JSON y cargador/migraciones.
- Motores deterministas de continuidad, causalidad, conocimiento, conexiones y plausibilidad.
- Flujo de propuestas en cuarentena, snapshots, anotaciones e índices derivados reconstruibles.
- 33 archivos de prueba con 170 casos; documentación técnica y autoral en `docs/`.

## Manuscrito y voz

No se hallaron capítulos, escenas ni muestras de prosa del autor. Por tanto, no existe base para declarar un perfil de voz ni para revisar el capítulo 1.

## Clasificación

- **Canon confirmado:** JSON activo y hechos expresamente confirmados en el encargo.
- **Propuestas:** `data/updates/*.patch.json` y documentos de promoción.
- **Histórico:** respaldos, fixtures y reportes de fases anteriores.
- **Derivado:** `data/derived/`, diagnósticos, benchmarks y métricas.
- **Descartado:** rama Rey Amarillo/Carcosa según changelog.
- **Pendiente:** equivalencia de títulos, Veyra, Palimpsesto y Vacuna.

