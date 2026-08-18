# Telemetría del Monitor Tántalo

El monitor funciona completamente en **Previsualización de flujo** sin Codex, API, internet ni consumo de tokens. `sample-events.jsonl` permite comprobar estados, vetos y errores, pero se muestra siempre como **EJECUCIÓN SIMULADA**.

## Estado de la integración real

Codex app-server ofrece un protocolo bidireccional similar a JSON-RPC sobre JSONL. El transporte estable y predeterminado es `stdio`; el WebSocket de red está documentado como experimental y no se utiliza aquí.

La versión de Codex Desktop instalada contiene `codex app-server`, pero Windows deniega su ejecución desde este repositorio. Además, iniciar otro app-server no proporciona un mecanismo estable para adjuntarse a una tarea ya abierta por Codex Desktop. Por esas razones no se instala un puente que pudiera fingir telemetría o iniciar ejecuciones paralelas sin autorización.

La interfaz prueba exclusivamente `http://127.0.0.1:8765/health` cuando el usuario activa **Telemetría en vivo**. Si no recibe un descriptor explícito `{ "service": "tantalo-telemetry", "transport": "stdio" }`, vuelve a Previsualización y muestra `TELEMETRÍA NO DISPONIBLE`.

Un puente futuro deberá:

- escuchar únicamente en `127.0.0.1`;
- poseer la conexión `stdio` del app-server y realizar `initialize`/`initialized`;
- exponer al navegador solo eventos sanitizados mediante `/health` y `/events`;
- aceptar únicamente los métodos definidos en `monitor/activity-scope.js`;
- eliminar texto extenso, rutas absolutas, secretos y razonamiento privado;
- no aceptar comandos, rutas o prompts desde el navegador;
- no afirmar estados confirmados antes de recibir eventos reales.

Documentación oficial consultada: `https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md`.

## Archivos de muestra

- `sample-events.jsonl`: eventos locales deliberadamente ficticios.
- `runtime-state.example.json`: forma reducida de un estado de ejecución; no contiene contenido narrativo.
