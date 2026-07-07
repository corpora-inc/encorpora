#!/usr/bin/env python3
"""Concept extraction for the imagepan A0+A1 image pack.

Source vocabulary (READ-ONLY):
  - `word:en:<lemma>` items in the A0/A1 course units.
  - concrete NOUNS pulled from those units' pinned phrases (the English phrase
    text lives inline in the unit-yaml `# ...` comment).

Gate: Brysbaert/Warriner/Kuperman (2014) concreteness norm Conc.M >= 4.0 (the
"images reliably" threshold, research/images.md §1.1) + POS is Noun/Verb. The
norms .txt is downloaded at build time and cached under data/ (gitignored —
nothing from it ships, so its licence never constrains the app).

Then an AUTHORED curation layer (CURATION below) is applied: every SHIPPED
concept carries a hand-written, sense-matched, unambiguous `sense_subject` (the
diffusion prompt subject) and a visual `domain` (drives the distractor group).
This is deliberate: a meaning-card whose picture is wrong teaches a wrong
meaning (§1.3), so we ship only concepts we can depict unambiguously. Gated
lemmas we chose NOT to author (polysemy traps like "saw"=past-of-see≠the tool,
sound words music/song, relational kinship brother/sister, over-broad scenes
city/town) are reported as `uncurated`/`excluded`, never stretched.

COLORS and small NUMBERS are added via INCLUDE_EXTRA even though the norm rates
the adjective/number < 4.0: research §1.2 lists them as "trivially and perfectly"
imageable. They are NOT abstract words being stretched — they are a known-good
visual category, and they give the picture-choice strong same-domain distractors.

Output: concepts_a0a1.json — list of
  {key, word, sense_subject, distractor_group, cefr, pos, concreteness, domain, seed}

Run from this directory:  python extract_concepts.py
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
UNITS = HERE.parent.parent / "dja" / "journey_pack" / "courses" / "en" / "units"
DATA = HERE / "data"
NORMS = DATA / "brysbaert_concreteness.txt"
NORMS_URL = (
    "https://raw.githubusercontent.com/ArtsEngine/concreteness/master/"
    "Concreteness_ratings_Brysbaert_et_al_BRM.txt"
)
OUT = HERE / "concepts_a0a1.json"
CONCRETE_MIN = 4.0

WORD_RE = re.compile(r'word:en:([^"\s]+)')
COMMENT_RE = re.compile(r"#\s*(.+?)\s*$")
TOKEN_RE = re.compile(r"[A-Za-z']+")

# --------------------------------------------------------------- curation ----
# lemma -> (sense_subject, domain, sense_gloss)
# sense_subject is wrapped by style.STYLE_PREFIX as "...a single {subject}...".
# domain buckets siblings for the visually-confusable distractor pool.
CURATION: dict[str, tuple[str, str, str]] = {
    # food
    "apple": ("single red apple", "food", "apple (fruit)"),
    "bread": ("loaf of bread", "food", "bread"),
    "cake": ("slice of frosted cake", "food", "cake"),
    "chocolate": ("bar of chocolate", "food", "chocolate"),
    "pizza": ("whole pizza seen from above", "food", "pizza"),
    "honey": ("jar of honey with a wooden dipper", "food", "honey"),
    "jam": ("jar of red fruit jam", "food", "jam (fruit preserve)"),
    "fruit": ("bowl of mixed fresh fruit", "food", "fruit"),
    "ice": ("stack of clear ice cubes", "food", "ice"),
    "berry": ("cluster of ripe red berries", "food", "berry"),
    "breakfast": ("breakfast plate with eggs and toast", "food", "breakfast meal"),
    # drink
    "water": ("clear glass of drinking water", "drink", "water (to drink)"),
    "milk": ("glass bottle of milk", "drink", "milk"),
    "coffee": ("cup of hot coffee on a saucer", "drink", "coffee"),
    "tea": ("cup of hot tea on a saucer", "drink", "tea"),
    "beer": ("tall glass of beer with foam", "drink", "beer"),
    "glass": ("empty clear drinking glass", "drink", "glass (drinking vessel)"),
    "cup": ("single ceramic mug", "drink", "cup"),
    # animal
    "dog": ("happy sitting dog", "animal", "dog"),
    "cat": ("sitting cat", "animal", "cat"),
    "bird": ("small perched songbird", "animal", "bird"),
    "sheep": ("fluffy white sheep standing", "animal", "sheep"),
    # body
    "hand": ("open human hand, palm forward", "body", "hand"),
    "head": ("human head in profile", "body", "head"),
    "eyes": ("pair of human eyes", "body", "eyes"),
    "hair": ("head with long wavy hair", "body", "hair"),
    # clothing
    "shirt": ("folded button shirt", "clothing", "shirt"),
    "dress": ("hanging summer dress", "clothing", "dress"),
    "coat": ("warm winter coat", "clothing", "coat"),
    "jacket": ("denim jacket", "clothing", "jacket"),
    "hat": ("wide-brim hat", "clothing", "hat"),
    "shoe": ("single leather shoe", "clothing", "shoe"),
    # vehicle
    "bus": ("city bus seen from the side", "vehicle", "bus"),
    "train": ("passenger train seen from the side", "vehicle", "train"),
    "ship": ("boat on the water", "vehicle", "ship / boat"),
    "plane": ("airplane flying in the sky", "vehicle", "airplane"),
    # object
    "book": ("single closed hardcover book", "object", "book"),
    "magazine": ("open glossy magazine", "object", "magazine"),
    "clock": ("round wall clock", "object", "clock"),
    "phone": ("modern smartphone", "object", "phone"),
    "key": ("single metal key", "object", "key"),
    "bag": ("paper shopping bag", "object", "bag"),
    "guitar": ("acoustic guitar", "object", "guitar"),
    "ticket": ("single paper admission ticket", "object", "ticket"),
    # furniture / building parts
    "bed": ("single neatly made bed with a pillow", "furniture", "bed"),
    "table": ("wooden table", "furniture", "table"),
    "chair": ("wooden chair", "furniture", "chair"),
    "desk": ("office desk", "furniture", "desk"),
    "door": ("single closed wooden door with a handle", "furniture", "door"),
    "window": ("single glass window with panes", "furniture", "window"),
    "shower": ("bathroom shower with running water", "furniture", "shower"),
    # building
    "house": ("small friendly house with a pitched roof", "building", "house"),
    "school": ("school building with a flag", "building", "school"),
    "hospital": ("hospital building with a red cross sign", "building", "hospital"),
    "restaurant": ("restaurant storefront with an awning", "building", "restaurant"),
    "office": ("modern office building", "building", "office (building)"),
    "airport": ("airport terminal with a control tower", "building", "airport"),
    "station": ("train station building", "building", "station"),
    "shop": ("small shop storefront", "building", "shop"),
    "store": ("store storefront with a sign", "building", "store"),
    "market": ("open-air market stall with produce", "building", "market"),
    "bank": ("bank building with tall columns", "building", "bank (money)"),
    # place
    "gym": ("gym interior with exercise equipment", "place", "gym"),
    "pool": ("blue swimming pool", "place", "swimming pool"),
    "park": ("green park with trees and a bench", "place", "park"),
    "garden": ("blooming flower garden", "place", "garden"),
    "kitchen": ("kitchen with a counter and a stove", "place", "kitchen"),
    "street": ("quiet town street with buildings", "place", "street"),
    # nature / weather
    "sun": ("bright yellow sun", "nature", "sun"),
    "sky": ("blue sky with white clouds", "nature", "sky"),
    "rain": ("gray cloud with falling raindrops", "nature", "rain"),
    "snow": ("snow-covered ground with falling snowflakes", "nature", "snow"),
    "mountain": ("snow-capped mountain", "nature", "mountain"),
    "flower": ("single blooming flower", "nature", "flower"),
    "plant": ("potted green leafy plant", "nature", "plant"),
    # people / occupation
    "doctor": ("doctor in a white coat with a stethoscope", "people", "doctor"),
    "teacher": ("teacher standing at a chalkboard", "people", "teacher"),
    "child": ("young child standing and smiling", "people", "child"),
    "family": ("family group of four standing together", "people", "family"),
    "mother": ("mother holding a baby", "people", "mother"),
    "father": ("father holding a small child's hand", "people", "father"),
    # money
    "money": ("stack of paper money and coins", "money", "money"),
    "dollar": ("single one-dollar banknote", "money", "dollar"),
    # music / action
    "concert": ("concert stage with lights and a crowd", "event", "concert"),
    "cook": ("person cooking at a stove", "action", "to cook"),
    "dance": ("person dancing", "action", "to dance"),
    "sing": ("person singing into a microphone", "action", "to sing"),
}

# Perfect-imageability categories (research §1.2) added regardless of the norm.
INCLUDE_EXTRA: dict[str, tuple[str, str, str, str]] = {
    # lemma -> (sense_subject, domain, sense_gloss, cefr)
    "red": ("solid red color swatch, flat square of color", "color", "red", "A1"),
    "green": ("solid green color swatch, flat square of color", "color", "green", "A1"),
    "blue": ("solid blue color swatch, flat square of color", "color", "blue", "A1"),
    "yellow": ("solid yellow color swatch, flat square of color", "color", "yellow", "A1"),
    "black": ("solid black color swatch, flat square of color", "color", "black", "A1"),
    "white": ("plain white color swatch with a thin outline", "color", "white", "A1"),
    "one": ("exactly one round dot, centered", "number", "one (1)", "A0"),
    "two": ("exactly two round dots in a row", "number", "two (2)", "A0"),
    "three": ("exactly three round dots in a row", "number", "three (3)", "A0"),
    "four": ("exactly four round dots in a grid", "number", "four (4)", "A1"),
    "five": ("exactly five round dots", "number", "five (5)", "A1"),
}

# Gated lemmas we deliberately DID NOT author, with the reason (report only).
SENSE_TRAP = {
    "saw": "polysemy trap: course sense = past of 'see', not the tool",
    "bill": "ambiguous: proper name / restaurant bill / banknote",
    "line": "ambiguous: queue / drawn line / phone line",
    "color": "meta-concept, taught via the actual colors",
    "quarter": "ambiguous: coin / quarter-hour / district",
    "ground": "ambiguous: soil / floor",
    "corner": "not depictable as one clear subject",
    "menu": "text-heavy; diffusion mangles glyphs (style rule)",
    "stomach": "internal organ; not clearly depictable",
    "animal": "over-generic; no single prototype",
    "room": "over-generic interior",
    "floor": "part-of, not a standalone subject",
    "drink": "generic; overlaps specific drinks (water/milk/tea)",
    "game": "ambiguous: board game / sport / match",
    "music": "sound, not a visual subject",
    "song": "sound, not a visual subject",
    "person": "generic; relational, no prototype",
    "husband": "relational kinship; not visually distinct (§1.3)",
    "brother": "relational kinship; not visually distinct (§1.3)",
    "sister": "relational kinship; not visually distinct (§1.3)",
    "daughter": "relational kinship; collapses to 'child' visually",
    "city": "over-broad scene, better as a labeled scene later",
    "country": "over-broad; nation vs countryside ambiguity",
    "town": "over-broad scene",
    "movie": "abstract event; screen depiction ambiguous",
    "night": "temporal; not a single object",
    "month": "temporal; calendar is text",
    "phone": "",  # kept — placeholder removed below
}
SENSE_TRAP.pop("phone", None)


def ensure_norms() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    if NORMS.exists() and NORMS.stat().st_size > 100_000:
        return
    print(f"Downloading Brysbaert norms -> {NORMS}")
    urllib.request.urlretrieve(NORMS_URL, NORMS)


def load_norms() -> dict[str, tuple[float, str]]:
    out: dict[str, tuple[float, str]] = {}
    with NORMS.open(encoding="utf-8", errors="replace") as fh:
        header = fh.readline().rstrip("\n").split("\t")
        ci = header.index("Conc.M")
        pi = header.index("Dom_Pos") if "Dom_Pos" in header else -1
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) <= ci:
                continue
            try:
                conc = float(parts[ci])
            except ValueError:
                continue
            pos = parts[pi].strip() if pi >= 0 and len(parts) > pi else ""
            out[parts[0].strip().lower()] = (conc, pos)
    return out


def singularize(w: str) -> str:
    if w.endswith("ies") and len(w) > 4:
        return w[:-3] + "y"
    if w.endswith(("ses", "xes", "ches", "shes")):
        return w[:-2]
    if w.endswith("s") and not w.endswith("ss") and len(w) > 3:
        return w[:-1]
    return w


def collect_vocab() -> tuple[dict[str, str], dict[str, int]]:
    """({word: cefr}, {phrase_noun_token: freq}) from the A0/A1 units."""
    word_cefr: dict[str, str] = {}
    freq: dict[str, int] = {}
    files = sorted(UNITS.glob("a0-*.yaml")) + sorted(UNITS.glob("a1-*.yaml"))
    if not files:
        print(f"No unit files under {UNITS}", file=sys.stderr)
        sys.exit(1)
    for f in files:
        cefr = "A0" if f.name.startswith("a0-") else "A1"
        for line in f.read_text(encoding="utf-8").splitlines():
            for w in WORD_RE.findall(line):
                word_cefr.setdefault(w.strip().lower(), cefr)
            m = COMMENT_RE.search(line)
            if m and "phrase:" in line:
                for tok in TOKEN_RE.findall(m.group(1).lower()):
                    if len(tok) >= 3:
                        freq[tok] = freq.get(tok, 0) + 1
    return word_cefr, freq


def main() -> None:
    ensure_norms()
    norms = load_norms()
    word_cefr, freq = collect_vocab()

    # Mechanical gate: a lemma is a candidate if it appears (as a word item or a
    # phrase noun) AND Conc.M >= 4.0 AND POS in {Noun, Name, Verb}.
    cand_cefr: dict[str, str] = {}
    for w, cefr in word_cefr.items():
        lem = w if w in norms else singularize(w)
        conc, pos = norms.get(lem, (0.0, ""))
        if conc >= CONCRETE_MIN and pos in ("Noun", "Name", "Verb"):
            cand_cefr.setdefault(lem, cefr)
    for tok, _n in freq.items():
        lem = tok if tok in norms else singularize(tok)
        conc, pos = norms.get(lem, (0.0, ""))
        if conc >= CONCRETE_MIN and pos == "Noun":
            cand_cefr.setdefault(lem, "A1")

    concepts: list[dict] = []
    uncurated: list[str] = []
    seed = 1000

    def add(word: str, subject: str, domain: str, gloss: str, cefr: str, pos: str, conc: float):
        nonlocal seed
        seed += 1
        concepts.append({
            "key": word,
            "word": word,
            "sense_subject": subject,
            "sense_gloss": gloss,
            "domain": domain,
            "distractor_group": [],  # filled after all concepts known
            "cefr": cefr,
            "pos": pos,
            "concreteness": round(conc, 2),
            "seed": seed,
        })

    for lem in sorted(cand_cefr):
        cefr = cand_cefr[lem]
        conc, pos = norms.get(lem, (0.0, ""))
        if lem in CURATION:
            subject, domain, gloss = CURATION[lem]
            add(lem, subject, domain, gloss, cefr, pos, conc)
        elif lem in SENSE_TRAP:
            pass  # reported below
        else:
            uncurated.append(lem)

    for lem, (subject, domain, gloss, cefr) in INCLUDE_EXTRA.items():
        conc, pos = norms.get(lem, (0.0, "adj/num"))
        add(lem, subject, domain, gloss, cefr, pos or "adj/num", conc)

    # Distractor groups: up to 5 same-domain siblings, stable order.
    by_domain: dict[str, list[str]] = {}
    for c in concepts:
        by_domain.setdefault(c["domain"], []).append(c["key"])
    for c in concepts:
        sibs = [k for k in by_domain[c["domain"]] if k != c["key"]]
        c["distractor_group"] = sibs[:5]

    concepts.sort(key=lambda c: (c["domain"], c["key"]))
    OUT.write_text(json.dumps(concepts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # ---- report ----
    dom_counts: dict[str, int] = {}
    thin = 0
    for c in concepts:
        dom_counts[c["domain"]] = dom_counts.get(c["domain"], 0) + 1
        if len(c["distractor_group"]) < 3:
            thin += 1
    print(f"== imagepan concept extraction ==")
    print(f"shipped concepts: {len(concepts)}  -> {OUT.name}")
    print(f"domains: " + ", ".join(f"{d}={n}" for d, n in sorted(dom_counts.items())))
    print(f"concepts with <3 distractors (thin picture-choice pool): {thin}")
    print(f"\ngated-but-UNCURATED (no authored subject, NOT shipped): {len(uncurated)}")
    print("  " + ", ".join(sorted(uncurated)))
    print(f"\nsense-trap / non-visual EXCLUSIONS ({len(SENSE_TRAP)}):")
    for w, why in sorted(SENSE_TRAP.items()):
        print(f"  {w:10s} — {why}")


if __name__ == "__main__":
    main()
