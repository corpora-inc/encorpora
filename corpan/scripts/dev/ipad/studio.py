#!/usr/bin/env python3
"""
Corpán capture studio — turn a scenario into a finished, campaign-ready video.

This is the glue layer SCENARIOS.md roadmap #2 calls for: drive the iPad through
a scripted walkthrough, then assemble the recording into mastered variants
(music bed + sidechain ducking, blur-pad to each aspect) via the existing
`build-capture.sh` / `mix-bgm.py` tooling. Build locally only (no upload here).

Capture path (this iPad): the consumer AVFoundation/QuickTime screen-capture
device is NOT published while the device is held by the pymobiledevice3 developer
tunnel that our CDP driving requires (confirmed: the iPad appears in `usbmux
list` and DVT screenshots, but in NO AVFoundation enumeration). So the recording
itself is iOS Control Center screen recording (the repo's proven path —
build-capture.sh is already tuned for its displaymatrix=-90 / yuvj420p signature)
and we `pull` the .mov off the device afterward. The headless Swift recorder
(record.sh / ipad-record.swift) is kept as the `record-run` path for Macs/devices
where AVFoundation *can* see the device.

Subcommands
-----------
  drive    <scenario.json>            run the walkthrough via CDP (bracket this
                                      with Control Center record on/off); writes
                                      runs/<name>-<ts>/ {report.md, timeline.json}
  pull     [--dest DIR]               pull the newest DCIM video off the device
                                      (the screen recording you just stopped)
  assemble <raw.mov> --scenario S     stage raw + generate sidecar, build-capture
                                      variants, mix the music bed → finished mp4s
  record-run <scenario.json>          AUTO: bracket `drive` with the Swift
                                      recorder (only works where AVFoundation
                                      sees the device — not this tunneled iPad)

Typical Control Center flow (Claude orchestrates):
  1. app on Welcome; you start iOS screen recording, swipe Control Center away
  2. python3 studio.py drive scenarios/id_english_beginner.json
  3. you stop the recording
  4. python3 studio.py pull --dest /tmp/run.mov
  5. python3 studio.py assemble /tmp/run.mov --scenario scenarios/id_english_beginner.json \
       --music fairy-gnomes_corpan-original.m4a --out-root /tmp/studio
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

import scenario as scn_mod  # reuse the battle-tested driver (scenario.run)

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[3]  # .../encorpora
CAPTURES = REPO_ROOT / "corpan" / "infra" / "captures"
BUILD_CAPTURE = CAPTURES / "build-capture.sh"
MIX_BGM = CAPTURES / "mix-bgm.py"
TRIM = CAPTURES / "trim-deadair.py"
MUSIC_DIR = CAPTURES / "branding" / "music"
LOGO = CAPTURES / "branding" / "channel-watermark.png"
TODAY = "2026-06-01"  # Date.now() is unavailable; override with --date.
ALL_VARIANTS = ("long", "shorts", "square", "horizontal")  # video variants music can score


def eprint(*a):
    print(*a, file=sys.stderr, flush=True)


def pmd_python() -> str:
    out = subprocess.run(["pipx", "environment", "--value", "PIPX_LOCAL_VENVS"],
                         capture_output=True, text=True).stdout.strip()
    return str(Path(out) / "pymobiledevice3" / "bin" / "python")


def captures_root() -> Path:
    return Path(os.environ.get("LOCAL_CAPTURES_DIR", str(Path.home() / "Desktop" / "Corpan Captures")))


def ffprobe_has_audio(path: Path) -> bool:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries",
         "stream=index", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True)
    return bool(r.stdout.strip())


def ffprobe_duration(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


# ---------------------------------------------------------------- generic blur-pad to any aspect

def blur_pad_to(src: Path, out: Path, ow: int, oh: int, top_bias: float = 0.5,
                ss: float | None = None, dur: float | None = None) -> None:
    """Blur-pad `src` to ow×oh: the content scaled to fit, centered over a
    blurred, zoomed copy of itself (the standard treatment, generalized from
    build-capture's shorts filter). Keeps the source audio; cleans range/color;
    strips data/chapters. Re-encodes video. `top_bias` 0.25 lifts content toward
    the top (good for 9:16 so platform UI sits on the lower band).
    `ss`/`dur` (seconds) trim a sub-clip — used to split one long recording into
    parts at natural section boundaries."""
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


# ---------------------------------------------------------------- still-image ad sizes

def blur_pad_image(src: Path, out: Path, ow: int, oh: int, top_bias: float = 0.5) -> None:
    """Blur-pad a still image to ow×oh (content fit + centered over a blurred,
    zoomed copy). Outputs a high-quality JPEG. Blur radius scales with the target."""
    r = max(8, round(min(ow, oh) / 30))
    fc = (
        "[0:v]split=2[bg][fg];"
        f"[bg]scale={ow}:{oh}:force_original_aspect_ratio=increase,crop={ow}:{oh},boxblur={r}:1[bgb];"
        f"[fg]scale={ow}:{oh}:force_original_aspect_ratio=decrease[fgs];"
        f"[bgb][fgs]overlay=x=(W-w)/2:y=(H-h)*{top_bias}"
    )
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(src), "-filter_complex", fc, "-frames:v", "1", "-q:v", "2", str(out),
    ], check=True)


def build_panel_image(src: Path, out: Path, ow: int, oh: int, headline: str,
                      sublines: list[str], src_ar: float = 2064 / 2752) -> None:
    """Branded split as a still: screenshot on the left, deep-purple panel on the
    right with logo + headline + sublines. Geometry scales with the target size.
    `src_ar` is the source width/height (default a 3:4 portrait screenshot).
    Outputs a high-quality JPEG."""
    margin = round(oh * 0.045)
    ch = oh - 2 * margin                 # screenshot height
    cw = round(ch * src_ar)              # screenshot width (known portrait aspect)
    px = margin + cw + margin            # left edge of the panel text column
    avail = ow - px - margin
    logo_h = round(oh * 0.14)

    def fit(text: str, cap: int) -> int:
        return max(16, min(cap, int(avail / (max(1, len(text)) * 0.52))))

    logo_y = round(oh * 0.30)
    head_y = round(oh * 0.46)
    head_fs = fit(headline, round(oh * 0.105))
    parts = [
        f"color=c=0x160a2b:s={ow}x{oh}[bg]",
        f"[0:v]scale=-1:{ch}[fg]",
        f"[bg][fg]overlay=x={margin}:y=(H-h)/2[c1]",
        f"[1:v]scale=-1:{logo_h}[lg]",
        f"[c1][lg]overlay=x={px}:y={logo_y}[c2]",
    ]
    dt = [f"[c2]drawtext=font=Arial:text={_dt_escape(headline)}:fontcolor=white:fontsize={head_fs}:x={px}:y={head_y}"]
    y = head_y + round(head_fs * 1.5)
    for i, line in enumerate(sublines):
        fs = fit(line, round(oh * (0.052 if i == 0 else 0.045)))
        dt.append(f"drawtext=font=Arial:text={_dt_escape(line)}:fontcolor=0x{'cbbcff' if i==0 else '9181d2'}:fontsize={fs}:x={px}:y={y}")
        y += round(fs * 1.6)
    parts.append(",".join(dt))

    filt = out.with_suffix(".filter")
    filt.write_text(";".join(parts))
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        "-i", str(src), "-i", str(LOGO), "-filter_complex_script", str(filt),
        "-frames:v", "1", "-q:v", "2", str(out),
    ], check=True)
    filt.unlink(missing_ok=True)


# ---------------------------------------------------------------- horizontal (16:9 branded split)

def _dt_escape(s: str) -> str:
    """Escape text for a drawtext value inside a filtergraph script: backslash,
    then the filter/option separators that would otherwise break parsing."""
    s = s.replace("\\", "\\\\")
    for ch in (":", ",", ";", "'", "[", "]"):
        s = s.replace(ch, "\\" + ch)
    return s


def panel_copy(spath: Path) -> tuple[str, list[str]]:
    """Headline + sublines for the horizontal panel. Scenario `panel` wins:
        "panel": { "headline": "...", "sublines": ["...", "..."] }
    else fall back to the scenario title + a generic Pure-Learning line."""
    scn = json.loads(spath.read_text())
    p = scn.get("panel") or {}
    headline = p.get("headline") or scn.get("title", "Corpán")
    sublines = p.get("sublines") or ["Pure learning. No ads."]
    return headline, list(sublines)


def build_horizontal(raw: Path, out: Path, headline: str, sublines: list[str],
                     music: Path | None = None, audio_mode: str = "blend") -> None:
    """Composite a portrait recording into a 1920x1080 branded split: app on the
    left, a deep-purple panel on the right with the logo + headline + sublines.
    App audio is kept; if `music` is given it's mixed in here (blend=both full,
    music-only=drop app audio). Data/timecode + chapters stripped; capped to the
    shortest stream so a long music tail can't extend the clip. Re-encodes video
    (the composite), so this is a full encode like the other variants."""
    dur = ffprobe_duration(raw)
    fade_at = max(0.0, dur - 2.5)
    PX = 1015  # left edge of the right-hand panel content
    parts = [
        "color=c=0x160a2b:s=1920x1080[bg]",
        "[0:v]scale=-2:1000:in_range=full:out_range=tv,format=yuv420p[fg]",
        "[bg][fg]overlay=x=90:y=40[c1]",
        "[1:v]scale=-1:110[lg]",
        "[c1][lg]overlay=x=%d:y=180[c2]" % PX,
    ]
    # Headline, then sublines (first emphasized, rest smaller/dimmer). Auto-shrink
    # each line's font so it never overflows the panel — Arial averages ~0.52em
    # per char, so the widest font that fits `avail` px is avail/(len*0.52).
    avail = 1920 - PX - 60
    def fit(text: str, cap: int) -> int:
        return max(24, min(cap, int(avail / (max(1, len(text)) * 0.52))))
    dt = ["[c2]drawtext=font=Arial:text=%s:fontcolor=white:fontsize=%d:x=%d:y=370"
          % (_dt_escape(headline), fit(headline, 84), PX)]
    y = 490
    for i, line in enumerate(sublines):
        cap, color = (40, "0xcbbcff") if i == 0 else (34, "0x9181d2")
        dt.append("drawtext=font=Arial:text=%s:fontcolor=%s:fontsize=%d:x=%d:y=%d"
                  % (_dt_escape(line), color, fit(line, cap), PX, y))
        y += 65 if i == 0 else 50
    parts.append(",".join(dt) + ",format=yuv420p[v]")

    inputs = ["-i", str(raw), "-i", str(LOGO)]
    if music:
        inputs += ["-i", str(music)]
        if audio_mode == "music-only":
            parts.append("[2:a]afade=t=out:st=%.2f:d=2.5,loudnorm=I=-14:LRA=11:TP=-1.5[a]" % fade_at)
        else:  # blend
            parts.append("[2:a]afade=t=out:st=%.2f:d=2.5[m]" % fade_at)
            parts.append("[0:a][m]amix=inputs=2:duration=first:normalize=0[mix]")
            parts.append("[mix]loudnorm=I=-14:LRA=11:TP=-1.5[a]")
        amap = "[a]"
    else:
        amap = "0:a"

    filt = out.with_suffix(".filter")
    filt.write_text(";".join(parts))
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-stats", *inputs,
        "-filter_complex_script", str(filt), "-map", "[v]", "-map", amap,
        "-c:v", "libx264", "-crf", "19", "-preset", "slow", "-profile:v", "high",
        "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-dn", "-map_chapters", "-1", "-shortest",
        "-movflags", "+faststart", str(out),
    ], check=True)
    filt.unlink(missing_ok=True)


# ---------------------------------------------------------------- drive

def cmd_drive(args) -> int:
    spath = Path(args.scenario)
    if not spath.exists():
        spath = HERE / args.scenario
    if not spath.exists():
        eprint(f"error: scenario not found: {args.scenario}")
        return 2
    eprint("▶ driving (CDP). Make sure iOS screen recording is ALREADY rolling.")
    t0 = time.time()
    result = scn_mod.run(spath.resolve(), video=True, t0=t0)
    eprint(f"  run_dir : {result['run_dir']}")
    eprint(f"  timeline: {result['timeline']}")
    eprint(f"  ~duration: {ffprobe_duration_safe(result)}")
    # Print machine-readable so an orchestrator (Claude) can chain steps.
    print(json.dumps({"run_dir": result["run_dir"], "timeline": result["timeline"],
                      "passed": result["passed"]}))
    return 0 if result["passed"] else 1


def ffprobe_duration_safe(result) -> str:
    try:
        tl = json.loads(Path(result["timeline"]).read_text())
        return f"{tl.get('duration_s', '?')}s (scenario)"
    except Exception:
        return "?"


# ---------------------------------------------------------------- pull

def cmd_pull(args) -> int:
    """Pull the newest video from the device DCIM (the screen recording).

    `afc ls` returns full paths; iOS names files IMG_<counter> with a
    monotonically increasing counter, so the lexicographically-greatest movie is
    the newest. pymobiledevice3 9.12's `afc pull` requires `-i`/--ignore-errors."""
    py = pmd_python()
    base = "/DCIM/100APPLE"
    ls = subprocess.run([py, "-m", "pymobiledevice3", "afc", "ls", base],
                        capture_output=True, text=True)
    movies = sorted(
        l.strip() for l in ls.stdout.splitlines()
        if l.strip().lower().endswith((".mov", ".mp4", ".m4v"))
    )
    if not movies:
        eprint(f"error: no movie files under {base} (did the recording save?)")
        return 3
    newest = movies[-1]                       # full path or bare name
    remote = newest if newest.startswith("/") else f"{base}/{newest}"
    name = Path(remote).name
    dest = Path(args.dest) if args.dest else Path(f"/tmp/{name}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    eprint(f"pulling {remote} → {dest}")
    pull = subprocess.run([py, "-m", "pymobiledevice3", "afc", "pull", "-i",
                           remote, str(dest)], capture_output=True, text=True)
    if not dest.exists() or dest.stat().st_size == 0:
        eprint(f"error: pull failed: {pull.stderr or pull.stdout}")
        return 3
    eprint(f"pulled {dest.stat().st_size // 1_000_000} MB")
    print(str(dest))
    return 0


# ---------------------------------------------------------------- assemble

def resolve_music(spec: str | None) -> Path | None:
    if not spec or spec == "none":
        return None
    p = Path(spec)
    if p.exists():
        return p
    cand = MUSIC_DIR / spec
    if cand.exists():
        return cand
    eprint(f"warn: music track not found ({spec}); building without music")
    return None


def sidecar_from_scenario(spath: Path, slug: str, date: str) -> dict:
    scn = json.loads(spath.read_text())
    # Languages: first set_state.languages in the scenario (primary = [0]).
    langs: list[str] = []
    for beat in scn.get("beats", []):
        st = beat.get("set_state")
        if isinstance(st, dict) and isinstance(st.get("languages"), list) and st["languages"]:
            langs = st["languages"]
            break
    ui_lang = scn.get("ui_lang") or (langs[0] if langs else None)
    title = scn.get("title", slug)
    persona = scn.get("persona", "")
    tags = ["corpan", "language learning", "onboarding"] + [l for l in langs]
    if scn.get("country"):
        tags.append(str(scn["country"]).lower())
    return {
        "slug": slug,
        "scene": scn.get("scene", "onboarding"),
        "country": scn.get("country", ""),
        "languages": langs,
        "captured_at": date,
        "device": "ipad-13",
        "app": "corpan",
        "app_version": scn.get("app_version", "0.16.1"),
        "youtube": {
            "title": title,
            "description": (persona + "\n\nMore at https://encorpora.io").strip(),
            "tags": tags,
            "category_id": 27,
            "default_audio_language": ui_lang,
            "default_language": ui_lang,
            "privacy": "unlisted",
            "made_for_kids": False,
            "playlist": scn.get("playlist"),
            "variant_to_upload": "long",
        },
    }


def music_overlay_silent(video: Path, bgm: Path, out: Path) -> None:
    """Lay the music as the only audio track (drops any source audio), trimmed
    to the video length with a fade-out, mastered to -14 LUFS. This is the
    `music-only` treatment. Video copied unchanged."""
    dur = ffprobe_duration(video)
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(video), "-stream_loop", "-1", "-i", str(bgm),  # loop music to cover the video
        "-filter_complex", "[1:a]afade=t=out:st=%.2f:d=2.5,loudnorm=I=-14:LRA=11:TP=-1.5[a]" % max(0.0, dur - 2.5),
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        # -dn / -map_chapters -1: drop any data/timecode track (e.g. the
        # QuickTime chapter stream) — left in, it carries the music's duration
        # and players report that as the total length (video freezes early).
        "-dn", "-map_chapters", "-1",
        "-shortest", "-movflags", "+faststart", str(out),
    ], check=True)


