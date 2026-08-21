# The Pack ↔ App Contract, End to End

*Report for the Journey-mode chief architect. Sources read in full: `corpan/packs/sdk/*`, `corpan/packs/PACK_DEV.md`, `corpan/packs/SINGLE_LANGUAGE_RULE.md`, `corpan/corpan-app/src/contentPacks/*` (hostApi, ContentPackHost, types, install, InstallContext, installProgress, catalog, native, llmTypes, phrasePackRegister, localized, platformPacks, window.d.ts, README), plus the launch path in `App.tsx` / `ContentPackOverlay.tsx` and the shared pack-side modules (`packs/shared/{monetization,streak,analytics}`). All paths below are absolute-relative to `/home/skyl/encorpora/corpan/`.*

---

## 0. Architecture in one paragraph

A pack is a self-contained web bundle (own vite build, no imports from corpan-app) that registers itself on `window.CorpanGames[id]` with a single function: `mount(container: HTMLElement, hostApi: HostApi, initialState?: Record<string, unknown>) → { unmount?() } | void` (`corpan-app/src/contentPacks/types.ts:754-760`, `packs/sdk/index.d.ts:354-361`). The host (`ContentPackHost.tsx`) fetches the pack's `manifest.json`, injects its script/style tags (inline via Tauri command for installed `corpan-pack://` packs, `ContentPackHost.tsx:497-526`), waits up to 500 ms for the registration (`waitForGameModule`, `ContentPackHost.tsx:186-198`), and calls `mount()` with a fresh per-pack `HostApi` built by `createHostApi(packId)` (`hostApi.ts:182`). Everything else — TTS, STT, LLM, corpus, entitlement, paywall — flows through that `hostApi` object, plus a small set of `window` CustomEvents and injected globals for back-compat. There is **no iframe, no postMessage, no sandbox**: the pack runs in the host's own WebView document and could technically touch anything, but the *documented* contract is `hostApi` + the `corpan:*` events.

---

## 1. Complete host API surface a pack can call

Built in `createHostApi(packId?)` at `corpan-app/src/contentPacks/hostApi.ts:182-1263`; canonical types at `corpan-app/src/contentPacks/types.ts:590-738`; the SDK mirror (deliberately standalone, no cross-import) at `packs/sdk/index.d.ts:305-352`. **Nearly every capability beyond the 5-method core is optional (`?`) and packs must feature-detect** — that is the versioning mechanism (§5).

### 1.1 Speech / TTS

| Method | Signature | Backing | Notes |
|---|---|---|---|
| `speak` | `(uiCode: string, text: string) => Promise<void>` | `speakWithStackPrefs` → native `plugin:tts` or web speech | Uses stack `rate` + user's per-language voice prefs. `hostApi.ts:200-206,910-912` |
| `speakConcurrent?` | `(uiCode, text) => Promise<string>` (utterance id) | `speakConcurrentWithStackPrefs` | Overlapping audio. `hostApi.ts:208-214` |
| `stopSpeech?` | `() => Promise<void>` | `window.speechSynthesis.cancel()` + `invoke("plugin:tts\|stop")` | `hostApi.ts:185-198` |
| `listVoices?` | `(uiCode?) => Promise<HostVoiceInfo[]>` | `getVoicesCached` (30 s cache) | Returns ONLY matching-language voices; empty is a valid answer (contract comment `hostApi.ts:927-932`). `HostVoiceInfo` = `{id, name?, language, gender?, quality?, networkRequired?}` (`types.ts:503-522`) |
| `speakVoice?` | `(uiCode, text, voiceId) => Promise<void>` | `createVoiceTTS(uiCode)(text, rate, voiceId)` | Sticky per-NPC voices. `hostApi.ts:942-946` |
| `synthesizeToBuffer?` | `(text, lang, voiceId?) => Promise<{pcm: ArrayBuffer, sampleRate, channels, durationMs, voiceId, codec: "wav"\|"pcm-i16"\|"pcm-f32"}>` | `invoke("plugin:tts\|synthesize_to_buffer", {args:{text, language, rate, voiceId}})`, base64→ArrayBuffer | Raw-audio capture path (music packs; no ducking). Rejects on desktop. `hostApi.ts:222-278` |

TTS failures surface to the host via the `corpan:tts-failure` window event dispatched inside `util/speak.ts:204` (host renders `TTSFailureBanner`), not through the hostApi return.

### 1.2 Corpus / phrase sampling (the shared 25k-phrase substrate)

