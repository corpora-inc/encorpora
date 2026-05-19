#!/usr/bin/env python3
"""Audit the canonical stroke data per letter.

Renders each letter's medians (from `stroke_orders_seed.json`)
together with its Amiri outline (from `data/arabic.sqlite3`) into an
SVG so a human can eyeball whether the stroke order matches the
glyph. Also runs programmatic quality checks and prints a summary.

Outputs:
  build/vendor/calliar/audit/<family>.svg       one per letter
  build/vendor/calliar/audit/_grid.svg          all 28 in a grid
  stdout                                        per-letter quality flags
"""

import json
import math
import pathlib
import sqlite3
from typing import Dict, List, Optional, Tuple

HERE = pathlib.Path(__file__).resolve().parent
SEED = HERE / "seed" / "stroke_orders_seed.json"
DB = HERE.parent / "data" / "arabic.sqlite3"
OUT_DIR = HERE / "vendor" / "calliar" / "audit"
OUT_DIR.mkdir(exist_ok=True)

VIEWBOX = 1000


def load_seed() -> Dict[str, dict]:
    rows = json.loads(SEED.read_text())
    return {r["family_id"]: r for r in rows if isinstance(r, dict)}


def load_writers(all_positions: bool = False) -> Dict[str, dict]:
    """Read writer outlines + medians for audit visualization. When
    `all_positions=True`, returns every (family, position) glyph
    keyed by its writer id ("baa.initial", "baa.medial", etc.).
    Otherwise just the isolated forms keyed by bare family id."""
    out: Dict[str, dict] = {}
    if not DB.exists():
        return out
    with sqlite3.connect(str(DB)) as cx:
        if all_positions:
            cur = cx.execute("SELECT id, data_json FROM arabic_letter_writer")
        else:
            cur = cx.execute(
                "SELECT id, data_json FROM arabic_letter_writer "
                "WHERE id NOT LIKE '%.%'"
            )
        for wid, blob in cur:
            try:
                out[wid] = json.loads(blob)
            except Exception:  # noqa: BLE001
                continue
    return out


def stroke_color(i: int) -> str:
    # First few are visually distinct, looping after that.
    palette = [
        "#8b6914", "#a07818", "#6b4c2a", "#4a8c3f", "#8b4513",
        "#1a1410", "#c8a96e", "#3d2b1f",
    ]
    return palette[i % len(palette)]


def render_letter_svg(
    family_id: str,
    medians: List[List[List[float]]],
    outline_paths: Optional[List[str]],
    name_ar: str = "",
    name_en: str = "",
) -> str:
    """Build an SVG showing the outline + numbered stroke medians."""
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="-40 -80 {VIEWBOX+80} {VIEWBOX+160}" '
        f'width="280" height="320">',
        # Title above
        f'<text x="{VIEWBOX/2}" y="-30" font-size="44" font-family="Georgia, serif" '
        f'fill="#3d2b1f" text-anchor="middle">{family_id}</text>',
        # Glyph (Arabic name) — small subscript
        f'<text x="{VIEWBOX/2}" y="-5" font-size="22" font-family="serif" '
        f'fill="#8b7355" text-anchor="middle" direction="rtl">{name_ar}</text>',
        # Viewbox frame
        f'<rect x="0" y="0" width="{VIEWBOX}" height="{VIEWBOX}" '
        f'fill="none" stroke="#ede6d6" stroke-width="2"/>',
    ]
    # Amiri outline (fill, faded)
    if outline_paths:
        for d in outline_paths:
            parts.append(
                f'<path d="{d}" fill="rgba(107,76,42,0.18)" '
                f'fill-rule="evenodd"/>'
            )
    # Stroke medians
    for i, m in enumerate(medians):
        color = stroke_color(i)
        if len(m) == 1:
            # Dot
            cx, cy = m[0]
            parts.append(
                f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="14" '
                f'fill="{color}"/>'
            )
            parts.append(
                f'<text x="{cx:.1f}" y="{cy+6:.1f}" font-size="18" '
                f'fill="white" text-anchor="middle">{i+1}</text>'
            )
        else:
            pts = " ".join(f"{p[0]:.1f},{p[1]:.1f}" for p in m)
            parts.append(
                f'<polyline points="{pts}" fill="none" stroke="{color}" '
                f'stroke-width="10" stroke-linecap="round" stroke-linejoin="round" '
                f'opacity="0.85"/>'
            )
            # Start marker (green ring) and end marker (red dot)
            sx, sy = m[0]
            ex, ey = m[-1]
            parts.append(
                f'<circle cx="{sx:.1f}" cy="{sy:.1f}" r="22" '
                f'fill="none" stroke="#4a8c3f" stroke-width="4"/>'
            )
            parts.append(
                f'<text x="{sx:.1f}" y="{sy+7:.1f}" font-size="22" '
                f'fill="#4a8c3f" text-anchor="middle" font-weight="bold">{i+1}</text>'
            )
            parts.append(
                f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="10" '
                f'fill="#8b4513"/>'
            )
    parts.append("</svg>")
    return "\n".join(parts)


