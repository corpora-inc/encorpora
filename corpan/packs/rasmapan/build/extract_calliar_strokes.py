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
#                           and drop it at viewBox center
#   - "dot:<pos>"         — drop a dot stroke at a relative position
#                           (above, below, above2, below2 = two dots
#                           stacked, above3 = three dots in triangle)
#
# Order = the classical Naskh stroke order: base shape first, then
# dots. Many Calliar writers happen to write dots first; we
# intentionally re-order on output.
#
# Phase A: alif + baa only.
LETTER_RECIPES: Dict[str, List[str]] = {
    "alif": ["primitive:ا"],
    "baa": ["primitive:ٮ", "dot:below1"],
}

# Dot positions relative to viewBox center (after the base primitive
# is normalized to fill the viewBox). Below-base dots sit a bit
# beneath the bowl's bottom; above-base dots sit a bit above the
# bowl's top.
DOT_POSITIONS = {
    "above1": [(500, 100)],
    "above2": [(440, 100), (560, 100)],
    "above3": [(380, 140), (500, 80), (620, 140)],
    "below1": [(500, 920)],
    "below2": [(440, 920), (560, 920)],
    "below3": [(380, 880), (500, 940), (620, 880)],
}


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


def choose_canonical(
    candidates: List[List[List[float]]],
) -> Optional[List[List[float]]]:
    """Pick the canonical trajectory for a primitive by matching the
    *typical shape* of that primitive across the whole corpus, then
    breaking ties on path length.

    The typical shape is captured by the per-primitive median aspect
    ratio (height ÷ width). Alif samples cluster around h/w ≈ 7
    (vertical line); baa-bowl samples cluster around h/w ≈ 0.7
    (horizontal bowl); a dot at ≈ 1.0. So we:
      1. Reject obvious tagging noise (path length < 20 px).
      2. Compute the median h/w across the cleaned candidates.
      3. Keep candidates within ±25% of that median ratio.
      4. Among survivors, pick the one whose path length is closest
         to the survivors' median (rejects short stubs and overlong
         ornaments).
    """
    rows: List[Tuple[float, float, List[List[float]]]] = []
    for pts in candidates:
        x0, y0, x1, y1 = bbox(pts)
        w = max(1.0, x1 - x0)
        h = max(1.0, y1 - y0)
        L = path_length(pts)
        if L < 20:
            continue
        rows.append((h / w, L, pts))
    if not rows:
        return None
    median_ar = statistics.median(r[0] for r in rows)
    lo = median_ar * 0.75
    hi = median_ar * 1.25
    band = [r for r in rows if lo <= r[0] <= hi]
    if not band:
        band = rows
    median_len = statistics.median(r[1] for r in band)
    band.sort(key=lambda r: abs(r[1] - median_len))
    return band[0][2]


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
) -> List[List[List[float]]]:
    """Assemble the stroke list for one letter from its recipe.
    The base primitive (first entry) fills the viewBox; dots get
    fixed positions relative to that viewBox."""
    out: List[List[List[float]]] = []
    base_normalized: Optional[List[List[float]]] = None
    for step in recipe:
        if step.startswith("primitive:"):
            pid = step.split(":", 1)[1]
            raw = canonical_primitives.get(pid)
            if not raw:
                return []
            norm = normalize_single(raw)
            if base_normalized is None:
                base_normalized = norm
            out.append(resample(norm))
        elif step.startswith("dot:"):
            kind = step.split(":", 1)[1]
            positions = DOT_POSITIONS.get(kind, [])
            for x, y in positions:
                out.append([[float(x), float(y)]])
    return out


def main() -> None:
    samples = load_samples()
    print(f"Loaded {len(samples)} Calliar samples")

    grouped = collect_primitive_strokes(samples)
    print(f"Collected strokes for {len(grouped)} distinct primitives")

    # Choose a canonical trajectory per primitive used by any recipe.
    needed = set()
    for recipe in LETTER_RECIPES.values():
        for step in recipe:
            if step.startswith("primitive:"):
                needed.add(step.split(":", 1)[1])

    canonical: Dict[str, List[List[float]]] = {}
    for pid in needed:
        chosen = choose_canonical(grouped.get(pid, []))
        if chosen is None:
            print(f"  [primitive {pid!r}] NO usable candidates "
                  f"(grouped: {len(grouped.get(pid, []))})")
            continue
        canonical[pid] = chosen
        print(f"  [primitive {pid!r}] chose stroke "
              f"len={path_length(chosen):.1f} pts={len(chosen)}")

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
        strokes = build_letter_strokes(recipe, canonical)
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
