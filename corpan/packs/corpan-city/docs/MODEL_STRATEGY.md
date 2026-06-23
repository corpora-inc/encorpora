# Corpan City — On-Device Model Strategy (STT + LLM)

**Status:** Decision (research-backed). 2026-06-02.
**Audience:** Engineers building the voice → NPC dialogue loop.
**Scope:** How we get `speak → transcribe → Qwen3 responds (+TTS)` on phones,
tablets, and desktop across our 52 locales, without OOM/jetsam and without a
janky model-juggling UX.

---

## TL;DR — the decision

1. **Qwen3-4B (LLM) stays resident for the whole NPC session.** It is the
   non-negotiable core. Loading/unloading it per turn is too slow and janky
   (multi-second mmap warm-up; see §3).
2. **The native OS STT (Apple `SpeechAnalyzer`/`SFSpeechRecognizer`, Android
   `SpeechRecognizer`) runs in a SEPARATE SYSTEM PROCESS.** It does **not**
   consume our app's llama GPU/RAM/jetsam budget. **Therefore native STT and a
   resident Qwen3 run CONCURRENTLY with zero model juggling.** This is the crux,
   and it is confirmed (§2).
3. **Primary path = native STT + resident Qwen3, NO bundled Whisper.** This
   removes the 1.6 GB Whisper model from the hot path entirely and solves the
   RAM contention the product owner flagged.
4. **Whisper becomes an *optional, on-demand fallback* — only for the languages
   native STT can't do on-device, and only when the user explicitly chooses
   voice for one of those languages.** When Whisper must run, we **unload Qwen3
   first** (one-large-model-at-a-time broker rule, §6). Most languages never hit
   this path.
5. **Keyboard text input is the universal floor** — always available, always
   free, always works (LLM-only, no STT). It is the fallback-of-fallbacks and
   the default for the long tail of low-resource languages.

Net: the dream UX (speak, no keyboard popping up) is delivered natively and
concurrently for ~24 of our 52 locales on iOS and a comparable set on Android,
with graceful, per-language degradation for the rest — and we ship **one fewer
1.6 GB model** in the default install.

---

## 1. Native on-device STT coverage across our 52 locales

Our shipping locale set (from `corpan-app/public/locales`, 52 written variants):

```
ar bg bn ca cs da de el en es fa fi fr gu he hi hr hu id it ja kn
ko-polite lt mr ms ne nl no pa-Arab pa-Guru pl pt-BR pt-PT ro ru sk sl
sr sv sw ta te th tr uk ur vi yue-Hant-HK zh-Hans zh-Hant
```

### 1a. iOS — two generations of the Speech framework

**Legacy: `SFSpeechRecognizer` (iOS 10+).**
- ~50+ languages in **server** mode, but only a subset support **on-device**
  recognition (`supportsOnDeviceRecognition == true` /
  `SFSpeechAudioBufferRecognitionRequest.requiresOnDeviceRecognition = true`).
- Measured on-device set (iOS 15, iPhone 7) was **~22 languages**: ar, de, en
  (multiple regions), es, fr, it, ja, ko, pt-BR, ru, tr, yue, zh-CN, zh-HK.
  The exact set varies by device/iOS version — you MUST probe at runtime, never
  hard-code.
- Hard limits: ~1 minute per request; no custom vocabulary on-device; quality
  below cloud.

**New: `SpeechAnalyzer` + `SpeechTranscriber` (iOS 26 / macOS 26+).** This is
the path to design for going forward. It is **fully on-device, long-form (no
~1-minute cap), sub-200 ms first-word latency, ~3–5% WER on clean English**, and
materially better than the legacy recognizer. Language assets are downloaded and
managed via `AssetInventory` (check installed → request download → transcribe
offline).

`SpeechTranscriber.supportedLocales` (iOS 26) returns 40 region-locales spanning
**~22 distinct languages**:
`ar de en es fi fr he it ja ko ms nb(no) nl pt ru sv th tr vi yue zh` (+ da).

**Mapped against our 52 locales:**

