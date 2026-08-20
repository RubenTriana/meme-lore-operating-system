# Sistema tipográfico del Códice

**Estado:** `PROPUESTA_TIPOGRAFICA_PENDIENTE_DE_APROBACION`
**Fecha de auditoría:** 2026-08-19
**Alcance:** interfaz, reconstrucción material y exportación. No modifica el texto maestro ni `data/universe_master.json`.

## Criterio

El sistema distingue estratos de transmisión mediante ritmo, peso, cursiva, espaciado y pigmento. La diversidad no se obtiene acumulando fuentes decorativas: dos familias históricamente informadas sostienen cinco manos, mientras la Lengua Semilla conserva su alfabeto vectorial propio.

## Familias seleccionadas

### Alegreya

- **Uso:** Mano del Custodio y Mano Raspada.
- **Autoría:** Juan Pablo del Peral; distribución actual de Huerta Tipográfica.
- **Razón:** fue concebida para literatura y lectura prolongada; su ritmo caligráfico permite que el Custodio suene humano sin parecer moderno. Sus itálicas auténticas producen una Mano Raspada distinta sin introducir una tercera tradición gráfica.
- **Instancias locales:** romana 400/700; itálica 500/600.
- **Licencia:** SIL Open Font License 1.1, preservada en `src/assets/fonts/alegreya/OFL.txt`.

### EB Garamond

- **Uso:** Mano del Exégeta y Mano Imposible.
- **Autoría:** Georg Duffner y Octavio Pardo; revival contemporáneo de la tradición garamondina.
- **Razón:** aporta autoridad romana, jerarquía editorial, cursivas reales, versalitas, ligaduras y cifras antiguas. En la Mano Imposible se usa con espaciado geométrico y ligaduras anuladas: el extrañamiento surge del sistema, no de una falsa escritura antigua.
- **Instancias locales:** romana 400/500/600/700; itálica 400/500.
- **Licencia:** SIL Open Font License 1.1, preservada en `src/assets/fonts/eb-garamond/OFL.txt`.

Ambas familias son diseños digitales contemporáneos con referencias históricas; el proyecto no las presenta como facsímiles de una cultura o fecha específicas.

## Familias consideradas y descartadas

| Familia | Resultado | Motivo |
|---|---|---|
| Alegreya | elegida | ritmo literario, español sólido e itálicas expresivas |
| EB Garamond | elegida | autoridad, jerarquía y repertorio OpenType amplio |
| Cormorant Garamond | descartada | demasiado delicada y escénica para columnas pequeñas |
| IM FELL English | descartada | textura fuerte, pero excesivamente inglesa y teatral para lectura extensa en español |
| Junicode | descartada | riqueza medieval sobresaliente, pero densidad especializada innecesaria para este artefacto |

## Mapa de manos

| Estrato | Token | Familia y tratamiento | Pigmento |
|---|---|---|---|
| Custodio | `--font-custodian` | Alegreya 400; 15 px/1.5; ligaduras y kerning | pardo ferroso `#3f2d1e` |
| Exégeta | `--font-exegete` | EB Garamond 600; 0.98 em; versalitas en aparato y jerarquías | negro oxidado `#18110d` |
| Raspada | `--font-scratched-hand` | Alegreya itálica 600; presión, inclinación y escala deterministas | rojo de raíz `#783b27` |
| Imposible | `--font-impossible-hand` | EB Garamond 500; espaciado amplio; ligaduras desactivadas | gris frío `#3f403a` |
| Intervención moderna | `--font-modern-editor`, `--font-modern-code` | Inter y DM Mono, siempre fuera del cuerpo sagrado | grafito neutro |
| Anterior / Lengua Semilla | `--font-seed-language` | sistema SVG propio; no imita una escritura humana histórica | carbón mineral |

Los fallbacks del artefacto solo operan ante fallo excepcional. En funcionamiento normal todas las fuentes son locales.

## Jerarquía y detalle

- **Cuerpo:** 15 px con interlínea 1.5; dos columnas en escritorio, una en móvil.
- **Glosas:** 10.5 px con interlínea 1.48, separadas del flujo principal.
- **Rúbricas:** EB Garamond en versalitas reales, espaciado de 0.075 em y pigmento rojo oscuro.
- **Capitulares:** letra de texto seleccionable dentro de nueve marcos SVG —agua, sendero, semilla, ojo, cuerda, cicatriz, puerta, estrella y círculo abierto— asignados de manera fija a los nueve fragmentos.
- **Apertura:** solo las primeras palabras reciben pigmento rubricado; el rojo no invade el cuerpo.
- **Irregularidad:** inclinaciones y cambios de tamaño siguen selectores estables. No existe aleatoriedad de render ni ruido aplicado carácter por carácter.

## Repertorio y funciones OpenType

La auditoría binaria de los diez archivos históricos verificó acentos españoles, `Ñ/ñ`, `Ü/ü`, signos invertidos, guillemets, raya, elipsis y `α/β`. Alegreya y EB Garamond conservan `liga`, `dlig`, `smcp`, `c2sc`, `onum` y `kern`. Las instancias WOFF2 son estáticas para asegurar incrustación correcta en PDF y evitar el contorneado Type 3 observado con las variables.

## Archivos y licencias

- Fuentes históricas: `src/assets/fonts/alegreya/` y `src/assets/fonts/eb-garamond/`.
- Interfaz moderna: `src/assets/fonts/interface/`, con licencias OFL de Inter y DM Mono.
- Tokens y declaraciones: `src/styles/codex-typography.css`.
- Espécimen interno: `/codice/tipografia`.
- Componentes dibujados: `src/components/codex/CodexDropCap.tsx` y `SeedGlyph.tsx`.

## Prohibiciones

- No asignar una familia decorativa distinta a cada mano.
- No sustituir la Lengua Semilla por cuneiforme Unicode ni por una fuente humana histórica.
- No usar rojo brillante, negrita sintética, cursiva sintética o variación aleatoria.
- No emplear versalitas CSS falsas cuando exista `smcp/c2sc`.
- No mezclar Inter o DM Mono con la superficie sagrada.
- No inferir fecha, cultura de origen o autenticidad histórica a partir de estas tipografías.

## Validación

- Nueve fragmentos renderizados sin desbordamiento horizontal.
- Vista móvil en una columna, sin recorte.
- Compilación sin solicitudes a `fonts.googleapis.com` ni `fonts.gstatic.com`.
- PDF A4 de una página con texto extraíble y familias históricas incrustadas como Type 0.
- Espécimen visual y pruebas automatizadas disponibles para regresión.