def music_blend_full(video: Path, bgm: Path, out: Path) -> None:
    """`blend` treatment: keep the source audio (app TTS/UI) AND the music, both
    at full level — no ducking, no attenuation. Flat amix (normalize=0 so neither
    is auto-lowered), music faded out at the end, whole mix mastered to -14 LUFS.
    Video copied unchanged."""
    dur = ffprobe_duration(video)
    fc = ("[1:a]afade=t=out:st=%.2f:d=2.5[m];"
          "[0:a][m]amix=inputs=2:duration=first:normalize=0[mix];"
          "[mix]loudnorm=I=-14:LRA=11:TP=-1.5[a]" % max(0.0, dur - 2.5))
    subprocess.run([
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(video), "-stream_loop", "-1", "-i", str(bgm),  # loop music to cover the video
        "-filter_complex", fc,
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
        # Drop data/timecode + chapters (see music_overlay_silent) and cap to the
        # shortest stream so the music tail can't extend the clip past the video.
        "-dn", "-map_chapters", "-1", "-shortest",
        "-movflags", "+faststart", str(out),
    ], check=True)


def cmd_assemble(args) -> int:
    raw = Path(args.raw)
    if not raw.exists():
        eprint(f"error: raw not found: {raw}")
        return 2
    spath = Path(args.scenario)
    if not spath.exists():
        spath = HERE / args.scenario
    if not spath.exists():
        eprint(f"error: scenario not found: {args.scenario}")
        return 2

    date = args.date or TODAY
    slug = args.slug or json.loads(spath.read_text()).get("name", raw.stem)
    out_root = Path(args.out_root) if args.out_root else captures_root()

    # Stage raw + sidecar into the <root>/raw/<date>/ layout build-capture expects.
    raw_dir = out_root / "raw" / date
    raw_dir.mkdir(parents=True, exist_ok=True)
    staged = raw_dir / f"{slug}.mov"
    if staged.resolve() != raw.resolve():
        eprint(f"staging raw → {staged}")
        shutil.copy2(raw, staged)
    sidecar = raw_dir / f"{slug}.meta.json"
    sidecar.write_text(json.dumps(sidecar_from_scenario(spath, slug, date), indent=2) + "\n")
    eprint(f"sidecar → {sidecar}")

    # Optional dead-air trim BEFORE build (off by default — ad pacing is intentional).
    src = staged
    if args.trim:
        trimmed = raw_dir / f"{slug}.trimmed.mov"
        eprint("trimming dead air…")
        subprocess.run([pmd_python(), str(TRIM), str(staged), str(trimmed)], check=True)
        if trimmed.exists():
            shutil.move(str(trimmed), str(staged))  # keep the slug name for build-capture

    # Build the delivery variants. `horizontal` is a studio-only 16:9 branded
    # split (build-capture doesn't make it) — everything else goes to
    # build-capture. Dark UI → solid square sidebars beat a muddy blur.
    requested = [v.strip() for v in args.variants.split(",") if v.strip()]
    bc_variants = [v for v in requested if v != "horizontal"]
    built_dir = out_root / "built" / date / slug
    if bc_variants:
        cmd = ["bash", str(BUILD_CAPTURE), str(staged),
               "--variants", ",".join(bc_variants), "--square-bg", args.square_bg]
        eprint("==> build-capture: " + " ".join(cmd))
        r = subprocess.run(cmd, env={**os.environ})
        if r.returncode != 0:
            eprint("error: build-capture.sh failed")
            return r.returncode
    if "horizontal" in requested:
        built_dir.mkdir(parents=True, exist_ok=True)
        headline, sublines = panel_copy(spath)
        eprint(f"==> horizontal (16:9 split): \"{headline}\"")
        build_horizontal(staged, built_dir / "horizontal.mp4", headline, sublines)
    eprint(f"built → {built_dir}")

    # Music per video variant. Treatment:
    #   duck       — sidechain-duck music under the app audio (mix-bgm.py)
    #   blend      — app audio + music both full, flat amix (no ducking)
    #   music-only — drop app audio, music carries the video
    bgm = resolve_music(args.music)
    if bgm:
        has_audio = ffprobe_has_audio(staged)
        mode = args.audio
        if mode == "duck" and not has_audio:
            mode = "music-only"  # nothing to duck against
        for variant in ALL_VARIANTS:
            v = built_dir / f"{variant}.mp4"
            if not v.exists():
                continue
            tmp = built_dir / f"{variant}.music.mp4"
            eprint(f"==> music → {variant}.mp4 ({mode})")
            if mode == "duck":
                subprocess.run([pmd_python(), str(MIX_BGM), str(v), str(bgm), str(tmp)], check=True)
            elif mode == "blend" and has_audio:
                music_blend_full(v, bgm, tmp)
            else:
                music_overlay_silent(v, bgm, tmp)
            shutil.move(str(tmp), str(v))
        eprint(f"music: {bgm.name} ({mode})")
    else:
        eprint("music: none")

    print(json.dumps({
        "built_dir": str(built_dir),
        "variants": sorted(p.name for p in built_dir.glob("*.mp4")),
        "thumb": str(built_dir / "thumb.jpg") if (built_dir / "thumb.jpg").exists() else None,
        "sidecar": str(sidecar),
        "music": bgm.name if bgm else None,
    }, indent=2))
    return 0


