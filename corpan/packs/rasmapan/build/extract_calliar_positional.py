#!/usr/bin/env python3
"""Position-aware stroke extraction from Calliar.

Completes the stroke-order story: every glyph variant a user sees in
rasmapan (isolated / initial / medial / final) gets its own real
Calliar-derived animation, not a one-size-fits-all isolated form.

Pipeline:
  1. Walk every Calliar sample. For each PRIMITIVE stroke (not dots),
     classify its position by looking at the previous and next
     PRIMITIVE strokes (dots are skipped — they're part of the
     current letter, not a context-breaking neighbor):
        prev connects forward AND this connects backward → linked on right
        this connects forward AND next connects backward → linked on left
        both linked → MEDIAL
        only right → FINAL
        only left → INITIAL
        neither → ISOLATED
     Uses PRIMITIVE_CONNECTS table mirroring the connect_before /
     connect_after flags in letters_seed.json.
  2. Group all candidate trajectories by (primitive_id, position).
  3. Pick canonical per group via the existing aspect-band +
     length-sanity + tortuosity-min pipeline.
  4. Direction-normalize per primitive.
  5. Compose per-position letter recipes (base primitive + dot
     pattern) into `build/seed/stroke_orders_seed.json`, populating
     `forms.isolated`, `forms.initial`, `forms.medial`,
     `forms.final` where data exists.

Output is consumed unchanged by `build_arabic_pack.py` — that script
already keys overrides by `family_id.position`, so the new
positional entries just light up extra writer rows.
"""

import json
import math
import pathlib
import statistics
from typing import Dict, List, Optional, Tuple

HERE = pathlib.Path(__file__).resolve().parent
CALLIAR_ROOT = HERE / "vendor" / "calliar" / "extracted" / "dataset"
OUT_SEED = HERE / "seed" / "stroke_orders_seed.json"

VIEWBOX = 1000.0
PADDING = 80.0

# Connection rules per Calliar primitive — mirrors letters_seed.json's
# connect_before / connect_after flags. Six letters never connect to
# the letter that follows them (connects_after = False): alif, daal,
# dhaal, raa, zaay, waaw. Their primitives inherit that property.
# Hamza (ء) is independent — connects on neither side.
PRIMITIVE_CONNECTS: Dict[str, Tuple[bool, bool]] = {
    "ا": (True, False),   # alif
    "ٮ": (True, True),    # baa / taa / thaa base
    "ح": (True, True),    # jiim / Haa / khaa base
    "د": (True, False),   # daal (and dhaal via dot)
    "ر": (True, False),   # raa (and zaay via dot)
    "س": (True, True),    # siin / shiin base
    "ص": (True, True),    # Saad / Daad base
    "ع": (True, True),    # ain / ghain base
    "ٯ": (True, True),    # faa / qaaf base
    "ل": (True, True),    # laam
    "م": (True, True),    # miim
    "ں": (True, True),    # nuun base
    "ه": (True, True),    # haa
    "و": (True, False),   # waaw
    "ى": (True, True),    # yaa base (alif maksura)
    "ﻛ": (True, True),    # kaaf (Calliar uses presentation form here)
    "ﺻ": (True, True),    # Saad-medial form (Calliar tag)
    "ء": (False, False),  # hamza
}

