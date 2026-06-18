#!/usr/bin/env python3
"""
blitz.py — fan ONE raw iPad screen recording into the full campaign variant set.

    blitz.py <raw.mov> [--formats long,shorts,square,portrait,wide]
                       [--music auto|<track>] [--lang en|id|jv|su]
                       [--short-window SS:DUR] [--badge/--no-badge] [--endcard/--no-endcard]
                       [--headline TEXT] [--subs "a;b"]

For each format it runs:  geometry  ->  SKY30 corner badge  ->  SKY30 endcard concat
->  music bed (-14 LUFS).  Outputs land in the standard captures tree
(`built/<date>/<slug>/<variant>.mp4`) with a `meta.json` ready for `corpan-yt upload`.

Variant -> file name (so `corpan-yt upload <dir> --variant <name>` just works):
    long     source-aspect, cleaned        (YouTube watch page)
    shorts   9:16 1080x1920 (<=180s)        (YT Shorts / Reels / TikTok)
    square   1:1  1080x1080                 (feed / Google Ads square)
    portrait 4:5  1080x1350                 (IG feed)
    wide     16:9 1920x1080 branded split   (YT standard / Google Ads in-stream)
    cut15    9:16 1080x1920, ~15s punchy cut (extra short; needs --short-window)

Reuses studio.py (blur_pad_to / build_horizontal / music_*) and sky30.py.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent          # .../corpan/infra/captures
REPO_ROOT = HERE.parents[2]                      # .../encorpora
STUDIO_DIR = REPO_ROOT / "corpan" / "scripts" / "dev" / "ipad"
sys.path.insert(0, str(STUDIO_DIR))
sys.path.insert(0, str(HERE))

import studio  # noqa: E402  blur_pad_to, build_horizontal, music_*, resolve_music, ffprobe_*
import sky30   # noqa: E402  endcard_clip, corner_badge, concat_endcard

MUSIC_DIR = HERE / "branding" / "music"

# Format spec: name -> (w, h, geometry, top_bias). w/h None for `long` (source).
FORMATS = {
    "long":     (None, None, "padfit", 0.5),
    "shorts":   (1080, 1920, "padfit", 0.25),
    "square":   (1080, 1080, "padfit", 0.5),
    "portrait": (1080, 1350, "padfit", 0.5),
    "wide":     (1920, 1080, "horizontal", 0.5),
}
SOCIAL = {"shorts", "square", "portrait"}          # eligible for a 15s cut
BADGE_TL = {"shorts", "cut15", "portrait"}         # top-left (avoid bottom social UI / right rail)

# Content-ID-safe originals first. Mapped by scene keyword in the slug.
MUSIC_BY_VIBE = {
    "beat":   "wild-ride_corpan-original.m4a",
    "music":  "wild-ride_corpan-original.m4a",
    "onboard": "do-you-play-instru_corpan-original.m4a",
    "read":   "fairy-gnomes_corpan-original.m4a",
    "earthgate": "fairy-gnomes_corpan-original.m4a",
    "stargate": "fairy-gnomes_corpan-original.m4a",
    "radio":  "tanz-a-bissel_rose-gross.m4a",
    "game":   "wild-ride_corpan-original.m4a",
    "hover":  "wild-ride_corpan-original.m4a",
    "juice":  "wild-ride_corpan-original.m4a",
    "phraseflip": "do-you-play-instru_corpan-original.m4a",
    "language": "do-you-play-instru_corpan-original.m4a",
}
MUSIC_DEFAULT = "do-you-play-instru_corpan-original.m4a"


def eprint(*a):
    print(*a, file=sys.stderr, flush=True)


def pick_music(slug: str, spec: str) -> Path | None:
    if spec and spec != "auto":
        return studio.resolve_music(spec)
    low = slug.lower()
    for key, track in MUSIC_BY_VIBE.items():
        if key in low:
            return studio.resolve_music(track)
    return studio.resolve_music(MUSIC_DEFAULT)


def probe_dims(p: Path) -> tuple[int, int]:
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v",
                        "-show_entries", "stream=width,height", "-of", "csv=p=0", str(p)],
                       capture_output=True, text=True)
    w, h = (int(x) for x in r.stdout.strip().split(","))
    return w, h


def make_thumb(raw: Path, out: Path) -> None:
    """16:9 blur-padded thumbnail from a non-black early frame."""
    dur = studio.ffprobe_duration(raw)
    ss = max(0.5, min(3.0, dur * 0.1))
    fc = (
        "[0:v]scale=in_range=full:out_range=tv,format=yuv420p,split=2[bg][fg];"
        "[bg]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,boxblur=30:1[bgb];"
        "[fg]scale=-2:720[fgs];[bgb][fgs]overlay=(W-w)/2:(H-h)/2"
    )
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-ss", str(ss), "-i", str(raw), "-frames:v", "1", "-update", "1",
                    "-filter_complex", fc, "-q:v", "2", str(out)], check=True)


def build_variant(raw: Path, name: str, w: int | None, h: int | None, geom: str,
                  top_bias: float, lang: str, badge: bool, endcard: bool,
                  bgm: Path | None, headline: str, subs: list[str],
                  ss: float | None, dur: float | None, tmp: Path,
                  ec_cache: dict) -> Path:
    """Run geometry -> badge -> endcard -> music for one variant, return final path."""
    body = tmp / f"{name}.body.mp4"
    if geom == "horizontal":
        # build_horizontal can't sub-clip; pre-trim if a window was asked.
        src = raw
        if ss is not None or dur is not None:
            src = tmp / f"{name}.pretrim.mp4"
            studio.blur_pad_to(raw, src, *probe_dims(raw), top_bias=0.5, ss=ss, dur=dur)
        studio.build_horizontal(src, body, headline, subs)
        vw, vh = 1920, 1080
    else:
        vw, vh = (w, h) if w else probe_dims(raw)
        studio.blur_pad_to(raw, body, vw, vh, top_bias=top_bias, ss=ss, dur=dur)

    stage = body
    if badge:
        badged = tmp / f"{name}.badge.mp4"
        corner = "tl" if name in BADGE_TL else "br"
        sky30.corner_badge(stage, badged, corner=corner)
        stage = badged

    if endcard:
        key = (vw, vh, lang)
        ec = ec_cache.get(key)
        if ec is None:
            ec = tmp / f"endcard_{vw}x{vh}_{lang}.mp4"
            sky30.endcard_clip(ec, vw, vh, dur=3.5, lang=lang)
            ec_cache[key] = ec
        joined = tmp / f"{name}.joined.mp4"
        sky30.concat_endcard(stage, ec, joined)
        stage = joined

    final = tmp.parent / f"{name}.mp4"   # tmp is <built>/.tmp ; final in <built>
    if bgm:
        if studio.ffprobe_has_audio(stage):
            studio.music_blend_full(stage, bgm, final)
        else:
            studio.music_overlay_silent(stage, bgm, final)
    else:
        final.write_bytes(stage.read_bytes())
    return final


def main() -> int:
    ap = argparse.ArgumentParser(description="Fan one raw capture into all campaign formats")
    ap.add_argument("raw", type=Path)
    ap.add_argument("--formats", default="long,shorts,square,portrait,wide")
    ap.add_argument("--music", default="auto")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--short-window", default=None, help="SS:DUR for a 15s cut (e.g. 8:15)")
    ap.add_argument("--badge", action="store_true", default=True)
    ap.add_argument("--no-badge", dest="badge", action="store_false")
    ap.add_argument("--endcard", action="store_true", default=True)
    ap.add_argument("--no-endcard", dest="endcard", action="store_false")
    ap.add_argument("--headline", default="Corpán")
    ap.add_argument("--subs", default="Pure learning.;The Sky is the limit.")
    ap.add_argument("--keep-tmp", action="store_true", help="keep build intermediates")
    args = ap.parse_args()

    raw = args.raw.resolve()
    if not raw.exists():
        eprint(f"error: not found: {raw}"); return 2

    slug = raw.stem
    raw_dir = raw.parent
    date_dir = raw_dir.name
    captures_root = raw_dir.parent.parent           # strip raw/<date>
    built = captures_root / "built" / date_dir / slug
    tmp = built / ".tmp"
    tmp.mkdir(parents=True, exist_ok=True)

    bgm = pick_music(slug, args.music)
    eprint(f"==> slug={slug}  built={built}")
    eprint(f"    music={bgm.name if bgm else 'none'}  lang={args.lang}  badge={args.badge}  endcard={args.endcard}")

    subs = [s for s in args.subs.split(";")]
    sw = None
    if args.short_window:
        ss_s, dur_s = args.short_window.split(":")
        sw = (float(ss_s), float(dur_s))

    want = [f.strip() for f in args.formats.split(",") if f.strip()]
    ec_cache: dict = {}
    variants: dict = {}

    for name in want:
        if name not in FORMATS:
            eprint(f"warn: unknown format '{name}', skipping"); continue
        w, h, geom, tb = FORMATS[name]
        eprint(f"==> {name}")
        final = build_variant(raw, name, w, h, geom, tb, args.lang, args.badge,
                              args.endcard, bgm, args.headline, subs, None, None, tmp, ec_cache)
        variants[name] = {"path": final.name, "duration": studio.ffprobe_duration(final)}

    # 15s punchy cut (9:16) when a window is given
    if sw and ("shorts" in want or "cut15" in want):
        eprint("==> cut15 (9:16 ~15s)")
        final = build_variant(raw, "cut15", 1080, 1920, "padfit", 0.25, args.lang,
                              args.badge, args.endcard, bgm, args.headline, subs,
                              sw[0], sw[1], tmp, ec_cache)
        variants["cut15"] = {"path": final.name, "duration": studio.ffprobe_duration(final)}

    make_thumb(raw, built / "thumb.jpg")

    # meta.json — merge sidecar if present, else write a stub youtube section
    sidecar = raw_dir / f"{slug}.meta.json"
    meta = {}
    if sidecar.exists():
        meta = json.loads(sidecar.read_text())
    meta.setdefault("slug", slug)
    meta.setdefault("app", "corpan")
    meta.setdefault("captured_at", date_dir)
    yt = meta.setdefault("youtube", {})
    yt.setdefault("title", f"(TITLE — {slug})")
    yt.setdefault("description", "")
    yt.setdefault("tags", ["corpan", "language learning"])
    yt.setdefault("category_id", 27)
    yt.setdefault("privacy", "public")
    yt.setdefault("made_for_kids", False)
    yt.setdefault("playlist", "Corpán — Indonesia")
    yt.setdefault("variant_to_upload", "shorts")
    meta["variants"] = variants
    meta["sky30"] = {"code": "SKY30", "lang": args.lang, "music": bgm.name if bgm else None}
    (built / "meta.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False))

    if not args.keep_tmp:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)

    print(json.dumps({"built": str(built), "variants": list(variants.keys()),
                      "thumb": "thumb.jpg"}, indent=2))
    eprint(f"OK -> {built}")
    eprint("    review locally, then: corpan-yt upload <dir> --variant <name>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
