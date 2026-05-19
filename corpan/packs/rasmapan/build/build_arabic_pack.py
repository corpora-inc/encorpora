#!/usr/bin/env python3
"""
Build the Rasmapan content pack SQLite from Amiri font outlines and
hand-authored seed JSON. Sister to dja/hanzi_pack/build_hanzi_pack.py.

Outputs corpan/packs/rasmapan/data/arabic.sqlite3 by default.
"""
from __future__ import annotations

import argparse
import glob
import json
import math
import os
import re
import sqlite3
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

# fontTools may live in a brew-isolated site-packages (macOS, when
# installed via `brew install fonttools`). Try a regular import first;
# fall back to discovering the brew bottle's libexec path.
try:
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
except ImportError:
    try:
        prefix = (
            subprocess.check_output(["brew", "--prefix", "fonttools"])
            .decode()
            .strip()
        )
    except Exception:
        prefix = None
    if prefix:
        for libexec_site in glob.glob(
            os.path.join(prefix, "libexec/lib/python*/site-packages")
        ):
            if libexec_site not in sys.path:
                sys.path.insert(0, libexec_site)
    from fontTools.ttLib import TTFont  # noqa: E402
    from fontTools.pens.svgPathPen import SVGPathPen  # noqa: E402


SCHEMA_SQL = """
CREATE TABLE pack_meta(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE arabic_letter(
  id TEXT PRIMARY KEY,
  letter TEXT NOT NULL,
  base_letter TEXT NOT NULL DEFAULT '',
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  unicode TEXT NOT NULL,
  position TEXT NOT NULL,
  family_id TEXT NOT NULL,
  parent_letter_id TEXT,
  connects_before INTEGER NOT NULL DEFAULT 0,
  connects_after INTEGER NOT NULL DEFAULT 0,
  frequency INTEGER,
  tags_json TEXT
);

CREATE INDEX arabic_letter_family ON arabic_letter(family_id);
CREATE INDEX arabic_letter_position ON arabic_letter(position);

CREATE TABLE arabic_letter_writer(
  id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL
);

CREATE TABLE arabic_letter_note(
  letter_id TEXT NOT NULL,
  language_code TEXT NOT NULL,
  summary TEXT NOT NULL,
  PRIMARY KEY(letter_id, language_code)
);

CREATE INDEX arabic_letter_note_language ON arabic_letter_note(language_code);

CREATE TABLE arabic_ligature(
  id TEXT PRIMARY KEY,
  letters_json TEXT NOT NULL,
  position TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE TABLE arabic_word(
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL,
  transliteration TEXT NOT NULL,
  meaning_json TEXT NOT NULL,
  letter_ids_json TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE arabic_lesson(
  id TEXT PRIMARY KEY,
  ord INTEGER NOT NULL,
  type TEXT NOT NULL,
  content_json TEXT NOT NULL
);

CREATE INDEX arabic_lesson_ord ON arabic_lesson(ord);

CREATE TABLE arabic_style(
  id TEXT PRIMARY KEY,
  ord INTEGER NOT NULL,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  sample_image TEXT,
  description_md TEXT NOT NULL,
  description_md_i18n TEXT NOT NULL DEFAULT '{}'
);
"""


# --- Glyph extraction ----------------------------------------------------


def _make_flatten_pen(glyph_set, samples_per_curve: int = 14):
    """Returns a fontTools BasePen-derived pen that flattens curves
    into polylines, with automatic component decomposition.

    Each contour ends up in `pen.contours` as a list of (x, y) tuples
    in raw font-unit coordinate space. The AmiriExtractor then maps
    these through the same affine transform applied to the SVG path
    so polygon points align 1:1 with the outline geometry.
    """
    from fontTools.pens.basePen import BasePen

    class _FlattenPen(BasePen):
        def __init__(self, gs, n):
            super().__init__(gs)
            self.n = n
            self.contours: List[List[Tuple[float, float]]] = []
            self._current: List[Tuple[float, float]] = []

        def _moveTo(self, pt):
            if self._current:
                self.contours.append(self._current)
            self._current = [(float(pt[0]), float(pt[1]))]

        def _lineTo(self, pt):
            self._current.append((float(pt[0]), float(pt[1])))

        def _qCurveToOne(self, pt1, pt2):
            p0 = self._current[-1] if self._current else (0.0, 0.0)
            for k in range(1, self.n + 1):
                t = k / self.n
                x = ((1 - t) ** 2) * p0[0] + 2 * (1 - t) * t * pt1[0] + (t ** 2) * pt2[0]
                y = ((1 - t) ** 2) * p0[1] + 2 * (1 - t) * t * pt1[1] + (t ** 2) * pt2[1]
                self._current.append((x, y))

        def _curveToOne(self, pt1, pt2, pt3):
            p0 = self._current[-1] if self._current else (0.0, 0.0)
            for k in range(1, self.n + 1):
                t = k / self.n
                x = (
                    ((1 - t) ** 3) * p0[0]
                    + 3 * ((1 - t) ** 2) * t * pt1[0]
                    + 3 * (1 - t) * (t ** 2) * pt2[0]
                    + (t ** 3) * pt3[0]
                )
                y = (
                    ((1 - t) ** 3) * p0[1]
                    + 3 * ((1 - t) ** 2) * t * pt1[1]
                    + 3 * (1 - t) * (t ** 2) * pt2[1]
                    + (t ** 3) * pt3[1]
                )
                self._current.append((x, y))

        def _closePath(self):
            if self._current:
                self.contours.append(self._current)
            self._current = []

        def _endPath(self):
            if self._current:
                self.contours.append(self._current)
            self._current = []

    return _FlattenPen(glyph_set, samples_per_curve)


