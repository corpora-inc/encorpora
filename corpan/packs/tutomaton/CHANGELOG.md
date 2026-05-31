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
- LLM access goes through `hostApi.llm` (status/load/chat/unload) instead of
  `window.__TAURI__` (which is not exposed to pack webviews).
- `manifest.json` declares a `databases` map for the per-language sqlite corpora.
- Tutor personas (Spanish + Mandarin) rewritten to be chill, helpful tutors rather
  than rigid drill machines: warm "friend who knows the language" voice that fulfills
  requests (songs, poems, stories, jokes, roleplay, recommendations) *in the target
  language*, corrects lightly only when it helps, and weaves in recently practiced
  vocab/grammar without turning it into a lesson. Previously a request like "write me
  a Mexican song" was declined by an over-broad "that's not my thing" rule. Now only
  genuinely off-domain asks (code, math, investing, partisan politics) are lightly
  deflected — and when in doubt, the tutor helps. Hard guardrails kept: always reply
  in the target language, understand any input language, no emoji. A short
  parenthetical English gloss is now allowed when a learner truly needs it.
