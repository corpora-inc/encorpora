#!/usr/bin/env python3
"""Compose per-letter stroke-order medians by masking Calliar
trajectories against Amiri outlines.

For each isolated-form letter:
  - Look up the canonical primitive that draws the letter body
    (from `extract_calliar_strokes.LETTER_RECIPES`).
  - Pull every Calliar recording of that primitive.
  - Mask each candidate against the letter's body-contour polygon
    (from `AmiriExtractor`'s flattened outline).
  - Pick the candidate with the best in-polygon coverage; trim,
    smooth, resample.
  - Add a single-point dot stroke for each smaller contour, placed
    at that contour's centroid.

The result is the `medians` list for the writer record: body stroke
first (matches classical Naskh "body before dots"), then one stroke
per dot contour. Each stroke is in the same 0..1000 viewBox coord
space as the outline paths.

If no usable Calliar primitive can be found for a letter (low
coverage across all candidates), returns None and the caller should
fall back to the outline-edge approach.
"""
from __future__ import annotations

import functools
import json
import pathlib
from typing import Dict, List, Optional

from calliar_outline_masking import (
    coverage_score,
    mask_stroke_against_polygon,
)

# Import from the existing extractor without changing it.
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from extract_calliar_strokes import (  # noqa: E402
    DIRECTION_RULES,
    LETTER_RECIPES,
    collect_primitive_strokes,
    load_samples,
)


# --- Calliar candidate loading (cached at module level) ---------------


@functools.lru_cache(maxsize=1)
def _primitive_candidates() -> Dict[str, List[List[List[float]]]]:
    """All Calliar candidates per primitive_id. Loaded once per
    build."""
    samples = load_samples()
    return collect_primitive_strokes(samples)


# Map LETTER_RECIPES "primitive:X" step → primitive ID X.
def _primitive_for_family(family_id: str) -> Optional[str]:
    recipe = LETTER_RECIPES.get(family_id)
    if not recipe:
        return None
    for step in recipe:
        if step.startswith("primitive:"):
            return step.split(":", 1)[1]
    return None


# --- Dot-stroke helpers -----------------------------------------------


def _centroid(polygon: List[List[float]]) -> List[float]:
    if not polygon:
        return [500.0, 500.0]
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    return [sum(xs) / len(xs), sum(ys) / len(ys)]


def _dot_median(polygon: List[List[float]]) -> List[List[float]]:
    """A short two-point median that visually reads as a dot when
    animated. Two points roughly along the contour's longer axis so
    the tip-trail draws a small mark, then settles. Single-point
    would render as a pulse (which works too), but a tiny stroke
    feels more like 'placing a dot with a pen'."""
    if not polygon or len(polygon) < 3:
        return [_centroid(polygon)]
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)
    # Quarter of the dot's longest dimension, oriented along the
    # longer axis.
    if width >= height:
        dx = width * 0.18
        return [[cx - dx, cy], [cx + dx, cy]]
    dy = height * 0.18
    return [[cx, cy - dy], [cx, cy + dy]]


# --- Main composer ----------------------------------------------------


