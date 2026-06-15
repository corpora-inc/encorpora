# Changelog

All notable changes to the Tutomaton pack are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.6.0] - 2026-06-15 — Honest language list + model defaults calibrated to Qwen3-4B

### Changed
- Retuned the on-device model defaults for the shipped Qwen3-4B (Q4_K_M) model:
  temperature 0.6 → 0.3, topP 0.95 → 0.9, minP 0 → 0.05, repeatPenalty 1.0 → 1.1
  (topK 20, maxTokens 700 unchanged). Calibrated with A/B testing in
  `infra/tutomaton-eval`; the lower-temperature/tightened sampling measurably
  reduced fabricated vocabulary and repetition loops in weaker languages and was
  neutral-to-positive on strong ones. A single global default generalised better
  than per-language overrides.

### Removed
- Stopped advertising 5 languages the on-device model cannot teach acceptably,
  verified by native-level fluency judging at the best parameters: **Telugu**
  (fabricates vocabulary), **Swahili** (broken word-salad / repetition loops),
  **Sundanese** and **Javanese** (the model answers in Indonesian, not the
  target language), and **Punjabi (Shahmukhi)** (answers in an Urdu creole, not
  Punjabi). Tutomaton now offers 50 teaching languages (was 55). Existing
  installs of these modules are unaffected; they are simply no longer offered.

## [0.5.4] - 2026-06-09 — Localized model-lab/voice chrome + centered quota line

### Changed
- The model-lab and voice-picker chrome is now fully localized into the user's
  native language across all 47 non-English locales. Previously "Choose tutor
  voice", "On-device model lab", "Tune model", "Voice", "Recommended", "Loading
  installed voices…", and their sibling strings rendered in English everywhere;
  they now show real, natural translations (authored in each destination
  language/script, not machine-glossed).
