# Informe de control visual

**Estado:** `VERIFICACION_TECNICA_COMPLETA_PENDIENTE_DE_APROBACION_ARTISTICA`
**Fecha:** 2026-08-19

## Diagnóstico de la versión inicial

- El pergamino y las dos columnas eran atractivos, pero la cuadrícula se repetía sin historia material.
- La navegación del sistema y la barra de controles dominaban la entrada al artefacto.
- Los axiomas matemáticos explicaban demasiado y empleaban terminología contemporánea dentro de la hoja.
- LIMEN dependía de signos cuneiformes históricos y por eso no podía funcionar como escritura autónoma de la cultura ficticia.
- Manchas, marco, márgenes y títulos se comportaban como una plantilla única.

Referencia preservada: `../captures/antes-archivo-sagrado.png`.

## Páginas inspeccionadas

| Fragmento | Tipología | Altura a 1366 px | Overflow horizontal | Pie dentro del soporte |
|---|---|---:|---|---|
| CVI-F01 | palimpsesto | 1020 px | no | sí |
| CVI-F02 | diagrama ritual | 1305 px | no | sí |
| CVI-F03 | hoja cosida | 700 px | no | sí |
| CVI-F04 | pasaje censurado | 740 px | no | sí |
| CVI-F05 | fragmento reconstruido | 1041 px | no | sí |
| CVI-F06 | hoja plegada | 700 px | no | sí |
| CVI-F07 | página casi vacía | 1020 px | no | sí |
| CVI-F08 | traducción enfrentada | 800 px | no | sí |
| CVI-F09 | fragmento quemado | 1074 px | no | sí |

Se verificaron además la vista habitual de 910 × 742 px y la vista móvil de 390 × 844 px. En móvil el cuerpo pasa a una columna, las glosas se ordenan como una rejilla legible y no aparece desplazamiento horizontal.

## Problemas encontrados y corregidos

1. **Vacío uniforme en hojas breves:** se asignó altura por tipología; la hoja casi vacía conserva el silencio deliberado y las demás dejan de parecer una plantilla de tamaño fijo.
2. **Marco digital de foco:** el borde blanco del resumen fue sustituido por foco accesible de tono material.
3. **Compresión de controles:** las capas y tamaños ahora envuelven sus controles en anchuras medias.
4. **Anacronismos:** “interruptores”, “cálculo” y “lo técnico” se transforman solo en la reconstrucción material mediante `artifact_text_overrides.json`; el maestro queda intacto.
5. **Captura y scroll:** la segunda pasada reinició cada folio en la parte superior y mantuvo cerrada la mesa de cotejo.
6. **Exceso de explicación matemática:** los escolios modernos quedaron en la cédula secundaria y solo aparecen al escoger la edición atribuida a Clay.

## Legibilidad y estabilidad

- Contraste comprobado sobre los cuatro pigmentos visibles.
- Lengua Semilla generada con SVG propio y estable entre renders.
- Variaciones de inclinación y separación deterministas mediante selectores fijos.
- Ningún error ni advertencia en la consola de la vista final.
- Las tipografías usan familias locales con fallbacks serif; no dependen de una descarga externa para el folio.
- El botón `Imprimir / PDF` invoca la impresión del navegador; la hoja posee reglas A4 y oculta las capas modernas al imprimir.

## Capturas finales

- Escritorio: `../captures/final-escritorio-1366.png`
- Móvil: `../captures/final-movil-390.png`
- Serie completa: `../captures/final-fragment-01.png` a `../captures/final-fragment-09.png`

Las capturas de diagnóstico intermedias se eliminaron; solo permanecen la referencia inicial y los renders finales reproducibles.

## Verificación técnica

- `npm.cmd run build`: aprobado.
- `npm.cmd run lint`: aprobado.
- `npm.cmd test`: 35 archivos y 179 pruebas aprobadas.
- `npm.cmd run validate:canon`: aprobado, sin errores de validación ni advertencias.
- Prueba específica del lector: 3 casos aprobados, incluidos separación de escolios, sustitución anacrónica y llamada de impresión.
