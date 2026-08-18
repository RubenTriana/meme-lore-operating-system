(function (root) {
  "use strict";

  class TelemetryClient extends EventTarget {
    constructor(baseUrl = "http://127.0.0.1:8765") {
      super();
      this.baseUrl = baseUrl;
      this.source = null;
      this.mode = "off";
    }

    async probe() {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1400);
      try {
        const response = await fetch(`${this.baseUrl}/health`, { cache: "no-store", signal: controller.signal, credentials: "omit" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data && data.service === "tantalo-telemetry" && data.transport === "stdio" ? data : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    }

    async connect() {
      this.disconnect();
      const health = await this.probe();
      if (!health) {
        this.mode = "unavailable";
        this.dispatchEvent(new CustomEvent("status", { detail: { mode: this.mode, message: "Telemetría local no disponible." } }));
        return false;
      }
      this.source = new EventSource(`${this.baseUrl}/events`, { withCredentials: false });
      this.mode = "connecting";
      this.source.onopen = () => {
        this.mode = "live";
        this.dispatchEvent(new CustomEvent("status", { detail: { mode: "live", message: "Monitor en vivo conectado por puente localhost." } }));
      };
      this.source.onmessage = (message) => {
        try {
          const event = root.TantaloActivityScope.sanitizeEvent(JSON.parse(message.data));
          if (event) this.dispatchEvent(new CustomEvent("event", { detail: event }));
        } catch { /* descarta mensajes corruptos */ }
      };
      this.source.onerror = () => {
        this.disconnect();
        this.mode = "unavailable";
        this.dispatchEvent(new CustomEvent("status", { detail: { mode: this.mode, message: "Se perdió la conexión de telemetría." } }));
      };
      return true;
    }

    disconnect() {
      if (this.source) this.source.close();
      this.source = null;
      if (this.mode !== "unavailable") this.mode = "off";
    }

    async loadSimulation(path = "telemetry/sample-events.jsonl") {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return root.TantaloActivityScope.parseJsonLines(await response.text());
    }
  }

  root.TantaloTelemetryClient = TelemetryClient;
})(globalThis);
