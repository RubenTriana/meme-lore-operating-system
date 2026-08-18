#!/usr/bin/env python3
"""Comprueba archivos, directorios y enlaces locales esenciales del Sistema Tántalo."""

from __future__ import annotations

import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
REQUIRED_FILES = [
    "AGENTS.md", "README.md", "PLANS.md", "ESTADO_DEL_PROYECTO.md", "PROXIMA_SESION.md", "CONTEXTO_ACTIVO.md",
    ".codex/config.toml", ".agents/skills/sistema-tantalo/SKILL.md",
    "00_direccion/vision-de-la-saga.md", "01_canon/canon-maestro.md", "02_estilo/voz-del-autor.md",
    "03_saga/arquitectura-de-la-saga.md", "04_investigacion/fuentes.md",
    "05_decisiones/registro-editorial.md", "06_progreso/tablero.md",
    "03_saga/novelas/01-operacion-tantalo/estado-narrativo.md",
    "03_saga/novelas/01-operacion-tantalo/capitulos/capitulo-01/brief.md",
    "03_saga/novelas/01-operacion-tantalo/capitulos/capitulo-01/original.md",
    ".codex/agents/mentor-aprendizaje.toml",
    ".agents/skills/sistema-tantalo/references/protocolo-aprendizaje-deliberado.md",
    ".agents/skills/sistema-tantalo/references/taxonomia-habilidades-narrativas.md",
    ".agents/skills/sistema-tantalo/references/criterios-calidad-fuentes.md",
    ".agents/skills/sistema-tantalo/assets/plantilla-intervencion-aprendizaje.md",
    ".agents/skills/sistema-tantalo/references/modo-tutor-ligero.md",
    ".agents/skills/sistema-tantalo/references/modo-revision-capitulo.md",
    ".agents/skills/sistema-tantalo/references/modo-profundo.md",
    "08_aprendizaje/README.md", "08_aprendizaje/perfil-de-habilidades.md",
    "08_aprendizaje/cola-de-aprendizaje.md", "08_aprendizaje/biblioteca-curada.md",
    "08_aprendizaje/plan-minimo-activo.md", "08_aprendizaje/conceptos-dominados.md",
    "08_aprendizaje/registro-de-transferencia.md",
    "tantalo-panel/index.html", "tantalo-panel/styles.css", "tantalo-panel/app.js",
    "tantalo-panel/workflows.json", "tantalo-panel/README.md", "tantalo-panel/assets/tantalo-mark.svg",
    "tantalo-panel/monitor/monitor.js", "tantalo-panel/monitor/monitor.css",
    "tantalo-panel/monitor/graph-engine.js", "tantalo-panel/monitor/telemetry-client.js",
    "tantalo-panel/monitor/depth-engine.js", "tantalo-panel/monitor/activity-scope.js",
    "tantalo-panel/monitor/monitor-accessibility.js",
    "tantalo-panel/data/skill-registry.json", "tantalo-panel/data/agent-registry.json",
    "tantalo-panel/data/protocol-registry.json", "tantalo-panel/data/graph-relations.json",
    "tantalo-panel/data/depth-levels.json", "tantalo-panel/vendor/cytoscape.min.js",
    "tantalo-panel/vendor/LICENSE-cytoscape.txt", "tantalo-panel/vendor/README.md",
    "tantalo-panel/telemetry/README.md", "tantalo-panel/telemetry/sample-events.jsonl",
    "tantalo-panel/telemetry/runtime-state.example.json", "tantalo-panel/tests/monitor-check.cjs",
    "ABRIR_PANEL_TANTALO.bat", "ABRIR_PANEL_TANTALO.ps1",
    ".agents/skills/sistema-tantalo/agents/openai.yaml",
    ".agents/skills/sistema-tantalo/assets/tantalo-icon.svg",
]
REQUIRED_DIRS = [
    "01_canon/personajes", "01_canon/organizaciones", "01_canon/tecnologias", "01_canon/metafisica",
    "02_estilo/muestras-aprobadas", "03_saga/novelas/01-operacion-tantalo/capitulos/capitulo-01/candidatos",
    "07_exportaciones/manuscrito", "07_exportaciones/copias-de-seguridad",
    "08_aprendizaje/practicas", "08_aprendizaje/evaluaciones",
    "tantalo-panel/assets", "tantalo-panel/monitor", "tantalo-panel/data", "tantalo-panel/vendor",
    "tantalo-panel/telemetry", "tantalo-panel/tests", ".agents/skills/sistema-tantalo/agents",
]
LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
FRONTMATTER_RE = re.compile(r"\A---\r?\n(.*?)\r?\n---", re.DOTALL)


