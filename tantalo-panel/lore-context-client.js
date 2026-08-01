(() => {
  "use strict";

  const FULL_CONTEXT_WORKFLOWS = new Set([
    "torneo-versiones", "torneo", "comparacion-ciega", "candidatos-abcd", "integrar-finalistas",
    "auditoria-canon", "revision-macro", "evaluacion-manuscrito"
  ]);
  const GENERIC_TERMS = new Set([
    "Revisa", "Revisar", "Comprueba", "Comprobar", "Anuncia", "Activa", "Genera", "Compara",
    "Integra", "Evalúa", "Evalua", "Audita", "Analiza", "Contrasta", "Aplica", "Prepara",
    "Cierra", "Actualiza", "LoreSystem", "Torneo", "Profundo"
  ]);
  const cache = new Map();
  let loreBaseUrl = "http://127.0.0.1:5173/";

  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  function configure(url) {
    try { loreBaseUrl = new URL(url || loreBaseUrl, location.href).href; }
    catch { loreBaseUrl = "http://127.0.0.1:5173/"; }
  }

  function requestedDepth(flow) {
    const explicit = Number(flow.monitorControls?.requestedDepth);
    if (Number.isInteger(explicit) && explicit >= 1 && explicit <= 5) return explicit;
    if (flow.mode === "Profundo") return 4;
    if (flow.mode === "Revisión de Capítulo") return 2;
    return 1;
  }

  function plan(flow) {
    const text = normalize([flow.id, flow.title, flow.objective, flow.scope, flow.intent, ...(flow.agents || [])].join(" "));
    const domains = new Set();
    const has = (...terms) => terms.some((term) => text.includes(term));

    if (has("guardian-canon", "continuidad", "canon", "compatibilidad", "revelacion", "conocimiento")) domains.add("continuity");
    if (has("psicologo-personajes", "personaje", "motivacion", "agencia", "deseo", "contradiccion", "arco")) domains.add("psychology");
    if (has("arquitecto-narrativo", "estructura", "causalidad", "progresion", "macro")) domains.add("structure");
    if (has("lore", "mundo", "faccion", "tecnologia", "economia")) domains.add("lore");
    if (has("version", "candidato", "comparacion", "defensor-original", "integrador-editorial", "torneo")) domains.add("versions");
    if (has("cronologia", "temporal", "secuencia")) domains.add("chronology");
    if (has("misterio", "simbolo", "presagio")) domains.add("mysteries");

    if (flow.id === "auditoria-canon") { domains.add("canon"); domains.add("versions"); }
    if (["torneo-versiones", "torneo", "comparacion-ciega", "candidatos-abcd", "integrar-finalistas"].includes(flow.id)) {
      domains.add("canon"); domains.add("structure"); domains.add("characters"); domains.add("versions");
    }
    if (["revision-macro", "evaluacion-manuscrito"].includes(flow.id)) {
      domains.add("structure"); domains.add("continuity"); domains.add("characters");
    }

    if (!domains.size) return { required: false, reason: "El flujo no necesita consultar LoreSystem v2." };

    const depth = requestedDepth(flow);
    const allowFullContext = depth === 5 && flow.mode === "Profundo" && FULL_CONTEXT_WORKFLOWS.has(flow.id);
    const maxByDepth = { 1: 5, 2: 9, 3: 14, 4: 20, 5: 28 };
    const query = [flow.title, flow.intent].filter(Boolean).join(". ").slice(0, 500);
    const versionTerms = query.match(/\b\d+\.\d+(?:\.\d+)?\b/g) || [];
    const properTerms = [...new Set([
      ...(query.match(/\b[A-ZÁÉÍÓÚÑ][\p{L}\d-]{2,}\b/gu) || []).filter((term) => !GENERIC_TERMS.has(term)),
      ...versionTerms
    ])].slice(0, 12);
    const entityIds = Array.isArray(flow.entityIds) ? flow.entityIds.slice(0, 20) : [];
    const deferred = !allowFullContext && properTerms.length === 0 && entityIds.length === 0;

    return {
      required: true,
      deferred,
      reason: `Consulta selectiva: ${[...domains].join(", ")}.`,
      request: {
        query,
        domains: [...domains],
        terms: properTerms,
        entityIds,
        depth,
        mode: flow.mode,
        workflowId: flow.id || "custom",
        purpose: flow.objective || "consultar",
        maxItems: maxByDepth[depth],
        allowFullContext
      }
    };
  }

  async function query(planValue) {
    if (!planValue?.required || !planValue.request) return null;
    const endpoint = new URL("api/tantalo/context/query", loreBaseUrl).href;
    const key = JSON.stringify(planValue.request);
    if (cache.has(key)) return cache.get(key);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: key,
        signal: controller.signal
      });
      const payload = await response.json();
      if (!response.ok) {
        const error = new Error(payload.error || `LoreSystem respondió con HTTP ${response.status}.`);
        error.code = payload.code || "LORE_CONTEXT_ERROR";
        throw error;
      }
      const result = { ...payload, endpoint, request: planValue.request };
      cache.set(key, result);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  function inventory(fullDocument) {
    return (fullDocument?.modules || []).map((module) => ({ id: module.id, title: module.title, items: module.content?.items?.length || 0 }));
  }

  function deferredBlock(planValue) {
    if (!planValue?.request) return "";
    const endpoint = new URL("api/tantalo/context/query", loreBaseUrl).href;
    const template = { ...planValue.request, terms: ["NOMBRE_O_VERSIÓN_CONCRETA"], entityIds: [] };
    return [
      "LORESYSTEM V2 · CONEXIÓN SELECTIVA EN ESPERA",
      `Endpoint local de solo lectura: ${endpoint}`,
      `Dominios ya autorizados: ${planValue.request.domains.join(", ")}. Profundidad máxima: ${planValue.request.depth}/5.`,
      "No consultes todavía. Cuando el usuario identifique un personaje, versión, evento o elemento concreto, envía una única petición POST JSON sustituyendo terms o entityIds en esta plantilla:",
      JSON.stringify(template),
      "No cambies allowFullContext a true ni amplíes dominios. Si falta un referente concreto, pregúntalo; no recorras la base completa."
    ].join("\n");
  }

  function promptBlock(result) {
    if (result?.deferred && result.plan) return deferredBlock(result.plan);
    if (!result?.audit) return "";
    const audit = result.audit;
    if (audit.fullContext) {
      return [
        "LORESYSTEM V2 · CONTEXTO INTEGRAL AUTORIZADO",
        `Canon ${audit.canonVersion}; esquema ${audit.schemaVersion}; profundidad ${audit.depth}/5.`,
        `Inventario: ${JSON.stringify(inventory(result.context?.fullDocument))}`,
        `Endpoint local de solo lectura: ${result.endpoint}`,
        `Solicitud autorizada: ${JSON.stringify(result.request)}`,
        "Consulta el endpoint por módulos durante el análisis. No modifiques data/universe_master.json y no conviertas hipótesis en canon."
      ].join("\n");
    }

    let context = JSON.stringify(result.context);
    if (context.length > 24000) {
      const compactModules = (result.context?.modules || []).map((module) => ({
        id: module.id,
        title: module.title,
        items: (module.items || []).map((item) => ({ id: item.id, type: item.type, title: item.title, summary: item.summary, refs: item.refs }))
      }));
      context = JSON.stringify({ metadata: result.context?.metadata, modules: compactModules });
    }
    return [
      "LORESYSTEM V2 · CONTEXTO SELECTIVO DE SOLO LECTURA",
      `Consulta ${audit.requestId}; canon ${audit.canonVersion}; profundidad ${audit.depth}/5.`,
      `Módulos consultados: ${audit.resolvedModules.join(", ")}. Registros devueltos: ${audit.recordsReturned}.`,
      `Contexto: ${context}`,
      "Usa únicamente esta porción para el contraste solicitado. No amplíes la consulta ni modifiques el canon."
    ].join("\n");
  }

  window.TantaloLoreContext = { configure, plan, query, promptBlock, deferredBlock };
})();
