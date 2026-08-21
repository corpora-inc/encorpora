# Changelog — cap-squeeze (@corpan/cap-squeeze)

Capability module: prompt phrase → drag/tap shuffled words into order →
win. Extracted from juice-squeeze. React INTERNALLY; the boundary is DOM
(`mount` → createRoot, `dispose` → unmount). react / react-dom /
@dnd-kit/core / zustand resolve from the CONSUMER's node_modules.
Not independently shippable — user-visible changes also land in each
consuming unit's changelog (corpan/CHANGELOGS.md).

**Consumers to rebuild on change:** juice-squeeze (and corpan-app once the
Journey word_order-adjacent card consumes it, Wave 2).

## 0.1.0 — Unreleased

- Initial extraction (capability-modules.md §4.2): tokenizer / readingOrder /
  rtl / blockSizing / languageNames + fit/sizing hooks + the four round
  components moved whole; phrase-scoped store transitions extracted to
  `createRoundSlice` (the pack's gameStore composes it — one implementation);
  placement routing extracted to dnd.ts; `<SqueezeRound>` + `capability.mount`
  with the §4.2 result mapping (reveal/slow proxies); `capSqz-*` stylesheet.