def derive_median_from_polygon(
    polygon: List[List[float]],
    target_samples: int = 28,
) -> List[List[float]]:
    """Derive a centerline-ish median by walking one side of the
    polygon between two extreme vertices, chosen to match Arabic
    Naskh stroke direction.

    Direction picker:
    - **Tall contour** (height > 1.2 × width): the letter is a
      vertical stroke (alif, the stem of laam/kaaf, etc.). Walk
      from topmost vertex to bottommost vertex along the *right*
      edge — Naskh starts vertical letters at the top and writes
      downward, and the rightmost edge is what the eye reads as
      "the spine of the letter".
    - **Wide or roughly-square contour**: bowl/curve like baa,
      taa, siin, miim, haa-body, dots. Walk from rightmost vertex
      to leftmost vertex along the *upper* edge — natural RTL
      Arabic writing direction and matches how a calligrapher
      starts a bowl shape.

    The resulting polyline traces the visible glyph silhouette,
    which is what a learner sees when looking at the static ghost,
    so the animation provably aligns with the outline.

    Resampled to `target_samples` evenly-spaced points so the
    runtime animation is smooth regardless of source discretization.
    """
    if not polygon or len(polygon) < 3:
        return [[float(p[0]), float(p[1])] for p in polygon]
    n = len(polygon)

    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    width = max(xs) - min(xs)
    height = max(ys) - min(ys)

    def _walk(a_idx: int, b_idx: int) -> Tuple[List[List[float]], List[List[float]]]:
        """Return (forward_walk, backward_walk) around the polygon
        from a_idx to b_idx (circular)."""
        fwd, bwd = [], []
        i = a_idx
        while True:
            fwd.append(polygon[i])
            if i == b_idx:
                break
            i = (i + 1) % n
            if len(fwd) > n:
                break
        i = a_idx
        while True:
            bwd.append(polygon[i])
            if i == b_idx:
                break
            i = (i - 1) % n
            if len(bwd) > n:
                break
        return fwd, bwd

    if height > width * 1.2:
        # Tall: walk top vertex → leftmost vertex along the right
        # (max-x) edge. Picking leftmost (not bottommost) as the
        # endpoint matters for hooked letters like laam, raa, kaaf,
        # waaw: their tail tip is the leftmost vertex, not the
        # lowest, and walking through it ensures the median follows
        # the spine all the way through the hook into the tail.
        top_idx = min(range(n), key=lambda i: polygon[i][1])
        end_idx = min(range(n), key=lambda i: polygon[i][0])
        if top_idx == end_idx:
            end_idx = max(range(n), key=lambda i: polygon[i][1])
        if top_idx == end_idx:
            return [[float(p[0]), float(p[1])] for p in polygon[:target_samples]]
        fwd, bwd = _walk(top_idx, end_idx)
        mean_x_f = sum(p[0] for p in fwd) / len(fwd)
        mean_x_b = sum(p[0] for p in bwd) / len(bwd)
        upper = fwd if mean_x_f > mean_x_b else bwd
    else:
        # Wide or square: walk right vertex → left vertex on the
        # top (min-y, since canvas y grows downward) side
        right_idx = max(range(n), key=lambda i: polygon[i][0])
        left_idx = min(range(n), key=lambda i: polygon[i][0])
        if right_idx == left_idx:
            return [[float(p[0]), float(p[1])] for p in polygon[:target_samples]]
        fwd, bwd = _walk(right_idx, left_idx)
        mean_y_f = sum(p[1] for p in fwd) / len(fwd)
        mean_y_b = sum(p[1] for p in bwd) / len(bwd)
        upper = fwd if mean_y_f < mean_y_b else bwd

    # Even-arc-length resample.
    if len(upper) <= 2:
        return [[float(p[0]), float(p[1])] for p in upper]
    seg_lens = [0.0]
    for k in range(1, len(upper)):
        seg_lens.append(
            seg_lens[-1]
            + math.hypot(upper[k][0] - upper[k - 1][0], upper[k][1] - upper[k - 1][1])
        )
    total = seg_lens[-1]
    if total < 1e-3:
        return [[float(upper[0][0]), float(upper[0][1])]]
    n_out = max(4, min(target_samples, len(upper)))
    step = total / (n_out - 1)
    out = [[float(upper[0][0]), float(upper[0][1])]]
    j = 0
    for k in range(1, n_out - 1):
        target_dist = step * k
        while j < len(seg_lens) - 1 and seg_lens[j + 1] < target_dist:
            j += 1
        if j >= len(upper) - 1:
            break
        seg_start = seg_lens[j]
        seg_end = seg_lens[j + 1]
        seg = max(1e-6, seg_end - seg_start)
        t = (target_dist - seg_start) / seg
        x = upper[j][0] + (upper[j + 1][0] - upper[j][0]) * t
        y = upper[j][1] + (upper[j + 1][1] - upper[j][1]) * t
        out.append([float(x), float(y)])
    out.append([float(upper[-1][0]), float(upper[-1][1])])
    return out


