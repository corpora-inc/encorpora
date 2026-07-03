# Changelog — cap-segment-player (@corpan/cap-segment-player)

Capability module: play narration segment range with word-sync highlight →
completion. Extracted from earthgate-reader; composes @shared/audio /
@shared/core / @shared/data. A FOREGROUND micro-player — the readers keep
all background-audio machinery.
Not independently shippable — user-visible changes also land in each
consuming unit's changelog (corpan/CHANGELOGS.md).

**Consumers to rebuild on change:** earthgate-reader (and corpan-app once
the Journey segment provider card consumes it, Wave 2; stargate-reader may
adopt segmentSession later).

## 0.1.0 — Unreleased

- Initial extraction (capability-modules.md §4.3): paragraphView moved whole
  (classes → `capSeg-*`, clean-zone geometry injected); segmentSession
  generalized from earthgate's one-shot replay ("the missing primitive is
  segment-range addressing"); dataSource over @shared/data (baseUrl OR
  preloaded); `capability.mount` with per-segment pass/partial/fail evidence
  and `{ listenedMs, replays, segmentsCompleted, totalSegments }` numbers;
  fixture mini-book harness (3 segments, tone WAVs, 36 KB).
