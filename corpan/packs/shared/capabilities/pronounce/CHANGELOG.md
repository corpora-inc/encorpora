# Changelog — cap-pronounce (@corpan/cap-pronounce)

Capability module: show phrase → hold-to-record → whisper score → per-word
pill feedback. Extracted from pronunciation-coach (Parlometron).
Not independently shippable — user-visible changes also land in each
consuming unit's changelog (corpan/CHANGELOGS.md).

**Consumers to rebuild on change:** pronunciation-coach (and corpan-app once
the Journey `speak_echo` card + pop-in sheet consume it, Wave 2).

## 0.1.0 — Unreleased

- Initial extraction (capability-modules.md §4.1): whisperLangs /
  whisperTuning / scoringTuning / modelRegistry moved whole; STT type slice
  moved to `@shared/capabilities/core`; text.ts / session.ts / recorder.ts /
  resultView.ts / roundView.ts extracted from game.ts; `capability.mount`
  composing the round per §2.3; `capPron-*` stylesheet; 28-key × 52-locale
  chrome strings generated from the pack's i18n table
  (scripts/gen-strings.mjs).
