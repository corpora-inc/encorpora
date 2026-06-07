# Corpan City — Native On-Device STT for SPEAK CHALLENGES

**Status:** Research + plan (RESEARCH agent `stt-rd`). 2026-06-04.
**Audience:** Engineers wiring the read-aloud / say-it-back challenge scorer.
**Scope:** The *challenge* speak surface (`read-aloud`, `say-it-back`) that today
shows **"STT unavailable — tap to self-rate."** Should it use native OS STT
(Apple `SpeechAnalyzer`/`SFSpeechRecognizer`, Android `SpeechRecognizer`)
instead of bundled Whisper?

> **Sibling doc:** `MODEL_STRATEGY.md` (2026-06-02) already decided the same
> native-first posture for the **NPC dialogue voice loop** (free-form dictation
> concurrent with a resident Qwen3). This doc is the **challenge-specific**
> companion: same engines, but a *much easier* problem (we know the target
> phrase) and a *different* runtime path (no LLM resident → no model-juggling
> concern at all). Read §1 of MODEL_STRATEGY for the per-locale coverage tables;
> this doc focuses on the scoring problem, why the challenge surface is dark
> today, and the concrete integration.

---

## TL;DR — recommendation

**Native-first, with Whisper-opt-in and self-rate as the two fallbacks.**

1. The challenge ask is **known-target phrase repetition**, not open dictation.
   We already have the expected text. So even a *rough* native transcript +
   **fuzzy/phonetic match against the known target** yields a perfectly good
   pass/fail + 0..1 score. This is dramatically easier than the open-dictation
   problem and makes native STT's lower-than-cloud accuracy a non-issue.
2. **Native STT is ~zero app memory** (runs in a separate OS process / daemon —
   verified in MODEL_STRATEGY §2) and needs **no 75 MB–1.6 GB model download**.
   For the challenge path there is no resident LLM, so the model-juggling
   problem that complicates the NPC loop **does not even arise here.** Native is
   strictly the cleaner choice.
3. **Arabic IS covered on-device by both platforms** (the owner's concrete
   case): Apple iOS 26 `SpeechTranscriber.supportedLocales` includes `ar_SA`
   (confirmed live, see §3); Android exposes Arabic offline packs via Speech
   Services by Google on most devices (probe `checkRecognitionSupport`).
   Learning Arabic-from-English will get real recognition, not self-rate.
4. **Fallback chain** the challenge scorer should resolve, per language, at
   runtime: **native on-device → (opt-in) Whisper → self-rate.** Self-rate stays
   as the universal floor (it's a fine, dignified UX and already built).
5. Build a **new small `tauri-plugin-native-stt`** (do NOT overload
   `tauri-plugin-stt`, the Whisper *scorer*). The challenge host's `recordAndScore`
   gains a native code path; the existing Whisper `start_session`/`stop_session`
   path stays as the Tier-2 fallback for gap languages.

Net: the speak challenges light up with real recognition for the high-traffic
languages (incl. Arabic) on a default install with **no model download**, and
degrade gracefully (Whisper opt-in, then self-rate) for the long tail.

---

## 1. Why the challenge shows "STT unavailable" TODAY (grounded in our code)

The speak tools (`packs/corpan-city/src/challenges/tools/sttTools.ts`,
`read-aloud` + `say-it-back`) gate on `host.sttAvailable()` and render the
self-rate UI when it's false (string `challenge.selfRateHint`,
`i18n/strings.ts:312`). The availability resolves through two host shapes:

- **Standalone (browser / no host):** `game.ts:128` uses `mockChallengeHost()`,
  whose `sttAvailable: async () => true` and a fake `recordAndScore` that
  returns a fixed 0.86 (`host.ts:423`, `:409`). So in standalone you see the mic
  — but it's a mock; nothing is actually recognized.
