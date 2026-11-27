"""Parser registry. A parser turns raw bytes into a ParsedDoc; it never calls a model.

Add one with `@register("name")` on a function `(data: bytes, source_id: str, options: dict) -> ParsedDoc`.
"""

from __future__ import annotations

import importlib
from typing import Callable

from ..model import ParsedDoc

Parser = Callable[[bytes, str, dict], ParsedDoc]
_REGISTRY: dict[str, Parser] = {}
# Built-in parsers live in modules imported on first use, so optional dependencies stay optional.
_BUILTIN = {
    "ecfr": "ecfr", "pdf": "pdf", "ocr": "pdf", "docx": "docx", "html": "html",
    "markdown": "markdown", "text": "markdown", "xml": "xml", "sgml": "xml",
}


def register(name: str):
    def deco(fn: Parser) -> Parser:
        _REGISTRY[name] = fn
        return fn
    return deco


def get(name: str) -> Parser:
    if name not in _REGISTRY and name in _BUILTIN:
        importlib.import_module(f"{__name__}.{_BUILTIN[name]}")
    if name not in _REGISTRY:
        raise SystemExit(f"unknown parser {name!r}; known: {sorted(set(_REGISTRY) | set(_BUILTIN))}")
    return _REGISTRY[name]


def parse(name: str, data: bytes, source_id: str, options: dict | None = None) -> ParsedDoc:
    return get(name)(data, source_id, dict(options or {}))


@register("ecfr")
def _ecfr(data: bytes, source_id: str, options: dict) -> ParsedDoc:
    from .ecfr import parse_ecfr
    return parse_ecfr(data, source_id, int(options.pop("title", 29)), options)
