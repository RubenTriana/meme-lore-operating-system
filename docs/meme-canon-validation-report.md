# Validación del canon MEME

## Alcance y resultado

Validación de solo lectura de `data/universe_master.json` ejecutada con `npm run validate:canon` el 14 de julio de 2026. El archivo fuente no se modifica: se migra en memoria de esquema `3.2.0` a `3.5.0`, se valida y se compilan índices derivados separados.

- Hash canónico migrado: `fnv1a64-e020c17d2e15924d`.
- Versión del canon: `0.1.0` (`initial-canon`).
- Motor derivado: `0.4.0`.
- Estructura: 15 módulos, 95 entidades y 17 entidades de tipo `event`.
- Validación: 0 errores, 0 referencias rotas y 0 IDs duplicados.
- Resultado narrativo: 0 issues demostrables; esto no certifica ausencia de contradicciones porque la cobertura estructurada temporal, causal y cognitiva es insuficiente.

## Módulos y cantidades

| Módulo | Entidades | Módulo | Entidades |
| --- | ---: | --- | ---: |
| bible | 6 | lore | 7 |
| characters | 7 | relationships | 0 |
| timeline | 17 | save-the-cat | 15 |
| mysteries | 10 | symbols | 6 |
| factions | 9 | economy | 5 |
| technology | 5 | market | 4 |
| companies | 0 | arg | 0 |
| franchise | 4 | **Total** | **95** |

Tipos encontrados: `event` 17; `beat` 15; `mystery` 10; `character` 7; `symbol` 6; `role` 5; `technology` 5; `economic-concept` 3; `organization` 3; `economic-system` 2; `franchise-entry` 2; y 18 tipos con una entidad cada uno.

El esquema admite tipos extensibles, por lo que no hay entidades “desconocidas” inválidas. Hay 53 entidades con tipos distintos de los seis tipos especializados por algunas reglas (`character`, `event`, `location`, `faction`, `symbol`, `mystery`); siguen siendo indexables y visibles, pero no todas reciben análisis especializado.

## Cronología y cobertura

| Área | Evidencia real | Cobertura / resultado |
| --- | --- | --- |
| Cronología | 17 eventos en `TimelineIndex`; ninguno declara `temporal.start` | 0/17 con fecha estructurada; los 17 quedan sin fecha exacta |
| Causalidad | Ningún evento declara `causes` o `effects` | 0/17; 1 evaluación insuficiente y 5 sin issue por ausencia de declaraciones aplicables |
| Conocimiento | 0 `knowledgeChanges` y 0 `requiredKnowledge` | 0 declaraciones; 3 evaluaciones insuficientes y 2 sin issue |
| Continuidad | No hay vida, edades o intervalos estructurados suficientes | 4/4 reglas devuelven información insuficiente |
| Conexiones | 87/95 entidades declaran al menos una referencia; 304 aristas derivadas | Cobertura alta de enlaces explícitos heredados, no de significado semántico |
| Plausibilidad | 0 entidades con `analysis`; 0 personajes con goals/beliefs/fears/constraints | No evaluable con cobertura útil; el sistema no genera hipótesis |

Todos los motores permanecen desactivados en la configuración migrada por defecto. Para el informe se invocaron sus funciones puras en memoria; esa operación no activó ni guardó configuración en el canon.

## Métricas, observaciones e issues

- Métricas de conexión: 95 nodos, 304 aristas, 9 componentes, 8 nodos aislados y 5 ciclos dirigidos.
- Observaciones: 1 personaje central, 8 componentes desconectados y 8 entidades aisladas.
- Issues de conexiones: 0, porque el canon no declara tipos de relación que exijan reciprocidad en el contrato actual.
- Issues de continuidad, causalidad y conocimiento: 0 demostrables.
- Datos insuficientes: continuidad 4 evaluaciones; causalidad 1; conocimiento 3.

Una observación de aislamiento o centralidad no es un error narrativo. Un ciclo de referencias tampoco equivale a un ciclo causal: el canon no contiene `causes`/`effects` estructurados.

## Posibles misterios intencionales

