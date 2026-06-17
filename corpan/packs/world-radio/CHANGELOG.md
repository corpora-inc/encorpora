# Changelog — World Radio pack

Distributed as a Corpán pack via the `encorpora.io` catalog.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.6.4] - 2026-06-16
### Changed
- Refreshed the pack avatar artwork.

## [0.6.3] - 2026-05-19
### Changed
- Cold-start in airplane mode now shows a calm "World Radio needs
  internet" notice on the language list and station list, instead of
  an alarming red "Couldn't reach the radio directory" error card. The
  language list also auto-refreshes when the connection returns, so
  users don't need to manually tap "Try again".

## [0.6.2] - 2026-05-17

### Changed
- "Loading the world map…" skeleton now fills the entire map slot
  instead of sitting in a short rounded panel, so the rotating globe
  and shimmer take up the full available height on phones and
  tablets.

## [0.6.1] - 2026-05-06

### Changed
- World map screen drops the "World map" title and station-count subtitle.
  The tab label and the markers themselves convey what's on screen, and
  reclaiming that vertical space gives the map (and the language chip
  strip below the filter rail) noticeably more room on phones.

## [0.6.0] - 2026-05-06

### Added
- Global, top-level world map (Browse → World map tab). Shows the top
  ~10k stations across every language; stations without precise coordinates
  are placed at their country's centroid with a small deterministic jitter
  so they fan out instead of stacking. Search, language multi-select, and
  tag filters narrow the map without losing pan/zoom. Marker clustering
  uses chunked loading to stay responsive at world zoom. The global
  station list is held in memory for the lifetime of the pack mount —
  no localStorage write — so it can't crowd out the shared per-origin
  storage budget that other Corpán packs depend on.

### Fixed
- HTTP-only stations no longer fail on Android release builds. Cleartext is
  now permitted via a `network_security_config.xml` shipped inside
  `tauri-plugin-radio-stream` (mirrors the iOS `NSAllowsArbitraryLoadsForMedia`
  exception). Without this, ≈75% of stations on the Samsung S938U
  internal-testing build hit `ERROR_CODE_IO_NETWORK_CONNECTION_FAILED`.
  Requires `tauri-plugin-radio-stream ≥ 0.1.1`.
- Player bar no longer flashes-and-hides when a station fails. The native
  plugin now holds the error state visible until the user picks another
  station or hits stop, and the user-visible message is "Couldn't connect
  to the station" instead of the cryptic "Source error".

## [0.5.0] - 2026-05-01

Skipped 0.4.x for tetraphobia. This is the native-streaming generation —
ships alongside Corpan 0.12.0 (gated via `minAppVersion` in the catalog;
also probes at runtime and falls back to HTML5 audio on older hosts).

### Added
- Native streaming via `tauri-plugin-radio-stream` (ExoPlayer on Android,
  AVPlayer on iOS) — replaces the WebView `<audio>` element on Tauri hosts
  for true background playback.
- Lock-screen / Control Center transport: play, pause, stop, station name,
  country, artwork; tap notification body returns to the app.
- ICY / Shoutcast `StreamTitle` capture → live now-playing strip in the
  player bar and lock-screen subtitle that update with each track change.
- Audio-focus suppression visibility on Android: clear in-app message
  ("Audio is in use by another app — will resume when it's free") instead
  of silent failure during a phone call or other media interruption.
- Auto fallback to HTML5 player on hosts without the native plugin (browser
  dev + Corpan ≤ 0.11.x). Pack probes the host once at init and picks the
  WebView player if `radio-stream` isn't registered.

### Changed
- Map view layout reworked as a three-row flex column (`HEADER / MAP /
  CONTROLS`) on `.wr-root`. Map fills edge-to-edge between the sticky
  header and the player bar with no gap. Player bar is a flex sibling
  (not an absolute overlay) — content is centered above the safe-area
  inset, with an Android floor of 12 px so the bar clears the gesture
  handle even when `env(safe-area-inset-bottom)` reports 0.
- Subtitle ("N stations · M with location") hidden in map mode; the
  markers themselves convey density.

### Fixed
- iOS pause-then-resume on the lock-screen widget. Live HTTP streams
  (Shoutcast/Icecast) can't resume from a stalled `AVPlayerItem`; we now
  rebuild the item from the saved URL on every resume. `AVAudioSession`
  uses `routeSharingPolicy: .longForm` so iOS keeps the now-playing
  widget attached through pause/resume cycles.
- Removed `MPNowPlayingInfoPropertyIsLiveStream` — the IsLiveStream +
  `PlaybackRate=0` combination caused iOS to interpret pause as
  "stream ended" and show "Not Playing" with an unreachable play button.

## [0.3.1] - 2026-04-30
### Fixed
- Drop stations the current platform can't decode before they reach the list:
  AAC+/AACP on Android Chromium WebView, OGG/Vorbis on Apple, and plain-HTTP
  streams on iOS / iPadOS (ATS).

## [0.3.0] - 2026-04-30
### Changed
- Radio next follow-up (#235): version bump for the post-Narrators polish.

## [0.2.2] - 2026-04
### Changed
- Bundled with the readers + radio polish pass.

## [0.2.x] - 2026-04 — Safe area (#234)
### Fixed
- Safe-area insets on iOS / iPadOS.

## [0.2.x] - 2026-04 (#233 — Narrators in catalog)
### Added
- Initial pack catalog entry alongside the Narrators rollout.

## Older

See `git log corpan/packs/world-radio/` for the pack's origin.
