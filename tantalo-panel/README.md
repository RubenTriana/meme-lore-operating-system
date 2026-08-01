# Centro de Control Tántalo

Panel web local para descubrir los flujos de Sistema Tántalo y preparar prompts revisables para Codex. No envía mensajes, no inicia agentes y no escribe en el manuscrito.

Toda la interfaz comparte un lenguaje de consola industrial de finales de los noventa: metal oscuro, pantallas verdosas, indicadores cian/ámbar/rojo, controles físicos y esquinas técnicas. Es una interpretación original de supervivencia tecnológica; no incorpora logotipos ni recursos de videojuegos.

Los títulos principales usan una serif editorial de alto contraste —Georgia con respaldo Times— para separar la voz narrativa de los controles monoespaciados del sistema.

El botón superior **LoreSystem v2** abre la aplicación React actual dentro de una pestaña integrada. La interfaz se carga solo al pulsarlo y puede recargarse o cerrarse sin abandonar el Centro de Control.
El lanzador prefiere el puerto local `5173` para conservar compatibilidad con paneles que ya estaban abiertos, reutiliza una instancia válida si existe y solo anuncia **EN LÍNEA** después de comprobar que la respuesta pertenece realmente a LoreSystem.

## API selectiva de contexto

El Centro de Control decide por cada flujo si necesita datos canónicos. Un flujo ordinario no abre LoreSystem ni consulta su base. Las revisiones que sí lo necesitan envían una consulta concreta de solo lectura a `POST /api/tantalo/context/query`, limitada por dominio, términos, entidades, profundidad y número de resultados. El estado visible del cuadro de prompt informa los módulos y registros devueltos.

Dominios disponibles: canon, lore, continuidad/compatibilidad, personajes/psicología, cronología, estructura, misterios, mundo y versiones. `GET /api/tantalo/context/health` expone el estado y la política, pero no devuelve el contenido narrativo.

El contexto integral está bloqueado por defecto. La API solo lo acepta cuando coinciden las cuatro condiciones: profundidad `5`, modo `Profundo`, permiso integral explícito y un workflow autorizado, como torneo de versiones, comparación ciega o auditoría canónica. Esta regla se valida en el servidor, no sólo en la interfaz. Ambos endpoints aceptan exclusivamente conexiones y orígenes locales; no escriben en `data/universe_master.json`.

## Monitor de red narrativa

La sección **Mapa de activación** convierte cada preset o configuración en un grafo dirigido de Sistema Tántalo, protocolos, agentes, evaluadores, archivos y resultado. La vista inicial siempre se identifica como **PREVISUALIZACIÓN DE FLUJO**: muestra lo que el prompt solicitará, no afirma que esos componentes estén ejecutándose.

Controles disponibles:

- vistas radial, jerárquica, izquierda a derecha y temporal;
- texto ampliado al `250 %` por defecto y barra de zoom rápido entre `100 %` y `300 %`, recordada localmente;
- filtros por skills, agentes, evaluadores, canon, aprendizaje, escritura, archivos y advertencias;
- reguladores de alcance y profundidad mediante ratón, rueda, teclado y botones `+`/`−`;
- rigor, creatividad, protección de canon, protección de voz y límite de consumo, incorporados al prompt generado;
- módulos en espera, aislamiento de ruta, inspección de nodos, osciloscopio determinista y simulación local;
- modo sin scanlines, alto contraste y reducción automática de movimiento.

Las preferencias puramente visuales se guardan en `localStorage`. No se guarda texto narrativo.

## Previsualización, simulación y telemetría

- **PREVISUALIZACIÓN DE FLUJO:** modo normal, completamente local y sin consumo de tokens.
- **EJECUCIÓN SIMULADA:** reproduce `telemetry/sample-events.jsonl` para comprobar estados. Nunca se etiqueta como confirmada.
- **MONITOR EN VIVO:** solo aparece después de que un puente local válido responda en `127.0.0.1:8765` y entregue eventos sanitizados.

La integración real no está habilitada en esta instalación. Codex app-server ofrece `stdio` JSONL como transporte estable, pero el ejecutable empaquetado de Codex Desktop no puede iniciarse desde este repositorio y no existe un mecanismo estable para adjuntar otro app-server a la tarea de Desktop ya abierta. Consulta `telemetry/README.md` para el contrato de un puente futuro.