- **iOS-26-native on-device COVERED (24):**
  `ar da de en es fi fr he it ja ko-polite ms nl no pt-BR pt-PT ru sv th tr
  vi yue-Hant-HK zh-Hans zh-Hant`
- **iOS-26-native NOT covered (27)** → fallback path required:
  `bg bn ca cs el fa gu hi hr hu id kn lt mr ne pa-Arab pa-Guru pl ro sk sl
  sr sw ta te uk ur`

Notable gaps to call out for the product owner: **Hindi, Ukrainian, Polish,
Czech, Greek, Persian/Farsi, Indonesian, Catalan, Bengali, Tamil, Telugu,
Punjabi, Urdu, Swahili** — none on Apple on-device. Several (hi, pl, cs, uk, id,
el) are *major* languages that Apple covers in the cloud but not yet on-device.

> Caveat: locale availability is device- and OS-version-dependent. Treat the
> lists above as a planning baseline; the runtime is `isOnDeviceAvailable(lang)`
> probing the live API (§5), never a static table.

### 1b. Android — `SpeechRecognizer` / `createOnDeviceSpeechRecognizer`

- `SpeechRecognizer.createOnDeviceSpeechRecognizer()` was added in **Android 13
  (API 33)**. It forces on-device recognition and fails if no local engine
  supports the language. The plain `createSpeechRecognizer()` is unpredictable —
  it "may run on-device or in the cloud" depending on device/config — so for our
  use we explicitly use the on-device factory.
- Coverage check is a runtime probe, not a static list:
  `recognizerIntent → checkRecognitionSupport()` → `RecognitionSupport`
  (`supportedOnDeviceLanguages`, `installedOnDeviceLanguages`,
  `pendingOnDeviceLanguages`), and `triggerModelDownload()` to provision a
  missing language pack.
- The on-device engine is normally **Speech Services by Google**; offline packs
  are downloadable (~70–90 MB each, e.g. en-US ~85 MB, de ~90 MB) — the same
  packs Gboard "Offline speech recognition" uses. Coverage is broad but OEM- and
  device-dependent; **on some non-Pixel devices the on-device engine is thin or
  absent**, so the probe can legitimately return "not available" even for a
  major language. Newer **ML Kit GenAI** on-device recognition (via AICore) is
  alpha as of 2026 — **do not ship it**.
- Practical posture: probe per language at runtime, trigger a download when the
  user first picks voice for that language, and fall back exactly like iOS when
  the probe says no.

**Bottom line for §1:** native on-device STT comfortably covers the high-traffic
languages on both platforms, but leaves a real ~27-locale tail (iOS) where we
must fall back. Design for the probe, not the table.

---

## 2. THE CRUX — does native STT run out-of-process? (YES)

**Verified: native OS STT does NOT run inside our app's process, so it does NOT
draw on our llama GPU/RAM/jetsam budget. Native STT and a resident Qwen3 run
concurrently with no model juggling.**

- **iOS:** `SFSpeechRecognizer` / `SpeechAnalyzer` are thin client APIs. The
  actual audio decode and acoustic/LM models run in Apple system daemons
  (`localspeechrecognition` / `LSRConnection`, the SpeechRecognitionCore
  service), reached over **XPC**. The recognition models live in that daemon's
  address space — not ours. (This is also why XPC-connection errors surface when
  that *separate* service is unavailable.) Our process pays only for the audio
  buffers we hand over and the small client stub.
- **Android:** `SpeechRecognizer` is a thin client that binds, via `IBinder`
  IPC, to a `RecognitionService` (Speech Services by Google) that **runs in its
  own process**. Android services can even declare `android:process=":..."`;
  Google's recognizer is a separate app/process. The model memory is charged to
  that service, not to us.

**Contrast with our current Whisper (`tauri-plugin-stt`):** whisper.cpp runs
**in-process** — on iOS it calls `whisper_init_from_file_with_params` and an
`AVAudioEngine` directly inside the app (see `STTPlugin.swift`; the plugin even
reads its own RSS via `os_proc_available_memory()` and reports
`availableMemoryMB`). So Whisper's 1.6 GB lands squarely on our jetsam budget and
fights llama for RAM/GPU. **That is exactly the contention we eliminate by
preferring native STT.**