| Method | Signature | Rust command |
|---|---|---|
| `getRandomEntry` | `() => Promise<EntryOut>` | `get_random_entry_with_translations` with user-global `levels`, `phrasePackIds`, `baseCorpusEnabled`, `exclude` = last 10 `(source, entry_id)` history tuples. `hostApi.ts:991-1006` |
| `getRandomEntries?` | `(q: number \| {count, domains?, levels?, languageCodes?}) => Promise<EntryOut[]>` | `get_random_entries_with_translations`. **The options form is the themed + level-scaled draw**: a pack-supplied filter overrides user-global levels and samples the domain-tagged BASE corpus with a relaxation ladder (drop levels → drop domains → all) so strict filters never starve. `hostApi.ts:1007-1047`, doc at `types.ts:666-679` |
| `getEntryById` | `(entryId: number, source?: string) => Promise<EntryOut>` | `get_entry_by_id_with_translations`. `entry_id` is only unique per source (`"base"` or a phrase-pack id) — resume-from-history must store the pair. `types.ts:92-103` |
| `searchEntriesByText?` | `({text, languageCodes?, limit?, offset?}) => Promise<EntryOut[]>` | `search_entries_by_translation_text`. `hostApi.ts:1051-1058` |
| `searchEntriesByTextCount?` | `({text, languageCodes?}) => Promise<number>` | `search_entries_by_translation_text_count` |

`EntryOut = { entry_id, level (CEFR), domains: string[], translations: [{language_code, text, romanization}], source }` (`types.ts:86-103`).

### 1.3 Pack-owned SQLite + pack file system

- `queryPackDb?({sql, params?, dbName?, packId?, maxRows?}) => Promise<{columns, rows}>` — read-only SQL against a DB declared in the manifest `databases` map; `packId` defaults to the mounting pack (`hostApi.ts:1065-1077`, command `content_packs_query_db`).
- `installModuleZip?({packId, subPath, url, sha256?, packManifest?}, onProgress?)` — download+extract a module ZIP into a subpath of a pack's on-disk dir (Tutomaton per-language modules; LLM base packs reuse the same machinery). Progress via the global `pack-install-progress` Tauri event filtered by `pack_id`. `hostApi.ts:1201-1244`, command `content_packs_install_module`.
- `packFileExists?(packId, relPath) => Promise<boolean>` — `content_packs_module_file_exists`. `hostApi.ts:1245-1250`.
- `discoverPacksByType?(packType) => Promise<Descriptor[]>` — **honest stub returning `[]`** (`hostApi.ts:1251-1257`); native discovery of installed packs by manifest `packType` is designed (return shape typed at `types.ts:711-724`: id, packId, name map, tutomatonLanguage, authoritative, priority, categories, schemaVersion, requiredHostApis, dbName) but not wired. Relevant to Journey: this is the intended "find every installed pack that can serve role X" primitive.

### 1.4 Stack config (the shared settings seam)

- `getStackConfig(): StackConfig` — `{activeStackId, languages, domains, levels, rate, textSize, showRomanization, phrasePackIds, baseCorpusEnabled, scrollNavigationEnabled}` (`types.ts:1-16`). **Language model (SINGLE_LANGUAGE_RULE.md): `languages[0]` = native/UI language, `languages[1..]` = targets; every pack MUST work with a one-language stack.**
- `onStackConfigChange(listener) => unsubscribe` — fires immediately, then on any change to the whitelisted slice (`hostApi.ts:965-983`; voice-cycling deliberately excluded).
- `setStackConfig?(patch: StackConfigPatch)` — whitelisted write surface, each key mapped to a store setter, JS-only (`hostApi.ts:1080-1091`).
- `openQuickSettings?()` — opens the host's Quick Settings sheet over the running pack (`hostApi.ts:1092`).

### 1.5 History, phrase packs, streak

- `history?: {getState, push(entryId, source?), setIndex, replaceCurrent, getRecentTuples(n), subscribe}` — per-stack navigation history; subscribe also fires on active-stack switch (`hostApi.ts:1093-1122`, `types.ts:59-67`).
- `phrasePacks?: {getInstalled(): Record<id, {id,name,nameLocalized?,topic?,topicLocalized?,accentColor?}>, setEnabled(id, on), subscribe}` (`hostApi.ts:1169-1194`).
- `getStreak?(): {current, longest, lastDay}` — read-only per-pack visit streak; the HOST records the visit at pack-enter (`ContentPackOverlay.tsx:52` → `recordPackVisit(id)` from `packs/shared/streak`); live updates via the `corpan:streak-changed` window event (`hostApi.ts:1130-1133`, `types.ts:581-588`).

### 1.6 Monetization / entitlement

