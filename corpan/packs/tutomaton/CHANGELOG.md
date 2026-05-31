# Changelog

All notable changes to the Tutomaton pack are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- Pack now loads and renders on device. Root causes resolved: per-language
  retrievers are statically bundled (`src/retrievers.ts`) instead of a runtime
  dynamic `import()` of uncompiled TS (the `game-proxy` 404); `chat.css` is
  imported so styles ship; pack-relative fetches resolve against the host-injected
  base URL (not the host SPA origin); the module registers into
  `globalThis.CorpanGames["tutomaton-v1"]` so the host finds it.
- Retrieval is now best-effort: a `queryPackDb` failure (e.g. sqlite not yet on
  disk) degrades to an ungrounded answer instead of killing the turn.

### Changed
- Top bar redesigned: the tutor/language switcher moved out of the cramped inline
  pill row into a compact header trigger (active flag + name + chevron) that opens
  a full switcher sheet — a bottom sheet on mobile, a centered modal on desktop —
  with large language cards (flag, native name, English sub, active check). Fixes
  narrow-screen crowding and gives the switch a moment of its own.
- LLM access goes through `hostApi.llm` (status/load/chat/unload) instead of
  `window.__TAURI__` (which is not exposed to pack webviews).
- `manifest.json` declares a `databases` map for the per-language sqlite corpora.
- Tutor personas (Spanish + Mandarin) rewritten around FLEXIBILITY: a practice
  partner that follows the user wherever they go and **matches their verbosity** —
  a one-word reply to a one-word message, a full lesson when asked, concise by
  default (small bites, not a lecture every turn). Turns any topic the user brings
  into natural language practice without announcing it; corrects lightly only when
  it helps; gives the user what they ask for and only deflects truly off-domain
  asks (code, math, investing) in a single line. This replaces the earlier
  "chill/creative" wording, which over-fit toward songs/jokes (the model began
  steering every reply to them). Hard guardrails kept: always reply in the target
  language, understand any input language, no emoji. A short
  parenthetical English gloss is now allowed when a learner truly needs it.
