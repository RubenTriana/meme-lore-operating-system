# Fase 11 — Auditoría del grafo

## Alcance

Auditoría de los 8 nodos aislados y los 9 componentes informados por el compilador certificado. Se revisaron `refs`, `foreshadowing`, resumen, estado y módulo de cada entidad. El objetivo no fue aumentar densidad, sino comprobar si existía una relación confirmada que faltara.

## Nodos aislados

| Entidad | Clasificación | Motivo y evidencia canónica | Acción propuesta | ¿El patch añade relación? |
| --- | --- | --- | --- | --- |
| `meme-beat-05-debate` | `insufficient-structure` | Estado `outline`, desarrollo 0 y resumen: el Debate todavía no está definido canónicamente | Mantener aislado hasta que el autor defina el beat | No |
| `meme-beat-06-break-into-two` | `insufficient-structure` | Estado `outline`, desarrollo 0 y resumen explícitamente no definido | Mantener aislado | No |
| `meme-beat-07-b-story` | `insufficient-structure` | La B Story todavía no está definida canónicamente | Mantener aislado | No |
| `meme-beat-08-fun-and-games` | `insufficient-structure` | Fun and Games todavía no está definido canónicamente | Mantener aislado | No |
| `meme-beat-11-all-is-lost` | `insufficient-structure` | No está definido como beat independiente | Mantener aislado | No |
| `meme-beat-12-dark-night-of-the-soul` | `insufficient-structure` | El resumen declara que todavía no está definido | Mantener aislado | No |
| `meme-beat-13-break-into-three` | `insufficient-structure` | Estado `outline`, desarrollo 0 y contenido no definido | Mantener aislado | No |
| `meme-publico-objetivo` | `insufficient-structure` | El público objetivo todavía no ha sido definido canónicamente | Mantener aislado; no vincularlo por conveniencia métrica | No |

No se clasificó ningún nodo como `missing-confirmed-relation` ni `possible-data-error`: las ocho islas son coherentes con contenido todavía no definido. Tampoco se usa `intentional-seed`, porque el canon no declara explícitamente que el aislamiento sea una decisión narrativa; solo demuestra estructura insuficiente.

## Componentes

- Componente principal: 87 entidades conectadas. Clasificación: representación válida del canon actualmente enlazado.
- Ocho componentes unitarios: los ocho nodos de la tabla. Clasificación: `insufficient-structure`.
- Total antes del patch: 9 componentes.
- Total en la previsualización: 9 componentes.
- Nodos aislados antes/después: 8/8.

El patch añade aristas derivadas de participantes, ubicaciones y causalidad solamente a entidades del componente principal. No conecta beats incompletos ni el público objetivo y no propone relaciones tipadas, porque el esquema actual no dispone de un contrato canónico para ellas.

## Decisión autoral pendiente

Cuando cada beat tenga contenido confirmado, el autor deberá decidir qué evento o entidad lo realiza. Hasta entonces, cualquier enlace sería una interpretación y debe permanecer fuera del canon.
