"""Safety and advisory blocks: the class word as printed, the body, and the manual's own classes.

A block is what the reading says it is, verified as printed text: its class word is a printed span,
found by evidence, not by one layout:
  * a lead-in at the start of the body's region or text ("CAUTION:", "Caution Lithium packs ...",
    "NOTE ...");
  * a heading line of its own directly above the body, in the same column;
  * a label box nested inside the block (a pictogram strip with "WARNING" over the body);
  * a label to the left of the body on the same line band.
Any class the manual uses counts. The manual's classes, their order and whether they must always be
shown come from its own definitions where it prints them ("DANGER: Indicates a hazard that
will cause death or serious injury"); otherwise from the signal words its blocks print,
in the usual order of severity. Geometry is evidence and plausibility, never the gate.
"""

from __future__ import annotations

import re
from functools import lru_cache

from .layout import PageModel, Region

# signal words used across standards and house styles (the classes a manual may print); a manual's own
# definitions add to these and set their order
SIGNAL_WORDS = ["DANGER", "WARNING", "CAUTION", "NOTICE", "IMPORTANT", "NOTE", "TIP"]
PLURAL = {w + "S": w for w in SIGNAL_WORDS}
BASE_KIND = {"DANGER": "warning", "WARNING": "warning", "CAUTION": "caution", "NOTICE": "caution",
             "IMPORTANT": "note", "NOTE": "note", "TIP": "note"}
_PROTECTS = re.compile(r"(?i)\b(death|injur|harm|damage|hazard|fire|burn|shock)")
_DEFINES = re.compile(r"^\s*([A-Z][A-Za-z]{2,11})\s*[:\-–—]\s*(?:Indicates|Identifies|Denotes|Means|Calls attention|"
                      r"Signals|Used (?:to|for|when)|Gives|Draws)", re.I)


def canon(word: str) -> str | None:
    w = re.sub(r"[^A-Za-z]", "", word or "").upper()
    w = PLURAL.get(w, w)
    return w if w in SIGNAL_WORDS else None


@lru_cache(maxsize=None)
def engine_supports(marker: str) -> bool:
    """Whether the core this pipeline builds against already knows a contract feature (its source says so)."""
    from ..schema import core_src
    root = core_src()
    for f in list(root.glob("*.sql")) + list(root.rglob("*.rs")):
        try:
            if marker in f.read_text(errors="ignore"):
                return True
        except OSError:
            continue
    return False


def manual_classes(models: dict) -> list[dict]:
    """[{id, label, rank, must_show, definition}] most severe first, from the manual's definitions, else
    from the class words its blocks print (usual severity order)."""
    found: dict[str, dict] = {}
    for pm in models.values():
        for r in pm.regions:
            if not r.words:
                continue
            for ln in r.lines or [r.words]:
                text = " ".join(pm.words[i].text for i in ln)
                m = _DEFINES.match(text)
                if m and m.group(1).upper() not in found:
                    rest = " ".join(pm.words[i].text for i in ln[1:])
                    found[m.group(1).upper()] = {"label": m.group(1), "definition": rest}
    if found:
        out = []
        for k, (w, d) in enumerate(found.items(), 1):
            out.append({"id": w.lower(), "label": d["label"].upper() if d["label"].isupper() else d["label"],
                        "rank": k, "must_show": bool(_PROTECTS.search(d["definition"])) or w in ("DANGER", "WARNING",
                                                                                                 "CAUTION", "NOTICE"),
                        "definition": d["definition"]})
        return out
    printed = set()
    for pm in models.values():
        for r in pm.regions:
            if r.words:
                c = canon(pm.words[r.words[0]].text)
                if c:
                    printed.add(c)
    order = [w for w in SIGNAL_WORDS if w in printed] or ["WARNING", "CAUTION", "NOTE"]
    return [{"id": w.lower(), "label": w, "rank": k, "must_show": w not in ("NOTE", "TIP"), "definition": None}
            for k, w in enumerate(order, 1)]


def _only_class_word(pm: PageModel, r: Region) -> str | None:
    t = re.sub(r"[^A-Za-z ]", " ", pm.region_text(r)).split()
    return canon(t[0]) if len(t) == 1 else None


def class_of_block(pm: PageModel, reg: Region, body_words: list[int] | None = None) -> dict | None:
    """{word (canonical), printed, how, region, lead_in_words} for the class word printed with this block."""
    words = reg.words
    # a lead-in printed just before the body inside a longer block ("... B. Procedure NOTE: A battery ...")
    if body_words and body_words[0] in words:
        k = words.index(body_words[0])
        if k < 2:
            k = 0                    # a class word opening the region is the region's own lead-in (below)
        if k and canon(pm.words[words[k - 1]].text) and pm.words[words[k - 1]].text.rstrip().endswith((":", ".")) or \
                (k and canon(pm.words[words[k - 1]].text) and pm.words[words[k - 1]].text.isupper()):
            w = words[k - 1]
            return {"word": canon(pm.words[w].text), "printed": pm.words[w].text.rstrip(":."), "how": "lead-in",
                    "region": reg.id, "lead_in": w, "before_span": True}
    # a lead-in: the region's first word, or the body's first word, is a class word
    for start in ([body_words[0]] if body_words else []) + ([words[0]] if words else []):
        c = canon(pm.words[start].text)
        if c:
            return {"word": c, "printed": pm.words[start].text.rstrip(":"), "how": "lead-in", "region": reg.id,
                    "lead_in": start}
    lh = max((pm.words[i].bottom - pm.words[i].top for i in words), default=10) or 10
    cands = []
    for r in pm.regions:
        if r is reg or not r.words:
            continue
        c = _only_class_word(pm, r)
        if not c:
            continue
        inside = r.parent == reg.id or (r.bbox[0] >= reg.bbox[0] - 1 and r.bbox[2] <= reg.bbox[2] + 1
                                         and r.bbox[1] >= reg.bbox[1] - 1 and r.bbox[3] <= reg.bbox[3] + 1)
        above = 0 <= reg.bbox[1] - r.bbox[3] <= 2.2 * lh and min(r.bbox[2], reg.bbox[2]) - max(r.bbox[0], reg.bbox[0]) > 0
        left = r.bbox[2] <= reg.bbox[0] + 2 and reg.bbox[0] - r.bbox[2] <= 160 and \
            min(r.bbox[3], reg.bbox[3]) - max(r.bbox[1], reg.bbox[1]) > 0
        how = "label inside" if inside else "heading above" if above else "label beside" if left else None
        if how:
            dist = abs(r.bbox[1] - reg.bbox[1]) + (0 if inside else 1000 if left else 500)
            cands.append((dist, {"word": c, "printed": pm.region_text(r).strip().split()[-1].rstrip(":"), "how": how,
                                 "region": r.id, "lead_in": None}))
    return min(cands, key=lambda x: x[0])[1] if cands else None


def guard_kind(word: str, classes: list[dict]) -> str:
    """The section kind for a block of this class: the class id when the engine knows guard classes,
    else the base kind (warning / caution / note) the engine reads today."""
    if engine_supports("guard_classes") and any(c["id"] == word.lower() for c in classes):
        return word.lower()
    return BASE_KIND.get(word, "note")