def _polygon_bbox(polygon: List[List[float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    return (min(xs), min(ys), max(xs), max(ys))


def _rescale_to_bbox(
    median: List[List[float]],
    target_bbox: tuple[float, float, float, float],
    fill_ratio: float = 0.94,
) -> List[List[float]]:
    """Stretch the masked median to fill the target bbox along each
    axis independently. The IN-run we get from masking is typically
    a fraction of the outline (the Calliar candidate's natural
    aspect rarely matches Amiri's exact proportions). Stretching to
    fill keeps the pen tip traveling the full span of the visible
    glyph instead of trailing through a small region.

    `fill_ratio < 1.0` keeps the median slightly inside the outline
    so a 4-CSS-px pen trail doesn't kiss the edges."""
    if not median:
        return median
    mxs = [p[0] for p in median]
    mys = [p[1] for p in median]
    msx0, msy0 = min(mxs), min(mys)
    msx1, msy1 = max(mxs), max(mys)
    src_w = max(msx1 - msx0, 1e-6)
    src_h = max(msy1 - msy0, 1e-6)
    tx0, ty0, tx1, ty1 = target_bbox
    cx = (tx0 + tx1) / 2.0
    cy = (ty0 + ty1) / 2.0
    new_w = (tx1 - tx0) * fill_ratio
    new_h = (ty1 - ty0) * fill_ratio
    sx = new_w / src_w
    sy = new_h / src_h
    out = []
    for x, y in median:
        nx = cx + (x - (msx0 + msx1) / 2.0) * sx
        ny = cy + (y - (msy0 + msy1) / 2.0) * sy
        out.append([nx, ny])
    return out


def _natural_start_point(
    polygon: List[List[float]],
) -> tuple[float, float]:
    """The polygon vertex closest to the bbox top-right corner. For
    Arabic letters this is the natural starting position a
    calligrapher's pen drops at: the top of an alif/laam stem (which
    sits on the right side of the contour), the upper-right tip of a
    baa-bowl, the top-right of a jiim head, etc. RTL writing starts
    from the upper-right by definition."""
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    tx = max(xs)
    ty = min(ys)
    best = polygon[0]
    best_d = float("inf")
    for p in polygon:
        d = (p[0] - tx) ** 2 + (p[1] - ty) ** 2
        if d < best_d:
            best_d = d
            best = p
    return (float(best[0]), float(best[1]))


def _orient_to_start(
    median: List[List[float]],
    natural_start: tuple[float, float],
) -> List[List[float]]:
    """Reverse the median if its END is closer to the natural start
    than its START. Robust to any direction the Calliar candidate
    happened to be recorded in."""
    if not median or len(median) < 2:
        return median
    sx, sy = natural_start
    start = median[0]
    end = median[-1]
    d_start = (start[0] - sx) ** 2 + (start[1] - sy) ** 2
    d_end = (end[0] - sx) ** 2 + (end[1] - sy) ** 2
    return list(reversed(median)) if d_end < d_start else median


def compose_masked_medians(
    family_id: str,
    polygons: List[List[List[float]]],
) -> Optional[List[List[List[float]]]]:
    """Mask the canonical Calliar primitive against the largest
    polygon, stretch to fill, normalize direction, then emit dot
    medians for the remaining contours.

    Returns the medians list (in 0..1000 viewBox coords) or None if
    masking failed and the caller should fall back."""
    if not polygons:
        return None
    primitive_id = _primitive_for_family(family_id)
    if not primitive_id:
        return None
    candidates = _primitive_candidates().get(primitive_id, [])
    if not candidates:
        return None
    body_polygon = polygons[0]

    # Score every candidate; pick the one with the highest IN-run
    # coverage. We rank cheaply first (coverage_score), then run the
    # full mask + smoothing pipeline only on the winner.
    best_score = -1.0
    best_idx = -1
    for i, cand in enumerate(candidates):
        s = coverage_score(cand, body_polygon)
        if s > best_score:
            best_score = s
            best_idx = i
    if best_idx < 0 or best_score < 0.4:
        return None
    body_median = mask_stroke_against_polygon(
        candidates[best_idx], body_polygon, n_out=24
    )
    if not body_median or len(body_median) < 3:
        return None

    # Orient the median so its first point is closer to the natural
    # RTL starting vertex (the polygon point closest to the bbox's
    # top-right corner). Reverses if Calliar happened to record the
    # candidate in the other direction. We do NOT rescale to fill
    # the outline bbox — the masked median already sits inside the
    # polygon by construction, and stretching it to bbox corners
    # would distort the natural calligraphic shape (e.g., make
    # laam's stem-plus-hook into a diagonal line).
    body_median = _orient_to_start(body_median, _natural_start_point(body_polygon))

    medians: List[List[List[float]]] = [
        [[round(p[0], 2), round(p[1], 2)] for p in body_median]
    ]
    for poly in polygons[1:]:
        dm = _dot_median(poly)
        medians.append([[round(p[0], 2), round(p[1], 2)] for p in dm])
    return medians
