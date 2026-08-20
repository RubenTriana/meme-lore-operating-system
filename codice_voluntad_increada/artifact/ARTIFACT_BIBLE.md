# Biblia material del archivo sagrado

**Estado:** `PROPUESTA_HISTORICO_MATERIAL_PENDIENTE_DE_APROBACION`
**Autoridad:** esta guía gobierna únicamente la presentación candidata. No modifica `data/universe_master.json`, `CODICE_MASTER.md` ni las decisiones aprobadas del Códice.

## Principio

La edición visible es una reconstrucción parcial de hojas que nunca formaron un volumen único. Su antigüedad se comunica por relaciones causales —copia, raspado, costura, humedad, censura, restauración— y no por un filtro sepia uniforme.

## Materialidad

- **Soporte anterior:** piel delgada, lámina vegetal y papel de fibras largas. Los materiales no aparecen juntos sin una costura, un parche o una transcripción posterior.
- **Herramientas:** punta mineral para la Mano Anterior; caña o fibra hendida para Custodio y Exégeta; instrumento fino y presión desigual para la Mano Raspada.
- **Encuadernación:** hojas plegadas, tiras montadas y fragmentos cosidos. El formato de libro es una imposición tardía del Exégeta.
- **Clima de daño:** humedad intermitente, agua salobre en el fragmento de las guerras, presión en depósitos y fuego localizado en el último folio.

## Paleta de pigmentos

| Capa | Pigmento | Tratamiento visual |
|---|---|---|
| Mano Anterior | carbón mineral | negro mate, granular, sin contorno digital limpio |
| Custodio | pardo ferroso | absorción irregular y pérdida en pliegues |
| Exégeta | negro oxidado | ritmo más uniforme, títulos y cancelaciones |
| Mano Raspada | rojo de raíz oxidado | terroso, discontinuo, nunca rojo saturado |
| Mano Imposible | gris sin edad concordante | borde frío y tenue, usado con extrema escasez |
| Restauración | grafito neutro | siempre fuera del cuerpo sagrado |

## Daños y causalidad

Cada folio usa un conjunto limitado de daños registrado en `artifact_layers.json`. El daño debe alterar lectura, dirección o atribución: un recorte elimina la quinta dirección; una costura atraviesa una cuenta; una raspadura oculta un nombre; el fuego interrumpe la palabra final. Se prohíben manchas repetidas, suciedad homogénea y bordes rotos intercambiables.

## Reglas visuales

1. El artefacto ocupa la experiencia principal; la cédula moderna se pliega.
2. La irregularidad tipográfica usa clases predeterminadas por bloque. No hay azar en tiempo de render.
3. Las páginas cambian de tipología sin perder paleta ni escala material.
4. Todo diagrama admite al menos dos funciones: mapa/rito, memoria/operación o genealogía/advertencia.
5. La Lengua Semilla se dibuja con SVG propio y no con glifos históricos.
6. Las notas editoriales modernas nunca comparten tinta ni marco con una mano antigua.

## Cronología física propuesta

1. Señales sueltas de la Mano Anterior sobre soportes no encuadernados.
2. Parábolas del Custodio copiadas de transmisión oral y fragmentos previos.
3. Ordenación del Exégeta: libros, numeración, doctrina y censura.
4. Réplicas de varias Manos Raspadas separadas por generaciones.
5. Apariciones no atribuibles de la Mano Imposible.
6. Dispersión, ocultamiento, incendios y montajes incompletos.
7. Reconstrucción moderna mínima, explícita y reversible.

Esta cronología es una hipótesis editorial sobre el objeto, no una cronología factual del universo narrativo.

## Sistema tipográfico

La reconstrucción usa dos familias locales para cinco manos: Alegreya articula Custodio y Raspada; EB Garamond articula Exégeta e Imposible. La intervención moderna conserva Inter/DM Mono fuera del soporte, y la Mano Anterior permanece como Lengua Semilla vectorial propia. Capitulares, rúbricas, pesos, cursivas, pigmentos y restricciones están definidos en [`TYPOGRAPHY_SYSTEM.md`](./TYPOGRAPHY_SYSTEM.md).

Este sistema es una propuesta material reversible. Diferencia estratos sin atribuirles una cultura histórica real y no añade autoridad canónica al contenido.
