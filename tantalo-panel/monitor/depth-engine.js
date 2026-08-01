(function (root) {
  "use strict";

  const SCOPE_WEIGHT = { pregunta: 0, fragmento: 0, "selección": 0, escena: 1, "capítulo": 2, novela: 3, saga: 4 };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function estimate(flow, requestedDepth) {
    const options = flow.options || {};
    const agents = flow.agents || [];
    let depth = flow.mode === "Profundo" ? 4 : flow.mode === "Revisión de Capítulo" ? 2 : 1;
    if (agents.length >= 1) depth = Math.max(depth, 2);
    if (agents.length >= 2 || options.blind) depth = Math.max(depth, 3);
    if (Number(options.candidates || 0) >= 2 || options.generate || agents.includes("integrador-editorial")) depth = Math.max(depth, 4);
    if (/torneo/i.test(flow.title || "") || (options.blind && agents.includes("guardian-canon")) || flow.id === "torneo-versiones") depth = 5;
    if (flow.id === "cerrar-capitulo" && options.memory) depth = Math.max(depth, 5);

    const requested = clamp(requestedDepth == null ? depth : requestedDepth, 0, 5);
    const estimated = clamp(Math.max(depth, requested), 0, 5);
    const complexity = clamp(12 + estimated * 15 + agents.length * 5 + Number(options.candidates || 0) * 3, 0, 100);
    const context = clamp(10 + (SCOPE_WEIGHT[flow.scope] || 0) * 16 + (options.additionalFiles ? 14 : 0), 0, 100);
    const costScore = clamp(8 + estimated * 14 + agents.length * 4 + (options.web ? 9 : 0) + (options.write ? 9 : 0), 0, 100);
    const costLevel = costScore < 30 ? "BAJO" : costScore < 52 ? "MEDIO" : costScore < 76 ? "ALTO" : "MUY ALTO";
    return { requested, estimated, confirmed: null, complexity, context, costScore, costLevel };
  }

  function confirmedFromGraph(graph) {
    const confirmed = (graph.nodes || []).filter((node) => node.status === "ACTIVO" || node.status === "COMPLETADO").filter((node) => node.source === "telemetry");
    return confirmed.length ? Math.max(...confirmed.map((node) => Number(node.depth) || 0)) : null;
  }

  root.TantaloDepthEngine = { estimate, confirmedFromGraph, clamp };
})(globalThis);