# Per-family base templates: (primitive_id, dot_spec_or_None,
# included_positions). The non-connectors (alif/daal/dhaal/raa/zaay/
# waaw) skip initial + medial — they don't exist in Arabic
# typography for those letters. Two-primitive composites (Taa, DHaa)
# are handled separately via the pair-extraction path.
LETTER_BASE_TEMPLATES: Dict[str, Tuple[str, Optional[str], List[str]]] = {
    # ---- Single-primitive (no dot) ----
    "alif":  ("ا", None,      ["isolated", "final"]),
    "Haa":   ("ح", None,      ["isolated", "initial", "medial", "final"]),
    "daal":  ("د", None,      ["isolated", "final"]),
    "raa":   ("ر", None,      ["isolated", "final"]),
    "siin":  ("س", None,      ["isolated", "initial", "medial", "final"]),
    "Saad":  ("ص", None,      ["isolated", "initial", "medial", "final"]),
    "ain":   ("ع", None,      ["isolated", "initial", "medial", "final"]),
    "laam":  ("ل", None,      ["isolated", "initial", "medial", "final"]),
    "miim":  ("م", None,      ["isolated", "initial", "medial", "final"]),
    "haa":   ("ه", None,      ["isolated", "initial", "medial", "final"]),
    "waaw":  ("و", None,      ["isolated", "final"]),
    "kaaf":  ("ﻛ", None,      ["isolated", "initial", "medial", "final"]),
    # ---- Single-primitive + dots ----
    "baa":   ("ٮ", "below1",  ["isolated", "initial", "medial", "final"]),
    "taa":   ("ٮ", "above2",  ["isolated", "initial", "medial", "final"]),
    "thaa":  ("ٮ", "above3",  ["isolated", "initial", "medial", "final"]),
    "jiim":  ("ح", "below1",  ["isolated", "initial", "medial", "final"]),
    "khaa":  ("ح", "above1",  ["isolated", "initial", "medial", "final"]),
    "dhaal": ("د", "above1",  ["isolated", "final"]),
    "zaay":  ("ر", "above1",  ["isolated", "final"]),
    "shiin": ("س", "above3",  ["isolated", "initial", "medial", "final"]),
    "Daad":  ("ص", "above1",  ["isolated", "initial", "medial", "final"]),
    "ghain": ("ع", "above1",  ["isolated", "initial", "medial", "final"]),
    "faa":   ("ٯ", "above1",  ["isolated", "initial", "medial", "final"]),
    "qaaf":  ("ٯ", "above2",  ["isolated", "initial", "medial", "final"]),
    "nuun":  ("ں", "above1",  ["isolated", "initial", "medial", "final"]),
    "yaa":   ("ى", "below2",  ["isolated", "initial", "medial", "final"]),
}

# Two-primitive composite letters (Taa = ط, DHaa = ظ). The pair-based
# extraction lifts adjacent stroke pairs from Calliar with their
# spatial relationship intact. Currently we only ship the isolated
# form — positional Taa/DHaa would need a more elaborate four-primitive
# pair-search (alif + ﺻ + connecting tails) and we defer that.
COMPOSITE_TEMPLATES: Dict[str, Tuple[str, str, Optional[str], List[str]]] = {
    "Taa":  ("ا", "ﺻ", None,      ["isolated"]),
    "DHaa": ("ا", "ﺻ", "above1",  ["isolated"]),
}

DIRECTION_RULES: Dict[str, Tuple[int, int]] = {
    "ا": (0, +1), "ل": (0, +1), "ٮ": (-1, 0), "ں": (-1, 0),
    "س": (-1, 0), "د": (-1, +1), "ر": (-1, +1), "ٯ": (0, 0),
    "ح": (-1, 0), "ﻛ": (0, +1), "م": (-1, 0), "ى": (-1, 0),
    "ه": (0, 0), "ع": (0, 0), "و": (0, 0), "ص": (0, 0),
    "ﺻ": (-1, 0), "ء": (0, 0),
}

ASPECT_HINTS: Dict[str, Tuple[float, float]] = {
    "ا": (4.0, 12.0), "ل": (3.0, 8.0), "ٮ": (0.35, 0.9),
    "ں": (0.35, 0.9), "س": (0.15, 0.45), "ص": (0.35, 0.85),
    "د": (0.45, 0.95), "ر": (0.7, 1.6), "ى": (0.3, 0.8),
    "ح": (0.65, 1.3), "ٯ": (0.85, 1.7), "م": (0.7, 1.5),
    "ه": (0.7, 1.4), "و": (0.9, 1.6), "ع": (0.7, 1.3),
    "ﻛ": (1.2, 3.0), "ﺻ": (0.4, 0.9), "ء": (0.7, 1.5),
}