# ---------------------------------------------------------------- music (apply to already-built variants)

def cmd_music(args) -> int:
    """Apply (or swap) a music track onto already-built variants without
    re-encoding the video — fast, and ideal for A/B music testing. Reads each
    variant's CURRENT audio, so run it on freshly built (music-free) variants;
    re-running stacks music. Use --keep to write *.<track-stem>.mp4 instead of
    overwriting."""
    built = Path(args.built_dir)
    if not built.is_dir():
        eprint(f"error: not a dir: {built}")
        return 2
    bgm = resolve_music(args.music)
    if not bgm:
        eprint("error: no usable track")
        return 2
    done = []
    variants = [args.only] if args.only else list(ALL_VARIANTS)
    for variant in variants:
        v = built / f"{variant}.mp4"
        if not v.exists():
            continue
        has_audio = ffprobe_has_audio(v)
        mode = args.audio if not (args.audio == "blend" and not has_audio) else "music-only"
        out = built / (f"{variant}.{bgm.stem}.mp4" if args.keep else f"{variant}.music.mp4")
        eprint(f"==> music → {v.name} ({mode}) → {out.name}")
        if mode == "blend" and has_audio:
            music_blend_full(v, bgm, out)
        else:
            music_overlay_silent(v, bgm, out)
        if not args.keep:
            shutil.move(str(out), str(v))
            out = v
        done.append(out.name)
    print(json.dumps({"built_dir": str(built), "music": bgm.name, "audio": args.audio, "wrote": done}, indent=2))
    return 0