- `entitlement?: {isSubscribed(): boolean, snapshot(): ContentPackEntitlementSnapshot, onChange(cb) => unsub}` (`hostApi.ts:1134-1150`). Snapshot = `{plus, subjectId, entitlementToken, subscription:{active, plan, expiresAt, autoRenew}, checkedAt}` (`types.ts:530-545`).
- `requestPaywall?(context: {surface, packId?, bookTitle?, bookId?, language?, theme?}) => Promise<boolean>` — host re-applies its own guards; resolves whether the sheet actually opened (`hostApi.ts:1151-1163`).
- Back-compat globals injected by `ContentPackHost.tsx:240-259`: `__CORPAN_PLUS: boolean`, `__CORPAN_ENTITLEMENT: snapshot`, `__CORPAN_HOST_CAPS: {dailyLock: true}` + the `corpan:entitlement-changed` CustomEvent on every change. The shared gate (`packs/shared/monetization`) reads these by default.
- `notifyUtterance?()` and `showRatingPrompt?()` are **kept-for-compat no-ops** (rating is manual-only now; `hostApi.ts:1123-1126,1164-1168`).
- `copyText?(text)` — native clipboard via `plugin:clipboard-manager|write_text` (WKWebView blocks `navigator.clipboard`; `hostApi.ts:953-960`).

### 1.7 STT (Parlometron scoring engine — `stt?: SttApi`)

Whisper-backed *expected-text alignment/scoring* (distinct from `asr`). `hostApi.ts:485-701`, types `types.ts:401-500`:

- `isAvailable() => Promise<boolean>`; `getStatus() => Promise<SttStatus>` (`{available, prepared, model, recording, message, availableMemoryMB?, physicalMemoryMB?, priorInitCrash?}` — the memory fields double as the device-memory oracle for the budget arbiter).
- `prepare({model?})` → `{ready, model, message?, code?}` (never throws on normal failure); `startSession({sessionId, language, expectedText})`; `stopSession({sessionId}) => Promise<SttTranscriptionResult>`; `cancelSession`.
- **`SttTranscriptionResult` is the richest structured learning outcome anywhere in the system** (`types.ts:189-219`): `{sessionId, text, expectedText, language, whisperLanguage, durationMs, overallScore, transcriptScore, likelihoodScore, acousticScore, avgLogprob, noSpeechProb, compressionRatio, temperature, minTokenLogprob, tokenLogprobStdev, freeVsConstrainedSimilarity, freeText, words: [{word, startMs, endMs, probability}]}` — and today it dies inside the pack that requested it.
- Model management: `wipeModel?`, `validateModel?`, `installModel?({model, downloadUrl?}, onProgress)` (progress phases `downloading|verifying|verified|failed`), `listInstalled?({models})`, `unload?`, `releaseAudio?` (MUST be called from pack unmount or iOS mic indicator sticks), `subscribeAudioLevel?(cb)` (~11 Hz RMS stream for silence detection).
- Structured error codes (`SttErrorCode`, `types.ts:118-136`) attached to thrown Errors as `err.code`; `INSUFFICIENT_MEMORY` uniquely requires app relaunch.
- Gotcha preserved in code: some plugin commands need FLAT payloads (no `args` wrapper) because they bypass the Rust invoke_handler (`hostApi.ts:572-582`).

### 1.8 ASR (provider-agnostic dictation — `asr?: AsrApi`)

"Speak instead of type"; keyboard is the permanent floor. `hostApi.ts:758-907`, types `types.ts:314-363`:

- `asr.pick({lang, budgetMB?, goal?: "dictation"|"challenge"}) => Promise<AsrProvider | null>` — **null means use the keyboard; callers MUST handle it.** Ranks via `rankProviders` from `@shared/asr` against live memory budget.
- `asr.provider(id: "native"|"whisper"|"qwen3"|"sherpa")` — only `"native"` exists (bridges `plugin:asr-native` commands `capabilities`/`is_available`/`ensure`/`start_session`/`stop_session`/`cancel_session` and events `asr://partial`, `asr://level`, `asr://error`, session-id-routed).
- `AsrSession = {onPartial(cb), onLevel(cb), onError(cb), stop() => Promise<{text, confidence, language}>, cancel()}`.

### 1.9 On-device LLM (`llm?: LlmApi`)

`hostApi.ts:334-483`, types `types.ts:225-307`:

- `status() => Promise<{loaded, modelId?, backend?, availableMemoryMb?, totalMemoryMb?}>` (`plugin:corpan-llm|llm_status`).
- `isInstalled(packId)` — implemented as "does `content_packs_get_manifest_url` succeed" (a model pack IS a content pack on disk).
- `install({packId, url, sha256?}, onProgress?)` — reuses `content_packs_install_from_url` + `pack-install-progress` event.
- `load({modelPackId, gpuLayers?, contextSize?})` / `unload()`.
- `chat({messages: [{role, content}], options?: {temperature, topP, topK, minP, repeatPenalty, presencePenalty, maxTokens, stop, noThink}}, handlers: {onToken, onDone(full, {totalTokens, elapsedMs}), onError(msg, code?)}) => Promise<{sessionId, cancel()}>` — streaming via host-owned Tauri listeners on `llm-token:{sessionId}` / `llm-done:` / `llm-error:`; packs never touch `window.__TAURI__`.

