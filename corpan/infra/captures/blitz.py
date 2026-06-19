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
import hashlib
import json
import os
import random
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
    "cut15":    (1080, 1920, "padfit", 0.25),   # ~15s punchy 9:16 cut; needs --short-window
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


# Music pool for per-variant randomization: the committed beds + the S3-pulled
# instrumental pool on the Desktop (LOCAL_CAPTURES_DIR/music-pool). Each aspect
# ratio of a capture gets a DISTINCT track; the shuffle is seeded by slug so a
# given video is reproducible but different videos draw different sets.
CAPTURES_LOCAL = Path(os.environ.get("LOCAL_CAPTURES_DIR",
                                     Path.home() / "Desktop" / "Corpan Captures"))
AUDIO_EXT = {".m4a", ".mp3", ".wav", ".aac", ".ogg", ".flac"}
# Corpán ORIGINALS ONLY for public ad creatives. Two safe sources:
#   1. the S3 `corpan-beats` pool (every track is a Corpán original) mirrored to
#      LOCAL_CAPTURES_DIR/music-pool, and
#   2. the committed beds whose name carries the `corpan-original` marker.
# Everything else in branding/music (tanpuras = ragajunglism/user, tanz-a-bissel
# = Rose Gross, the pre-1929 PD restorations) is NOT ours — excluded.
BEATS_POOL = CAPTURES_LOCAL / "music-pool"        # corpan-beats mirror (all originals)
COMMITTED_MUSIC = HERE / "branding" / "music"     # only *corpan-original* qualify
ORIGINAL_MARKER = "corpan-original"


def gather_pool() -> list[Path]:
    seen: dict[str, Path] = {}
    if BEATS_POOL.exists():
        for p in sorted(BEATS_POOL.iterdir()):
            if p.suffix.lower() in AUDIO_EXT:
                seen.setdefault(p.stem.lower(), p)
    if COMMITTED_MUSIC.exists():
        for p in sorted(COMMITTED_MUSIC.iterdir()):
            if p.suffix.lower() in AUDIO_EXT and ORIGINAL_MARKER in p.stem.lower():
                seen.setdefault(p.stem.lower(), p)
    return list(seen.values())


# Tracks pulled from the auto-pool because the source bed itself has audible
# white noise / hiss (not a mix artifact). Kept OUT of shipped creatives.
BLOCKED_TRACKS = {"scholar-acoustic-inst", "competence-instrumental-184"}


