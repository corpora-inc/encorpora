# cor/utils/split.py
import re
from typing import List

# Global, permissive sentence terminators across major scripts.
# Over-splitting is acceptable; under-splitting isn’t.
_TERMINATORS = (
    ".!?;"  # Latin (and Greek ';' used as question) — split globally
    "…"  # ellipsis (U+2026)
    "。！？"  # CJK full stop/exclam/question
    "；"  # CJK fullwidth semicolon (U+FF1B)  <-- ADD THIS
    "؟؛"  # Arabic/Persian question + semicolon
    "।॥"  # Devanagari danda + double danda
    "։"  # Armenian full stop (exclude '՞', '՜')
    "។៕"  # Khmer stops
    "။"  # Myanmar stop
    "།༎"  # Tibetan shad
    "።፧"  # Ethiopic full stop / question
)

_TERM_CLASS = re.escape(_TERMINATORS)
_PATTERN = re.compile(rf"[^{_TERM_CLASS}\r\n]+(?:[{_TERM_CLASS}]+)?", re.UNICODE)


def split_into_utterances(text: str) -> List[str]:
    if not text:
        return []
    pieces = _PATTERN.findall(text)
    return [re.sub(r"\s+", " ", p).strip() for p in pieces if p and p.strip()]