- **Real embedded app:** `game.ts:127` uses `createChallengeHost(host)`, which
  wraps the Corpán `HostApi.stt` (`host.ts:189`). `sttAvailable` calls
  `stt.getStatus()` and returns `Boolean(s.available)`. That `available` is the
  **Whisper plugin's** status (`tauri-plugin-stt`,
  `StatusResult.available`/`prepared` in `models.rs`) — it is true only when the
  whisper.cpp model is **installed and prepared**.

**So the root cause:** the challenge STT is backed *only* by `tauri-plugin-stt`
(Whisper), and Corpan City users do **not** have a Whisper model installed by
default — that's a 75 MB–1.6 GB download tied to the *pronunciation-coach* pack
(`pronunciation-coach/src/modelRegistry.ts`), not to Corpan City. With no model
prepared, `getStatus().available` is false → every speak challenge falls to
self-rate. The "STT unavailable" message is not a bug; it's the honest state of
a Whisper-only design with no model on disk.

**Native STT fixes exactly this:** OS recognition needs no app-bundled model and
is available the moment the platform language pack is present (or downloadable),
so the speak challenges can recognize speech on a default install.

---

## 2. The challenge problem is EASIER than dictation — exploit it

The speak challenges already pass `expected` (the target phrase) into
`recordAndScore({ language, expected })` (`sttTools.ts:101`, `host.ts:67`). We
are NOT doing open-vocabulary dictation; we are checking "did the learner say
*this known phrase* well enough." That changes the engineering completely:

- **Recognition accuracy floor is low.** Native STT only has to get *close*; the
  scorer compares the transcript to the known target. A wrong word here and
  there still scores fairly via edit distance.
- **Scoring = string/phonetic similarity to the target**, not the elaborate
  acoustic/log-prob machinery `tauri-plugin-stt` carries (per-word posteriors,
  compression-ratio gates, free-vs-constrained dual decode). For a casual RPG
  challenge that machinery is overkill — those signals don't even exist in a
  native-STT transcript (the OS returns text + a coarse confidence, not Whisper's
  internals).
- **Recommended challenge scorer** (cheap, language-robust, runs in JS in the
  pack — no native scoring needed):
  1. Normalize both strings (lowercase, strip punctuation, NFC, collapse
     whitespace; for non-spaced scripts like `ja`/`zh`/`yue`/`th`, compare on
     character n-grams instead of word tokens).
  2. Compute **token/char Levenshtein similarity** (1 − edits/maxlen) →
     baseline 0..1.
  3. Optionally blend the OS-reported **confidence** (Apple gives per-segment
     confidence; Android `SpeechRecognizer` gives `EXTRA_CONFIDENCE_SCORES`) as
     a light multiplier so a hesitant correct-text utterance doesn't max out.
  4. Map to the existing 0..1 the challenge UI already expects
     (`ChallengeSttResult.score`, pass threshold 0.6 in `sttTools.ts:121`).
  - For a nicer future signal, a **phoneme-level edit distance** (IPA / weighted
    Levenshtein, the established pronunciation-assessment technique — see
    sources) beats raw orthographic distance, especially across scripts; but the
    orthographic baseline is enough to ship and is what most lightweight apps
    use. Keep it behind the same `score` seam so we can upgrade later.

This is the crux of the recommendation: **the known-target framing is what makes
native STT's "merely good" accuracy entirely sufficient** for the challenge —
unlike free-form NPC dictation where wrong words actually mislead the LLM.

---

## 3. Per-engine feasibility + the language matrix (esp. Arabic)

Full per-locale tables live in `MODEL_STRATEGY.md §1` and its appendix; this is
the challenge-relevant summary, re-verified 2026-06-04.

### 3a. Apple — iOS/macOS 26 `SpeechAnalyzer` + `SpeechTranscriber`

- Fully on-device, no ~1-min cap, sub-200 ms first word, language assets via
  `AssetInventory` (check installed → request download → recognize offline).
