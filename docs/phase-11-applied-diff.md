# Fase 11 — Comparación del enriquecimiento aplicado

## Identidad y respaldo

| Dato | Antes | Después |
| --- | --- | --- |
| Hash funcional del canon migrado | `fnv1a64-e020c17d2e15924d` | `fnv1a64-c7c855edd2c10c60` |
| SHA-256 del archivo fuente | `aed3980efc6d3a40e87929738756b4c31ae00a7c5fa9c21c5695d324ba7cecba` | `10dda9bc58ba619d8993aa3b93ff964402dfd6ca2196a81a6049a1cf3f16c531` |
| `schemaVersion` fuente | `3.2.0` | `3.2.0` |
| Entidades | 95 | 95 |
| Eventos | 17 | 17 |

El SHA-256 anterior corresponde también al respaldo técnico temporal creado antes de la escritura. La copia quedó fuera de Git. El resultado se produjo mediante `applyPatch`, se validó y se escribió de forma atómica.

## Balance estructural

- Operaciones aplicadas: **47/47**.
- Entidades modificadas: **20** — los 17 eventos y los personajes Clay, Amaranta y MEME.
- Campos añadidos: **47**.
- Campos eliminados: **0**.
- IDs cambiados: **0**.
- Resúmenes cambiados: **0**.
- Misterios resueltos: **0**.
- Referencias rotas: **0**.
- IDs duplicados: **0**.
- Títulos cambiados: **0**.

| Campo añadido | Operaciones |
| --- | ---: |
| `temporal` | 17 |
| `participantRefs` | 17 |
| `locationRefs` | 2 |
| `effects` | 2 |
| `knowledgeChanges` | 3 |
| `stateChanges` | 3 |
| `analysis` | 3 |
| **Total** | **47** |

## Comparación semántica por grupo

### Temporalidad

Los 17 valores existentes de `era` se reflejan en `temporal.start` con precisión `relative`. La cobertura declarativa pasa de 0/17 a 17/17, pero la cobertura temporal calculable permanece en 0/17. No se añadieron fechas ni un orden nuevo entre eventos de la misma era.

### Participantes y ubicaciones

Los 17 eventos reciben participantes mencionados explícitamente en sus títulos o resúmenes. Solo dos eventos reciben ubicación: el origen de Amaranta y la llegada de Clay, ambos en Nuevo Caguán. La aplicación no interpreta una mención como presencia física fuera de esos casos estructurados.

### Causalidad

Se declaran dos efectos conservadores: la misión de la DEA conduce a la llegada de Clay, y el acto de Gracia produce el nacimiento del Destructor de Voluntades. No se añaden enlaces inversos ni causas para muertes, desapariciones, revelaciones o misterios.

### Conocimiento

Tres eventos declaran cuatro hechos aprendidos por Clay, copiados de sus resúmenes. Las tres declaraciones quedan como temporalmente ambiguas porque el tiempo es relativo. No se crea `requiredKnowledge` ni se convierte una pregunta abierta en conocimiento.

### Estados

Se estructuran tres transiciones ya narradas: Harry vivo a muerto, Amaranta presente a desaparecida y Clay sin la capacidad del Destructor a poseerla. No se infieren estados intermedios.

### Objetivos

Los objetivos analíticos de Clay, Amaranta y MEME son copias literales de sus campos `goal`. No se añadieron creencias, miedos o restricciones.

## Validación posterior

- Zod y validación referencial: **PASS**.
- JSON Schema draft 2020-12: **PASS**.
- Rutas únicas y orden de operaciones: **PASS — 47/47**.
- Segunda detección: **ALREADY_APPLIED — 47**, ausentes 0, conflictos 0.
- Idempotencia funcional: **PASS**; aplicar el mismo patch a la representación resultante no cambia el contenido.
- Duplicados en arrays de referencias o relaciones tras una segunda evaluación: **0**.

## Resultado analítico

| Métrica | Antes | Después |
| --- | ---: | ---: |
| Aristas derivadas | 304 | 343 |
| Nodos aislados | 8 | 8 |
| Componentes | 9 | 9 |
| Eventos con participantes | 0/17 | 17/17 |
| Eventos con ubicación | 0/17 | 2/17 |
| Eventos con causalidad declarada | 0/17 | 2/17 |
| Eventos con cambios de conocimiento | 0/17 | 3/17 |
| Eventos con cambios de estado | 0/17 | 3/17 |
| Entidades con `analysis` | 0 | 3 |

Continuidad y causalidad conservan 0 issues. Conocimiento informa 3 observaciones de severidad `info` por ambigüedad temporal relativa. No aparecen nuevos issues de contradicción ni falsos positivos de continuidad o causalidad.

## Puertas de calidad de RC2

| Gate | Resultado |
| --- | --- |
| Typecheck | PASS |
| Lint | PASS |
| Suite general | PASS — 19 archivos, 109/109 pruebas |
| Prueba dirigida Fase 11 | PASS — 8/8 pruebas |
| `validate:system` | PASS — 12/12 pruebas |
| `validate:canon` | PASS — 95 entidades, 0 errores, 0 referencias rotas |
| `analysis:build` | PASS — hash `fnv1a64-c7c855edd2c10c60`, 6 artefactos |
| Build de producción | PASS — 2.870 módulos transformados |
