"""Text fields as pointers into the page model, and their deterministic check.

The model names a region and gives the text it means; code finds that text as a contiguous word
sequence inside one region of the cited page, after whitespace normalization, and the stored
text is copied from the text layer. A span may start only at a word start and end at a word end
or before trailing punctuation of the last word. Typographic quotes and dashes the model typed
straight are folded one character for one character, and the source's characters are kept.
When the cited region does not hold the text but exactly one other region on the same page
does, the span moves there (recorded); text that only exists across two regions fails.

On a page read by OCR the words are the recogniser's, not the printer's: a span there verifies when
it aligns with a contiguous run of OCR words in one region at a character similarity of at least
`OCR_MIN_SIMILARITY` (and no other region aligns as well). The stored text is then the reading that
was checked, with the similarity recorded; a born-digital page never takes this path.
"""

from __future__ import annotations

import difflib

from dataclasses import dataclass

from ..textutil import _QUOTE_FOLD, norm_ws
from .layout import PageModel, Region


@dataclass
class Located:
    text: str                       # exact text-layer words, whitespace-normalized
    page: int
    region: str
    words: list[int]
    bbox: tuple[float, float, float, float]
    moved_from: str | None = None   # the region the model cited, when it was another
    ocr_similarity: float | None = None   # set when verified against OCR words by similarity


OCR_MIN_SIMILARITY = 0.85


def _fuzzy_in(pm: PageModel, reg: Region, want: str) -> tuple[float, list[int]] | None:
    toks = [pm.words[i].text for i in reg.words]
    if not toks:
        return None
    n = len(want.split())
    best = None
    a = want.lower()
    for k in range(max(1, int(n * 0.75)), int(n * 1.25) + 2):
        for i in range(0, max(1, len(toks) - k + 1)):
            cand = " ".join(toks[i:i + k]).lower()
            r = difflib.SequenceMatcher(None, a, cand, autojunk=False).ratio()
            if best is None or r > best[0]:
                best = (r, reg.words[i:i + k])
    return best


_PUNCT = set(".,;:!?)]}\"'”’")


def _match_in(pm: PageModel, reg: Region, text: str) -> tuple[list[int], str] | None:
    """Word indices and exact text of `text` inside region `reg`, or None."""
    want = norm_ws(text)
    if not want or not reg.words:
        return None
    toks = [pm.words[i].text for i in reg.words]
    joined = " ".join(toks)
    starts = []
    pos = 0
    for t in toks:
        starts.append(pos)
        pos += len(t) + 1
    for folded in (False, True):
        hay = joined.translate(_QUOTE_FOLD) if folded else joined
        needle = want.translate(_QUOTE_FOLD) if folded else want
        at = hay.find(needle)
        while at >= 0:
            end = at + len(needle)
            if at in starts:
                k0 = starts.index(at)
                k1 = max(k for k, s in enumerate(starts) if s < end)
                tail = joined[end:starts[k1] + len(toks[k1])]
                if all(ch in _PUNCT for ch in tail):
                    return reg.words[k0:k1 + 1], joined[at:end]
            at = hay.find(needle, at + 1)
    return _match_dehyphenated(pm, reg, want)


def _match_dehyphenated(pm: PageModel, reg: Region, want: str) -> tuple[list[int], str] | None:
    """A word broken across a line end ("mainte-" / "nance") read as one word: the span may name the
    whole word. The stored text is still the text layer's own words, hyphen and all."""
    line_end = {ln[-1] for ln in reg.lines if ln}
    toks: list[tuple[str, list[int]]] = []
    for i in reg.words:
        w = pm.words[i].text
        if toks and toks[-1][0].endswith("-") and toks[-1][1][-1] in line_end and w[:1].islower():
            toks[-1] = (toks[-1][0][:-1] + w, toks[-1][1] + [i])
        else:
            toks.append((w, [i]))
    if all(len(t[1]) == 1 for t in toks):
        return None
    joined = " ".join(t[0] for t in toks)
    at = joined.find(want)
    while at >= 0:
        starts, pos = [], 0
        for t, _ in toks:
            starts.append(pos)
            pos += len(t) + 1
        end = at + len(want)
        if at in starts:
            k0 = starts.index(at)
            k1 = max(k for k, s in enumerate(starts) if s < end)
            tail = joined[end:starts[k1] + len(toks[k1][0])]
            if all(ch in _PUNCT for ch in tail):
                idxs = [i for _, ids in toks[k0:k1 + 1] for i in ids]
                return idxs, " ".join(pm.words[i].text for i in idxs)
        at = joined.find(want, at + 1)
    return None


def locate(pages: dict[int, PageModel], page: int, region: str | None, text: str) -> tuple[Located | None, str | None]:
    """Find `text` on `page`, preferring `region`. Returns (Located, None) or (None, problem)."""
    pm = pages.get(page)
    if pm is None:
        return None, f"page {page} is not in this input"
    if not norm_ws(text or ""):
        return None, "empty text"
    cited = pm.region(region) if region else None
    order = ([cited] if cited else []) + [r for r in pm.text_regions() if r is not cited]
    hits = []
    for reg in order:
        m = _match_in(pm, reg, text)
        if m:
            hits.append((reg, m))
            if reg is cited:
                break
    if not hits and pm.ocr:
        want = norm_ws(text)
        scored = sorted(((f, reg) for reg in order if (f := _fuzzy_in(pm, reg, want))), key=lambda x: -x[0][0])
        if scored and scored[0][0][0] >= OCR_MIN_SIMILARITY and (len(scored) < 2 or scored[1][0][0] < scored[0][0][0]
                                                                   or scored[0][1] is cited):
            (sim, idxs), reg = scored[0]
            ws = [pm.words[i] for i in idxs]
            bbox = (min(w.x0 for w in ws), min(w.top for w in ws), max(w.x1 for w in ws), max(w.bottom for w in ws))
            return Located(want, page, reg.id, idxs, bbox, moved_from=region if reg is not cited else None,
                           ocr_similarity=round(sim, 3)), None
    if not hits:
        whole = " ".join(pm.words[i].text for r in pm.text_regions() for i in r.words)
        if norm_ws(text) in whole:
            return None, f"text crosses a region boundary on page {page}: {text[:60]!r}"
        return None, f"text not on page {page}: {text[:60]!r}"
    if hits[0][0] is not cited and len({h[0].id for h in hits}) > 1:
        return None, f"text is in {len(hits)} regions of page {page} and the cited region {region!r} is none of them"
    reg, (idxs, exact) = hits[0]
    ws = [pm.words[i] for i in idxs]
    bbox = (min(w.x0 for w in ws), min(w.top for w in ws), max(w.x1 for w in ws), max(w.bottom for w in ws))
    return Located(exact, page, reg.id, idxs, bbox, moved_from=region if reg is not cited else None), None