# ---------------------------------------------------------------- record-run (AVFoundation auto)

def cmd_record_run(args) -> int:
    """Bracket `drive` with the headless Swift recorder. Only works where
    AVFoundation can see the device (NOT this tunneled iPad — see module doc)."""
    spath = Path(args.scenario)
    if not spath.exists():
        spath = HERE / args.scenario
    run_dir = HERE / "runs" / f"{spath.stem}-rec-{int(time.time())}"
    run_dir.mkdir(parents=True, exist_ok=True)
    raw = run_dir / "raw.mov"
    rec = subprocess.Popen(["bash", str(HERE / "record.sh"), "--out", str(raw)])
    eprint("recorder starting… giving it 2.5s to lock on")
    time.sleep(2.5)
    if rec.poll() is not None:
        eprint("error: recorder exited early — AVFoundation cannot see the iPad "
               "on this setup. Use the Control Center path (drive + pull + assemble).")
        return 3
    t0 = time.time()
    try:
        result = scn_mod.run(spath.resolve(), video=True, t0=t0)
    finally:
        rec.send_signal(signal.SIGINT)
        try:
            rec.wait(timeout=15)
        except subprocess.TimeoutExpired:
            rec.kill()
    eprint(f"raw → {raw}  ({raw.stat().st_size//1_000_000 if raw.exists() else 0} MB)")
    print(json.dumps({"raw": str(raw), "run_dir": result["run_dir"],
                      "timeline": result["timeline"]}))
    return 0


