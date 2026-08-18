# Sistema Tántalo

**Laboratorio de creación y continuidad de *El Evangelio del Azar*.**

Este repositorio combina un entorno editorial persistente con MEME Lore Operating System. Rubén Darío Triana Valencia conserva la autoridad autoral; el sistema organiza, enseña, diagnostica y vigila continuidad sin escribir automáticamente la novela.

## Reanudar el trabajo narrativo

1. Leer [AGENTS.md](AGENTS.md), [ESTADO_DEL_PROYECTO.md](ESTADO_DEL_PROYECTO.md) y [PROXIMA_SESION.md](PROXIMA_SESION.md).
2. Invocar `$sistema-tantalo` o pedir en lenguaje natural continuar la novela, preparar un capítulo o revisar un fragmento.
3. Para el capítulo 1, completar primero `03_saga/novelas/01-operacion-tantalo/capitulos/capitulo-01/brief.md`.
4. Escribir exclusivamente el borrador del autor en `original.md`; candidatos y diagnósticos viven en archivos separados.
5. Verificar el sistema con `npm.cmd run validate:system`. La comprobación adicional en Python es opcional cuando ese runtime está instalado.

## Centro de Control Tántalo

Abre [`ABRIR_PANEL_TANTALO.bat`](ABRIR_PANEL_TANTALO.bat) para iniciar el [panel visual local](tantalo-panel/README.md). Permite descubrir acciones, presets y modos, revisar el prompt y abrirlo en Codex sin enviarlo automáticamente.

## Mentor de Aprendizaje Deliberado

El agente `mentor-aprendizaje` convierte una debilidad narrativa significativa y respaldada por evidencia en una intervención mínima: una habilidad, una lectura breve, una práctica y una comprobación de transferencia. El tutor narrativo decide cuándo activarlo; el mentor no reemplaza al tutor, no prescribe planes generales y no reescribe capítulos completos.

El historial vive en [`08_aprendizaje/`](08_aprendizaje/README.md). Puede activarse con solicitudes como «Activa el Mentor de Aprendizaje», «Dame la lectura mínima para este problema», «Crea una práctica deliberada» o «Evalúa si ya dominé esta técnica».

## MEME Lore Operating System

MEME LOS is a local-first TypeScript application for maintaining a canonical narrative universe and compiling deterministic, auditable analysis from it. The author remains the only canonical authority; analysis, caches, simulations, annotations, and extraction proposals are derived or local data.

## Start and verify

```powershell
npm.cmd install
npm.cmd run dev
```

Release gates:

```powershell
npx.cmd tsc -b --pretty false
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run analysis:build
npm.cmd run analysis:benchmark
npm.cmd run validate:system
npm.cmd run validate:canon
```

## Analysis workflow

1. Load and validate `data/universe_master.json`.
2. Enable only the required engines in `analysisConfig`.
3. Open `/analysis` and select **Analizar universo**.
4. Review evidence and classify issues locally; no automatic correction exists.
5. Export diagnostics when a review artifact is needed.

The available deterministic capabilities are continuity, causality, knowledge reconstruction, connection metrics, and author-supplied Narrative Plausibility Score hypotheses. Optional assisted extraction is disabled by default and currently has only a local mock provider.

## Canon boundary

Canonical data:

- `data/universe_master.json` and an explicitly approved, validated patch applied to it by the author.

Non-canonical data:

- `data/derived/`, Worker results, IndexedDB cache, browser annotations, plausibility profiles, metrics, diagnostics, benchmarks, and extraction proposals.

Derived files may be deleted and rebuilt. No engine writes directly to the canonical file.

## Documentation

- [Analysis architecture](docs/analysis-architecture.md)
- [Schema and migrations](docs/analysis-schema.md)
- [Rules and engines](docs/analysis-rules.md)
- [Derived data and cache](docs/derived-data.md)
- [Optional AI boundary](docs/ai-boundary.md)
- [Author workflow](docs/author-workflow.md)
- [Measured benchmarks](docs/analysis-benchmarks.md)
- [Quick start](docs/quick-start.md)
- [User manual](docs/user-manual.md)
- [System acceptance matrix](docs/system-acceptance-matrix.md)
- [MEME canon validation](docs/meme-canon-validation-report.md)
