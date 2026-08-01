(() => {
  "use strict";

  const STORAGE = {
    favorites: "tantalo.favorites.v1",
    recent: "tantalo.recent.v1",
    repoPath: "tantalo.repoPath.v1",
    category: "tantalo.category.v1"
  };

  const DEFAULT_OPTIONS = {
    web: false,
    additionalFiles: false,
    propose: false,
    write: false,
    memory: false,
    generate: false,
    candidates: 0,
    blind: false
  };

  const AGENTS = [
    ["tutor-narrativo", "Tutor"],
    ["arquitecto-narrativo", "Arquitecto"],
    ["guardian-canon", "Guardián del canon"],
    ["analista-voz", "Analista de voz"],
    ["editor-desarrollo", "Editor de desarrollo"],
    ["editor-comercial", "Editor comercial"],
    ["editor-literario", "Editor literario"],
    ["psicologo-personajes", "Psicólogo de personajes"],
    ["lector-cero", "Lector cero"],
    ["critico-hostil", "Crítico hostil"],
    ["defensor-original", "Defensor del original"],
    ["mentor-aprendizaje", "Mentor de aprendizaje"],
    ["integrador-editorial", "Integrador"]
  ];

  const state = {
    catalog: null,
    favorites: new Set(readStorage(STORAGE.favorites, [])),
    recent: readStorage(STORAGE.recent, []),
    category: localStorage.getItem(STORAGE.category) || "all",
    search: "",
    currentFlow: null,
    currentPrompt: "",
    repoPath: "",
    loreUrl: ""
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    configureRepoPath();
    configureLoreSystem();
    bindStaticEvents();
    renderAgentOptions();
    updateBuilderAssessment();

    try {
      const response = await fetch("workflows.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.catalog = await response.json();
      renderAll();
    } catch (error) {
      showToast("No se pudo cargar workflows.json. Abre el panel mediante el lanzador local.");
      console.error(error);
    }

    await loadVisibleContext();
  }

  function configureRepoPath() {
    const params = new URLSearchParams(location.search);
    const fromLauncher = params.get("repo");
    state.repoPath = fromLauncher || localStorage.getItem(STORAGE.repoPath) || "";
    $("#repoPath").value = state.repoPath;
  }

  function configureLoreSystem() {
    const params = new URLSearchParams(location.search);
    state.loreUrl = params.get("lore") || "http://127.0.0.1:5173/";
  }

  function bindStaticEvents() {
    $("#saveRepoPath").addEventListener("click", () => {
      state.repoPath = $("#repoPath").value.trim();
      if (state.repoPath) localStorage.setItem(STORAGE.repoPath, state.repoPath);
      else localStorage.removeItem(STORAGE.repoPath);
      updateOpenButton();
      showToast(state.repoPath ? "Ruta guardada en este navegador." : "Ruta eliminada.");
    });

    $("#showAllTools").addEventListener("click", showTools);
    $("#openLoreSystem").addEventListener("click", openLoreSystem);
    $("#closeLoreSystem").addEventListener("click", closeLoreSystem);
    $("#reloadLoreSystem").addEventListener("click", reloadLoreSystem);
    $("#hideTools").addEventListener("click", hideTools);
    $("#actionSearch").addEventListener("input", (event) => {
      state.search = normalizeText(event.target.value);
      renderCatalog();
    });
    $("#recommendedAction").addEventListener("click", () => selectById("continuar-escribiendo"));

    [$("#openSkills"), $("#footerSkills")].forEach((button) => {
      button.addEventListener("click", () => { location.href = "codex://skills"; });
    });

    $("#closeDialog").addEventListener("click", () => $("#promptDialog").close());
    $("#copyPrompt").addEventListener("click", copyCurrentPrompt);
    $("#openCodex").addEventListener("click", openCurrentFlowInCodex);
    $("#togglePrompt").addEventListener("click", togglePromptVisibility);
    $("#resetFlow").addEventListener("click", () => {
      if (!state.currentFlow) return;
      state.currentPrompt = buildPrompt(state.currentFlow);
      $("#promptPreview").value = state.currentPrompt;
      showToast("Prompt restablecido.");
    });

    $("#builderForm").addEventListener("input", updateBuilderAssessment);
    $("#builderForm").addEventListener("change", handleBuilderAgentRules);
    $("#builderForm").addEventListener("submit", submitCustomBuilder);
    $("#resetBuilder").addEventListener("click", () => setTimeout(() => {
      $("#agent-none").checked = true;
      updateBuilderAssessment();
    }, 0));
  }

  async function loadVisibleContext() {
    const [active, project, next] = await Promise.all([
      readMarkdown("../CONTEXTO_ACTIVO.md"),
      readMarkdown("../ESTADO_DEL_PROYECTO.md"),
      readMarkdown("../PROXIMA_SESION.md")
    ]);

    const data = parseStateFiles(active?.text || "", project?.text || "", next?.text || "");
    setText("#statusSaga", data.saga);
    setText("#statusNovel", data.novel);
    setText("#statusChapter", data.chapter);
    setText("#statusPhase", data.phase);
    setText("#statusNext", data.nextTask);
    setText("#statusBlocks", data.blocks);

    const dates = [active, project, next]
      .map((item) => item?.lastModified)
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));
    const latest = dates.sort((a, b) => b - a)[0];
    setText("#statusUpdated", latest ? latest.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "Información no disponible");

    const loaded = [active, project, next].filter(Boolean).length;
    const status = $("#contextStatus");
    status.textContent = loaded === 3 ? "Contexto local disponible" : `${loaded}/3 archivos disponibles`;
    status.classList.toggle("ready", loaded > 0);

    if (data.nextTask !== "Información no disponible") {
      $("#recommendationTitle").textContent = "Continuar desde el punto exacto";
      $("#recommendationText").textContent = data.nextTask;
    }
  }

  async function readMarkdown(path) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) return null;
      return { text: await response.text(), lastModified: response.headers.get("last-modified") };
    } catch {
      return null;
    }
  }

  function parseStateFiles(active, project, next) {
    const unavailable = "Información no disponible";
    const rawSystem = markdownField(project, "Sistema");
    const sagaMatch = [...rawSystem.matchAll(/\*([^*]+)\*/g)].at(-1)?.[1];
    return {
      saga: cleanMarkdown(sagaMatch || unavailable),
      novel: cleanMarkdown(markdownField(active, "Novela activa") || markdownField(project, "Novela activa") || unavailable),
      chapter: cleanMarkdown(markdownField(active, "Capítulo activo") || markdownField(project, "Capítulo activo") || unavailable),
      phase: cleanMarkdown(markdownField(project, "Fase actual") || markdownField(active, "Punto del proceso") || unavailable),
      nextTask: cleanMarkdown(markdownField(active, "Siguiente acción") || markdownField(next, "Acción siguiente") || unavailable),
      blocks: markdownSection(project, "Bloqueos y decisiones abiertas") || unavailable
    };
  }

  function markdownField(text, label) {
    if (!text) return "";
    const pattern = new RegExp(`^-\\s*\\*\\*${escapeRegExp(label)}:\\*\\*\\s*(.+)$`, "imu");
    return text.match(pattern)?.[1]?.trim() || "";
  }

  function markdownSection(text, heading) {
    if (!text) return "";
    const pattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, "imu");
    const match = pattern.exec(text);
    if (!match) return "";
    const remainder = text.slice(match.index + match[0].length);
    const nextHeading = remainder.search(/^##\\s/m);
    const section = nextHeading >= 0 ? remainder.slice(0, nextHeading) : remainder;
    const bullets = section.split(/\r?\n/).filter((line) => /^-\s+/.test(line)).map((line) => cleanMarkdown(line.replace(/^-\s+/, "")));
    return bullets.join(" · ");
  }

  function renderAll() {
    renderFrequent();
    renderCategoryTabs();
    renderCatalog();
    renderSavedLists();
  }

  function renderFrequent() {
    const container = $("#frequentActions");
    container.replaceChildren(...state.catalog.presets.slice(0, 6).map((item) => createCard(item, true)));
  }

  function renderCategoryTabs() {
    const tabs = $("#categoryTabs");
    const entries = [{ id: "all", label: "Todas", icon: "•" }, ...state.catalog.categories];
    tabs.replaceChildren(...entries.map((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "category-tab";
      button.role = "tab";
      button.setAttribute("aria-selected", String(state.category === category.id));
      button.textContent = `${category.icon} ${category.label}`;
      button.addEventListener("click", () => {
        state.category = category.id;
        localStorage.setItem(STORAGE.category, state.category);
        renderCategoryTabs();
        renderCatalog();
      });
      return button;
    }));
  }

  function renderCatalog() {
    if (!state.catalog) return;
    const accepts = (item) => {
      const categoryMatches = state.category === "all" || item.category === state.category;
      const searchable = normalizeText(`${item.title} ${item.description} ${item.intent}`);
      return categoryMatches && (!state.search || searchable.includes(state.search));
    };
    const presets = state.catalog.presets.filter(accepts);
    const actions = state.catalog.actions.filter(accepts);
    $("#presetGrid").replaceChildren(...(presets.length ? presets.map((item) => createCard(item)) : [emptyNode("No hay presets para este filtro.")]));
    $("#actionGrid").replaceChildren(...(actions.length ? actions.map((item) => createCard(item)) : [emptyNode("No se encontraron acciones.")]));
    $("#resultCount").textContent = `${actions.length} ${actions.length === 1 ? "acción" : "acciones"}`;
  }

  function createCard(item, frequent = false) {
    const card = document.createElement("article");
    card.className = "workflow-card";
    card.dataset.actionId = item.id;

    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = `favorite-button${state.favorites.has(item.id) ? " active" : ""}`;
    favorite.setAttribute("aria-label", state.favorites.has(item.id) ? `Quitar ${item.title} de favoritos` : `Añadir ${item.title} a favoritos`);
    favorite.textContent = state.favorites.has(item.id) ? "★" : "☆";
    favorite.addEventListener("click", () => toggleFavorite(item.id));

    const icon = document.createElement("span");
    icon.className = "card-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = item.icon || "•";

    const title = document.createElement("h3");
    title.textContent = item.title;
    const description = document.createElement("p");
    description.textContent = item.description;

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const mode = document.createElement("span");
    mode.className = "mode-tag";
    mode.textContent = item.mode;
    const action = document.createElement("button");
    action.type = "button";
    action.className = "card-action";
    action.textContent = frequent ? "Preparar" : "Elegir";
    action.addEventListener("click", () => prepareFlow(normalizeFlow(item), item.id));
    meta.append(mode, action);
    card.append(favorite, icon, title, description, meta);
    return card;
  }

  function emptyNode(message) {
    const node = document.createElement("p");
    node.className = "empty";
    node.textContent = message;
    return node;
  }

  function toggleFavorite(id) {
    state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
    writeStorage(STORAGE.favorites, [...state.favorites]);
    renderAll();
  }

  function renderSavedLists() {
    if (!state.catalog) return;
    const items = allItems();
    const favorites = [...state.favorites].map((id) => items.find((item) => item.id === id)).filter(Boolean);
    const recent = state.recent.map((entry) => items.find((item) => item.id === entry.id)).filter(Boolean).slice(0, 6);
    renderMiniList("#favoritesList", favorites, "Aún no tienes favoritos.");
    renderMiniList("#recentList", recent, "Aún no hay acciones recientes.");
  }

  function renderMiniList(selector, items, emptyMessage) {
    const container = $(selector);
    if (!items.length) {
      container.replaceChildren(emptyNode(emptyMessage));
      return;
    }
    container.replaceChildren(...items.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mini-action";
      button.textContent = item.title;
      button.addEventListener("click", () => prepareFlow(normalizeFlow(item), item.id));
      return button;
    }));
  }

  function allItems() {
    return [...state.catalog.presets, ...state.catalog.actions];
  }

  function selectById(id) {
    const item = allItems().find((entry) => entry.id === id);
    if (item) prepareFlow(normalizeFlow(item), id);
  }

  function normalizeFlow(item) {
    return {
      ...item,
      title: item.title || "Flujo personalizado",
      description: item.description || "",
      agents: [...(item.agents || [])],
      extent: item.extent || "700 palabras",
      options: { ...DEFAULT_OPTIONS, ...(item.options || {}) }
    };
  }

  function prepareFlow(flow, sourceId = "custom") {
    const validation = validateFlow(flow);
    if (validation.errors.length) {
      showToast(validation.errors[0]);
      if (sourceId === "custom") renderWarnings("#builderWarnings", validation);
      return false;
    }

    state.currentFlow = structuredClone(flow);
    window.dispatchEvent(new CustomEvent("tantalo:flow-preview", { detail: { flow: state.currentFlow, sourceId } }));
    state.currentPrompt = buildPrompt(flow);
    const consumption = estimateConsumption(flow);
    $("#promptTitle").textContent = flow.title;
    $("#selectedMode").textContent = flow.mode;
    setLevel($("#selectedConsumption"), consumption.level);
    $("#consumptionExplanation").textContent = consumption.explanation;
    $("#promptPreview").value = state.currentPrompt;
    $("#promptPreview").classList.remove("hidden");
    $("#togglePrompt").textContent = "Ocultar prompt";
    renderWarnings("#flowWarnings", validation);
    registerRecent(sourceId);
    updateOpenButton();
    $("#promptDialog").showModal();
    return true;
  }

  function buildPrompt(flow) {
    const modeIsLight = flow.mode === "Tutor Ligero";
    const agents = flow.agents || [];
    let agentRule;
    if (!agents.length) {
      agentRule = "No actives subagentes; trabaja únicamente con el agente principal.";
    } else if (modeIsLight) {
      agentRule = `No actives subagentes. Aplica dentro del agente principal solo esta especialidad: ${agents.join(", ")}.`;
    } else {
      agentRule = `Agentes autorizados, y ningún otro: ${agents.join(", ")}. Evita análisis redundantes.`;
    }

    let files;
    if (flow.mode === "Profundo") {
      files = flow.options.additionalFiles
        ? "Lee CONTEXTO_ACTIVO.md y únicamente los archivos que anuncies como necesarios para el alcance. No recorras el repositorio."
        : "Lee solo CONTEXTO_ACTIVO.md y el material que yo indique.";
    } else if (flow.mode === "Revisión de Capítulo") {
      files = flow.options.additionalFiles
        ? "Lee CONTEXTO_ACTIVO.md, el capítulo que indique y como máximo dos archivos canónicos directamente relevantes."
        : "Lee solo CONTEXTO_ACTIVO.md y el capítulo que indique.";
    } else {
      files = flow.options.additionalFiles
        ? "Lee CONTEXTO_ACTIVO.md, el material indicado y solo archivos adicionales directamente necesarios; explica antes cualquier ampliación sustancial."
        : "Lee solo CONTEXTO_ACTIVO.md y el fragmento o archivo que indique; no amplíes la lectura.";
    }

    const lines = [
      "Usa $sistema-tantalo.",
      "",
      `Modo: ${flow.mode}.`,
      `Objetivo: ${flow.objective}.`,
      `Alcance: ${flow.scope}.`,
      agentRule,
      `Lectura permitida: ${files}`,
      `Búsqueda web: ${flow.options.web ? "permitida solo para la necesidad indicada y con fuentes citadas" : "no permitida"}.`,
      `Propuestas: ${flow.options.propose ? "puedes proponer cambios, sin aplicarlos automáticamente" : "no propongas alternativas adicionales salvo que sean imprescindibles"}.`,
      `Escritura en archivos: ${flow.options.write ? "permitida únicamente después de mi confirmación; preserva originales y canon" : "no permitida"}.`,
      `Actualización de memoria: ${flow.options.memory ? "agrúpala al final y ejecútala solo con decisiones aprobadas" : "no actualizar"}.`,
      `Extensión esperada: ${flow.extent}.`
    ];

    if (flow.options.candidates > 0) lines.push(`Candidatos: ${flow.options.candidates}, siempre separados y recuperables.`);
    if (flow.options.blind) lines.push("Comparación: ciega, con criterios explícitos y defensa del original.");
    if (flow.monitorControls) {
      const controls = flow.monitorControls;
      lines.push(
        `Profundidad operativa solicitada: ${Number(controls.requestedDepth ?? 1)} de 5; describe el flujo visible, no el razonamiento privado.`,
        `Rigor editorial: ${Number(controls.rigor ?? 70)}/100. Creatividad permitida: ${Number(controls.creativity ?? 35)}/100.`,
        `Protección del canon: ${Number(controls.canonProtection ?? 90)}/100. Protección de voz: ${Number(controls.voiceProtection ?? 90)}/100.`,
        `Límite cualitativo de consumo: ${Number(controls.consumptionLimit ?? 55)}/100; si el flujo lo excede, detente y solicita confirmación.`
      );
      if (!controls.allowSubagents) lines.push("Subagentes: no permitidos; conserva las especialidades dentro del agente principal.");
    }
    if (flow.requiresConfirmation || flow.options.write) lines.push("Antes de cualquier operación persistente, solicita una confirmación inequívoca.");
    if (flow.mode === "Profundo") lines.push("Antes de actuar, anuncia agentes, archivos, motivo del modo profundo y resultado que producirás.");

    lines.push("", `Tarea: ${flow.intent}`, "", "Conserva mi autoridad y mi voz. No inventes canon ni sobrescribas el manuscrito.");
    if (modeIsLight || flow.objective === "orientar" || flow.objective === "enseñar") lines.push("Termina con una sola acción concreta.");
    return lines.join("\n");
  }

  function buildCodexUrl(repoPath, prompt) {
    if (!repoPath?.trim()) return "";
    return `codex://new?path=${encodeURIComponent(repoPath.trim())}&prompt=${encodeURIComponent(prompt)}`;
  }

  function estimateConsumption(flow) {
    let score = flow.mode === "Profundo" ? 5 : flow.mode === "Revisión de Capítulo" ? 3 : 0;
    const reasons = [];
    if (flow.mode !== "Tutor Ligero") reasons.push(flow.mode);

    const scopeCost = { pregunta: 0, "selección": 0, escena: 1, "capítulo": 2, novela: 4, saga: 5 }[flow.scope] ?? 1;
    score += scopeCost;
    if (scopeCost >= 2) reasons.push(`alcance ${flow.scope}`);

    const agentCount = flow.agents?.length || 0;
    score += Math.max(0, agentCount - (flow.mode === "Tutor Ligero" ? 1 : 0));
    if (agentCount > 1) reasons.push(`${agentCount} agentes`);
    if (flow.options.web) { score += 2; reasons.push("búsqueda web"); }
    if (flow.options.additionalFiles) { score += 1; reasons.push("lectura adicional"); }
    if (flow.options.propose) score += .5;
    if (flow.options.write) { score += 2; reasons.push("escritura en archivos"); }
    if (flow.options.memory) { score += 1; reasons.push("actualización de memoria"); }
    if (flow.options.candidates) { score += flow.options.candidates * .75; reasons.push(`${flow.options.candidates} candidatos`); }
    if (flow.options.blind) { score += 2; reasons.push("comparación ciega"); }

    const level = score < 3 ? "BAJO" : score < 6 ? "MEDIO" : score < 9 ? "ALTO" : "MUY ALTO";
    const explanation = reasons.length ? `Elevan el consumo: ${reasons.join(", ")}.` : "Tutor Ligero, alcance breve y sin operaciones adicionales.";
    return { level, score, explanation };
  }

  function validateFlow(flow) {
    const warnings = [];
    const errors = [];
    const count = flow.agents?.length || 0;
    const candidates = Number(flow.options.candidates || 0);

    if (/torneo/i.test(flow.title || "") && candidates === 0) errors.push("Un torneo necesita al menos dos candidatos.");
    if (flow.options.blind && candidates === 0) errors.push("La comparación ciega necesita candidatos existentes o un número de candidatos.");
    if (flow.agents?.includes("integrador-editorial") && candidates === 0) errors.push("El integrador requiere candidatos o finalistas definidos.");
    if (flow.mode === "Revisión de Capítulo" && count > 2) errors.push("El Modo Capítulo permite como máximo dos agentes especializados.");
    if (flow.objective === "exportar" && !flow.options.write) errors.push("Exportar requiere permiso de escritura en archivos.");
    if (flow.options.generate && candidates === 0) errors.push("Activa al menos dos candidatos para generar versiones.");

    if (flow.mode === "Tutor Ligero" && count > 0) warnings.push("En Tutor Ligero las especialidades se aplican dentro del agente principal; no se activan subagentes.");
    if (count > 3) warnings.push("Más de tres agentes puede producir análisis redundante y consumo alto.");
    if (flow.mode === "Profundo" && flow.options.web && candidates >= 4) warnings.push("Modo Profundo + web + cuatro candidatos eleva mucho el consumo.");
    if (flow.options.write) warnings.push("Este flujo puede modificar archivos y exigirá confirmación antes de abrirse en Codex.");
    if (flow.requiresConfirmation) warnings.push("La acción requiere confirmación explícita del autor.");
    return { warnings, errors };
  }

  function renderWarnings(selector, validation) {
    const list = $(selector);
    const nodes = [
      ...validation.errors.map((message) => warningNode(message, true)),
      ...validation.warnings.map((message) => warningNode(message, false))
    ];
    list.replaceChildren(...nodes);
  }

  function warningNode(message, error) {
    const item = document.createElement("li");
    if (error) item.className = "error";
    item.textContent = message;
    return item;
  }

  async function copyCurrentPrompt() {
    const preview = $("#promptPreview");
    const prompt = preview.value;
    preview.classList.remove("hidden");
    preview.focus();
    preview.select();
    preview.setSelectionRange(0, prompt.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch { /* continúa con la API moderna */ }

    if (!copied && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(prompt);
        copied = true;
      } catch { /* se informa la alternativa manual */ }
    }

    showToast(copied ? "Prompt copiado. Puedes pegarlo donde prefieras." : "El prompt quedó seleccionado: pulsa Ctrl+C para copiarlo.");
  }

  function openCurrentFlowInCodex() {
    if (!state.currentFlow) return;
    state.repoPath = $("#repoPath").value.trim();
    if (!state.repoPath) {
      showToast("Configura primero la ruta absoluta del repositorio.");
      $("#repoPath").focus();
      return;
    }

    const consumption = estimateConsumption(state.currentFlow);
    if (state.currentFlow.options.write && !confirm("Este flujo permite modificar archivos después de tu confirmación en Codex. ¿Quieres continuar?")) return;
    if (state.currentFlow.requiresConfirmation && !confirm("Esta acción requiere una confirmación editorial explícita. ¿Quieres preparar el chat?")) return;
    if (consumption.level === "MUY ALTO" && !confirm("El consumo estimado es MUY ALTO. ¿Quieres abrir este flujo de todos modos?")) return;

    const prompt = $("#promptPreview").value;
    const url = buildCodexUrl(state.repoPath, prompt);
    location.href = url;
    setTimeout(() => showToast("Si Codex no se abrió, usa «Copiar prompt»."), 1000);
  }

  function updateOpenButton() {
    const button = $("#openCodex");
    if (!button) return;
    const path = $("#repoPath")?.value.trim() || state.repoPath;
    button.disabled = !path;
    button.title = path ? "Abrir un chat nuevo en Codex" : "Configura la ruta del repositorio";
  }

  function togglePromptVisibility() {
    const preview = $("#promptPreview");
    const hidden = preview.classList.toggle("hidden");
    $("#togglePrompt").textContent = hidden ? "Ver prompt" : "Ocultar prompt";
  }

  function registerRecent(id) {
    if (!id || id === "custom") return;
    state.recent = [{ id, at: Date.now() }, ...state.recent.filter((entry) => entry.id !== id)].slice(0, 8);
    writeStorage(STORAGE.recent, state.recent);
    renderSavedLists();
  }

  function renderAgentOptions() {
    const container = $("#agentOptions");
    const none = document.createElement("label");
    none.innerHTML = '<input id="agent-none" type="checkbox" value="" checked> Ninguno';
    container.append(none);
    AGENTS.forEach(([value, label]) => {
      const wrapper = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "agent";
      input.value = value;
      wrapper.append(input, document.createTextNode(` ${label}`));
      container.append(wrapper);
    });
  }

  function handleBuilderAgentRules(event) {
    if (event.target.id === "agent-none" && event.target.checked) {
      $$('#agentOptions input[name="agent"]').forEach((input) => { input.checked = false; });
    } else if (event.target.name === "agent" && event.target.checked) {
      $("#agent-none").checked = false;
    }
    if (!$$('#agentOptions input[name="agent"]:checked').length) $("#agent-none").checked = true;
    updateBuilderAssessment();
  }

  function builderFlow() {
    const form = $("#builderForm");
    const checked = (name) => form.elements[name]?.checked || false;
    return normalizeFlow({
      id: "custom",
      title: "Flujo personalizado",
      description: "Configuración avanzada",
      mode: $("#builderMode").value,
      objective: $("#builderObjective").value,
      scope: $("#builderScope").value,
      agents: $$('#agentOptions input[name="agent"]:checked').map((input) => input.value),
      extent: $("#builderExtent").value,
      requiresConfirmation: $("#builderMode").value === "Profundo" || checked("write") || checked("memory"),
      options: {
        web: checked("web"),
        additionalFiles: checked("additionalFiles"),
        propose: checked("propose"),
        write: checked("write"),
        memory: checked("memory"),
        generate: checked("generate"),
        candidates: Number($("#builderCandidates").value),
        blind: checked("blind")
      },
      intent: $("#customIntent").value.trim() || "Describe conmigo el resultado concreto antes de actuar."
    });
  }

  function updateBuilderAssessment() {
    const flow = builderFlow();
    const consumption = estimateConsumption(flow);
    setLevel($("#builderConsumption"), consumption.level);
    $("#builderConsumptionReason").textContent = consumption.explanation;
    renderWarnings("#builderWarnings", validateFlow(flow));
    window.dispatchEvent(new CustomEvent("tantalo:flow-preview", { detail: { flow, sourceId: "builder" } }));
  }

  function submitCustomBuilder(event) {
    event.preventDefault();
    const flow = builderFlow();
    if (!$("#customIntent").value.trim()) {
      showToast("Describe qué quieres conseguir con el flujo.");
      $("#customIntent").focus();
      return;
    }
    prepareFlow(flow, "custom");
  }

  function setLevel(element, level) {
    element.textContent = level;
    element.dataset.level = level.toLowerCase().replace(" ", "-");
  }

  function showTools() {
    $("#toolsSection").hidden = false;
    $("#showAllTools").setAttribute("aria-expanded", "true");
    $("#toolsSection").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#actionSearch").focus({ preventScroll: true });
  }

  function hideTools() {
    $("#toolsSection").hidden = true;
    $("#showAllTools").setAttribute("aria-expanded", "false");
    $("#showAllTools").focus();
  }

  function openLoreSystem() {
    const panel = $("#loreSystemPanel");
    panel.hidden = false;
    document.body.classList.add("lore-app-open");
    $("#openLoreSystem").setAttribute("aria-expanded", "true");
    panel.scrollIntoView({ block: "start" });
    if ($("#loreSystemFrame").dataset.activated !== "true") activateLoreSystem();
  }

  function closeLoreSystem() {
    document.body.classList.remove("lore-app-open");
    $("#loreSystemPanel").hidden = true;
    $("#openLoreSystem").setAttribute("aria-expanded", "false");
    $("#openLoreSystem").focus();
  }

  function reloadLoreSystem() {
    const frame = $("#loreSystemFrame");
    frame.onload = null;
    frame.dataset.activated = "false";
    frame.removeAttribute("src");
    activateLoreSystem();
  }

  async function activateLoreSystem() {
    const frame = $("#loreSystemFrame");
    const loading = $("#loreSystemLoading");
    const status = $("#loreSystemStatus");
    let target;
    frame.onload = null;

    try {
      target = new URL(state.loreUrl, location.href);
      target.searchParams.set("embed", "tantalo");
    } catch {
      target = new URL("http://127.0.0.1:5173/");
      target.searchParams.set("embed", "tantalo");
    }

    loading.classList.remove("error");
    loading.hidden = false;
    loading.querySelector("strong").textContent = "ACTIVANDO LORESYSTEM V2";
    loading.querySelector("small").textContent = "Conectando con la interfaz local actualizada…";
    frame.hidden = true;
    status.textContent = "ACTIVANDO";
    status.dataset.state = "loading";

    const showConnectionError = () => {
      frame.onload = null;
      frame.removeAttribute("src");
      frame.dataset.activated = "false";
      frame.hidden = true;
      loading.classList.add("error");
      loading.querySelector("strong").textContent = "LORESYSTEM NO RESPONDE";
      loading.querySelector("small").textContent = "Reabre el panel con ABRIR_PANEL_TANTALO.bat y pulsa «Recargar app».";
      status.textContent = "SIN CONEXIÓN";
      status.dataset.state = "error";
    };

    const controller = new AbortController();
    const connectionTimer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(target.href, { cache: "no-store", mode: "cors", signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const signature = await response.text();
      if (!/<title>\s*MEME\b/i.test(signature)) throw new Error("La respuesta no corresponde a LoreSystem v2");
    } catch (error) {
      console.error("LoreSystem v2 no está disponible", error);
      showConnectionError();
      return;
    } finally {
      clearTimeout(connectionTimer);
    }

    const renderTimer = setTimeout(showConnectionError, 10000);

    frame.onload = () => {
      clearTimeout(renderTimer);
      loading.hidden = true;
      frame.hidden = false;
      frame.dataset.activated = "true";
      status.textContent = "EN LÍNEA";
      status.dataset.state = "ready";
    };
    frame.src = target.href;
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function setText(selector, value) {
    $(selector).textContent = value || "Información no disponible";
  }

  function cleanMarkdown(value) {
    return String(value || "")
      .replace(/[`*_>#]/g, "")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }

  function writeStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  window.TantaloPanel = {
    buildPrompt,
    buildCodexUrl,
    estimateConsumption,
    validateFlow,
    parseStateFiles,
    normalizeFlow,
    prepareFlow,
    getRepoPath: () => $("#repoPath")?.value.trim() || state.repoPath
  };
})();
