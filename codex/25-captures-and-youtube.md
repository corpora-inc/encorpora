# 25. Captures and YouTube

## What it is

Captures are the short marketing videos that go to the Corpán
YouTube channel (`@corpán1`) and to Google Ads. Each capture is
born as an iPad screen recording of the app in use, runs through
a fixed ffmpeg pipeline that produces four delivery variants
(long, shorts, square, thumb), and optionally uploads to YouTube
through a small Python CLI. The whole pipeline lives at
`corpan/infra/captures/`.

This is distinct from the marketing assets in section 24's
`s3://corpan-assets/marketing/` (which are App Store and Play
Store screenshots and 15-30 second App Previews). Captures are
60-180 second videos for the YouTube channel and for paid Google
Ads creatives.

## How it fits

Captures are the producer end of the marketing loop. The
pipeline is offline (a developer or marketer kicks it off from a
laptop); the artifacts go to `s3://corpan-assets/captures/` and
(for the long form) directly to YouTube through the `corpan-yt`
CLI. The consumer side is YouTube viewers and Google Ads
audiences; neither lives in the running Corpán app.

The same shape as the narration pipeline (sections 18, 20-22):
producer-consumer split, files on disk as the contract,
hydration scripts to round-trip between local and S3. The
captures pipeline reuses the same auth pattern
(`~/Code/corpora/encorpora/.env` for AWS credentials).

## Files and entry points

- `corpan/infra/captures/CAPTURES.md`: the canonical doc.
  Layout, sidecar format, the YouTube field mapping.
- `corpan/infra/captures/build-capture.sh`: build one raw `.mov`
  into the four variants (long.mp4, shorts.mp4, square.mp4,
  thumb.jpg) plus a `meta.json` manifest.
- `corpan/infra/captures/build-and-upload.sh`: wrapper around
  `build-capture.sh` that follows up with `corpan-yt upload`.
  Supports `--no-upload` to skip the upload (useful when the
  YouTube `videos.insert` quota is exhausted for the day).
- `corpan/infra/captures/sync-captures-to-s3.sh`: push local
  captures (raw + built) to `s3://corpan-assets/captures/`.
- `corpan/infra/captures/hydrate-captures.sh`: pull captures
  back from S3 to local.
- `corpan/infra/captures/trim-deadair.py`: Python script that
  trims silence from raw captures before the ffmpeg pipeline.
- `corpan/infra/captures/mix-bgm.py`: Python script that mixes
  background music under a built variant.
- `corpan/infra/captures/branding/`: channel-level assets
  (avatar, banner, watermark, localized strings in
  `localizations.json`).
- `corpan/infra/captures/youtube/`: the Python CLI.
  - `pyproject.toml` declares `corpan-yt` as the script entry,
    dependencies `google-api-python-client`,
    `google-auth-oauthlib`, `google-auth-httplib2`, and
    `click`.
  - `corpan_yt/cli.py` is the click-based CLI.

## How it works

### The capture lifecycle

End to end, a single capture goes through:

```
[iPad screen recording -> ~/Desktop/Corpan Captures/raw/YYYY-MM-DD/<slug>.mov]
                |
[Hand-edit <slug>.meta.json sidecar: title, description, tags, languages]
                |
[./build-capture.sh <raw.mov>]
                |
[ffmpeg produces four variants in built/YYYY-MM-DD/<slug>/:
    long.mp4    1200x1600 vertical, cleaned for YouTube
    shorts.mp4  1080x1920 (9:16), blur-padded, <=180 s
    square.mp4  1080x1080 (1:1), blur-padded
    thumb.jpg   1280x720 thumbnail, blur-padded ]
                |
[./sync-captures-to-s3.sh  (raw + built mirrored to S3)]
                |
[corpan-yt upload <built-dir>  (long variant -> YouTube)]
                |
[Google Ads pulls from the S3 captures/ tree for paid creatives]
```

`build-and-upload.sh` is the convenience wrapper that bundles
the build, sync, and upload into one call.

### The four delivery variants

The pipeline's defining choice is to produce four variants from
one raw capture instead of asking the marketer to build them
separately. Each variant has its own use:

- **long.mp4**: the main YouTube upload. 1200x1600 vertical,
  color-converted from the iPad's `yuvj420p` full-range to
  YouTube-friendly `yuv420p` limited range so it does not look
  washed out.
- **shorts.mp4**: YouTube Shorts, capped at 180 seconds, 9:16
  with the source video centered and a Gaussian-blurred copy
  filling the side bars.
- **square.mp4**: 1:1 aspect for Instagram and certain Google
  Ads slots. Same blur-pad technique, with an option for
  `SQUARE_BG=solid` and `SQUARE_BG_COLOR=0x252525` when the
  source is a dark UI and the blur looks muddy.
- **thumb.jpg**: 1280x720 16:9 thumbnail with the same
  blur-pad technique. The first frame of the long variant or a
  chosen poster frame, depending on the sidecar.

The colour-space normalization step is the kind of detail the
pipeline encodes for everyone's benefit. iPad screen recordings
come out as `yuvj420p` (JPEG full-range) tagged BT.709. Every
encode in this pipeline converts to `yuv420p` limited-range so
the result looks correct on YouTube and on Safari; without the
conversion, the colors are washed out on every platform that
respects the metadata.

### The sidecar

Each raw `.mov` lives next to a `<slug>.meta.json` sidecar that
the marketer hand-edits. The sidecar drives the YouTube fields:
title, description, tags, primary language, secondary languages
spoken in the video, visibility (public, unlisted, private),
playlist memberships, category. The build script copies the
sidecar into the built directory's `meta.json` along with build-
time fields it adds automatically (dimensions, durations,
codec).