def assign_music(slug: str, names: list[str], spec: str) -> dict:
    """Map each variant name -> a track. spec=='auto' shuffles the pool seeded by
    slug and hands each variant a distinct track. Otherwise pin one track to all.
    Blocked (hissy) tracks are swapped for a clean alternate WITHOUT disturbing
    any other variant's pick (so prior music choices stay stable)."""
    if spec and spec != "auto":
        one = studio.resolve_music(spec)
        return {n: one for n in names}
    pool = gather_pool()
    if not pool:
        return {n: studio.resolve_music(MUSIC_DEFAULT) for n in names}
    seed = int(hashlib.md5(slug.encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    rng.shuffle(pool)                       # full pool → indices stay stable
    amap = {n: pool[i % len(pool)] for i, n in enumerate(names)}

    def blocked(p):
        return p.stem.lower() in BLOCKED_TRACKS

    if any(blocked(p) for p in amap.values()):
        used = {p.stem.lower() for p in amap.values() if not blocked(p)}
        alts = [p for p in pool if not blocked(p) and p.stem.lower() not in used]
        ai = 0
        for n in names:
            if blocked(amap[n]):
                pick = alts[ai] if ai < len(alts) else next(p for p in pool if not blocked(p))
                amap[n] = pick
                used.add(pick.stem.lower())
                ai += 1
    return amap


# Badge techniques to A/B across the campaign. "lens" = floating glass lens
# (blur+magnify, roams center); "glass" = the static premium glass corner chip.
BADGE_STYLES = ["lens", "glass"]


def assign_badge(slug: str, names: list[str], style: str) -> dict:
    """Per-variant badge technique. style in {auto,mix} → balanced shuffle seeded
    by slug (every video a different spread); else pin one style to all."""
    if style and style not in ("auto", "mix"):
        return {n: style for n in names}
    seed = int(hashlib.md5((slug + "|badge").encode()).hexdigest()[:8], 16)
    rng = random.Random(seed)
    deck = (BADGE_STYLES * (len(names) // len(BADGE_STYLES) + 1))[:max(len(names), len(BADGE_STYLES))]
    rng.shuffle(deck)
    return {n: deck[i % len(deck)] for i, n in enumerate(names)}


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


def lay_music(video: Path, bgm: Path, out: Path,
              src_fade: float = 0.25, music_fade_in: float = 1.3) -> None:
    """Mix a looped bed under the source (unducked, both full), then -14 LUFS.
    The bed FADES IN (no abrupt slam) and the source gets a short fade-in so a
    trimmed cut never starts mid-word. Falls back to music-only if no src audio."""
    dur = studio.ffprobe_duration(video)
    fo = max(0.0, dur - 2.5)
    if studio.ffprobe_has_audio(video):
        fc = (f"[1:a]afade=t=in:st=0:d={music_fade_in},afade=t=out:st={fo:.2f}:d=2.5[m];"
              f"[0:a]afade=t=in:st=0:d={src_fade}[s];"
              f"[s][m]amix=inputs=2:duration=first:normalize=0[mix];"
              f"[mix]loudnorm=I=-14:LRA=11:TP=-1.5[a]")
    else:
        fc = (f"[1:a]afade=t=in:st=0:d={music_fade_in},afade=t=out:st={fo:.2f}:d=2.5,"
              f"loudnorm=I=-14:LRA=11:TP=-1.5[a]")
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(video), "-stream_loop", "-1", "-i", str(bgm),
        "-filter_complex", fc, "-map", "0:v", "-map", "[a]",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-dn", "-map_chapters", "-1", "-shortest", "-movflags", "+faststart", str(out),
    ], check=True)


def clean_trim(src: Path, out: Path, ss: float, dur: float | None) -> None:
    """Accurate sub-clip: `-ss`/`-t` AFTER `-i` (output seek) decodes from the
    start so there is NO input-seek audio priming burst. Re-aligns audio PTS and
    re-encodes both streams to a clean full clip starting at 0. Silent sources
    (screen recordings with no audio stream) trim video-only — applying `-af` to
    a missing stream would otherwise fail."""
    has_audio = studio.ffprobe_has_audio(src)
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats",
           "-i", str(src), "-ss", str(ss)]
    if dur is not None:
        cmd += ["-t", str(dur)]
    if has_audio:
        cmd += ["-af", "aresample=48000:async=1:first_pts=0"]
    cmd += [
        "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-profile:v", "high",
        "-pix_fmt", "yuv420p",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    ]
    if has_audio:
        cmd += ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
    else:
        cmd += ["-an"]
    cmd += [
        "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", str(out),
    ]
    subprocess.run(cmd, check=True)


def build_variant(raw: Path, name: str, w: int | None, h: int | None, geom: str,
                  top_bias: float, lang: str, badge: bool, endcard: bool,
                  bgm: Path | None, headline: str, subs: list[str],
                  ss: float | None, dur: float | None, tmp: Path,
                  ec_cache: dict, badge_style: str = "glass") -> Path:
    """Run geometry -> badge -> endcard -> music for one variant, return final path."""
    # A trimmed cut MUST be made with an accurate (output) seek + audio resample,
    # or input-seeking leaves a priming/garbage audio burst at t=0 (the cut15 pop).
    # Pre-trim cleanly once, then geometry runs on a normal full sub-clip.
    src = raw
    if ss is not None or dur is not None:
        src = tmp / f"{name}.pretrim.mp4"
        clean_trim(raw, src, ss or 0.0, dur)

    body = tmp / f"{name}.body.mp4"
    if geom == "horizontal":
        studio.build_horizontal(src, body, headline, subs)
        vw, vh = 1920, 1080
    else:
        vw, vh = (w, h) if w else probe_dims(src)
        studio.blur_pad_to(src, body, vw, vh, top_bias=top_bias)

    stage = body
    if badge:
        badged = tmp / f"{name}.badge.mp4"
        if badge_style == "lens":
            sky30.floating_lens(stage, badged)
        else:
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
        lay_music(stage, bgm, final)     # fades in (no slam), unducked, -14 LUFS
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
    ap.add_argument("--badge-style", default="mix",
                    help="mix|lens|glass — per-variant badge technique (mix = seeded spread)")
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

    subs = [s for s in args.subs.split(";")]
    sw = None
    if args.short_window:
        ss_s, dur_s = args.short_window.split(":")
        sw = (float(ss_s), float(dur_s))

    want = [f.strip() for f in args.formats.split(",") if f.strip() and f.strip() in FORMATS]
    if "cut15" in want and sw is None:
        eprint("error: 'cut15' requires --short-window SS:DUR (e.g. --short-window 8:15)")
        return 2
    src_w, src_h = probe_dims(raw)
    is_portrait = src_h > src_w

    build_list = list(want)
    music_map = assign_music(slug, build_list, args.music)
    badge_map = assign_badge(slug, build_list, args.badge_style)
    eprint(f"==> slug={slug}  built={built}")
    eprint(f"    lang={args.lang} badge={args.badge} endcard={args.endcard} | per-variant style · music:")
    for n in build_list:
        eprint(f"      {n:9s} {badge_map[n]:6s} -> {music_map[n].name if music_map[n] else 'none'}")

    ec_cache: dict = {}
    variants: dict = {}

    for name in build_list:
        w, h, geom, tb = FORMATS[name] if name in FORMATS else (1080, 1920, "padfit", 0.25)
        ss = dur = None
        # The short cut is the only variant trimmed to the requested window.
        if name == "cut15" and sw is not None:
            ss, dur = sw
        # The branded split assumes a portrait app on the left; a landscape
        # source would overrun the panel — blur-pad it into 16:9 instead.
        if name == "wide" and not is_portrait:
            w, h, geom, tb = 1920, 1080, "padfit", 0.5
        # A roaming lens over the branded 16:9 split would drift across the
        # "Corpán" panel/headline — pin that one to the static glass corner.
        if geom == "horizontal" and badge_map[name] == "lens":
            badge_map[name] = "glass"
        tag = "  (landscape blur-pad)" if name == "wide" and not is_portrait else ""
        eprint(f"==> {name}{tag}  [{badge_map[name]} · {music_map[name].name if music_map[name] else 'none'}]")
        final = build_variant(raw, name, w, h, geom, tb, args.lang, args.badge,
                              args.endcard, music_map[name], args.headline, subs,
                              ss, dur, tmp, ec_cache, badge_map[name])
        variants[name] = {"path": final.name, "duration": studio.ffprobe_duration(final),
                          "music": music_map[name].name if music_map[name] else None,
                          "badge": badge_map[name]}

    make_thumb(raw, built / "thumb.jpg")

    # meta.json — start from any prior BUILT meta (so a subset re-render keeps
    # the other variants' records), then overlay the sidecar if present.
    sidecar = raw_dir / f"{slug}.meta.json"
    built_meta = built / "meta.json"
    meta = {}
    if built_meta.exists():
        try:
            meta = json.loads(built_meta.read_text())
        except Exception:
            meta = {}
    if sidecar.exists():
        meta.update(json.loads(sidecar.read_text()))
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
    yt.setdefault("playlist", "Corpán — Indonesia series")  # match the "<Country> series" convention
    yt.setdefault("variant_to_upload", "shorts")
    meta["variants"] = {**meta.get("variants", {}), **variants}  # merge: subset re-renders keep other entries
    meta["sky30"] = {"code": "SKY30", "lang": args.lang,
                     "music": {n: v.get("music") for n, v in variants.items()}}
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
