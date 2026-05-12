"""Heuristic + LLM-assisted financial extraction.

The heuristic layer pulls obvious metrics with regex; the LLM layer
(invoked from the AI service's FinancialAnalyst) does the heavy lifting.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


_PATTERNS = {
    "noi": [
        r"\bNOI\b[^\n]{0,40}?\$?\s*([\d,]+(?:\.\d+)?)\s*(?:M|MM|million)?",
    ],
    "cap_rate": [
        r"\b(?:cap\s*rate|going[- ]in\s*cap)\s*(?:of|:|=)?\s*([\d\.]+)\s*%",
    ],
    "irr": [
        r"\bIRR\s*(?:of|:|=|target)?\s*([\d\.]+)\s*%",
    ],
    "moic": [
        r"\b(?:MOIC|equity multiple)\s*(?:of|:|=)?\s*([\d\.]+)\s*x",
    ],
    "dscr": [
        r"\bDSCR\s*(?:of|:|=)?\s*([\d\.]+)\s*x?",
    ],
    "occupancy": [
        r"\b(?:occupanc(?:y|ies))\s*(?:of|:|=|at)?\s*([\d\.]+)\s*%",
    ],
    "ltv": [
        r"\bLTV\s*(?:of|:|=)?\s*([\d\.]+)\s*%",
    ],
}


@dataclass
class HeuristicMetric:
    name: str
    value: float
    unit: str
    snippet: str


def heuristic_extract(text: str) -> list[HeuristicMetric]:
    out: list[HeuristicMetric] = []
    for name, pats in _PATTERNS.items():
        for pat in pats:
            for m in re.finditer(pat, text, flags=re.IGNORECASE):
                raw = m.group(1)
                try:
                    val = float(raw.replace(",", ""))
                except ValueError:
                    continue
                if name in ("cap_rate", "irr", "occupancy", "ltv"):
                    unit = "%"
                elif name in ("moic", "dscr"):
                    unit = "x"
                else:
                    unit = "$"
                start = max(0, m.start() - 60)
                end = min(len(text), m.end() + 60)
                out.append(HeuristicMetric(name=name, value=val, unit=unit, snippet=text[start:end]))
    return out
