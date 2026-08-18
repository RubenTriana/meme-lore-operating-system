(function () {
  "use strict";

  const STORAGE = {
    view: "tantalo.monitor.view.v1",
    scanlines: "tantalo.monitor.scanlines.v1",
    contrast: "tantalo.monitor.contrast.v1",
    textZoom: "tantalo.monitor.text-zoom.v1"
  };
  const SCOPES = ["pregunta", "fragmento", "escena", "capítulo", "novela", "saga"];
  const DEPTH_LABELS = ["DIRECTO", "ASISTENCIA", "ESPECIALISTA", "CONTRASTE", "LABORATORIO", "AUDITORÍA"];
  const STATUS_ICONS = { PLANIFICADO: "◇", SOLICITADO: "▷", ACTIVO: "●", INFERIDO: "≈", "EN ESPERA": "○", COMPLETADO: "✓", VETO: "⛔", ERROR: "!", CANCELADO: "×" };
  const state = {
    registries: null,
    workflows: null,
    currentFlow: null,
    graph: null,
    cy: null,
    selectedNodeId: null,
    isolate: false,
    paused: false,
    showWaiting: false,
    filter: "all",
    view: localStorage.getItem(STORAGE.view) || "radial",
    textZoom: clampTextZoom(Number(localStorage.getItem(STORAGE.textZoom)) || 2.5),
    requestedDepth: 1,
    highDepthConfirmed: false,
    events: [],
    telemetry: new TantaloTelemetryClient()
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function clampTextZoom(value) {
    return Math.min(3, Math.max(1, Math.round(Number(value || 2.5) * 4) / 4));
  }

  window.addEventListener("tantalo:flow-preview", (event) => {
    if (!event.detail?.flow || !state.registries) return;
    setFlow(event.detail.flow, "panel");
  });
  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    bindControls();
    applyDisplayPreferences();
    try {
      const [skills, agents, protocols, relations, depths, workflows] = await Promise.all([
        readJson("data/skill-registry.json"),
        readJson("data/agent-registry.json"),
        readJson("data/protocol-registry.json"),
        readJson("data/graph-relations.json"),
        readJson("data/depth-levels.json"),
        readJson("workflows.json")
      ]);
      state.registries = { skills, agents, protocols, relations, depths };
      state.workflows = workflows;
      populatePresetSelector();
      populateDepthLegend();
      const initial = workflows.presets.find((item) => item.id === "continuar-escribiendo") || workflows.presets[0];
      setFlow(TantaloPanel.normalizeFlow(initial), "initial");
      setMonitorStatus("PREVISUALIZACIÓN DE FLUJO", "planned", "Sin conexión a una ejecución real.");
    } catch (error) {
      controlledError(`No se pudo iniciar el monitor: ${error.message}`);
    }
  }

  async function readJson(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    const data = await response.json();
    if (!data || Number(data.schemaVersion ?? data.version) !== 1) throw new Error(`${path}: esquema no compatible`);
    return data;
  }

  function bindControls() {
    $("#monitorPreset").addEventListener("change", selectPreset);
    $("#monitorView").addEventListener("change", (event) => {
      state.view = event.target.value;
      localStorage.setItem(STORAGE.view, state.view);
      runLayout();
    });
    $("#monitorFilter").addEventListener("change", (event) => {
      state.filter = event.target.value;
      applyVisibility();
    });
    $("#monitorNodeSelect").addEventListener("change", (event) => selectNode(event.target.value));
    $("#monitorTextZoom").addEventListener("input", (event) => setTextZoom(Number(event.target.value) / 100));
    $("#monitorZoomOut").addEventListener("click", () => setTextZoom(state.textZoom - .25));
    $("#monitorZoomIn").addEventListener("click", () => setTextZoom(state.textZoom + .25));
    $("#monitorZoomDefault").addEventListener("click", () => setTextZoom(2.5));
    $("#showWaiting").addEventListener("change", (event) => {
      state.showWaiting = event.target.checked;
      regenerateGraph();
    });
    $("#liveTelemetry").addEventListener("change", toggleLiveTelemetry);
    $("#flowAnimation").addEventListener("change", (event) => {
      document.documentElement.classList.toggle("monitor-flow-motion", event.target.checked && !state.paused);
    });
    $("#allowWeb").addEventListener("change", updateFromSwitches);
    $("#allowSubagents").addEventListener("change", updateFromSwitches);
    $("#allowFileChanges").addEventListener("change", updateFromSwitches);
    $("#blindComparison").addEventListener("change", updateFromSwitches);
    $("#updateMemory").addEventListener("change", updateFromSwitches);
    $("#scopeKnob").addEventListener("input", updateScope);
    $("#depthKnob").addEventListener("input", updateDepth);
    TantaloMonitorAccessibility.bindRangeButtons($("#scopeKnob"), $("#scopeMinus"), $("#scopePlus"));
    TantaloMonitorAccessibility.bindRangeButtons($("#depthKnob"), $("#depthMinus"), $("#depthPlus"));
    ["rigor", "creativity", "canonProtection", "voiceProtection", "consumptionLimit"].forEach((id) => {
      $(`#${id}`).addEventListener("input", updateSliders);
    });
    $("#centerNetwork").addEventListener("click", () => state.cy?.fit(undefined, 42));
    $("#isolateRoute").addEventListener("click", toggleIsolate);
    $("#showDetails").addEventListener("click", () => $("#monitorNodeSelect").focus());
    $("#monitorBack").addEventListener("click", clearSelection);
    $("#monitorReset").addEventListener("click", resetMonitor);
    $("#pauseMonitor").addEventListener("click", togglePause);
    $("#stopExecution").addEventListener("click", () => controlledError("Detener ejecución no está disponible sin telemetría real conectada."));
    $("#copyMonitorReport").addEventListener("click", copyReport);
    $("#monitorOpenCodex").addEventListener("click", openPreparedFlow);
    $("#loadSimulation").addEventListener("click", loadSimulation);
    $("#clearSimulation").addEventListener("click", () => {
      state.events = [];
      regenerateGraph();
      setMonitorStatus("PREVISUALIZACIÓN DE FLUJO", "planned", "La simulación fue retirada.");
    });
    $("#scanlinesToggle").addEventListener("change", updateDisplayPreferences);
    $("#highContrastToggle").addEventListener("change", updateDisplayPreferences);
    state.telemetry.addEventListener("status", onTelemetryStatus);
    state.telemetry.addEventListener("event", (event) => {
      if (state.paused) return;
      state.events.push(event.detail);
      state.events = state.events.slice(-80);
      state.graph = TantaloGraphEngine.applyEvents(state.graph, state.events, false);
      renderGraph();
      setMonitorStatus("MONITOR EN VIVO", "live", "Eventos confirmados por el puente local.");
    });
    document.addEventListener("visibilitychange", () => {
      document.documentElement.classList.toggle("monitor-flow-motion", !document.hidden && $("#flowAnimation").checked && !state.paused);
    });
  }

  function populatePresetSelector() {
    const select = $("#monitorPreset");
    select.replaceChildren(...state.workflows.presets.map((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.title;
      return option;
    }));
  }

  function populateDepthLegend() {
    const list = $("#depthLegend");
    list.replaceChildren(...state.registries.depths.levels.map((level) => {
      const item = document.createElement("li");
      item.innerHTML = `<strong>${level.level} · ${escapeHtml(level.label)}</strong><span>${escapeHtml(level.description)}</span>`;
      return item;
    }));
  }

  function selectPreset(event) {
    const preset = state.workflows.presets.find((item) => item.id === event.target.value);
    if (preset) setFlow(TantaloPanel.normalizeFlow(preset), "preset");
  }

  function setFlow(flow, source) {
    state.currentFlow = TantaloPanel.normalizeFlow(flow);
    state.events = [];
    const estimate = TantaloDepthEngine.estimate(state.currentFlow);
    state.requestedDepth = estimate.estimated;
    state.highDepthConfirmed = source === "preset" && estimate.estimated >= 4;
    syncControls();
    regenerateGraph();
  }

  function syncControls() {
    const flow = state.currentFlow;
    const scope = flow.scope === "selección" ? "fragmento" : flow.scope;
    $("#scopeKnob").value = String(Math.max(0, SCOPES.indexOf(scope)));
    document.documentElement.style.setProperty("--scope-position", String(Math.max(0, SCOPES.indexOf(scope))));
    $("#scopeValue").textContent = scope.toUpperCase();
    $("#depthKnob").value = String(state.requestedDepth);
    document.documentElement.style.setProperty("--depth-position", String(state.requestedDepth));
    $("#depthValue").textContent = DEPTH_LABELS[state.requestedDepth];
    $("#allowWeb").checked = Boolean(flow.options.web);
    $("#allowSubagents").checked = flow.mode !== "Tutor Ligero" && (flow.agents || []).length > 0;
    $("#allowFileChanges").checked = Boolean(flow.options.write);
    $("#blindComparison").checked = Boolean(flow.options.blind);
    $("#updateMemory").checked = Boolean(flow.options.memory);
    $("#monitorPreset").value = state.workflows?.presets.some((item) => item.id === flow.id) ? flow.id : "";
    $("#monitorView").value = state.view;
  }

  function updateScope() {
    const index = Number($("#scopeKnob").value);
    const scope = SCOPES[index];
    $("#scopeValue").textContent = scope.toUpperCase();
    document.documentElement.style.setProperty("--scope-position", String(index));
    state.currentFlow.scope = scope;
    regenerateGraph();
  }

  function updateDepth() {
    const previous = state.requestedDepth;
    const next = Number($("#depthKnob").value);
    if (next >= 4 && !state.highDepthConfirmed) {
      const accepted = confirm(`${DEPTH_LABELS[next]} puede elevar mucho el consumo. ¿Quieres mantener esta profundidad solicitada?`);
      if (!accepted) {
        $("#depthKnob").value = String(previous);
        return;
      }
      state.highDepthConfirmed = true;
    }
    state.requestedDepth = next;
    document.documentElement.style.setProperty("--depth-position", String(next));
    $("#depthValue").textContent = DEPTH_LABELS[next];
    regenerateGraph();
  }

  function updateSliders() {
    ["rigor", "creativity", "canonProtection", "voiceProtection", "consumptionLimit"].forEach((id) => {
      $(`#${id}Value`).textContent = $(`#${id}`).value;
    });
    regenerateGraph();
  }

  function updateFromSwitches() {
    const flow = state.currentFlow;
    flow.options.web = $("#allowWeb").checked;
    flow.options.write = $("#allowFileChanges").checked;
    flow.options.blind = $("#blindComparison").checked;
    flow.options.memory = $("#updateMemory").checked;
    flow.monitorControls = flow.monitorControls || {};
    flow.monitorControls.allowSubagents = $("#allowSubagents").checked;
    regenerateGraph();
  }

  function monitorSettings() {
    return {
      requestedDepth: state.requestedDepth,
      showWaiting: state.showWaiting,
      rigor: Number($("#rigor").value),
      creativity: Number($("#creativity").value),
      canonProtection: Number($("#canonProtection").value),
      voiceProtection: Number($("#voiceProtection").value),
      consumptionLimit: Number($("#consumptionLimit").value),
      allowSubagents: $("#allowSubagents").checked
    };
  }

  function regenerateGraph() {
    if (!state.currentFlow || !state.registries || state.paused) return;
    try {
      state.currentFlow.monitorControls = monitorSettings();
      state.graph = TantaloGraphEngine.buildGraph(state.currentFlow, state.registries, monitorSettings());
      if (state.events.length) state.graph = TantaloGraphEngine.applyEvents(state.graph, state.events, true);
      renderGraph();
      renderMetrics();
      renderWarnings();
      drawScope();
    } catch (error) {
      controlledError(`Grafo rechazado: ${error.message}`);
    }
  }

  function renderGraph() {
    const container = $("#activationGraph");
    const elements = [
      ...state.graph.nodes.map((item) => ({ data: { ...item, statusIcon: STATUS_ICONS[item.status] || "•" } })),
      ...state.graph.edges.map((item, index) => ({ data: { id: `edge:${index}`, ...item } }))
    ];
    if (state.cy) state.cy.destroy();
    state.cy = cytoscape({
      container,
      elements,
      minZoom: .38,
      maxZoom: 2.2,
      wheelSensitivity: .22,
      boxSelectionEnabled: false,
      style: cytoscapeStyles()
    });
    state.cy.on("tap", "node", (event) => selectNode(event.target.id()));
    state.cy.on("tap", (event) => { if (event.target === state.cy) clearSelection(); });
    runLayout();
    populateNodeSelect();
    applyVisibility();
    if (state.selectedNodeId && state.cy.getElementById(state.selectedNodeId).length) selectNode(state.selectedNodeId);
  }

  function cytoscapeStyles() {
    const scaled = (value) => Math.round(value * state.textZoom * 10) / 10;
    return [
      { selector: "node", style: { "background-color": "#102f31", "border-color": "#67d2cc", "border-width": 1.5, color: "#d6f7f2", label: "data(label)", "font-family": "Consolas, monospace", "font-size": scaled(11), "text-wrap": "wrap", "text-max-width": scaled(130), "text-valign": "center", "text-halign": "center", width: scaled(118), height: scaled(48), shape: "round-rectangle", "overlay-opacity": 0 } },
      { selector: 'node[type = "system"]', style: { shape: "hexagon", width: scaled(144), height: scaled(76), "background-color": "#173f3c", "border-width": 3, "font-weight": 700 } },
      { selector: 'node[type = "skill"]', style: { shape: "cut-rectangle", "border-width": 2 } },
      { selector: 'node[type = "protocol"]', style: { height: scaled(32), width: scaled(130), "background-color": "#102526", "font-size": scaled(10) } },
      { selector: 'node[type = "evaluator"]', style: { "border-width": 4, "border-style": "double", "border-color": "#d7b65c" } },
      { selector: 'node[type = "veto"]', style: { shape: "tag", "background-color": "#4a2024", "border-color": "#dc7379", color: "#ffd7d9" } },
      { selector: 'node[type = "result"]', style: { shape: "round-octagon", "background-color": "#163a2c", "border-color": "#72d39b" } },
      { selector: 'node[type = "file"]', style: { shape: "rectangle", width: scaled(104), height: scaled(30), "background-color": "#242b2b", "border-color": "#a8b9b5", color: "#d9e2df", "font-size": scaled(9) } },
      { selector: 'node[status = "EN ESPERA"]', style: { opacity: .28, "border-style": "dashed" } },
      { selector: 'node[status = "VETO"], node[status = "ERROR"]', style: { "background-color": "#4a2024", "border-color": "#dc7379", color: "#ffd7d9" } },
      { selector: 'node[status = "COMPLETADO"]', style: { "border-color": "#72d39b", "background-color": "#163a2c" } },
      { selector: "node:selected", style: { "border-color": "#e9fbff", "border-width": 4, "background-color": "#1b4d50" } },
      { selector: "edge", style: { width: 1.5, "line-color": "#56b9b5", "target-arrow-color": "#56b9b5", "target-arrow-shape": "triangle", "curve-style": "bezier", label: "data(relation)", "font-family": "Consolas, monospace", "font-size": scaled(7), color: "#92b7b4", "text-background-color": "#071011", "text-background-opacity": .78, "text-background-padding": scaled(2), "arrow-scale": Math.max(.75, state.textZoom * .55) } },
      { selector: 'edge[relation = "CONSULTA"]', style: { "line-style": "dashed" } },
      { selector: 'edge[relation = "VALIDA"]', style: { "line-color": "#d7b65c", "target-arrow-color": "#d7b65c" } },
      { selector: 'edge[relation = "VETA"], edge[status = "VETO"], edge[status = "ERROR"]', style: { "line-color": "#dc7379", "target-arrow-color": "#dc7379", width: 2.5 } },
      { selector: 'edge[relation = "LEE"]', style: { "line-color": "#9ba9a7", "target-arrow-color": "#9ba9a7", opacity: .55 } },
      { selector: 'edge[relation = "INTEGRA"], edge[status = "COMPLETADO"]', style: { "line-color": "#72d39b", "target-arrow-color": "#72d39b" } },
      { selector: ".filtered", style: { display: "none" } },
      { selector: ".dimmed", style: { opacity: .1 } },
      { selector: ".route", style: { opacity: 1, "z-index": 10 } }
    ];
  }

  function runLayout() {
    if (!state.cy) return;
    const scale = state.textZoom;
    let options;
    if (state.view === "radial") {
      options = { name: "concentric", animate: false, fit: true, padding: 44, minNodeSpacing: 38 * scale, concentric: (item) => 6 - Number(item.data("depth")), levelWidth: () => 1 };
    } else if (state.view === "hierarchical") {
      options = { name: "breadthfirst", directed: true, animate: false, fit: true, padding: 44, spacingFactor: Math.max(1.35, scale) };
    } else {
      const byDepth = new Map();
      state.cy.nodes().forEach((item) => {
        const depth = Number(item.data("depth"));
        if (!byDepth.has(depth)) byDepth.set(depth, []);
        byDepth.get(depth).push(item.id());
      });
      const positions = {};
      const sequenceById = new Map();
      if (state.view === "timeline") {
        state.cy.nodes().forEach((item) => sequenceById.set(item.id(), 0));
        [...state.graph.edges]
          .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))
          .forEach((edge) => {
            const sourceSequence = sequenceById.get(edge.source) || 0;
            sequenceById.set(edge.target, Math.max(sequenceById.get(edge.target) || 0, sourceSequence + 1));
          });
      }
      [...byDepth.entries()].forEach(([depth, ids]) => ids.forEach((id, index) => {
        positions[id] = state.view === "left-right"
          ? { x: depth * 190 * scale, y: index * 92 * scale }
          : { x: (sequenceById.get(id) || 0) * 150 * scale, y: depth * 96 * scale + index * 12 * scale };
      }));
      options = { name: "preset", positions, fit: true, padding: 48, animate: false };
    }
    state.cy.layout(options).run();
    requestAnimationFrame(() => state.cy?.fit(undefined, 46));
  }

  function populateNodeSelect() {
    const select = $("#monitorNodeSelect");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Seleccionar nodo…";
    select.replaceChildren(placeholder, ...state.graph.nodes.filter((item) => item.status !== "EN ESPERA" || state.showWaiting).map((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${STATUS_ICONS[item.status] || "•"} ${item.label}`;
      return option;
    }));
  }

  function applyVisibility() {
    if (!state.cy) return;
    state.cy.elements().removeClass("filtered");
    const matches = (item) => {
      const type = item.data("type");
      if (item.isEdge()) return true;
      if (!state.showWaiting && item.data("status") === "EN ESPERA") return false;
      if (state.filter === "all") return true;
      if (state.filter === "skills") return type === "skill" || type === "system";
      if (state.filter === "agents") return type === "agent";
      if (state.filter === "evaluators") return type === "evaluator" || type === "veto";
      if (state.filter === "canon") return /canon/i.test(`${item.id()} ${item.data("label")} ${item.data("activationReason")}`);
      if (state.filter === "learning") return /aprendiz|mentor|curadur/i.test(`${item.id()} ${item.data("label")}`);
      if (state.filter === "writing") return /escri|borrador|integrador/i.test(`${item.id()} ${item.data("label")}`);
      if (state.filter === "files") return type === "file";
      if (state.filter === "warnings") return ["veto", "error"].includes(type) || ["VETO", "ERROR"].includes(item.data("status"));
      return true;
    };
    state.cy.nodes().forEach((item) => { if (!matches(item)) item.addClass("filtered"); });
    state.cy.edges().forEach((link) => { if (link.source().hasClass("filtered") || link.target().hasClass("filtered")) link.addClass("filtered"); });
    if (state.isolate) applyIsolation();
  }

  function selectNode(id) {
    if (!id || !state.cy) return;
    const selected = state.cy.getElementById(id);
    if (!selected.length || !selected.isNode()) return;
    state.cy.nodes().unselect();
    selected.select();
    state.selectedNodeId = id;
    $("#monitorNodeSelect").value = id;
    renderInspector(selected.data());
    if (state.isolate) applyIsolation();
  }

  function clearSelection() {
    state.selectedNodeId = null;
    state.cy?.nodes().unselect();
    state.cy?.elements().removeClass("dimmed route");
    $("#monitorNodeSelect").value = "";
    $("#monitorInspectorContent").innerHTML = '<p class="monitor-empty">Selecciona un nodo para inspeccionar propiedades previstas o confirmadas.</p>';
  }

  function renderInspector(item) {
    const meta = item.metadata || {};
    const certainty = meta.statusLabel || (item.source === "telemetry" ? "CONFIRMADO" : "PREVISTO");
    const inbound = state.graph.edges.filter((link) => link.target === item.id).map((link) => state.graph.nodes.find((node) => node.id === link.source)?.label).filter(Boolean);
    const outbound = state.graph.edges.filter((link) => link.source === item.id).map((link) => state.graph.nodes.find((node) => node.id === link.target)?.label).filter(Boolean);
    $("#monitorInspectorContent").innerHTML = `
      <div class="monitor-inspector-title"><span>${escapeHtml(STATUS_ICONS[item.status] || "•")}</span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(certainty)}</small></div></div>
      <dl class="monitor-detail-list">
        <div><dt>Tipo</dt><dd>${escapeHtml(item.type)}</dd></div>
        <div><dt>Estado</dt><dd>${escapeHtml(item.status)}</dd></div>
        <div><dt>Profundidad</dt><dd>${item.depth}</dd></div>
        <div><dt>Costo</dt><dd>${escapeHtml(item.estimatedCost)}</dd></div>
        <div><dt>Razón</dt><dd>${escapeHtml(item.activationReason)}</dd></div>
        <div><dt>Invocado por</dt><dd>${escapeHtml(inbound.join(", ") || "Inicio del flujo")}</dd></div>
        <div><dt>Entrega a</dt><dd>${escapeHtml(outbound.join(", ") || "Sin salida registrada")}</dd></div>
        <div><dt>Archivo autorizado</dt><dd>${escapeHtml(meta.path || (meta.authorized ? item.label : "No aplica"))}</dd></div>
        <div><dt>Especialidad</dt><dd>${escapeHtml(meta.specialty || "No aplica")}</dd></div>
        <div><dt>Resultado</dt><dd>${escapeHtml(meta.resultSummary || "No confirmado")}</dd></div>
        <div><dt>Inicio</dt><dd>${formatTime(item.startTime)}</dd></div>
        <div><dt>Finalización</dt><dd>${formatTime(item.endTime)}</dd></div>
      </dl>`;
  }

  function toggleIsolate() {
    if (!state.selectedNodeId) {
      controlledError("Selecciona primero un nodo para aislar su ruta.");
      return;
    }
    state.isolate = !state.isolate;
    $("#isolateRoute").setAttribute("aria-pressed", String(state.isolate));
    state.isolate ? applyIsolation() : state.cy?.elements().removeClass("dimmed route");
  }

  function applyIsolation() {
    if (!state.cy || !state.selectedNodeId) return;
    const keep = new Set(TantaloGraphEngine.traceRoute(state.graph, state.selectedNodeId).nodeIds);
    state.cy.elements().addClass("dimmed");
    state.cy.nodes().filter((item) => keep.has(item.id())).removeClass("dimmed").addClass("route");
    state.cy.edges().filter((link) => keep.has(link.source().id()) && keep.has(link.target().id())).removeClass("dimmed").addClass("route");
  }

  function renderMetrics() {
    const metrics = state.graph.metrics;
    $("#requestedDepth").textContent = String(state.graph.requestedDepth);
    $("#estimatedDepth").textContent = String(state.graph.estimatedDepth);
    $("#confirmedDepth").textContent = state.graph.confirmedDepth == null ? "—" : String(state.graph.confirmedDepth);
    $("#depthNumber").textContent = String(state.graph.estimatedDepth);
    $("#depthName").textContent = DEPTH_LABELS[state.graph.estimatedDepth];
    $("#depthExplanation").textContent = state.registries.depths.levels[state.graph.estimatedDepth].description;
    $("#costLevel").textContent = state.graph.costLevel;
    $("#riskSkills").textContent = String(state.graph.nodes.filter((item) => item.type === "skill").length);
    $("#riskAgents").textContent = String(state.graph.nodes.filter((item) => item.type === "agent" || item.type === "evaluator").filter((item) => item.status !== "EN ESPERA").length);
    $("#riskFiles").textContent = String(state.graph.nodes.filter((item) => item.type === "file").length);
    $("#riskCandidates").textContent = String(Number(state.currentFlow.options.candidates || 0));
    $("#riskSearches").textContent = state.currentFlow.options.web ? "PERMITIDAS" : "0";
    $("#riskWrites").textContent = state.currentFlow.options.write ? "PERMITIDAS" : "0";
    $("#riskDepth").textContent = `${state.graph.estimatedDepth} · ${DEPTH_LABELS[state.graph.estimatedDepth]}`;
    $$(".depth-ring").forEach((ring) => ring.classList.toggle("reached", Number(ring.dataset.depth) <= state.graph.estimatedDepth));
    document.documentElement.style.setProperty("--depth-angle", `${-90 + state.graph.estimatedDepth * 36}deg`);
    state.graph.metrics = { ...metrics, ...TantaloDepthEngine.estimate(state.currentFlow, state.requestedDepth) };
  }

  function renderWarnings() {
    const list = $("#monitorWarnings");
    const warnings = [...state.graph.warnings];
    if (state.graph.mode === "simulation") warnings.unshift("EJECUCIÓN SIMULADA · NO ES TELEMETRÍA REAL");
    if (!warnings.length) warnings.push("SIN ADVERTENCIAS ACTIVAS");
    list.replaceChildren(...warnings.map((warning) => {
      const item = document.createElement("li");
      item.textContent = warning;
      return item;
    }));
  }

  function drawScope() {
    const canvas = $("#activityScope");
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || 320;
    const height = canvas.clientHeight || 120;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(91, 177, 172, .14)";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    const metrics = state.graph.metrics;
    const traces = [
      { value: metrics.complexity, color: "#65d1ca", offset: .22 },
      { value: metrics.context, color: "#d8b962", offset: .5 },
      { value: metrics.costScore, color: "#dc7379", offset: .78 }
    ];
    traces.forEach((trace) => {
      const amplitude = 4 + trace.value / 14;
      const center = height * trace.offset;
      ctx.beginPath();
      for (let x = 0; x <= width; x += 4) {
        const phase = x / width * Math.PI * (2 + trace.value / 32);
        const envelope = .45 + .55 * Math.sin((x / width) * Math.PI);
        const y = center + Math.sin(phase) * amplitude * envelope;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = trace.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
    $("#complexitySignal").textContent = qualitative(metrics.complexity);
    $("#contextSignal").textContent = qualitative(metrics.context);
    $("#costSignal").textContent = state.graph.costLevel;
  }

  function qualitative(value) {
    return value < 30 ? "BAJA" : value < 58 ? "MEDIA" : value < 80 ? "ALTA" : "MUY ALTA";
  }

  async function toggleLiveTelemetry(event) {
    if (!event.target.checked) {
      state.telemetry.disconnect();
      setMonitorStatus("PREVISUALIZACIÓN DE FLUJO", "planned", "Telemetría desactivada.");
      $("#stopExecution").disabled = true;
      return;
    }
    setMonitorStatus("COMPROBANDO PUENTE LOCAL", "pending", "Solo se consulta 127.0.0.1:8765.");
    const connected = await state.telemetry.connect();
    if (!connected) {
      event.target.checked = false;
      $("#stopExecution").disabled = true;
    }
  }

  function onTelemetryStatus(event) {
    const live = event.detail.mode === "live";
    setMonitorStatus(live ? "MONITOR EN VIVO" : "TELEMETRÍA NO DISPONIBLE", live ? "live" : "error", event.detail.message);
    $("#stopExecution").disabled = !live;
  }

  async function loadSimulation() {
    try {
      const parsed = await state.telemetry.loadSimulation();
      if (parsed.errors.length) controlledError(parsed.errors[0]);
      state.events = parsed.events;
      state.graph = TantaloGraphEngine.applyEvents(TantaloGraphEngine.buildGraph(state.currentFlow, state.registries, monitorSettings()), state.events, true);
      renderGraph();
      renderMetrics();
      renderWarnings();
      drawScope();
      setMonitorStatus("EJECUCIÓN SIMULADA", "simulation", "Datos de prueba locales; ningún evento proviene de Codex.");
    } catch (error) {
      controlledError(`No se pudo cargar la simulación: ${error.message}`);
    }
  }

  function togglePause() {
    state.paused = !state.paused;
    $("#pauseMonitor").textContent = state.paused ? "REANUDAR MONITOR" : "PAUSAR MONITOR";
    document.documentElement.classList.toggle("monitor-flow-motion", !state.paused && $("#flowAnimation").checked);
    setMonitorStatus(state.paused ? "MONITOR EN PAUSA" : state.graph.mode === "simulation" ? "EJECUCIÓN SIMULADA" : "PREVISUALIZACIÓN DE FLUJO", state.paused ? "pending" : state.graph.mode, state.paused ? "El grafo conserva el último estado visible." : "Actualización reanudada.");
    if (!state.paused) regenerateGraph();
  }

  function resetMonitor() {
    state.telemetry.disconnect();
    state.paused = false;
    state.isolate = false;
    state.showWaiting = false;
    state.filter = "all";
    state.view = "radial";
    state.highDepthConfirmed = false;
    state.events = [];
    $("#showWaiting").checked = false;
    $("#liveTelemetry").checked = false;
    $("#monitorFilter").value = "all";
    $("#monitorView").value = "radial";
    $("#rigor").value = "70";
    $("#creativity").value = "35";
    $("#canonProtection").value = "90";
    $("#voiceProtection").value = "90";
    $("#consumptionLimit").value = "55";
    updateSliders();
    selectPreset({ target: { value: "continuar-escribiendo" } });
    clearSelection();
    setMonitorStatus("PREVISUALIZACIÓN DE FLUJO", "planned", "Controles restablecidos.");
  }

  function openPreparedFlow() {
    const flow = TantaloPanel.normalizeFlow(state.currentFlow);
    flow.monitorControls = monitorSettings();
    TantaloPanel.prepareFlow(flow, flow.id || "monitor");
  }

  async function copyReport() {
    const lines = [
      "INFORME DEL MONITOR TÁNTALO",
      `Modo: ${state.graph.mode === "live" ? "MONITOR EN VIVO" : state.graph.mode === "simulation" ? "EJECUCIÓN SIMULADA" : "PREVISUALIZACIÓN"}`,
      `Workflow: ${state.currentFlow.title}`,
      `Profundidad solicitada / prevista / confirmada: ${state.graph.requestedDepth} / ${state.graph.estimatedDepth} / ${state.graph.confirmedDepth ?? "no disponible"}`,
      `Costo cualitativo: ${state.graph.costLevel}`,
      `Nodos: ${state.graph.nodes.filter((item) => item.status !== "EN ESPERA").map((item) => `${item.label} [${item.status}]`).join(" → ")}`,
      `Advertencias: ${state.graph.warnings.join("; ") || "ninguna"}`
    ];
    const report = lines.join("\n");
    try {
      await navigator.clipboard.writeText(report);
      announce("Informe copiado.");
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = report;
      fallback.setAttribute("readonly", "");
      fallback.className = "sr-only";
      document.body.append(fallback);
      fallback.select();
      const copied = document.execCommand("copy");
      fallback.remove();
      announce(copied ? "Informe copiado." : "No se pudo copiar automáticamente el informe.");
    }
  }

  function updateDisplayPreferences() {
    const scanlines = $("#scanlinesToggle").checked;
    const contrast = $("#highContrastToggle").checked;
    localStorage.setItem(STORAGE.scanlines, String(scanlines));
    localStorage.setItem(STORAGE.contrast, String(contrast));
    document.documentElement.classList.toggle("monitor-no-scanlines", !scanlines);
    document.documentElement.classList.toggle("monitor-high-contrast", contrast);
  }

  function setTextZoom(value, persist = true) {
    state.textZoom = clampTextZoom(value);
    const percent = Math.round(state.textZoom * 100);
    const monitor = $("#monitor");
    monitor.style.setProperty("--monitor-text-zoom", String(state.textZoom));
    monitor.dataset.textZoom = String(percent);
    monitor.dataset.textZoomLarge = String(state.textZoom >= 1.75);
    $("#monitorTextZoom").value = String(percent);
    $("#monitorTextZoomValue").value = `${percent} %`;
    $("#monitorTextZoomValue").textContent = `${percent} %`;
    if (persist) localStorage.setItem(STORAGE.textZoom, String(state.textZoom));
    if (state.cy) {
      state.cy.style(cytoscapeStyles());
      runLayout();
    }
    announce(`Zoom del texto: ${state.textZoom.toLocaleString("es-ES")} por.`);
  }

  function applyDisplayPreferences() {
    $("#scanlinesToggle").checked = localStorage.getItem(STORAGE.scanlines) !== "false";
    $("#highContrastToggle").checked = localStorage.getItem(STORAGE.contrast) === "true";
    updateDisplayPreferences();
    setTextZoom(state.textZoom, false);
  }

  function setMonitorStatus(label, stateName, explanation) {
    $("#monitorModeLabel").textContent = label;
    $("#monitorModeLabel").dataset.state = stateName;
    $("#monitorModeExplanation").textContent = explanation;
  }

  function controlledError(message) {
    setMonitorStatus("ERROR CONTROLADO", "error", message);
    announce(message);
  }

  function announce(message) {
    TantaloMonitorAccessibility.announce($("#monitorAnnouncement"), message);
  }

  function formatTime(value) {
    if (!value) return "No confirmado";
    const date = new Date(Number(value));
    return Number.isNaN(date.getTime()) ? "No confirmado" : date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  window.TantaloMonitor = {
    getState: () => ({ graph: state.graph, flow: state.currentFlow, view: state.view, filter: state.filter }),
    setFlow,
    loadSimulation,
    validateGraph: TantaloGraphEngine.validateGraph
  };
})();
