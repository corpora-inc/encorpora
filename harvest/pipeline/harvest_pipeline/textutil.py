"""Text normalization and hashing shared by parsers, verifiers and the pack writer."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata

_WS = re.compile(r"\s+")


def norm_ws(text: str) -> str:
    """Collapse every whitespace run to one space and trim. The only change parsers make to source text."""
    return _WS.sub(" ", text.replace(" ", " ")).strip()


def norm_lines(text: str) -> str:
    """Normalize whitespace inside each line, keep line breaks, drop empty lines."""
    lines = (norm_ws(line) for line in text.split("\n"))
    return "\n".join(line for line in lines if line)


_QUOTE_FOLD = str.maketrans({
    "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"',
    "\u2013": "-", "\u2014": "-", "\u2011": "-",
})


def locate(quote: str, source: str) -> str | None:
    """Return the exact (whitespace-normalized) source span a quote names, or None.

    The contract test is "quote is a substring of section.text after whitespace normalization".
    A model sometimes types a straight quote or hyphen where the source has a curly quote or a
    dash; those are folded one character for one character, the span is found, and the
    *source's* characters are returned, so what ships always passes the strict test.
    """
    q = norm_ws(quote)
    s = norm_ws(source)
    if not q:
        return None
    if q in s:
        return q
    i = s.translate(_QUOTE_FOLD).find(q.translate(_QUOTE_FOLD))
    return s[i:i + len(q)] if i >= 0 else None


def is_verbatim(quote: str, source: str) -> bool:
    """The contract's strict test: substring after whitespace normalization only."""
    q = norm_ws(quote)
    return bool(q) and q in norm_ws(source)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def canonical_json(obj) -> str:
    """Canonical JSON: sorted keys, no insignificant whitespace, UTF-8 (not ASCII-escaped)."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_json(obj) -> str:
    return sha256_text(canonical_json(obj))


def slug(text: str, max_len: int = 48) -> str:
    s = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:max_len].rstrip("-") or "x"


_NUM = re.compile(r"(?<![\w.])\d[\d,]*(?:\.\d+)?(?:/\d+)?")


def numbers_in(text: str) -> list[str]:
    """Numeric tokens with thousands separators removed: '1,000 pounds' -> ['1000']."""
    out = []
    for m in _NUM.finditer(text or ""):
        tok = m.group(0).rstrip(",").replace(",", "")
        if tok:
            out.append(tok)
    return out
