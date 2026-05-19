#!/usr/bin/env python3
"""Extract canonical stroke trajectories from the Calliar dataset
(ARBML, MIT-licensed, https://github.com/ARBML/Calliar) and emit
rasmapan stroke-order overrides.

Strategy:
  Calliar is sentence-level — every JSON is a connected calligraphic
  phrase, never an isolated letter. But each stroke is labeled with
  its **primitive shape** (e.g. ٮ for baa/taa/thaa base, . for dot,
  ا for alif). So:
    1. Walk every sample and group strokes by primitive_id.
    2. For each primitive, pick one canonical trajectory:
       - filter by "reasonable aspect ratio" (rejects connecting
         tails — strokes that are 5× wider than tall are usually
         medial/final fragments inside a word, not standalone shapes)
       - among the survivors, pick the one closest to the median
         total path length (rejects ornamental flourishes from
         Diwani-style samples).
    3. Normalize each chosen primitive to 0..1000 viewBox, centered,
       preserving aspect ratio.
    4. For composite letters (baa = ٮ-base + dot, taa = ٮ-base + 2
       dots, ...), reuse the base's normalized trajectory and
       *programmatically* place the dot strokes in classical
       positions (above/below). This gives clean, consistent dot
       placement instead of inheriting noisy relative positions
       from random sentence samples.
    5. Output `build/seed/stroke_orders_seed.json` in the shape the
       existing override path expects (see
       `build_arabic_pack.py:536-549`).

Attribution: trajectories come from real Arabic calligraphers
recorded by ARBML. License notice lives in
`build/vendor/calliar/LICENSE.txt`. Pack README and
`assets/CREDITS.txt` carry the credit line.

For Phase A this extracts only the letters in `LETTER_RECIPES`
(alif + baa). Phase B extends that table to all 28 letters.
"""

import json
import pathlib
import statistics
from typing import Dict, List, Optional, Tuple

HERE = pathlib.Path(__file__).resolve().parent
CALLIAR_ROOT = HERE / "vendor" / "calliar" / "extracted" / "dataset"
OUT_SEED = HERE / "seed" / "stroke_orders_seed.json"

# 0..1000 viewBox — matches AmiriExtractor + scoring.js.
VIEWBOX = 1000.0
PADDING = 80.0

# Recipes describe how composite letters are assembled from primitive
# strokes. Each recipe element is either:
#   - "primitive:<char>"  — pull this primitive's canonical median
#                           and place it in the viewBox
#   - "dot:<spec>"        — drop dot stroke(s) sized + positioned
#                           relative to the just-placed primitive's
#                           bbox. spec ∈ {above1, above2, above3,
#                           below1, below2, below3}.
#
# Order = the classical Naskh stroke order: base shape first, then
# dots. Many Calliar writers happen to write dots first; we
# intentionally re-order so the animation teaches the canonical
# sequence.
#
# Decomposition source: scripts/chars.py from Calliar
# (https://github.com/ARBML/Calliar). We diverge only where
# necessary: kaaf uses the ﻛ primitive directly (Calliar tags it as
# its own glyph), and Taa/DHaa are deferred — their two-primitive
# composition (alif stem + Saad-medial body) requires multi-primitive
# spatial layout we'll handle in a follow-up; for now they fall
# back to the permissive outline scorer.
LETTER_RECIPES: Dict[str, List[str]] = {
    # ---- Single-primitive letters ----
    "alif":  ["primitive:ا"],
    "Haa":   ["primitive:ح"],
    "daal":  ["primitive:د"],
    "raa":   ["primitive:ر"],
    "siin":  ["primitive:س"],
    "Saad":  ["primitive:ص"],
    "ain":   ["primitive:ع"],
    "laam":  ["primitive:ل"],
    "miim":  ["primitive:م"],
    "haa":   ["primitive:ه"],
    "waaw":  ["primitive:و"],
    "kaaf":  ["primitive:ﻛ"],  # Calliar tags kaaf glyphs as ﻛ directly
    # ---- Single-primitive + dots ----
    "baa":   ["primitive:ٮ", "dot:below1"],
    "taa":   ["primitive:ٮ", "dot:above2"],
    "thaa":  ["primitive:ٮ", "dot:above3"],
    "jiim":  ["primitive:ح", "dot:below1"],
    "khaa":  ["primitive:ح", "dot:above1"],
    "dhaal": ["primitive:د", "dot:above1"],
    "zaay":  ["primitive:ر", "dot:above1"],
    "shiin": ["primitive:س", "dot:above3"],
    "Daad":  ["primitive:ص", "dot:above1"],
    "ghain": ["primitive:ع", "dot:above1"],
    "faa":   ["primitive:ٯ", "dot:above1"],
    "qaaf":  ["primitive:ٯ", "dot:above2"],
    "nuun":  ["primitive:ں", "dot:above1"],
    "yaa":   ["primitive:ى", "dot:below2"],
    # ---- Two-primitive composites ----
    # Taa (ط) and DHaa (ظ) decompose into [alif stem, Saad-medial
    # body]. The "pair:" step looks for adjacent stroke pairs in
    # Calliar samples and lifts BOTH primitives' trajectories with
    # their absolute coords intact — so the spatial relationship
    # between the stem and base comes from real calligraphers'
    # hands, not invented by us. Output order is base-first, then
    # stem, per classical Naskh convention.
    "Taa":   ["pair:ا+ﺻ"],
    "DHaa":  ["pair:ا+ﺻ", "dot:above1"],
}

