# Captures — layout, workflow, and YouTube pipeline

Marketing/promo captures for the Corpán YouTube channel (`@corpán1`).
Different from `marketing/`: those are App Store / Play Store screenshots
and 15–30 s App Previews. **These** are 60–180 s YouTube uploads and
Google Ads creatives.

- **Bucket**: `s3://corpan-assets/captures/`  (region `us-east-2`)
- **Local mirror**: `~/Desktop/Corpan Captures/`  (override with `LOCAL_CAPTURES_DIR=...`)
- **YouTube channel**: `@corpán1`
- **Sync up**:    `infra/captures/sync-captures-to-s3.sh`
- **Sync down**:  `infra/captures/hydrate-captures.sh`
- **Build one capture**: `infra/captures/build-capture.sh <raw.mov>`
- **Build + upload**:    `infra/captures/build-and-upload.sh <raw.mov>`

S3 + sync scripts auto-source `~/Code/corpora/encorpora/.env` for AWS creds
(same pattern as `infra/sync-marketing-to-s3.sh`).

## Directory layout

```
~/Desktop/Corpan Captures/                          # LOCAL_CAPTURES_DIR
  raw/
    YYYY-MM-DD/
      <slug>.mov                                    # iPad screen capture
      <slug>.meta.json                              # sidecar (drives YouTube fields)
  built/
    YYYY-MM-DD/
      <slug>/
        long.mp4       # 1200×1600 vertical, cleaned for YouTube
        shorts.mp4     # 1080×1920 (9:16), blur-padded, ≤180 s
        square.mp4     # 1080×1080 (1:1), blur-padded
        thumb.jpg      # 1280×720 thumbnail (16:9, blur-padded)
        meta.json      # full manifest (sidecar + build + youtube section)
```

S3 mirrors the same tree under `s3://corpan-assets/captures/{raw,built}/...`.

## Naming

`<slug>` should encode scene + country + languages, e.g.

```
main-exp-algeria_ar-en-fr-tr-es-zh
pack-discovery-morocco_ar-fr
```

- `kebab-case` for scene + country, joined with `-`.
- `_` separates the human-meta from the language list.
- Language codes are ISO 639-1, joined with `-`.

The build script doesn't strictly enforce this — it derives the slug from
the filename — but consistent naming makes S3 grep-able.

## Sidecar — `<slug>.meta.json`

Hand-edited. Drives YouTube metadata; built-time fields are added
automatically into `built/.../meta.json`.

```jsonc
{
  "slug": "main-exp-algeria_ar-en-fr-tr-es-zh",
  "scene": "main-experience",
  "country": "Algeria",
  "languages": ["ar", "en", "fr", "tr", "es", "zh"],
  "captured_at": "2026-05-17",
  "device": "ipad-13",
  "app": "corpan",
  "app_version": "0.13.0",

  "youtube": {
    "title": "Corpán — full multilingual experience (Algeria, 6 languages)",
    "description": "A 76-second tour of the Corpán main experience across Arabic, English, French, Turkish, Spanish, and Chinese.\n\nMore at https://encorpora.io",
    "tags": ["corpan", "language learning", "arabic", "algeria", "polyglot"],
    "category_id": 27,                  // 27 = Education, 22 = People & Blogs
    "default_audio_language": "ar",
    "default_language": "ar",
    "privacy": "unlisted",
    "made_for_kids": false,
    "playlist": "Corpán — Algeria series",
    "variant_to_upload": "long"         // long | shorts | square
  }
}
```

First `build-capture.sh` run for a `.mov` with no sidecar writes a stub
and exits non-zero — fill in `title`, `description`, `tags`, language
codes, then re-run.

## Workflow

1. Capture on the iPad (Reflector / cabled QuickTime / built-in screen-record).
2. Save the `.mov` to `~/Desktop/Corpan Captures/raw/YYYY-MM-DD/<slug>.mov`.
3. Run `./infra/captures/build-capture.sh <raw.mov>`
   - First time: edit the stub `.meta.json` it writes, re-run.
   - Produces all four variants + manifest.
