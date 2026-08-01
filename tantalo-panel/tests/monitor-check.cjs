"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
["depth-engine.js", "activity-scope.js", "graph-engine.js"].forEach((name) => {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, "monitor", name), "utf8"), { filename: name });
});

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(ROOT, name), "utf8"));
const workflows = readJson("workflows.json");
const registries = {
  skills: readJson("data/skill-registry.json"),
  agents: readJson("data/agent-registry.json"),
  protocols: readJson("data/protocol-registry.json"),
  relations: readJson("data/graph-relations.json"),
  depths: readJson("data/depth-levels.json")
};
const defaults = { web: false, additionalFiles: false, propose: false, write: false, memory: false, generate: false, candidates: 0, blind: false };
const preset = (id) => {
  const item = [...workflows.presets, ...workflows.actions].find((entry) => entry.id === id);
  assert.ok(item, `Preset inexistente: ${id}`);
  return { ...item, agents: [...(item.agents || [])], options: { ...defaults, ...(item.options || {}) } };
};
const build = (id, settings = {}) => globalThis.TantaloGraphEngine.buildGraph(preset(id), registries, settings);

const light = build("continuar-escribiendo");
assert.equal(light.mode, "preview", "El preset ligero debe ser previsualización");
assert.equal(light.costLevel, "BAJO", "El preset ligero debe mantener costo bajo");
assert.ok(light.nodes.some((node) => node.id === "agent:tutor-narrativo"), "Falta el tutor narrativo");

const learning = build("microaprendizaje");
assert.ok(learning.nodes.some((node) => node.id === "agent:mentor-aprendizaje"), "Falta el mentor de aprendizaje");
assert.ok(learning.nodes.some((node) => node.id === "protocol:curaduria-minima"), "Falta curaduría mínima");

const review = build("revision-capitulo");
assert.ok(review.estimatedDepth >= 3, "La revisión debe llegar a contraste");
assert.equal(review.nodes.filter((node) => node.type === "agent").length, 2, "La revisión debe conservar dos especialistas");

const tournament = build("torneo-versiones");
assert.equal(tournament.estimatedDepth, 5, "El torneo debe llegar a auditoría");
assert.equal(tournament.costLevel, "MUY ALTO", "El torneo debe advertir costo muy alto");
assert.ok(tournament.nodes.some((node) => node.id === "process:candidates"), "Faltan candidatos");
assert.ok(tournament.nodes.some((node) => node.id === "evaluator:blind"), "Falta comparación ciega");

const waiting = build("continuar-escribiendo", { showWaiting: true });
assert.ok(waiting.nodes.filter((node) => node.status === "EN ESPERA").length >= 10, "Deben aparecer módulos en espera");

const route = globalThis.TantaloGraphEngine.traceRoute(tournament, "result:output");
assert.ok(route.nodeIds.includes("system:tantalus") && route.nodeIds.includes("result:output"), "La ruta aislada debe unir inicio y resultado");
assert.ok(route.edges.length >= 4, "La ruta aislada perdió conexiones");

assert.ok(["radial", "hierarchical", "left-right", "timeline"].every((value) => fs.readFileSync(path.join(ROOT, "index.html"), "utf8").includes(`value="${value}"`)), "Falta una vista del monitor");
const monitorSource = fs.readFileSync(path.join(ROOT, "monitor", "monitor.js"), "utf8");
const monitorMarkup = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const monitorStyles = fs.readFileSync(path.join(ROOT, "monitor", "monitor.css"), "utf8");
const panelStyles = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
const panelSource = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
const loreContextSource = fs.readFileSync(path.join(ROOT, "lore-context-client.js"), "utf8");
const launcherSource = fs.readFileSync(path.resolve(ROOT, "..", "ABRIR_PANEL_TANTALO.ps1"), "utf8");
const panelMark = fs.readFileSync(path.join(ROOT, "assets", "tantalo-mark.svg"), "utf8");
assert.ok(monitorSource.includes("monitorFilter"), "Faltan filtros");
assert.equal(workflows.version, 1, "El catálogo histórico debe conservar su versión");
assert.ok(monitorSource.includes("data.schemaVersion ?? data.version"), "El monitor debe aceptar ambos campos de versión compatibles");
assert.ok(monitorMarkup.includes('id="monitorTextZoom"') && monitorMarkup.includes('value="250"'), "Falta el zoom de texto al 250 %");
assert.ok(monitorSource.includes("tantalo.monitor.text-zoom.v1") && monitorSource.includes("setTextZoom"), "El zoom no se conserva ni actualiza");
assert.ok(monitorStyles.includes("--monitor-text-zoom: 2.5") && monitorStyles.includes('data-text-zoom-large="true"'), "Falta la escala tipográfica 2,5x o su reflujo");
assert.ok(panelStyles.includes("Shared late-1990s industrial console skin") && panelStyles.includes(".workflow-card::before") && panelStyles.includes("dialog::backdrop"), "El estilo industrial no cubre toda la interfaz");
assert.ok(panelStyles.includes("--font-display: Georgia") && panelStyles.includes("font-family: var(--font-display)"), "Los títulos principales no usan la tipografía editorial compartida");
assert.ok(monitorMarkup.includes('id="openLoreSystem"') && monitorMarkup.includes('id="loreSystemFrame"'), "Falta la pestaña integrada de LoreSystem v2");
assert.ok(panelSource.includes("activateLoreSystem") && panelSource.includes('params.get("lore")'), "LoreSystem v2 no se activa desde la URL del lanzador");
assert.ok(panelSource.includes('fetch(target.href') && panelSource.includes("LORESYSTEM NO RESPONDE"), "La pestaña no verifica la conexión real con LoreSystem v2");
assert.ok(launcherSource.includes('$loreServer = Start-Process') && launcherSource.includes('&lore=$encodedLoreUrl'), "El lanzador no inicia o enlaza LoreSystem v2");
assert.ok(panelMark.includes("#65D1CA") && panelMark.includes("#DC7379"), "La marca no usa la paleta compartida cian/roja");
assert.ok(fs.readFileSync(path.join(ROOT, "monitor", "monitor-accessibility.js"), "utf8").includes('addEventListener("wheel"'), "Los reguladores no aceptan rueda");
assert.ok(fs.readFileSync(path.join(ROOT, "monitor", "monitor.css"), "utf8").includes("prefers-reduced-motion"), "Falta prefers-reduced-motion");

