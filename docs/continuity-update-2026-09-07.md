# Auditoría de continuidad e integración local 2026 09 07

## Resultado

La base de trabajo vigente es `codex/codice-tipografia-sacra` en `a5f57b57dd4109bb96593f61d1c5fa67f2f398ca`. Conserva la aplicación 0.2.0-rc.3, el canon técnico 0.9.0 y el esquema 3.5.0. Esta actualización eleva la aplicación local a 0.3.0-rc.1 sin cambiar la versión del canon.

La ejecución mantiene `data/universe_master.json` intacto. RÍO se integra mediante una superficie local separada y una extensión de la consulta selectiva; sus fichas continúan propuestas. La edición aprobada del Códice se sirve desde una capa privada ignorada por Git y desplaza únicamente la referencia editorial visible, no el canon técnico.

## Inventario de fuentes

| Fuente | Función | Autoridad | Integridad | Cobertura |
| --- | --- | --- | --- | --- |
| `data/universe_master.json` | Canon técnico activo | `CANON_TECNICO_ACTIVO` | versión 0.9.0, esquema 3.5.0 | 228 entidades y 96 eventos |
| Códice Edición de la Novena Costura | Obra literaria vigente | `APROBADO_EDITORIAL` | SHA-256 `82132c3511f8da8122cf5b78b63240193a39d6a65da444becd5a48eb7a595d0f` | 9 libros, 1.158 párrafos, 90 secciones derivadas |
| RÍO y Nombres Increados 0.1.0 | Diseño mecánico | categoría aprobada; fichas `PROPUESTA` | SHA-256 `689c64ae7fe48047a6e66ca1317ce12743bbde9769a3e7dfb6301d77a14474eb` | 7 Nombres, 2 habilidades de segunda generación y 1 formalización estructural |
| Scrivener Operación Tántalo | Manuscrito activo | evidencia de producción, no canon universal | proyecto `0dc0594228f22b23835228a25852ac1b692159c17a079f287e72f666ba6c675d` | Intro 293 palabras, Cap 1 3.014, Cap 2 6 |
| Plottr | Planificación | ausente | no localizado | cobertura nula |
| Conversaciones | Evidencia de decisiones | parcial | no exportadas a esta ejecución | solo instrucciones y resúmenes presentes |

## Diferencias principales

1. El maestro Markdown anterior del Códice tenía 1.798 palabras y estado candidato; el DOCX aprobado contiene la edición completa de 10.910 palabras. El lector ahora intenta abrir primero la derivación privada verificada y conserva el maestro anterior como variante histórica.
2. `BRIEF_COMPATIBILIDAD.md` imponía Partición, borrado de Harry y extinción de la Gracia como veto editorial. Ese contrato queda sustituido para el Códice por la Novena Costura aprobada; el conflicto con el canon técnico se mantiene visible hasta una promoción separada.
3. `CONTEXTO_ACTIVO.md` y `estado-narrativo.md` afirmaban que no existía borrador. Scrivener prueba un Capítulo 1 de 3.014 palabras que llega a RUTA = X y La Condicional, aunque termina en notas de planificación y no está aprobado.
4. Vicente ya existe como `meme-vicente`; no se creó duplicado. Abelardo aparece en el borrador y en una sinopsis local, pero su función canónica sigue sin evidencia suficiente.
5. No se localizó un proyecto Plottr en `D:\Proyecto Evangelio`, `C:\Users\User\Documents\El Evangelio`, OneDrive o Downloads.

## Arquitectura aplicada

- `.meme-private/` conserva fuentes y derivados locales y está excluido de Git.
- `scripts/import-private-literary-sources.py` verifica hashes, copia originales sin sobrescribirlos, extrae el Códice y genera un catálogo RÍO trazable.
- `/codice` abre la Novena Costura aprobada por defecto; las reconstrucciones material, tipográfica y bayesiana conservan su estado candidato.
- `/rio` ofrece búsqueda y filtros que separan alcance aprobado de facultades propuestas.
- `POST /api/tantalo/context/query` acepta `rio`, `codice` y sus aliases, mantiene procedencia y estado editorial, y sigue limitado a localhost y solo lectura.
- El paquete de voz queda preparado en `.meme-private/voice-context/`; el acceso por voz permanece pendiente de prueba porque ChatGPT Voice no consulta `localhost` automáticamente.

## Recuperación

El commit base contiene todos los archivos rastreados anteriores. Para reconstruir la capa privada se requieren las dos fuentes con sus hashes declarados y la estrategia de revisión 2; el importador vuelve a generar los mismos IDs de secciones y fichas. No se modificaron los originales de Scrivener, Plottr, Códice o RÍO.

## Promoción pendiente

El canon técnico conserva el desenlace anterior. La reconciliación creativa con la tercera vía y cualquier entrada RÍO en `data/universe_master.json` requieren un lote canónico separado, simulación contra hash base y aprobación expresa. Esta ejecución no fabrica esa aprobación ni mezcla ambos desenlaces.