# Dot offsets in viewBox units, applied relative to the just-placed
# primitive's bbox. above_y_offset is added to the primitive's top
# edge (negative = above the primitive); below_y_offset is added to
# the bottom edge (positive = below). x-positions for the 2-dot and
# 3-dot patterns are spaced symmetrically around the primitive's
# horizontal center.
DOT_GAP = 60.0  # px between primitive edge and the dot row
DOT_SPACING_2 = 110.0  # horizontal gap between two dots
DOT_SPACING_3 = 90.0   # horizontal gap (each side of center) for three dots
DOT_TRIANGLE_RISE = 70.0  # how much the middle dot sits forward in a triangle


def load_samples() -> List[List[dict]]:
    samples = []
    for split in ("train", "valid", "test"):
        split_dir = CALLIAR_ROOT / split
        if not split_dir.exists():
            continue
        for jf in split_dir.glob("*.json"):
            try:
                samples.append(json.loads(jf.read_text()))
            except Exception:  # noqa: BLE001
                continue
    return samples


def path_length(pts: List[List[float]]) -> float:
    total = 0.0
    for i in range(1, len(pts)):
        dx = pts[i][0] - pts[i - 1][0]
        dy = pts[i][1] - pts[i - 1][1]
        total += (dx * dx + dy * dy) ** 0.5
    return total


def bbox(pts: List[List[float]]) -> Tuple[float, float, float, float]:
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (min(xs), min(ys), max(xs), max(ys))


def collect_primitive_strokes(
    samples: List[List[dict]],
) -> Dict[str, List[List[List[float]]]]:
    """For each primitive_id, gather all its stroke trajectories
    from across the corpus."""
    out: Dict[str, List[List[List[float]]]] = {}
    for sample in samples:
        for stroke in sample:
            if not isinstance(stroke, dict) or len(stroke) != 1:
                continue
            (pid, pts), = stroke.items()
            if not isinstance(pts, list) or len(pts) < 2:
                continue
            out.setdefault(pid, []).append(pts)
    return out


