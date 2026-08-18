#!/usr/bin/env python3
"""Obtiene métricas descriptivas de un borrador sin puntuar su calidad."""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from difflib import get_close_matches
from pathlib import Path

WORD_RE = re.compile(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:['’-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?")
MARKER_RE = re.compile(r"\[(INVESTIGAR|MEJORAR|DECIDIR|PENDIENTE|REVISAR)(?::[^\]]+)?\]", re.I)
FILLERS = {"realmente", "simplemente", "entonces", "quizá", "quizás", "parecía", "algo", "muy"}
CANON_NAMES = ["Clay", "Amaranta", "Harry", "Vicente", "Ruth", "MEME", "SOMA", "Veyra", "Palimpsesto", "Nuevo Caguán"]


def normalized(value: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFD", value.lower()) if unicodedata.category(ch) != "Mn")


def analyze(text: str, source: Path) -> dict[str, object]:
    words = WORD_RE.findall(text)
    lower = [word.lower() for word in words]
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
    sentences = [part.strip() for part in re.split(r"(?<=[.!?…])\s+", text) if part.strip()]
    dialogue_lines = [line for line in text.splitlines() if line.strip().startswith(("—", "-", "\"", "“"))]
    repeated = Counter(lower)
    nearby: list[dict[str, object]] = []
    for index, word in enumerate(lower):
        window = lower[index + 1 : index + 13]
        if len(word) > 3 and word in window:
            nearby.append({"word": word, "positions": [index + 1, index + 2 + window.index(word)]})
    proper_names = sorted(set(re.findall(r"(?<![.!?]\s)(?<!^)(?<!\n)([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]{2,})", text)))
    canonical_norm = {normalized(name): name for name in CANON_NAMES}
    variants: list[dict[str, str]] = []
    for name in proper_names:
        key = normalized(name)
        if key in canonical_norm:
            continue
        match = get_close_matches(key, canonical_norm.keys(), n=1, cutoff=0.78)
        if match:
            variants.append({"found": name, "possibleCanonical": canonical_norm[match[0]]})
    return {
        "source": str(source),
        "wordCount": len(words),
        "paragraphCount": len(paragraphs),
        "sentenceCountApprox": len(sentences),
        "paragraphWordLengths": [len(WORD_RE.findall(item)) for item in paragraphs],
        "sentenceWordLengthsApprox": [len(WORD_RE.findall(item)) for item in sentences],
        "repeatedWords": [{"word": word, "count": count} for word, count in repeated.most_common(20) if count > 1],
        "nearbyRepetitions": nearby[:30],
        "fillerWords": {word: repeated[word] for word in sorted(FILLERS) if repeated[word]},
        "adverbsEndingMente": sorted({word for word in lower if word.endswith("mente")}),
        "dialogueLineRatioApprox": round(len(dialogue_lines) / max(1, len([line for line in text.splitlines() if line.strip()])), 3),
        "pendingMarkers": MARKER_RE.findall(text),
        "properNamesApprox": proper_names,
        "possibleNameVariants": variants,
        "notice": "Métricas auxiliares: requieren lectura humana y no constituyen una puntuación de calidad literaria.",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Archivo UTF-8 que se analizará")
    parser.add_argument("--output", type=Path, help="Guardar JSON; por defecto se imprime")
    args = parser.parse_args()
    try:
        text = args.input.read_text(encoding="utf-8")
        result = analyze(text, args.input)
        payload = json.dumps(result, ensure_ascii=False, indent=2)
        if args.output:
            args.output.write_text(payload + "\n", encoding="utf-8")
        else:
            print(payload)
        return 0
    except (OSError, UnicodeError) as exc:
        print(f"Error al leer o escribir: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

