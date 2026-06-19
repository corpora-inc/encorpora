#!/usr/bin/env python3
"""
SKY30 promo treatment for Corpán capture videos.

Three building blocks, all aspect-ratio agnostic, used by blitz.py:

  endcard_still(out, w, h, lang)        -> branded SKY30 still (also a standalone ad image)
  endcard_clip(out, w, h, dur, lang)    -> the still animated (slow zoom + fade), silent-audio mp4
  corner_badge(src, out, corner)        -> composite a small "SKY30 · 30% off" chip over footage
  concat_endcard(body, endcard, out)    -> normalize + concat body then endcard (audio-safe)

Brand: panel bg 0x160a2b, code-chip orange #d56a1a (=0xd56a1a), light-purple
0xcbbcff / 0x9181d2, accent purple #a855f7. Squared chips (8px-ish), matching
the in-app design standard. Latin script throughout (id/jv/su are Latin), so
Arial covers it; no bidi/shaping needed (that's the Arabic path in studio.py).

The tagline is the brand pun and stays English by default:
  "Take your language skills to new heights.  The Sky is the limit."
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOGO = HERE / "branding" / "channel-watermark.png"

BG = "0x160a2b"          # deep purple-black panel
ORANGE = "0xd56a1a"      # logo orange — the code chip
WHITE = "white"
LILAC = "0xcbbcff"       # bright lilac (tagline accent)
MUTED = "0x9181d2"       # muted purple (labels / store line)
PURPLE = "0xa855f7"      # accent purple (corner badge box)

F_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
F_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
F_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

# Per-language copy. `code`/`pct` stay literal across languages.
COPY = {
    "en": {
        "label": "Use code",
        "pct": "30% OFF",
        "tag1": "Take your language skills to new heights.",
        "tag2": "The Sky is the limit.",
        "store": "App Store  -  Google Play  -  encorpora.io",
    },
    "id": {
        "label": "Pakai kode",
        "pct": "DISKON 30%",
        "tag1": "Bawa kemampuan bahasamu ke langit.",
        "tag2": "The Sky is the limit.",
        "store": "App Store  -  Google Play  -  encorpora.io",
    },
    "jv": {
        "label": "Gunakake kode",
        "pct": "DISKON 30%",
        "tag1": "Gawa kawasisan basamu menyang langit.",
        "tag2": "The Sky is the limit.",
        "store": "App Store  -  Google Play  -  encorpora.io",
    },
    "su": {
        "label": "Anggo kode",
        "pct": "DISKON 30%",
        "tag1": "Bawa kamampuh basa anjeun ka langit.",
        "tag2": "The Sky is the limit.",
        "store": "App Store  -  Google Play  -  encorpora.io",
    },
}


def eprint(*a):
    print(*a, file=sys.stderr, flush=True)


def _esc(s: str) -> str:
    """Escape text for ffmpeg drawtext (we render with expansion=none)."""
    s = s.replace("\\", "\\\\")
    for ch in (":", ",", ";", "'", "[", "]", "%"):
        s = s.replace(ch, "\\" + ch)
    return s


def _fit(text: str, avail: int, cap: int) -> int:
    """Largest font size (<= cap) that keeps `text` within `avail` px wide."""
    return max(14, min(cap, int(avail / (max(1, len(text)) * 0.56))))


def _dt(text: str, font: str, color: str, fontsize: int, y: int,
        box: str | None = None, boxborderw: int = 0) -> str:
    """One centered drawtext (x = horizontally centered) at absolute y."""
    parts = [
        f"drawtext=fontfile='{font}'",
        f"text={_esc(text)}",
        f"fontcolor={color}",
        f"fontsize={fontsize}",
        "x=(w-text_w)/2",
        f"y={y}",
        "expansion=none",
    ]
    if box:
        parts += [f"box=1:boxcolor={box}:boxborderw={boxborderw}"]
    return ":".join(parts)


def _endcard_layout(w: int, h: int, lang: str):
    """Compute a measured, vertically-centered stack so the layout holds at any
    aspect (tall 9:16 .. wide 16:9). Returns (mark_y, mark_h, drawtext_chain)."""
    c = COPY.get(lang, COPY["en"])
    base = min(w, h)
    avail = int(w * 0.84)

    fs_label = _fit(c["label"], avail, int(base * 0.05))
    fs_code = _fit("SKY30", int(w * 0.62), int(base * 0.17))
    bb = int(base * 0.045)                       # code-chip box padding
    fs_pct = _fit(c["pct"], avail, int(base * 0.085))
    fs_tag1 = _fit(c["tag1"], avail, int(base * 0.052))
    fs_tag2 = _fit(c["tag2"], avail, int(base * 0.052))
    fs_store = _fit(c["store"], avail, int(base * 0.04))
    mark_h = int(base * 0.155)

    lh_label = int(1.2 * fs_label)
    lh_code = fs_code + 2 * bb
    lh_pct = int(1.2 * fs_pct)
    lh_tag1 = int(1.25 * fs_tag1)
    lh_tag2 = int(1.25 * fs_tag2)
    lh_store = int(1.2 * fs_store)

    g = int(base * 0.030)     # standard gap
    gt = int(base * 0.012)    # tight gap (tag1 -> tag2)
    G = int(base * 0.055)     # big gap (around tagline / store)

    total = (mark_h + g + lh_label + g + lh_code + g + lh_pct
             + G + lh_tag1 + gt + lh_tag2 + G + lh_store)
    top = max(int(h * 0.03), (h - total) // 2)

    y = top
    mark_y = y;                 y += mark_h + g
    y_label = y;                y += lh_label + g
    y_code = y;                 y += lh_code + g
    y_pct = y;                  y += lh_pct + G
    y_tag1 = y;                 y += lh_tag1 + gt
    y_tag2 = y;                 y += lh_tag2 + G
    y_store = y

    chain = ",".join([
        _dt(c["label"], F_REG, MUTED, fs_label, y_label),
        _dt("SKY30", F_BLACK, BG, fs_code, y_code + bb, box=ORANGE, boxborderw=bb),
        _dt(c["pct"], F_BOLD, WHITE, fs_pct, y_pct),
        _dt(c["tag1"], F_BOLD, WHITE, fs_tag1, y_tag1),
        _dt(c["tag2"], F_BOLD, LILAC, fs_tag2, y_tag2),
        _dt(c["store"], F_REG, MUTED, fs_store, y_store),
    ])
    return mark_y, mark_h, chain


def endcard_still(out: Path, w: int, h: int, lang: str = "en") -> None:
    """Render the branded SKY30 endcard as a still PNG (w×h)."""
    mark_y, mark_h, chain = _endcard_layout(w, h, lang)
    fc = (
        f"color=c={BG}:s={w}x{h}[bg];"
        f"[1:v]scale=-1:{mark_h}[mk];"
        f"[bg][mk]overlay=x=(W-w)/2:y={mark_y}[c];"
        f"[c]{chain}[v]"
    )
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-f", "lavfi", "-i", f"color=c={BG}:s={w}x{h}",
        "-i", str(LOGO),
        "-filter_complex", fc, "-map", "[v]", "-frames:v", "1", "-q:v", "2", str(out),
    ], check=True)


def endcard_clip(out: Path, w: int, h: int, dur: float = 3.5, lang: str = "en",
                 fps: int = 30) -> None:
    """Animated endcard: slow zoom-in + fade in/out, silent stereo audio track
    (so downstream concat is audio-safe). Renders the still first, then animates."""
    frames = max(1, int(round(dur * fps)))
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tf:
        still = Path(tf.name)
    try:
        endcard_still(still, w, h, lang)
        zinc = 0.06 / frames  # 1.00 -> ~1.06 over the clip
        vf = (
            f"zoompan=z='min(zoom+{zinc:.6f},1.06)':d={frames}:s={w}x{h}:fps={fps},"
            f"fade=t=in:st=0:d=0.4,fade=t=out:st={max(0.0, dur-0.35):.2f}:d=0.35,"
            "format=yuv420p"
        )
        subprocess.run([
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-loop", "1", "-i", str(still),
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-t", f"{dur}", "-vf", vf,
            "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-profile:v", "high",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest",
            "-movflags", "+faststart", str(out),
        ], check=True)
    finally:
        still.unlink(missing_ok=True)


# Premium "glass" SKY30 badge: a rounded translucent plate with a hairline
# lilac outline, soft drop shadow, Helvetica Neue with letter-spacing, and an
# orange accent on the discount. Rendered once with ImageMagick and reused.
BADGE_PNG = HERE / "branding" / "sky30-badge.png"
HELV_NEUE = "/System/Library/Fonts/HelveticaNeue.ttc"


def build_badge_png(out: Path = BADGE_PNG, fill: str = "rgba(14,9,28,0.52)",
                    force: bool = False, shadow: bool = True) -> Path:
    """Render the glass SKY30 badge (transparent PNG). Idempotent — only builds
    if missing (unless force). Composites letter-spaced 'SKY30 · 30% OFF' onto a
    rounded glass plate with hairline border + soft shadow. `fill` sets the plate
    alpha — use a low alpha for a 'glass face' that lets a lens blur show through."""
    if out.exists() and not force:
        return out
    import tempfile as _tf
    work = Path(_tf.mkdtemp(prefix="sky30badge-"))
    try:
        def mg(*a):
            subprocess.run(["magick", *a], check=True, cwd=work)
        # text segments
        mg("-background", "none", "-font", HELV_NEUE, "-fill", "white",
           "-pointsize", "60", "-kerning", "6", "label:SKY30", "s1.png")
        mg("-background", "none", "-font", HELV_NEUE, "-fill", "#8f7fc8",
           "-pointsize", "50", "label:·", "s2.png")
        mg("-background", "none", "-font", HELV_NEUE, "-fill", "#f0973a",
           "-pointsize", "40", "-kerning", "3", "label:30% OFF", "s3.png")
        hs = subprocess.run(["magick", "identify", "-format", "%h\n", "s1.png", "s2.png", "s3.png"],
                            capture_output=True, text=True, cwd=work).stdout.split()
        H = max(int(x) for x in hs)
        # spacer must be FULL height + transparent, and `-background none` MUST
        # precede `+append` — otherwise +append vertically pads the thin spacers
        # with the default BLACK background → dark bars flanking the dot.
        mg("-size", f"22x{H}", "xc:none", "sp.png")
        for f in ("s1", "s2", "s3"):
            mg(f"{f}.png", "-background", "none", "-gravity", "center", "-extent", f"x{H}", f"{f}e.png")
        mg("-background", "none", "s1e.png", "sp.png", "s2e.png", "sp.png", "s3e.png", "+append", "txt.png")
        tw, th = (int(x) for x in subprocess.run(["magick", "identify", "-format", "%w %h", "txt.png"],
                  capture_output=True, text=True, cwd=work).stdout.split())
        padx, pady = 48, 30
        W, Hp = tw + 2 * padx, th + 2 * pady
        R = Hp // 2
        mg("-size", f"{W}x{Hp}", "xc:none",
           "-fill", fill, "-draw", f"roundrectangle 2,2,{W-3},{Hp-3},{R},{R}",
           "-fill", "none", "-stroke", "rgba(214,200,255,0.38)", "-strokewidth", "2",
           "-draw", f"roundrectangle 2,2,{W-3},{Hp-3},{R},{R}", "plate.png")
        mg("plate.png", "txt.png", "-gravity", "center", "-composite", "chip.png")
        # 8-bit RGBA (PNG32) + strip — `-layers merge` defaults to 16-bit, which
        # ffmpeg's PNG decoder rejects ("chunk too big"). Shadow is optional: the
        # floating-lens face skips it so nothing bleeds past the border.
        if shadow:
            mg("chip.png", "(", "+clone", "-background", "black", "-shadow", "55x14+0+7", ")",
               "+swap", "-background", "none", "-layers", "merge", "+repage",
               "-depth", "8", "-strip", f"PNG32:{out}")
        else:
            mg("chip.png", "-depth", "8", "-strip", f"PNG32:{out}")
    finally:
        shutil.rmtree(work, ignore_errors=True)
    return out


def corner_badge(src: Path, out: Path, corner: str = "br") -> None:
    """Overlay the premium glass SKY30 badge in a corner of `src` (keeps audio).
    corner in {tl,tr,bl,br}. Badge scales with the short edge; fades in 0.5s."""
    build_badge_png()
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v",
                        "-show_entries", "stream=width,height", "-of", "csv=p=0", str(src)],
                       capture_output=True, text=True)
    w, h = (int(x) for x in r.stdout.strip().split(","))
    base = min(w, h)
    bw = int(base * 0.30)            # badge width ~30% of short edge (consistent size)
    inset = int(base * 0.045)
    xexpr = f"{inset}" if corner in ("tl", "bl") else f"W-w-{inset}"
    yexpr = f"{inset}" if corner in ("tl", "tr") else f"H-h-{inset}"
    fc = (
        f"[1:v]scale={bw}:-1,format=rgba,fade=t=in:st=0:d=0.5:alpha=1[bdg];"
        f"[0:v][bdg]overlay=x={xexpr}:y={yexpr}:format=auto,format=yuv420p[v]"
    )
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats",
        "-i", str(src), "-loop", "1", "-framerate", "30", "-i", str(BADGE_PNG),
        "-filter_complex", fc, "-map", "[v]", "-map", "0:a?", "-shortest",
        "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-profile:v", "high",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "copy", "-movflags", "+faststart", str(out),
    ], check=True)


LENS_CACHE = HERE / "branding" / "_lens"   # generated masks + glass face


def _lens_mask(cw: int, ch: int) -> Path:
    """Sharp-edged rounded-rect alpha (white on transparent) at cw×ch — clips the
    blurred patch crisply to the pill so the blur never bleeds past the border."""
    LENS_CACHE.mkdir(exist_ok=True)
    out = LENS_CACHE / f"mask_{cw}x{ch}.png"
    if out.exists():
        return out
    r = ch // 2
    subprocess.run(["magick", "-size", f"{cw}x{ch}", "xc:none", "-fill", "white",
                    "-draw", f"roundrectangle 0,0,{cw - 1},{ch - 1},{r},{r}",
                    "-depth", "8", "-strip", f"PNG32:{out}"], check=True)
    return out


def _lens_face() -> Path:
    """Faint-fill, no-shadow glass face (border + text) so the lens shows through
    and nothing extends past the border."""
    return build_badge_png(LENS_CACHE / "face.png", fill="rgba(14,9,28,0.14)", shadow=False)


def floating_lens(src: Path, out: Path, blur: float = 10.0, zoom: float = 1.16) -> None:
    """Float a SKY30 glass lens slowly around the center: the content behind the
    pill is magnified (zoom) + blurred, hard-clipped to the pill border, with the
    glass face (SKY30 · 30% OFF) on top. Drift = two slow out-of-phase sines, so
    it roams without repeating. Fast crop-based path (no per-pixel geq). Keeps audio."""
    LENS_CACHE.mkdir(exist_ok=True)
    w, h = (int(x) for x in subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
         "stream=width,height", "-of", "csv=p=0", str(src)],
        capture_output=True, text=True).stdout.strip().split(","))
    base = min(w, h)
    cw = int(base * 0.42) & ~1
    ch = round(cw * 188 / 614) & ~1
    mask, face = _lens_mask(cw, ch), _lens_face()
    ax, ay = round(0.12 * w), round(0.16 * h)
    zw, zh = round(w * zoom) & ~1, round(h * zoom) & ~1

    def center(wv, hv):  # crop uses in_w/in_h; overlay uses W/H — same numbers
        return (f"({wv}/2+{ax}*sin(2*PI*t/11))", f"({hv}/2+{ay}*sin(2*PI*t/8.5+1.6))")
    ccx, ccy = center("in_w", "in_h")
    ocx, ocy = center("W", "H")
    cpx, cpy = f"'{ccx}-{cw}/2'", f"'{ccy}-{ch}/2'"
    opx, opy = f"'{ocx}-{cw}/2'", f"'{ocy}-{ch}/2'"
    graph = (
        f"[0:v]split=2[base][bg];"
        f"[bg]scale={zw}:{zh},crop={w}:{h},gblur=sigma={blur}[bz];"
        f"[bz]crop={cw}:{ch}:x={cpx}:y={cpy}[patch];"
        f"[patch][1:v]alphamerge[lp];"
        f"[base][lp]overlay=x={opx}:y={opy}:shortest=1[c1];"
        f"[2:v]scale={cw}:{ch}[face];"
        f"[c1][face]overlay=x={opx}:y={opy}:shortest=1,format=yuv420p[v]"
    )
    gf = out.with_suffix(".lens.filter")
    gf.write_text(graph)
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats",
        "-i", str(src), "-loop", "1", "-i", str(mask), "-loop", "1", "-i", str(face),
        "-filter_complex_script", str(gf), "-map", "[v]", "-map", "0:a?", "-shortest",
        "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-profile:v", "high",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "copy", "-movflags", "+faststart", str(out),
    ], check=True)
    gf.unlink(missing_ok=True)


def concat_endcard(body: Path, endcard: Path, out: Path, fps: int = 30) -> None:
    """Concat body then endcard. Normalizes fps/SAR/format + audio (48k stereo)
    so concat is clean even if the body has odd timebase/SAR."""
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v",
                        "-show_entries", "stream=width,height", "-of", "csv=p=0", str(body)],
                       capture_output=True, text=True)
    w, h = (int(x) for x in r.stdout.strip().split(","))
    fc = (
        f"[0:v]fps={fps},scale={w}:{h},setsar=1,format=yuv420p[v0];"
        f"[1:v]fps={fps},scale={w}:{h},setsar=1,format=yuv420p[v1];"
        "[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a0];"
        "[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo[a1];"
        "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]"
    )
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats",
        "-i", str(body), "-i", str(endcard), "-filter_complex", fc,
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-crf", "19", "-preset", "medium", "-profile:v", "high",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart", str(out),
    ], check=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="SKY30 promo treatment (endcard / badge)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    e = sub.add_parser("endcard", help="render endcard still + clip")
    e.add_argument("out", help="output path (.png -> still, .mp4 -> clip)")
    e.add_argument("--w", type=int, default=1080)
    e.add_argument("--h", type=int, default=1920)
    e.add_argument("--dur", type=float, default=3.5)
    e.add_argument("--lang", default="en")

    b = sub.add_parser("badge", help="composite corner badge onto a video")
    b.add_argument("src")
    b.add_argument("out")
    b.add_argument("--corner", default="br", choices=["tl", "tr", "bl", "br"])

    args = ap.parse_args()
    if args.cmd == "endcard":
        out = Path(args.out)
        if out.suffix.lower() == ".png":
            endcard_still(out, args.w, args.h, args.lang)
        else:
            endcard_clip(out, args.w, args.h, args.dur, args.lang)
        print(out)
    elif args.cmd == "badge":
        corner_badge(Path(args.src), Path(args.out), args.corner)
        print(args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
