# Corpán capture studio

Drive the iPad through a scripted walkthrough, record it, and assemble a
finished, campaign-ready video — the glue layer SCENARIOS.md roadmap #2 calls
for. One prompt → driven walkthrough → mastered variants (music bed, blur-pad to
each aspect), built locally and ready to review/upload.

Orchestrator: **`corpan/scripts/dev/ipad/studio.py`** (reuses `scenario.py` to
drive, and `infra/captures/{build-capture.sh,mix-bgm.py,trim-deadair.py}` to
master). Scenarios live in `corpan/scripts/dev/ipad/scenarios/*.json`.

## Capture path on this iPad: iOS Control Center (not AVFoundation)

The dream was a fully headless Swift recorder (`record.sh` /
`ipad-record.swift`). It is built and kept — but it **cannot see this iPad**.
The consumer AVFoundation/CoreMediaIO screen-capture device (the thing QuickTime
records, the thing `kCMIOHardwarePropertyAllowScreenCaptureDevices` exposes) is
**not published while the device is held by the `pymobiledevice3 remote tunneld`
developer tunnel that our CDP driving requires**. Confirmed empirically:

- `pymobiledevice3 usbmux list` → iPad present over USB; DVT screenshots work.
- *No* AVFoundation enumeration lists the iPad — not the muxed/video discovery
  sessions, not even the fully-deprecated all-device call. Only the iPhone
  Continuity Camera appears.
- pymobiledevice3's developer/DVT API offers **screenshots only**, no video.

So screen + device-audio recording uses **iOS Control Center screen recording**
(the repo's proven path — `build-capture.sh` is already tuned for its
`displaymatrix=-90` / `yuvj420p` signature), and `studio.py pull` fetches the
`.mov` off the device afterward. The Swift recorder stays as the `record-run`
path for Macs/devices where AVFoundation *can* see the device.

> If a future setup wants fully-headless capture, the open question is whether
> AVFoundation can see the iPad with `tunneld` stopped. If yes, capture and CDP
> driving are mutually exclusive over that tunnel and the driver would need to
> move to XCUITest. Untested — Control Center is the working path today.

## Prerequisites

The iPad debug pipeline (see `scripts/dev/ipad/README.md`, run `doctor.sh`):
`sudo pymobiledevice3 remote tunneld` running, **Web Inspector ON** (Settings →
Apps → Safari → Advanced — and no Safari Web Inspector window open, it's
mutually exclusive), app foregrounded. CDP needs an **inspectable WebView**
(`cdpd` reports "no inspectable pages found" when Web Inspector is off or the
build's WebViews aren't inspectable). Plus `ffmpeg`/`ffprobe`/`jq`.

## End-to-end run (Control Center)

```bash
cd corpan/scripts/dev/ipad
# (warm the CDP daemon for fast taps)
PMD=$(pipx environment --value PIPX_LOCAL_VENVS)/pymobiledevice3/bin/python
nohup "$PMD" cdpd.py > /tmp/cdpd.log 2>&1 &   # wait for "cdpd ready"

# 1. App on the Welcome screen. Start iOS screen recording, swipe Control Center away.
# 2. Drive the walkthrough (writes runs/<name>-<ts>/ report.md + timeline.json):
python3 studio.py drive scenarios/id_english_beginner.json
# 3. Stop the iOS recording.
# 4. Pull the recording off the device:
python3 studio.py pull --dest /tmp/id_english_beginner.mov
# 5. Master it into variants + music bed (build locally; no upload):
python3 studio.py assemble /tmp/id_english_beginner.mov \
  --scenario scenarios/id_english_beginner.json \
  --music fairy-gnomes_corpan-original.m4a
#   → ~/Desktop/Corpan Captures/built/<date>/<slug>/{long,shorts,square}.mp4 + thumb.jpg
#   (override the destination with --out-root; default honors LOCAL_CAPTURES_DIR)
```

`assemble` flags: `--music <track|path|none>` (tracks in `branding/music/`),
`--audio duck|blend|music-only` (blend = app audio + music both full, no ducking
— the default), `--trim` (dead-air trim, off — ad pacing is intentional),
`--square-bg solid|blur` (solid for dark UI), `--variants`, `--slug`, `--date`,
`--out-root`.

### Four variants for a portrait source

`--variants` defaults to `long,shorts,square,thumb,horizontal`:

| variant | aspect | how |
|---------|--------|-----|
| `long` | source (e.g. 3:4) | clean range/color only |
| `shorts` | 9:16 1080×1920 | blur-pad, top-biased for Reels/Shorts UI |
| `square` | 1:1 1080×1080 | solid dark sidebars (blur looks muddy on dark UI) |
| `horizontal` | 16:9 1920×1080 | **branded split** — app on the left, logo + headline + sublines on a deep-purple panel on the right |
| `thumb` | 16:9 1280×720 | blur-pad still |

