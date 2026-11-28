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


# A class's tone from what the manual says it is for (CONTRACT "Guard classes are the pack's"); the first
# match wins. An explicit non-hazard reads as notice; minor or moderate injury reads as caution, as the
# usual severity scheme prints it.
_TONE_BY_DEFINITION = (
    ("notice", re.compile(r"(?i)\bnot\s+(related|relating)\s+to\s+(personal\s+)?(injury|hazards?)|\bnon-?hazard")),
    ("danger", re.compile(r"(?i)\b(will|would)\s+(result in|cause|lead to)\b[^.]{0,40}\b(death|serious injury)|"
                          r"\bimminent(ly)?\b[^.]{0,30}\bhazard")),
    ("caution", re.compile(r"(?i)\b(minor|moderate|slight)\b[^.]{0,25}\binjur")),
    ("warning", re.compile(r"(?i)\b(death|injur|kill|harm to (personnel|persons|people)|loss of life|"
                           r"personnel hazard)")),
    ("caution", re.compile(r"(?i)\b(damage|destr|equipment|property|harm)")),
    ("notice", re.compile(r"(?i)\b(important|essential|emphasi|attention|must be (followed|observed))")),
)
_TONE_BY_WORD = {"DANGER": "danger", "WARNING": "warning", "CAUTION": "caution", "NOTICE": "notice",
                 "IMPORTANT": "notice", "NOTE": "note", "TIP": "note"}


def tone_of(word: str, definition: str | None, must_show: bool) -> str:
    """How a guard class looks: from the manual's own definition of it when it has one, else from the
    standard class word, else important for a class that must always show and a note otherwise."""
    for tone, rx in _TONE_BY_DEFINITION if definition else ():
        if rx.search(definition):
            return tone
    return _TONE_BY_WORD.get(word.upper()) or ("notice" if must_show else "note")


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
            show = bool(_PROTECTS.search(d["definition"])) or w in ("DANGER", "WARNING", "CAUTION", "NOTICE")
            out.append({"id": w.lower(), "label": d["label"].upper() if d["label"].isupper() else d["label"],
                        "rank": k, "must_show": show, "tone": tone_of(w, d["definition"], show),
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
    return [{"id": w.lower(), "label": w, "rank": k, "must_show": w not in ("NOTE", "TIP"),
             "tone": tone_of(w, None, w not in ("NOTE", "TIP")), "definition": None}
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