> Implication: "native STT + resident Qwen3 concurrently" is FREE of the model
> juggling problem. The juggling problem is *specific to Whisper*, because only
> Whisper is in-process.

---

## 3. Qwen3-4B (2.4 GB GGUF) load/unload cost & resident feasibility

Source of truth in-repo: `plugins/tauri-plugin-corpan-llm/src/state.rs`. The
model is loaded by an **actor thread** via `LlamaModel::load_from_file`, GPU
(Metal, `n_gpu_layers`) with a CPU+mmap fallback; the load comment literally
says *"Model load is a multi-second mmap; wait off the async executor."*

**Load (cold, disk → ready):** multi-second on iPhone. llama.cpp `mmap`s the
GGUF, but Metal still has to fault pages in and allocate the GPU residency set
for offloaded layers; first inference also warms KV/compute buffers. Budget
**~2–6 s** cold on a modern A-series, more on a cold filesystem cache. This is
**too slow to do per dialogue turn** — it would put a multi-second stall in
front of every NPC reply.

**Unload:** fast (drop the `LlamaContext` then the `LlamaModel`; the plugin's
documented drop-order invariant — session dropped before model). Sub-second to
return memory, but the *next* load pays the full cold cost again.

**Resident feasibility (the real question):** A 4B Q4_K_M (~2.4 GB file) sits at
roughly **~2.5–3 GB resident** (weights + KV cache at 4096 ctx + Metal buffers).
Measured llama.cpp Metal throughput on A17-class iPhones is ~15–30 tok/s — fine
for chatty NPC turns.

iOS **jetsam per-process** caps (not total RAM) are the constraint:
- 4 GB iPhone: ~2.0–2.1 GB cap (measured "ActiveHard 2098 MB" crash) → **Qwen3
  alone does NOT fit. These devices are LLM-incapable; text-only NPC fallback.**
- 6 GB iPhone: ~3 GB-ish cap → **Qwen3 resident fits, but with little headroom**
  alongside a Babylon WebGL world. There is **no room for a second 1.6 GB
  Whisper resident.**
- 8 GB iPhone (A17 Pro+): larger cap (~4 GB+ class) → Qwen3 + WebGL fits
  comfortably; Qwen3 + Whisper is marginal at best.
