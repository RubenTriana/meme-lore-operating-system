# Validación del canon MEME

## Alcance y resultado

Validación de `data/universe_master.json` ejecutada el 14 de julio de 2026 después de aplicar el enriquecimiento autoral de la Fase 11. El archivo fuente conserva `schemaVersion` `3.2.0`; el cargador lo migra en memoria a `3.5.0` para validar y construir datos derivados separados.

- Hash canónico migrado: `fnv1a64-c7c855edd2c10c60`.
- Versión del canon: `0.1.0` (`initial-canon`).
- Motor derivado: `0.4.0`.
- Estructura: 15 módulos, 95 entidades y 17 eventos.
- Validación: 0 errores, 0 referencias rotas, 0 IDs duplicados y 0 warnings.
- Patch aplicado: 47 adiciones sobre 20 entidades; 0 eliminaciones, cambios de ID, títulos o resúmenes.

**Cero issues reales no significa cero contradicciones.**

El resultado confirma consistencia estructural para los campos declarados. La cobertura sigue siendo insuficiente para certificar exactitud narrativa amplia o ausencia de falsos negativos.

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

El esquema admite tipos extensibles. Todas las entidades permanecen indexables, aunque solo algunos tipos y campos reciben reglas analíticas especializadas.

## Cobertura estructurada

| Área | Antes | Estado actual | Limitación |
| --- | ---: | ---: | --- |
| Temporal declarativa | 0/17 | 17/17 | Todos los valores son relativos; 0/17 tienen punto calculable |
| Participantes | 0/17 | 17/17 | Participación no implica conocimiento compartido |
| Ubicación | 0/17 | 2/17 | Solo se estructuró Nuevo Caguán donde está confirmado |
| Causalidad | 0/17 | 2/17 | Solo dos eventos declaran `effects`; no hay cadenas completas |
| Cambios de conocimiento | 0/17 | 3/17 | Tres declaraciones, todas temporalmente ambiguas |
| `requiredKnowledge` | 0/17 | 0/17 | No existe evidencia canónica suficiente |
| Cambios de estado | 0/17 | 3/17 | Muerte, desaparición y nueva capacidad de Clay |
| Entidades con `analysis` | 0 | 3 | Solo objetivos explícitos de Clay, Amaranta y MEME |
| Entidades con conexiones declaradas | 87/95 | 87/95 | Las aristas expresan estructura, no significado narrativo total |

Los motores permanecen desactivados por defecto en `analysisConfig`. Las mediciones invocan funciones puras sobre una copia validada y no escriben diagnósticos ni anotaciones en el canon.

## Grafo, observaciones e issues

- Grafo: 95 nodos y 343 aristas derivadas.
- Topología: 9 componentes, 8 nodos aislados y 4 ciclos dirigidos.
- Observaciones: 1 `central-character`, 8 `disconnected-component` y 8 `isolated-entity`.
- Issues de conexiones: 0.
- Issues de continuidad: 0; las 4 reglas devuelven información insuficiente.
- Issues de causalidad: 0; 5 evaluaciones sin issue y 1 insuficiente.
- Conocimiento: 3 observaciones `info` de `temporally-ambiguous-knowledge-change`, una por cada evento con declaración cognitiva relativa.
- Nuevos issues de contradicción: 0.

Una observación topológica no es un error narrativo. Los tres informes cognitivos expresan falta de comparabilidad temporal y no una contradicción. Los cuatro ciclos de referencias tampoco equivalen a ciclos causales.

## Integridad autoral

- Los 95 IDs y los 95 resúmenes permanecen sin cambios.
- La entidad Muerte de Harry conserva su título, resumen, referencias y misterio asociado; solo recibe temporalidad relativa, participante y cambio de estado ya declarados.
- Los diez elementos de tipo `mystery` siguen abiertos; ninguno fue resuelto ni convertido en hecho.
- No se añadieron fechas exactas, relaciones tipadas, creencias, miedos, restricciones ni `requiredKnowledge`.
- El canon continúa separado de anotaciones, caché e índices derivados.
- `data/derived/` es reconstruible mediante `npm run analysis:build` y permanece ignorado por Git.

## Limitaciones reales

- El tiempo relativo no permite demostrar anterioridad entre eventos de una misma era ni acumular conocimiento en un punto exacto.
- Dos relaciones causales no representan todavía cadenas causales completas.
- Tres cambios cognitivos no permiten evaluar uso previo, olvido o reaprendizaje en toda la historia.
- La continuidad carece de fechas, intervalos, edades y excepciones estructuradas suficientes para una cobertura amplia.
- La plausibilidad solo dispone de tres objetivos; faltan los demás factores y siempre requiere una hipótesis explícita del autor.
- Las 343 aristas no prueban reciprocidad, causalidad, presencia física ni importancia narrativa.
- No puede medirse una tasa real de falsos negativos sin más canon estructurado y casos autorales de referencia.
- Ningún diagnóstico autoriza una corrección automática del canon.

Por tanto, el canon enriquecido es válido para este release candidate, pero no está narrativamente completo ni certificado como exhaustivo.