def polygon_area(polygon: List[Tuple[float, float]]) -> float:
    """Signed shoelace area; |area| used for size sorting."""
    n = len(polygon)
    if n < 3:
        return 0.0
    s = 0.0
    for i in range(n):
        x0, y0 = polygon[i]
        x1, y1 = polygon[(i + 1) % n]
        s += x0 * y1 - x1 * y0
    return abs(s) / 2.0


@dataclass
class GlyphData:
    outline_paths: List[str]  # one SVG `d` string per contour
    medians: List[List[List[float]]]  # one polyline per stroke
    bbox: Tuple[float, float, float, float]  # xmin, ymin, xmax, ymax in 0..1000
    # Flattened polygon vertices per contour, same order as outline_paths
    # (largest contour first). In the same 0..1000 viewBox coord space
    # as outline_paths. Consumed by the Calliar outline-masking pipeline
    # to mask recorded strokes against the canonical letter shape.
    polygons: List[List[List[float]]] = None  # type: ignore[assignment]


class AmiriExtractor:
    """Pulls glyph outlines from Amiri-Regular.ttf and normalizes them
    to a 1000×1000 viewBox with origin at top-left (y flipped from the
    font's bottom-up convention)."""

    VIEWBOX = 1000.0

    def __init__(self, ttf_path: Path) -> None:
        self.font = TTFont(str(ttf_path))
        self.cmap = self.font.getBestCmap()
        self.glyph_set = self.font.getGlyphSet()
        head = self.font["head"]
        self.em = float(head.unitsPerEm)
        # We center the glyph in the viewBox horizontally and place the
        # baseline at ~80% down so descenders have room.
        os2 = self.font["OS/2"]
        self.ascent = float(os2.sTypoAscender)
        self.descent = float(os2.sTypoDescender)
        self.line_height = self.ascent - self.descent  # positive
        # Use a generous baseline placement.
        self.baseline_y_frac = 0.78

    def has_glyph(self, codepoint: int) -> bool:
        return codepoint in self.cmap

    def extract(self, codepoint: int) -> Optional[GlyphData]:
        if codepoint not in self.cmap:
            return None
        glyph_name = self.cmap[codepoint]
        glyph = self.glyph_set[glyph_name]

        pen = SVGPathPen(self.glyph_set)
        glyph.draw(pen)
        raw_d = pen.getCommands()
        if not raw_d:
            return None

        # Also capture flattened polygons via FlattenPen so we can
        # derive medians directly from the *same* outline geometry.
        flatten_pen = _make_flatten_pen(self.glyph_set, samples_per_curve=14)
        glyph.draw(flatten_pen)
        raw_polygons = flatten_pen.contours

        # Glyph advance width (font units, baseline-relative coords).
        hmtx = self.font["hmtx"]
        adv_width, _lsb = hmtx[glyph_name]

        # Transform: scale to viewBox, flip y (font is bottom-up, SVG
        # in our viewBox is top-down), translate so glyph is centered
        # horizontally and baseline sits at baseline_y_frac.
        scale = self.VIEWBOX / self.line_height * 0.78
        # Recenter horizontally: glyph x range is [0, adv_width].
        # We want center at VIEWBOX/2.
        glyph_center_x = adv_width / 2.0
        tx = self.VIEWBOX / 2.0 - glyph_center_x * scale
        baseline_y_view = self.VIEWBOX * self.baseline_y_frac
        # In font coords y goes up; in our view y goes down. To map
        # font_y to view_y: view_y = baseline_y_view - font_y * scale
        ty = baseline_y_view

        d = self._transform_svg_path(raw_d, scale, tx, ty)
        contours = self._split_contours(d)
        if not contours:
            return None

        # Compute bbox in viewBox coords.
        bbox = self._bbox(contours)

        # Sort contours by area descending so the largest (the main
        # glyph body) renders first. This matches Arabic writing
        # order: write the body, then add the dots.
        contours_areas = [(c, self._contour_area(c)) for c in contours]
        contours_areas.sort(key=lambda pair: pair[1], reverse=True)
        sorted_contours = [c for c, _ in contours_areas]

        # Project FlattenPen polygons into the same viewBox coordinate
        # space as `sorted_contours`, sorted to match the same order
        # so polygon[i] corresponds to outline contour[i].
        view_polygons: List[List[List[float]]] = []
        for poly in raw_polygons:
            if not poly:
                continue
            vp = []
            for (fx, fy) in poly:
                vx = fx * scale + tx
                vy = -fy * scale + ty
                vp.append([vx, vy])
            view_polygons.append(vp)
        view_polygons.sort(key=lambda p: polygon_area([(q[0], q[1]) for q in p]), reverse=True)

        medians = []
        for i, _c in enumerate(sorted_contours):
            if i >= len(view_polygons):
                break
            poly = view_polygons[i]
            median = derive_median_from_polygon(poly, target_samples=28)
            if not median or len(median) < 2:
                continue
            median = [[round(p[0], 2), round(p[1], 2)] for p in median]
            medians.append(median)

        return GlyphData(
            outline_paths=sorted_contours,
            medians=medians,
            bbox=bbox,
            polygons=view_polygons,
        )

    # --- helpers ---------------------------------------------------------

    _CMD_RE = re.compile(r"([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)")
    _NUM_RE = re.compile(r"-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?")

    def _transform_svg_path(
        self, d: str, scale: float, tx: float, ty: float
    ) -> str:
        """Apply (x, y) → (x*scale + tx, ty - y*scale) to every coord
        in an SVG path. Handles both absolute and relative commands by
        treating relative-command coordinate pairs as deltas (scale
        only, no translation; and flip the y delta sign)."""
        out: List[str] = []
        for match in self._CMD_RE.finditer(d):
            cmd, body = match.group(1), match.group(2)
            nums = [float(n) for n in self._NUM_RE.findall(body)]
            if not nums:
                out.append(cmd)
                continue
            transformed = self._transform_nums(cmd, nums, scale, tx, ty)
            out.append(cmd + " ".join(f"{v:.2f}" for v in transformed))
        return "".join(out)

    def _transform_nums(
        self,
        cmd: str,
        nums: List[float],
        scale: float,
        tx: float,
        ty: float,
    ) -> List[float]:
        is_relative = cmd.islower()
        # Map command → list of arg names (so we know which slots are
        # x, y, or scalars like H/V/A radii / angle / flags).
        if cmd in ("M", "m", "L", "l", "T", "t"):
            template = ["x", "y"]
        elif cmd in ("H", "h"):
            template = ["x"]
        elif cmd in ("V", "v"):
            template = ["y"]
        elif cmd in ("C", "c"):
            template = ["x", "y", "x", "y", "x", "y"]
        elif cmd in ("S", "s", "Q", "q"):
            template = ["x", "y", "x", "y"]
        elif cmd in ("A", "a"):
            template = ["rx", "ry", "angle", "lflag", "sflag", "x", "y"]
        else:
            return nums

        out: List[float] = []
        i = 0
        while i < len(nums):
            for slot in template:
                if i >= len(nums):
                    break
                v = nums[i]
                if slot == "x":
                    out.append(v * scale + (0 if is_relative else tx))
                elif slot == "y":
                    if is_relative:
                        out.append(-v * scale)
                    else:
                        out.append(ty - v * scale)
                elif slot in ("rx", "ry"):
                    out.append(v * scale)
                else:
                    out.append(v)
                i += 1
        return out

    def _split_contours(self, d: str) -> List[str]:
        """Split a multi-contour `d` string into one `d` per contour.
        Each contour starts at an M/m command."""
        contours: List[str] = []
        current: List[str] = []
        for match in self._CMD_RE.finditer(d):
            cmd = match.group(1)
            body = match.group(2).strip()
            piece = cmd + body
            if cmd in ("M", "m") and current:
                contours.append("".join(current))
                current = []
            current.append(piece)
        if current:
            contours.append("".join(current))
        return contours

    def _all_points(self, d: str) -> List[Tuple[float, float]]:
        pts: List[Tuple[float, float]] = []
        current = (0.0, 0.0)
        start = (0.0, 0.0)
        for match in self._CMD_RE.finditer(d):
            cmd = match.group(1)
            body = match.group(2)
            nums = [float(n) for n in self._NUM_RE.findall(body)]
            is_rel = cmd.islower()
            if cmd in ("M", "m", "L", "l", "T", "t"):
                step = 2
                for i in range(0, len(nums), step):
                    if i + 1 >= len(nums):
                        break
                    x, y = nums[i], nums[i + 1]
                    if is_rel:
                        current = (current[0] + x, current[1] + y)
                    else:
                        current = (x, y)
                    pts.append(current)
                    if cmd in ("M", "m") and i == 0:
                        start = current
            elif cmd in ("H", "h"):
                for x in nums:
                    current = (current[0] + x, current[1]) if is_rel else (x, current[1])
                    pts.append(current)
            elif cmd in ("V", "v"):
                for y in nums:
                    current = (current[0], current[1] + y) if is_rel else (current[0], y)
                    pts.append(current)
            elif cmd in ("C", "c"):
                for i in range(0, len(nums), 6):
                    if i + 5 >= len(nums):
                        break
                    x1, y1, x2, y2, x, y = nums[i:i + 6]
                    if is_rel:
                        pts.append((current[0] + x1, current[1] + y1))
                        pts.append((current[0] + x2, current[1] + y2))
                        current = (current[0] + x, current[1] + y)
                    else:
                        pts.append((x1, y1))
                        pts.append((x2, y2))
                        current = (x, y)
                    pts.append(current)
            elif cmd in ("S", "s", "Q", "q"):
                for i in range(0, len(nums), 4):
                    if i + 3 >= len(nums):
                        break
                    a, b, x, y = nums[i:i + 4]
                    if is_rel:
                        pts.append((current[0] + a, current[1] + b))
                        current = (current[0] + x, current[1] + y)
                    else:
                        pts.append((a, b))
                        current = (x, y)
                    pts.append(current)
            elif cmd in ("A", "a"):
                for i in range(0, len(nums), 7):
                    if i + 6 >= len(nums):
                        break
                    x, y = nums[i + 5], nums[i + 6]
                    if is_rel:
                        current = (current[0] + x, current[1] + y)
                    else:
                        current = (x, y)
                    pts.append(current)
            elif cmd in ("Z", "z"):
                current = start
                pts.append(current)
        return pts

    def _bbox(self, contours: List[str]) -> Tuple[float, float, float, float]:
        xs: List[float] = []
        ys: List[float] = []
        for c in contours:
            for x, y in self._all_points(c):
                xs.append(x)
                ys.append(y)
        if not xs:
            return (0.0, 0.0, 0.0, 0.0)
        return (min(xs), min(ys), max(xs), max(ys))

    def _contour_bbox(self, d: str) -> Tuple[float, float, float, float]:
        pts = self._all_points(d)
        if not pts:
            return (0.0, 0.0, 0.0, 0.0)
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return (min(xs), min(ys), max(xs), max(ys))

    def _contour_area(self, d: str) -> float:
        """Approximate contour area via shoelace on its sampled points."""
        pts = self._all_points(d)
        if len(pts) < 3:
            return 0.0
        s = 0.0
        for i in range(len(pts)):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % len(pts)]
            s += x1 * y2 - x2 * y1
        return abs(s) / 2.0


