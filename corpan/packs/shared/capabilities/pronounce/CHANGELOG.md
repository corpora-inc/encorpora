# Changelog — cap-pronounce (@corpan/cap-pronounce)

Capability module: show phrase → hold-to-record → whisper score → per-word
pill feedback. Extracted from pronunciation-coach (Parlometron).
Not independently shippable — user-visible changes also land in each
consuming unit's changelog (corpan/CHANGELOGS.md).

**Consumers to rebuild on change:** pronunciation-coach (and corpan-app once
the Journey `speak_echo` card + pop-in sheet consume it, Wave 2).

## 0.1.0 — Unreleased

- **`sttModel` host seam + single model-pick source.** The installed-model
  resolution (`pickInstalledModelFolder`, plus new pure `pickBestFolder` /
  `probeInstalledFolders`) moved to `src/modelPick.ts` so a host's stt store and
  this capability share ONE implementation. `boot()` now consults
  `hostApi.sttModel?.resolveFolder()` first (reusing the app's already-resolved
  model) and reports back via `notePrepared()`, falling back to its own probe on
  hosts without the seam.
- **Never offers the tiny model over an installed one (R1).** `boot()` prepares
  the installed/resolved model with `prepareWithMemoryRetry` (10×1.5s) instead of
  a single shot, so a transient `INSUFFICIENT_MEMORY` from the native headroom
  gate no longer misreads as "not installed" and falls through to a redundant
  download offer. An installed model that genuinely won't load now settles
  `sttUnavailable` rather than offering tiny. `checkAvailability` probes every
  known folder (not just the memory-visible subset).
- **`settleOnTopBand` param (default true).** Consumers can keep the round OPEN
  after a top-band attempt so feedback dwells (Journey passes `false`); the pack
  keeps its instant-settle pacing by default.
- **Scroll-away + stuck-spinner robustness (R3).** A recording cancelled by
  `pause()` (scroll-away) now surfaces a muted `recordingCancelled` notice on
  `resume()` instead of vanishing; a scoring backstop timer recovers to idle
  with an error if the recorder's callback is ever lost. New hand-authored
  `recordingCancelled` string across all locales. Remount hygiene clears any
  stale `.capPron-root` on mount; a scoped `.capPron-flow` layout (opt-in via the
  mount container class) lets the surface grow in normal document flow so long
  phrases / pill rows are never clipped.
- **`onAttempt` param.** A new optional `params.onAttempt(v)` fires after every
  scored attempt (with `{ overall, band, silent }`) BEFORE any auto-settle, so a
  host can reveal its own inline retry / continue controls while the round stays
  open. The one-shot `result` contract is unchanged — this is a progress
  notification, not a settle. Journey's `speak_echo` card uses it to surface a
  Continue button after the first real attempt (mic stays live for re-records).
- **Live mic waveform while recording.** The stage now shows a compact,
  squared-off bar waveform driven by the host's real per-buffer mic RMS
  (`stt.subscribeAudioLevel`) — a short scrolling amplitude history that reads
  "I'm listening to you now." Hosts that don't ship the level signal degrade to
  a gentle CSS breathing animation; `prefers-reduced-motion` is honoured. The
  subscription is opened on `recording` and torn down on idle/scoring/dispose.
- **Boot now REUSES an already-installed Whisper model instead of offering a
  redundant download.** The boot flow first probes every known model folder
  (`allFolders`) via `stt.listInstalled` — with a `stt.validateModel` fallback
  for hosts whose `listInstalled` is absent or returns the legacy
  `{ installed: [...] }` shape — and prepares the currently-loaded model, else
  the largest installed one. A user who installed the big Whisper via
  pronunciation-coach (same `hostApi.stt` seam + same `modelRegistry` folders)
  now has Journey score against it. The 75 MB Tiny install offer appears ONLY
  when nothing usable is installed anywhere. Scoring params are keyed off the
  actually-prepared folder (`activeModelFolder`), not the default.
- Journey offer-install surface (V0.2-PLAN contract #4): `modelPolicy:
  "offer-install"` renders an inline offer (what it is + model size + one
  Install button with live download/verify progress + a quiet decline). Decline
  settles `flags.sttDeclined`; a successful install flows straight into the
  scoring round on the SAME mount (no remount). `checkAvailability` now probes
  `stt.isAvailable()` so an unsupported native lib (x86 Chromebook / degraded
  build) reports `unavailable` rather than `needs-model`. New hand-authored
  string keys — `installOfferTitle`, `installOfferButton`, `installOfferDecline`,
  `installDownloading`, `installVerifying`, `errInstallFailed` — across all 51
  table locales (mirror into the pack i18n source before regenerating strings).
- Initial extraction (capability-modules.md §4.1): whisperLangs /
  whisperTuning / scoringTuning / modelRegistry moved whole; STT type slice
  moved to `@shared/capabilities/core`; text.ts / session.ts / recorder.ts /
  resultView.ts / roundView.ts extracted from game.ts; `capability.mount`
  composing the round per §2.3; `capPron-*` stylesheet; 28-key × 52-locale
  chrome strings generated from the pack's i18n table
  (scripts/gen-strings.mjs).
