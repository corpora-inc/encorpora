# Changelog — tauri-plugin-radio-stream

Tauri 2 mobile plugin powering the World Radio pack's native streaming.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

## [0.1.0] - 2026-05-01

Initial release. Wraps platform-native streaming players for live HTTP /
HLS / ICY internet radio so the World Radio pack can play in the
background, integrate with the OS now-playing UI, and survive screen lock
on iOS and Android.

### Added
- **Commands**: `play(url, stationName, country, language, faviconUrl)`,
  `pause()`, `resume()`, `stop()`, `set_volume(volume)`,
  `register_listener(event, handler)`, `remove_listener(event, channelId)`.
- **Events** (dual-dispatched via `window.__radioStreamEvent` and Tauri
  Channel for reliable delivery on Android 14 / Media3 1.4):
  `state-changed`, `icy-metadata`, `remote-command`, `interruption`.
- **Android (Kotlin)**: clean `MediaSessionService` + `MediaController` +
  `DefaultMediaNotificationProvider`. ExoPlayer with `Icy-MetaData: 1`
  request header for Shoutcast/Icecast inline track metadata. Auto-foregrounds
  when `player.isPlaying` flips to true. Tap-to-return wired via session
  activity intent. Audio focus suppression (e.g. phone call) surfaced via
  `onPlaybackSuppressionReasonChanged`.
- **iOS (Swift)**: `AVAudioSession.playback` + `routeSharingPolicy: .longForm`
  so the lock-screen widget stays attached through pause/resume cycles.
  `MPNowPlayingInfoCenter` populated with title / artist / artwork.
  `MPRemoteCommandCenter` handles play / pause / stop / togglePlayPause.
  Live-stream pause hardened: `resume()` rebuilds the `AVPlayerItem` from
  the saved URL, since paused live streams can't resume from a stalled
  buffer. `AVAudioSession.interruptionNotification` and
  `routeChangeNotification` (headphones-noisy) handled.
- **JS bridge**: `packs/shared/audio/nativeRadio.ts` — direct WebView
  `evaluateJavaScript` event delivery alongside the Tauri Channel.
- **Probe**: `probeNativeRadio()` exposed to host packs so they can
  detect plugin availability on legacy Corpan builds and fall back
  cleanly to WebView audio.