- The quota status line under the composer ("{count} free tutor messages left
  today" / Corpán Plus state) is now centered instead of pushed to the right
  edge. Its always-reserved single line-height (no layout shift) is unchanged.

### Added
- The "Jump to latest" scroll-lock chip string is now translated into all 47
  non-English locales (it previously fell back to English per-key).

## [0.5.3] - 2026-06-09 — Stick-to-bottom chat autoscroll

### Changed
- The chat log now follows the industry-standard "scroll lock / stick-to-bottom"
  pattern instead of always yanking to the bottom. While you are at (or near) the
  bottom, the view keeps autoscrolling as the tutor streams its reply. The moment
  you scroll up to read earlier messages, autoscroll is released and your
  position is respected — it no longer pulls you back down mid-stream. Scroll
  back to the bottom and it re-engages. Detection is purely positional (recomputed
  on every scroll event), so it never fights iOS momentum scrolling and never
  mistakes its own programmatic scroll for a user scroll. Sending a new message
  always returns you to the bottom and re-engages the lock.

### Added
- A small, understated "Jump to latest" chip floats above the composer whenever
  autoscroll is released, so one tap returns to the bottom and re-engages
  stick-to-bottom. New "Jump to latest" string added to the English source
  (other languages fall back to English per-key until generated).

## [0.5.2] - 2026-06-09 — Stable composer + responsive header overflow

### Changed
- The composer no longer shifts vertically. The mic, text field, and send button
  sit on one fixed row and the quota line always reserves its space, so the
  footer height stays constant whether the dictation mic is shown or hidden and
  whatever the daily-quota text says. The mic and send now share stable slots
  (they swap by visibility, not by collapsing the layout).

### Added
- A responsive header overflow control. On narrow screens (pack width ≤ 559px,
  e.g. phones) the four floating action buttons — adjust model, change voice,
  mute/sound, new conversation — would overlap the chat text, so they are now
  hidden and replaced by a single compact kebab (⋮) menu to the right of the
  language switcher. The menu lists the same four actions and forwards each tap
  to the existing button, so behavior is identical. Above the breakpoint the
  floating buttons return and the kebab is hidden. The decision is container-
  width based, so it is correct inside the pack overlay on any device.
  Menu opens/closes with the kebab, a click outside, or Escape; the sound item
  reflects the current mute state. New "More options" string localized into all
  shipped languages.

### Added
- Tutomaton is now available to free users with 20 tutor messages per local day;
  Corpan Plus users get unlimited Tutomaton messages. The composer shows the
  remaining free messages and updates live when Plus becomes active.
- Tutor speech now pins one explicit installed TTS voice per language instead of
  allowing locale-only calls to rotate voices between streamed sentences.
- A per-language voice switcher defaults to the best dialect-appropriate,
  offline premium voice available, remembers the user's choice, and previews a
  newly selected voice using the latest tutor reply.

### Fixed
- The production catalog now honors this pack's `minAppVersion: 0.17.0`,
  routing Corpán 0.16.x clients to pinned Tutomaton 0.3.2 while `>=0.17.0`
  receives the latest release. New ZIPs ship at immutable versioned URLs; the
  historical `/tutomaton.zip` URL remains permanently pinned to 0.3.2 for old
  clients with cached catalog data.
- TTS no longer reads punctuation aloud (e.g. "semicolon", "asterisk"). Replies
  are stripped of Markdown markup before display, and the speech path
  additionally turns synthesizer-spoken symbols and separator dashes into pauses
  and flattens semicolons to a comma — except in Greek, where ";" is the
  question mark and is preserved. Logic extracted to `textScrub.ts` with tests.

### Changed
- The catalog tier is now `free`; the pack enforces the free/Plus message model
  locally inside the chat UI.
- The voice switcher now uses a speaking-face icon instead of a microphone (the
  microphone reads as dictation/input, not voice output).
- The model lab and voice switcher fill the screen on phone and medium-width
  screens, only becoming a centered floating modal at large (≥768px) widths.

## [0.5.0] - 2026-06-06 — Compact prompts + per-language model lab

### Added
- **On-device model lab:** every tutor language now has its own persisted,
  user-editable system prompt and sampling profile. The lab is exposed from the
  welcome screen and chat controls, clearly identifies Qwen3-4B as bleeding-edge
  on-device technology, applies changes to the next reply without reloading, and
  can reset one language to calibrated defaults.
- Exposed every useful per-generation knob currently supported by the runtime:
  temperature, top P, top K, min P, repeat penalty, presence penalty, and maximum
  reply tokens. `top_k` was previously hard-coded to 40, `min_p` was unused, and
  presence penalty was fixed at zero; all now flow through the app HostApi into
  the native llama.cpp sampler.
- The default effective prompt includes the learner's native language, while
  keeping that single factual hint separate from each localized tutor persona.
- Prompt invariant tests verify all 53 shipped tutors remain compact and contain
  no English correction directives. Tuning tests cover defaults, persistence
  sanitation, and parameter limits.

### Changed
- Simplified all 53 localized system prompts to only: friendly tutor identity,
  target-language reply rule, and natural conversation. Removed correction,
  mistake-monitoring, examples, formatting rules, and persona micromanagement.
- Reduced every RAG grounding instruction to two short sentences. This removes
  the hidden correction instruction that was still entering the system context.
- The conservative Qwen3 baseline now follows its documented thinking-mode
  sampler guidance: temperature `0.6`, top P `0.95`, top K `20`, min P `0`,
  repeat penalty `1`, presence penalty `0`, and maximum tokens `700`.
- Minimum app version is now `0.17.0` for the expanded sampler contract.

## [0.4.0] - 2026-06-06 — Streaming multilingual TTS

### Added
- Tutor replies now begin speaking while the LLM is still generating. Complete
  sentences are detected incrementally, scrubbed, and queued to TTS immediately;
  only the unfinished final sentence waits for the response-complete event.
- Multilingual sentence streaming uses Unicode's `Sentence_Terminal` property
  across every supported script, with no-space sentence handling for Chinese,
  Cantonese, and Japanese plus conservative CLDR-style suppression for common
  abbreviations, initials, decimals, and numbered-list markers.
- TTS calls are serialized so rapidly generated sentences always reach the host
  queue in order. Queued speech is invalidated and stopped on mute, replay, a
  new user turn, conversation reset, language switch, stream error, or unmount.
- Focused tests cover streamed English boundaries, abbreviation suppression,
  CJK no-space boundaries, Arabic/Indic sentence punctuation, and ordered
  cancellation behavior.

### Fixed
- Corrected the dictation button's stale `ICONS.mic` reference, which prevented
  the pack from typechecking and could break mount when host ASR was available.

## [0.3.2] - 2026-06-02 — Localize catalog description (51 langs)

### Fixed
- **Catalog pack-card description showed English in every locale.** Every other
  pack in `catalog-v3.json` ships a `descriptionLocalized` map (51 langs);
  tutomaton's manifest only had a tagline map, so `PackCard.tsx` (which routes
  through `localizePack()` and resolves `description` solely via
  `descriptionLocalized`) fell through to the bare English `description`.
  Added `descriptionLocalized` to `manifest.json` covering all 51 locales used
  by the rest of the catalog, matching the tone of the existing
  `experiences.tutomaton.blurb` translations in `common.json` and extending
  with the full description's phrase-pack-grounding + on-device wording.

## [0.3.1] - 2026-06-01 — Fix on-device black screen (inline manifest + prompts)