- The `com.apple.developer.kernel.increased-memory-limit` entitlement raises the
  cap (model-dependent, Apple doesn't publish the number) and is worth adopting,
  but **must not be the load-bearing assumption** — we still design for the
  default cap.

**Conclusions:**
- Keeping Qwen3 resident the whole session, **next to the Babylon world**, is
  feasible on 6 GB+ phones and all our tablets/desktop targets. Good.
- Holding **Qwen3 (2.4 GB) AND Whisper (1.6 GB) resident simultaneously (~4 GB+)
  is NOT feasible** on 6 GB phones and is marginal on 8 GB. The product owner's
  instinct is correct.
- Therefore: if we ever need Whisper, it is **mutually exclusive** with the
  resident LLM — which is precisely why we make native STT the primary path and
  Whisper a rare, LLM-unloaded fallback (§6).

---

## 4. Decision matrix

| Option | What | Concurrency w/ LLM | UX cost | Lang coverage | Verdict |
|---|---|---|---|---|---|
| **A. Native STT + resident Qwen3 (no Whisper)** | OS `SpeechAnalyzer`/`SpeechRecognizer` for voice; Qwen3 stays hot | **Concurrent (separate process)** — no juggling | Best: instant speak→reply, no keyboard | ~24/52 on-device iOS; broad on Android (device-dependent) | **PRIMARY** |
| **B. Whisper + Qwen3 with load/unload juggling** | In-process Whisper, only one of {LLM, Whisper} hot | **Mutually exclusive** (~4 GB > jetsam) | Bad: ~2–6 s LLM reload **after every utterance**; mic→reply gains a multi-second model swap; brittle on memory pressure | 99 langs (Whisper) | **Fallback only**, when native STT absent for that lang |
| **C. Keyboard text + Qwen3 (no STT)** | Type; LLM replies | Concurrent (no STT model) | "Keyboard pops up"; but reliable + universal | All 52 | **Universal floor / long-tail default** |

**UX cost of Option B, quantified:** because Whisper is in-process and can't
coexist with the resident LLM on a 6 GB phone, every voice turn becomes
`unload LLM → load Whisper → record → transcribe → unload Whisper → reload LLM
(2–6 s) → generate`. That's **two large-model loads per spoken turn** and a
multi-second stall right before the NPC speaks — exactly the "slow and buggy"
juggling the owner feared. We refuse to put this on the default path.

### Recommendation by platform × language tier

- **Tier 1 — native-on-device language (iOS 24 / Android probe == yes):**
  Voice via **native STT**, Qwen3 resident, concurrent. Dream UX. No Whisper.
- **Tier 2 — no native on-device, but user wants voice (the ~27 iOS tail, or
  Android probe == no):**
  - Default to **keyboard text** (Option C) — zero memory cost, instant, works
    today.
  - Offer **"Voice (downloads a model)"** as an *opt-in* that uses
    **Whisper-on-demand with the LLM unloaded** (Option B mechanics) for that
    isolated interaction. Acceptable because it's a deliberate, occasional
    choice, not the per-turn loop.
- **Tier 3 — memory-incapable device (≤4 GB iPhone):** No resident LLM →
  **scripted NPC fallback** (`NpcRole.scriptedFallback`, already in the
  contracts) + keyboard. STT irrelevant.
- **Desktop (macOS) & tablets:** Plenty of RAM. macOS 26 gets `SpeechAnalyzer`
  natively (same coverage). Where native STT is absent and RAM is ample,
  Whisper *can* coexist with the LLM — but keep the same seam so behavior is
  uniform; only relax the broker's exclusivity on desktop after measuring.

---

## 5. Integration seam — `VoiceInput` interface

The NPC dialogue runtime must code against a **backend-agnostic** voice seam, so
"native vs Whisper vs none" is a per-platform/per-language implementation detail,
never branched in game logic. Proposed contract (belongs in
`contracts/src/` alongside `chat.ts`; the `kind: "speech"` `ChatSource` already
expects a `transcript`, so this feeds straight in):

```ts
export type VoiceBackend = "native" | "whisper" | "none"

export interface VoiceAvailability {
  /** Can we capture voice for this lang at all (any backend)? */
  available: boolean
  /** Which backend would serve it right now. */
  backend: VoiceBackend
  /** True only when it runs out-of-process (native) → safe alongside resident LLM. */
  concurrentWithLlm: boolean
  /** Native pack present, or needs a one-time download first. */
  needsDownload: boolean
}

export interface VoiceTranscript {
  transcript: string
  confidence: number          // 0..1
  language: string            // BCP-47 actually used
  backend: VoiceBackend
  isPartial?: boolean         // streaming interim result
}

export interface VoiceInput {
  /** Probe — drives whether the UI shows a mic or a keyboard for this lang. */
  isOnDeviceAvailable(lang: string): Promise<VoiceAvailability>
  /** Provision a missing on-device language pack (native) ahead of use. */
  ensureLanguage(lang: string): Promise<boolean>
  /** Begin capture. Rejects if backend unavailable; may stream partials via onPartial. */
  start(lang: string, onPartial?: (t: VoiceTranscript) => void): Promise<void>
  /** End capture, resolve final transcript. */
  stop(): Promise<VoiceTranscript>
  cancel(): Promise<void>
}
```

**Who fulfills it:**

- **iOS / macOS — `NativeVoiceInput`:** wraps `SpeechAnalyzer` +
  `SpeechTranscriber` (iOS/macOS 26) with `SFSpeechRecognizer` fallback for
  ≤iOS 25. `isOnDeviceAvailable` checks `supportedLocales` /
  `supportsOnDeviceRecognition`; `ensureLanguage` uses `AssetInventory`.
  `concurrentWithLlm = true`.
- **Android — `NativeVoiceInput`:** wraps `createOnDeviceSpeechRecognizer` +
  `checkRecognitionSupport`/`triggerModelDownload`. `concurrentWithLlm = true`.
- **Whisper fallback — `WhisperVoiceInput`:** wraps the existing
  `tauri-plugin-stt` (`prepare` / `start_session` / `stop_session`).
  `concurrentWithLlm = false` (in-process; broker must unload the LLM first).
- **`KeyboardVoiceInput` (degenerate):** `isOnDeviceAvailable → {available:false}`
  so the UI renders a text field. Not really voice; it's the floor.

A thin `resolveVoiceInput(platform, lang)` picks the backend; the dialogue
runtime only ever sees `VoiceInput`.

### Plugin work required

- **A NEW native-STT Tauri plugin is needed** (e.g. `tauri-plugin-native-stt`).
  Do **not** overload `tauri-plugin-stt` — that plugin is a tightly-tuned
  whisper.cpp scorer (per-word timings, acoustic ramps, compression-ratio gates,
  `WhisperParams`/`ScoringParams` wire contracts in its `models.rs`). Its job is
  pronunciation *scoring*, not general dictation, and its `start_session` shape
  (`expectedText`, scoring overlays) is wrong for free-form NPC dictation.
- The new plugin is small: iOS Swift over `SpeechAnalyzer`/`SFSpeechRecognizer`,
  Android Kotlin over `SpeechRecognizer`/`createOnDeviceSpeechRecognizer`,
  desktop = unavailable (returns `available:false`, runtime falls to keyboard or
  Whisper). Mirror the existing plugin layout
  (`commands.rs`/`models.rs`/`mobile.rs`/`desktop.rs`).
- **Wire-format gotcha (institutional knowledge):** every field JS reads MUST be
  declared in the plugin's Rust `models.rs` — serde silently drops undeclared
  fields at the Rust boundary, **both directions** (see the `PrepareResult` /
  `availableMemoryMB` docstrings in `tauri-plugin-stt/src/models.rs`). Declare
  `transcript`, `confidence`, `language`, `backend`, availability fields
  explicitly with correct `rename`s.
- Keep `tauri-plugin-stt` (Whisper) exactly as-is for both pronunciation-coach
  AND the Corpan City Tier-2 fallback.

---

## 6. Model broker — what may be hot at once

A small JS/native **model broker** owns the invariant. Rules:

1. **LLM (Qwen3) is the privileged resident.** Loaded when an NPC dialogue
   context opens; stays resident across turns for the whole session.
2. **Native STT is always allowed concurrently** with the resident LLM — it is
   out-of-process and costs us no GPU/RAM budget (§2). No coordination needed
   beyond mic permission and audio-session handling.
3. **Whisper is mutually exclusive with the resident LLM.** Whisper may load
   **only after the LLM is unloaded**, and the LLM is reloaded after the Whisper
   transcription completes. Allowed only on the Tier-2 opt-in voice path, never
   on the default turn loop. (On desktop, the broker MAY relax this after
   measuring real headroom; phones never.)
4. **Never two large in-process models at once.** The broker tracks a single
   `inProcessLargeModel ∈ {llm, whisper, none}` slot and serializes transitions.
5. **Audio session:** mind the existing `tauri-plugin-radio-stream`
   `.longForm` AVAudioSession policy (set process-wide at launch — see project
   memory). Native STT capture and any TTS playback must cooperate with it; do
   not strip `.longForm`.

**Idle / lifecycle:**

- **LLM idle-unload:** keep resident while a dialogue UI is open. Start an
  idle timer (suggest **~90–120 s** with no NPC interaction) → unload to reclaim
  RAM for the world; reload (the ~2–6 s cost) on next NPC engagement, behind a
  "thinking…" affordance. Tune against jetsam telemetry.
- **Native STT idle:** tear down the recognizer/audio engine promptly after each
  utterance (it's cheap to recreate and out-of-process); release the mic so the
  OS indicator clears.
- **On app background:** **unload the LLM immediately** (iOS reclaims aggressively
  on background; a 2.5 GB resident is prime jetsam bait). Stop any STT session
  and release the audio session. Re-establish on foreground. This mirrors the
  plugin's existing exit→re-enter reload path (drop model before reload).
- **On memory-pressure warning:** unload the LLM first (largest single
  reclaimable block), keep native STT (free), degrade NPCs to scripted/keyboard
  until pressure clears.

---

## Appendix — coverage quick-reference

**iOS 26 SpeechTranscriber on-device, present in our set (24):**
`ar da de en es fi fr he it ja ko-polite ms nl no pt-BR pt-PT ru sv th tr vi
yue-Hant-HK zh-Hans zh-Hant`

**No iOS on-device → keyboard default / Whisper opt-in (27):**
`bg bn ca cs el fa gu hi hr hu id kn lt mr ne pa-Arab pa-Guru pl ro sk sl sr
sw ta te uk ur`

**Android:** probe `checkRecognitionSupport()` per language at runtime; broad
on-device coverage via Speech Services by Google packs, but device/OEM-dependent
— never assume, always probe + `triggerModelDownload`.

**Always available, every language, every device:** keyboard text → Qwen3.

---

### Sources

- Apple — [SFSpeechRecognizer](https://developer.apple.com/documentation/speech/sfspeechrecognizer),
  [supportsOnDeviceRecognition](https://developer.apple.com/documentation/Speech/SFSpeechRecognizer/supportsOnDeviceRecognition),
  [SpeechTranscriber](https://developer.apple.com/documentation/speech/speechtranscriber),
  [WWDC25: SpeechAnalyzer](https://developer.apple.com/videos/play/wwdc2025/277/)
- [iOS 26 SpeechAnalyzer Guide (supportedLocales list)](https://antongubarenko.substack.com/p/ios-26-speechanalyzer-guide)
- [Available Languages in On-device Speech Recognition on iOS, 2022](https://medium.com/@toru_furuya/available-languages-in-on-device-speech-recognition-on-ios-in-2022-8c6383fac9f2)
- [iOS Speech Recognition in 2026: SpeechAnalyzer, WhisperKit (forasoft)](https://www.forasoft.com/blog/article/speech-recognition-with-neural-networks-on-ios-1621)
- iOS process/XPC isolation — [Apple Developer Forums: Speech XPC errors](https://developer.apple.com/forums/thread/750371)
- Android — [SpeechRecognizer](https://developer.android.com/reference/android/speech/SpeechRecognizer),
  [RecognitionService](https://developer.android.com/reference/android/speech/RecognitionService),
  [Android Speech Recognition in 2026 (Picovoice)](https://picovoice.ai/blog/android-speech-recognition/),
  [Google offline voice typing packs](https://voxdocs.me/blog/google-voice-typing-without-internet/)
- Qwen3/llama.cpp on iPhone — [Running LLMs locally on iPhone 2026](https://dev.to/alichherawalla/how-to-run-llms-locally-on-your-iphone-in-2026-completely-offline-no-subscription-4b3a),
  [Practical GGUF Quantization Guide (Enclave AI)](https://enclaveai.app/blog/2025/11/12/practical-quantization-guide-iphone-mac-gguf/)
- iOS jetsam limits — [Apple Developer Forums: jetsam per-process-limit](https://developer.apple.com/forums/thread/688973),
  [iOS Memory Limits (PojavLauncher)](https://github.com/PojavLauncherTeam/PojavLauncher_iOS/issues/97),
  [9to5Mac: Increased Memory Limit entitlement](https://9to5mac.com/2021/06/25/apps-can-request-access-to-more-ram-with-ios-15-entitlement-exceeding-normal-system-memory-limits/)
- In-repo: `plugins/tauri-plugin-corpan-llm/src/state.rs`,
  `plugins/tauri-plugin-stt/src/models.rs`,
  `plugins/tauri-plugin-stt/ios/Sources/STTPlugin.swift`,
  `packs/corpan-city/contracts/src/{chat,npc}.ts`