def quality_flags(
    family_id: str,
    medians: List[List[List[float]]],
) -> List[str]:
    """Programmatic quality checks. Returns list of warning strings."""
    flags = []
    if not medians:
        return ["EMPTY"]
    # Total content fills a reasonable fraction of the viewBox
    all_pts = [p for s in medians for p in s]
    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    if not xs:
        return ["NO_POINTS"]
    bbw = max(xs) - min(xs)
    bbh = max(ys) - min(ys)
    bbarea = bbw * bbh
    if bbarea < 0.15 * VIEWBOX * VIEWBOX:
        flags.append(f"small-bbox({bbw:.0f}x{bbh:.0f})")
    # First (base) stroke should have enough points and length
    base = medians[0]
    if len(base) < 3:
        flags.append("base-stroke-too-short")
    else:
        L = sum(
            math.hypot(base[i][0]-base[i-1][0], base[i][1]-base[i-1][1])
            for i in range(1, len(base))
        )
        if L < 300:
            flags.append(f"base-path-short(L={L:.0f})")
        # Check for sharp angle reversals — sign of noisy data
        sharp = 0
        for i in range(1, len(base) - 1):
            ax, ay = base[i-1]
            bx, by = base[i]
            cx, cy = base[i+1]
            v1x, v1y = bx - ax, by - ay
            v2x, v2y = cx - bx, cy - by
            n1 = math.hypot(v1x, v1y)
            n2 = math.hypot(v2x, v2y)
            if n1 < 1 or n2 < 1:
                continue
            cosang = (v1x*v2x + v1y*v2y) / (n1*n2)
            cosang = max(-1.0, min(1.0, cosang))
            ang = math.degrees(math.acos(cosang))
            if ang > 100:  # > 100° = a near-reversal kink
                sharp += 1
        if sharp >= 2:
            flags.append(f"sharp-kinks({sharp})")
    return flags


def main() -> None:
    seed = load_seed()
    writers = load_writers()

    cards = []
    print(f"{'family':<8} {'strokes':<8} {'flags'}")
    print("-" * 60)
    for family_id, row in seed.items():
        f = row.get("forms", {}).get("isolated") or {}
        medians = f.get("medians") or []
        writer = writers.get(family_id, {})
        outline = writer.get("outline", [])
        name_ar = writer.get("letter", "")
        svg = render_letter_svg(family_id, medians, outline, name_ar=name_ar)
        (OUT_DIR / f"{family_id}.svg").write_text(svg)
        flags = quality_flags(family_id, medians)
        flag_str = " ".join(flags) if flags else "OK"
        print(f"{family_id:<8} {len(medians):<8} {flag_str}")
        cards.append((family_id, svg))

    # Grid: 7 columns × 4 rows
    cols = 7
    cw = 300
    ch = 340
    rows = (len(cards) + cols - 1) // cols
    grid_w = cols * cw
    grid_h = rows * ch
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'width="{grid_w}" height="{grid_h}" '
        f'viewBox="0 0 {grid_w} {grid_h}" '
        f'style="background:#fbf6ec">',
    ]
    for i, (family_id, _svg) in enumerate(cards):
        x = (i % cols) * cw
        y = (i // cols) * ch
        # Inline-include each card's content by re-rendering at a shifted offset
        f = seed[family_id].get("forms", {}).get("isolated") or {}
        medians = f.get("medians") or []
        writer = writers.get(family_id, {})
        # Scaled-down rendering inside this slot
        parts.append(f'<g transform="translate({x},{y}) scale({cw/360:.4f})">')
        inner = render_letter_svg(family_id, medians, writer.get("outline", []),
                                  name_ar=writer.get("letter", ""))
        # Strip the outer <svg ...> wrapper to inline
        inner_body = inner.split(">", 1)[1].rsplit("<", 1)[0]
        parts.append(inner_body)
        parts.append("</g>")
    parts.append("</svg>")
    grid_svg = "\n".join(parts)
    (OUT_DIR / "_grid.svg").write_text(grid_svg)
    # Also snapshot the grid to a non-gitignored location so it can
    # be committed and reviewed alongside the PR without forcing
    # reviewers to run the audit themselves.
    (HERE / "calliar_stroke_audit.svg").write_text(grid_svg)
    print(f"\nWrote {len(cards)} letter SVGs + grid to {OUT_DIR.relative_to(HERE.parent)}")
    print(f"Snapshotted grid to build/calliar_stroke_audit.svg")


if __name__ == "__main__":
    main()