assert.ok(monitorMarkup.includes('id="loreContextStatus"') && monitorMarkup.includes("lore-context-client.js"), "Falta el estado o el cliente de consulta selectiva");
assert.ok(panelSource.includes("TantaloLoreContext?.plan") && panelSource.includes("resolveLoreContext"), "El Centro de Control no prepara consultas reales a LoreSystem v2");
assert.ok(panelSource.includes("plan.request?.domains"), "La consulta debe leer los dominios del contrato de API");
assert.ok(panelStyles.includes(".lore-context-query") && panelStyles.includes('data-state="full"'), "Falta la señal visual del contexto consultado");

const loreSandbox = { window: {}, location: { href: "http://127.0.0.1:54695/tantalo-panel/" } };
vm.runInNewContext(loreContextSource, loreSandbox, { filename: "lore-context-client.js" });
const loreClient = loreSandbox.window.TantaloLoreContext;
const ordinaryPlan = loreClient.plan(preset("continuar-escribiendo"));
assert.equal(ordinaryPlan.required, false, "Un flujo ordinario no debe consultar LoreSystem sin necesidad");
const psychologyPlan = loreClient.plan(preset("revisar-personajes"));
assert.equal(psychologyPlan.required, true, "La revisión de personajes debe consultar contexto");
assert.ok(psychologyPlan.request.domains.includes("psychology"), "La revisión de personajes debe limitarse a psicología");
assert.equal(psychologyPlan.request.depth, 2, "La revisión de capítulo debe mantener profundidad selectiva 2");
assert.equal(psychologyPlan.deferred, true, "Sin personaje concreto la consulta debe quedar en espera");
const ruthPlan = loreClient.plan({ ...preset("revisar-personajes"), title: "Revisar a Ruth", intent: "Contrasta la psicología de Ruth con su ficha." });
assert.equal(ruthPlan.deferred, false, "Un personaje concreto debe habilitar la consulta selectiva");
assert.ok(ruthPlan.request.terms.includes("Ruth"), "El referente concreto debe viajar como término de consulta");
const tournamentPlan = loreClient.plan(preset("torneo-versiones"));
assert.equal(tournamentPlan.request.depth, 4, "Un torneo directo no debe asumir profundidad integral");
assert.equal(tournamentPlan.request.allowFullContext, false, "El contexto integral exige profundidad 5 explícita");
const tournamentFive = loreClient.plan({ ...preset("torneo-versiones"), monitorControls: { requestedDepth: 5 } });
assert.equal(tournamentFive.request.allowFullContext, true, "El torneo profundo de nivel 5 debe poder solicitar contexto integral");

const invalid = globalThis.TantaloGraphEngine.validateGraph({ nodes: [{ id: "broken" }], edges: [] });
assert.equal(invalid.valid, false, "Un grafo inválido no debe aceptarse");

const jsonl = fs.readFileSync(path.join(ROOT, "telemetry", "sample-events.jsonl"), "utf8");
const parsed = globalThis.TantaloActivityScope.parseJsonLines(jsonl);
assert.equal(parsed.errors.length, 0, "La simulación contiene eventos inválidos");
assert.ok(parsed.events.length >= 7, "La simulación necesita una secuencia completa");
const corrupt = globalThis.TantaloActivityScope.parseJsonLines('{"method":\nno-json');
assert.ok(corrupt.errors.length >= 1, "El JSON corrupto debe producir error controlado");

const canon = build("comprobar-continuidad");
const simulated = globalThis.TantaloGraphEngine.applyEvents(canon, parsed.events, true);
assert.equal(simulated.mode, "simulation", "La muestra no debe llamarse monitor en vivo");
assert.equal(simulated.nodes.find((node) => node.id === "veto:canon").status, "VETO", "Falta el veto simulado");
assert.equal(simulated.confirmedDepth, null, "Una simulación no confirma profundidad");

const errorEvent = globalThis.TantaloActivityScope.sanitizeEvent({ method: "item/completed", timestamp: 1, data: { nodeId: "result:output", status: "ERROR", summary: "Error de prueba" } });
const errored = globalThis.TantaloGraphEngine.applyEvents(light, [errorEvent], true);
assert.equal(errored.nodes.find((node) => node.id === "result:output").status, "ERROR", "Falta el estado ERROR");

const telemetrySource = fs.readFileSync(path.join(ROOT, "monitor", "telemetry-client.js"), "utf8");
assert.ok(telemetrySource.includes("127.0.0.1:8765"), "La telemetría debe limitarse a localhost");
assert.ok(telemetrySource.includes('mode = "unavailable"'), "Falta el estado de telemetría no disponible");

console.log("Monitor Tántalo: 37 escenarios estructurales superados.");
