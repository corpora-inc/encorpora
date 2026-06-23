"""Scoring for the ASR bake-off: WER for spaced scripts, CER for non-spaced.

Why two metrics: word error rate counts substitutions/insertions/deletions
over *words*, which only means something when words are space-delimited.
Japanese, Chinese, Cantonese, and Thai are written without spaces, so WER on
them is noise — there a *character* error rate is the honest measure. The
`script` field in langs.py decides which we use; engine adapters never see
this distinction.

Normalization is deliberately light + script-aware: we lowercase and strip
punctuation/extra whitespace (so "Hello, world." vs "hello world" isn't
counted as two errors), but we do NOT do aggressive text-normalization that
would flatter a model (number-word expansion, etc.). A model that emits the
wrong script should score badly — that's a real failure for us.
"""

import re
import unicodedata

import jiwer


# Punctuation to strip before scoring. Includes CJK/full-width marks so a
# Chinese transcript with 。、！ isn't penalised vs a reference without them.
_PUNCT = re.compile(
    r"[.,!?;:\"'`´’‘“”…()\[\]{}—–\-/\\|@#$%^&*_+=~<>"
    r"。、，！？；：「」『』（）《》【】〔〕·…]"
)
_WS = re.compile(r"\s+")


def normalize(text: str, *, drop_spaces: bool) -> str:
    """Light, script-aware normalization shared by ref and hypothesis.

    `drop_spaces` collapses ALL whitespace away — used for CER on non-spaced
    scripts, where an engine that helpfully inserts spaces between characters
    shouldn't be punished or rewarded for it.
    """
    text = unicodedata.normalize("NFKC", text)
    text = text.lower()
    text = _PUNCT.sub(" ", text)
    text = _WS.sub("" if drop_spaces else " ", text)
    return text.strip()


def wer(reference: str, hypothesis: str) -> float:
    ref = normalize(reference, drop_spaces=False)
    hyp = normalize(hypothesis, drop_spaces=False)
    if not ref:
        return 0.0 if not hyp else 1.0
    return jiwer.wer(ref, hyp)


def cer(reference: str, hypothesis: str) -> float:
    # Character error rate: drop spaces, then run jiwer's CER on the raw
    # character sequence. (jiwer.cer internally treats the string as chars.)
    ref = normalize(reference, drop_spaces=True)
    hyp = normalize(hypothesis, drop_spaces=True)
    if not ref:
        return 0.0 if not hyp else 1.0
    return jiwer.cer(ref, hyp)


def score(reference: str, hypothesis: str, script: str) -> tuple[str, float]:
    """Returns (metric_name, error_rate) picking WER vs CER by script.

    Lower is better. error_rate can exceed 1.0 (more insertions than ref
    length) — we clamp display at the report layer, not here.
    """
    if script in ("cjk", "thai"):
        return "cer", cer(reference, hypothesis)
    return "wer", wer(reference, hypothesis)