### Fixed
- **Black screen on launch (on-device).** `mount()` fetched the pack manifest
  (and per-language prompt files) at runtime over the `corpan-pack://` scheme.
  On device the WebView origin is `tauri://localhost` while the installed pack
  is served from `corpan-pack://localhost`, so WebKit CORS-blocked the
  cross-origin `fetch` ("Origin tauri://localhost is not allowed by
  Access-Control-Allow-Origin" → "Load failed"), `mount()` rejected, and the
  pack rendered a black void. It worked in `npm run dev` only because the pack
  is served same-origin over http there (and routed via `/game-proxy`). Fix:
  the manifest and all language prompt files (`system_prompt.txt`,
  `grounding_instruction.txt` — the only files `languageManager` reads at
  runtime) are now **inlined into the bundle at build time** (vite `define`,
  see `vite.config.ts`), mirroring how the pack already inlines its logo and
  how the reader packs receive host-preloaded data. Zero runtime cross-origin
  fetches; the pack is fully self-contained / offline. RAG sqlite databases are
  unaffected — they still install via the native `installModuleZip`.

## [0.3.0] - 2026-05-31 — Multi-source RAG architecture + en/fr/de/ja republish + phrase-pack bridge

### Added
- **Phrase-pack bridge** (`tutomaton-phrase-bridge-v1`) — a universal source
  (`tutomatonLanguage:"*"`, per contract §7) bundled into the Tutomaton pack
  ZIP that grounds EVERY tutor in real phrase-to-target alignments from the
  user's already-installed Corpán phrase packs. Per turn, the bridge tokenizes
  the user's English query, runs FTS5 BM25 across each installed pack's
  `entries_fts` virtual table (falls back to LIKE on any pre-FTS pack), joins
  to `translations` for the active target language, dedups by English source,
  and returns the top hits as inspiration grounding labeled
  `<reference type="inspiration" from="Phrase library bridge">` (§8). Composes
  alongside the per-language `core` source on es/zh/en/fr/de/ja (canonical +
  inspiration, two blocks); stands alone on the 40+ prompt-only stub languages
  whenever a phrase pack covers the user's question. Pattern-A helpers param
  passed by the SourceRegistry (`{ targetLanguage, hostApi: { phrasePacks,
  queryPackDb } }`) — standard per-language retrievers receive `undefined` and
  ignore it. `requiredHostApis: ["phrasePacks","queryPackDb"]` gates: any host
  missing either capability silently skips the bridge.
- **`universalSources[]` in the pack manifest** — new top-level field. Each
  entry resolves to the same SourceManifestEntry shape used for per-language
  built-ins; the SourceRegistry expands them across every language at activate
  time. Rejects `authoritative: true` per contract §7.
- **Multi-source RAG SourceRegistry** (`RAG_SOURCES_CONTRACT.md`): the
  `LanguageManager` now resolves **0..N sources per language** instead of one
  hard-wired retriever. Built-in sources are declared in the manifest
  (`languages[<code>].sources[]`, keyed by source id); installed source packs are
  discovered at runtime via the new `hostApi.discoverPacksByType("tutomaton-rag-source")`
  (host stub returns `[]` for now — built-ins-only until native discovery lands,
  no Tutomaton release needed to add sources later). Per-language enable prefs
  (`tutomaton.sources.<lang>.<id>`, default-on), `requiredHostApis` gating,
  universal-source (`tutomatonLanguage:"*"`) handling, single-authoritative
  enforcement, and the §4 merge (authoritative theme-bypass; ≤2 grounding blocks
  labeled `<reference type="canonical"/"inspiration">` per §8) are all wired.
  `retrievers.ts` is now keyed by source id. es + zh ship as authoritative
  `tutomaton-corpus-<code>-core-v1` built-in sources (exact live set preserved;
  a lone authoritative source still injects its reference raw → byte-identical
  grounding). `module.json` round-trip dropped — voice + sources come from the
  manifest, prompts from conventional paths (removes the 404-parse failure mode).
- Last selected tutor language is persisted (`tutomaton.lastLanguage`) and
  restored on re-entry, so exiting and reopening the pack lands on the same tutor.
- Welcome-state starter chips are now localized into the user's native language
  (4 generic prompts, all 46 chrome locales incl. Cantonese) instead of hardcoded
  English. `tools/gen_i18n.py` gained a non-destructive `--from-json` merge mode
  (parses TS string literals via JSON semantics — never `unicode_escape`, which
  was silently mangling multi-byte UTF-8; also fixed a 3-letter locale-code regex
  that had been dropping `yue`).

### Added (earlier)
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
- Tutors are warmer and go with the user: added a WARMTH & ROLE directive to all
  53 language prompts. The model now reciprocates affection/flirtation/emotion in
  character instead of emitting base-model refusals like "expressing personal
  feelings is not permitted / would you like to talk about something else?" — that
  refusal was Qwen3-4B alignment surfacing despite our prompt, NOT our text.
  Verified: Arabic "أحبك" now → "شكرًا على كلماتك، أحبّك أيضًا" (reciprocated,
  in-character) rather than a canned deflection.
- Chrome is now fully localizable into the user's NATIVE language (stack
  languages[0]): every header/picker/setup/welcome/FAB/error string goes through
  an in-pack t() (src/i18n.ts) keyed off the stack, with per-key English
  fallback so nothing is ever blank. CSS copy-affordance labels localize via CSS
  custom properties. Generator at tools/gen_i18n.py fills all ~50 languages from
  the English source via the OpenAI API (run with a valid OPENAI_API_KEY).