# Canonical aspect-ratio (h/w) hints per primitive. These reflect the
# typical isolated-form proportions in Naskh, NOT the average of all
# Calliar occurrences — many of which are from medial/final positions
# inside words where the shape gets stretched by connecting strokes.
# When a primitive has a hint, the chooser prefers candidates whose
# h/w falls in this range over candidates that merely match the
# corpus median.
# Per-primitive direction rule for the trajectory. The animation reads
# the polyline in array order, so the start point determines where the
# pen drops down. We pick a Calliar candidate by shape, then reverse
# the polyline if it's running in the non-canonical direction.
#
# Each value is a 2-tuple (x_sign, y_sign):
#   x_sign = -1  →  start.x should be > end.x  (right-to-left, RTL norm)
#   x_sign =  0  →  no preference on X
#   y_sign = +1  →  start.y should be < end.y  (top-to-bottom)
#   y_sign =  0  →  no preference on Y
#
# Letters with naturally complex paths (waaw loops, ain's enclosed
# shape, Saad's head+tail) get (0, 0) — trust the calligrapher's hand.
DIRECTION_RULES: Dict[str, Tuple[int, int]] = {
    "ا": (0, +1),    # alif: top → bottom
    "ل": (0, +1),    # laam: top → bottom (then the hook curves back)
    "ٮ": (-1, 0),    # baa-bowl: right → left
    "ں": (-1, 0),    # nuun-base: right → left
    "س": (-1, 0),    # siin teeth + bowl: right → left
    "د": (-1, +1),   # daal: top-right → bottom-left
    "ر": (-1, +1),   # raa: top-right → bottom-left
    "ٯ": (0, 0),     # qaaf-base: loop + tail, varies
    "ح": (-1, 0),    # Haa-base: right → left across the curve
    "ﻛ": (0, +1),    # kaaf: vertical body top → bottom
    "م": (-1, 0),    # miim: head right → tail left
    "ى": (-1, 0),    # yaa-base scoop: right → left
    "ه": (0, 0),     # haa: complex round shape, trust the hand
    "ع": (0, 0),     # ain: enclosed shape, varies
    "و": (0, 0),     # waaw: loop + tail, varies
    "ص": (0, 0),     # Saad: head + tail, varies
    "ﺻ": (-1, 0),    # Saad-medial: horizontal body right → left
    "ء": (0, 0),     # hamza: small mark, varies
}


ASPECT_HINTS: Dict[str, Tuple[float, float]] = {
    "ا": (4.0, 12.0),    # alif — tall vertical
    "ل": (3.0, 8.0),     # laam — tall vertical with hook
    "ٮ": (0.35, 0.9),    # baa-bowl — wide and shallow
    "ں": (0.35, 0.9),    # nuun-base — wide bowl, similar to baa
    "س": (0.15, 0.45),   # siin — very wide (three teeth)
    "ص": (0.35, 0.85),   # Saad — wide oval head with tail
    "د": (0.45, 0.95),   # daal — wider than tall, small hook
    "ر": (0.7, 1.6),     # raa — descending swoop
    "ى": (0.3, 0.8),     # yaa-base — wide scoop
    "ح": (0.65, 1.3),    # Haa-base — roundish
    "ٯ": (0.85, 1.7),    # qaaf-base — small head + descending tail
    "م": (0.7, 1.5),     # miim — round head + tail
    "ه": (0.7, 1.4),     # haa — round shape
    "و": (0.9, 1.6),     # waaw — loop + tail
    "ع": (0.7, 1.3),     # ain — closed shape
    "ﻛ": (1.2, 3.0),     # kaaf — tall body with internal mark
    "ﺻ": (0.4, 0.9),     # Saad medial — horizontal body
    "ء": (0.7, 1.5),     # hamza
}


def choose_canonical(
    candidates: List[List[List[float]]],
    primitive_id: Optional[str] = None,
) -> Optional[List[List[float]]]:
    """Pick the canonical trajectory for a primitive.

    Pipeline:
      1. **Aspect-ratio band.** Filter by the primitive's canonical
         Naskh h/w band (ASPECT_HINTS) — rejects medial-position
         distortions. Without a hint, use the corpus median ±25%.
      2. **Tortuosity floor.** Compute median path length of the
         aspect band. Filter to samples with path length in
         [0.5 × median, 2.0 × median] (rejects stubs and overlong
         flourishes).
      3. **Cleanest wins.** Among the survivors, pick the sample
         with the lowest tortuosity (path length ÷ bbox diagonal).
         Tortuosity 1.0 = a straight line; 1.2 = a clean curve; >1.6
         = a wandering or doubled-back stroke (sentence-context
         connector tails).

    Falls back gracefully if any stage rejects everything — the
    pipeline never returns None when at least one valid candidate
    exists.
    """
    rows: List[Tuple[float, float, float, List[List[float]]]] = []
    for pts in candidates:
        x0, y0, x1, y1 = bbox(pts)
        w = max(1.0, x1 - x0)
        h = max(1.0, y1 - y0)
        L = path_length(pts)
        if L < 20:
            continue
        diag = math.sqrt(w * w + h * h)
        tort = L / diag if diag > 0 else float("inf")
        rows.append((h / w, L, tort, pts))
    if not rows:
        return None

    # Stage 1: aspect-ratio band.
    hint = ASPECT_HINTS.get(primitive_id) if primitive_id else None
    if hint:
        lo, hi = hint
    else:
        median_ar = statistics.median(r[0] for r in rows)
        lo = median_ar * 0.75
        hi = median_ar * 1.25
    band = [r for r in rows if lo <= r[0] <= hi]
    if not band:
        band = rows

    # Stage 2: path-length sanity (reject stubs + overlong flourishes).
    median_len = statistics.median(r[1] for r in band)
    sized = [r for r in band if 0.5 * median_len <= r[1] <= 2.0 * median_len]
    if not sized:
        sized = band

    # Stage 3: lowest tortuosity wins.
    sized.sort(key=lambda r: r[2])
    return sized[0][3]


