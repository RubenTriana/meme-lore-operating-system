#!/usr/bin/env python3
"""Import approved literary sources into the ignored local data layer.

The command never edits the supplied files or data/universe_master.json. It copies
the originals into .meme-private, verifies their hashes, and derives formats that
the local Vite server can expose on localhost.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET


W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
BOOKS = [
    ("I", "EL SILENCIO ANTERIOR", "El Silencio Anterior"),
    ("II", "LAS CUATRO MIRADAS", "Las Cuatro Miradas"),
    ("III", "LA PRIMERA MEDIDA", "La Primera Medida"),
    ("IV", "LAS TABLAS DE LA HERIDA", "Las Tablas de la Herida"),
    ("V", "EL TESTAMENTO DE LOS DOCE NOMBRES", "El Testamento de los Doce Nombres"),
    ("VI", "EL LIBRO DE LOS VENCIDOS", "El Libro de los Vencidos"),
    ("VII", "LAS TRES PROFECÍAS", "Las Tres Profecías"),
    ("VIII", "EL LIBRO DE LA GRAN IMITACIÓN", "El Libro de la Gran Imitación"),
    ("IX", "EL EVANGELIO DEL AZAR", "El Evangelio del Azar"),
]
EXPECTED_DOCX = "82132c3511f8da8122cf5b78b63240193a39d6a65da444becd5a48eb7a595d0f"
EXPECTED_RIO = "689c64ae7fe48047a6e66ca1317ce12743bbde9769a3e7dfb6301d77a14474eb"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def paragraph_style(paragraph: ET.Element) -> str:
    style = paragraph.find(f"{W}pPr/{W}pStyle")
    return style.attrib.get(f"{W}val", "Normal") if style is not None else "Normal"


def paragraph_text(paragraph: ET.Element) -> str:
    parts: list[str] = []
    for node in paragraph.iter():
        if node.tag == f"{W}t" and node.text:
            parts.append(node.text)
        elif node.tag == f"{W}tab":
            parts.append("\t")
        elif node.tag in {f"{W}br", f"{W}cr"}:
            parts.append("\n")
    return "".join(parts).strip()


def docx_paragraphs(path: Path) -> list[dict[str, object]]:
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))
    result = []
    for index, paragraph in enumerate(root.findall(f".//{W}body/{W}p"), 1):
        text = paragraph_text(paragraph)
        if text:
            result.append({"sourceParagraph": index, "style": paragraph_style(paragraph), "text": text})
    return result


def normalize_heading(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).upper()


def markdown_and_sections(paragraphs: list[dict[str, object]], source_hash: str) -> tuple[str, list[dict[str, object]]]:
    book_lookup = {normalize_heading(key): (index + 1, roman, title) for index, (roman, key, title) in enumerate(BOOKS)}
    lines = [
        "# El Códice de la Voluntad Increada",
        "",
        "**Edición de la Novena Costura · referencia editorial aprobada el 07-09-2026**",
        "",
        f"**Fuente inmutable:** `{source_hash}`",
        "",
        "> Obra de voz múltiple y carácter profético. Su aprobación editorial no convierte cada testimonio, glosa o visión en hecho literal del canon técnico.",
        "",
    ]
    sections: list[dict[str, object]] = []
    current_book = 0
    current_section: dict[str, object] | None = None
    paragraph_number = 0

    def close_section() -> None:
        nonlocal current_section
        if current_section and current_section["body"]:
            body = "\n\n".join(current_section["body"])
            current_section["body"] = body
            current_section["summary"] = re.sub(r"\s+", " ", body)[:280]
            sections.append(current_section)
        current_section = None

    for entry in paragraphs:
        text = str(entry["text"])
        style = str(entry["style"])
        book_match = book_lookup.get(normalize_heading(text))
        if book_match and style.lower().replace(" ", "") in {"heading1", "ttulo1", "titulo1"}:
            close_section()
            current_book, roman, title = book_match
            paragraph_number = 0
            lines.extend([f"## {roman}. {title}", ""])
            current_section = {
                "id": f"codex-ninth-stitch-b{current_book:02d}-opening",
                "type": "codex-approved-section",
                "title": f"{roman}. {title}",
                "book": current_book,
                "bookTitle": title,
                "section": "Apertura",
                "status": "approved_editorial",
                "truthPlane": "prophecy_testimony_or_gloss",
                "sourceHash": source_hash,
                "sourceParagraphStart": entry["sourceParagraph"],
                "body": [],
                "tags": ["códice", "novena-costura", "aprobado"],
            }
            continue
        if not current_book:
            continue
        if re.fullmatch(r"LIBRO\s+[A-ZÁÉÍÓÚÑ]+", normalize_heading(text)) or text == "◆":
            continue

        paragraph_number += 1
        anchor = f"CVI-NC-L{current_book:02d}-P{paragraph_number:04d}"
        compact_style = style.lower().replace(" ", "")
        if compact_style.startswith("heading") or compact_style.startswith("ttulo") or compact_style.startswith("titulo"):
            close_section()
            try:
                level = int(re.search(r"(\d+)$", compact_style).group(1))
            except (AttributeError, ValueError):
                level = 2
            markdown_level = min(6, level + 2)
            lines.extend(["#" * markdown_level + " " + text, ""])
            current_section = {
                "id": f"codex-ninth-stitch-b{current_book:02d}-{anchor.lower()}",
                "type": "codex-approved-section",
                "title": text,
                "book": current_book,
                "bookTitle": BOOKS[current_book - 1][2],
                "section": text,
                "status": "approved_editorial",
                "truthPlane": "prophecy_testimony_or_gloss",
                "sourceHash": source_hash,
                "sourceParagraphStart": entry["sourceParagraph"],
                "body": [],
                "tags": ["códice", "novena-costura", "aprobado"],
            }
            continue

        if current_section is None:
            current_section = {
                "id": f"codex-ninth-stitch-b{current_book:02d}-{anchor.lower()}",
                "type": "codex-approved-section",
                "title": f"Pasaje {anchor}",
                "book": current_book,
                "bookTitle": BOOKS[current_book - 1][2],
                "section": "Pasaje",
                "status": "approved_editorial",
                "truthPlane": "prophecy_testimony_or_gloss",
                "sourceHash": source_hash,
                "sourceParagraphStart": entry["sourceParagraph"],
                "body": [],
                "tags": ["códice", "novena-costura", "aprobado"],
            }
        current_section["sourceParagraphEnd"] = entry["sourceParagraph"]
        current_section["body"].append(text)
        if compact_style == "artifactnote":
            lines.extend([f"*{text}*", ""])
        elif compact_style == "epigraph":
            lines.extend([f"> {text}", ""])
        else:
            lines.extend([f"<span id=\"{anchor.lower()}\"></span>", "", text, ""])

    close_section()
    return "\n".join(lines).rstrip() + "\n", sections


def strip_front_matter(markdown: str) -> tuple[dict[str, str], str]:
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", markdown, re.S)
    if not match:
        return {}, markdown
    metadata = {}
    for line in match.group(1).splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip().strip('"')
    return metadata, markdown[match.end():]


def markdown_sections(markdown: str) -> dict[str, str]:
    matches = list(re.finditer(r"^##\s+([^\n]+)\s*$", markdown, re.M))
    result = {}
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        result[match.group(1).strip()] = markdown[match.end():end].strip()
    return result


def subsection(body: str, title: str) -> str:
    pattern = rf"^###\s+{re.escape(title)}\s*$\n(.*?)(?=^###\s+|\Z)"
    match = re.search(pattern, body, re.M | re.S)
    return match.group(1).strip() if match else ""


def heading_section(markdown: str, heading: str, level: int) -> str:
    marker = "#" * level
    match = re.search(rf"^{re.escape(marker)}\s+{re.escape(heading)}\s*$", markdown, re.M)
    if not match:
        return ""
    next_heading = re.search(rf"^{re.escape(marker)}\s+", markdown[match.end():], re.M)
    end = match.end() + next_heading.start() if next_heading else len(markdown)
    return markdown[match.end():end].strip()


def subsection_at_level(body: str, title: str, level: int) -> str:
    marker = "#" * level
    pattern = rf"^{re.escape(marker)}\s+{re.escape(title)}\s*$\n(.*?)(?=^{re.escape(marker)}\s+|\Z)"
    match = re.search(pattern, body, re.M | re.S)
    return match.group(1).strip() if match else ""


def clean_md(value: str) -> str:
    value = re.sub(r"```.*?```", "", value, flags=re.S)
    value = re.sub(r"[*_>`#]", "", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def first_bold(value: str) -> str:
    match = re.search(r"\*\*(.*?)\*\*", value, re.S)
    return clean_md(match.group(1)) if match else clean_md(value.splitlines()[0] if value else "")


def paragraph_after_heading(body: str, title: str) -> str:
    return clean_md(subsection(body, title).split("\n\n", 1)[0])


def ability_record(number: str, title: str, body: str, source_hash: str) -> dict[str, object]:
    easy = subsection(body, "Explicación fácil")
    basis = subsection(body, "Base biológica y espiritual")
    biological = re.search(r"\*\*Biológica:\*\*\s*(.*)", basis)
    spiritual = re.search(r"\*\*Espiritual:\*\*\s*(.*)", basis)
    table_rows = [line for line in easy.splitlines() if line.startswith("|")]
    table_values = []
    if len(table_rows) >= 3:
        table_values = [clean_md(cell) for cell in table_rows[2].strip("|").split("|")]
    return {
        "id": "rio-" + re.sub(r"[^a-z0-9]+", "-", title.lower().translate(str.maketrans("áéíóúñ", "aeioun"))).strip("-"),
        "type": "rio-ability-proposal",
        "title": title,
        "section": f"§{number}",
        "status": "proposed",
        "canonLevel": "NO_CANON_HASTA_APROBACION",
        "plainExplanation": first_bold(easy),
        "before": table_values[0] if len(table_values) > 0 else None,
        "activation": table_values[1] if len(table_values) > 1 else None,
        "effect": table_values[2] if len(table_values) > 2 else None,
        "price": table_values[3] if len(table_values) > 3 else None,
        "biologicalBasis": clean_md(biological.group(1)) if biological else None,
        "spiritualBasis": clean_md(spiritual.group(1)) if spiritual else None,
        "counterTo": paragraph_after_heading(body, "Contrarresta"),
        "hardLimits": paragraph_after_heading(body, "Límite duro"),
        "enemyCounter": paragraph_after_heading(body, "Contraataque enemigo"),
        "evolution": paragraph_after_heading(body, "Evolución necesaria"),
        "sourceHash": source_hash,
        "tags": ["RÍO", "Nombre Increado", "propuesta", title],
        "sourceExcerpt": body,
    }


def rio_catalog(markdown: str, source_hash: str) -> dict[str, object]:
    metadata, body = strip_front_matter(markdown)
    sections = markdown_sections(body)
    items: list[dict[str, object]] = [{
        "id": "rio-system-overview",
        "type": "rio-approved-category",
        "title": "Modificadores de probabilidades — RÍO",
        "summary": "Categoría aprobada para consultar cómo los descendientes de las doce tribus distorsionan el campo de probabilidades en sus enfrentamientos con MEME.",
        "status": "approved_scope_only",
        "canonLevel": "CATEGORY_APPROVED_DETAILS_PROPOSED",
        "alias": "Reserva de Indeterminación Orgánica",
        "aliases": ["RÍO", "RIO", "Reserva de Indeterminación Orgánica", "Aliento Increado", "Nombres Increados", "Modificadores de probabilidades"],
        "sourceHash": source_hash,
        "tags": ["RÍO", "probabilidad", "doce tribus", "MEME"],
    }]
    ability_map = [
        ("5.1", "El Nombre Irreductible"), ("5.2", "La Memoria sin Mandato"),
        ("5.3", "La Puerta sin Número"), ("5.4", "La Herida Compartida"),
        ("5.5", "La Devolución de lo Posible"), ("5.6", "La Causa Tardía"),
        ("5.7", "La Hora No Vivida"),
    ]
    for number, title in ability_map:
        section = next((value for key, value in sections.items() if key.startswith(number + ".")), "")
        items.append(ability_record(number, title, section, source_hash))
    for number, title in (("6.1", "El Silencio Fértil"), ("6.2", "El Coro Vivo")):
        section = next((value for key, value in sections.items() if key.startswith(number + ".")), "")
        items.append({
            "id": "rio-" + re.sub(r"[^a-z0-9]+", "-", title.lower().translate(str.maketrans("áéíóúñ", "aeioun"))).strip("-"),
            "type": "rio-second-generation-proposal",
            "title": title,
            "section": f"§{number}",
            "status": "proposed",
            "canonLevel": "NO_CANON_HASTA_APROBACION",
            "plainExplanation": first_bold(section),
            "sourceExcerpt": section,
            "sourceHash": source_hash,
            "tags": ["RÍO", "segunda generación", "propuesta", title],
        })
    novena = heading_section(body, "8. La Novena Costura", 1)
    items.append({
        "id": "rio-novena-costura-mechanism",
        "type": "rio-structural-mechanism-proposal",
        "title": "La Novena Costura",
        "section": "§8",
        "status": "proposed_formalization",
        "canonLevel": "NO_CANON_HASTA_APROBACION",
        "plainExplanation": first_bold(subsection_at_level(novena, "Explicación fácil", 2)),
        "sourceExcerpt": novena,
        "sourceHash": source_hash,
        "tags": ["RÍO", "Novena Costura", "consentimiento", "propuesta"],
    })
    pending = heading_section(body, "12. Decisiones pendientes antes de elevarlo a canon", 1)
    return {
        "schemaVersion": "1.0.0",
        "id": metadata.get("id", "lore.mecanicas.rio_nombres_increados"),
        "version": metadata.get("version", "0.1.0"),
        "sourceStatus": metadata.get("status", "PROPUESTA_PARA_REVISION"),
        "sourceCanonLevel": metadata.get("canon_level", "NO_CANON_HASTA_APROBACION"),
        "sourceHash": source_hash,
        "authorDecision": {
            "date": "2026-09-07",
            "approved": "La categoría consultable y su propósito general.",
            "notApproved": "Poderes, ejemplos, portadores, costes, retcons y equivalencia uno a uno entre facultades y linajes.",
        },
        "pendingDecisions": [clean_md(line) for line in pending.splitlines() if re.match(r"^\d+\.", line.strip())],
        "items": items,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--docx", type=Path, required=True)
    parser.add_argument("--rio", type=Path, required=True)
    parser.add_argument("--strategy", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    for source in (args.docx, args.rio, args.strategy):
        if not source.is_file():
            raise SystemExit(f"Missing source: {source}")
    docx_hash, rio_hash, strategy_hash = map(sha256, (args.docx, args.rio, args.strategy))
    if docx_hash != EXPECTED_DOCX:
        raise SystemExit(f"DOCX hash mismatch: {docx_hash}")
    if rio_hash != EXPECTED_RIO:
        raise SystemExit(f"RÍO hash mismatch: {rio_hash}")

    sources = args.output / "sources" / "2026-09-07"
    derived = args.output / "derived"
    voice = args.output / "voice-context"
    for directory in (sources, derived, voice):
        directory.mkdir(parents=True, exist_ok=True)
    copied = []
    for source in (args.docx, args.rio, args.strategy):
        target = sources / source.name
        shutil.copy2(source, target)
        copied.append({"name": source.name, "path": str(target), "sha256": sha256(target), "bytes": target.stat().st_size})

    paragraphs = docx_paragraphs(args.docx)
    codex_markdown, codex_sections = markdown_and_sections(paragraphs, docx_hash)
    (derived / "CODICE_NOVENA_COSTURA_APROBADA.md").write_text(codex_markdown, encoding="utf-8")
    (derived / "codex-sections.json").write_text(json.dumps({
        "schemaVersion": "1.0.0",
        "edition": "Edición de la Novena Costura",
        "status": "APPROVED_EDITORIAL_REFERENCE",
        "approvedOn": "2026-09-07",
        "sourceHash": docx_hash,
        "items": codex_sections,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    rio_text = args.rio.read_text(encoding="utf-8")
    catalog = rio_catalog(rio_text, rio_hash)
    (derived / "rio-catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest = {
        "bundleId": "meme-continuity-2026-09-07-r2",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "privacy": "LOCAL_IGNORED_NOT_FOR_PUBLIC_GIT",
        "sources": copied,
        "derived": [
            "derived/CODICE_NOVENA_COSTURA_APROBADA.md",
            "derived/codex-sections.json",
            "derived/rio-catalog.json",
        ],
        "verification": {"docxExpected": EXPECTED_DOCX, "rioExpected": EXPECTED_RIO, "strategyHash": strategy_hash},
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    (voice / "00_INDICE_DEL_PAQUETE.md").write_text(
        "# Paquete de continuidad para conversación y voz\n\n"
        "**Conjunto:** `meme-continuity-2026-09-07-r2`  \n"
        "**Estado:** paquete local preparado; acceso por voz pendiente de prueba.\n\n"
        "Este directorio es privado y está excluido de Git. Para usarlo en un proyecto de ChatGPT, añade manualmente los archivos derivados pertinentes. "
        "ChatGPT Voice no puede consultar por sí solo el servidor `localhost` de Tántalo.\n\n"
        "## Fuentes\n\n"
        f"- Códice aprobado: `{docx_hash}`.\n"
        f"- RÍO 0.1.0: `{rio_hash}`; categoría aprobada, facultades propuestas.\n"
        "- Canon técnico: consultar `data/universe_master.json`; no se copia aquí como un segundo maestro.\n\n"
        "## Uso recomendado\n\n"
        "1. Añade `CODICE_NOVENA_COSTURA_APROBADA.md` cuando necesites consultar el texto completo.\n"
        "2. Añade `rio-catalog.json` para revisar facultades con su estado editorial.\n"
        "3. Comprueba siempre el hash del conjunto antes de continuar una sesión antigua.\n",
        encoding="utf-8",
    )
    shutil.copy2(derived / "CODICE_NOVENA_COSTURA_APROBADA.md", voice / "CODICE_NOVENA_COSTURA_APROBADA.md")
    shutil.copy2(derived / "rio-catalog.json", voice / "rio-catalog.json")
    print(json.dumps({"manifest": str(args.output / "manifest.json"), "docxParagraphs": len(paragraphs), "codexSections": len(codex_sections), "rioItems": len(catalog["items"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
