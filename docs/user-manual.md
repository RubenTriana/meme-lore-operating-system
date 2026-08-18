# Manual de usuario

Este manual está dirigido a un autor. Los comandos se ejecutan en PowerShell desde `C:\Codex\projects\meme_LoreSystem_v2`.

## 1. Qué es MEME Lore Operating System

Es una aplicación local para leer un universo narrativo estructurado, validar su forma, construir índices reconstruibles y mostrar diagnósticos deterministas. No sustituye el criterio del autor y no necesita IA para analizar.

## 2. Qué es canon

El canon es lo confirmado por el autor en `data/universe_master.json`. Es la fuente de verdad. Ningún motor, caché, diagnóstico, score o propuesta puede modificarlo automáticamente.

## 3. Qué son datos derivados

Son índices generados desde el canon: entidades, grafo, cronología, conocimiento y dependencias. `npm run analysis:build` los escribe en `data/derived/`. Se pueden borrar y reconstruir; nunca sustituyen el canon.

## 4. Cómo iniciar la aplicación

```powershell
Set-Location "C:\Codex\projects\meme_LoreSystem_v2"
npm.cmd ci
npm.cmd run dev
```

Para abrir Tántalo y LoreSystem juntos, ejecuta `ABRIR_PANEL_TANTALO.bat`. Para comprobar una compilación final usa `npm.cmd run build` y después `npm.cmd run preview`.

## 5. Cómo cargar y validar un universo

Al iniciar, la app carga `data/universe_master.json`. En Ajustes, **Import JSON / patch** detecta el tipo: un patch entra siempre en cuarentena en `/proposals`; un master completo validado exige confirmación explícita antes de sustituir el workspace base. El cargador migra en memoria versiones antiguas y valida esquema, IDs, referencias, fechas y duplicados. Un error impide analizar; una advertencia no cambia el archivo.

Ejemplo válido de entidad opcional:

```json
{
  "id": "meme-evento-prueba",
  "type": "event",
  "title": "Evento de prueba",
  "temporal": { "start": "2030", "precision": "year" },
  "participantRefs": ["meme-clay"]
}
```

No uses `null`: omite campos desconocidos y conserva IDs en minúsculas kebab-case.

## 6. Cómo navegar por los módulos

La barra lateral muestra los módulos con visibilidad `navigation`. Cada módulo usa su renderer existente: conocimiento, personajes, cronología, tarjetas, misterios, economía, tecnología o franquicia. Las rutas analíticas son `/analysis`, `/analysis/connections`, `/analysis/plausibility` y `/analysis/extraction`.

## 7. Cómo interpretar entidades

Una entidad tiene `id`, `type` y `title`; puede añadir resumen, estado, prioridad, tags y referencias. **Detail** abre la lectura completa y **Canonical links** muestra destinos declarados. Un enlace significa relación explícita, no necesariamente causalidad, parentesco o acuerdo recíproco.

## 8. Cómo ejecutar análisis

En Settings, elige interruptores o un preset de motores; son preferencias locales y nunca alteran `analysisConfig`. En `/analysis`, pulsa **Analizar universo**. El Worker informa progreso y permite cancelar. Las simulaciones de propuestas pueden ejecutar temporalmente la selección local sobre base y candidato.

## 9. Análisis completo e incremental

La primera ejecución es completa. En cambios seguros, el sistema compara hashes por entidad y reconstruye índices afectados. Si hay eliminaciones, versiones incompatibles o duda de consistencia, vuelve a compilar todo. “Completo” no significa que modifique el canon.

## 10. Severidad, confianza, cobertura y evidencia

- **Severidad**: impacto de la señal (`info` a `critical`), no orden autoral.
- **Confianza**: certeza estructural de la regla con los datos disponibles, no verdad literaria.
- **Cobertura**: porcentaje de factores con datos; una cobertura baja no equivale a baja plausibilidad.
- **Evidencia**: IDs, campos y valores canónicos que activaron la regla.

## 11. Métrica, observación, issue e información insuficiente

- **Métrica**: medida, por ejemplo centralidad o densidad.
- **Observación**: señal descriptiva, como un nodo aislado; no es un error.
- **Issue**: condición de una regla que merece revisión.
- **Información insuficiente**: faltan datos para decidir; no debe convertirse en contradicción.

## 12. Cómo gestionar un diagnóstico

Abre el issue y revisa mensaje, regla, evidencia y limitaciones. Puedes marcarlo `open`, `confirmed`, `intentional`, `ignored` o `resolved` y escribir una nota. La decisión se guarda en este navegador. Si cambia la evidencia, la app pide revisarla.

## 13. Relaciones y grafos

En `/analysis/connections`, selecciona una entidad, filtra tipos de arista y limita profundidad. Puedes ver vecinos, conexiones indirectas y calcular una ruta entre dos entidades. El grafo carga vecindarios limitados; no asumas que un camino implica causalidad.

