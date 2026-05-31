# Changelog

All notable changes to the Tutomaton pack are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- All supported languages now ship as prompt-only tutors, resilient to 0-N RAG
  corpora. `LanguageManager._loadRetriever` returns a no-op retriever
  ({kind:"none"}) when no retriever is bundled instead of throwing, so any
  language works ungrounded out of the box (0 = no-op; 1 = bundled retriever +
  one sqlite, as es/zh do today; N = a future retriever querying several DBs —
  the contract already allows it). A shared tutor-prompt template + generator
  (`tools/gen_prompts.py`) produces each language's `system_prompt.txt`,
  `grounding_instruction.txt`, and `module.json`. Persona bent toward
  mirroring/following the user (concise, matches verbosity, coy-not-preachy on
  sensitive topics) while keeping the hard guardrails (always answer in the
  target language, no emoji, optional learner gloss). 12 major languages got
  hand-tuned in-language example exchanges; the rest use the filled-in template.
  es' prompt was bent the same way without regressing its examples. (Publishing
  the per-language CDN zips is a separate follow-up; dev loads them over LAN.)

### Changed
- Premium UI/UX pass on the chrome (presentation only — engine untouched). New
  top bar (left→right): a small orange pyramid brand mark (inline SVG, the only
  orange in the UI) + "Tutomaton" wordmark that doubles as an explicit
  exit-to-home button on the LEFT, an elegant language switcher, then a compact
  controls cluster. The controls reserve right-edge clearance so they never
  collide with the host's floating top-right close "X" (collision-fix approach b:
  pack's own left-side Home affordance + clear right corner). The Home button
  dispatches the host's pack-close window events (`corpan:exit-pack` /
  `corpan:close-pack` / `corp-close-game`), which App.tsx wires to
  `closeContentPack()`.
- Emoji chrome icons replaced with clean inline lucide-style line SVGs
  (speaker / speaker-muted, mic, new-conversation refresh, back chevron, search) —
  no new dependency.
- Voice replies (TTS) now default ON; the speaker control is a mute toggle that
  swaps between the speaker and speaker-muted icon.
- Mic is now always present inside the input bar (iMessage-style): type to reveal
  the send arrow, or press-and-hold the in-field mic to talk. The separate
  full-screen "voice mode" toggle is gone. Push-to-talk logic is unchanged
  (pointer capture, 250 ms min-hold, recording/transcribing states); STT
  `prepare()` is now called lazily on the first press, and `releaseAudio()` on
  unmount is preserved.
- Language switcher scales to ~50 languages: the sheet gained a search field and
  "Your languages" / "All languages" grouping; the welcome screen shows an intro
  picker (your languages as pills, plus an "All languages" expander into the
  searchable sheet). Sheet grip is now a 44 px hit band with the canonical
  44×5 bar.

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
- Voice input is now press-and-hold (push-to-talk): hold the mic to record, release
  to transcribe + send. Replaces the tap-to-toggle that could miss its stop tap and
  record forever. Uses pointer capture so the release always lands even if the
  finger slides off; presses shorter than 250 ms are dropped (no empty sends), and
  the mic shows a recording pulse then a brief transcribing state.
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