# ---------------------------------------------------------------- cli

def main() -> int:
    ap = argparse.ArgumentParser(description="Corpán capture studio")
    sub = ap.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("drive", help="run the walkthrough via CDP (bracket with Control Center recording)")
    d.add_argument("scenario")
    d.set_defaults(fn=cmd_drive)

    p = sub.add_parser("pull", help="pull the newest device DCIM video")
    p.add_argument("--dest", help="output path (default /tmp/<name>)")
    p.set_defaults(fn=cmd_pull)

    a = sub.add_parser("assemble", help="raw .mov → mastered variants (+ music)")
    a.add_argument("raw")
    a.add_argument("--scenario", required=True)
    a.add_argument("--music", default="none", help="track filename in branding/music, a path, or 'none'")
    a.add_argument("--audio", default="blend", choices=["duck", "blend", "music-only"],
                   help="how music sits vs the recording's audio (default: blend = both full, no ducking)")
    a.add_argument("--trim", action="store_true", help="trim dead air before building (off by default)")
    a.add_argument("--variants", default="long,shorts,square,thumb,horizontal")
    a.add_argument("--square-bg", default="solid", choices=["blur", "solid"])
    a.add_argument("--out-root", help="captures root (default ~/Desktop/Corpan Captures or LOCAL_CAPTURES_DIR)")
    a.add_argument("--slug")
    a.add_argument("--date", help="YYYY-MM-DD (default today)")
    a.set_defaults(fn=cmd_assemble)

    m = sub.add_parser("music", help="apply/swap a track onto already-built variants (no re-encode)")
    m.add_argument("built_dir")
    m.add_argument("music", help="track filename in branding/music, or a path")
    m.add_argument("--audio", default="blend", choices=["duck", "blend", "music-only"])
    m.add_argument("--only", help="apply to just one variant by name, e.g. long/shorts/square/horizontal/16x9 (per-variant tracks)")
    m.add_argument("--keep", action="store_true", help="write *.<track>.mp4 instead of overwriting (A/B)")
    m.set_defaults(fn=cmd_music)

    rr = sub.add_parser("record-run", help="AUTO: Swift recorder + drive (AVFoundation devices only)")
    rr.add_argument("scenario")
    rr.set_defaults(fn=cmd_record_run)

    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