## 14. Cronología

`TimelineIndex` ordena entidades `event` cuando existe `temporal` o información heredada calculable. `precision` puede ser `exact`, `day`, `month`, `year`, `relative` o `unknown`. Eventos sin fecha se conservan y aparecen como no ubicables.

## 15. Causalidad

Solo `causes` y `effects` crean el grafo causal. El motor revisa referencias, orden temporal, ciclos declarados, pasos aislados y cadenas rotas. No interpreta frases del resumen como causas.

## 16. Conocimiento de personajes

`knowledgeChanges` declara lo que un personaje aprende u olvida; `analysis.requiredKnowledge` declara lo necesario para actuar. El motor acumula estados cuando el orden temporal es calculable. No extrae conocimiento de prosa libre.

## 17. Plausibilidad narrativa

En `/analysis/plausibility`, escribe una hipótesis, selecciona actor, acción y contexto, y revisa el perfil de pesos. El resultado es un **Narrative Plausibility Score** estructural, no una probabilidad científica. Mira score y cobertura por separado; los perfiles se guardan fuera del canon.

## 18. Cómo importar propuestas

En `/analysis/extraction`, la función asistida está desactivada por defecto y solo existe un proveedor mock local. Selecciona fragmentos concretos. La salida es una propuesta con fuentes, nunca canon. No selecciones secretos ni archivos ajenos.

## 19. Cómo revisar y aprobar un patch

Abre `/proposals`: importar → aislar → validar → diff → simular → analizar base y candidato → comparar → decidir. Aprobar exige confirmación, pero no cambia el workspace ni escribe `universe_master.json`. **Abrir candidato en workspace** es temporal y muestra una advertencia persistente; **Restaurar canon base** recupera la base. **Preparar promoción canónica** exporta artefactos para revisión y commit. Consulta [el procedimiento completo](proposal-workflow.md).

## 20. Cómo actualizar el canon

Haz una copia, edita JSON, valida y revisa el diff. No cambies IDs existentes ni contenido narrativo mediante una migración automática. Después ejecuta `npm test`, `npm run validate:system`, `npm run analysis:build` y `npm run build`.

## 21. Cómo exportar resultados

En `/analysis`, **Exportar diagnósticos** descarga JSON con metadatos, issues y anotaciones asociadas. Ajustes permite exportar el universo cargado. Las propuestas de importación exportan patches separados. Ninguna exportación es canon por sí sola.

## 22. Cómo hacer copias de seguridad

Revisa primero `git status`. En `version-2-experimental`, añade únicamente archivos esperados, crea un commit descriptivo y, con autorización, empuja esa rama y su tag sin `--force`. Conserva también una copia externa del canon antes de cambios narrativos.

## 23. Cómo restaurar una versión

Identifica el commit o tag con `git log --oneline` y `git tag`. No uses comandos destructivos sobre trabajo sin guardar. Para inspeccionar una versión, exporta el archivo desde Git o pide ayuda antes de cambiar la rama. El checkpoint inicial certificado es `meme-lore-v0.2.0-experimental.0`.

## 24. Qué nunca debe editarse automáticamente

Nunca dejes que un motor cambie `data/universe_master.json`. No copies al canon `data/derived/`, IndexedDB, anotaciones, diagnósticos, benchmarks, scores o propuestas. No edites `main`, no hagas merge y no uses force push durante este ciclo experimental.

## 25. Solución de problemas

- **Canon inválido**: lee ruta y mensaje; corrige una copia, no ocultes el error.
- **Motor desactivado**: revisa `analysisConfig`; el valor seguro por defecto es `false`.
- **Resultado obsoleto**: vuelve a analizar después de cambiar el canon.
- **Caché dañada**: pulsa **Limpiar caché**; el último canon permanece intacto.
- **Worker cancelado**: inicia otra ejecución; no se guardan parciales.
- **Derivados parciales**: ejecuta `npm run analysis:build`; el comando valida los seis artefactos.
- **Instalación inconsistente**: elimina solo dependencias reconstruibles si sabes hacerlo y repite `npm ci`; nunca borres el canon.

## 26. Glosario

- **Canon**: datos confirmados por el autor.
- **Derivado**: dato reconstruible calculado desde el canon.
- **Engine/motor**: conjunto determinista de reglas.
- **Fixture**: universo pequeño creado para pruebas.
- **Hash**: huella estable del contenido.
- **Issue**: diagnóstico revisable.
- **Patch**: propuesta de cambios aún no canónica.
- **Snapshot**: compilación analítica identificada por hash y versiones.
- **Worker**: proceso del navegador que evita bloquear la interfaz.

Consulta también la [guía rápida](quick-start.md), la [arquitectura](analysis-architecture.md), las [reglas](analysis-rules.md) y el [flujo autoral](author-workflow.md).