import math  # noqa: E402 — used by choose_canonical's tortuosity


def normalize_direction(
    stroke: List[List[float]],
    primitive_id: Optional[str],
) -> List[List[float]]:
    """If this primitive has a DIRECTION_RULES entry, reverse the
    polyline when its start/end is the wrong way around. The Calliar
    scorer is direction-agnostic — but the animation reads the polyline
    in order, so a backwards trajectory would teach a backwards stroke.

    For composite letters whose primitive shares this trajectory (e.g.
    baa, taa, thaa all use the ٮ bowl), normalizing once at the
    primitive level fixes them all consistently.
    """
    if primitive_id is None or not stroke or len(stroke) < 2:
        return stroke
    rule = DIRECTION_RULES.get(primitive_id)
    if rule is None:
        return stroke
    x_sign, y_sign = rule
    if x_sign == 0 and y_sign == 0:
        return stroke
    sx, sy = stroke[0]
    ex, ey = stroke[-1]
    wrong = False
    if x_sign == -1 and ex > sx:   # should end further LEFT than start
        wrong = True
    if y_sign == +1 and ey < sy:   # should end further DOWN than start
        wrong = True
    if wrong:
        return list(reversed(stroke))
    return stroke


def normalize_single(
    pts: List[List[float]],
) -> List[List[float]]:
    """Scale a single stroke so its bbox fits the viewBox with PADDING."""
    x0, y0, x1, y1 = bbox(pts)
    w = max(1.0, x1 - x0)
    h = max(1.0, y1 - y0)
    inner = VIEWBOX - 2 * PADDING
    scale = min(inner / w, inner / h)
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    tx = VIEWBOX / 2 - cx * scale
    ty = VIEWBOX / 2 - cy * scale
    return [[p[0] * scale + tx, p[1] * scale + ty] for p in pts]


def resample(stroke: List[List[float]], n: int = 18) -> List[List[float]]:
    """Even-arc-length resampling. Smooths the dense Calliar data
    (often 100+ pts per stroke) to N points the trace layer can
    render and the scorer can match quickly."""
    if len(stroke) <= 2:
        return [[float(p[0]), float(p[1])] for p in stroke]
    total = path_length(stroke)
    if total < 1e-3:
        return [[float(stroke[0][0]), float(stroke[0][1])]]
    step = total / (n - 1)
    out = [[float(stroke[0][0]), float(stroke[0][1])]]
    target = step
    accum = 0.0
    for i in range(1, len(stroke)):
        ax, ay = stroke[i - 1]
        bx, by = stroke[i]
        seg = ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5
        while accum + seg >= target and len(out) < n - 1:
            t = (target - accum) / seg if seg > 1e-6 else 0
            out.append([ax + (bx - ax) * t, ay + (by - ay) * t])
            target += step
        accum += seg
    out.append([float(stroke[-1][0]), float(stroke[-1][1])])
    return out


