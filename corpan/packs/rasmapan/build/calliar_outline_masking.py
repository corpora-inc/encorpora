#!/usr/bin/env python3
"""Outline-masked Calliar primitive medians.

Two prior approaches both failed for the rasmapan stroke-order
animations:

1. **Raw Calliar primitives** — Calliar samples are recorded inside
   multi-letter words, so each primitive's trajectory drifts out of
   the isolated letter shape into the connecting tail. baa's recorded
   bowl ended *inside the dot region* in the final composition.

2. **Outline-edge walk** — derive a median by tracing one side of the
   Amiri contour. For narrow shapes (alif) this works because the
   right edge ≈ the centerline. For everything wider the edge runs
   along the perimeter, so the rendered animation's pen trail extends
   half outside the visible glyph.

This module combines the strengths of both:

- Calliar provides the *direction* + *natural curvature* of a
  calligrapher's pen path.
- The Amiri outline polygon provides the *boundary* of the canonical
  isolated-letter shape.

We mask: keep only the portion of each Calliar trajectory that falls
inside the outline polygon. The longest contiguous IN-run is the
canonical-letter portion of that recording; the leading and trailing
OUT runs are connection tails we trim off.

Returns a smoothed, resampled median in the SAME viewBox coordinate
space as the outline polygon — drop-in for `writer.medians`.
"""
from __future__ import annotations

from typing import List, Optional, Sequence, Tuple

import numpy as np
from scipy.signal import savgol_filter
from shapely.geometry import Point, Polygon
from shapely.prepared import prep


Pt = Tuple[float, float]
Stroke = List[List[float]]  # list of [x, y]


def _bbox(pts: np.ndarray) -> Tuple[float, float, float, float]:
    return (
        float(np.min(pts[:, 0])),
        float(np.min(pts[:, 1])),
        float(np.max(pts[:, 0])),
        float(np.max(pts[:, 1])),
    )


def _align_bbox(
    pts: np.ndarray,
    target_bbox: Tuple[float, float, float, float],
    preserve_aspect: bool = False,
) -> np.ndarray:
    """Affine transform (scale + translate) that maps `pts`'s bbox
    onto `target_bbox`. When `preserve_aspect=False` (default), x and
    y axes are scaled independently so the result EXACTLY fills the
    target bbox — important for Arabic letters where Calliar
    candidates' natural aspect rarely matches Amiri's. When True,
    preserves the source aspect ratio and centers the result inside
    the target bbox (used for cheap coverage_score ranking)."""
    sx0, sy0, sx1, sy1 = _bbox(pts)
    tx0, ty0, tx1, ty1 = target_bbox
    src_w = max(sx1 - sx0, 1e-6)
    src_h = max(sy1 - sy0, 1e-6)
    tgt_w = tx1 - tx0
    tgt_h = ty1 - ty0
    if preserve_aspect:
        scale = min(tgt_w / src_w, tgt_h / src_h)
        new_w = src_w * scale
        new_h = src_h * scale
        out_x0 = tx0 + (tgt_w - new_w) / 2.0
        out_y0 = ty0 + (tgt_h - new_h) / 2.0
        out = np.empty_like(pts)
        out[:, 0] = (pts[:, 0] - sx0) * scale + out_x0
        out[:, 1] = (pts[:, 1] - sy0) * scale + out_y0
        return out
    sx = tgt_w / src_w
    sy = tgt_h / src_h
    out = np.empty_like(pts)
    out[:, 0] = (pts[:, 0] - sx0) * sx + tx0
    out[:, 1] = (pts[:, 1] - sy0) * sy + ty0
    return out


def _longest_in_run(in_mask: np.ndarray) -> Tuple[int, int]:
    """Return (start, end_exclusive) indices of the longest run of
    `True` values in `in_mask`. If no True values exist, returns
    (0, 0)."""
    n = len(in_mask)
    best_start = 0
    best_end = 0
    cur_start = -1
    for i in range(n):
        if in_mask[i]:
            if cur_start < 0:
                cur_start = i
            if i - cur_start + 1 > best_end - best_start:
                best_start = cur_start
                best_end = i + 1
        else:
            cur_start = -1
    return best_start, best_end


