# AMP cinema ads

Turn a shot list into finished, voiced, scored social video ads for AMP:
generated cinematic shots (LTX-2.5 on the GPU host), real product footage, an
ElevenLabs voice, a licensed music bed at a constant level, and **centered**
text cards. One JSON spec per ad renders every delivery format with receipts
and QC. Read [`AGENTS.md`](AGENTS.md) first: it holds the hard rules.

```
spec.py      ad spec validation, formats, safe zones, edit timeline
graph.py     FFmpeg argv builders (video stitch, premix, loudnorm). Music is never ducked.
render.py    cards -> mix -> video per format -> QC, receipts, reuse/supersede
cards.mjs    Playwright text-card renderer (centred, auto-fit)
plan.py      shot list -> GPU batch (prompt files, plan.json, batch.env)
spark/       supervise.sh (runs on the GPU host), spark.sh (local helper)
gallery.py   grading page for raw clips; review page for finished ads
voice.py     take checks, transcript check, optional ElevenLabs REST takes
youtube.py   private-only YouTube upload
examples/    ad.json (a real 30 s ad), shotlist.json
```

## Prerequisites

- Python 3.12+, FFmpeg 6.1+ (`xfade`, `sidechaincompress`, `loudnorm`, `bbox`).
- Node 22+ with Playwright, from `web/scripts/amp-ads`: `npm ci && npx playwright install chromium`.
- `ssh` access to the GPU host, which already runs the guarded batch runner
  (`guard-v1/batch.py`) and the LTX-2.5 generator (`ltx-benchmark.py`).
- The `elevenlabs` MCP server connected in Claude Code or Codex (remote HTTP, OAuth).

Media, voices, music, exports and credentials never enter Git. Set these in your
shell (actual values live in the private infrastructure repository):

| Variable | Meaning |
| --- | --- |
| `AMP_MEDIA_ROOT` | media library; work in dated folders, e.g. `$AMP_MEDIA_ROOT/2026-10-28/<campaign>` |
| `AMP_MUSIC_POOL` | owned/licensed instrumental tracks |
| `AMP_ADS_OUT` | default `--out` for renders |
| `AMP_SPARK_HOST` | ssh alias of the GPU host |
| `AMP_SPARK_ROOT` | `amp-cinema` working directory on the host (holds `guard-v1/`, `ltx-benchmark.py`, `workload.lock`) |
| `AMP_SPARK_PYTHON` | the LTX environment's python on the host |
| `AMP_SPARK_OUTPUTS` | where the generator writes `<job>.mp4` + `<job>.json` |
| `AMP_VIDEO_ENCODER` | `libx264` (default) or `videotoolbox` (fast on macOS) |
| `AMP_X264_PRESET` | default `slow`; `veryfast` for drafts |
| `ELEVENLABS_API_KEY` | optional, for scripted takes; normally use the MCP |
| `AMP_YOUTUBE_TOKEN`, `AMP_YOUTUBE_CHANNEL_ID` | private upload: token file path, expected channel |

## From shot list to finished ads

Run from `web/scripts/amp-ads`. `B` is the campaign folder.

```sh
B=$AMP_MEDIA_ROOT/2026-10-28/missing-piece-v4

# 1. Plan the generation batch (prompt x seeds x framings).
python3 -m cinema plan "$B/shotlist.json" "$B/spark"

# 2. Check the GPU host is idle enough, then launch. It queues behind any running batch.
cinema/spark/spark.sh preflight
cinema/spark/spark.sh launch "$B/spark"

# 3. Pull finished clips every 5 minutes and grade them in $B/review.html.
cinema/spark/spark.sh sync missing-piece-v4 "$B" --watch

# 4. Voice: make takes with the ElevenLabs MCP (below), then check each against its spec.
python3 -m cinema voice "$B/ads/01-when-it-clicks.json" --transcript "$B/voices/01-when-it-clicks/take-1.txt"

# 5. Render every format with QC, then build the review page.
python3 -m cinema render "$B"/ads/*.json --out "$B/out"
python3 -m cinema review "$B/out"

# 6. Upload the approved cut privately (4K master for YouTube).
python3 -m cinema render "$B/ads/01-when-it-clicks.json" --out "$B/out" --master --format portrait
python3 -m cinema upload "$B/out/01-when-it-clicks/portrait-4k.mp4" --title "When it clicks, everything moves"
```

