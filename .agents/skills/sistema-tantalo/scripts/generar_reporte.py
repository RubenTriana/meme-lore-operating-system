#!/usr/bin/env python3
"""Convierte el JSON de analizar_texto.py en un reporte Markdown legible."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def render(data: dict[str, object]) -> str:
    repetitions = data.get("repeatedWords", [])
    repeated_text = ", ".join(f"{item['word']} ({item['count']})" for item in repetitions[:10]) or "Ninguna destacable"
    markers = data.get("pendingMarkers", [])
    marker_text = ", ".join(markers) or "Ninguno"
    variants = data.get("possibleNameVariants", [])
    variant_lines = "\n".join(f"- `{item['found']}` → comprobar si era `{item['possibleCanonical']}`" for item in variants) or "- Ninguna señal automática."
    return f"""# Reporte auxiliar de texto

- **Fuente:** `{data.get('source', 'desconocida')}`
- **Palabras:** {data.get('wordCount', 0)}
- **Párrafos:** {data.get('paragraphCount', 0)}
- **Frases aproximadas:** {data.get('sentenceCountApprox', 0)}
- **Proporción aproximada de líneas de diálogo:** {data.get('dialogueLineRatioApprox', 0)}
- **Marcadores pendientes:** {marker_text}

## Repeticiones frecuentes

{repeated_text}

## Posibles variaciones de nombres

{variant_lines}

## Límite

{data.get('notice', 'Estas métricas requieren interpretación humana.')}
"""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="JSON producido por analizar_texto.py")
    parser.add_argument("--output", type=Path, help="Guardar Markdown; por defecto se imprime")
    args = parser.parse_args()
    try:
        report = render(json.loads(args.input.read_text(encoding="utf-8")))
        if args.output:
            args.output.write_text(report, encoding="utf-8")
        else:
            print(report, end="")
        return 0
    except (OSError, UnicodeError, json.JSONDecodeError, TypeError, KeyError) as exc:
        print(f"No se pudo generar el reporte: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

