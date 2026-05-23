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

### Quota math (READ THIS — corrected 2026-05-17)

- Default project quota: **10,000 units/day**, reset midnight Pacific.
- `videos.insert` (the upload itself): **observed ~100 units in the live
  GCP meter**, *not* the 1,600 most docs and third-party guides quote.
  Confirmed against the GCP Console quota dashboard on 2026-05-17 after
  5 real uploads landed the meter at 1,357 units total.
- `videos.update`, `thumbnails.set`, `playlistItems.insert`, `channels.update`
  = 50 units each.
- All reads (`videos.list`, `playlistItems.list`, `channels.list`,
  `search.list`) = 1 unit each.

Practical implications:

- A full `corpan-yt upload` (insert + thumbnail + playlist add) is **~200
  units**, not the 1,700 my CLI originally printed. So default budget =
  **roughly 50–80 uploads/day**, not 6.
- For Corpán Captures cadence (10–60 captures/day, ≤3 variants each),
  the default 10,000-unit allotment is comfortable.
- A quota extension request becomes worthwhile only above ~80 uploads/day,
  e.g. if you start running the pipeline for multiple channels or burst
  hundreds of variants for a campaign. To file: GCP Console → *YouTube
  Data API v3* → *Quotas & System Limits* → "Queries per day" row →
  "Apply for higher quota". Audit + ~1–2 week turnaround.

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
