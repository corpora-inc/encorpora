# Narrated lesson videos

AMP binds reviewed videos to problem families in `src/content/lesson-videos.ts`.
The shared lesson view offers optional playback in the lesson library, skill
pages, and practice. The written example and method stay available. Opening a
lesson makes no media request; opening its video loads the poster, and pressing
play loads the movie. Captions and a readable transcript accompany narration.
During practice the server omits a video whose worked answer would answer the
active problem. Existing assistance tracking applies when the lesson is opened.

The first binding is `add-fractions`: a 69-second explanation of two thirds plus
one fourth. It uses Madeline Brousseaux, voice ID `XescS24CsOySAkKrLAO3`.

## Make the film

**The only rule for films (Skylar, 2026-11-17): make incredible, amazing, viral films that people love.** Length, voice, look, formats and process are the film's call.

What the tooling reads: `scripts/publish-lesson-video.py` expects the narration's voice ID, model and audio SHA-256
in `assets/narration.json`, and a versioned manifest under `src/content/videos/` with explicit template bindings,
transcript, all worked answers, voice ID, URLs and file hashes. Bind only families whose method the video actually
teaches, and leave out a video whose worked answer would answer the learner's active problem (the server does this).

The [fraction-addition source package](https://d38iwc9748jekz.cloudfront.net/amp/lessons/fraction-addition/v2/lesson-source.zip)
contains the reviewed script, narration, word timings, Blender scene, compositor,
voice validation, and build instructions. It requires Blender, FFmpeg, Python,
Pillow, and the documented font. Its scene and arithmetic assertions implement
this particular example. New mathematical models need authored geometry and
timing; changing the problem numbers alone is insufficient. The orchestration,
voice checks, typography, captioning, caching, and delivery workflow are reusable.

## Deliver to AMP

Media lives outside Git on an existing S3-backed CDN. Each manifest version has
its own immutable directory; publish changed bytes under a new version. The
manifest and component changes ship through the normal AMP PR gates. No YouTube
player, advertising, or tracking request is embedded in the lesson.

From `amp/`, after configuring authorized AWS credentials:

```sh
python3 scripts/publish-lesson-video.py src/content/videos/<lesson>.v1.json \
  /path/to/production --bucket <bucket> --profile <profile>
```

The production folder contains `assets/narration.mp3`, its metadata, and
`deliverables/`. The command validates all file hashes and the approved voice,
refuses to replace existing object keys, uploads to the CDN's `artifacts/` origin
prefix, and downloads each delivered asset to verify its hash. The CDN must
support anonymous cross-origin GET/HEAD, byte ranges, `video/mp4`, and `text/vtt`.
An unavailable video must leave the transcript and written lesson usable.

## Deliver to YouTube

Use the same clean MP4, SRT, and poster. Set a specific title and a description
that explains the example and links to its AMP lesson. Keep OAuth credentials
and upload receipts outside Git. `AMP_YOUTUBE_TOKEN` points to an authorized-user
JSON; `AMP_YOUTUBE_CHANNEL_ID` pins the intended channel.

```sh
python3 scripts/publish-lesson-youtube.py src/content/videos/<lesson>.v1.json \
  /path/to/production/deliverables /private/path/youtube-receipt.json \
  --title 'Lesson title | AMP' --description-file /path/to/description.txt \
  --plan /private/path/release-plan.json
```

The command prepares a private upload, attaches captions and the poster, and
records its video ID for reuse. Copy `docs/youtube-release-plan.example.json` to private storage and complete
it from the actual brief and Studio review. The release plan follows the
[shared YouTube policy](../../docs/youtube-publishing.md) and records the intended
audience, disclosure decision, pinned CTA, and browser-verified Studio settings.
Once processing and review are complete, rerun with `--schedule`. It chooses a
four-hour America/New_York slot near upload +24 hours, checks the channel's
existing public/scheduled releases, enforces a 12-hour minimum hold, four-hour
spacing, and at most six releases per rolling 24 hours, and reads back the schedule.
`publishAt` in the plan can request a specific compliant slot. Immediate-public
upload is not supported. An existing public video is never returned to private.

The uploader queues the prepared pinned-comment action in its local receipt;
it does not execute a future browser action on its own. A release worker must
post/pin and verify the comment after publication. The same worker verifies
comments and playback. Studio-only checks must be completed and recorded, not
inferred from a successful Data API call. Run `python3 -m unittest discover -s
scripts -p test_youtube_policy.py` to verify release safeguards.

## Integration checks

Run `npm run tsc`, `npm run test:core`, and
`npx tsx scripts/verify-lesson-video-ui.ts` for integration changes. The browser
check exercises real hosted playback, captions, network failures, responsive
layout, and closing a playing video. It requires Playwright Chromium and WebKit.