`python3 -m cinema validate <spec>...` checks specs without rendering.

### 1. Shot list

[`examples/shotlist.json`](examples/shotlist.json): `batch` (unique slug, also the
host directory), `prefix` (job-name prefix), `seeds`, `framings` (`portrait`
768x1344, `wide` 1344x768), `model` (`frames` must be 8n+1; 121 = 5 s at 24 fps),
a `style` suffix appended to every prompt, and `shots` with `id`, `prompt`, optional
`extra`, `seeds` and `framings`. Jobs are ordered round-robin by seed, so every
concept appears early and grading can start within the first hour. A batch folder
is never overwritten: change anything and use a new batch name.

Write prompts as physical, causal action: what moves, what it touches, what
happens next, where the camera is. State constraints the model breaks (rigid
gears keep their shape; the action stays centred). Each prompt ends "No text, no
logo, no speech, no music" because text, narration and music are added later.

### 2-3. Generation and grading

`launch` copies the batch to `$AMP_SPARK_ROOT/<batch>` and starts
`supervise.sh` under `nohup`. The supervisor feeds `plan.json` through the
guarded runner (free-memory floor, thermal ceiling, per-job time limit, the
host-wide `workload.lock`). A failed or guard-aborted job is quarantined with
its evidence and never retried; three failures in a row with no progress stop
the batch. A job the host deferred (memory, temperature, lease) stops the
supervisor for a human instead of being dropped. A
distilled LTX clip takes roughly 1.5-3.5 minutes. `spark.sh status <batch>`
shows progress.

`sync` writes `$B/clips/` and `$B/review.html`. Hover plays a clip, click
toggles sound. Grade A (use), B (maybe), C (weak), X (reject); grades stay in the
browser until **Download grades**. Judge motion, not stills: does the action
actually happen, do objects keep their shape, is the key action centred in both
framings? Pick in/out points from A clips for the ad specs.

### 4. Voice takes (ElevenLabs MCP)

With the `elevenlabs` MCP connected, for each ad:

1. Ask for a cost **estimate** first, then generate **two takes** of the script
   with the chosen voice and model (`eleven_v4` was used for the 2026-10-27 batch).
   Direction: "natural, steady and intimate; no shouting, exaggerated emotion or
   trailer voice". Paul (male) and Madeline (female) are the voice pair; voice IDs
   are in the previous batch's `ads.json` under `$AMP_MEDIA_ROOT`.
2. Save the audio as `voices/<ad-id>/take-N.mp3` and keep the MCP's JSON
   responses beside it as the generation receipt.
3. Transcribe the chosen take with Scribe through the MCP; save the text and run
   step 4 above. Listen to it. Then set `"transcriptVerified": true` in the spec.
   Renders of unverified voices are marked `needs-voice-check`.
4. For sentence timing, put word/sentence times from the transcription into
   `voice.segments` (`from`/`to` in the take, `at` in the ad). This spaces lines
   around the picture and writes `captions.vtt`.

Write the product name as "Amp" in scripts so it is spoken as a word, not
spelled out. Do not generate music with Eleven Music: our plan's terms limit it to
individual use. Use the owned music pool.

Scripted alternative: `ELEVENLABS_API_KEY=... python3 -m cinema voice <spec> --generate 2`
(needs `voice.voiceId` and `voice.model`; billable; style 0 by default).

### 5. Ad spec

[`examples/ad.json`](examples/ad.json) is the first 2026-10-27 ad. Paths may use
`$AMP_MEDIA_ROOT`/`$AMP_MUSIC_POOL` and are otherwise relative to the spec.