def _smooth_polyline(pts: np.ndarray, window: int = 7) -> np.ndarray:
    """Savitzky-Golay smoothing — preserves the shape of the curve
    while damping recording jitter. Skips smoothing for short
    polylines that can't accommodate the filter window."""
    if len(pts) < window + 1:
        return pts
    poly = 3 if window >= 5 else 2
    return np.stack(
        [
            savgol_filter(pts[:, 0], window_length=window, polyorder=poly),
            savgol_filter(pts[:, 1], window_length=window, polyorder=poly),
        ],
        axis=1,
    )


def _resample_arc_length(pts: np.ndarray, n_out: int) -> np.ndarray:
    """Resample to `n_out` evenly-spaced points along the arc."""
    if len(pts) <= 1:
        return pts
    diffs = np.diff(pts, axis=0)
    seg_lens = np.sqrt((diffs ** 2).sum(axis=1))
    cum = np.concatenate([[0.0], np.cumsum(seg_lens)])
    total = cum[-1]
    if total < 1e-6:
        return pts[:1]
    target = np.linspace(0.0, total, n_out)
    xs = np.interp(target, cum, pts[:, 0])
    ys = np.interp(target, cum, pts[:, 1])
    return np.stack([xs, ys], axis=1)


def mask_stroke_against_polygon(
    stroke_pts: Sequence[Sequence[float]],
    polygon_pts: Sequence[Sequence[float]],
    polygon_holes: Optional[Sequence[Sequence[Sequence[float]]]] = None,
    margin_ratio: float = 0.0,
    n_out: int = 24,
) -> Optional[List[List[float]]]:
    """Mask a Calliar stroke against an Amiri-outline polygon. Returns
    the canonical-letter portion of the stroke, smoothed and resampled
    to `n_out` points, in the polygon's own coordinate space. Or
    `None` if no contiguous IN-run survives.

    `stroke_pts`: list of [x, y] points (Calliar coord space — pixels).
    `polygon_pts`: list of [x, y] points defining the outline (viewBox
        coord space — same as `writer.outline`'s flattened form).
    `polygon_holes`: optional list of hole rings (for outlines like
        waaw / haa / miim that have closed interior space).
    `margin_ratio`: how much to shrink the polygon inward before the
        IN/OUT test, as a fraction of the polygon's max dimension.
        Slight shrinkage protects against alignment jitter at the
        edges of thin polygons.
    """
    if len(stroke_pts) < 3 or len(polygon_pts) < 3:
        return None

    src = np.asarray(stroke_pts, dtype=float)
    poly_arr = np.asarray(polygon_pts, dtype=float)

    # Build shapely polygon (with holes if provided).
    try:
        holes = (
            [np.asarray(h, dtype=float).tolist() for h in (polygon_holes or [])]
            if polygon_holes
            else None
        )
        polygon = Polygon(poly_arr.tolist(), holes=holes)
        if not polygon.is_valid:
            polygon = polygon.buffer(0)  # repair self-intersections
        if not polygon.is_valid or polygon.is_empty:
            return None
        # Margin: zero by default for independent-axis alignment.
        # The candidate is stretched to exactly fill the outline
        # bbox, so points at the bbox edge are at the polygon edge —
        # an inward shrink would systematically reject them.
        if margin_ratio > 0:
            poly_bbox = polygon.bounds
            min_dim = min(poly_bbox[2] - poly_bbox[0], poly_bbox[3] - poly_bbox[1])
            if min_dim > 0:
                shrunk = polygon.buffer(-margin_ratio * min_dim)
                if not shrunk.is_empty and shrunk.is_valid:
                    polygon = shrunk
    except Exception:
        return None

    target_bbox = polygon.bounds

    # Try a few alignment candidates and pick the one with the longest
    # IN-run. This is more robust than committing to a single
    # bbox-to-bbox mapping, because Calliar primitives often include
    # tails that distort the source bbox.
    candidates_aligned: List[np.ndarray] = []

    # 1) Whole-stroke bbox aligned to outline bbox.
    candidates_aligned.append(_align_bbox(src, target_bbox))

    # 2) Initial-segment bbox aligned (the first ~60% of points,
    #    assumed to be the canonical letter portion before any
    #    trailing connector).
    if len(src) > 12:
        head_n = max(8, int(len(src) * 0.6))
        head_aligned = _align_bbox(src[:head_n], target_bbox)
        # Apply the same affine transform to the rest of the stroke.
        # Derive it from the head alignment.
        sx0, sy0, sx1, sy1 = _bbox(src[:head_n])
        hx0, hy0, hx1, hy1 = _bbox(head_aligned)
        sw = max(sx1 - sx0, 1e-6)
        sh = max(sy1 - sy0, 1e-6)
        scale = min((hx1 - hx0) / sw, (hy1 - hy0) / sh) if (sx1 - sx0) > 0 else 1.0
        full = np.empty_like(src)
        full[:, 0] = (src[:, 0] - sx0) * scale + hx0
        full[:, 1] = (src[:, 1] - sy0) * scale + hy0
        candidates_aligned.append(full)

    best_run: Optional[Tuple[int, int]] = None
    best_pts: Optional[np.ndarray] = None
    prep_poly = prep(polygon)
    for cand in candidates_aligned:
        mask = np.fromiter(
            (prep_poly.contains(Point(p[0], p[1])) for p in cand),
            dtype=bool,
            count=len(cand),
        )
        start, end = _longest_in_run(mask)
        if end - start < 3:
            continue
        if best_run is None or (end - start) > (best_run[1] - best_run[0]):
            best_run = (start, end)
            best_pts = cand

    if best_pts is None or best_run is None:
        return None

    trimmed = best_pts[best_run[0]:best_run[1]]
    if len(trimmed) < 3:
        return None

    smoothed = _smooth_polyline(trimmed)
    resampled = _resample_arc_length(smoothed, n_out)

    return [[float(p[0]), float(p[1])] for p in resampled]


