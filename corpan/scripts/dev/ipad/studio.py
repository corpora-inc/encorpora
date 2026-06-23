#!/usr/bin/env python3
"""
Corpán capture studio — build helpers for turning iPad screen recordings (and
screenshots) into mastered, campaign-ready videos and ad images.

This module is the reusable toolbox; callers import the functions or use the
`music` subcommand. Pairs with the committed infra/captures tooling
(build-capture.sh, mix-bgm.py) and the YouTube CLI.

Key capabilities:
- blur_pad_to(src,out,w,h[,ss,dur])      — video blur-pad to any aspect, optional trim
- build_horizontal(src,out,headline,subs)— 16:9 branded split (app left, panel right)
- blur_pad_image / build_panel_image     — the still-image equivalents (ad assets)
- music_blend_full / music_overlay_silent— lay a music bed (looped), blend or music-only
- rtl=True on the panel builders         — reshape Arabic (joined + bidi) and right-align

Arabic: ffmpeg drawtext has no bidi/shaping, so Arabic must be pre-shaped into
visual order. arabic_visual() shells to a small venv (arabic-reshaper +
python-bidi) and the panels render with font "Geeza Pro".
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[3]  # .../encorpora
CAPTURES = REPO_ROOT / "corpan" / "infra" / "captures"
MIX_BGM = CAPTURES / "mix-bgm.py"
MUSIC_DIR = CAPTURES / "branding" / "music"
LOGO = CAPTURES / "branding" / "channel-watermark.png"
ARABIC_VENV = Path.home() / ".cache" / "corpan-arabic" / "venv"
AR_FONT = "Geeza Pro"          # macOS font with full Arabic glyphs
ALL_VARIANTS = ("long", "shorts", "square", "horizontal", "portrait")


def eprint(*a):
    print(*a, file=sys.stderr, flush=True)


def pmd_python() -> str:
    out = subprocess.run(["pipx", "environment", "--value", "PIPX_LOCAL_VENVS"],
                         capture_output=True, text=True).stdout.strip()
    return str(Path(out) / "pymobiledevice3" / "bin" / "python")


def ffprobe_has_audio(path: Path) -> bool:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a",
                        "-show_entries", "stream=index", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    return bool(r.stdout.strip())


def ffprobe_duration(path: Path) -> float:
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


# ---------------------------------------------------------------- Arabic shaping

def arabic_visual(text: str) -> str:
    """Reshape Arabic logical text into visual order with joined presentation
    forms, so ffmpeg drawtext (which lacks bidi/shaping) renders it correctly.
    Falls back to the raw text if the venv isn't present."""
    py = ARABIC_VENV / "bin" / "python"
    if not py.exists():
        eprint("warn: Arabic venv missing — text may render unshaped")
        return text
    r = subprocess.run([str(py), "-c",
        "import sys,arabic_reshaper;from bidi.algorithm import get_display;"
        "print(get_display(arabic_reshaper.reshape(sys.argv[1])),end='')", text],
        capture_output=True, text=True)
    return r.stdout if r.returncode == 0 and r.stdout else text


def _dt_escape(s: str) -> str:
    s = s.replace("\\", "\\\\")
    for ch in (":", ",", ";", "'", "[", "]"):
        s = s.replace(ch, "\\" + ch)
    return s


# ---------------------------------------------------------------- video blur-pad

def blur_pad_to(src: Path, out: Path, ow: int, oh: int, top_bias: float = 0.5,
                ss: float | None = None, dur: float | None = None) -> None:
    """Blur-pad `src` to ow×oh: content scaled to fit, centered over a blurred,
    zoomed copy. Keeps source audio (optional); cleans range/color; strips
    data/chapters. `ss`/`dur` trim a sub-clip (split a long recording into parts)."""
    fc = (
        "[0:v]scale=in_range=full:out_range=tv,format=yuv420p,split=2[bg][fg];"
        f"[bg]scale={ow}:{oh}:force_original_aspect_ratio=increase,crop={ow}:{oh},boxblur=30:2[bgb];"
        f"[fg]scale={ow}:{oh}:force_original_aspect_ratio=decrease[fgs];"
        f"[bgb][fgs]overlay=x=(W-w)/2:y=(H-h)*{top_bias},setsar=1,format=yuv420p[v]"
    )
    trim = []
    if ss is not None:
        trim += ["-ss", str(ss)]
    if dur is not None:
        trim += ["-t", str(dur)]
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats",
        *trim, "-i", str(src), "-filter_complex", fc, "-map", "[v]", "-map", "0:a?",
        "-c:v", "libx264", "-crf", "19", "-preset", "slow", "-profile:v", "high",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-dn", "-map_chapters", "-1",
        "-movflags", "+faststart", str(out),
    ], check=True)