4. Run `./infra/captures/sync-captures-to-s3.sh` to back up to S3 (cheap; idempotent).
5. Upload programmatically:
   `./infra/captures/youtube/.venv/bin/corpan-yt upload built/YYYY-MM-DD/<slug>/`
   (or the one-shot `./infra/captures/build-and-upload.sh <raw.mov>`).
6. Review in YouTube Studio while still unlisted. When happy:
   `corpan-yt publish <video_id>`.

## YouTube CLI — `corpan-yt`

Lives at `infra/captures/youtube/`. Project-local venv (no global Python
pollution, no `--break-system-packages`).

### First-time setup

1. In Google Cloud Console: enable the **YouTube Data API v3**, create an
   OAuth 2.0 Client ID of type **Desktop app**, download the
   `client_secret_*.json`.
2. Save it (rename) to `~/.config/corpora/youtube/client_secret.json`.
3. Install:
   ```
   cd corpan/infra/captures/youtube
   python3 -m venv .venv
   .venv/bin/pip install -e .
   ```
4. Authenticate:
   ```
   .venv/bin/corpan-yt auth
   ```
   Browser opens. Pick the Google account that owns / manages `@corpán1`.
   Token cached at `~/.config/corpora/youtube/token.json` (mode 600).
5. Sanity-check:
   ```
   .venv/bin/corpan-yt whoami
   ```
   Should print channel handle `@corpán1`. If it prints something else,
   re-run `corpan-yt auth --force` and pick a different account in the
   Google chooser. If `@corpán1` isn't in the chooser, see the
   **Brand-account note** below.

### Commands (with quota cost in units)