| Field | Meaning |
| --- | --- |
| `id`, `title` | lowercase slug (output folder), human title |
| `duration` | seconds, 5-60; use 15, 20 or 30 |
| `fps` | 24 (LTX native), 25 or 30 |
| `formats` | any of `portrait` 9:16 1080x1920, `feed` 4:5 1080x1350, `square` 1:1 1080x1080, `wide` 16:9 1920x1080 |
| `shots[]` | `id`, `source`, `in`, `out`, `duration`, optional `transition` into the next shot, `fit`, `retime` |
| `shots[].source` | a path with optional `{orientation}` (`portrait` for portrait/feed, `wide` for square/wide) or `{format}`, or a map keyed by format, orientation or `default` |
| `shots[].transition` | `{"type": "fade", "duration": 0.25}`; any FFmpeg `xfade` type or `cut` |
| `shots[].fit` | `cover` crops to fill; `contain` letterboxes (use for product UI so nothing is cut off) |
| `shots[].retime` | default `true` stretches `in`-`out` to the shot length (0.4x-2.5x); `false` plays at natural speed and holds the last frame |
| `cards[]` | `text`, `start`, `end`. No position fields: every card is centred. At most 10 words / 60 characters / 3 lines |
| `endCard` | `start`, `cta`; optional `brand`, `tagline`, `url` (default AMP / Adaptive Math Pathways / amp.corpora.inc) |
| `voice` | `voice`, `take`, `script`, `start` (default 0.45 s) or `segments`, `transcriptVerified`, optional `voiceId`, `model` |
| `music` | `title`, `path`, `offset`, `rights` (required). Optional `lufs` (constant level, default -24), `fade` (default 0.15 s on both edges), and `align` (`none` or `bar`). The bed is not ducked. Set `duck` to true only when that spec should sidechain the music to the voice. |
| `sfx[]` | `path`, `at`, `gainDb` |
| `qc.maxBlackSeconds` | longest tolerated near-black run (default 0.5) |

Product footage: capture the real AMP UI frame by frame with a controlled clock
(Playwright `page.clock`, eased pointer moves, one screenshot per frame), then
encode at the ad frame rate. Screen recordings stutter, and a single jerky
product shot ruins every ad that reuses it. Inspect product clips frame by frame
before using them.

### 6. Render, QC and review

For each spec the renderer:

1. renders each format's cards with Playwright and measures the visible pixels
   of every card with FFmpeg's `bbox`. A card outside the format's safe area or
   off-centre stops the render;
2. builds the audio once: voice normalised to -16 LUFS and placed, music bed
   measured over the used excerpt, mixed at a constant level with any effects,
   then two-pass `loudnorm` to
   **-14 LUFS, -1.5 dBTP** (AAC 256 kb/s, 48 kHz);
3. stitches the shots (scale/crop or letterbox, retime, `xfade` overlaps split
   around each cut), overlays the cards and end card with fades, ends with a
   0.25 s fade out;
4. QC: dimensions, duration (±0.1 s), audio present at 48 kHz, -15.5 to -12.5
   LUFS, true peak ≤ -1 dBTP, no near-black run, clean full decode, and an
   8-frame contact sheet.

Output, per ad: `out/<id>/{portrait,feed,square,wide}.mp4` (`-4k.mp4` with
`--master`), `<format>-receipt.json` (exact FFmpeg argv, SHA-256 of every input
and the output, QC results, status), `<format>-contact.jpg`, `mix.m4a` +
`audio-receipt.json` (gains, both loudness measurements),
`captions.vtt`, and `cards/` with each card's PNG, text-only PNG and measured
boxes. Unchanged inputs reuse existing outputs. Changed inputs refuse to
overwrite; `--replace` moves the old files to `superseded/<time>/`.

`review` writes `out/review.html` with every format of every ad, its status and
script. Watch each cut in full with sound at phone size before upload: QC proves
the media is sound, not that the ad is good.

### 7. Upload privately

`upload` refuses unless the token resolves to `AMP_YOUTUBE_CHANNEL_ID`, and
always uploads as **private** with `containsSyntheticMedia` set and
`selfDeclaredMadeForKids` false (the audience is parents). Upload the 4K master:
YouTube streams 4K uploads at visibly higher quality than 1080p ones. Publishing
follows the [shared YouTube operating policy](../../../../docs/youtube-publishing.md):
private preparation, reviewed settings, and scheduled release normally about 24 hours later.
For Meta and Google Ads, upload the 1080 deliverables in each aspect ratio and
keep every asset group filled.

## Tests

`npm test` runs `test/cinema.test.mjs`: a real render of synthetic clips in all
four formats at quarter size (QC, loudness, constant music level, reuse, refusal to
overwrite) and the pixel gate on top/bottom/centre cards. `python3 -m unittest
discover -s test -p 'test_*.py'` runs `test/test_cinema.py`: spec rules, safe
zones, filtergraphs (including the edit offsets of the 2026-10-27 renders), batch
planning, supervisor quarantine, pages, voice and upload guards. Both run in the
path-gated `web-io` CI job.