def coverage_score(
    stroke_pts: Sequence[Sequence[float]],
    polygon_pts: Sequence[Sequence[float]],
    polygon_holes: Optional[Sequence[Sequence[Sequence[float]]]] = None,
) -> float:
    """Return the fraction (0..1) of the stroke that falls inside the
    polygon after the best alignment. Used to compare alternative
    Calliar samples for the same primitive: highest coverage wins.

    Cheap version: skips smoothing + resampling. Good for ranking."""
    if len(stroke_pts) < 3 or len(polygon_pts) < 3:
        return 0.0
    src = np.asarray(stroke_pts, dtype=float)
    try:
        polygon = Polygon(
            np.asarray(polygon_pts, dtype=float).tolist(),
            holes=[np.asarray(h, dtype=float).tolist() for h in (polygon_holes or [])]
            if polygon_holes
            else None,
        )
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        if polygon.is_empty:
            return 0.0
    except Exception:
        return 0.0

    aligned = _align_bbox(src, polygon.bounds)
    prep_poly = prep(polygon)
    mask = np.fromiter(
        (prep_poly.contains(Point(p[0], p[1])) for p in aligned),
        dtype=bool,
        count=len(aligned),
    )
    start, end = _longest_in_run(mask)
    return (end - start) / max(len(aligned), 1)


def pick_best_masked_candidate(
    candidates: Sequence[Sequence[Sequence[float]]],
    polygon_pts: Sequence[Sequence[float]],
    polygon_holes: Optional[Sequence[Sequence[Sequence[float]]]] = None,
    min_coverage: float = 0.5,
    n_out: int = 24,
) -> Optional[List[List[float]]]:
    """From a list of Calliar candidates for the same primitive, pick
    the one with the highest in-polygon coverage and return its
    masked + smoothed median. None if no candidate clears
    `min_coverage`."""
    if not candidates:
        return None
    best_score = -1.0
    best_idx = -1
    for i, c in enumerate(candidates):
        s = coverage_score(c, polygon_pts, polygon_holes)
        if s > best_score:
            best_score = s
            best_idx = i
    if best_idx < 0 or best_score < min_coverage:
        return None
    return mask_stroke_against_polygon(
        candidates[best_idx], polygon_pts, polygon_holes, n_out=n_out
    )