| Command | Quota | What |
|---|---|---|
| `corpan-yt auth [--force]` | 0 | OAuth installed-app flow. |
| `corpan-yt whoami` | 1 | Print authorized channel id / title / handle. |
| `corpan-yt list -n 25` | 1–2 | Recent uploads. |
| `corpan-yt get <video_id>` | 1 | JSON dump of metadata. |
| `corpan-yt upload <built-dir>` | ~200 | insert (~100, live-meter; some docs say 1600 but that's outdated) + thumbnail (50) + playlist (1-50, dedupes). |
| `corpan-yt patch <video_id> ...` | 51–151 | Update title/description/tags/thumbnail/playlist on an existing video. |
| `corpan-yt set-thumbnail <id> <jpg>` | 50 | Thumbnail only. |
| `corpan-yt publish <id> [--to public]` | 51 | Flip privacy. |
| `corpan-yt playlist {ls,create,add}` | 1–50 | Playlist mgmt. |
| `corpan-yt config-paths` | 0 | Print where creds + tokens live. |

### Quota math (READ THIS — three caps, not one)

There are **three separate upload caps** and they enforce on different
schedules with different error codes. Surface the one you'll actually hit
first, not the one with the largest absolute number.

| # | Cap | Error | Reset | Practical limit |
|---|---|---|---|---|
| 1 | **Channel-side daily uploads** (`@corpancaptures`) | `HTTP 400 uploadLimitExceeded` (reason `uploadLimitExceeded`, domain `youtube.video`) | **Rolling 24 h per upload** (NOT calendar midnight) | ~10–15/day on a low-trust channel |
| 2 | **GCP project "Video Uploads per day"** | `HTTP 429 rateLimitExceeded` (quota metric `'Video Uploads'`, limit `'Video Uploads per day'`) | Calendar midnight Pacific | **~7/day observed** for the default Corpán project on 2026-05-23 |
| 3 | **GCP project API units** (the "10k/day" everyone quotes) | `HTTP 403 quotaExceeded` (rare) | Calendar midnight Pacific | ~50 full uploads at ~200 units each |

#### What hits first?

Almost always **(2) before (3)** and **(1) before (2)** on a fresh day. Don't
report "201 units, well inside the 10k budget" as if you have lots of headroom
— the 10k budget is irrelevant; the 7-upload project counter is the wall.

Manual UI uploads from studio.youtube.com **count against (1) only**, not (2)
or (3). When (2) fires partway through a batch, the rest of that day's variants
ship via UI + `corpan-yt patch` for metadata (see "Manual UI upload" recipe
in the Ad-creative pipeline section above).

#### Per-call API costs (for (3))

- `videos.insert`: **observed ~100 units** (not the 1,600 most docs cite —
  verified against GCP Console meter on 2026-05-17 after 5 real uploads landed
  at 1,357 units total).
- `videos.update`, `thumbnails.set`, `playlistItems.insert`, `channels.update`:
  50 units each.
- All reads (`videos.list`, `playlistItems.list`, `channels.list`,
  `search.list`): 1 unit each.
- A full `corpan-yt upload` (insert + thumbnail + playlist add) ≈ 200 units.
- A `corpan-yt patch` (update + thumbnail + playlist add) ≈ 150 units.

#### Reset details

- Cap (1) — **rolling 24-h per upload**, not calendar midnight. Confirmed
  2026-05-23 against multiple third-party guides (Taisly, Viraly, SocialRails)
  + observed locally: 10 uploads finished by 21:28 PT one night, retry at
  00:23 PT the next day still returned `uploadLimitExceeded`. The first slot
  reopened ~19:54 PT the next evening (24 h after the *first* upload of the
  prior batch). Account verification at the YouTube account level can raise
  the ceiling (confirmed on `@corpancaptures` between 2026-05-22 and
  2026-05-23), but the rolling-window semantics stay the same.
- Cap (2) — calendar-day at midnight Pacific. So after midnight you may have
  project headroom but still be blocked by the channel-side rolling window
  (and vice versa).
- Cap (3) — calendar-day at midnight Pacific. Almost never the binding
  constraint at current cadence; only worth surfacing if a single day's plan
  is >40 uploads.

#### Raising caps

- Cap (1) relaxes organically as the channel accumulates upload history +
  watch time without strikes. No application form. Account verification helps.
- Cap (2) is the one to file a GCP increase for if you're running this
  pipeline daily. Console → *YouTube Data API v3 → Quotas → "Video Uploads
  per day" → Request increase*. 1–2 week turnaround. **This is the right
  fix if you're hitting the ~7/day wall every day.**
- Cap (3) increase form is at *Quotas & System Limits → "Queries per day"*.
  Only worth filing if you're running multiple channels or bursting
  hundreds of variants for a campaign.

### Content ID and "public domain" music — a trap

Public-domain music in the US (pre-1929 sound recordings under the Music
Modernization Act) is NOT automatically safe on YouTube. Record labels
register modern remasters / cover versions of the same underlying
recordings into Content ID, and YouTube's audio fingerprint matches
spuriously on the PD original too.

Observed on the Israel batch (2026-05-21):

- **Tanz A Bissel** (Rose Gross "restored"): clean 3/3 uploads.
- **St. Louis Blues** (ODJB 1917): claimed 4/4 uploads (worldwide or RU
  blocks). Major-label remasters are heavily fingerprinted.
- **Elman** (HMV DB 1146/1147): claimed 2/3 uploads, fingerprint-luck.

Conclusion: pre-1929 PD music popular enough to have been remastered
will trigger Content ID claims. Niche / obscure PD recordings are safer.
Fresh CC0 / CC-BY material (e.g. tanpura drones from ragajunglism.org,
freesound.org) is safest — no label has fingerprinted them.

Disputing: Studio → Content → click video → Copyright tab → Dispute,
reason "Public domain work." Explain the publication year + MMA. Most
spurious PD claims get released within a week. Cheaper long-term to
just pick non-claimed music than to dispute everything.

### Channel-side upload limit (separate from API quota!)

YouTube enforces a **per-channel daily upload cap** that's independent of
the API quota. New / low-trust channels typically get **10–15 uploads/day**
regardless of phone verification. The error looks like:

```
HttpError 400 ... "The user has exceeded the number of videos they may upload."
reason: 'uploadLimitExceeded', domain: 'youtube.video'
```

Confirmed on `@CorpanCaptures` on 2026-05-17: the 11th upload of the
day was rejected. Builds for that day's overflow live locally + on S3
and can be uploaded after midnight Pacific (or as the limit lifts).

The cap raises over time as the channel:
- Accumulates upload history without strikes
- Gets views / engagement
- Survives a few days

There's no API-side workaround. Plan accordingly: 10–15 uploads/day for
the first weeks, then it loosens.

**Reset behavior is rolling 24 h, NOT calendar midnight** (verified
2026-05-23 against multiple third-party guides — YouTube's own docs
don't spell out the reset semantics for this specific error). Each
upload "ages out" 24 hours after it landed, freeing one slot. So if you
saturated the cap with a 10-upload burst between 19:54 PT and 21:28 PT,
your first slot reopens around 19:54 PT the next day — *not* at
midnight Pacific. The API-units quota (10k/day) and the GCP project's
`Video Uploads per day` counter, in contrast, ARE calendar-day at
midnight Pacific, so you can hit a stretch where API quota is fresh but
the channel cap still won't take new uploads. The error in that state:
`HTTP 400 uploadLimitExceeded` (channel) — distinct from `HTTP 429
rateLimitExceeded` (project quota).

### Refresh-token expiry — 7-day Testing-mode trap

Until the OAuth consent screen is pushed to *Production*, refresh tokens
expire after **7 days**. `corpan-yt` will print a refresh failure and
the next command will need `corpan-yt auth` again (browser reopens).

To eliminate the weekly re-auth, push the consent screen to *In
Production* in Google Cloud Console. Note that the scopes we use
(`youtube.upload`, `youtube.force-ssl`) are *sensitive* and may require
verification — expect days to weeks.

### Brand-account note

YouTube **Brand Accounts** appear in the Google account chooser
alongside personal Gmail accounts during OAuth. If `@corpán1` is a brand
account you manage, picking it directly in the chooser will OAuth as
that brand identity, and `whoami` will print its handle.

If `@corpán1` is a **regular YouTube channel** owned by someone else and
you only have channel-permission access via YouTube Studio (Manager /
Editor), the YouTube Data API has no equivalent grant for arbitrary 3rd
parties. Options: transfer ownership to a brand account you control, or
have the actual owner run `corpan-yt auth` on their machine and
delegate operations from there.

## Color / range gotcha

iPad screen recordings come out as **`yuvj420p`** (JPEG full-range)
tagged BT.709. If you re-mux them naively (`-c:v copy` or any encode
without an explicit range conversion), the result looks washed-out or
crushed on YouTube and Safari.

Every `ffmpeg` encode in `build-capture.sh` does:

```
scale=...:in_range=full:out_range=tv,format=yuv420p
+ -colorspace bt709 -color_primaries bt709 -color_trc bt709
```

— full → limited range conversion with the same BT.709 tagging the
source was already claiming. Don't remove these filters when iterating;
the visual regression is subtle but real on consumer devices.

## iPad screen-recording rotation — strip the displaymatrix

iPadOS 26 screen recordings save a *landscape-shaped raster* + a `displaymatrix`
side-data that tells players to rotate (typically `rotation=-90` for a
portrait-held device, `rotation=-180` for upside-down landscape). Two distinct
gotchas land at different points in the pipeline:

1. **ffmpeg's default decode auto-rotates the input.** `[0:v]` in a
   `-filter_complex` graph is *already* the intended-display orientation. Adding
   a `transpose=N` filter on top will rotate again, producing sideways content.
   `-vf` and `-filter_complex` both auto-rotate; only `-noautorotate` opts out.
   Verify with: `ffmpeg -i $SRC -frames:v 1 /tmp/t.png && python3 -c
   "from PIL import Image; print(Image.open('/tmp/t.png').size)"`. If the size
   matches the user's intended display orientation, autorotate did the right
   thing and no transpose is needed.
2. **ffmpeg preserves the `displaymatrix` side data on output.** Even after the
   filter graph re-encodes into a correctly-oriented raster, the output mp4
   carries the *original* rotation matrix, and players re-rotate the result.
   Symptom: a 1920×1080 horizontal output plays as a 1080×1920 portrait in
   QuickTime; vertical 1080×1920 content appears 90° CCW; etc.

Fix is a two-pass encode + metadata-strip remux:

```
# Pass 1 — normal encode, no transpose, full filter graph
ffmpeg -y -i "$SRC" \
  -filter_complex "..." \
  -c:v libx264 -crf 18 -preset slow \
  ... \
  "$TMP"

# Pass 2 — re-mux to strip the inherited displaymatrix
ffmpeg -y -display_rotation 0 -i "$TMP" \
  -c copy -map_metadata -1 -movflags +faststart \
  "$OUT"
```

`-display_rotation 0` is an **input** option (must precede `-i`) — overrides the
source's displaymatrix to identity. Combined with `-c copy`, the remux
re-writes the moov atom without rotation side data, no quality loss.

Verify after every encode:

```
ffprobe -v error -select_streams v -show_entries stream_side_data=rotation \
  -of csv=p=0 "$OUT"
```

If a `rotation=` line appears, the remux step didn't run or `-display_rotation
0` was missing. Output should be empty / `NONE`.

Don't blindly add `transpose=2` based on "looks wrong" — extract a frame from
the autorotated decode first, confirm what it actually is, *then* decide.

## Square variant — blur vs. solid sidebars

The square (1:1) build pads the 3:4 source to 1080×1080 with **either**:

- `--square-bg blur` *(default)* — photo-portrait halo: same source
  scaled-to-fill, cropped, and `boxblur=30:1`'d behind a centered
  scaled-to-fit foreground. Works well when the capture has *visual
  variety / color* (light UI, photos, video). Smears badly when the
  source is a dark UI with crisp text edges — you get muddy side bands
  and ghosted chip-row stripes leaking off the foreground.
- `--square-bg solid` — flat-color sidebars via `pad=…:color=$SQUARE_BG_COLOR`.
  Default color `0x252525` matches the Corpán app's dark surface, so the
  seam between foreground and sidebars effectively disappears. Use this
  for any capture where the app is in its dark theme.

Set on the command line:

```
./infra/captures/build-capture.sh raw/2026-05-22/<slug>.mov \
    --square-bg solid --square-bg-color 0x252525
```

Or via env vars (`SQUARE_BG=solid`, `SQUARE_BG_COLOR=0x252525`) which
also lets `build-and-upload.sh` pass it through. We left blur as the
default because the trick is genuinely the right call when the source
has photographic content; the toggle is what to flip for dark-UI
captures.

## Encode profile

- `libx264 -preset slow -crf 18` for long, `-crf 19` for shorts/square.
- AAC 192 kbps, 48 kHz stereo.
- `loudnorm=I=-14:LRA=11:TP=-1.5` → YouTube's −14 LUFS target. Without
  this, dialogue captures sound quiet next to neighboring feed videos.
- `-movflags +faststart` so Safari/YouTube can start playback before the
  whole file arrives.
- `libx264` over `h264_videotoolbox`: VideoToolbox is faster on Apple
  Silicon but bitrate-only (no CRF), and Apple's encoder loses to x264
  at matched bitrates on text-heavy UI captures. For 10/day this is the
  right trade.

Encode time on Apple Silicon, ~76 s 1200×1600 input:
- `long.mp4`: ~20 s
- `shorts.mp4`: ~45 s (blur filter is expensive)
- `square.mp4`: ~30 s
- `thumb.jpg`: <1 s

## Ad-creative pipeline (Google Ads triplet)

The base `build-capture.sh` flow produces one video per source per variant
(long / shorts / square) for organic YouTube uploads. **Google Ads creatives
need something different**: the same source rendered at three aspect ratios
(16:9, 9:16, 1:1) *as parallel A/B-able creatives*, often crossed with
multiple music tracks, with per-variant SEO copy. This pipeline runs in
parallel with the base one — no shared CLI yet, just a documented recipe.

Used since 2026-05-22 for the Singapore series, India full tour, and
IMG_0143/0147/0151 sets. Look at `built/2026-05-23/singapore-*/` and
`built/2026-05-23/img0143-*/` for canonical examples on disk.

### Three Google Ads aspect ratios with blur padding

Output sizes:

```
horizontal: 1920×1080  (16:9 — in-stream, desktop, TV)
vertical:   1080×1920  (9:16 — Shorts, mobile Discover)
square:     1080×1080  (1:1  — in-feed YouTube, Instagram/Facebook crossover)
```

Per-variant filter chain (replace `<fg_scale>` and `<bg_spec>` from the table
below):

```
[0:v]scale=in_range=full:out_range=tv,format=yuv420p,split=2[fg][bg];
[bg]<bg_spec>[bgb];
[fg]<fg_scale>[fgs];
[bgb][fgs]overlay=x=(W-w)/2:y=(H-h)/2,setsar=1,format=yuv420p[vout]
```

| variant     | output      | `fg_scale`                                                 | `bg_spec`                                                                                  |
|-------------|-------------|-----------------------------------------------------------|--------------------------------------------------------------------------------------------|
| horizontal  | 1920×1080   | `scale=-2:1080` (fit height) for landscape source; `scale=-2:1080` (still fit height) for portrait — fg ends up 810×1080 with heavy side-blur | `scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=30:1` |
| vertical    | 1080×1920   | `scale=1080:-2` (fit width)                                | `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=30:1` |
| square      | 1080×1080   | `scale=1080:-2` from landscape source; `scale=-2:1080` from portrait — pick the side that fits inside the square | `scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=30:1` |

Foreground is always picked so the source fits *inside* the output frame with
blur making up the difference — **no crop**, ever. For the `vertical` variant
overlay, use `y=(H-h)*0.25` (top-biased; leaves more bottom space for
Reels/Shorts UI overlays). Horizontal and square center vertically.

Portrait sources will produce ~555 px of side-blur in the horizontal output
(foreground only 810 px wide of the 1920 px frame). That's inherent; the user
calls it "looks pretty good but it's like a long vertical short format." The
alternative would be cropping content, which we don't.

### Equal-weight music mix (no ducking, "music-video vibe")

`mix-bgm.py` applies sidechain ducking. For screen-recording ad creatives that
have no voiceover — only UI tap sounds — that's overkill, and the source audio
ends up nearly inaudible. For the music-video vibe (music carries, source
provides ambience at half weight), use this inline filter chain instead:

```
[1:a]aresample=48000,atrim=0:$DUR,asetpts=PTS-STARTPTS,
  afade=t=out:st=$FADESTART:d=3[bgm];                  # 3s music fade-out
[0:a][bgm]amix=inputs=2:duration=first:weights=1 1:normalize=1[mixed];
[mixed]afade=t=out:st=$FMIX:d=0.2,
  loudnorm=I=-14:LRA=11:TP=-1.5[out]                   # 0.2s click-killer + YouTube -14 LUFS
```

Where `$DUR` = video duration (seconds), `$FADESTART = $DUR - 3`,
`$FMIX = $DUR - 0.2`.

Use `mix-bgm.py` when you have voiceover and need ducking. Use this inline
recipe when you don't.

### DAW WAV pre-clean step — NOT optional

WAVs exported from a DAW (Logic, Ableton, etc.) typically embed a `JUNK` chunk
+ arbitrary marker/cue chunks. When you feed such a WAV into a `-filter_complex`
graph that outputs mp4, those non-PCM chunks come out as a **third stream** in
the output: `codec_type=data`, `codec_name=bin_data`, `codec_tag=text`,
duration equal to the original WAV's full length.

**Symptom**: QuickTime reports the output mp4 as 60+ s longer than it actually
plays. Confirmed on `fairy-gnomes-going-forth.wav` and `do-you-play-instru.wav`;
not on a wav I had previously re-encoded through ffmpeg (which had already
stripped the JUNK chunk). The user described it as "seems to be an extra ~60
seconds for some reason." Took ~30 min to diagnose.

Fix — pre-clean every DAW-origin WAV before mixing:

```
ffmpeg -y -i original.wav \
  -map 0:a -map_metadata -1 -c:a pcm_s16le clean.wav
```

`-map 0:a` selects only the audio stream (drops the data chunks).
`-map_metadata -1` drops file-level metadata. The output is byte-different
from the input but the audio is bit-identical PCM at 48 kHz / 16-bit.

`-dn -sn` on the **mp4 muxer alone** is NOT sufficient — the data stream is
auto-attached during muxing after the filter graph completes, and explicit
output stream mapping (`-map 0:v -map "[out]"`) doesn't suppress it. The fix
has to happen on the **input side**: pre-process the WAVs first.

### Music bed assembly (single track + crossfade)

When the music track is longer than the video, `atrim=0:$DUR` in the audio
chain is enough.

When the video is longer than the longest single track (e.g. India full tour
was 4:37 with no single track > 4:11), build a multi-track bed via
`acrossfade` *before* the mix step:

```
ffmpeg -y -i lets-dance.wav -i cake-bengal.wav \
  -filter_complex "
    [0:a]aresample=48000[a];
    [1:a]aresample=48000,atrim=0:$CAKE_LEN,asetpts=PTS-STARTPTS[b];
    [a][b]acrossfade=d=4:c1=tri:c2=tri[bed]
  " \
  -map "[bed]" -c:a pcm_s16le bed.wav
```

Output bed length = `len(a) + len(b) - crossfade_d`. Pick `$CAKE_LEN` so the
final equals your video duration. Then use `bed.wav` as the music input in
the mix step.

### Head-protected dead-air trim

`trim-deadair.py` cuts dead segments throughout the source. Sometimes you want
to trim only *part* of the video — e.g. "trim dead air in the first 2 min, but
leave everything after 2:00 verbatim because that's the Stargate Reader tail."

There's no CLI flag for this — pattern is an inline Python that imports
`trim-deadair.py`'s detection functions, filters dead intervals to a target
zone (e.g. `[10, 120]`), builds a custom `filter_complex` with `trim`/`atrim`
per live segment + `concat`, and runs ffmpeg once. See the India full tour
build for the canonical example (2026-05-22; commands logged in conversation,
output at `raw/2026-05-22/india-big-stack-horizontal-onboard-main-stargate.horizontal.mp4`).

Two protect zones are useful:

- **Head protect** (e.g. preserve first 10 s untouched): even if it's silent,
  preserves a "breathe in" moment for the music to ramp up before content
  starts. Lower-bound the dead-interval filter at `PROTECT_HEAD`.
- **Tail protect** (e.g. preserve everything after the 2-min mark): used when
  a known section of the source (Stargate Reader, an outro card) needs to be
  fully intact. Upper-bound the dead-interval filter at `PROTECT_TAIL`.

### `variant_overrides` for per-aspect SEO copy

`meta.json`'s `youtube.variant_overrides.<variant>` block carries per-variant
overrides that `corpan-yt upload --variant <name>` applies on top of the base:

```jsonc
"variant_overrides": {
  "horizontal": {
    "title": "<benefit-led, ~60 chars — mobile truncates beyond>",
    "description": "<keyword-front-loaded paragraph + app links + music credit + #hashtags>",
    "additional_tags": ["wild-ride", "four languages", "audiobook reader"]
  },
  "vertical": {
    "title": "<punchy, ends with #Shorts>",
    "description": "<Shorts-feed copy; include #Shorts in body>",
    "additional_tags": ["do-you-play-instru", "shorts", "polyglot shorts"]
  },
  "square": {
    "title": "<value-prop, feed-friendly>",
    "description": "<social-feed copy>",
    "additional_tags": ["lets-dance-tamil", "language stack"]
  }
}
```

CLI honors `title` (replaces base), `description` (replaces; use plain
`description_suffix` for append-only — useful when the only per-variant
variation is a music credit), `additional_tags` (concatenates with base
`tags`). See `youtube/corpan_yt/cli.py upload()` for the full list of
overridable fields.

YouTube ad-SEO levers worth varying per variant:

- First 100–150 chars of description (what shows above the "more" button in feed)
- First 3 hashtags become **clickable above the title**
- Title formula: benefit-led for horizontal in-stream; list/CTA for vertical
  Shorts; value-prop for square in-feed. Don't make all three identical or
  they cannibalize each other in search.
- Native-script tags (e.g. `தமிழ்`, `中文`, `繁體中文`) boost discovery
  in regional markets.
- `defaultLanguage` and `defaultAudioLanguage` strongly affect Discover
  surfacing — set them per the *content's* target audience, not the
  audio language.

### Manual UI upload + `corpan-yt patch` fallback

When the **project-level "Video Uploads per day" quota** (see the Quota math
section) is exhausted but the channel cap is still clear, upload via
studio.youtube.com directly — UI uploads do NOT count against the project
quota counter (different API surface), only against the channel-side rolling
24-h cap. Then patch metadata via the API (each `patch` call is ~150 units —
doesn't touch the daily-uploads counter at all):

```
corpan-yt patch <video_id> \
  --from-meta built/<date>/<slug>/meta.json \
  --thumbnail built/<date>/<slug>/thumb.jpg \
  --playlist "Corpán — <series> series"
```

`--from-meta` loads base title/description/tags/playlist/category/lang.
**Variant-specific overrides are NOT auto-applied by `patch`** — assemble
them manually before the call:

```python
ov = yt_meta["variant_overrides"][variant_name]
desc = yt_meta["description"] + ov.get("description_suffix", "")
if "description" in ov:
    desc = ov["description"]
tags = yt_meta["tags"] + ov.get("additional_tags", [])
subprocess.run([
  "corpan-yt", "patch", video_id,
  "--title", ov.get("title") or yt_meta["title"],
  "--description", desc,
  "--tags", ",".join(tags),
  "--category-id", str(yt_meta["category_id"]),
  "--privacy", yt_meta["privacy"],
  "--default-language", yt_meta["default_language"],
  "--default-audio-language", yt_meta["default_audio_language"],
  "--thumbnail", thumb_path,
  "--playlist", yt_meta["playlist"],
])
```

**Known flake: `--tags` set via the first patch occasionally doesn't take.**
Symptom: the patch CLI reports OK, the immediately-following `corpan-yt get`
shows `tags: []`. Happened on ~3 of 10 patches in 2026-05-23. Workaround:
follow up with an explicit `--tags <csv>` re-patch after a brief sleep (~5 s);
re-verify with `get`. Single retry always sticks.

Record the UI upload in `meta.json` `youtube.uploads.<variant>` with
`"uploaded_via": "youtube-studio-ui"` so the local archive matches what's
live and future CLI runs don't try to re-upload the same variant (the
`upload()` command refuses if `uploads.<variant>` exists).

## Patch-an-already-uploaded-video recipe

Ian's posted a manual upload; you want to fix tags + add the right
thumbnail + add to the playlist:

```
# Grab Ian's video_id from the YT Studio URL
VID=dQw4w9WgXcQ

corpan-yt patch "$VID" \
  --from-meta "$HOME/Desktop/Corpan Captures/built/2026-05-17/<slug>/meta.json" \
  --thumbnail "$HOME/Desktop/Corpan Captures/built/2026-05-17/<slug>/thumb.jpg"
```

That's ~151 units, vs 1700 if we'd uploaded ourselves.

## Out of scope (for now)

- Branded thumbnail overlays (logo, country flag, language chips).
- Per-language `localizations[]` (AR/FR/EN title + description for
  better discoverability in those locales).
- Subtitle/CC SRTs (`captions.insert`).
- Migration of the three legacy `s3://corpan-assets/new-video-assets/*.mov` files.
