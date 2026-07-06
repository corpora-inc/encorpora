# Changelog — cap-pronounce (@corpan/cap-pronounce)

Capability module: show phrase → hold-to-record → whisper score → per-word
pill feedback. Extracted from pronunciation-coach (Parlometron).
Not independently shippable — user-visible changes also land in each
consuming unit's changelog (corpan/CHANGELOGS.md).

**Consumers to rebuild on change:** pronunciation-coach (and corpan-app once
the Journey `speak_echo` card + pop-in sheet consume it, Wave 2).

## 0.1.0 — Unreleased

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