El módulo canónico clasifica diez entidades como `mystery`: desaparición de Amaranta, Harry digital, límite del Destructor de Voluntades, mensaje previo al encuentro, muerte de Harry, naturaleza de la Gracia, objetivo de MEME, ola de posesiones, reconocimiento de Clay y “¿Amaranta nunca se fue?”. Esta lista procede del tipo explícito y no afirma que estén resueltos, sean contradicciones o deban corregirse.

## Verificación manual mínima

La “clasificación esperada” se limita a lo declarado en el propio canon: módulo y `type`. “Obtenida” es lo leído por el cargador y el índice, sin interpretación de la prosa.

| Elemento | Módulo / tipo esperado | Obtenido | Relaciones principales declaradas | Fuentes canónicas comprobadas | Diagnósticos |
| --- | --- | --- | --- | --- | --- |
| Clay (`meme-clay`) | characters / character | Coincide | Amaranta, Harry, MEME, Nuevo Caguán, misión DEA, acto de Gracia; anticipa mensaje y archivos | entidad `meme-clay`; entrantes como premisa, DEA, Harry y beats | 0 issues; observación `central-character` |
| Amaranta (`meme-amaranta`) | characters / character | Coincide | Clay, Harry, Gracia, linaje, inmolación; anticipa archivos y mensaje | entidad `meme-amaranta`; entrantes desde Clay, Harry, Gracia y misterios | 0 issues; 0 observaciones específicas |
| Harry (`meme-harry`) | characters / character | Coincide | Clay, Amaranta, misterio de muerte, revelación digital; anticipa celular y copia | entidad `meme-harry`; entrantes desde muerte, copia y beats | 0 issues; 0 observaciones específicas |
| MEME (`meme-meme`) | characters / character | Coincide | Clay, Amaranta, Gracia, mercado y deseo; anticipa servidores y réplica | entidad `meme-meme`; entrantes desde premisa, mercado, tecnología y beats | 0 issues; 0 observaciones específicas |
| La Gracia (`meme-la-gracia`) | lore / metaphysical-system | Coincide | MEME, Amaranta y réplica del campo | entidad `meme-la-gracia`; entrantes desde temas, misterios y actos | 0 issues; 0 observaciones específicas |
| Nuevo Caguán (`meme-nuevo-caguan`) | lore / location | Coincide | Amaranta, red de servidores y vigilancia local | entidad `meme-nuevo-caguan`; entrantes desde llegada, misión y misterios | 0 issues; 0 observaciones específicas |
| Mercado de Futuros de la Voluntad (`meme-mercado-futuros-voluntad`) | market / market-system | Coincide | MEME, deseo como activo y financiarización | entidad del mercado; entrantes desde atención, contratos, propuesta y novela dos | 0 issues; 0 observaciones específicas |
| Ministerio del Pánico (`meme-ministerio-del-panico`) | factions / faction | Coincide | MEME, economía del terror y Seekers | entidad de facción; entrantes desde roles, ascenso, miedo y novela dos | 0 issues; 0 observaciones específicas |
| El celular agotado (`meme-celular-agotado-junto-a-harry`) | symbols / symbol | Coincide | Harry, Amaranta y muerte de Harry | entidad del símbolo; entrantes desde Harry, misterio y evento de muerte | 0 issues; 0 observaciones específicas |
| Muerte de Harry (`meme-muerte-de-harry`) | timeline / event | Coincide | Harry, Clay, Amaranta, celular y misterio de muerte | entidad del evento; entrantes desde beat 03 y el celular | 0 issues; fecha estructurada ausente |

## Limitaciones reales

- La clasificación mínima de las diez entidades coincide, pero la verdad narrativa solo puede aprobarla el autor.
- No es posible medir una tasa real de falsos negativos sobre continuidad, causalidad o conocimiento mientras el canon no declare los campos estructurados necesarios.
- Las 304 aristas expresan referencias, no necesariamente relaciones recíprocas, causales o temporales.
- Los ciclos, componentes e islas son observaciones topológicas; no justifican correcciones automáticas.
- La plausibilidad no puede evaluarse automáticamente y no debe hacerlo: requiere una hipótesis del autor y datos analíticos opcionales.
- Ningún resultado de este informe modifica el canon ni recomienda cambios narrativos automáticos.