## Dependencia gráfica

El grafo usa Cytoscape.js 3.34.0, incluido localmente en `vendor/cytoscape.min.js` bajo licencia MIT. El uso normal no accede a CDN ni a recursos externos. La versión, licencia e integridad están documentadas en `vendor/README.md`.

## Abrir el panel

En Windows, ejecuta `ABRIR_PANEL_TANTALO.bat`. El lanzador:

1. detecta la raíz del repositorio;
2. busca Python y Node.js/npm sin instalar software;
3. inicia el panel y LoreSystem v2 en puertos disponibles, enlazados exclusivamente a `127.0.0.1`;
4. abre el panel, configura la ruta del repositorio y entrega la URL interna de LoreSystem a la pestaña integrada.

También puedes ejecutar en PowerShell:

```powershell
.\ABRIR_PANEL_TANTALO.ps1
```

Para iniciar el servidor sin abrir el navegador, usa `-NoBrowser`.

## Configurar la ruta

El lanzador incorpora la ruta absoluta mediante el parámetro local `?repo=`. Si abres `index.html` de otra manera, escribe la ruta en el campo superior y selecciona **Guardar**. Solo la ruta queda en `localStorage`; no se almacena el manuscrito ni el contenido de los archivos de estado.

## Lanzar una acción

1. Elige una acción frecuente, preset o herramienta.
2. Revisa el modo, el consumo estimado, las advertencias y el prompt.
3. Edita el prompt si lo necesitas.
4. Selecciona **Abrir en Codex**. Se crea un chat con `codex://new`, pero el mensaje queda en el compositor y no se envía.

Usa **Copiar prompt** si el protocolo `codex://` no responde. **Abrir Skills** utiliza `codex://skills`.

## Presets y acciones

- Edita `presets` en `workflows.json` para cambiar las tarjetas destacadas.
- Añade una acción al arreglo `actions` con un `id` único, título, categoría, modo, objetivo, alcance e intención.
- Conserva las categorías existentes o agrega la nueva categoría al arreglo `categories`.
- No incluyas documentación completa en `intent`; el prompt invoca `$sistema-tantalo`.

Después de editar el catálogo, valida el JSON y recarga el navegador.

## Consumo

- **Bajo:** Tutor Ligero, alcance breve y sin operaciones adicionales.
- **Medio:** capítulo o lectura adicional limitada.
- **Alto:** modo profundo, varios agentes, escritura o candidatos.
- **Muy alto:** combina varias operaciones costosas; exige confirmación adicional.

La estimación es cualitativa. Considera modo, alcance, agentes, web, lectura adicional, candidatos, comparación ciega, escritura y memoria; no pretende calcular tokens.

## Solución de problemas

- **No abre el panel:** ejecuta el `.bat` desde la raíz y comprueba que Python responda a `py -3 --version` o `python --version`.
- **No aparece el estado:** no abras el HTML con `file://`; usa el servidor local para que `fetch` pueda leer los Markdown.
- **Codex no se abre:** confirma que Codex esté instalado y asociado al protocolo `codex://`; mientras tanto usa **Copiar prompt**.
- **Ruta incorrecta:** reemplázala en el campo superior y pulsa **Guardar**.
- **Puerto ocupado:** reinicia el lanzador; elige un puerto disponible automáticamente.

## Seguridad

El servidor escucha solo en localhost. El panel no contiene servicios externos, no almacena secretos, no ejecuta comandos, no abre varios chats y nunca envía un prompt automáticamente.

La telemetría acepta únicamente una lista reducida de identificadores, estados, operaciones, tiempos, métricas, rutas relativas y resúmenes breves. Descarta métodos desconocidos, rutas ascendentes, URLs y JSON corrupto. No intenta mostrar razonamiento privado.

## Pruebas

Ejecuta:

```powershell
node tantalo-panel/tests/monitor-check.cjs
python .agents/skills/sistema-tantalo/scripts/comprobar_estructura.py
```

La primera prueba cubre presets ligeros y profundos, módulos en espera, aislamiento, vistas, reguladores, filtros, reducción de movimiento, JSON inválido, telemetría no disponible, simulación, costo muy alto, veto y error.
