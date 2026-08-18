(function (root) {
  "use strict";

  const REQUIRED_NODE_FIELDS = ["id", "label", "type", "status", "depth", "activationReason", "explicit", "source", "estimatedCost", "startTime", "endTime", "metadata"];
  const REQUIRED_EDGE_FIELDS = ["source", "target", "relation", "status", "confirmed", "sequence"];

  function indexBy(items, key = "id") {
    return new Map((items || []).map((item) => [item[key], item]));
  }

  function validateGraph(graph) {
    const errors = [];
    if (!graph || typeof graph !== "object") return { valid: false, errors: ["El grafo no es un objeto."] };
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) return { valid: false, errors: ["El grafo necesita nodos y conexiones."] };
    const ids = new Set();
    graph.nodes.forEach((node, index) => {
      REQUIRED_NODE_FIELDS.forEach((field) => { if (!(field in node)) errors.push(`Nodo ${index}: falta ${field}.`); });
      if (ids.has(node.id)) errors.push(`Nodo duplicado: ${node.id}.`);
      ids.add(node.id);
      if (Number(node.depth) < 0 || Number(node.depth) > 5) errors.push(`Profundidad inválida: ${node.id}.`);
    });
    graph.edges.forEach((edge, index) => {
      REQUIRED_EDGE_FIELDS.forEach((field) => { if (!(field in edge)) errors.push(`Conexión ${index}: falta ${field}.`); });
      if (!ids.has(edge.source) || !ids.has(edge.target)) errors.push(`Conexión ${index}: extremo inexistente.`);
    });
    return { valid: errors.length === 0, errors };
  }

  function node(id, label, type, depth, reason, options = {}) {
    return {
      id, label, type,
      status: options.status || "PLANIFICADO",
      depth: Math.max(0, Math.min(5, Number(depth) || 0)),
      activationReason: reason,
      explicit: options.explicit !== false,
      source: options.source || "workflow",
      estimatedCost: options.estimatedCost || "bajo",
      startTime: options.startTime || null,
      endTime: options.endTime || null,
      metadata: options.metadata || {}
    };
  }

  function edge(source, target, relation, sequence, options = {}) {
    return { source, target, relation, status: options.status || "PLANIFICADO", confirmed: options.confirmed === true, sequence };
  }

  function protocolFor(flow, registries) {
    const profiles = registries.relations.presetProfiles || {};
    return profiles[flow.id]?.protocol || registries.relations.objectiveProtocols?.[flow.objective] || "protocolo-tutoria";
  }

  function buildGraph(flow, registries, settings = {}) {
    const agentsById = indexBy(registries.agents.agents);
    const protocolsById = indexBy(registries.protocols.protocols);
    const profile = registries.relations.presetProfiles?.[flow.id] || {};
    const nodes = [];
    const edges = [];
    let sequence = 1;
    const addNode = (item) => { if (!nodes.some((existing) => existing.id === item.id)) nodes.push(item); };
    const addEdge = (from, to, relation, options) => edges.push(edge(from, to, relation, sequence++, options));

    addNode(node("system:tantalus", "Sistema Tántalo", "system", 0, "Skill principal solicitada por el flujo.", { estimatedCost: "bajo", metadata: { statusLabel: "PREVISTO" } }));
    addNode(node("skill:sistema-tantalo", "Skill · sistema-tantalo", "skill", 0, "Invocación explícita incluida en el prompt.", { metadata: { path: ".agents/skills/sistema-tantalo/SKILL.md", statusLabel: "PREVISTO" } }));
    addEdge("system:tantalus", "skill:sistema-tantalo", "INVOCA");

    const protocolId = protocolFor(flow, registries);
    const mainProtocol = protocolsById.get(protocolId);
    if (mainProtocol) {
      addNode(node(`protocol:${mainProtocol.id}`, mainProtocol.label, "protocol", Math.max(1, mainProtocol.depth), "Protocolo asociado al objetivo seleccionado.", { metadata: { path: mainProtocol.path, category: mainProtocol.category, statusLabel: "PREVISTO" } }));
      addEdge("skill:sistema-tantalo", `protocol:${mainProtocol.id}`, "INVOCA");
    }

    (profile.extraProtocols || []).forEach((protocolExtraId) => {
      const item = protocolsById.get(protocolExtraId);
      if (!item) return;
      addNode(node(`protocol:${item.id}`, item.label, "protocol", item.depth, "Etapa complementaria definida por el preset.", { metadata: { path: item.path, category: item.category, statusLabel: "PREVISTO" } }));
      addEdge(`protocol:${protocolId}`, `protocol:${item.id}`, "CONSULTA");
    });

    const selectedAgents = [...new Set([...(profile.implicitAgents || []), ...(flow.agents || [])])];
    let previous = `protocol:${(profile.extraProtocols || []).at(-1) || protocolId}`;
    selectedAgents.forEach((agentId, index) => {
      const agent = agentsById.get(agentId);
      if (!agent) return;
      const explicit = (flow.agents || []).includes(agentId);
      const agentNodeId = `agent:${agentId}`;
      addNode(node(agentNodeId, agent.label, agentId === "guardian-canon" ? "evaluator" : "agent", Math.min(4, 2 + Math.floor(index / 2)), explicit ? "Agente seleccionado en el flujo." : "Rol implícito definido por el preset.", {
        explicit,
        source: explicit ? "workflow" : "preset",
        estimatedCost: agent.estimatedCost,
        metadata: { specialty: agent.specialty, sandbox: agent.sandbox, statusLabel: "PREVISTO" }
      }));
      addEdge(previous, agentNodeId, agentId === "guardian-canon" ? "VALIDA" : "INVOCA");
      previous = agentNodeId;
    });

    const candidateCount = Number(flow.options?.candidates || 0);
    if (candidateCount > 0 || profile.candidateGroup) {
      const count = candidateCount || 4;
      addNode(node("process:candidates", `Candidatos A–${String.fromCharCode(64 + count)}`, "process", 4, `${count} candidatos solicitados por el flujo.`, { estimatedCost: "alto", metadata: { count, statusLabel: "PREVISTO" } }));
      addEdge(previous, "process:candidates", "ENTREGA");
      previous = "process:candidates";
    }

    if (flow.options?.blind || profile.evaluator) {
      addNode(node("evaluator:blind", "Comparación ciega", "evaluator", 4, "Evaluación sin revelar el origen de los candidatos.", { estimatedCost: "alto", metadata: { statusLabel: "PREVISTO" } }));
      addEdge(previous, "evaluator:blind", "COMPARA");
      previous = "evaluator:blind";
    }

    const fileNodes = [
      { id: "file:context", label: "CONTEXTO_ACTIVO.md", reason: "Contexto mínimo autorizado.", depth: 1 }
    ];
    if (flow.scope && flow.scope !== "pregunta") fileNodes.push({ id: "file:material", label: `Material · ${flow.scope}`, reason: "Material que indicará el autor.", depth: 1 });
    if (flow.options?.additionalFiles) fileNodes.push({ id: "file:references", label: "Referencias necesarias", reason: "Lectura adicional limitada por el prompt.", depth: 2 });
    fileNodes.forEach((file) => {
      addNode(node(file.id, file.label, "file", file.depth, file.reason, { estimatedCost: "bajo", metadata: { authorized: true, statusLabel: "PREVISTO" } }));
      addEdge("skill:sistema-tantalo", file.id, "LEE");
    });

    if (selectedAgents.includes("guardian-canon")) {
      addNode(node("veto:canon", "Veto de canon", "veto", 3, "Salvaguarda disponible; no se activa sin contradicción observable.", { status: "EN ESPERA", explicit: false, source: "safeguard", estimatedCost: "bajo", metadata: { statusLabel: "PREVISTO" } }));
    }

    const resultLabel = profile.result || (flow.objective === "escribir" ? "Respuesta de acompañamiento" : "Informe Tántalo");
    addNode(node("result:output", resultLabel, "result", Math.min(5, Math.max(1, root.TantaloDepthEngine?.estimate(flow).estimated || 1)), "Salida prevista del flujo.", { estimatedCost: "bajo", metadata: { statusLabel: "PREVISTO" } }));
    addEdge(previous, "result:output", flow.agents?.includes("integrador-editorial") ? "INTEGRA" : "ENTREGA");
    if (nodes.some((item) => item.id === "veto:canon")) addEdge("agent:guardian-canon", "veto:canon", "VETA");
    if (flow.options?.write) addEdge(previous, "result:output", "ESCRIBE");
    if (flow.options?.memory) addEdge("result:output", "file:context", "ACTUALIZA MEMORIA");

    if (settings.showWaiting) {
      registries.agents.agents.forEach((agent) => {
        if (nodes.some((item) => item.id === `agent:${agent.id}`)) return;
        addNode(node(`agent:${agent.id}`, agent.label, agent.id === "guardian-canon" ? "evaluator" : "agent", 2, "Disponible, pero no seleccionado para este flujo.", { status: "EN ESPERA", explicit: false, source: "registry", estimatedCost: agent.estimatedCost, metadata: { specialty: agent.specialty, sandbox: agent.sandbox, statusLabel: "PREVISTO" } }));
      });
    }

    const depth = root.TantaloDepthEngine.estimate(flow, settings.requestedDepth);
    const warnings = [];
    if ((flow.agents || []).length >= 4) warnings.push("CUATRO AGENTES ACTIVOS");
    if (flow.options?.blind) warnings.push("COMPARACIÓN CIEGA HABILITADA");
    if (flow.options?.web) warnings.push("ACCESO WEB HABILITADO");
    if (flow.options?.write) warnings.push("MODIFICACIÓN DE ARCHIVOS HABILITADA");
    if (depth.estimated >= 5) warnings.push("PROFUNDIDAD DE AUDITORÍA");
    if (["novela", "saga"].includes(flow.scope)) warnings.push("CONTEXTO EXTENSO");

    const graph = {
      schemaVersion: 1,
      runId: `preview-${flow.id || "custom"}`,
      mode: "preview",
      workflow: flow.id || "custom",
      requestedDepth: depth.requested,
      estimatedDepth: depth.estimated,
      confirmedDepth: null,
      nodes,
      edges,
      warnings,
      costLevel: depth.costLevel,
      metrics: depth
    };
    const validation = validateGraph(graph);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    return graph;
  }

  function applyEvents(graph, events, simulation = false) {
    const clone = JSON.parse(JSON.stringify(graph));
    clone.mode = simulation ? "simulation" : "live";
    (events || []).forEach((event) => {
      const item = clone.nodes.find((entry) => entry.id === event.nodeId);
      if (!item) return;
      if (event.status) item.status = event.status;
      item.source = simulation ? "simulation" : "telemetry";
      item.startTime = item.startTime || event.timestamp;
      if (["COMPLETADO", "ERROR", "VETO", "CANCELADO"].includes(item.status)) item.endTime = event.timestamp;
      item.metadata.operation = event.operation || item.metadata.operation;
      item.metadata.resultSummary = event.summary || item.metadata.resultSummary;
      item.metadata.statusLabel = simulation ? "SIMULADO" : "CONFIRMADO";
      clone.edges.filter((link) => link.target === item.id).forEach((link) => {
        link.status = item.status;
        link.confirmed = !simulation;
      });
    });
    clone.confirmedDepth = simulation ? null : root.TantaloDepthEngine.confirmedFromGraph(clone);
    return clone;
  }

  function traceRoute(graph, targetId) {
    const keep = new Set([targetId, "system:tantalus"]);
    let changed = true;
    while (changed) {
      changed = false;
      graph.edges.forEach((link) => {
        if (keep.has(link.target) && !keep.has(link.source)) {
          keep.add(link.source);
          changed = true;
        }
      });
    }
    graph.edges.filter((link) => link.source === targetId || link.relation === "VETA").forEach((link) => {
      keep.add(link.source);
      keep.add(link.target);
    });
    return {
      nodeIds: [...keep],
      edges: graph.edges.filter((link) => keep.has(link.source) && keep.has(link.target))
    };
  }

  root.TantaloGraphEngine = { buildGraph, validateGraph, applyEvents, traceRoute, node, edge };
})(globalThis);
