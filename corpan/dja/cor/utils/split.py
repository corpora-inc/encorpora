# cor/utils/split.py
import re
from typing import List

# Global, permissive sentence terminators across major scripts.
# Over-splitting is acceptable; under-splitting isn’t.
# NOTE: Armenian uses '։' as the sentence terminator; '՞' and '՜' are in-word marks.
_TERMINATORS = (
    ".!?;"  # Latin (and Greek ';' used as question) — split globally
    "…"  # ellipsis (U+2026)
    "。！？"  # CJK full stop/exclam/question
    "؟؛"  # Arabic/Persian question + semicolon
    "।॥"  # Devanagari danda + double danda
    "։"  # Armenian full stop (exclude '՞', '՜')
    "។៕"  # Khmer stops
    "။"  # Myanmar stop
    "།༎"  # Tibetan shad
    "።፧"  # Ethiopic full stop / question
)

_TERM_CLASS = re.escape(_TERMINATORS)

# One pass:
#  - grab runs that don't contain terminators or newlines
#  - optionally include trailing terminators
#  - newlines implicitly break runs (poetry-friendly)
_PATTERN = re.compile(rf"[^{_TERM_CLASS}\r\n]+(?:[{_TERM_CLASS}]+)?", re.UNICODE)


def split_into_utterances(text: str) -> List[str]:
    """
    Very permissive, language-agnostic utterance splitter.
    - Splits on a wide set of Unicode sentence terminators (incl. ';' globally).
    - Treats line breaks as hard boundaries (each line becomes at least one chunk).
    - Keeps the terminator attached to the preceding chunk.
    - Collapses internal whitespace; drops empty chunks.
    """
    if not text:
        return []
    pieces = _PATTERN.findall(text)
    return [re.sub(r"\s+", " ", p).strip() for p in pieces if p and p.strip()]