- **`SpeechTranscriber.supportedLocales` (verified live 2026-06-04)** — 42
  region-locales over ~22 languages:
  `ar_SA, da_DK, de_{AT,CH,DE}, en_{AU,CA,GB,IE,IN,NZ,SG,US,ZA}, es_{CL,ES,MX,US},
  fi_FI, fr_{BE,CA,CH,FR}, he_IL, it_{CH,IT}, ja_JP, ko_KR, ms_MY, nb_NO,
  nl_{BE,NL}, pt_BR, ru_RU, sv_SE, th_TH, tr_TR, vi_VN, yue_CN, zh_{CN,HK,TW}`.
- **Arabic: YES.** `ar_SA` is in the on-device set. Learning-Arabic-from-English
  speak challenges get real Apple on-device recognition.
- **Legacy `SFSpeechRecognizer` (≤ iOS 25):** ~22 on-device languages incl.
  Arabic; gate with `supportsOnDeviceRecognition` +
  `requiresOnDeviceRecognition = true`; ~1-min/request cap (fine for a phrase).
  This is the fallback for pre-26 devices.

**Mapped to our 52 locales — native on-device COVERED on iOS (24):**
`ar da de en es fi fr he it ja ko-polite ms nl no pt-BR pt-PT ru sv th tr vi
yue-Hant-HK zh-Hans zh-Hant`.

**NOT covered on Apple on-device (27)** → Whisper-opt-in or self-rate:
`bg bn ca cs el fa gu hi hr hu id kn lt mr ne pa-Arab pa-Guru pl ro sk sl sr sw
ta te uk ur`. (Notable major-language gaps: Hindi, Polish, Czech, Ukrainian,
Greek, Persian, Indonesian, Catalan, Bengali, Tamil, Telugu, Punjabi, Urdu,
Swahili.)

### 3b. Android — `SpeechRecognizer` / `createOnDeviceSpeechRecognizer`

- `createOnDeviceSpeechRecognizer()` (API 33 / Android 13+) forces on-device;
  `checkRecognitionSupport()` → `RecognitionSupport`
  (`supportedOnDeviceLanguages` / `installedOnDeviceLanguages` /
  `pendingOnDeviceLanguages`); `triggerModelDownload()` to provision a pack.
  (Pre-13: `RecognizerIntent` + `EXTRA_PREFER_OFFLINE`, no clean probe.)
- Engine is normally **Speech Services by Google**; offline packs ~70–90 MB
  each, the same packs Gboard offline voice typing uses. **Arabic offline pack
  exists** on most Google-services devices — but coverage is **OEM/device-
  dependent**: some non-Pixel devices ship a thin/absent on-device engine, so
  the probe can legitimately say "no" even for a major language.
- **Posture: always probe per-language at runtime, offer a download on first
  voice use, fall back exactly like iOS.** Never assume from a static table.
- ML Kit GenAI on-device recognition (via AICore) is still alpha as of 2026 —
  **do not ship it.**

### 3c. Neither engine on-device → fallback

Languages absent on both (and any device that fails the probe) take the
**Whisper-opt-in → self-rate** chain. The ~27-locale Apple tail above is the
worst case; Android frequently covers some of those via Google packs, so the
*real* "no native anywhere" set is smaller and device-specific. Self-rate (built,
shipping today) is always the floor and is a fine UX for the long tail.

### 3d. Coverage at a glance

| Engine | On-device langs (our set) | Arabic? | Model download | App memory |
|---|---|---|---|---|
| Apple iOS/macOS 26 SpeechTranscriber | ~24 / 52 | **Yes (`ar_SA`)** | OS-managed asset, not bundled | ~0 (separate daemon) |
| Apple ≤iOS 25 SFSpeechRecognizer | ~22 (incl. ar) | Yes | OS-managed | ~0 (XPC daemon) |
| Android on-device SpeechRecognizer | broad, device-dependent | Yes (most devices) | ~70–90 MB OS pack, on demand | ~0 (separate process) |
| **Whisper (`tauri-plugin-stt`)** | 99 langs | Yes | **75 MB–1.6 GB, ours** | **in-process, 0.6–3 GB** |
| Self-rate (floor) | all 52 | n/a | none | none |

