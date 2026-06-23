#!/usr/bin/env python3
"""
Generate Hanzipan avatar candidates — programmatic vector art (no API).

Hanzipan is a premium Mandarin character handwriting studio (stroke guidance,
feedback, infinite contextual examples). The avatar must join the 0.19.0 pack
family (tutomaton / world-radio / juice-squeeze): a single elegant glyph on a
deep-navy radial ground, drawn in the shared orange accent, optionally framed
by concentric rings. Each pack owns one unique secondary highlight:

    juice-squeeze  teal  #4dc4b4
    world-radio    blue  #2a5bea
    hanzipan       SEAL RED #e23b2e   ← cinnabar, the colour of the calligraphy
                                        seal / red ink. Unique in the family and
                                        on-theme for a Mandarin writing studio.

Renders several candidates at 4x then downsamples to 1080x1080 (LANCZOS) for
crisp edges, mirroring the family's exact palette. Pick one, then copy it to
corpan/packs/hanzipan/hanzipan-avatar.png.

    cd corpan/packs/hanzipan && python3 scripts/gen-avatar.py
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PACK_ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = PACK_ROOT / "artwork-candidates"

# ── Shared family palette (sampled from the 0.19.0 avatars) ──────────────
SIZE = 1080
SS = 4  # supersample factor
W = SIZE * SS

BG_CENTER = (37, 44, 56)   # subtle cool-navy core
BG_EDGE = (8, 11, 15)      # near-black corners
ORANGE_HI = (232, 132, 58)  # #e8843a  (top of the stroke gradient)
ORANGE_LO = (204, 103, 31)  # #cc671f  (bottom)
SEAL_RED = (226, 59, 46)    # #e23b2e  Hanzipan's unique highlight

# CJK faces available on macOS.
SONGTI = "/System/Library/Fonts/Supplemental/Songti.ttc"   # elegant serif (Ming)
HEITI = "/System/Library/Fonts/STHeiti Medium.ttc"          # clean modern sans
SONGTI_BLACK = 0   # Songti SC Black
HEITI_MED_SC = 1   # Heiti SC Medium


def radial_bg() -> Image.Image:
    """Deep-navy radial ground matching the family."""
    cr, cg, cb = BG_CENTER
    er, eg, eb = BG_EDGE
    # Per-pixel python is too slow at 4x; build a small gradient and upscale.
    small = 256
    g = Image.new("RGB", (small, small))
    gp = g.load()
    c2 = small / 2
    md = math.hypot(c2, c2)
    for y in range(small):
        for x in range(small):
            t = min(1.0, math.hypot(x - c2, y - c2) / md)
            t = t ** 1.15  # hold the core, fall off toward the corners
            gp[x, y] = (
                round(cr + (er - cr) * t),
                round(cg + (eg - cg) * t),
                round(cb + (eb - cb) * t),
            )
    return g.resize((W, W), Image.LANCZOS)


def orange_gradient(mask: Image.Image) -> Image.Image:
    """Fill a white-on-black mask with the vertical orange stroke gradient."""
    bbox = mask.getbbox()
    grad = Image.new("RGB", (W, W), ORANGE_LO)
    gp = grad.load()
    y0, y1 = (bbox[1], bbox[3]) if bbox else (0, W)
    span = max(1, y1 - y0)
    hr, hg, hb = ORANGE_HI
    lr, lg, lb = ORANGE_LO
    for y in range(W):
        t = min(1.0, max(0.0, (y - y0) / span))
        row = (
            round(hr + (lr - hr) * t),
            round(hg + (lg - hg) * t),
            round(hb + (lb - hb) * t),
        )
        for x in range(0, W, 1):
            gp[x, y] = row
    return grad


def draw_glyph(base: Image.Image, char: str, font_path: str, index: int,
               frac: float = 0.62, dy: float = 0.0) -> None:
    """Stamp `char` centered, filled with the orange gradient."""
    # size the font so the glyph height ~= frac of the canvas
    fs = int(W * frac)
    font = ImageFont.truetype(font_path, fs, index=index)
    mask = Image.new("L", (W, W), 0)
    md = ImageDraw.Draw(mask)
    # Measure and draw with the SAME anchor ("lt") so the ink box is centered
    # on the canvas (the rings' center). Mixing anchors drops the glyph low.
    l, t, r, b = md.textbbox((0, 0), char, font=font, anchor="lt")
    x = W / 2 - (l + (r - l) / 2)
    y = W / 2 + dy * W - (t + (b - t) / 2)
    md.text((x, y), char, font=font, anchor="lt", fill=255)
    grad = orange_gradient(mask)
    base.paste(grad, (0, 0), mask)


def draw_ring(draw: ImageDraw.ImageDraw, r_frac: float, color, width_frac: float,
              alpha: int = 255) -> None:
    r = W * r_frac
    cx = cy = W / 2
    w = max(1, int(W * width_frac))
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color + (alpha,), width=w)


def seal(base: Image.Image, cx_frac: float, cy_frac: float, size_frac: float,
         char: str = "字") -> None:
    """A small cinnabar seal stamp (rounded square + reversed char)."""
    s = int(W * size_frac)
    cx, cy = int(W * cx_frac), int(W * cy_frac)
    tile = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    rad = int(s * 0.16)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=rad,
                        fill=SEAL_RED + (255,))
    # knock the character out of the seal (white reverse)
    font = ImageFont.truetype(SONGTI, int(s * 0.74), index=SONGTI_BLACK)
    bbox = d.textbbox((0, 0), char, font=font, anchor="lt")
    gw, gh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (s - gw) / 2 - bbox[0]
    ty = (s - gh) / 2 - bbox[1]
    cut = Image.new("L", (s, s), 0)
    ImageDraw.Draw(cut).text((tx, ty), char, font=font, fill=255)
    # erase where the char is
    r, g, b, a = tile.split()
    import PIL.ImageChops as ImageChops
    a = ImageChops.subtract(a, cut)
    tile = Image.merge("RGBA", (r, g, b, a))
    base.paste(tile, (cx - s // 2, cy - s // 2), tile)


def mizige(draw: ImageDraw.ImageDraw, r_frac: float, color, alpha: int,
           width_frac: float) -> None:
    """Faint 米字格 practice cross+diagonals inside radius r_frac (dashed)."""
    cx = cy = W / 2
    r = W * r_frac
    w = max(1, int(W * width_frac))
    col = color + (alpha,)
    # cross
    draw.line([cx, cy - r, cx, cy + r], fill=col, width=w)
    draw.line([cx - r, cy, cx + r, cy], fill=col, width=w)
    # diagonals (within the circle)
    d = r / math.sqrt(2)
    draw.line([cx - d, cy - d, cx + d, cy + d], fill=col, width=w)
    draw.line([cx - d, cy + d, cx + d, cy - d], fill=col, width=w)


def finish(img: Image.Image, name: str) -> None:
    out = img.resize((SIZE, SIZE), Image.LANCZOS)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    p = OUT_DIR / f"{name}.png"
    out.save(p)
    print(f"[avatar] {name} -> {p}")


def candidate_zi_song_rings():
    """字 Songti, orange, double ring (orange outer + seal-red inner)."""
    img = radial_bg().convert("RGBA")
    over = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    draw_ring(d, 0.455, ORANGE_LO, 0.0075)
    draw_ring(d, 0.408, SEAL_RED, 0.0050, alpha=235)
    img = Image.alpha_composite(img, over)
    draw_glyph(img, "字", SONGTI, SONGTI_BLACK, frac=0.50)
    finish(img.convert("RGB"), "c1-zi-song-rings")


def candidate_zi_song_seal():
    """字 Songti, orange, with a small cinnabar seal in the corner (no ring)."""
    img = radial_bg().convert("RGBA")
    draw_glyph(img, "字", SONGTI, SONGTI_BLACK, frac=0.58)
    seal(img, 0.715, 0.715, 0.165, char="字")
    finish(img.convert("RGB"), "c2-zi-song-seal")


def candidate_zi_grid():
    """字 over a faint seal-red 米字格 practice grid + single orange ring."""
    img = radial_bg().convert("RGBA")
    over = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    mizige(d, 0.40, SEAL_RED, 70, 0.0028)
    draw_ring(d, 0.452, ORANGE_LO, 0.0072)
    img = Image.alpha_composite(img, over)
    draw_glyph(img, "字", SONGTI, SONGTI_BLACK, frac=0.50)
    finish(img.convert("RGB"), "c3-zi-grid")


def candidate_han_song_rings():
    """汉 (hàn, from 汉字) Songti, orange, double ring."""
    img = radial_bg().convert("RGBA")
    over = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    draw_ring(d, 0.455, ORANGE_LO, 0.0075)
    draw_ring(d, 0.408, SEAL_RED, 0.0050, alpha=235)
    img = Image.alpha_composite(img, over)
    draw_glyph(img, "汉", SONGTI, SONGTI_BLACK, frac=0.50)
    finish(img.convert("RGB"), "c4-han-song-rings")


def candidate_zi_heiti_bare():
    """字 Heiti (clean modern), orange, frameless like tutomaton."""
    img = radial_bg().convert("RGBA")
    draw_glyph(img, "字", HEITI, HEITI_MED_SC, frac=0.60)
    seal(img, 0.70, 0.72, 0.15, char="汉")
    finish(img.convert("RGB"), "c5-zi-heiti-seal")


def candidate_ding_song_rings():
    """鼎 (dǐng, the three-legged ritual cauldron) Songti, double ring."""
    img = radial_bg().convert("RGBA")
    over = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    draw_ring(d, 0.455, ORANGE_LO, 0.0075)
    draw_ring(d, 0.408, SEAL_RED, 0.0050, alpha=235)
    img = Image.alpha_composite(img, over)
    draw_glyph(img, "鼎", SONGTI, SONGTI_BLACK, frac=0.52)
    finish(img.convert("RGB"), "c6-ding-song-rings")


def main() -> None:
    candidate_zi_song_rings()
    candidate_zi_song_seal()
    candidate_zi_grid()
    candidate_han_song_rings()
    candidate_zi_heiti_bare()
    candidate_ding_song_rings()
    print(f"\n[avatar] done. Review {OUT_DIR}/ and copy your pick to "
          f"{PACK_ROOT / 'hanzipan-avatar.png'}")


if __name__ == "__main__":
    main()
