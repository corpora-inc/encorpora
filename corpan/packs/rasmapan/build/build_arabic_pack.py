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

@dataclass
class GlyphData:
    outline_paths: List[str]  # one SVG `d` string per contour
    medians: List[List[List[float]]]  # one polyline per stroke
    bbox: Tuple[float, float, float, float]  # xmin, ymin, xmax, ymax in 0..1000


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

        # Auto-derive medians: one polyline per contour, traversing
        # the contour's bounding box from start to end. For the main
        # body of an Arabic letter we want a right-to-left sweep
        # (that's the writing direction); for dots, a short vertical
        # stroke from top to bottom works.
        medians = []
        for i, c in enumerate(sorted_contours):
            cb = self._contour_bbox(c)
            cx0, cy0, cx1, cy1 = cb
            width = cx1 - cx0
            height = cy1 - cy0
            if i == 0 and width > height * 1.5:
                # Wide horizontal letter body — write right to left.
                mid_y = (cy0 + cy1) / 2.0
                medians.append([
                    [round(cx1, 2), round(mid_y, 2)],
                    [round((cx0 + cx1) / 2.0, 2), round(mid_y, 2)],
                    [round(cx0, 2), round(mid_y, 2)],
                ])
            elif width > height * 1.5:
                # Wide accent — right to left.
                mid_y = (cy0 + cy1) / 2.0
                medians.append([
                    [round(cx1, 2), round(mid_y, 2)],
                    [round(cx0, 2), round(mid_y, 2)],
                ])
            elif height > width * 1.5:
                # Tall — top to bottom.
                mid_x = (cx0 + cx1) / 2.0
                medians.append([
                    [round(mid_x, 2), round(cy0, 2)],
                    [round(mid_x, 2), round(cy1, 2)],
                ])
            else:
                # Roughly square (dot, hamza, small accent): a short
                # diagonal that approximates a dot tap.
                cx = (cx0 + cx1) / 2.0
                cy = (cy0 + cy1) / 2.0
                r = max((cx1 - cx0), (cy1 - cy0)) / 3.0
                medians.append([
                    [round(cx - r, 2), round(cy - r, 2)],
                    [round(cx + r, 2), round(cy + r, 2)],
                ])

        return GlyphData(
            outline_paths=sorted_contours,
            medians=medians,
            bbox=bbox,
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


def build_glyph_record(
    extractor: AmiriExtractor,
    codepoint_hex: str,
    overrides: Optional[Dict[str, Any]] = None,
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
    if overrides:
        if "strokes" in overrides and isinstance(overrides["strokes"], list):
            strokes = overrides["strokes"]
        if "medians" in overrides and isinstance(overrides["medians"], list):
            medians = overrides["medians"]
    scoring = "median" if overrides and overrides.get("scoring") == "median" else "outline"
    return {
        "letter": chr(codepoint),
        "outline": data.outline_paths,
        "strokes": strokes,
        "medians": medians,
        "scoring": scoring,
        "bbox": list(data.bbox),
    }


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
            record = build_glyph_record(extractor, cp_hex, override)
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