### 1.10 Models / budget arbiter (`models?: ModelsApi`)

`hostApi.ts:703-756`, types `types.ts:365-399`. The co-residency question ("does Qwen3-ASR fit next to the 4B right now?"):

- **Real today**: `budget() => {availableMB, physicalMB, resident: [{id, mb, kind}]}` (from `plugin:stt|get_status` memory fields + `llm.status()`, resident LLM hardcoded ≈2500 MB) and `fits({residentMB}) => {fits, mustEvict: []}`.
- **Honest stubs** awaiting the Phase-2 registry plugin: `list() => []`, `ensure() => {ready:false}`, `locate() => null`, `evict()`, `whatFitsAlongside() => []`.

### 1.11 Lifecycle & disposal

`dispose?()` (`hostApi.ts:280-309`) is called by the host on teardown (`ContentPackHost.tsx:387-390`): unloads the LLM (~2.5 GB), unloads whisper, releases the audio session, stops radio-stream and audio-keepalive plugins — all fire-and-forget, idempotent. Host teardown ordering (rAF-deferred unmount, then asset removal) is carefully documented at `ContentPackHost.tsx:365-435`; the pack's `unmount()` must be tolerant of being called once.

### 1.12 Window-event side channel (the undocumented half of the contract)

Pack → host:

| Event | Detail | Host handler |
|---|---|---|
| `corpan:exit` | none | Return to Home hub, clear overlay (`App.tsx:555-571`). **The only way a pack ends itself.** |
| `corpan:request-unlock` | `PaywallRequestDetail {surface, packId, reason, hardness, ...extras}` (`packs/shared/monetization/src/types.ts:54-65`) | Opens paywall (`App.tsx:435`) |
| `corpan:daily-locked` | `DailyLockedDetail {packId, surface, doneToday, limit, resetAt, unitLabel, ...}` | Host renders the universal DailyLockOverlay (gate v2) |
| `corpan:segment-progress` | `{bookId, language, segmentsReached, totalSegments?}` | Written to `store/progress.ts` (localStorage); auto-opens `book_finished` paywall at completion (`App.tsx:420-436`) |
| `corpan:open-settings` | none | Opens full Settings over the running pack (`App.tsx:573-579`) |
| `corpan:preinstall-pack` | `{packId}` | Onboarding pre-install (`App.tsx:669`) |

Host → pack:

| Event | Meaning |
|---|---|
| `corpan:entitlement-changed` | New entitlement snapshot in `detail` (`ContentPackHost.tsx:254-258`) |
| `corpan:host-dispose` | `{id}` — pack teardown imminent (`ContentPackHost.tsx:381-383`) |
| `corpan:host-pause` / `corpan:host-resume` | Paywall sheet opened/closed over the pack — pause game loops/audio (`store/paywall.ts:73-85`) |
| `corpan:streak-changed` | Streak state updated |
| `corpan:entitlements-changed` | `{plus:true}` edge-trigger for the catalog layer's narration upgrade sweep |

Also `corpan:tts-failure` (host-internal, dispatched from `util/speak.ts:204`) and pack-ecosystem-internal events (`corpan:book-finished`, `corpan:narration-upgraded` in `packs/shared/catalog/src/appShell.ts`).

### 1.13 Mock host (standalone dev)

`packs/sdk/index.js:49-154` — `createMockHostApi()` covers speak (browser TTS), stack config, history, phrase packs, `getRandomEntry/Entries` (canned hola/hello), `searchEntriesByText`, `queryPackDb` (empty). **It does NOT mock stt/asr/llm/models/entitlement/streak/paywall** — packs relying on those must feature-detect anyway. `mountStandalone(game, {container?, hostApi?, initialState?})` at `index.js:156-182`. `isMock?: boolean` flag lets packs branch.

---

## 2. Launch path — can the app deep-link into a mode/mission today?

**Yes, a skeletal but real mechanism exists: `PackLaunchEntry`.** Defined at `corpan-app/src/contentPacks/types.ts:39-52`:

```ts
interface PackLaunchEntry {
  entryId?: number     // deep-link to a specific entry id
  source?: string      // corpus hint for that entry
  route?: string       // initial route within the pack  ← the generic hook
  seedBookId?: string  // first-run reader seed
}
```

