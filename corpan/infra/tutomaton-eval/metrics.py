"""Programmatic quality metrics for a single qwen3-4B tutor reply.

Everything here is dependency-light and deterministic. fasttext (lid.176) is the
only optional dependency; if it is missing, `lang_id` returns None and the
composite pass falls back to script-coverage only (still correct for the
language-unique Brahmic/Hangul/Thai/Greek/Hebrew scripts).

We score the SCRUBBED reply — the bytes the user actually sees — because
`packs/tutomaton/src/textScrub.ts` strips markdown, emoji, the `<reference>`
markup, and (critically) orphaned combining marks (the Indic/Tamil/Arabic
"dotted-circle" artifact a small model emits when it drops a base letter). We
port the essential passes here. The raw reply is kept in the row for audit.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import asdict, dataclass

# --- Unicode script ranges (the blocks each language is allowed to use) -------
# Keyed by the names used in langs.Lang.scripts. Latin includes the Latin-1 and
# extended blocks (diacritics for vi/cs/pl/etc).
SCRIPTS: dict[str, list[tuple[int, int]]] = {
    "latin": [(0x41, 0x5A), (0x61, 0x7A), (0xC0, 0x24F), (0x1E00, 0x1EFF)],
    "cyrillic": [(0x400, 0x4FF), (0x500, 0x52F)],
    "greek": [(0x370, 0x3FF), (0x1F00, 0x1FFF)],
    "hebrew": [(0x590, 0x5FF), (0xFB1D, 0xFB4F)],
    "arabic": [(0x600, 0x6FF), (0x750, 0x77F), (0x8A0, 0x8FF), (0xFB50, 0xFDFF), (0xFE70, 0xFEFF)],
    "devanagari": [(0x900, 0x97F)],
    "bengali": [(0x980, 0x9FF)],
    "gurmukhi": [(0xA00, 0xA7F)],
    "gujarati": [(0xA80, 0xAFF)],
    "tamil": [(0xB80, 0xBFF)],
    "telugu": [(0xC00, 0xC7F)],
    "kannada": [(0xC80, 0xCFF)],
    "thai": [(0xE00, 0xE7F)],
    "hangul": [(0xAC00, 0xD7A3), (0x1100, 0x11FF), (0x3130, 0x318F)],
    "kana": [(0x3040, 0x309F), (0x30A0, 0x30FF)],
    "han": [(0x4E00, 0x9FFF), (0x3400, 0x4DBF), (0xF900, 0xFAFF)],
}

_EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F0FF"
    "\U00002190-\U000021FF\U00002B00-\U00002BFF\U0001F1E6-\U0001F1FF]",
    re.UNICODE,
)
_THINK = re.compile(r"<think>.*?</think>", re.DOTALL | re.IGNORECASE)
_TEMPLATE_TOKENS = re.compile(r"<\|im_(start|end)\|>")

# Refusal / meta-failure phrases (English — a model that bails usually bails in
# English even for a non-English target, which is itself a failure signal).
_REFUSAL = re.compile(
    r"\b(i (can'?t|cannot|am unable to|am not able to)|i'?m sorry,? but|"
    r"as an ai|i do not have the ability|i am just a)\b",
    re.IGNORECASE,
)


def _strip_orphan_marks(s: str) -> str:
    """Remove combining marks (Unicode category M*) that have no base letter
    before them — i.e. at string start or right after whitespace. Mirrors the
    `(^|\\s)\\p{M}+` pass in textScrub.ts (the dotted-circle artifact)."""
    out: list[str] = []
    prev_is_boundary = True  # start of string counts as a boundary
    for ch in s:
        if unicodedata.category(ch).startswith("M") and prev_is_boundary:
            continue  # orphan mark — drop it
        out.append(ch)
        prev_is_boundary = ch.isspace()
    return "".join(out)


def scrub(s: str) -> str:
    """Port of textScrub.scrubOutput (display-safe) — the bytes the user sees."""
    s = _THINK.sub("", s)
    s = _EMOJI.sub("", s)
    # Markdown markup (keep the readable text).
    s = re.sub(r"```[^\n`]*\n?", "", s)
    s = s.replace("```", "")
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"(?m)^\s{0,3}#{1,6}\s+", "", s)
    s = re.sub(r"(?m)^\s{0,3}>+[ \t]?", "", s)
    s = re.sub(r"(?m)^([ \t]*)[-*+•][ \t]+", r"\1", s)
    s = re.sub(r"\*\*([^*]+?)\*\*", r"\1", s)
    s = re.sub(r"__([^_]+?)__", r"\1", s)
    s = re.sub(r"~~([^~]+?)~~", r"\1", s)
    s = re.sub(r"\*([^*\n]+?)\*", r"\1", s)
    s = re.sub(r"`([^`\n]+?)`", r"\1", s)
    s = s.replace("**", "").replace("__", "").replace("*", "")
    s = re.sub(r"</?reference\b[^>]*>", "", s, flags=re.IGNORECASE)
    s = _strip_orphan_marks(s)  # dotted-circle artifact
    s = re.sub(r"[ \t]+(?=\n)", "", s)
    s = re.sub(r"[ \t]{2,}", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def _script_of(ch: str) -> str | None:
    cp = ord(ch)
    for name, ranges in SCRIPTS.items():
        for lo, hi in ranges:
            if lo <= cp <= hi:
                return name
    return None


def script_coverage(text: str, allowed: tuple[str, ...]) -> tuple[float, float, int]:
    """(in_script_fraction, latin_leak_fraction, in_script_count) over letters.

    Only letters count (digits/punct/space ignored). latin_leak = Latin letters
    as a fraction of all letters, meaningful only when 'latin' is NOT allowed.
    in_script_count is the absolute number of target-script letters (used to
    detect "produced essentially no target script at all").
    """
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0, 0.0, 0
    in_script = 0
    latin = 0
    for c in letters:
        sc = _script_of(c)
        if sc in allowed:
            in_script += 1
        if sc == "latin":
            latin += 1
    n = len(letters)
    return in_script / n, latin / n, in_script


def repetition(text: str, n: int = 3) -> float:
    """Redundancy = 1 - (distinct n-grams / total n-grams) — a loop detector.

    Word-level n-grams for spaced scripts; char 6-grams for short or non-spaced
    (CJK/Thai) text. ~1.0 ⇒ a phrase repeated over and over; ~0 ⇒ varied prose.
    More sensitive than max-frequency (a 2-word loop already reads ~0.95).
    """
    words = re.findall(r"\w+", text.lower())
    if len(words) < n * 2:
        chars = re.sub(r"\s+", "", text)
        if len(chars) < 12:
            return 0.0
        grams = [chars[i:i + 6] for i in range(len(chars) - 5)]
    else:
        grams = [" ".join(words[i:i + n]) for i in range(len(words) - n + 1)]
    if not grams:
        return 0.0
    return 1.0 - len(set(grams)) / len(grams)


_DETECTOR = None
_DETECTOR_TRIED = False

# Accept synonymous labels the detector may emit for the same language.
_LABEL_SYNONYMS = {"no": {"no", "nb", "nn"}}

# The 97 ISO codes langid.py / py3langid is trained on (its `langs` attribute is
# not exposed, so we hardcode it to intersect our wanted set — set_languages
# raises on any unknown label). Notably absent: su (Sundanese), yue.
LANGID_KNOWN = {
    "af", "am", "an", "ar", "as", "az", "be", "bg", "bn", "br", "bs", "ca",
    "cs", "cy", "da", "de", "dz", "el", "en", "eo", "es", "et", "eu", "fa",
    "fi", "fo", "fr", "ga", "gl", "gu", "he", "hi", "hr", "ht", "hu", "hy",
    "id", "is", "it", "ja", "jv", "ka", "kk", "km", "kn", "ko", "ku", "ky",
    "la", "lb", "lo", "lt", "lv", "mg", "mk", "ml", "mn", "mr", "ms", "mt",
    "nb", "ne", "nl", "nn", "no", "oc", "or", "pa", "pl", "ps", "pt", "qu",
    "ro", "ru", "rw", "se", "si", "sk", "sl", "sq", "sr", "sv", "sw", "ta",
    "te", "th", "tl", "tr", "ug", "uk", "ur", "vi", "vo", "wa", "xh", "zh",
    "zu",
}


def _detector():
    """py3langid identifier, constrained to OUR label set (huge accuracy win on
    short tutor replies) and with normalised 0..1 confidences. Pure Python — no
    compiler, no model download. None if py3langid is unavailable."""
    global _DETECTOR, _DETECTOR_TRIED
    if _DETECTOR_TRIED:
        return _DETECTOR
    _DETECTOR_TRIED = True
    try:
        from py3langid.langid import MODEL_FILE, LanguageIdentifier  # type: ignore
        from langs import LANGS

        ident = LanguageIdentifier.from_pickled_model(MODEL_FILE, norm_probs=True)
        wanted: set[str] = set()
        for l in LANGS:
            if l.ft:
                wanted |= _LABEL_SYNONYMS.get(l.ft, {l.ft})
        keep = sorted(wanted & LANGID_KNOWN)
        if keep:
            ident.set_languages(keep)
        _DETECTOR = ident
    except Exception:
        _DETECTOR = None
    return _DETECTOR


def lang_id(text: str) -> tuple[str | None, float]:
    """(detected lang label, confidence) via py3langid, or (None, 0)."""
    d = _detector()
    if not d:
        return None, 0.0
    flat = text.replace("\n", " ").strip()
    if not flat:
        return None, 0.0
    label, prob = d.classify(flat)
    return label, float(prob)


def _label_matches(detected: str, expected: str) -> bool:
    return detected in _LABEL_SYNONYMS.get(expected, {expected})


@dataclass
class Scores:
    raw: str
    scrubbed: str
    n_chars: int
    in_script: float
    latin_leak: float
    repeat: float
    detected: str | None
    detect_conf: float
    refusal: bool
    template_leak: bool
    too_short: bool
    target_present: bool
    english_dominant: bool
    passed: bool

    def to_dict(self) -> dict:
        return asdict(self)


# Thresholds for a single reply to "pass". The gate catches only GROSS breakage
# — NOT language-mixing. Interweaving English scaffolding is DESIRABLE for a
# beginner who only speaks English, so it must never be penalised. Fluency,
# coherence, and "is the English mix appropriate vs excessive" are the Claude
# judge's job, NOT this gate.
#   Latin-script targets:  identity is NOT gated (the model reliably produces
#       these; we can't cheaply tell "contains German" from English anyway, and
#       English mixing is fine) → pass unless empty/loop/refusal.
#   Non-Latin targets:     require a substantial amount of the target SCRIPT, so
#       the reply actually teaches in-language (the real "did it produce Telugu
#       at all"), while tolerating up to ~half English scaffolding.
MIN_CHARS = 3            # only truly empty/degenerate replies
MIN_TARGET_CHARS = 5     # non-Latin: must produce ≥5 target-script letters
                         # (catches pure-English/pure-romaji "didn't produce the
                         # language at all"; HOW immersive it is = mean_in_script
                         # in the report + the Claude judge, never a hard gate)
MAX_REPEAT = 0.55        # ≤55% n-gram redundancy (loops read ~0.9+)
MIN_DETECT_CONF = 0.50   # langid confidence floor (used for reporting only)
LANGID_MIN_CHARS = 40    # langid is unreliable below this


def score_reply(raw: str, lang) -> Scores:
    """Score one reply against a langs.Lang. `passed` is the per-reply gate."""
    scrubbed = scrub(raw)
    in_script, latin_leak, in_count = script_coverage(scrubbed, lang.scripts)
    rep = repetition(scrubbed)
    detected, conf = lang_id(scrubbed)
    refusal = bool(_REFUSAL.search(scrubbed))
    template_leak = bool(_TEMPLATE_TOKENS.search(raw))
    too_short = len(scrubbed) < MIN_CHARS

    latin_target = "latin" in lang.scripts
    # Did it produce the target language at ALL? Latin targets: yes (not gated —
    # English mixing is fine). Non-Latin: at least a few target-script letters
    # (so pure-English/pure-romaji replies fail, but any genuine in-language
    # content — even amid heavy English scaffolding — passes). How immersive the
    # reply is (mean_in_script) is reported, not gated.
    target_present = True if latin_target else (in_count >= MIN_TARGET_CHARS)

    # Informational only (surfaced in the report / to the Claude judge, NOT a
    # hard gate): the reply reads as English-dominant for a non-English target.
    expected = lang.ft if (lang.ft and lang.ft in LANGID_KNOWN) else None
    english_dominant = (
        lang.code != "en"
        and detected == "en"
        and len(scrubbed) >= LANGID_MIN_CHARS
        and conf >= MIN_DETECT_CONF
        and (not latin_target or latin_leak >= 0.95)
    )

    passed = (
        not too_short
        and not refusal
        and not template_leak
        and rep <= MAX_REPEAT
        and target_present
    )

    return Scores(
        raw=raw,
        scrubbed=scrubbed,
        n_chars=len(scrubbed),
        in_script=round(in_script, 3),
        latin_leak=round(latin_leak, 3),
        repeat=round(rep, 3),
        detected=detected,
        detect_conf=round(conf, 3),
        refusal=refusal,
        template_leak=template_leak,
        too_short=too_short,
        target_present=target_present,
        english_dominant=english_dominant,
        passed=passed,
    )
