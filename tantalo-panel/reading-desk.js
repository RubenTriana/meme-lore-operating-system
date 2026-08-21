(function () {
  "use strict";

  const LIMITS = { fragmento: 1500, escena: 3000, capitulo: 6000 };
  const STOP_WORDS = new Set("a al algo ante antes asi aun bajo bien cada casi como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era es esa ese eso esta estaba este esto fue ha hacia hasta hay la las le les lo los mas me mi muy ni no nos o otra para pero por porque que quien se ser si sin sobre son su sus te tiene todo tras tu un una unas uno unos ya y".split(" "));
  const $ = (selector) => document.querySelector(selector);
  const state = { health: null, evaluation: null, controller: null };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const text = $("#readingText");
    if (!text) return;
    text.addEventListener("input", updateLocalReading);
    $("#readingScope").addEventListener("change", updateLocalReading);
    $("#runEvaluation").addEventListener("click", runEvaluation);
    $("#clearReading").addEventListener("click", clearReading);
    $("#openReadingInCodex").addEventListener("click", copyAndOpenInCodex);
    $("#copyEvaluation").addEventListener("click", copyEvaluationReport);
    $("#toggleApiSetup").addEventListener("click", toggleApiSetup);
    $("#apiSetupPanel").addEventListener("submit", configureApiKey);
    window.addEventListener("pagehide", eraseVolatileText);
    updateLocalReading();
    checkEvaluator();
  }

  function tokenize(text) {
    return text.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .match(/[a-zñüáéíóú]+/giu) || [];
  }

  function countWords(text) {
    return tokenize(text).length;
  }

  function analyzeText(text) {
    const words = tokenize(text);
    const sentences = text.trim() ? (text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/gu) || []).filter((item) => item.trim()).length : 0;
    const paragraphs = text.trim() ? text.trim().split(/\n\s*\n/u).filter(Boolean).length : 0;
    const unique = new Set(words);
    const dialogueWords = text.split(/\n/u).filter((line) => /^\s*[—–-]|^\s*[«“"]/u.test(line)).reduce((sum, line) => sum + countWords(line), 0);
    const frequency = new Map();
    words.filter((word) => word.length > 3 && !STOP_WORDS.has(word)).forEach((word) => frequency.set(word, (frequency.get(word) || 0) + 1));
    const repetitions = [...frequency.entries()].filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).slice(0, 6);
    return {
      words: words.length,
      sentences,
      paragraphs,
      average: sentences ? words.length / sentences : 0,
      variety: words.length ? unique.size / words.length : 0,
      dialogue: words.length ? dialogueWords / words.length : 0,
      repetitions,
    };
  }

  function updateLocalReading() {
    const text = $("#readingText").value;
    const scope = $("#readingScope").value;
    const metrics = analyzeText(text);
    const limit = LIMITS[scope];
    const overLimit = metrics.words > limit;
    $("#readingCounter").innerHTML = `<strong>${metrics.words.toLocaleString("es-CO")}</strong> palabras · <span>límite ${limit.toLocaleString("es-CO")}</span>`;
    $("#readingCounter").dataset.state = overLimit ? "over" : metrics.words > limit * .85 ? "near" : "ok";
    $("#metricWords").textContent = metrics.words.toLocaleString("es-CO");
    $("#metricSentences").textContent = metrics.sentences.toLocaleString("es-CO");
    $("#metricSentenceAverage").textContent = metrics.sentences ? `${metrics.average.toFixed(1)} palabras` : "—";
    $("#metricParagraphs").textContent = metrics.paragraphs.toLocaleString("es-CO");
    $("#metricVariety").textContent = metrics.words ? `${Math.round(metrics.variety * 100)} %` : "—";
    $("#metricDialogue").textContent = metrics.words ? `${Math.round(metrics.dialogue * 100)} %` : "—";
    renderRepetitions(metrics.repetitions);
    renderLocalSignal(metrics, overLimit, limit);
    syncEvaluationButton(metrics.words, overLimit);
  }

  function renderRepetitions(repetitions) {
    const container = $("#metricRepetitions");
    container.replaceChildren();
    if (!repetitions.length) {
      const empty = document.createElement("span");
      empty.className = "empty-metric";
      empty.textContent = "Sin repeticiones dominantes con el umbral actual.";
      container.append(empty);
      return;
    }
    repetitions.forEach(([word, count]) => {
      const item = document.createElement("span");
      item.className = "repetition-chip";
      item.textContent = `${word} × ${count}`;
      container.append(item);
    });
  }

  function renderLocalSignal(metrics, overLimit, limit) {
    const signal = $("#localSignal");
    let level = "neutral";
    let title = "ESPERANDO TEXTO";
    let message = "La señal local aparecerá cuando exista material suficiente.";
    if (overLimit) {
      level = "warning";
      title = "ALCANCE EXCEDIDO";
      message = `Reduce el texto o cambia el alcance. El límite actual es ${limit.toLocaleString("es-CO")} palabras.`;
    } else if (metrics.words >= 15) {
      level = "ready";
      title = "MATERIAL LISTO";
      const sentenceSignal = metrics.average > 28 ? "La oración media es extensa; comprueba si la densidad es deliberada." : metrics.average < 8 ? "La oración media es breve; comprueba si el pulso admite variación." : "La longitud media de oración está en una franja moderada.";
      message = sentenceSignal;
    }
    signal.dataset.level = level;
    signal.querySelector("strong").textContent = title;
    signal.querySelector("p").textContent = message;
  }

  async function checkEvaluator() {
    const status = $("#evaluatorStatus");
    try {
      const response = await fetch("/api/tantalo/evaluation/health", { cache: "no-store" });
      if (!response.ok) throw new Error("Estado no disponible");
      state.health = await response.json();
      if (state.health.ready) {
        status.dataset.state = "ready";
        status.textContent = `EN LÍNEA · ${state.health.model}`;
        $("#toggleApiSetup").hidden = true;
        $("#apiSetupPanel").hidden = true;
        $("#readingActionHelp").textContent = "La evaluación cualitativa usa OpenAI Responses API con almacenamiento desactivado.";
      } else {
        status.dataset.state = "config";
        status.textContent = "CONFIGURACIÓN REQUERIDA";
        $("#toggleApiSetup").hidden = false;
        $("#readingActionHelp").textContent = "La lectura local funciona. Pulsa «Configurar API» para activar el informe cualitativo sin salir de Tántalo.";
      }
    } catch {
      state.health = { ready: false };
      status.dataset.state = "error";
      status.textContent = "MOTOR NO DISPONIBLE";
      $("#readingActionHelp").textContent = "El servidor local no expone el motor de evaluación. Reinicia el lanzador Tántalo.";
    }
    updateLocalReading();
  }

  function toggleApiSetup() {
    const panel = $("#apiSetupPanel");
    const button = $("#toggleApiSetup");
    panel.hidden = !panel.hidden;
    button.setAttribute("aria-expanded", String(!panel.hidden));
    if (!panel.hidden) $("#tantaloApiKey").focus();
  }

  async function configureApiKey(event) {
    event.preventDefault();
    const input = $("#tantaloApiKey");
    const button = $("#saveApiKey");
    const apiStatus = $("#apiSetupStatus");
    const apiKey = input.value.trim();
    if (!apiKey) {
      apiStatus.dataset.state = "error";
      apiStatus.textContent = "Pega una API key antes de continuar.";
      input.focus();
      return;
    }
    button.disabled = true;
    button.textContent = "Verificando…";
    apiStatus.dataset.state = "working";
    apiStatus.textContent = "Comprobando la clave directamente con OpenAI. No cierres esta página.";
    try {
      const response = await fetch("/api/tantalo/evaluation/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No se pudo verificar la clave.");
      input.value = "";
      apiStatus.dataset.state = "success";
      apiStatus.textContent = "Clave verificada y guardada localmente. El motor está en línea.";
      await checkEvaluator();
      announce("Motor editorial conectado. Ya puedes evaluar dentro de Tántalo.", "success");
    } catch (error) {
      apiStatus.dataset.state = "error";
      apiStatus.textContent = error.message || "La conexión falló.";
      input.select();
    } finally {
      button.disabled = false;
      button.textContent = "Probar y guardar";
    }
  }

  function syncEvaluationButton(words, overLimit) {
    const button = $("#runEvaluation");
    const configured = Boolean(state.health?.ready);
    button.disabled = !configured || words < 15 || overLimit || Boolean(state.controller);
    if (state.controller) button.textContent = "Evaluando…";
    else if (!configured) button.textContent = "Motor cualitativo sin configurar";
    else button.textContent = "Evaluar dentro de Tántalo";
  }

  function evaluationRequest() {
    return {
      text: $("#readingText").value,
      scope: $("#readingScope").value,
      focus: $("#readingFocus").value,
      objective: $("#readingObjective").value,
      protectCanon: $("#readingProtectCanon").checked,
      protectVoice: $("#readingProtectVoice").checked,
    };
  }

  async function runEvaluation() {
    const request = evaluationRequest();
    if (countWords(request.text) < 15) return announce("Pega al menos 15 palabras antes de evaluar.", "error");
    state.controller = new AbortController();
    updateLocalReading();
    announce("Evaluación editorial en curso. El texto no se guardará.", "working");
    try {
      const response = await fetch("/api/tantalo/evaluation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: state.controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No se pudo completar la evaluación.");
      state.evaluation = payload;
      renderEvaluation(payload);
      announce("Evaluación completada. El informe está listo bajo la Mesa de Lectura.", "success");
    } catch (error) {
      if (error.name !== "AbortError") announce(error.message || "La evaluación falló.", "error");
    } finally {
      state.controller = null;
      updateLocalReading();
    }
  }

  function renderEvaluation(payload) {
    const report = payload.evaluation || {};
    const body = $("#evaluationResultBody");
    body.replaceChildren();
    body.append(sectionBlock("Veredicto", report.verdict), sectionBlock("Problema dominante", report.dominant_problem));

    const columns = document.createElement("div");
    columns.className = "evaluation-columns";
    columns.append(listBlock("Potencias que conviene proteger", report.strengths, "strength"));
    columns.append(scoreBlock(report.scores || {}));
    body.append(columns);

    const findings = document.createElement("section");
    findings.className = "finding-list";
    const findingTitle = document.createElement("h4");
    findingTitle.textContent = "Hallazgos con evidencia";
    findings.append(findingTitle);
    (report.findings || []).forEach((finding) => findings.append(findingCard(finding)));
    body.append(findings);

    const risks = document.createElement("div");
    risks.className = "evaluation-columns";
    risks.append(listBlock("Riesgos de canon", report.canon_risks, "risk"));
    risks.append(listBlock("Riesgos de voz", report.voice_risks, "risk"));
    body.append(risks);

    const next = sectionBlock("Siguiente acción", report.next_action);
    next.classList.add("next-action-block");
    body.append(next);
    $("#evaluationModel").textContent = String(payload.meta?.model || state.health?.model || "modelo no informado").toUpperCase();
    $("#evaluationResult").hidden = false;
    $("#evaluationResult").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function sectionBlock(title, text) {
    const section = document.createElement("section");
    section.className = "evaluation-block";
    const heading = document.createElement("h4");
    heading.textContent = title;
    const paragraph = document.createElement("p");
    paragraph.textContent = text || "Sin observaciones.";
    section.append(heading, paragraph);
    return section;
  }

  function listBlock(title, values, variant) {
    const section = document.createElement("section");
    section.className = `evaluation-list-block ${variant}`;
    const heading = document.createElement("h4");
    heading.textContent = title;
    const list = document.createElement("ul");
    const items = Array.isArray(values) && values.length ? values : ["No se detectaron señales demostrables en esta lectura."];
    items.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = String(value);
      list.append(item);
    });
    section.append(heading, list);
    return section;
  }

  function scoreBlock(scores) {
    const labels = { funcion_narrativa: "Función", claridad: "Claridad", tension: "Tensión", ritmo: "Ritmo", voz: "Voz", originalidad: "Originalidad" };
    const section = document.createElement("section");
    section.className = "score-block";
    const heading = document.createElement("h4");
    heading.textContent = "Lectura orientativa · 0–10";
    section.append(heading);
    Object.entries(labels).forEach(([key, label]) => {
      const row = document.createElement("div");
      row.className = "score-row";
      const value = Math.max(0, Math.min(10, Number(scores[key]) || 0));
      const name = document.createElement("span");
      name.textContent = label;
      const track = document.createElement("span");
      track.className = "score-track";
      const fill = document.createElement("span");
      fill.style.width = `${value * 10}%`;
      track.append(fill);
      const number = document.createElement("strong");
      number.textContent = value.toFixed(1);
      row.append(name, track, number);
      section.append(row);
    });
    return section;
  }

  function findingCard(finding) {
    const article = document.createElement("article");
    article.className = "finding-card";
    article.dataset.priority = finding.priority || "media";
    const header = document.createElement("div");
    const title = document.createElement("h5");
    title.textContent = finding.area || "Hallazgo";
    const priority = document.createElement("span");
    priority.textContent = `PRIORIDAD ${(finding.priority || "media").toUpperCase()}`;
    header.append(title, priority);
    const evidence = document.createElement("blockquote");
    evidence.textContent = finding.evidence || "Sin evidencia citada.";
    const effect = document.createElement("p");
    effect.textContent = finding.effect || "Sin efecto descrito.";
    const question = document.createElement("p");
    question.className = "revision-question";
    question.textContent = finding.revision_question || "¿Qué cambio mínimo preservaría la intención?";
    article.append(header, evidence, effect, question);
    return article;
  }

  function buildCodexPackage(request) {
    const voice = request.protectVoice ? "Protege mi voz: no normalices ni reescribas el fragmento." : "Señala riesgos de voz sin sustituirla.";
    const canon = request.protectCanon ? "No inventes canon ni adelantes revelaciones." : "No realices contraste canónico.";
    return [
      "Usa $sistema-tantalo.",
      "Modo: " + (request.scope === "capitulo" ? "Revisión de Capítulo" : "Tutor Ligero") + ".",
      `Evalúa únicamente este ${request.scope} con enfoque ${request.focus}.`,
      voice,
      canon,
      "Diagnostica con evidencia, efecto y prioridad. No modifiques archivos. Termina con una sola acción concreta.",
      request.objective ? `Indicación del autor: ${request.objective}` : "",
      "",
      "<manuscrito_autor>",
      request.text,
      "</manuscrito_autor>",
    ].filter(Boolean).join("\n");
  }

  async function copyAndOpenInCodex() {
    const request = evaluationRequest();
    if (countWords(request.text) < 15) return announce("Pega al menos 15 palabras antes de preparar la evaluación.", "error");
    const copied = await copyText(buildCodexPackage(request));
    if (!copied) return announce("No pude copiar el paquete. Selecciona el texto manualmente.", "error");
    const repo = $("#repoPath")?.value.trim();
    announce("Paquete copiado. En Codex, pulsa Ctrl+V para pegarlo; el manuscrito no viaja en la URL.", "success");
    if (repo) setTimeout(() => { location.href = `codex://new?path=${encodeURIComponent(repo)}`; }, 450);
  }

  async function copyEvaluationReport() {
    if (!state.evaluation?.evaluation) return;
    const report = state.evaluation.evaluation;
    const text = [
      "INFORME TÁNTALO",
      `Veredicto: ${report.verdict}`,
      `Problema dominante: ${report.dominant_problem}`,
      "",
      "Potencias:", ...(report.strengths || []).map((item) => `- ${item}`),
      "",
      "Hallazgos:", ...(report.findings || []).map((item) => `- [${item.priority}] ${item.area}: ${item.evidence} → ${item.effect} Pregunta: ${item.revision_question}`),
      "",
      `Siguiente acción: ${report.next_action}`,
    ].join("\n");
    announce(await copyText(text) ? "Informe copiado." : "No pude copiar el informe.", "success");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const helper = document.createElement("textarea");
      helper.value = text;
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.append(helper);
      helper.select();
      const copied = document.execCommand("copy");
      helper.remove();
      return copied;
    }
  }

  function clearReading() {
    if (state.controller) state.controller.abort();
    eraseVolatileText();
    state.evaluation = null;
    $("#evaluationResult").hidden = true;
    updateLocalReading();
    $("#readingText").focus();
    announce("El manuscrito y el informe fueron eliminados de esta sesión.", "success");
  }

  function eraseVolatileText() {
    const text = $("#readingText");
    const objective = $("#readingObjective");
    const apiKey = $("#tantaloApiKey");
    if (text) text.value = "";
    if (objective) objective.value = "";
    if (apiKey) apiKey.value = "";
    state.evaluation = null;
  }

  function announce(message, stateName) {
    const help = $("#readingActionHelp");
    help.textContent = message;
    help.dataset.state = stateName;
  }
})();