Flow: `App.tsx` `handleLaunchGame(game, entry?)` (`App.tsx:536-551`) → `setActiveGame({id, manifestUrl, entry})` → `<ContentPackOverlay id manifestUrl entry>` (`App.tsx:809`) → `<ContentPackHost entry>` → spread into the pack's `mount(..., initialState)` at `ContentPackHost.tsx:549-558`:

```ts
activeModule.mount(containerRef.current, hostApi, {
  stackConfig: hostApi.getStackConfig(),
  isPlus: entitlementSnapshotRef.current.plus,
  entitlement: entitlementSnapshotRef.current,
  ...(entry ? { entryId: entry.entryId, source: entry.source, route: entry.route } : {}),
  ...(entry?.seedBookId ? { seedBookId: entry.seedBookId } : {}),
})
```

So `initialState` already carries: `stackConfig`, `isPlus`, `entitlement`, and optional `entryId/source/route/seedBookId`. It is typed `Record<string, unknown>` on the pack side — "a pack reads only what it understands."

Also supported today:
- **URL query-param launch**: `?game=<id>&gameUrl=<manifestUrl>&entryId=&source=&route=` parsed at app boot (`App.tsx:165-184`) — a working deep-link into a pack+route from a cold start. (`seedBookId` is *not* URL-parseable.)
- **The only production user of `entry`** is the reader first-run seed: `handleLaunchGame(game, isReaderPack(packId) ? { seedBookId: DEFAULT_READER_SEED_BOOK } : undefined)` (`App.tsx:720`, driven by onboarding `resolveLanding.ts:33`).
- `entry` fields are in the `useEffect` dependency list (`ContentPackHost.tsx:602`), so changing them **remounts the whole pack** — there is no live "navigate the running pack" channel.