# --- Builder -------------------------------------------------------------

def load_json(path: Path) -> Any:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def refit_medians_to_outline_bbox(
    medians: List[List[List[float]]],
    outline_bbox: Tuple[float, float, float, float],
) -> List[List[List[float]]]:
    """Scale + translate `medians` so their COMBINED bbox fits inside
    the given outline_bbox (preserving aspect ratio, centered).

    This is the alignment step that makes the stroke-order animation
    overlay the visible Amiri glyph instead of floating across the
    whole viewBox. Calliar's primitive trajectories are normalized to
    fill the viewBox at extraction time; the actual glyph as
    rendered by the trace canvas occupies only the bbox returned by
    fontTools (e.g. baa sits in the lower middle, alif occupies a
    narrow vertical strip). Without this re-fit the animation traces
    "alif"-shaped paths through air, not on top of the ghost outline
    the user is trying to copy.

    Dots and base strokes scale and translate together so their
    relative spatial relationship survives.
    """
    if not medians or not outline_bbox or len(outline_bbox) != 4:
        return medians
    all_pts = [p for m in medians for p in m if isinstance(p, (list, tuple)) and len(p) >= 2]
    if not all_pts:
        return medians
    m_x0 = min(p[0] for p in all_pts)
    m_y0 = min(p[1] for p in all_pts)
    m_x1 = max(p[0] for p in all_pts)
    m_y1 = max(p[1] for p in all_pts)
    m_w = max(1.0, m_x1 - m_x0)
    m_h = max(1.0, m_y1 - m_y0)
    o_x0, o_y0, o_x1, o_y1 = outline_bbox
    target_w = max(1.0, o_x1 - o_x0)
    target_h = max(1.0, o_y1 - o_y0)
    scale = min(target_w / m_w, target_h / m_h)
    o_cx = (o_x0 + o_x1) / 2.0
    o_cy = (o_y0 + o_y1) / 2.0
    m_cx = (m_x0 + m_x1) / 2.0
    m_cy = (m_y0 + m_y1) / 2.0
    tx = o_cx - m_cx * scale
    ty = o_cy - m_cy * scale
    return [
        [[p[0] * scale + tx, p[1] * scale + ty] for p in stroke]
        for stroke in medians
    ]