DOT_GAP = 60.0
DOT_SPACING_2 = 110.0
DOT_SPACING_3 = 90.0
DOT_TRIANGLE_RISE = 70.0


# ============================================================
# Sample loading + primitive collection (position-tagged)
# ============================================================


def load_samples() -> List[List[dict]]:
    samples = []
    for split in ("train", "valid", "test"):
        d = CALLIAR_ROOT / split
        if not d.exists():
            continue
        for jf in d.glob("*.json"):
            try:
                samples.append(json.loads(jf.read_text()))
            except Exception:  # noqa: BLE001
                continue
    return samples


def primitive_at(stroke: dict) -> Optional[str]:
    """Return the primitive id of a stroke dict, or None if malformed."""
    if not isinstance(stroke, dict) or len(stroke) != 1:
        return None
    return next(iter(stroke.keys()))


def points_of(stroke: dict) -> Optional[List[List[float]]]:
    if not isinstance(stroke, dict) or len(stroke) != 1:
        return None
    pts = next(iter(stroke.values()))
    if not isinstance(pts, list):
        return None
    return pts


def classify_position(strokes: List[dict], idx: int) -> Optional[str]:
    """For the primitive at strokes[idx], return one of
    'isolated' / 'initial' / 'medial' / 'final', or None if the stroke
    isn't a classifiable primitive (e.g. a dot or unknown tag).

    Dots are SKIPPED when looking for context neighbors — they're
    part of the current letter, not a position-breaking neighbor.
    """
    pid = primitive_at(strokes[idx])
    if pid is None or pid not in PRIMITIVE_CONNECTS:
        return None
    cb, ca = PRIMITIVE_CONNECTS[pid]

    # Previous non-dot primitive
    prev_cb = prev_ca = None
    for j in range(idx - 1, -1, -1):
        p = primitive_at(strokes[j])
        if p == "." or p == "" or p is None:
            continue
        if p not in PRIMITIVE_CONNECTS:
            break  # unrecognized → boundary
        prev_cb, prev_ca = PRIMITIVE_CONNECTS[p]
        break

    # Next non-dot primitive
    next_cb = next_ca = None
    for j in range(idx + 1, len(strokes)):
        p = primitive_at(strokes[j])
        if p == "." or p == "" or p is None:
            continue
        if p not in PRIMITIVE_CONNECTS:
            break
        next_cb, next_ca = PRIMITIVE_CONNECTS[p]
        break

    linked_right = bool(prev_ca and cb)         # previous letter connects forward to me
    linked_left = bool(ca and next_cb)          # I connect forward to the next letter

    if linked_right and linked_left:
        return "medial"
    if linked_right:
        return "final"
    if linked_left:
        return "initial"
    return "isolated"


def collect_positional(
    samples: List[List[dict]],
) -> Dict[Tuple[str, str], List[List[List[float]]]]:
    """Group every primitive stroke by (primitive_id, position).
    Returns {(pid, position): [trajectory, trajectory, ...]}.
    """
    out: Dict[Tuple[str, str], List[List[List[float]]]] = {}
    for sample in samples:
        if not isinstance(sample, list):
            continue
        for i, stroke in enumerate(sample):
            pid = primitive_at(stroke)
            if pid is None or pid == "." or pid == "":
                continue
            if pid not in PRIMITIVE_CONNECTS:
                continue
            pos = classify_position(sample, i)
            if pos is None:
                continue
            pts = points_of(stroke)
            if not pts or len(pts) < 2:
                continue
            out.setdefault((pid, pos), []).append(pts)
    return out


# ============================================================
# Canonical selection (same heuristic as before, per group)
# ============================================================


def path_length(pts: List[List[float]]) -> float:
    return sum(
        math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1])
        for i in range(1, len(pts))
    )