def markdown_files() -> list[Path]:
    roots = [ROOT / name for name in ["00_direccion", "01_canon", "02_estilo", "03_saga", "04_investigacion", "05_decisiones", "06_progreso", "08_aprendizaje", "tantalo-panel", ".agents/skills/sistema-tantalo"]]
    files = [ROOT / name for name in ["README.md", "AGENTS.md", "PLANS.md", "ESTADO_DEL_PROYECTO.md", "PROXIMA_SESION.md", "CONTEXTO_ACTIVO.md"]]
    for base in roots:
        if base.exists():
            files.extend(base.rglob("*.md"))
    return files


def main() -> int:
    missing = [item for item in REQUIRED_FILES if not (ROOT / item).is_file()]
    missing_dirs = [item for item in REQUIRED_DIRS if not (ROOT / item).is_dir()]
    broken: list[str] = []
    invalid_agents: list[str] = []
    invalid_skills: list[str] = []
    policy_issues: list[str] = []
    panel_issues: list[str] = []
    for source in markdown_files():
        text = source.read_text(encoding="utf-8")
        for raw in LINK_RE.findall(text):
            target = raw.split("#", 1)[0].strip()
            if not target or "://" in target or target.startswith(("mailto:", "data:")):
                continue
            if not (source.parent / target).resolve().exists():
                broken.append(f"{source.relative_to(ROOT)} -> {raw}")
    for agent_file in sorted((ROOT / ".codex/agents").glob("*.toml")):
        try:
            agent = tomllib.loads(agent_file.read_text(encoding="utf-8"))
        except (OSError, tomllib.TOMLDecodeError) as error:
            invalid_agents.append(f"{agent_file.relative_to(ROOT)}: {error}")
            continue
        required_keys = {"name", "description", "sandbox_mode", "developer_instructions"}
        absent = required_keys.difference(agent)
        if absent:
            invalid_agents.append(f"{agent_file.relative_to(ROOT)}: faltan {', '.join(sorted(absent))}")
    for skill_file in sorted((ROOT / ".agents/skills").glob("*/SKILL.md")):
        content = skill_file.read_text(encoding="utf-8")
        match = FRONTMATTER_RE.match(content)
        if not match:
            invalid_skills.append(f"{skill_file.relative_to(ROOT)}: frontmatter ausente o inválido")
            continue
        fields: dict[str, str] = {}
        for line in match.group(1).splitlines():
            if ":" not in line:
                invalid_skills.append(f"{skill_file.relative_to(ROOT)}: línea de frontmatter inválida: {line}")
                continue
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip()
        if set(fields) != {"name", "description"}:
            invalid_skills.append(f"{skill_file.relative_to(ROOT)}: solo se permiten name y description")
        name = fields.get("name", "")
        description = fields.get("description", "")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name) or len(name) > 64:
            invalid_skills.append(f"{skill_file.relative_to(ROOT)}: name inválido")
        if not description or len(description) > 1024 or "<" in description or ">" in description:
            invalid_skills.append(f"{skill_file.relative_to(ROOT)}: description inválida")
    context_path = ROOT / "CONTEXTO_ACTIVO.md"
    if context_path.is_file():
        context_words = len(re.findall(r"\S+", context_path.read_text(encoding="utf-8")))
        if context_words > 1000:
            policy_issues.append(f"CONTEXTO_ACTIVO.md supera 1.000 palabras: {context_words}")
    agents_text = (ROOT / "AGENTS.md").read_text(encoding="utf-8") if (ROOT / "AGENTS.md").is_file() else ""
    if "Modo Tutor Ligero" not in agents_text or "subagentes permanecen inactivos por defecto" not in agents_text:
        policy_issues.append("AGENTS.md no declara el modo ligero y los subagentes inactivos por defecto")
    workflows_path = ROOT / "tantalo-panel/workflows.json"
    if workflows_path.is_file():
        try:
            workflows = json.loads(workflows_path.read_text(encoding="utf-8"))
            categories = {item.get("id") for item in workflows.get("categories", [])}
            expected_categories = {"hoy", "escribir", "revisar", "aprender", "laboratorio", "cierre"}
            if categories != expected_categories:
                panel_issues.append("workflows.json no contiene exactamente las seis categorías requeridas")
            presets = workflows.get("presets", [])
            actions = workflows.get("actions", [])
            identifiers = [item.get("id") for item in presets + actions]
            if len(presets) < 7:
                panel_issues.append("workflows.json debe incluir al menos siete presets")
            if len(identifiers) != len(set(identifiers)) or None in identifiers:
                panel_issues.append("workflows.json contiene identificadores ausentes o duplicados")
        except (OSError, json.JSONDecodeError) as error:
            panel_issues.append(f"workflows.json inválido: {error}")
    app_path = ROOT / "tantalo-panel/app.js"
    if app_path.is_file():
        app_text = app_path.read_text(encoding="utf-8")
        for required in ["codex://new?path=", "codex://skills", "encodeURIComponent", "navigator.clipboard", "localStorage"]:
            if required not in app_text:
                panel_issues.append(f"app.js no contiene la integración requerida: {required}")
    monitor_path = ROOT / "tantalo-panel/monitor/monitor.js"
    if monitor_path.is_file():
        monitor_text = monitor_path.read_text(encoding="utf-8")
        for required in ["PREVISUALIZACIÓN DE FLUJO", "MONITOR EN VIVO", "EJECUCIÓN SIMULADA", "127.0.0.1", "TantaloGraphEngine"]:
            if required not in monitor_text:
                panel_issues.append(f"monitor.js no contiene: {required}")
    for registry_name, root_key, minimum in [
        ("skill-registry.json", "skills", 1),
        ("agent-registry.json", "agents", 13),
        ("protocol-registry.json", "protocols", 7),
    ]:
        registry_path = ROOT / "tantalo-panel/data" / registry_name
        if registry_path.is_file():
            try:
                registry = json.loads(registry_path.read_text(encoding="utf-8"))
                if registry.get("schemaVersion") != 1 or len(registry.get(root_key, [])) < minimum:
                    panel_issues.append(f"{registry_name} no cumple el esquema mínimo")
            except (OSError, json.JSONDecodeError) as error:
                panel_issues.append(f"{registry_name} inválido: {error}")
    launcher_path = ROOT / "ABRIR_PANEL_TANTALO.ps1"
    if launcher_path.is_file() and '--bind", "127.0.0.1"' not in launcher_path.read_text(encoding="utf-8"):
        panel_issues.append("el lanzador no limita explícitamente el servidor a 127.0.0.1")
    skill_ui_path = ROOT / ".agents/skills/sistema-tantalo/agents/openai.yaml"
    if skill_ui_path.is_file():
        skill_ui = skill_ui_path.read_text(encoding="utf-8")
        for required in ["display_name: \"Sistema Tántalo\"", "allow_implicit_invocation: true", "tantalo-icon.svg"]:
            if required not in skill_ui:
                panel_issues.append(f"openai.yaml no contiene: {required}")
    if missing or missing_dirs or broken or invalid_agents or invalid_skills or policy_issues or panel_issues:
        for item in missing:
            print(f"FALTA ARCHIVO: {item}")
        for item in missing_dirs:
            print(f"FALTA DIRECTORIO: {item}")
        for item in broken:
            print(f"ENLACE ROTO: {item}")
        for item in invalid_agents:
            print(f"AGENTE INVÁLIDO: {item}")
        for item in invalid_skills:
            print(f"SKILL INVÁLIDA: {item}")
        for item in policy_issues:
            print(f"POLÍTICA INVÁLIDA: {item}")
        for item in panel_issues:
            print(f"PANEL INVÁLIDO: {item}")
        return 1
    agent_count = len(list((ROOT / ".codex/agents").glob("*.toml")))
    skill_count = len(list((ROOT / ".agents/skills").glob("*/SKILL.md")))
    print(f"Sistema Tántalo verificado: {len(REQUIRED_FILES)} archivos esenciales, {len(REQUIRED_DIRS)} directorios, {agent_count} agentes TOML, {skill_count} skill y enlaces locales válidos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