def build_glyph_record(
    extractor: AmiriExtractor,
    codepoint_hex: str,
    overrides: Optional[Dict[str, Any]] = None,
    family_id: Optional[str] = None,
    position: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not codepoint_hex:
        return None
    try:
        codepoint = int(codepoint_hex, 16)
    except ValueError:
        return None
    data = extractor.extract(codepoint)
    if not data:
        return None
    strokes = data.outline_paths
    medians = data.medians
    outline_bbox = tuple(data.bbox) if data.bbox else None
    # Try the outline-masked Calliar pipeline first for isolated forms
    # (the primary v0.1 surface). Falls through to data.medians
    # (outline-edge trace) if the masking yields no usable result —
    # e.g. for primitives Calliar doesn't have, or composite letters
    # we haven't wired yet.
    if family_id and position == "isolated" and data.polygons:
        try:
            from masked_medians import compose_masked_medians  # noqa: PLC0415
            masked = compose_masked_medians(family_id, data.polygons)
            if masked:
                medians = masked
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] masked-medians failed for {family_id}: {exc}", file=sys.stderr)
    scoring = "median"
    record = {
        "letter": chr(codepoint),
        "outline": data.outline_paths,
        "strokes": strokes,
        "medians": medians,
        "scoring": scoring,
        "bbox": list(data.bbox),
    }
    return record


