# Fase 11 — Informe de enriquecimiento canónico propuesto

## Resumen

Se revisaron los 17 eventos, los cuatro personajes centrales, cinco sistemas/reglas y diez misterios autorizados. El resultado es un patch de 47 operaciones aditivas sobre 20 entidades; no contiene eliminaciones, cambios de ID, renombres, modificaciones de `summary` ni cambios en `refs`.

| Alcance revisado | Revisados | Entidades con cambios propuestos |
| --- | ---: | ---: |
| Eventos | 17 | 17 |
| Personajes: Clay, Amaranta, Harry y MEME | 4 | 3 |
| Sistemas y reglas prioritarios | 5 | 0 |
| Misterios | 10 | 0 |

Harry no recibe `analysis` porque el canon no declara objetivo, miedo, creencia o restricción. Los sistemas y misterios ya tienen resumen, estado, tags y referencias, pero el esquema actual no dispone de campos especializados para reglas, hechos conocidos, pistas o preguntas abiertas; añadir propiedades no consumidas por el sistema sería scaffolding especulativo.

## Cobertura antes y después

Medición producida por las funciones reales sobre el canon migrado y una previsualización en memoria:

| Área | Antes | Después | Limitación conservada |
| --- | ---: | ---: | --- |
| Eventos con `temporal.start` | 0/17 | 17/17 | Todos son relativos; 0/17 tienen punto temporal calculable |
| Eventos con participantes | 0/17 | 17/17 | “Participante” no implica que todos aprendan lo mismo |
| Eventos con ubicación | 0/17 | 2/17 | Solo Nuevo Caguán está confirmado como entidad de ubicación aplicable |
| Eventos con declaración causal | 0/17 | 2/17 | Dos relaciones desde la causa mediante `effects`; no se fuerza el resto de la cadena |
| Eventos con cambios de conocimiento | 0/17 | 3/17 | Los tres cambios carecen de tiempo calculable |
| Declaraciones cognitivas | 0 | 3 | Generan tres observaciones `info` de ambigüedad temporal |
| Eventos con cambios de estado | 0/17 | 3/17 | Solo muerte, desaparición y capacidad final confirmadas |
| Personajes con `analysis` | 0/7 | 3/7 | Solo se copiaron objetivos explícitos de Clay, Amaranta y MEME |
| Aristas derivadas | 304 | 343 | Las nuevas aristas no son relaciones semánticas tipadas |
| Nodos aislados / componentes | 8 / 9 | 8 / 9 | No se conectó contenido sin definir |

Hash de la previsualización: `fnv1a64-c7c855edd2c10c60`. Hash del canon original migrado: `fnv1a64-e020c17d2e15924d`.

## Cambios propuestos

### Eventos

- Tiempo: se copia literalmente el valor existente de `era` a `temporal.start` con precisión `relative` en los 17 eventos. No se crean fechas ni secuencias nuevas.
- Participantes: se añaden únicamente entidades mencionadas explícitamente como sujetos, interlocutores o sistemas actuantes en cada resumen.
- Ubicaciones: `meme-nuevo-caguan` se añade al origen de Amaranta y a la llegada de Clay.
- Causalidad confirmada:
  - La misión de la DEA declara como efecto la llegada de Clay a Nuevo Caguán.
  - El acto de Gracia de Clay declara como efecto el nacimiento del Destructor de Voluntades.
- Conocimiento de Clay:
  - encuentra el mensaje de Amaranta grabado antes de conocerlo;
  - descubre la existencia de una copia digital de Harry y su uso como instrumento de negociación;
  - recibe la exigencia de misiones a cambio de la promesa de devolverle a Harry.
- Estados:
  - Harry pasa de `alive` a `dead`;
  - Amaranta pasa de `present` a `missing`;
  - Clay adquiere la capacidad `destructor-of-wills`.

No se declara que MEME causó la muerte de Harry, que la desaparición de Amaranta fue causada por esa muerte, que los archivos causaron la revelación digital ni que la inmolación causó el acto de Gracia.

### Personajes

Se copian como `analysis.goals` los campos `goal` ya existentes de Clay, Amaranta y MEME. No se transforma `wound`, `contradiction`, `arc` o `desire` en miedo, creencia o restricción.

### Sistemas y reglas

Se revisaron `meme-la-gracia`, `meme-coste-de-la-gracia`, `meme-puntos-ciegos-del-sistema`, `meme-linaje-doce-tribus` y `meme-mercado-futuros-voluntad`. No se proponen operaciones: sus reglas confirmadas permanecen en prosa y referencias porque no existe un campo analítico específico que preserve sus categorías sin pérdida.

### Misterios

Los diez misterios ya declaran pregunta abierta, estado, tags y entidades relacionadas. No se resuelve ninguno ni se convierte una sospecha en hecho. La muerte de Harry, la identidad de Harry digital, el plan de MEME y la naturaleza de la Gracia permanecen abiertos.

### Relaciones

No se añaden relaciones tipadas. El modelo actual solo tipa aristas derivadas como referencia, foreshadowing, participante, ubicación, causa, efecto, conocimiento o estado. Introducir `spouse-of`, `opposes` u otros tipos como campos desconocidos no produciría análisis real y excedería la fase.

## Datos no añadidos

- Fechas de calendario, días, años o orden exacto dentro de “Antes de la novela 1” y “Novela 1”.
- Presencia física de personajes que solo son mencionados o conocidos posteriormente.
- Causas no confirmadas de muerte, desaparición, revelaciones, inmolación o Gracia.
- Miedos, creencias y restricciones no nombrados explícitamente.
- `requiredKnowledge`: el canon no especifica qué hecho era requisito previo para cada acción.
- Olvidos, información falsa o dudosa: el modelo cognitivo actual no tipa verdad o fiabilidad.
- Resoluciones, falsos supuestos o respuestas para misterios abiertos.
- Relaciones tipadas y reciprocidad semántica.
- Reglas estructuradas de sistemas: requieren una ampliación futura del contrato, no datos improvisados.

## Preguntas abiertas

1. ¿Cuál es el orden exacto de los eventos que comparten la misma era relativa?
2. ¿Clay presencia la muerte de Harry o solo conoce el resultado?
3. ¿Qué evento conecta los archivos de Amaranta con la revelación de Harry digital?
4. ¿La coacción de MEME comienza en la revelación o en un evento posterior?
5. ¿Qué relación causal, si existe, une inmolación, acto de Gracia y transformación de Clay?
6. ¿Qué sabe Amaranta sobre el futuro y qué sigue siendo interpretación?
7. ¿Qué beats incompletos corresponden a eventos ya existentes?
8. ¿Qué vocabulario autoral debe usarse para relaciones tipadas y reglas de mundo?

## Riesgos

- El tiempo relativo aumenta cobertura declarativa, pero no permite ordenar conocimiento o comprobar anterioridad.
- Los tres cambios cognitivos aparecen correctamente como temporalmente ambiguos con severidad `info`.
- `participantRefs` añade conexiones al grafo; no demuestra presencia física continua ni conocimiento compartido.
- Los estados usan rutas descriptivas que el índice conserva, pero ningún motor interpreta todavía todas esas rutas.
- La mejora de plausibilidad se limita a tres objetivos explícitos; no existe cobertura de los otros cinco factores.