def bbox(pts: List[List[float]]) -> Tuple[float, float, float, float]:
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def choose_variants(
    candidates: List[List[List[float]]],
    pid: Optional[str] = None,
    n_variants: int = 3,
) -> List[List[List[float]]]:
    """Pick `n_variants` trajectories spread across the aspect-ratio
    distribution — different calligraphers' interpretations of the
    same primitive. Variants are looser than the canonical pick:
    tortuosity is not filtered (some Calliar writers have more
    "personality" in their stroke), but the aspect-ratio band
    stays so we don't pick fragments of connecting tails. Picks
    fall at the (1/(n+1), 2/(n+1), …, n/(n+1)) percentiles so for
    n=3 we get the 25th/50th/75th percentile candidates."""
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
        return []
    # Variants benefit from variation, so the aspect hint is only
    # used as a *preference*: if the strict band has ≥ n_variants
    # candidates, use it; otherwise progressively widen, falling all
    # the way back to the unfiltered list when needed. This lets
    # primitives with sparse isolated samples (ع, ﻛ) still ship
    # variants instead of getting silently skipped.
    hint = ASPECT_HINTS.get(pid) if pid else None
    if hint:
        lo, hi = hint
        band = [r for r in rows if lo <= r[0] <= hi]
        if len(band) < n_variants:
            slack = (hi - lo) * 0.6
            band = [r for r in rows if (lo - slack) <= r[0] <= (hi + slack)]
        if len(band) < 2:
            band = rows  # give up — take whatever variation Calliar has
        rows = band
    rows.sort(key=lambda r: r[0])
    n = len(rows)
    if n == 0:
        return []
    if n_variants <= 1 or n < 2:
        return [rows[n // 2][2]]
    picks = []
    for i in range(n_variants):
        pct = (i + 1) / (n_variants + 1)
        idx = min(n - 1, int(n * pct))
        picks.append(rows[idx][2])
    return picks


def choose_canonical(
    candidates: List[List[List[float]]],
    pid: Optional[str] = None,
) -> Optional[List[List[float]]]:
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
    hint = ASPECT_HINTS.get(pid) if pid else None
    if hint:
        lo, hi = hint
    else:
        median_ar = statistics.median(r[0] for r in rows)
        lo = median_ar * 0.75
        hi = median_ar * 1.25
    band = [r for r in rows if lo <= r[0] <= hi]
    if not band:
        band = rows
    median_len = statistics.median(r[1] for r in band)
    sized = [r for r in band if 0.5 * median_len <= r[1] <= 2.0 * median_len]
    if not sized:
        sized = band
    sized.sort(key=lambda r: r[2])
    return sized[0][3]


def normalize_direction(stroke: List[List[float]], pid: Optional[str]) -> List[List[float]]:
    if pid is None or not stroke or len(stroke) < 2:
        return stroke
    rule = DIRECTION_RULES.get(pid)
    if rule is None:
        return stroke
    x_sign, y_sign = rule
    if x_sign == 0 and y_sign == 0:
        return stroke
    sx, sy = stroke[0]
    ex, ey = stroke[-1]
    wrong = False
    if x_sign == -1 and ex > sx:
        wrong = True
    if y_sign == +1 and ey < sy:
        wrong = True
    if wrong:
        return list(reversed(stroke))
    return stroke


def normalize_single(pts: List[List[float]]) -> List[List[float]]:
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
        seg = math.hypot(bx - ax, by - ay)
        while accum + seg >= target and len(out) < n - 1:
            t = (target - accum) / seg if seg > 1e-6 else 0
            out.append([ax + (bx - ax) * t, ay + (by - ay) * t])
            target += step
        accum += seg
    out.append([float(stroke[-1][0]), float(stroke[-1][1])])
    return out


# ============================================================
# Letter composition
# ============================================================


def dot_strokes(kind: str, anchor: Tuple[float, float, float, float]) -> List[List[List[float]]]:
    """Place dot strokes (single-point polylines) relative to an
    anchor bbox. Same formula as the original single-position
    pipeline."""
    x0, y0, x1, y1 = anchor
    cx = (x0 + x1) / 2
    is_above = kind.startswith("above")
    try:
        count = int(kind[-1])
    except ValueError:
        return []
    edge = y0 if is_above else y1
    y = edge - DOT_GAP if is_above else edge + DOT_GAP
    if count == 1:
        return [[[float(cx), float(y)]]]
    if count == 2:
        return [
            [[float(cx - DOT_SPACING_2 / 2), float(y)]],
            [[float(cx + DOT_SPACING_2 / 2), float(y)]],
        ]
    if count == 3:
        rise = -DOT_TRIANGLE_RISE if is_above else DOT_TRIANGLE_RISE
        return [
            [[float(cx - DOT_SPACING_3), float(y)]],
            [[float(cx), float(y + rise)]],
            [[float(cx + DOT_SPACING_3), float(y)]],
        ]
    return []


def find_canonical_pair(
    samples: List[List[dict]],
    primitive_a: str,
    primitive_b: str,
) -> Optional[List[List[List[float]]]]:
    """Find adjacent stroke pairs tagged [primitive_a, primitive_b]
    (in either order) and lift both with absolute coords preserved.
    Returns the normalized [stroke_b, stroke_a] pair (b first per
    Naskh base-then-stem convention)."""
    candidates: List[Tuple[float, float, List[List[float]], List[List[float]]]] = []
    for sample in samples:
        if not isinstance(sample, list):
            continue
        for i in range(len(sample) - 1):
            k0 = primitive_at(sample[i])
            k1 = primitive_at(sample[i + 1])
            if k0 is None or k1 is None:
                continue
            if {k0, k1} != {primitive_a, primitive_b}:
                continue
            p0 = points_of(sample[i])
            p1 = points_of(sample[i + 1])
            if not (p0 and p1) or len(p0) < 2 or len(p1) < 2:
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
    candidates.sort(key=lambda r: r[0])
    _ar, _L, stroke_a, stroke_b = candidates[len(candidates) // 2]
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

    def apply(stroke):
        return [[p[0] * scale + tx, p[1] * scale + ty] for p in stroke]

    base = normalize_direction(resample(apply(stroke_b)), primitive_b)
    stem = normalize_direction(resample(apply(stroke_a)), primitive_a)
    return [base, stem]


def compose_strokes_for(
    primitive_id: str,
    dot_spec: Optional[str],
    raw_primitive_stroke: List[List[float]],
) -> List[List[List[float]]]:
    """Take one raw primitive trajectory, normalize + direction it,
    and lay it out as a complete letter (primitive + dots if any)."""
    norm = normalize_direction(normalize_single(raw_primitive_stroke), primitive_id)
    base_stroke = resample(norm)
    out = [base_stroke]
    if dot_spec:
        out.extend(dot_strokes(dot_spec, bbox(base_stroke)))
    return out


def build_form(
    family_id: str,
    primitive_id: str,
    dot_spec: Optional[str],
    canonical_for_position: Dict[Tuple[str, str], List[List[float]]],
    position: str,
    fallback_to_isolated: bool = True,
) -> Optional[List[List[List[float]]]]:
    """Build one (family, position) form by:
      1. Looking up the position-specific canonical for the primitive.
      2. Falling back to the isolated canonical if the position is
         under-represented (configurable).
      3. Normalizing direction.
      4. Normalizing to the viewBox.
      5. Adding bbox-relative dots if the family has a dot pattern.
    """
    raw = canonical_for_position.get((primitive_id, position))
    if raw is None and fallback_to_isolated and position != "isolated":
        raw = canonical_for_position.get((primitive_id, "isolated"))
    if raw is None:
        return None
    norm = normalize_direction(normalize_single(raw), primitive_id)
    base_stroke = resample(norm)
    out = [base_stroke]
    if dot_spec:
        out.extend(dot_strokes(dot_spec, bbox(base_stroke)))
    return out


# ============================================================
# Main
# ============================================================


def main() -> None:
    samples = load_samples()
    print(f"Loaded {len(samples)} Calliar samples")
    grouped = collect_positional(samples)
    print(f"Position-tagged primitive groups: {len(grouped)}")
    # Distribution print — see which positions are well-represented.
    by_pid: Dict[str, Dict[str, int]] = {}
    for (pid, pos), trajs in grouped.items():
        by_pid.setdefault(pid, {})[pos] = len(trajs)
    for pid in sorted(by_pid):
        counts = by_pid[pid]
        line = " ".join(f"{pos}={counts.get(pos,0)}" for pos in ("isolated", "initial", "medial", "final"))
        print(f"  {pid!r}: {line}")

    canonical: Dict[Tuple[str, str], List[List[float]]] = {}
    for (pid, pos), candidates in grouped.items():
        chosen = choose_canonical(candidates, pid)
        if chosen is None:
            continue
        canonical[(pid, pos)] = chosen

    # Variants for ISOLATED position only — 3 different calligraphers'
    # interpretations spread across the aspect distribution. The
    # canonical pick is the middle variant; the runtime can offer the
    # other two as "see how others draw it". For primitives with very
    # few isolated samples, choose_variants returns fewer picks
    # (or none) and we just skip variants for that letter.
    variants_by_pid: Dict[str, List[List[List[float]]]] = {}
    for pid in {pid for (pid, pos) in grouped.keys() if pos == "isolated"}:
        candidates = grouped.get((pid, "isolated"), [])
        picks = choose_variants(candidates, pid, n_variants=3)
        if picks:
            variants_by_pid[pid] = picks

    # Build per-position recipes for the simple template letters.
    out_entries: Dict[str, dict] = {}
    for family_id, (pid, dot_spec, positions) in LETTER_BASE_TEMPLATES.items():
        entry_forms: Dict[str, Dict[str, object]] = {}
        for pos in positions:
            strokes = build_form(family_id, pid, dot_spec, canonical, pos)
            if strokes is None:
                continue
            form_data: Dict[str, object] = {
                "medians": strokes,
                "scoring": "median",
            }
            # Multi-writer variants on ISOLATED form only.
            if pos == "isolated":
                raw_variants = variants_by_pid.get(pid, [])
                if len(raw_variants) >= 2:
                    form_data["variants"] = [
                        compose_strokes_for(pid, dot_spec, v) for v in raw_variants
                    ]
            entry_forms[pos] = form_data
        if not entry_forms:
            continue
        out_entries[family_id] = {"family_id": family_id, "forms": entry_forms}

    # Composite letters (Taa, DHaa) — isolated only, via pair extraction.
    for family_id, (pa, pb, dot_spec, positions) in COMPOSITE_TEMPLATES.items():
        pair = find_canonical_pair(samples, pa, pb)
        if pair is None:
            continue
        out_strokes = list(pair)
        if dot_spec:
            all_pts = [p for s in pair for p in s]
            out_strokes.extend(dot_strokes(dot_spec, bbox(all_pts)))
        out_entries[family_id] = {
            "family_id": family_id,
            "forms": {
                "isolated": {
                    "medians": out_strokes,
                    "scoring": "median",
                }
            },
        }

    # Print per-family form coverage.
    print()
    for family_id in sorted(out_entries):
        forms = out_entries[family_id]["forms"]
        line = ",".join(p for p in ("isolated", "initial", "medial", "final") if p in forms)
        print(f"  [{family_id:6s}] forms: {line}")

    out_list = list(out_entries.values())
    OUT_SEED.write_text(json.dumps(out_list, indent=2, ensure_ascii=False) + "\n")
    print(f"\nWrote {len(out_list)} family entries to {OUT_SEED.relative_to(HERE.parent.parent)}")


if __name__ == "__main__":
    main()