POSITION_KEYS = ["isolated", "initial", "medial", "final"]


def main() -> None:
    # build/ lives inside the pack — pack root is one level up, output
    # data file lives at <pack_root>/data/arabic.sqlite3.
    pack_root = Path(__file__).resolve().parents[1]
    here = Path(__file__).resolve().parent

    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--font",
        dest="font",
        type=Path,
        default=here / "vendor" / "Amiri-Regular.ttf",
    )
    ap.add_argument(
        "--out",
        dest="out",
        type=Path,
        default=pack_root / "data" / "arabic.sqlite3",
    )
    ap.add_argument(
        "--seed-dir",
        dest="seed_dir",
        type=Path,
        default=here / "seed",
    )
    args = ap.parse_args()

    font_path = args.font.resolve()
    if not font_path.exists():
        print(f"Font not found: {font_path}", file=sys.stderr)
        sys.exit(1)

    seed_dir = args.seed_dir.resolve()
    letters_seed = load_json(seed_dir / "letters_seed.json")
    stroke_orders_seed = load_json(seed_dir / "stroke_orders_seed.json")
    ligatures_seed = load_json(seed_dir / "ligatures_seed.json")
    words_seed = load_json(seed_dir / "words_seed.json")
    lessons_seed = load_json(seed_dir / "lessons_seed.json")
    styles_seed = load_json(seed_dir / "styles_seed.json")

    if not isinstance(letters_seed, list):
        print("letters_seed.json must be a list", file=sys.stderr)
        sys.exit(1)

    stroke_overrides_by_id: Dict[str, Dict[str, Any]] = {}
    if isinstance(stroke_orders_seed, list):
        for item in stroke_orders_seed:
            if not isinstance(item, dict):
                continue
            family_id = item.get("family_id")
            forms = item.get("forms")
            if not isinstance(family_id, str) or not isinstance(forms, dict):
                continue
            for pos, override in forms.items():
                if not isinstance(override, dict):
                    continue
                glyph_id = f"{family_id}.{pos}" if pos != "isolated" else family_id
                stroke_overrides_by_id[glyph_id] = override

    extractor = AmiriExtractor(font_path)

    out_path = args.out.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()

    conn = sqlite3.connect(str(out_path))
    conn.isolation_level = None
    conn.execute("PRAGMA journal_mode=OFF;")
    conn.execute("PRAGMA synchronous=OFF;")
    conn.execute("PRAGMA temp_store=MEMORY;")
    conn.execute("PRAGMA foreign_keys=OFF;")
    conn.executescript(SCHEMA_SQL)

    now = datetime.now(timezone.utc).isoformat()
    meta_rows = [
        ("schema_version", "1"),
        ("generated_at", now),
        ("font", "Amiri-Regular.ttf (SIL OFL 1.1)"),
    ]
    conn.executemany("INSERT INTO pack_meta(key, value) VALUES(?, ?)", meta_rows)

    conn.execute("BEGIN")

    letter_count = 0
    writer_count = 0
    note_count = 0
    for entry in letters_seed:
        if not isinstance(entry, dict):
            continue
        family_id = entry.get("id")
        if not isinstance(family_id, str):
            continue
        name_ar = entry.get("name_ar", "")
        name_en = entry.get("name_en", "")
        connects_before = 1 if entry.get("connects_before") else 0
        connects_after = 1 if entry.get("connects_after") else 0
        frequency = entry.get("frequency")
        tags = entry.get("tags", [])
        notes = entry.get("notes", {})
        positions: Dict[str, str] = entry.get("positions", {})
        # Family-level base Arabic codepoint (U+0600-U+06FF range) —
        # used at runtime to substring-search the corpus. Without this
        # we'd be searching with the presentation-form codepoint
        # (U+FE-range) which never matches real corpus text.
        base_hex = entry.get("base_unicode", "")
        try:
            base_letter = chr(int(base_hex, 16)) if base_hex else ""
        except (TypeError, ValueError):
            base_letter = ""
        for pos in POSITION_KEYS:
            cp_hex = positions.get(pos)
            if not cp_hex:
                continue
            glyph_id = family_id if pos == "isolated" else f"{family_id}.{pos}"
            override = stroke_overrides_by_id.get(glyph_id)
            record = build_glyph_record(
                extractor, cp_hex, override,
                family_id=family_id, position=pos,
            )
            if not record:
                continue
            parent_id = None if pos == "isolated" else family_id
            conn.execute(
                """
                INSERT INTO arabic_letter(
                  id, letter, base_letter, name_ar, name_en, unicode, position,
                  family_id, parent_letter_id, connects_before,
                  connects_after, frequency, tags_json
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    glyph_id,
                    record["letter"],
                    base_letter,
                    name_ar,
                    name_en,
                    f"U+{cp_hex.upper()}",
                    pos,
                    family_id,
                    parent_id,
                    connects_before,
                    connects_after,
                    frequency,
                    json.dumps(tags, ensure_ascii=False),
                ),
            )
            letter_count += 1
            writer_payload = {
                "letter": record["letter"],
                "outline": record["outline"],
                "strokes": record["strokes"],
                "medians": record["medians"],
                "scoring": record["scoring"],
                "bbox": record["bbox"],
            }
            if "variants" in record:
                writer_payload["variants"] = record["variants"]
            conn.execute(
                "INSERT INTO arabic_letter_writer(id, data_json) VALUES(?, ?)",
                (glyph_id, json.dumps(writer_payload, ensure_ascii=False)),
            )
            writer_count += 1
        # Notes attach to the family (the isolated form's id).
        if isinstance(notes, dict):
            for lang, text in notes.items():
                if not isinstance(text, str) or not text.strip():
                    continue
                conn.execute(
                    """
                    INSERT INTO arabic_letter_note(letter_id, language_code, summary)
                    VALUES(?, ?, ?)
                    """,
                    (family_id, lang, text.strip()),
                )
                note_count += 1

    ligature_count = 0
    if isinstance(ligatures_seed, list):
        for lig in ligatures_seed:
            if not isinstance(lig, dict):
                continue
            lig_id = lig.get("id")
            cp_hex = lig.get("unicode_hex")
            letters_components = lig.get("letters", [])
            position = lig.get("position", "isolated")
            if not isinstance(lig_id, str) or not isinstance(cp_hex, str):
                continue
            record = build_glyph_record(extractor, cp_hex)
            if not record:
                continue
            data_json = {
                "letter": record["letter"],
                "outline": record["outline"],
                "strokes": record["strokes"],
                "medians": record["medians"],
                "scoring": record["scoring"],
                "bbox": record["bbox"],
            }
            conn.execute(
                """
                INSERT INTO arabic_ligature(id, letters_json, position, data_json)
                VALUES(?, ?, ?, ?)
                """,
                (
                    lig_id,
                    json.dumps(letters_components, ensure_ascii=False),
                    position,
                    json.dumps(data_json, ensure_ascii=False),
                ),
            )
            ligature_count += 1

    word_count = 0
    if isinstance(words_seed, list):
        for word in words_seed:
            if not isinstance(word, dict):
                continue
            wid = word.get("id")
            text = word.get("word")
            translit = word.get("transliteration", "")
            meaning = word.get("meaning", {})
            letter_ids = word.get("letter_ids", [])
            difficulty = int(word.get("difficulty", 1))
            if not isinstance(wid, str) or not isinstance(text, str):
                continue
            conn.execute(
                """
                INSERT INTO arabic_word(
                  id, word, transliteration, meaning_json,
                  letter_ids_json, difficulty
                ) VALUES(?, ?, ?, ?, ?, ?)
                """,
                (
                    wid,
                    text,
                    translit,
                    json.dumps(meaning, ensure_ascii=False),
                    json.dumps(letter_ids, ensure_ascii=False),
                    difficulty,
                ),
            )
            word_count += 1

    lesson_count = 0
    if isinstance(lessons_seed, list):
        for i, lesson in enumerate(lessons_seed):
            if not isinstance(lesson, dict):
                continue
            lid = lesson.get("id") or f"lesson-{i + 1:02d}"
            ord_val = int(lesson.get("ord", i + 1))
            ltype = lesson.get("type", "intro")
            content = {
                k: v
                for k, v in lesson.items()
                if k not in ("id", "ord", "type")
            }
            conn.execute(
                """
                INSERT INTO arabic_lesson(id, ord, type, content_json)
                VALUES(?, ?, ?, ?)
                """,
                (
                    lid,
                    ord_val,
                    ltype,
                    json.dumps(content, ensure_ascii=False),
                ),
            )
            lesson_count += 1

    style_count = 0
    if isinstance(styles_seed, list):
        for i, style in enumerate(styles_seed):
            if not isinstance(style, dict):
                continue
            sid = style.get("id")
            if not isinstance(sid, str):
                continue
            # Collect per-language description variants from the `i18n`
            # field; runtime picks the active stack's primary lang from
            # this map and falls back to the English description_md.
            i18n_field = style.get("i18n") or {}
            i18n_map: Dict[str, str] = {}
            if isinstance(i18n_field, dict):
                for lang_code, variant in i18n_field.items():
                    if not isinstance(lang_code, str) or not isinstance(variant, dict):
                        continue
                    desc = variant.get("description_md")
                    if isinstance(desc, str) and desc.strip():
                        i18n_map[lang_code] = desc
            conn.execute(
                """
                INSERT INTO arabic_style(
                  id, ord, name_en, name_ar, sample_image, description_md, description_md_i18n
                ) VALUES(?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sid,
                    int(style.get("ord", i + 1)),
                    style.get("name_en", sid),
                    style.get("name_ar", ""),
                    style.get("sample_image"),
                    style.get("description_md", ""),
                    json.dumps(i18n_map, ensure_ascii=False),
                ),
            )
            style_count += 1

    conn.execute("COMMIT")
    conn.execute("ANALYZE;")
    conn.execute("PRAGMA optimize;")
    conn.execute("VACUUM;")
    conn.close()

    print("== Rasmapan pack DB built ==")
    print(f"Letter rows:    {letter_count}")
    print(f"Writer rows:    {writer_count}")
    print(f"Note rows:      {note_count}")
    print(f"Ligature rows:  {ligature_count}")
    print(f"Word rows:      {word_count}")
    print(f"Lesson rows:    {lesson_count}")
    print(f"Style rows:     {style_count}")
    print(f"Output:         {out_path}")


if __name__ == "__main__":
    main()