If the sidecar is missing, `build-capture.sh` writes a stub and
exits non-zero. The first run of a new capture is therefore "the
script writes a stub, the marketer fills in the fields, the
marketer re-runs." This is the smallest workflow that makes the
sidecar mandatory without making it tedious.

### Naming

The slug format encodes scene plus country plus languages
captured in the video:

```
main-exp-algeria_ar-en-fr-tr-es-zh
pack-discovery-morocco_ar-fr
```

`kebab-case` for the scene and country, joined with `-`; an
underscore separates the human-meta from the language list;
ISO 639-1 language codes joined with `-`. The build script does
not enforce the format, but consistent naming makes the S3
captures tree grep-able for "every capture with Arabic" or
"every Morocco capture."

### S3 layout

The bucket layout mirrors the local layout:

```
s3://corpan-assets/captures/
├── raw/YYYY-MM-DD/<slug>.mov
├── raw/YYYY-MM-DD/<slug>.meta.json
└── built/YYYY-MM-DD/<slug>/{long,shorts,square}.mp4
                          /thumb.jpg
                          /meta.json
```

`sync-captures-to-s3.sh` is the up-sync; `hydrate-captures.sh`
is the down-sync. Both use the same AWS credentials pattern
(`~/Code/corpora/encorpora/.env` or `AWS_PROFILE`).

### The YouTube CLI

`corpan-yt` is a Python click CLI that wraps Google's YouTube
Data API v3. Its commands cover the lifecycle of a YouTube
video: `upload`, `update`, `set-thumbnail`, `add-to-playlist`,
and the auth handshake (`auth-init` / `auth-refresh`).

Dependencies are minimal: `google-api-python-client` for the
API client, `google-auth-oauthlib` for the OAuth flow,
`click` for the CLI scaffolding. Auth tokens are stored on
disk; the OAuth flow runs once per workstation.

`videos.insert` (the underlying API call for `upload`) has a
daily quota; when it is exhausted, the CLI returns a clear
error and `build-and-upload.sh` skips the upload step but still
completes the build and the S3 sync. The next-day rerun picks
up the upload.

### Channel-level branding

The `branding/` subdirectory holds the channel-level assets:
`channel-avatar.png`, `channel-banner.jpg`, two watermark
variants. `localizations.json` carries the per-locale channel
title and description. These do not change per capture; they
change a few times a year, set through the YouTube web UI or
through the CLI's channel-level commands.

## Common operations

1. **Build a single capture.** Drop the iPad recording into
   `~/Desktop/Corpan Captures/raw/YYYY-MM-DD/<slug>.mov`. Run
   `./corpan/infra/captures/build-capture.sh <path-to-mov>`.
   Fill in the sidecar when it errors out, rerun.
2. **Build and upload in one step.**
   `./corpan/infra/captures/build-and-upload.sh <raw.mov>`.
   `--no-upload` to skip the YouTube upload but still produce
   the variants.
3. **Push captures to S3.**
   `./corpan/infra/captures/sync-captures-to-s3.sh`. Idempotent;
   re-runs are cheap.
4. **Re-encode a single variant.**
   `./corpan/infra/captures/build-capture.sh <raw.mov> --variants shorts`.
   The other variants are not rebuilt.
5. **Tune the square variant for a dark UI scene.** Set
   `SQUARE_BG=solid` and (optionally)
   `SQUARE_BG_COLOR=0x252525` in the environment before calling
   `build-capture.sh`.
6. **Re-upload an already-built capture.**
   `corpan-yt upload <built-dir>`. The CLI is idempotent on
   identity; it errors if the video already has a YouTube id
   recorded in the meta.json.

## Why we built it this way

Four variants from one source is the choice that respects the
marketer's time. The Shorts vertical, the YouTube long form,
the square Instagram cut, and the thumbnail are all derivable
from the same source by fixed transforms; building them by
hand four times would mean four chances to introduce a quality
drift between them. The pipeline produces the same set every
time.

The blur-pad technique for the side bars is the small
production-value choice that distinguishes the captures from
the typical "letter-boxed iPad recording" look. The cost is one
extra ffmpeg filter; the visual difference is obvious.

The `yuvj420p` to `yuv420p` color normalization is the kind of
detail that earns the comment in the script. The first
captures that went up without the conversion looked washed out
on Safari and on the YouTube watch page, even though they
looked fine in QuickTime; documenting the conversion in the
script's header means the next capture pipeline maintainer
does not have to rediscover the cause.

The sidecar-as-mandatory step is the smallest discipline that
keeps YouTube metadata honest. The pipeline could auto-derive a
title from the slug, but the slug is for organization, not for
viewers; making the marketer fill in the title is what keeps
the channel listings coherent.

The Python CLI instead of the YouTube web UI is the choice
that makes uploads scriptable. A multi-language capture run
produces several variants per video and several videos per
session; clicking through the YouTube UI for each is the kind
of repetitive work that breeds mistakes. `corpan-yt` is a few
hundred lines of Python that absorbs the repetition.

## To go deeper

- `corpan/infra/captures/CAPTURES.md` end to end. The
  authoritative doc.
- The YouTube Data API v3 docs at
  `developers.google.com/youtube/v3` for the underlying API
  the CLI calls.
- `corpan/infra/captures/youtube/corpan_yt/cli.py` for the
  click command tree.
- Section 24 for the S3 / CloudFront layout the captures bucket
  shares; section 18 for the audio-side discipline that the
  captures pipeline's color-space discipline mirrors.
