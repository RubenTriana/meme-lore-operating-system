(function (root) {
  "use strict";

  const ALLOWED_METHODS = new Set([
    "turn/started", "turn/completed", "turn/plan/updated", "item/started", "item/completed",
    "skills/changed", "warning", "error", "file/changed", "usage/updated"
  ]);
  const ALLOWED_STATUS = new Set(["PLANIFICADO", "SOLICITADO", "ACTIVO", "INFERIDO", "EN ESPERA", "COMPLETADO", "VETO", "ERROR", "CANCELADO"]);

  function cleanText(value, max = 180) {
    return String(value == null ? "" : value).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  }

  function cleanPath(value) {
    const path = cleanText(value, 220).replace(/\\/g, "/");
    if (!path || /^[a-z]+:\/\//i.test(path) || path.includes("..")) return "";
    return path.replace(/^\/+/, "");
  }

  function sanitizeEvent(input) {
    if (!input || typeof input !== "object" || !ALLOWED_METHODS.has(input.method)) return null;
    const data = input.data && typeof input.data === "object" ? input.data : {};
    const status = ALLOWED_STATUS.has(data.status) ? data.status : undefined;
    return {
      method: input.method,
      runId: cleanText(input.runId, 80),
      nodeId: cleanText(data.nodeId, 80),
      label: cleanText(data.label, 100),
      type: cleanText(data.type, 40),
      status,
      operation: cleanText(data.operation, 100),
      summary: cleanText(data.summary, 180),
      relativePath: cleanPath(data.relativePath),
      timestamp: Number.isFinite(Number(input.timestamp)) ? Number(input.timestamp) : null,
      usage: data.usage && typeof data.usage === "object" ? {
        inputTokens: Number.isFinite(Number(data.usage.inputTokens)) ? Number(data.usage.inputTokens) : null,
        outputTokens: Number.isFinite(Number(data.usage.outputTokens)) ? Number(data.usage.outputTokens) : null
      } : null
    };
  }

  function parseJsonLines(text) {
    const events = [];
    const errors = [];
    String(text || "").split(/\r?\n/).forEach((line, index) => {
      if (!line.trim()) return;
      try {
        const event = sanitizeEvent(JSON.parse(line));
        if (event) events.push(event);
        else errors.push(`Línea ${index + 1}: evento no permitido.`);
      } catch {
        errors.push(`Línea ${index + 1}: JSON inválido.`);
      }
    });
    return { events, errors };
  }

  root.TantaloActivityScope = { sanitizeEvent, parseJsonLines, cleanText, cleanPath, ALLOWED_METHODS };
})(globalThis);