Heavy blur-padding a portrait capture to 16:9 leaves ~58% of the frame as mush —
bad form. The `horizontal` split turns that dead space into the ad's message
instead. Its copy comes from the scenario's `panel` field:

```json
"panel": {
  "headline": "Belajar bahasa Inggris",
  "sublines": ["Gratis. Tanpa iklan. Di perangkat Anda.", "Tutor pribadi. Sepenuhnya luring."]
}
```

(falls back to the scenario `title` + a Pure-Learning line). It re-encodes (the
composite), unlike the copy-video music passes.

### Per-variant music (campaign diversity)

Shipping a different track per size/format makes for stronger A/B campaigns. Build
music-free, then score each variant on its own:

```bash
python3 studio.py music <built_dir> "ray of light instrumental 163.wav"  --only long
python3 studio.py music <built_dir> "rising up instrumental 87.wav"       --only shorts
python3 studio.py music <built_dir> "let the light in instrumental 98.wav" --only square
python3 studio.py music <built_dir> "scholar acoustic inst.wav"           --only horizontal
```

`studio.py music` copies the video and only re-encodes audio (~seconds), so
swapping tracks is cheap. `--keep` writes `*.<track>.mp4` for side-by-side A/B.
**Pick tracks ≥ the clip length** or the music ends early (there's a 2.5s
fade-out at the tail). New tracks live on S3 under `s3://corpan-assets/corpan-beats/`.

> Note on this ffmpeg build: `drawtext` rejects `fontfile=` — use `font=Arial`
> (fontconfig). Commas/colons in panel copy are auto-escaped. A QuickTime
> timecode/chapter `bin_data` track rides in on screen recordings; the music
> steps strip it (`-dn -map_chapters -1 -shortest`) so players don't report the
> music's length as the clip duration.

Dry-run the driver any time without recording — just run `studio.py drive` and
inspect `runs/<name>-<ts>/` screenshots to tune the scenario's taps/pacing.

## Authoring scenarios

A scenario is a persona + beats (see SCENARIOS.md for the full beat grammar).
For campaign videos:

- **Pacing** — use `pause_video` for reflective holds (honored in `drive`, which
  runs video mode); longer holds on the payoff (the lesson) read well on camera.
- **Language-agnostic taps** — once the UI localizes, English `tap` needles miss.
  Tap autonyms (`"Bahasa Indonesia"`), localized labels (`"Belajar bahasa"`,
  `"Inggris"`, `"Belum pernah"`), `tap_anchor` by `aria`/`testid` (e.g.
  `{aria:"Continue"}`, `{testid:"hero-cta"}`), or `tap_primary` for footer CTAs.
  Avoid English `wait_text` needles on a non-English UI — each one blocks 20s.
- **Sidecar fields** — `country`, `scene`, `playlist`, `app_version`,
  `ui_lang` feed the generated `meta.json` (YouTube title/description/tags).

`timeline.json` (written by every drive) records each caption + screenshot with
its elapsed offset — the alignment backbone for the studio extensions below.

## Studio extensions (the "full power studio" — design ↔ build incrementally)

The assemble step is built from composable stages so these layer in cleanly:

- **Narration track** — from `timeline.json`, synth per-caption voiceover
  (Chatterbox or Gemini Flash TTS) into a timed audio stem, mix as a third layer
  (VO on top, music ducked under VO via the existing `sidechaincompress`).
  Produces a narrated variant alongside the music-only one. *(timeline.json +
  mix-bgm ducking exist; the TTS synth + timed-stem builder are the new pieces.)*
- **PiP / overlay** — `--overlay person.mov`: ffmpeg `overlay`/`scale` to comp a
  real-person clip over the app "bed" (corner PiP or split-screen), reusing the
  same blur-pad framing. *(wired as a stub flag; the ffmpeg comp stage is TODO.)*
- **A/B variant matrix** — one recording → many cuts (aspect × music × narration
  × overlay), each its own `built/` dir + sidecar, for the campaign grid
  (Indonesia: ID+EN and reverse, plus AR/KO/JA/ZH/MS; 30s / 3m / 5–10m lengths).

## Files

| file | role |
|------|------|
| `scripts/dev/ipad/studio.py` | orchestrator: `drive` · `pull` · `assemble` · `record-run` |
| `scripts/dev/ipad/scenario.py` | beat-based CDP driver; emits `timeline.json` |
| `scripts/dev/ipad/ipad-record.swift` · `record.sh` | headless AVFoundation recorder (blocked on the tunneled iPad; works elsewhere) |
| `infra/captures/build-capture.sh` | raw .mov → long/shorts/square/thumb (rotation/color, blur-pad) |
| `infra/captures/mix-bgm.py` | music bed + sidechain ducking, −14 LUFS |
| `infra/captures/trim-deadair.py` | optional dead-air trim |
| `infra/captures/branding/music/` | CC0 / Corpán-original tracks (Content-ID-safe) |