def build_letter_strokes(
    recipe: List[str],
    canonical_primitives: Dict[str, List[List[float]]],
    canonical_pairs: Dict[str, List[List[List[float]]]],
) -> List[List[List[float]]]:
    """Assemble the stroke list for one letter from its recipe.

    The first "primitive:" or "pair:" step fills the viewBox; its
    normalized bbox becomes the anchor for any subsequent "dot:"
    steps. Dots are positioned via DOT_GAP/DOT_SPACING constants
    relative to that bbox, so each letter's dots sit just above
    or below the actual shape regardless of how tall or wide the
    base primitive naturally is.
    """
    out: List[List[List[float]]] = []
    anchor_bbox: Optional[Tuple[float, float, float, float]] = None

    def remember_anchor(strokes: List[List[List[float]]]) -> None:
        nonlocal anchor_bbox
        all_pts = [p for s in strokes for p in s]
        if all_pts:
            anchor_bbox = bbox(all_pts)

    for step in recipe:
        if step.startswith("primitive:"):
            pid = step.split(":", 1)[1]
            raw = canonical_primitives.get(pid)
            if not raw:
                return []
            norm = normalize_single(raw)
            resampled = resample(norm)
            if anchor_bbox is None:
                remember_anchor([resampled])
            out.append(resampled)
        elif step.startswith("pair:"):
            spec = step.split(":", 1)[1]
            strokes = canonical_pairs.get(spec)
            if not strokes:
                return []
            # canonical_pairs entries are already normalized + resampled
            # to the viewBox as a UNIT (both strokes share one transform).
            if anchor_bbox is None:
                remember_anchor(strokes)
            out.extend(strokes)
        elif step.startswith("dot:"):
            kind = step.split(":", 1)[1]
            if anchor_bbox is None:
                continue
            x0, y0, x1, y1 = anchor_bbox
            cx = (x0 + x1) / 2
            is_above = kind.startswith("above")
            count_char = kind[-1]
            try:
                count = int(count_char)
            except ValueError:
                continue
            anchor_edge = y0 if is_above else y1
            y = anchor_edge - DOT_GAP if is_above else anchor_edge + DOT_GAP
            if count == 1:
                out.append([[float(cx), float(y)]])
            elif count == 2:
                out.append([[float(cx - DOT_SPACING_2 / 2), float(y)]])
                out.append([[float(cx + DOT_SPACING_2 / 2), float(y)]])
            elif count == 3:
                # Triangle: outer two on the row, middle dot raised
                # AWAY from the primitive (further above when above,
                # further below when below).
                rise = -DOT_TRIANGLE_RISE if is_above else DOT_TRIANGLE_RISE
                out.append([[float(cx - DOT_SPACING_3), float(y)]])
                out.append([[float(cx), float(y + rise)]])
                out.append([[float(cx + DOT_SPACING_3), float(y)]])
    return out