---

## 4. Memory / footprint comparison (the owner's core concern)

The owner's worry: "a giant Whisper model is too much device memory." Confirmed
and quantified — for the challenge path the contrast is even starker than for
the NPC loop (no LLM in the picture, so it's purely STT-vs-STT):

- **Whisper (`tauri-plugin-stt`, in-process whisper.cpp):** the smallest viable
  multilingual tier is Small (465 MB on disk); the quality tiers that actually
  recognize non-Latin scripts well are 547 MB–1.6 GB
  (`pronunciation-coach/src/modelRegistry.ts`). Runtime first-transcribe spike
  hits **0.6–3 GB resident** and is **charged to our jetsam budget** (the plugin
  literally reads `os_proc_available_memory()` and memory-gates large variants).
  Plus a multi-minute download and a 1.6 GB file on the user's disk.
- **Native STT:** the acoustic/LM models live in an **OS daemon / separate
  process**, not our address space (MODEL_STRATEGY §2 — iOS XPC to
  `localspeechrecognition`; Android binds an out-of-process `RecognitionService`).
  Our app pays only for the audio buffers and a thin client stub — **effectively
  ~0 of our memory budget.** No app-bundled model; OS-managed language assets
  (Apple `AssetInventory`; Android `triggerModelDownload`), and on iOS the asset
  is often already present from system dictation.

**For the challenge surface specifically there is no resident-LLM contention to
reason about** — the speak challenge isn't an NPC turn. So native STT here is an
unambiguous win: real recognition, zero model download, zero app memory.

---

## 5. Integration plan — host + pack

The pack already owns the right seam. The challenge contract
(`packs/corpan-city/src/challenges/host.ts`) exposes
`sttAvailable()` + `recordAndScore({ language, expected }) → { stop, cancel,
onLevel }`, and there's a separate backend-agnostic `VoiceInput` seam for the
NPC loop (`packs/corpan-city/src/npc/voiceInput.ts`, `KeyboardVoiceInput` floor
today). We extend the **host side** to add a native path; the pack's challenge
UI (`sttTools.ts`) needs almost no change.

### 5a. New plugin: `tauri-plugin-native-stt` (do NOT overload `tauri-plugin-stt`)

- `tauri-plugin-stt` is a tightly-tuned whisper.cpp **scorer** — per-word
  timings, acoustic ramps, compression-ratio gates, `WhisperParams`/
  `ScoringParams` wire contracts. Its `start_session` shape (expectedText +
  scoring overlays) and in-process model loading are wrong for native OS STT.
  Keep it exactly as-is (pronunciation-coach + the Corpan City Whisper fallback).
- New plugin, small, mirroring the existing layout
  (`commands.rs`/`models.rs`/`mobile.rs`/`desktop.rs`):
  - **iOS Swift:** `SpeechAnalyzer`+`SpeechTranscriber` (26+), `SFSpeechRecognizer`
    fallback (≤25). `isOnDeviceAvailable` ← `supportedLocales` /
    `supportsOnDeviceRecognition`; `ensureLanguage` ← `AssetInventory`.
  - **Android Kotlin:** `createOnDeviceSpeechRecognizer` + `checkRecognitionSupport`
    / `triggerModelDownload`; request `EXTRA_CONFIDENCE_SCORES`.
  - **Desktop:** macOS 26 can use `SpeechAnalyzer`; otherwise `available:false`
    (runtime falls to keyboard/self-rate or Whisper where RAM is ample).
  - Surface: `is_available(lang)`, `supported_locales()`, `ensure_language(lang)`,
    `start_session(sessionId, language)`, `stop_session(sessionId) → { transcript,
    confidence, language }`, `cancel_session`, plus the audio-level event for the
    VU meter. **No expectedText/scoring on the native side — scoring is the
    pack's job** (§2), since native STT returns text+confidence only.
- **Wire-format gotcha (institutional knowledge, repeated for this plugin):**
  every field JS reads MUST be declared in the plugin's Rust `models.rs` — serde
  silently drops undeclared fields at the Rust boundary in BOTH directions (see
  the `PrepareResult` / `availableMemoryMB` docstrings in
  `tauri-plugin-stt/src/models.rs`). Declare `transcript`, `confidence`,
  `language`, availability fields explicitly with correct `rename`s.

### 5b. Host adapter — fallback chain in `createChallengeHost`

Extend the Corpán `HostApi` with a `nativeStt` slice and resolve the backend
per call inside `recordAndScore` / `sttAvailable`:

```
sttAvailable(language):
  if nativeStt?.isAvailable(language)        → true   (native, no download, no LLM cost)
  else if whisper.getStatus().available      → true   (Whisper, if user opted in / model present)
  else                                       → false  (UI shows self-rate)

recordAndScore({ language, expected }):
  backend = resolve(language)   # native → whisper → none
  native:  start native session; on stop() get transcript+confidence;
           score = challengeScore(transcript, expected, confidence)   # §2, in pack/host JS
  whisper: existing start_session/stop_session path (returns overallScore directly)
  none:    degraded recorder (already present, host.ts:209)
```

- `challengeScore()` (the §2 normalize + Levenshtein/phonetic-similarity blend)
  lives in the pack or host JS, NOT native — it's pure string math and the same
  for every language. This means the native plugin stays a dumb dictation
  bridge; all pronunciation-grading policy is in one TS place we can tune.
- **Pack UI change is minimal:** `sttTools.ts` already feature-detects via
  `sttAvailable()` and renders the mic vs self-rate. It keeps working unchanged;
  it just starts seeing `true` (native) on a default install for covered langs.
  Optional polish: when the language needs a one-time native pack download,
  surface an "enable voice" affordance (maps to `ensure_language`) instead of
  silently self-rating.

### 5c. Relationship to the NPC `VoiceInput` seam

The NPC loop's `VoiceInput`/`resolveVoiceInput` (`npc/voiceInput.ts`) and the
challenge `recordAndScore` are two consumers of the **same** native plugin. Build
the plugin once; let both seams call it. The NPC loop adds the
`concurrentWithLlm`/broker concern (MODEL_STRATEGY §6); **the challenge path does
not** (no resident LLM during a speak challenge), so the challenge integration is
the simpler, lower-risk first delivery. Recommend shipping the challenge path
first to de-risk the plugin, then wiring the NPC loop.

---

## 6. Risks / honest gaps

- **Coverage is a runtime probe, never a table.** Apple locale availability is
  device/OS-version-dependent; Android on-device coverage is OEM-dependent and
  can be absent on non-Google-services devices. Design strictly around
  `isOnDeviceAvailable(lang)` + graceful fallback; the §3 lists are planning
  baselines only.
- **Confidence signals differ from Whisper's.** Native STT gives text + a coarse
  confidence, not Whisper's rich acoustic internals. Our challenge scorer must
  rest on target-similarity (§2), not on engine internals. This is a feature
  (uniform across engines), but it means the score's "meaning" differs subtly
  from the pronunciation-coach Whisper score — fine, since Corpan City challenges
  are casual, not a pronunciation grader.
- **Script edge cases.** Non-spaced scripts (`ja zh yue th`) need char-n-gram
  similarity, not word tokens. Romanization-vs-script: the challenge target is
  in the target script; native STT returns the script — good. But a learner who
  reads the romanization aloud may mismatch; acceptable (we score the actual
  target text).
- **The ~27-locale Apple tail** (Hindi, Polish, Ukrainian, etc.) genuinely has
  no Apple on-device path. Android may cover some; the rest are Whisper-opt-in or
  self-rate. This is the same tail MODEL_STRATEGY accepts; no new problem.
- **Pre-API-33 Android / pre-iOS-26** use the legacy recognizers (still good for
  the major langs incl. Arabic) — handle in the plugin, don't assume newest OS.
- **Permissions / audio session.** Native STT needs mic + (iOS) speech-recognition
  permission, and must cooperate with the existing `tauri-plugin-radio-stream`
  `.longForm` AVAudioSession policy (do not strip it — project memory).

---

## 7. Recommendation (restated, concrete)

1. Build **`tauri-plugin-native-stt`** (iOS SpeechAnalyzer/SFSpeechRecognizer,
   Android on-device SpeechRecognizer, desktop best-effort). Small, mirrors the
   existing plugin layout; declare every JS-read field in `models.rs`.
2. Add a **native path to the challenge host** (`createChallengeHost`):
   `sttAvailable`/`recordAndScore` resolve **native → Whisper(opt-in) →
   self-rate** per language. Put the **known-target similarity scorer (§2)** in
   pack/host JS so native STT only has to bridge dictation.
3. Ship the **challenge path first** (no LLM-broker complexity), then reuse the
   same plugin for the NPC `VoiceInput` loop.
4. **Arabic-from-English works on a default install** on both platforms via
   native on-device — directly answering the owner's test case, with **no
   75 MB–1.6 GB Whisper download and ~0 app memory.**
5. Keep **self-rate as the dignified universal floor** for the long tail and for
   any device where the runtime probe says no.

---

### Sources

- Apple SpeechTranscriber supported locales (incl. `ar_SA`), verified 2026-06-04:
  [supportedLocales](https://developer.apple.com/documentation/speech/speechtranscriber/supportedlocales),
  [SpeechTranscriber](https://developer.apple.com/documentation/speech/speechtranscriber),
  [iOS 26 SpeechAnalyzer Guide (locale list)](https://antongubarenko.substack.com/p/ios-26-speechanalyzer-guide),
  [WWDC25 SpeechAnalyzer](https://developer.apple.com/videos/play/wwdc2025/277/),
  [callstack: on-device SpeechAnalyzer](https://www.callstack.com/blog/on-device-speech-transcription-with-apple-speechanalyzer)
- Apple SFSpeechRecognizer on-device:
  [supportsOnDeviceRecognition](https://developer.apple.com/documentation/Speech/SFSpeechRecognizer/supportsOnDeviceRecognition),
  [requiresOnDeviceRecognition](https://developer.apple.com/documentation/speech/sfspeechrecognitionrequest/requiresondevicerecognition),
  [on-device langs 2022 baseline](https://medium.com/@toru_furuya/available-languages-in-on-device-speech-recognition-on-ios-in-2022-8c6383fac9f2)
- Android on-device SpeechRecognizer:
  [SpeechRecognizer](https://developer.android.com/reference/android/speech/SpeechRecognizer),
  [checkRecognitionSupport / RecognitionSupport (STT missing guide)](https://medium.com/@andraz.pajtler/android-speech-to-text-the-missing-guide-part-1-824e2636c45a)
- Known-target pronunciation scoring (phonetic / weighted Levenshtein):
  [Pronunciation assessment (Wikipedia)](https://en.wikipedia.org/wiki/Pronunciation_assessment),
  [Articulatorily weighted phoneme edit distance (arXiv)](https://arxiv.org/pdf/1905.02639),
  [Microsoft phonetic matching](https://www.microsoft.com/en-us/research/blog/a-phonetic-matching-made-in%CB%88h%C9%9Bv%C9%99n/)
- In-repo: `MODEL_STRATEGY.md` (NPC-loop sibling decision),
  `packs/corpan-city/src/challenges/tools/sttTools.ts`,
  `packs/corpan-city/src/challenges/host.ts`,
  `packs/corpan-city/src/npc/voiceInput.ts`,
  `corpan-app/src/contentPacks/hostApi.ts`,
  `plugins/tauri-plugin-stt/src/models.rs`,
  `packs/pronunciation-coach/src/modelRegistry.ts`