# ---------------------------------------------------------------- branded split (video)

def _panel_drawtext(headline: str, subs: list[str], ow: int, px: int, rtl: bool,
                    head_y: int, sub0_y: int, head_cap: int, sub_caps: tuple) -> str:
    """Build the comma-chained drawtext list for a panel. rtl → reshape + right-align."""
    margin = 60
    avail = ow - px - margin
    def fit(t, cap):
        return max(16, min(cap, int(avail / (max(1, len(t)) * 0.52))))
    font = AR_FONT if rtl else "Arial"
    def line(t, fs, color):
        t2 = arabic_visual(t) if rtl else t
        x = f"{ow}-text_w-{margin}" if rtl else str(px)   # right-align for RTL
        return f"drawtext=font={font}:text={_dt_escape(t2)}:fontcolor={color}:fontsize={fs}:x={x}:y=%d"
    parts = [("[c2]" + line(headline, fit(headline, head_cap), "white")) % head_y]
    y = sub0_y
    for i, s in enumerate(subs):
        cap = sub_caps[min(i, len(sub_caps) - 1)]
        parts.append(line(s, fit(s, cap), "0xcbbcff" if i == 0 else "0x9181d2") % y)
        y += round(cap * 1.6)
    return ",".join(parts) + ",format=yuv420p[v]"


def build_horizontal(src: Path, out: Path, headline: str, subs: list[str],
                     rtl: bool = False) -> None:
    """16:9 1920×1080 branded split: portrait app on the left, deep-purple panel
    on the right with logo + headline + sublines. Keeps source audio. rtl=True
    reshapes Arabic and right-aligns the text + logo."""
    PX = 1015
    logo_x = f"{1920}-180-60" if rtl else str(PX)  # right-align logo for RTL
    parts = [
        "color=c=0x160a2b:s=1920x1080[bg]",
        "[0:v]scale=-2:1000:in_range=full:out_range=tv,format=yuv420p[fg]",
        "[bg][fg]overlay=x=90:y=40[c1]",
        "[1:v]scale=-1:110[lg]",
        f"[c1][lg]overlay=x={logo_x}:y=180[c2]",
        _panel_drawtext(headline, subs, 1920, PX, rtl, 370, 490, 84, (40, 34)),
    ]
    filt = out.with_suffix(".filter")
    filt.write_text(";".join(parts))
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats",
        "-i", str(src), "-i", str(LOGO), "-filter_complex_script", str(filt),
        "-map", "[v]", "-map", "0:a?",
        "-c:v", "libx264", "-crf", "19", "-preset", "slow", "-profile:v", "high",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-pix_fmt", "yuv420p",
        # -shortest: the panel sits on an infinite lavfi color bg, so without this
        # the [v] stream never ends and ffmpeg encodes forever (runaway). Caps to
        # the source audio length.
        "-c:a", "aac", "-b:a", "192k", "-dn", "-map_chapters", "-1", "-shortest",
        "-movflags", "+faststart", str(out),
    ], check=True)
    filt.unlink(missing_ok=True)


# ---------------------------------------------------------------- still images

def blur_pad_image(src: Path, out: Path, ow: int, oh: int, top_bias: float = 0.5) -> None:
    r = max(8, round(min(ow, oh) / 30))
    fc = (
        "[0:v]split=2[bg][fg];"
        f"[bg]scale={ow}:{oh}:force_original_aspect_ratio=increase,crop={ow}:{oh},boxblur={r}:1[bgb];"
        f"[fg]scale={ow}:{oh}:force_original_aspect_ratio=decrease[fgs];"
        f"[bgb][fgs]overlay=x=(W-w)/2:y=(H-h)*{top_bias}"
    )
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(src), "-filter_complex", fc, "-frames:v", "1", "-q:v", "2", str(out)],
                   check=True)