def find_canonical_pair(
    samples: List[List[dict]],
    primitive_a: str,
    primitive_b: str,
) -> Optional[List[List[List[float]]]]:
    """Scan Calliar samples for adjacent stroke pairs tagged
    `primitive_a` and `primitive_b` (in either order) and lift
    them together, preserving their absolute spatial relationship.

    Picks the pair whose combined bbox aspect ratio is closest to
    the median across all matches — biases toward typical Naskh
    proportions, rejects pairs from squished medial positions or
    flourished display samples.

    Returns the pair normalized + resampled to fit the 0..1000
    viewBox as a single unit. Output order: primitive_b first,
    then primitive_a — for ط that means base-then-stem, which is
    the classical Naskh order.
    """
    candidates: List[Tuple[float, float, List[List[float]], List[List[float]]]] = []
    for sample in samples:
        if not isinstance(sample, list):
            continue
        for i in range(len(sample) - 1):
            s0 = sample[i]
            s1 = sample[i + 1]
            if not (isinstance(s0, dict) and len(s0) == 1
                    and isinstance(s1, dict) and len(s1) == 1):
                continue
            (k0, p0), = s0.items()
            (k1, p1), = s1.items()
            if not (isinstance(p0, list) and isinstance(p1, list)):
                continue
            if len(p0) < 2 or len(p1) < 2:
                continue
            # Accept either ordering — writers vary on which they
            # draw first.
            if {k0, k1} != {primitive_a, primitive_b}:
                continue
            stroke_a = p0 if k0 == primitive_a else p1
            stroke_b = p0 if k0 == primitive_b else p1
            all_pts = stroke_a + stroke_b
            x0, y0, x1, y1 = bbox(all_pts)
            w = max(1.0, x1 - x0)
            h = max(1.0, y1 - y0)
            ar = h / w
            total_len = path_length(stroke_a) + path_length(stroke_b)
            if total_len < 60:
                continue
            candidates.append((ar, total_len, stroke_a, stroke_b))
    if not candidates:
        return None
    # Pick median by combined aspect ratio.
    candidates.sort(key=lambda r: r[0])
    chosen = candidates[len(candidates) // 2]
    _ar, _L, stroke_a, stroke_b = chosen
    # Normalize the combined bbox to the viewBox (preserve relative
    # positions between the two strokes).
    combined = stroke_a + stroke_b
    x0, y0, x1, y1 = bbox(combined)
    w = max(1.0, x1 - x0)
    h = max(1.0, y1 - y0)
    inner = VIEWBOX - 2 * PADDING
    scale = min(inner / w, inner / h)
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    tx = VIEWBOX / 2 - cx * scale
    ty = VIEWBOX / 2 - cy * scale

    def apply(stroke: List[List[float]]) -> List[List[float]]:
        return [[p[0] * scale + tx, p[1] * scale + ty] for p in stroke]

    # Output order: primitive_b first (base for ط: Saad-medial body),
    # then primitive_a (stem: alif). Per-primitive direction normalization
    # so the alif stem always runs top-to-bottom and the Saad-medial
    # base always runs right-to-left, regardless of which way the
    # Calliar writer happened to draw them.
    base = normalize_direction(resample(apply(stroke_b)), primitive_b)
    stem = normalize_direction(resample(apply(stroke_a)), primitive_a)
    return [base, stem]


def main() -> None:
    samples = load_samples()
    print(f"Loaded {len(samples)} Calliar samples")

    grouped = collect_primitive_strokes(samples)
    print(f"Collected strokes for {len(grouped)} distinct primitives")

    # Choose a canonical trajectory per primitive used by any recipe.
    needed = set()
    needed_pairs = set()
    for recipe in LETTER_RECIPES.values():
        for step in recipe:
            if step.startswith("primitive:"):
                needed.add(step.split(":", 1)[1])
            elif step.startswith("pair:"):
                spec = step.split(":", 1)[1]
                a, b = spec.split("+", 1)
                needed_pairs.add((a, b))

    canonical: Dict[str, List[List[float]]] = {}
    for pid in needed:
        chosen = choose_canonical(grouped.get(pid, []), pid)
        if chosen is None:
            print(f"  [primitive {pid!r}] NO usable candidates "
                  f"(grouped: {len(grouped.get(pid, []))})")
            continue
        # Direction-normalize to canonical Naskh writing direction.
        chosen = normalize_direction(chosen, pid)
        canonical[pid] = chosen
        print(f"  [primitive {pid!r}] chose stroke "
              f"len={path_length(chosen):.1f} pts={len(chosen)}")

    canonical_pairs: Dict[str, List[List[List[float]]]] = {}
    for a, b in needed_pairs:
        pair_strokes = find_canonical_pair(samples, a, b)
        spec = f"{a}+{b}"
        if pair_strokes is None:
            print(f"  [pair {spec!r}] NO adjacent-pair match in corpus")
            continue
        canonical_pairs[spec] = pair_strokes
        print(f"  [pair {spec!r}] {len(pair_strokes)} stroke(s) lifted, "
              f"sizes={[len(s) for s in pair_strokes]}")

    # Load existing seed; merge per family_id rather than overwrite.
    existing: List[dict] = []
    if OUT_SEED.exists():
        try:
            data = json.loads(OUT_SEED.read_text())
            if isinstance(data, list):
                existing = data
        except Exception:  # noqa: BLE001
            existing = []
    by_family = {e.get("family_id"): e for e in existing if isinstance(e, dict)}

    for family_id, recipe in LETTER_RECIPES.items():
        strokes = build_letter_strokes(recipe, canonical, canonical_pairs)
        if not strokes:
            print(f"  [{family_id}] could not build — missing primitive(s)")
            continue
        entry = by_family.setdefault(family_id, {"family_id": family_id, "forms": {}})
        entry.setdefault("forms", {})["isolated"] = {
            "medians": strokes,
            "scoring": "median",
        }
        sizes = [len(s) for s in strokes]
        print(f"  [{family_id}] {len(strokes)} stroke(s), sizes={sizes}")

    out_list = list(by_family.values())
    OUT_SEED.write_text(json.dumps(out_list, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(out_list)} family entries to "
          f"{OUT_SEED.relative_to(HERE.parent.parent)}")


if __name__ == "__main__":
    main()