- Long-press copy now works natively: added a clipboard bridge (hostApi.copyText,
  backed by tauri-plugin-clipboard-manager) since the WKWebView blocks the web
  clipboard API. Copy a tutor reply by holding it.
- Kannada (kn) hidden from the picker for this launch — Qwen3-4B confuses Kannada
  with Devanagari script (greets in नमस्ते, not ನಮಸ್ತೆ). Revisit with a stronger
  base model. All other 51 languages tested coherent.
- Long-press a tutor reply to COPY it (e.g. to paste into a translator); short
  press still replays the audio. Copy runs inside the pointerup user-gesture
  (the async clipboard API is blocked in the WKWebView) via execCommand with a
  navigator.clipboard fallback; a "release to copy" cue + "Copied" flash.
- English (en) is a first-class tutor again and is never hidden — the user can
  chat with the bot in any supported language. The picker floats the user's own
  stack (native + learning languages, from the host stackConfig) to the top.
- Flags/glyphs for every shippable language (en=US, es=ES, pt-BR=BR, pt-PT=PT, …);
  Traditional Chinese / Cantonese use a 繁/粵 script glyph and Shahmukhi a script
  mark instead of a national flag, to avoid taking a geopolitical side.
- Action buttons (mute/speaker + new conversation) moved from the bottom-right
  to a tidy row top-left in the conversation area, vertically level with the
  first message (which sits on the right, so the corner stays clear).
- RTL languages now render idiomatically: each message bubble, the welcome
  title, and the input use dir="auto", so Arabic/Hebrew/Persian/Urdu content
  right-aligns RTL (per message, mixed content handled) while English stays
  LTR — no per-language flag needed. Chrome stays LTR; user/tutor bubble sides
  stay as ownership cues.
- Tap any tutor reply to hear it again (TTS replay). An explicit tap always
  speaks, even when the speaker is muted — handy for drilling pronunciation; a
  subtle speaker glyph hints the affordance.
- Header + chrome redesign: real Corpán brand mark (the ear-on-ziggurat the
  home screen uses, inlined) replaces the placeholder triangle; top bar is now
  a clean back-chevron · logo · wordmark · right-aligned language switcher, with
  top/left padding that clears the iPad Stage-Manager window grip. Exit actually
  works now — the back button fires `corpan:exit` (the event the host listens
  for) instead of three dead event names. Mute + new-conversation moved out of
  the bar into translucent FABs at the bottom-right above the input. Welcome and
  model-setup screens show the real logo too.
- Voice input now uses the keyboard's built-in dictation (on-device, ~50
  languages, no model download) typed into the text field, instead of a custom
  whisper.cpp push-to-talk mic. The custom mic pointed at an uninstalled
  `ggml-medium.bin` and failed with "Whisper not prepared" on release; rather
  than ship a several-hundred-MB second model + its memory/management UX on top
  of the on-device LLM, we lean on the OS dictation that's already there. The
  in-field mic button and all STT wiring were removed.
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
- Fixed the Tamil/Indic "dotted-circle" (◌) artifact: small models sometimes
  drop a base consonant and emit an orphaned combining mark (vowel sign / virama)
  with nothing to attach to, which the font draws on a dotted circle. scrubOutput
  now strips runs of combining marks (\p{M}) that have no base before them (at
  text start or right after whitespace). Well-formed clusters are byte-identical
  through the filter; only orphans are removed. Helps every combining-mark script
  (Tamil, Devanagari, Arabic, Thai, …).
- Resource-loading hardened for the multi-language rollout: removed the `en`
  manifest entry that had no local module (it 404'd → "unexpected identifier"
  on JSON.parse); `activate()` now fails with a clear "isn't available yet"
  message instead of a cryptic parse error when a language's module is missing;
  and an empty-string `sha256` is treated as "unknown" (skip verification)
  rather than passed to the installer as `Some("")`, which 403/published langs
  hit as "module hash mismatch".
- Prompt-only tutors (0 RAG sources) no longer try to download a corpus: a
  language is treated as installed when it has no entry in the manifest
  `databases` map, so picking one of the ~50 prompt-only languages goes straight
  to chat instead of failing with "download failed (403 forbidden)" on a
  non-existent CDN zip. Only es/zh (which have real sqlite corpora) download.
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