**Gaps for Journey mode.** No pack currently documents a `route` grammar; there is no typed per-pack launch-params schema (nothing in the manifest declares "modes I accept"), no way to pass structured mission config (e.g. `{activity:"listen", entryIds:[...], targetLang:"es", difficulty:...}`) except by convention inside `route` or by widening `PackLaunchEntry`, and no acknowledgment path (the host can't tell whether the pack honored the deep link). **Where the hook goes:** widen `PackLaunchEntry` (types.ts:39) — it is already the declared "single source of truth for the shape" — e.g. add `params?: Record<string, unknown>` or `mission?: {...}`; thread is already complete end-to-end (App → Overlay → Host → mount). For *mid-session* re-tasking without remount, a new host→pack event (`corpan:launch-entry` with detail) or a `hostApi.journey.onMission(cb)` seam would be needed; nothing like it exists today.

---

## 3. Results / scores / events back to the app — what exists, what's missing

**There is no structured per-activity outcome channel today.** Full inventory of what flows pack→host:

1. **`corpan:segment-progress`** — `{bookId, language, segmentsReached, totalSegments?}` → `store/progress.ts` (`reportProgress`, monotonic deepest-reached, localStorage-only, drives the Library "Continue" shelf, `booksFinished()`, `streakDays()`, `segmentsToday()`; `progress.ts:48-137`). This is reader-vocabulary (books/segments), not generic activities.
2. **`corpan:exit` / `corpan:daily-locked` / `corpan:request-unlock`** — lifecycle + monetization only; `daily-locked` does carry `{doneToday, limit}` (a crude "actions completed today" count per pack, persisted by the *pack* in `localStorage` under `corpan:gate:<packId>:<surface>`, `packs/shared/monetization/src/paywallGate.ts:162`).
3. **Ambient host-side analytics** (pack-agnostic, the pack does nothing): `ContentPackOverlay.tsx:40-71` tracks `pack_entered` → 30 s heartbeats → `pack_exited` with `durationMs` and a `segmentsDelta` derived from the host's own session segment counter (`getSessionSegmentCount` in `util/analytics`). Fire-and-forget telemetry, not a learning model.
4. **Host-side visit streak**: `recordPackVisit(id)` at pack-enter (`ContentPackOverlay.tsx:52`); per-pack consecutive-day count in `packs/shared/streak`. Retention signal, never a gate.
5. **`store/packRating.ts`** — despite the name, this is the user's like/dismiss of a *pack* on the Home "For you" cycle (`"like" | "dismiss"` per pack id, feeding recommendation ranking; `packRating.ts:1-43`). **It is not a pack-reported score.**
6. **`packs/shared/analytics`** — packs can `analytics.track("chapter_completed", {...})` to the *server-side* anonymous telemetry pipeline (no throw, opt-out, offline queue). Useful for fleet analysis; useless as an on-device course-engine input (the app never reads it back).
7. **`hostApi.history.push(entryId, source)`** — packs record which corpus entries they showed; feeds anti-repetition sampling (`exclude` tuples). This is the closest thing to "the host knows what the learner saw," but it has no correctness/score dimension and only covers corpus entries.

**What a course engine needs and does not have:**
- A typed outcome envelope: `(packId, activityKind, itemRef {source, entryId | bookId | word | ...}, lang, score/grade, durationMs, evidence?)`. The STT result (§1.7) shows the system can produce very rich evidence; it is currently discarded at the pack boundary.
- A host-side persistent store keyed by (skill/item, language) to drive SRS/adaptivity — `progress.ts` is the pattern to copy (Zustand + persist, localStorage, monotonic merge) but its schema is book-specific.
- A per-activity completion signal distinct from `corpan:exit` (packs today exit whole-sale; a Journey feed needs "this one 40-second activity is done, verdict X, give me the next").
- Symmetry: the natural additions are `hostApi.journey.reportResult(outcome)` (typed seam, mirroring `entitlement`/`requestPaywall` style) *plus* a `corpan:activity-result` CustomEvent for OTA packs running on older hosts — exactly the dual-rail (typed seam + window event + `__CORPAN_HOST_CAPS` capability flag) already proven by the paywall/entitlement rollout.

---

## 4. Manifest, versioning, install/update flow, catalog shape

### 4.1 Pack manifest (`manifest.json`)

Type `ContentPackManifest` (`types.ts:740-752`, SDK mirror `packs/sdk/index.d.ts:363-374`):

```json
{
  "id": "my-pack",              // globally unique; must equal registerGame({id}) and the on-disk dir
  "name": "My Pack",
  "version": "0.1.0",
  "entry": "dist/app.js",       // resolved relative to manifest URL (or baseUrl)
  "styles": ["dist/app.css"],
  "baseUrl": "./",              // optional
  "entryType": "script",        // "script" | "module"
  "sdkVersion": "0.1.0",        // declared, NEVER enforced (see §5)
  "permissions": [],            // declared in the type, not enforced anywhere
  "databases": { "main": "dist/data/pack.sqlite3" },  // logical name → SQLite for queryPackDb
  "devRevision": "..."          // dev-only cache-bust, auto-written by devManifestPlugin
}
```

Phrase packs extend this with `packType: "phrase"`, `topic/topicLocalized`, `levelMin/levelMax`, `entryCount`, `languageCodes`, `icon`, `accentColor`, `schemaVersion` (`phrasePackRegister.ts:22-44`); post-install, any pack whose manifest has `packType === "phrase"` is auto-registered in the phrase-pack store, with an id-spoofing guard (`manifest.id !== packId` → refuse, `phrasePackRegister.ts:132-137`). `packType` is the extensible discriminator (also `"tutomaton-rag-source"`, `"llm-base"`, `"llm-persona"` in `llmTypes.ts:67-142`).

Docs: `packs/PACK_DEV.md` §2 (authoring), `corpan-app/src/contentPacks/README.md` (field list — note it's stale relative to types.ts).

### 4.2 Install flow

`install.ts:114-192` (`installPack`), two branches:

- **`.zip` URL** → pack id derived from the *filename*: strip `.zip`; phrase packs (`phrase-` prefix) strip trailing `-<semver>` and keep kebab-case; **all other packs replace hyphens with underscores** (`hover-runner-0.1.0.zip` → id `hover_runner_0_1_0`-ish caveats aside — actually `hover-runner.zip` → `hover_runner`; `install.ts:126-132`). Then `content_packs_install_from_url {packId, downloadUrl, expectedSha256}` (Rust: download, optional sha256 verify, extract to the app-data `corpan-packs/<packId>/` dir), progress streamed on the `pack-install-progress` Tauri event (`{pack_id, stage: downloading|verifying|extracting|finalizing|complete|error, progress, total, message}`, `installProgress.ts:4-18`, 2-min stall timeout). Post-install phrase-pack registration hook.
- **`manifest.json` URL** (dev/manual) → fetch + optional SHA-256-of-manifest check, record only (the pack is served live from that URL).

Installed packs are recorded in the games Zustand store (`InstallContext.tsx:125-136`) and served at **`corpan-pack://localhost/<packId>/...`** (Android/Windows: `http://corpan-pack.localhost/...`). WebViews can't `fetch()` the custom scheme, so manifest/entry/styles are command-fetched via `content_packs_fetch_text` and injected inline (`ContentPackHost.tsx:497-526`, `native.ts:43-45`); pack *runtime* asset bytes go through `packs/shared/data/packFetch.ts` (PACK_DEV.md §7). Other native commands: `content_packs_list_installed`, `content_packs_get_manifest_url` (`native.ts:31-41`). A legacy `plugin:game_packs` path lists platform-bundled packs (`platformPacks.ts`).

Batch install (`installPackBatch`, `InstallContext.tsx:211-261`) installs sequentially with per-pack outcomes — the pattern a Journey "install everything this course needs" step would reuse.

### 4.3 Update flow

- **Manual**: `usePackUpdates(installed, catalog)` diffs versions with `compareVersions`/`getUpdateType` (major/minor/patch; `catalog.ts:857-901`) → "Update available" affordances in the packs UI.
- **Silent**: `systemPack: true` entries auto-install/upgrade on launch with no UI (`SystemPackInstaller.tsx:16-60`; `needsInstall = !installed || installed.version !== pack.version`) — this is how Library/readers ship OTA without app-store releases. **A Journey spine pack would almost certainly be a systemPack.**
- **Dev**: manifest polling every 20 s with cache-busting, scoped strictly to local dev-server manifests (`ContentPackHost.tsx:30,283-286`, `devReload.ts`).

### 4.4 Catalog shape

Four separate catalogs (fragmentation is real):

1. **Game/experience catalog V3** — `https://encorpora.io/corpan/packs/catalog-v3.json`, `{version: 3, generatedAt, packs: CatalogV3Entry[]}` (`catalog.ts:128-187`). Per entry: `id, name(+nameLocalized), version, manifestUrl|zipUrl, description(+localized), imageUrl, purchase {type: free|iap|code, productId?, priceLabel?, platformPackId?}, minAppVersion (required), maxAppVersion?, channel: "stable"|"preview", packType?, systemPack?, platforms? (ios|android|macos|windows|linux), minOSVersion?` plus **recommendation metadata**: `categories? ("read"|"audio"|"games"|"speak"|"study"|"wild"), goodForClass? ("enjoyer"|"learner"|"polyglot"|"kid_native"), recommendOrder?, featuredFor?, kidFriendly?, languages? (language-specific packs get penalized off-language), tagline(+localized)`. Client-side filter `filterCatalogForApp` (`catalog.ts:616-709`): version-range + channel (preview requires devMode) + platform + OS gates, then de-dupe by id preferring platform-specific match then highest version — the catalog intentionally carries multiple entries per id with disjoint `[minAppVersion, maxAppVersion]` ranges to ship different pack versions to old vs new hosts. Fallback chain V3 → V1 (`catalog.json`) → in-binary defaults; ETag-validated fetch (`catalogFetch.ts`).
2. **Narration catalog V2** — `catalog-v2.json` on CloudFront, `narrations: [{id, bookId, bookTitle, language, voiceId, voiceName, version, downloadUrl, sha256, sizeMb, series?, volume?, tier, purchase, totalSegments?, freeSegments?, preview?/full? two-ZIP artifacts}]` (`catalog.ts:76-122`).
3. **Phrase-pack catalog** — dedicated S3 catalog, 5-min TTL (`phrasePackCatalog.ts`; explicitly *not* on V3, `catalog.ts:179-181`).
4. **Word-pack catalog** — separate index (`wordPackCatalog.ts`).

LLM entries are typed for a future `llmPacks` catalog field (`llmTypes.ts`) with a `dependsOn` resolver (`resolveLlmDeps`, `llmTypes.ts:180-220`) — **the only dependency-resolution machinery in the system**, currently LLM-specific.

---

## 5. SDK versioning and how a contract extension rolls out

**The blunt truth: there is no enforced SDK versioning.** Mechanics:

- The SDK is `@corpan/sdk` **0.1.0** (`packs/sdk/package.json`), a two-file prototype (`index.js` runtime ≈180 lines: `registerGame`, `createMockHostApi`, `mountStandalone`; `index.d.ts` ≈390 lines of types). It is **not npm-published**; packs **vendor-copy** it (`packs/PACK_DEV.md` §1: `src/sdk/ # mock host API + types for standalone dev`; e.g. `packs/pronunciation-coach/src/sdk/types.ts`). The SDK types deliberately duplicate `corpan-app/src/contentPacks/types.ts` ("the SDK stays standalone — no cross-package import", `packs/sdk/index.d.ts:205`), and **the copies have already drifted**: the SDK's `SttErrorCode` lacks `INSUFFICIENT_MEMORY`, its `SttStatus` lacks the memory/crash fields, its `HostApi` lacks `speakConcurrent/listVoices/speakVoice/copyText/entitlement/getStreak/requestPaywall/openQuickSettings/llm/installModuleZip/packFileExists/discoverPacksByType`, and its `getRandomEntries` is `(count: number)` only.
- `manifest.sdkVersion` is declared in every pack manifest (all `"0.1.0"` except tutomaton's `"1.0.0"`) but **grep confirms the host never reads it** — it appears only in type declarations. No load-time compatibility check exists.
- The **actual** compatibility system, proven across several rollouts, is four-layered:
  1. **Additive optional members + feature detection.** Every post-v0 capability is `?` on `HostApi`; packs do `hostApi.entitlement?.isSubscribed() ?? readGlobal()`. Comments throughout types.ts spell this out ("ADDITIVE + optional: packs that still read the globals keep working", `types.ts:562-566`).
  2. **Host capability advertisement**: `__CORPAN_HOST_CAPS` global (`ContentPackHost.tsx:245-253`, currently `{dailyLock: true}`) — for OTA packs running inside *older* apps, which is the norm ("people don't update"). A pack checks the cap before relying on new host behavior and degrades otherwise.
  3. **Catalog-side gating**: `minAppVersion` (required on V3) keeps a new-contract pack away from old hosts; `maxAppVersion` + duplicate-id entries let one pack ship a legacy build to old hosts and a new build to new hosts simultaneously (`catalog.ts:143-147`).
  4. **Dual-rail seams**: every new typed hostApi seam keeps its window-event/global predecessor alive (`corpan:request-unlock` ⟷ `requestPaywall`, `__CORPAN_ENTITLEMENT` ⟷ `entitlement`, `corpan:exit` has no typed twin yet).

**So a Journey contract extension rolls out like this** (the established playbook): add optional `journey?` seam to `corpan-app/src/contentPacks/types.ts` + implementation in `createHostApi` (`hostApi.ts`); mirror the types into `packs/sdk/index.d.ts` (and accept the manual-sync tax, or fix it — see open questions); add a `journey` (or per-feature) flag to `__CORPAN_HOST_CAPS`; define the window-event fallback for OTA packs on old hosts; gate any pack that *requires* the seam via catalog `minAppVersion`. Existing packs need zero changes; retrofitting a pack = teach it to read `initialState.route`/mission params and emit the outcome event at its natural completion boundaries. No central registry of "which packs implement which contract version" exists — the closest primitives are the manifest `packType` discriminator plus the stubbed `discoverPacksByType` (`hostApi.ts:1251`) and the typed descriptor's `requiredHostApis?: string[]` field (`types.ts:721`), which is exactly the shape a Journey activity-provider declaration would want.

### Non-negotiable pack rules that constrain Journey activity design

- **Single-language stacks** (`packs/SINGLE_LANGUAGE_RULE.md`): `languages` may be `[primary]` only; every activity must degrade to practicing that one language with no native gloss. Journey's "any→any" model must treat target = `languages[1]` as optional-at-the-contract-level even if a course usually sets it.
- One pack instance at a time, full-screen overlay over Home (`App.tsx:809`); mount/unmount are heavyweight (asset injection, model loads). A feed of "small varied activities" hopping between packs will pay a real cost per hop — either keep the Journey spine as one pack that *embeds* activity renderers, or extend the host to keep warm instances (nothing supports that today).
- `dispose()` frees the LLM/whisper on every pack switch (`hostApi.ts:299-301`) — cross-activity model residency is a host-level problem the `models` budget arbiter was designed to eventually own.
- Standard pack scaffold (`PACK_DEV.md`): vite lib-mode → `dist/app.js`, mock-host standalone dev, shared dev-server harness, per-pack CHANGELOG, noisy-errors rule, localize-everything rule.

---

## Appendix: quick answer key

| Question | Answer |
|---|---|
| Can the app pass launch params today? | Yes — `PackLaunchEntry {entryId, source, route, seedBookId}` → `mount(..., initialState)`, plus `?game=&entryId=&source=&route=` URL params. Untyped beyond those 4 fields; only `seedBookId` is used in production; changing entry remounts the pack. |
| Can a pack report results today? | Only: `corpan:segment-progress` (books), `corpan:exit`, monetization gate counters, host-side ambient dwell/heartbeat analytics, server-side fire-and-forget telemetry. No structured per-activity outcome, no host-side skill store. `packRating` = user's like/dismiss of packs, not scores. |
| Is `sdkVersion` enforced? | No. Declared in every manifest, read nowhere. Compatibility = optional members + feature detection + `__CORPAN_HOST_CAPS` + catalog min/maxAppVersion. |
| Where does a Journey hook go? | Launch: widen `PackLaunchEntry` (types.ts:39) — plumbing already complete. Results: new typed `hostApi.journey` seam + `corpan:activity-result` event fallback + host Zustand persist store (copy `progress.ts` pattern). Discovery: implement `discoverPacksByType` + manifest `packType`/`requiredHostApis`. |