def build_panel_image(src: Path, out: Path, ow: int, oh: int, headline: str,
                      subs: list[str], src_ar: float = 2064 / 2752, rtl: bool = False) -> None:
    """Branded split as a still: screenshot left, panel right (logo + headline +
    sublines). Geometry scales with the target size. rtl=True → Arabic shaped +
    right-aligned. Outputs a high-quality JPEG."""
    margin = round(oh * 0.045)
    ch = oh - 2 * margin
    cw = round(ch * src_ar)
    px = margin + cw + margin
    avail = ow - px - margin
    logo_h = round(oh * 0.14)
    font = AR_FONT if rtl else "Arial"
    rmargin = round(ow * 0.04)
    def fit(t, cap):
        return max(14, min(cap, int(avail / (max(1, len(t)) * 0.52))))
    def xpos(): return f"{ow}-text_w-{rmargin}" if rtl else str(px)

    logo_x = f"{ow}-{round(logo_h*4)}-{rmargin}" if rtl else str(px)  # rough; logo scaled by height
    head_y = round(oh * 0.46); head_fs = fit(headline, round(oh * 0.105))
    parts = [
        f"color=c=0x160a2b:s={ow}x{oh}[bg]",
        f"[0:v]scale=-1:{ch}[fg]",
        f"[bg][fg]overlay=x={margin}:y=(H-h)/2[c1]",
        f"[1:v]scale=-1:{logo_h}[lg]",
        f"[c1][lg]overlay=x={'W-w-'+str(rmargin) if rtl else px}:y={round(oh*0.30)}[c2]",
    ]
    def line(t, fs, color, y):
        t2 = arabic_visual(t) if rtl else t
        return f"drawtext=font={font}:text={_dt_escape(t2)}:fontcolor={color}:fontsize={fs}:x={xpos()}:y={y}"
    dt = ["[c2]" + line(headline, head_fs, "white", head_y)]
    y = head_y + round(head_fs * 1.5)
    for i, s in enumerate(subs):
        fs = fit(s, round(oh * (0.052 if i == 0 else 0.045)))
        dt.append(line(s, fs, "0xcbbcff" if i == 0 else "0x9181d2", y))
        y += round(fs * 1.6)
    parts.append(",".join(dt))
    filt = out.with_suffix(".filter")
    filt.write_text(";".join(parts))
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-i", str(src), "-i", str(LOGO), "-filter_complex_script", str(filt),
                    "-frames:v", "1", "-q:v", "2", str(out)], check=True)
    filt.unlink(missing_ok=True)


# ---------------------------------------------------------------- music

def resolve_music(spec: str | None) -> Path | None:
    if not spec or spec == "none":
        return None
    p = Path(spec)
    if p.exists():
        return p
    cand = MUSIC_DIR / spec
    return cand if cand.exists() else None


def music_overlay_silent(video: Path, bgm: Path, out: Path) -> None:
    """Music as the only audio (drops source audio), looped + faded, -14 LUFS."""
    dur = ffprobe_duration(video)
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(video), "-stream_loop", "-1", "-i", str(bgm),
        "-filter_complex", "[1:a]afade=t=out:st=%.2f:d=2.5,loudnorm=I=-14:LRA=11:TP=-1.5[a]" % max(0.0, dur - 2.5),
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-dn", "-map_chapters", "-1", "-shortest", "-movflags", "+faststart", str(out),
    ], check=True)


def music_blend_full(video: Path, bgm: Path, out: Path) -> None:
    """Source audio + music both full (no ducking), looped, faded, -14 LUFS."""
    dur = ffprobe_duration(video)
    fc = ("[1:a]afade=t=out:st=%.2f:d=2.5[m];"
          "[0:a][m]amix=inputs=2:duration=first:normalize=0[mix];"
          "[mix]loudnorm=I=-14:LRA=11:TP=-1.5[a]" % max(0.0, dur - 2.5))
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(video), "-stream_loop", "-1", "-i", str(bgm),
        "-filter_complex", fc, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        "-dn", "-map_chapters", "-1", "-shortest", "-movflags", "+faststart", str(out),
    ], check=True)


def cmd_music(args) -> int:
    built = Path(args.built_dir)
    bgm = resolve_music(args.music)
    if not bgm:
        eprint("error: no usable track"); return 2
    variants = [args.only] if args.only else list(ALL_VARIANTS)
    done = []
    for v in variants:
        f = built / f"{v}.mp4"
        if not f.exists():
            continue
        has_audio = ffprobe_has_audio(f)
        mode = args.audio if not (args.audio == "blend" and not has_audio) else "music-only"
        out = built / (f"{v}.{bgm.stem}.mp4" if args.keep else f"{v}.music.mp4")
        eprint(f"==> music → {v}.mp4 ({mode})")
        if mode == "blend" and has_audio:
            music_blend_full(f, bgm, out)
        else:
            music_overlay_silent(f, bgm, out)
        if not args.keep:
            shutil.move(str(out), str(f)); out = f
        done.append(out.name)
    print(json.dumps({"built_dir": str(built), "music": bgm.name, "wrote": done}, indent=2))
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Corpán capture studio (build/music helpers)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    m = sub.add_parser("music", help="apply/swap a track onto built variants")
    m.add_argument("built_dir")
    m.add_argument("music")
    m.add_argument("--audio", default="blend", choices=["blend", "music-only"])
    m.add_argument("--only", help="apply to one variant by name")
    m.add_argument("--keep", action="store_true")
    m.set_defaults(fn=cmd_music)
    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
