# Corpán STT Masterplan — Pure Transcription, Everywhere

**Status:** Decision-ready plan. Authored 2026-06-05; restructured 2026-06-06 around provider-per-runtime + a shared on-device model registry.
**Scope:** "Speak instead of type" — a mic affordance that fills **any text input**, across **the core Corpán app and every pack**, for **~51 languages / 52 written scripts**. This is **pure transcription** (dictation), NOT pronunciation alignment/scoring.
**Out of scope (but adjacent):** Parlometron / pronunciation-coach's alignment+scoring. Today that lives in `tauri-plugin-stt`. In this plan it is **refactored to sit ON TOP of a transcription runtime** (§5) rather than being its own whisper-only silo — without breaking shipping Parlometron.

> **Predecessor docs (still valid as detail references):**
> - `packs/corpan-city/docs/MODEL_STRATEGY.md` (2026-06-02) — NPC voice-loop + the out-of-process proof + per-locale tables.
> - `packs/corpan-city/docs/STT_RESEARCH.md` (2026-06-04) — the *challenge* known-target scorer.
> This masterplan generalizes both to **all surfaces + pure transcription**, and supersedes the earlier single-`tauri-plugin-dictation` idea with a **provider-per-runtime** design.

---

## 0. Headline (the whole plan in twelve lines)

1. **One shared `AsrProvider` contract** (TS + Rust). Every engine is a plugin that conforms; they are interchangeable.
2. **Provider-per-runtime plugins:** `tauri-plugin-asr-native` (Apple/Android OS STT), `tauri-plugin-asr-whisper` (whisper.cpp/ggml), `tauri-plugin-asr-qwen3` (Qwen3-ASR, Apache-2.0), `tauri-plugin-asr-sherpa` (one onnxruntime hosting Parakeet-v3 + SenseVoice).
3. **`tauri-plugin-stt` stays — refactored** into the Parlometron *alignment/scoring* layer that runs **on top of** a transcription provider (default: the whisper provider, to preserve today's per-token-logprob scoring).
4. **A first-class corpan-app Model & Asset Registry** (`host.models`): one on-device store for **ALL** accumulated assets — ASR models, LLM weights, narration/phrase-packs/sounds — with **refcount + dedup**, install/evict/locate, and a **live memory + storage Budget Arbiter** that knows what's resident (LLM/ASR/TTS) and answers *"what fits alongside the running 4B LLM right now?"*
5. **Two host selection APIs:** `host.asr.provider(id)` (explicit, for power packs that compute their own pick from memory+intent) and `host.asr.pick({lang, budgetMB, goal})` (smart router default for simple packs). `host.models` underneath; the reusable **`MicInput`** UI primitive on top (one line for any field).
6. **Native OS STT is still the default where it wins** (~0 model memory, no download, out-of-process). The *downloadable* tier is **NOT assumed to be Whisper** — it's chosen by a bake-off (§3).
7. **Qwen3-ASR is the standout efficiency bet:** its decoder *is* a Qwen3 LLM (0.6B/1.7B). It can **share the llama.cpp/GGUF runtime and Qwen tokenizer family** with corpan-llm's resident Qwen3-4B — co-resident, not model-juggled. It does NOT share *weights* (4B ≠ 0.6B/1.7B), so the win is runtime/operational, not zero-RAM (§3.3). Apache-2.0, 52 langs ≈ our 51.
8. **Keyboard is the universal, permanent floor.** The mic is additive; the field is never blocked.
9. **PHASE 0 is a mandatory on-device bake-off** (Qwen3-ASR-0.6B vs Whisper-large-v3-q5 vs Parakeet-v3 vs SenseVoice) on our real 51 langs on a **real Android device** (WER/CER + latency + RAM). **No plugin is stood up for a model that loses.** Non-autoregressive decoders (Parakeet/SenseVoice) are weighted up for Android CPU-only.
10. **Phase 1** = `tauri-plugin-asr-native` (iOS) + the `AsrProvider` contract + `host.asr` + `MicInput` + the registry's Budget-Arbiter seam, wired into Corpan City speak challenges.
11. **Honest cost:** 4 native runtimes is real maintenance (per-runtime process-global init locks, streaming downloads, interruption-safety, iOS/Android/desktop each). Justified ONLY if the contract stays tight and the registry is genuinely shared.
12. **Cloud is OFF by default** (no-login, on-device-analytics-only privacy posture). A gated, clearly-labeled opt-in is sketched (§10) for the genuine long tail — not Phase 1.

---

## 1. Existing repo stack — audited, verified against code

| Piece | Where | What it is |
|---|---|---|
| Whisper scorer plugin | `plugins/tauri-plugin-stt/` | whisper.cpp via iOS XCFramework + Android JNI; loads `ggml-*.bin`. Commands `prepare`/`start_session`/`stop_session`/`cancel_session`/`get_status`/`install_model`/`validate_model`/`wipe_model`. **Built for scoring:** `start_session` takes `expectedText`+`WhisperParams`+`ScoringParams`; `stop_session` returns 18 scoring fields (`overallScore`, `acousticScore`, per-word `WordTiming.probability`, `noSpeechProb`, `compressionRatio`, `freeVsConstrainedSimilarity`…). |
| Model registry (pack-local) | `packs/pronunciation-coach/src/modelRegistry.ts` | 7 ggml tiers: `tiny`(75) `small`(465) `large_turbo_q5`(547) `large_turbo_q8`(834) `large_q5`(1031) `medium`(1463) `large_turbo_fp16`(1549) + self-quantized `large_q8`★(1580, our CDN). Memory gating via `hasLargeMemoryBudget()` (iOS ≥6500MB avail OR Android ≥8000MB physical). **This is the seed for the global registry (§4).** |
| Wire contract | `plugins/tauri-plugin-stt/src/models.rs` | **The gatekeeper.** serde silently drops any field not declared, BOTH directions. Camel-case rename traps (`availableMemoryMB`). The `AsrProvider` Rust types must obey this. |
| Host adapter | `corpan-app/src/contentPacks/hostApi.ts` | `const stt: SttApi` → `invoke("plugin:stt|…")`; maps structured error codes; records `stt_init_crash` analytics from `getStatus().priorInitCrash`. |
| Pack consumers | `packs/corpan-city/src/challenges/host.ts` + `…/tools/sttTools.ts`; `packs/pronunciation-coach/src/game.ts`; `packs/tutomaton/src/languageManager.ts` (`stt?` slice) | Corpan City challenge gates on `host.sttAvailable()` → false unless a Whisper model is installed → self-rate. |
| Resident LLM | corpan-llm plugin, Qwen3-4B GGUF (~2.5 GB), installed via `content_packs.rs` (streams to disk, 8 GiB cap) | Tutomaton/Corpan City NPC loop keep it **resident** for a session. The Budget Arbiter (§4) must account for it. |
| Two download paths | iOS `URLSession.downloadTask` (STT, streams to disk, truncation-guarded) **vs** `content_packs.rs` (packs/LLM, streams to disk). | `memory/content-pack-download-streaming.md` |

**Constraints baked into this plan (verified in memory + code):**
- **iOS+Android both run whisper.cpp.** WhisperKit/argmax CoreML is closed. (`feedback_whisper_ipados26_mps_crash.md`)
- **Android Whisper is CPU-only.** Every GPU/NPU path dead-ended; large-v3 ≈ 15–25 s for a short clip. This is **the** reason non-autoregressive models matter on Android. (`feedback_android_whisper_gpu.md`)
- **Concurrent native init corrupts ggml process globals → SIGSEGV.** The lock guarding process-global state must itself be **process-global**. Each in-process runtime plugin needs its own. (`android-stt-init-crash-process-global-lock.md`)
- **Downloads MUST stream to disk.** (`content-pack-download-streaming.md`)
- **iOS Settings deep-links are impossible** — only `openSettingsURLString`. (`feedback_ios_settings_deeplink_impossible.md`)
- **Don't strip `tauri-plugin-radio-stream`'s `.longForm` AVAudioSession.** New mic capture must coexist. (`feedback_reader_audio_interruption_longform.md`)
- **Tablet + desktop are first-class.** (`feedback_tablet_desktop_first_class.md`)
- **Every pack must work single-language.** Dictation target = the one language. (`single-language-stacks.md`)

---

## 2. The shared `AsrProvider` contract (non-negotiable spine)

Every engine — OS-native, whisper.cpp, Qwen3-ASR, sherpa/onnx — implements the **same** contract. This is what makes providers interchangeable and what keeps 4 runtimes affordable. Defined in **both** TS (host/pack-facing) and Rust (plugin boundary; obey the `models.rs` serde discipline).

### 2.1 TypeScript (host + pack facing)

```ts
type LatencyClass = "instant" | "fast" | "batch"   // <300ms partial | <1.5s | multi-s
type ScriptHandling = "spaced" | "cjk" | "rtl"

interface AsrCapability {
  providerId: "native" | "whisper" | "qwen3" | "sherpa"
  languages: string[]          // our codes (en, zh-Hans, yue-Hant-HK, pa-Arab…)
  onDevice: boolean
  modelSizeMB: number          // 0 for native (OS-managed asset)
  residentMemoryMB: number     // peak added resident during a transcribe (0 native = out-of-process)
  streaming: boolean           // true partials, not just final
  latencyClass: LatencyClass
  needsDownload: boolean       // model/asset not yet on device
  autoregressive: boolean      // false = NAR (Parakeet/SenseVoice) → cheap on Android CPU
}

interface AsrSession {
  onPartial(cb: (text: string) => void): void
  onLevel(cb: (rms: number, t: number) => void): void   // VU meter
  stop(): Promise<{ text: string; confidence: number; language: string }>
  cancel(): void
}

interface AsrProvider {
  id: AsrCapability["providerId"]
  capabilities(): Promise<AsrCapability>          // for the router + registry
  isAvailable(lang: string): Promise<{ ok: boolean; needsDownload: boolean }>
  ensure(lang: string): Promise<{ ready: boolean; downloading: boolean }>  // OS asset or model download
  transcribe(opts: { lang: string; mode: "push_to_talk" | "auto_stop" }): Promise<AsrSession>
}
```

`transcribe(audio, lang) → { text, partials }` is the heart; the capability descriptor is what the **router** and **registry Budget Arbiter** read to choose and to reason about memory.

### 2.2 Rust (plugin boundary)

Each plugin exposes the same commands (`capabilities`, `is_available`, `ensure`, `start_session`, `stop_session`, `cancel_session`) returning a capability struct + a transcription struct. **Every field JS reads MUST be declared** in that plugin's `models.rs` (serde drops undeclared fields both ways; honor camelCase renames). A tiny shared crate `corpan-asr-contract` holds the structs so the four plugins can't drift.

---

## 3. 2026 model bake-off — Whisper is NOT the assumed default download tier

The landscape moved past "download Whisper." The downloadable tier is decided by **Phase 0 on real hardware** (§9), but here's the candidate field with verified specs (sources §11):

### 3.1 Candidates

| Model | Params / size | Langs (ours covered) | AR? | Mobile/CPU fit | Streaming | License | Notes |
|---|---|---|---|---|---|---|---|
| **Qwen3-ASR-0.6B** (Alibaba, 2026-01-29) | 0.6B (180M AuT enc + Qwen3-0.6B dec) | **52** ≈ our 51 (+22 zh dialects) | yes | RTF 0.064 at scale; phone-plausible | yes (dynamic 1–8s flash-attn window, one model does both) | **Apache-2.0** | Decoder *is* a Qwen3 LLM → shares the llama/GGUF runtime + Qwen tokenizer family with corpan-llm (§3.3). **The standout bet.** |
| **Qwen3-ASR-1.7B** | 1.7B (300M enc + Qwen3-1.7B dec) | 52 | yes | heavier; flagship/desktop | yes | Apache-2.0 | Accuracy flagship; SOTA on several benches. |
| **Whisper large-v3-q5_0** (ggml) | full 32-layer dec, 1031 MB | 99 | yes | **Android CPU 15–25 s** (slow) | no | MIT | Proven, integrated, all-langs; the **non-Latin/Indic star** today. The incumbent, not the assumed winner. |
| **Whisper small** (ggml) | 244M, 465 MB | 99 | yes | OK | no | MIT | Cheap Latin gap-filler. |
| **Parakeet-TDT-0.6b-v3** (NVIDIA, 2025-09) | 0.6B FastConformer/TDT | **25 EU** (bg cs da de el en es et fi fr hr hu it lt lv mt nl pl pt ro ru sk sl sv uk) | **NO (TDT, non-AR)** | **CPU-cheap, ~10× faster decode** | low-latency | **CC-BY-4.0** | Fills the **European gap Apple skips** (pl, cs, uk, el…). No Indic/CJK/ar. Word timestamps + auto-lang. |
| **SenseVoice-Small** (FunAudioLLM) | ~234M | zh, **yue (Cantonese)**, en, ja, ko (+50 detect) | **NO (non-AR)** | **70 ms / 10 s, ~15× faster than Whisper-Large** | no (batch/NAR) | **"other"/model-license — AMBIGUOUS** | **Beats Whisper on Cantonese/CJK.** License ambiguity is a **gating risk** — must clear legal before shipping. ONNX/libtorch export exists. |
| **Voxtral Transcribe 2 / Voxtral Realtime** (Mistral, 2026-02) | 4B | **13** (en zh hi es ar fr pt ru de ja ko it nl) | yes | **4B, ~16 GB VRAM claim → desktop/server, NOT phones** | realtime variant | **Apache-2.0** | FLEURS **5.9 vs Whisper 7.4**. Great accuracy but too heavy for the phone hot path; **desktop-class only**. |
| Native OS (Apple/Android) | n/a (OS daemon) | ~24 iOS / device-dep Android | n/a | **~0 app memory, out-of-process** | yes | OS | Always preferred where the probe says yes. |

### 3.2 Reading of the field (opinionated)

- **Whisper is no longer the default download.** For Android CPU-only, **non-autoregressive** decode (Parakeet/SenseVoice) is dramatically cheaper than Whisper's autoregressive loop — exactly where our pain is. Weight NAR up.
- **Qwen3-ASR** is the most strategically interesting because of the **runtime-sharing** story (§3.3) and Apache-2.0 + 52-lang breadth (closest single model to our full set). If it transcribes our hard langs acceptably at 0.6B, it could be the **one** downloadable runtime for *most* of the gap.
- **Parakeet-v3** is the clean **European-tail** answer (the pl/cs/uk/el/sk/sl/hr/bg/lt/hu/ro block Apple misses), CPU-cheap, CC-BY-4.0.
- **SenseVoice** is the **Cantonese/CJK** answer (beats Whisper there) **if** the license clears — treat as conditional.
- **Voxtral** is **desktop/server only** (4B/16GB) — keep it for the desktop Whisper-replacement slot, not phones.
- **Whisper stays** as the universal 99-lang safety net and the non-Latin/Indic star until/unless Qwen3-ASR proves it can replace it on those scripts.

### 3.3 The Qwen3-ASR ↔ corpan-llm sharing analysis (the standout question)

**Can `tauri-plugin-asr-qwen3` share runtime/memory with the resident corpan-llm Qwen3-4B?**

- **Architecture (verified):** Qwen3-ASR = AuT audio encoder → projector → **a Qwen3 LLM decoder** (0.6B or 1.7B). The decoder is a genuine Qwen3 text model with the Qwen3 tokenizer.
- **Weight sharing? NO.** corpan-llm is Qwen3-**4B**; the ASR decoders are **0.6B/1.7B** — different checkpoints, different layer counts. You cannot point the ASR decoder at the 4B weights. So this is **not** a zero-extra-RAM win.
- **Runtime sharing? YES, and that's the real prize.** Both are Qwen3-family GGUF-able models that run on the **same llama.cpp/GGML stack** corpan-llm already vendors, with the **same Qwen3 tokenizer family**. Concretely we can:
  1. Reuse the **same inference engine + build** (one GGML/llama.cpp, one set of native libs, one process-global init discipline) instead of a second runtime — big maintenance + APK/IPA-size win.
  2. Reuse the **GGUF loader, quantization tooling, and the registry's download/dedup** path — the ASR encoder is a separate GGUF, but the decoder is "just another Qwen3."
  3. Keep the audio encoder (180M @ 0.6B) **co-resident** with the 4B LLM cheaply: ~0.6B ASR total adds ~**0.4–0.7 GB** (q5–q8) on top of the ~2.5 GB LLM — the **Budget Arbiter (§4)** decides if that fits *right now*, per device. Plausible on flagships; mid-tier routes to native or a swap.
- **Net:** the win is **operational co-residency + one runtime**, NOT shared weights. Still the best efficiency story on the board, because it removes a *second* heavy runtime and lets the NPC voice loop run STT **without unloading the LLM** (unlike Whisper, which today forces the one-large-model-at-a-time broker). **Phase 0 must measure the actual co-resident RAM with the 4B loaded.**

---

## 4. The corpan-app Model & Asset Registry (`host.models`) — first-class, ASR-agnostic

A single on-device store the corpan app owns; every pack/experience reads it. This is what makes "do I have room for Qwen3-ASR next to my LLM" *real*.

### 4.1 What it tracks

- **All asset classes:** ASR models (ggml / qwen-gguf / onnx), **LLM weights**, narration/phrase-packs, sounds — one inventory, one location resolver.
- **Refcount + dedup:** two packs depending on the same `ggml-large-v3-q5_0.bin` (e.g. pronunciation-coach + the whisper ASR provider) share **one** download; evict only when refcount hits 0.
- **Install / evict / locate:** stream-to-disk install (reuse the proven path), `locate(assetId) → path`, `evict(assetId)`, `list()` with sizes.
- **Live Budget Arbiter:** tracks what's **resident now** (LLM/ASR/TTS) from each runtime + the device budget (iOS `os_proc_available_memory()`, Android physical/avail). Answers:
  - `fits({ assetId | residentMB }) → { fits: bool, mustEvict: AssetId[] }`
  - `whatFitsAlongside(residentSetIds) → AsrCapability[]` ("which ASR providers can run *right now* with the 4B LLM loaded?")
  - This is the single source of truth the router (§5) and Corpan City/Tutomaton consult.

### 4.2 TS surface

```ts
host.models.list(): AssetRecord[]
host.models.ensure(assetId, { source, sizeMB, kind }): Promise<{ ready, downloading }>
host.models.locate(assetId): string | null
host.models.evict(assetId): Promise<void>
host.models.budget(): { availableMB, physicalMB, resident: {id, mb, kind}[] }
host.models.fits(req): { fits: boolean, mustEvict: AssetId[] }
host.models.whatFitsAlongside(residentIds): AsrCapability[]
```

Backed by a small `tauri-plugin-model-registry` (or folded into corpan-app's Rust) that each runtime plugin **registers residency with** on load/unload (so the arbiter's "resident" set is accurate across the LLM, the ASR providers, and TTS). The pack-local `modelRegistry.ts` becomes a *view* over this; the global store is the truth.

---

## 5. Selection + the Parlometron refactor

### 5.1 Two host selection APIs

- **Explicit (power packs):** `host.asr.provider("qwen3" | "whisper" | "native" | "sherpa")` → an `AsrProvider`. Corpan City/Tutomaton compute their own pick from `host.models.budget()` + intent (e.g. "NPC loop with 4B resident → prefer native, else qwen3 co-resident if `whatFitsAlongside` says yes, else swap to whisper").
- **Smart router (simple packs / core app):** `host.asr.pick({ lang, budgetMB, goal })` → resolves:
  ```
  pick(lang, budgetMB, goal):
    if native.isAvailable(lang).ok                 → native       // ~0 mem, no download, best
    cands = providers.filter(p => p.languages∋lang && registry.fits(p.residentMemoryMB, budgetMB))
    rank by: onDevice, then latencyClass(goal), then !autoregressive (Android), then WER(lang)
    return top ?? whisper(if installed/opt-in) ?? KEYBOARD
  ```
- **`MicInput`** UI primitive on top (one line for any pack/field): partials, VU, RTL, generous hit-zone, permission launchpad (`openSettingsURLString` — Settings deep-links impossible), "Enable voice for {lang}" → `provider.ensure(lang)`, silent keyboard fallback when engine=none.

### 5.2 `tauri-plugin-stt` → Parlometron alignment layer (don't break shipping)

Today `tauri-plugin-stt` *is* the whisper runtime + the scorer fused. Refactor so the **scorer sits on top of a transcription provider**:

- **Keep the plugin and its wire shape** (`start_session` w/ expectedText + scoring fields out) so pronunciation-coach keeps working **unchanged** during migration.
- **Internally**, split: the whisper.cpp inference becomes (or delegates to) `tauri-plugin-asr-whisper`'s runtime in a *rich* mode that still surfaces per-token logprobs / no_speech / compression (the scoring inputs); the **scoring math** (acoustic ramps, free-vs-constrained, compression gate) stays in the stt layer.
- **Migration path:**
  1. Extract the whisper.cpp wrapper into the shared runtime used by `tauri-plugin-asr-whisper` (one C/Swift/Kotlin runtime, two callers: plain-transcribe and rich-scoring).
  2. `tauri-plugin-stt` calls that runtime in rich mode; its public commands/shape are unchanged → pronunciation-coach untouched.
  3. New dictation goes through `host.asr` (providers), never the scorer.
- **Why not collapse them:** scoring needs per-token logprobs that native/Parakeet/SenseVoice/Qwen3-ASR don't expose. Scoring therefore stays **whisper-backed**; transcription is **provider-agnostic**. Keeping the alignment layer thin and on-top is the clean seam.

### 5.3 Corpan City speak challenges (known-target) — the Phase-1 wiring

Known-target repetition: **provider transcription + a pure-JS known-target scorer** (normalize → token/char Levenshtein; char-n-grams for non-spaced `ja/zh/yue/th`; optional confidence blend; map to the existing 0.6 threshold). That scorer is the §2 design from `STT_RESEARCH.md`, unchanged. Native provider first; keyboard floor stays.

---

## 6. The 51-language / 52-script coverage matrix

Best **transcription** path per platform. `N`=native on-device, `W`=Whisper, `Q`=Qwen3-ASR(if Phase-0 passes), `P`=Parakeet-v3, `S`=SenseVoice(if license clears), `K`=keyboard floor. iOS=SpeechTranscriber 26 (probe SFSpeechRecognizer ≤25). Android `~N`="usually, probe it." Conf = expected quality of the recommended path.

| Code | Language | iOS | Android | Recommended chain | Conf | Notes |
|---|---|---|---|---|---|---|
| en | English | N | N | N → Q/W → K | H | |
| es | Spanish | N | N | N → Q/W → K | H | |
| fr | French | N | N | N → Q/W → K | H | |
| de | German | N | N | N → Q/W → K | H | |
| it | Italian | N | N | N → Q/W → K | H | |
| pt-BR | Portuguese (BR) | N | N | N → Q/W → K | H | |
| pt-PT | Portuguese (PT) | N(pt_BR) | ~N | N → Q/W → K | H | |
| nl | Dutch | N | N | N → Q/W → K | H | |
| ru | Russian | N | ~N | N → Q/W → K | H | |
| uk | Ukrainian | — | ~N | **P** → W → ~N → K | M | No Apple. Parakeet-v3 EU. |
| pl | Polish | — | ~N | **P** → W → ~N → K | M | No Apple. Parakeet-v3. |
| cs | Czech | — | ~N | **P** → W → ~N → K | M | Parakeet-v3. |
| sk | Slovak | — | ~N | **P** → W → ~N → K | M | Parakeet-v3. |
| sl | Slovenian | — | ~N | **P** → W → ~N → K | M | Parakeet-v3. |
| hr | Croatian | — | ~N | **P** → W → ~N → K | M | Parakeet-v3. |
| sr | Serbian | — | ~N | **W(Cyrl)/Q** → K | M | Cyrillic+Latin; Whisper/Qwen both scripts. |
| bg | Bulgarian | — | ~N | **P** → W → ~N → K | M | Parakeet-v3. |
| ro | Romanian | — | ~N | **P** → W → ~N → K | M | Parakeet-v3. |
| hu | Hungarian | — | ~N | **P** → W → ~N → K | M | Parakeet-v3. |
| el | Greek | — | ~N | **P** → W → ~N → K | M | Parakeet-v3. |
| ca | Catalan | — | ~N | **W/Q** → K | M | No Apple, not Parakeet. |
| lt | Lithuanian | — | ~N | **P** → W → ~N → K | M | Parakeet-v3. |
| sv | Swedish | N | N | N → Q/W → K | H | |
| da | Danish | N | N | N → Q/W → K | H | |
| no | Norwegian | N(nb_NO) | N | N → Q/W → K | H | |
| fi | Finnish | N | N | N → Q/W → K | H | |
| tr | Turkish | N | ~N | N → Q/W → K | H | |
| he | Hebrew | N(he_IL) | ~N | N → W/Q → K | M | RTL. |
| ar | Arabic | N(ar_SA) | ~N | N → Q/W → K | M | **Owner's case — native.** RTL. Voxtral(desktop) strong. |
| fa | Persian | — | ~N | **W/Q** → K | M | No Apple. RTL. |
| ur | Urdu | — | ~N | **W(large_q5)** → K | L | No Apple. RTL. WER ~21%. |
| hi | Hindi | — | ~N | **Q/W(large_q5)** → ~N → K | M | No Apple. WER ~16.5%. Qwen + Voxtral cover Hindi. |
| bn | Bengali | — | ~N | **W(large_q5)/sherpa-bn** → K | M | No Apple. sherpa has bn zipformer. |
| ta | Tamil | — | ~N | **W(large_q5)** → K | L | Hard (WER 15–30%). |
| te | Telugu | — | ~N | **W(large_q5/q8★)** → K | L | q8★ self-hosted best. |
| kn | Kannada | — | ~N | **W(large_q5)** → K | L | |
| mr | Marathi | — | ~N | **W(large_q5)** → K | L | |
| gu | Gujarati | — | ~N | **W(large_q5)** → K | L | |
| pa-Guru | Punjabi (Gurmukhi) | — | ~N | **W(large_q5)** → K | L | |
| pa-Arab | Punjabi (Shahmukhi) | — | — | **W(large_q5 + Shahmukhi prompt)** → K | L | **Worst case.** No model ships Shahmukhi Punjabi; keyboard floor. MMS escape hatch if relicensed. |
| ne | Nepali | — | ~N | **W(large_q5)** → K | L | Whisper weak. |
| ja | Japanese | N | N | N → **S**/Q/W → K | H | SenseVoice strong (CJK). Non-spaced. |
| ko-polite | Korean | N(ko_KR) | N | N → **S**/Q/W → K | H | SenseVoice strong. |
| zh-Hans | Chinese (Simp.) | N(zh_CN) | N | N → **S**/Q/W → K | H | SenseVoice CJK SOTA. |
| zh-Hant | Chinese (Trad.) | N(zh_TW/HK) | ~N | N → **S**/Q/W → K | H | |
| yue-Hant-HK | Cantonese | N(yue_CN) | ~N | N → **S** → W(large_q5) → K | M | **SenseVoice beats Whisper on yue** (if license clears). Apple has yue too. |
| vi | Vietnamese | N(vi_VN) | ~N | N → sherpa-vi/Q/W → K | H | sherpa vi zipformer strong. |
| th | Thai | N(th_TH) | ~N | N → W(large_q5)/Q → K | M | Non-spaced. WER ~19%. |
| id | Indonesian | — | ~N | **W/Q** → ~N → K | M | No Apple. |
| ms | Malay | N(ms_MY) | ~N | N → W/Q → K | H | |
| sw | Swahili | — | ~N | **W** → K | M | No Apple. |

**Counts (52 written variants):** Native-iOS ~24; European-tail best served by **Parakeet-v3** (~11: pl cs uk sk sl hr bg ro hu el lt); **CJK+yue** best by **SenseVoice** (if licensed); the **Indic block + ur/fa/ne** lean **Whisper-large_q5 / Qwen3-ASR**; **Qwen3-ASR** is the broad 52-lang generalist that could simplify the whole gap if Phase-0 says yes. **No language lacks at least Whisper-or-keyboard.**

---

## 7. Concurrency, audio, offline, crash-safety

- **Native is out-of-process** → runs concurrently with the resident 4B LLM, zero juggling (MODEL_STRATEGY §2). **Qwen3-ASR co-resident** is the in-process exception the Budget Arbiter must clear per device (§3.3). **Whisper in-process** still obeys the one-large-model-at-a-time broker when an LLM is resident.
- **Process-global init lock per in-process runtime** (whisper, qwen, onnx) — the `ggml_backend_sched_split_graph` lesson. Native engines don't need it.
- **Audio session:** new capture **coexists with `.longForm`** — do not reset/strip it; no shared-engine `onstatechange` resume churn. Verify a reader/radio stream survives a dictation session.
- **Interruptions:** call/Control-Center pull → clean cancel (`asr://error{code:"INTERRUPTED"}`), never crash.
- **Offline:** native after asset present; downloadable runtimes fully offline; keyboard always.
- **Permissions:** request mic + (iOS) speech-recognition at first voice use; denial → in-app launchpad (`openSettingsURLString`).

---

## 8. Honest cost of provider-per-runtime

Four native runtimes is **real** maintenance surface: each needs its own process-global init lock, streaming download, interruption handling, and iOS/Android/desktop builds; onnxruntime and a Qwen GGUF runtime each add native libs (APK/IPA size). **This is only justified if:**
1. The `AsrProvider` contract + shared `corpan-asr-contract` crate stay tight (no per-provider special-casing leaking into packs).
2. The **registry is genuinely shared** (dedup/refcount/arbiter real, not per-pack).
3. **Each runtime earns its slot in the Phase-0 bake-off.** Do not stand up `asr-qwen3` or `asr-sherpa` for a model that loses on our langs.

Mitigations: `asr-sherpa` hosts **both** Parakeet-v3 and SenseVoice in **one** onnxruntime (one native lib, two models). `asr-qwen3` **reuses corpan-llm's llama/GGML runtime** (no second LLM stack). So the *new* native surface is realistically **two** added runtimes (onnx + the qwen-ASR encoder atop the existing llama stack), not four from scratch.

---

## 9. Phased delivery + acceptance

**Phase 0 — On-device bake-off (GATE; 3–5 days).** On a **real Android device** (CPU-only) + an iPhone/iPad, benchmark **Qwen3-ASR-0.6B vs Whisper-large-v3-q5 vs Parakeet-v3 vs SenseVoice** across our 51 langs (subset corpus per lang): **WER/CER, first-partial latency, end-to-end latency, peak resident RAM, and co-resident RAM with the 4B LLM loaded.** Weight non-autoregressive decode for Android. *Accept:* a ranked, per-language **winner table** that decides which downloadable runtime(s) we build in Phase 2 — and a go/no-go on Qwen3-ASR co-residency (the §3.3 measurement). **No plugin is built for a loser.**

**Phase 1 — Contract + native + registry seam + MicInput (the MVP).**
- `corpan-asr-contract` (TS+Rust); `tauri-plugin-asr-native` (iOS SpeechAnalyzer/SFSpeechRecognizer; Android on-device SpeechRecognizer; desktop macOS-native or keyboard).
- `host.asr` (`provider()` + `pick()`), `host.models` with the **Budget-Arbiter seam** (residency registration + `fits`/`whatFitsAlongside`), `MicInput` UI primitive.
- Wire into **Corpan City speak challenges** (native provider + JS known-target scorer; self-rate floor).
- *Accept:* on iOS 26 the ~24 native locales (incl. **Arabic, Cantonese, Thai, Hebrew**) transcribe into a field on a default install with **no download, ~0 added app memory**; permission-denied shows the launchpad; uncovered lang → keyboard; reader/radio audio survives; `host.models.budget()` reports the resident 4B LLM correctly.

**Phase 2 — Add the bake-off winner(s) as conforming providers.**
- Likely **`tauri-plugin-asr-qwen3`** (reusing corpan-llm's runtime; co-resident per arbiter) and/or **`tauri-plugin-asr-sherpa`** (Parakeet-v3 for EU + SenseVoice for CJK/yue **if license clears**). Whisper provider (`tauri-plugin-asr-whisper`) generalized from today's `tauri-plugin-stt` runtime as the 99-lang safety net.
- Refactor `tauri-plugin-stt` to the Parlometron alignment-on-top-of-runtime shape (§5.2), pronunciation-coach unchanged.
- Roll `MicInput` into the core app + other packs.
- *Accept:* a gap language (e.g. Polish via Parakeet, Hindi via Qwen/Whisper) dictates after an explicit, streamed, refcount-deduped download; the arbiter blocks a download that won't fit and offers an evict; an already-installed pronunciation-coach ggml is reused (refcount, no re-download).

**Phase 3 — Streaming polish + desktop Voxtral + eviction UX.**
- Streaming partials for the live-typing feel (native + sherpa transducers); desktop **Voxtral Transcribe 2** as the desktop accuracy tier (RAM is ample there). "Manage voice models" eviction screen over `host.models`. Android native `triggerModelDownload` UX.
- *Accept:* sub-1.5 s streaming on ≥3 gap langs; desktop Voxtral path; no Tier-1/2 regression.

**Phase 4 (gated, may never ship) — long-tail.** Opt-in cloud (§10) for ta/te/ne/pa-Arab/ur only; or a permissively-relicensed MMS adapter. Owner approval required.

**Global targets:** ≥24 Tier-1 native iOS; 100% of 52 reach ≥ Whisper-or-keyboard; ≥40 native-or-downloadable. Native first partial <300 ms; downloadable batch <3 s (phrase) iOS; Android shows a "slow" affordance for AR-Whisper. Native adds <50 MB resident. Known-target acceptance ≥90% native, ≥75% non-Latin downloadable.

---

## 10. Honest "not reliably possible today"

- **pa-Arab (Shahmukhi):** no model ships it; keyboard floor; `initial_prompt` priming marginal. MMS/cloud only step-ups (both gated).
- **Hardest Indic (ta, te, ne) + ur:** Whisper WER 15–25%+. Fine for known-target challenges (fuzzy match forgives), rough for open dictation. Qwen3-ASR *may* help — Phase-0 measures.
- **SenseVoice license is ambiguous** ("other"/model-license) — its Cantonese/CJK win is **conditional on legal clearance**; do not ship it until cleared. Whisper-large_q5 is the licensed fallback for yue/CJK.
- **Voxtral is desktop-only** (4B/16GB) — not a phone option.
- **Android non-Google-services / thin-OEM devices:** native may be absent for any lang → downloadable or keyboard. Probe is truth.
- **Qwen3-ASR co-residency with 4B may not fit mid-tier phones** — the arbiter routes those to native or a swap. Phase-0 measures the real number.
- **MMS (CC-BY-NC)** reaches the absolute tail but **can't ship** (non-commercial). Escape-hatch design only.
- **Cloud off by default** — the genuinely-hardest langs can't reach SOTA on device; we accept a dignified keyboard floor over compromising no-cloud/no-login privacy.

---

## 11. Sources (accessed 2026-06-05/06)

- **Qwen3-ASR** (Apache-2.0, 0.6B/1.7B, 52 langs, AuT enc + Qwen3 LLM decoder, dynamic flash-attn, RTF 0.064): [HF Qwen3-ASR-1.7B card](https://huggingface.co/Qwen/Qwen3-ASR-1.7B/raw/main/README.md), [Pandaily release](https://pandaily.com/alibaba-qwen-open-sources-qwen3-asr-speech-recognition-models-supporting-52-languages-with-the-1-7-b-version-reaching-sota), [1.7B guide](https://qwen-image-2512.com/blog/qwen3-asr-1.7b-complete-guide-en), [emergentmind](https://www.emergentmind.com/topics/qwen3-asr-1-7b)
- **Voxtral Transcribe 2 / Realtime** (Mistral, Apache-2.0, 13 langs, FLEURS 5.9 vs 7.4, 4B/16GB): [Mistral news](https://mistral.ai/news/voxtral-transcribe-2/), [VentureBeat](https://venturebeat.com/technology/mistral-drops-voxtral-transcribe-2-an-open-source-speech-model-that-runs-on), [Voxtral Realtime arXiv 2602.11298](https://arxiv.org/html/2602.11298v1), [Voxtral-vs-Whisper benchmarks](https://weesperneonflow.ai/en/blog/2026-03-31-voxtral-whisper-open-source-speech-models-comparison-2026/)
- **SenseVoice-Small** (FunAudioLLM, non-AR, 70ms/10s ~15× Whisper-Large, Cantonese, license "other"): [GitHub](https://github.com/FunAudioLLM/SenseVoice), [HF model-license](https://huggingface.co/FunAudioLLM/SenseVoiceSmall/raw/main/README.md), [FunAudioLLM paper arXiv 2407.04051](https://arxiv.org/html/2407.04051v1), [Cantonese ASR eval](https://github.com/AlienKevin/cantonese_asr_eval)
- **NVIDIA Parakeet-TDT-0.6b-v3 / Canary-v2 / Granary** (CC-BY-4.0, 25 EU langs, NAR, word timestamps): [parakeet-tdt-0.6b-v3 card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3), [Granary release](https://blogs.nvidia.com/blog/speech-ai-dataset-models/), [paper arXiv 2509.14128](https://arxiv.org/html/2509.14128v1)
- **Apple SpeechAnalyzer/SpeechTranscriber** (iOS 26, 42-locale list incl. ar_SA/yue_CN/th_TH): [iOS 26 SpeechAnalyzer guide (full locale list)](https://antongubarenko.substack.com/p/ios-26-speechanalyzer-guide), [SpeechTranscriber docs](https://developer.apple.com/documentation/speech/speechtranscriber), [WWDC25 #277](https://developer.apple.com/videos/play/wwdc2025/277/), [swift-scribe ref](https://github.com/FluidInference/swift-scribe); legacy [supportsOnDeviceRecognition](https://developer.apple.com/documentation/Speech/SFSpeechRecognizer/supportsOnDeviceRecognition)
- **Android**: [SpeechRecognizer](https://developer.android.com/reference/android/speech/SpeechRecognizer), [ML Kit GenAI / Gemini Nano (alpha, Pixel-only)](https://developers.google.com/ml-kit/genai/speech-recognition/android), [Gemma 4 in AICore (Apr 2026)](https://android-developers.googleblog.com/2026/04/AI-Core-Developer-Preview.html)
- **Whisper**: [large-v3-turbo (6× faster ≈ v2)](https://medium.com/@bnjmn_marie/whisper-large-v3-turbo-as-good-as-large-v2-but-6x-faster-97f0803fa933), [low-resource WER tables (arXiv 2503.23542)](https://arxiv.org/pdf/2503.23542), [openai/whisper](https://github.com/openai/whisper)
- **Meta MMS** (1107 langs, CC-BY-NC): [arXiv 2305.13516](https://arxiv.org/abs/2305.13516)
- **In-repo:** `packs/corpan-city/docs/{MODEL_STRATEGY,STT_RESEARCH}.md`, `plugins/tauri-plugin-stt/src/models.rs` + `ios/Sources/STTPlugin.swift`, `packs/pronunciation-coach/src/modelRegistry.ts`, `corpan-app/src/contentPacks/hostApi.ts`, `corpan-app/src/store/constants.ts`, corpan-llm Qwen3-4B; memory: `feedback_whisper_ipados26_mps_crash`, `feedback_android_whisper_gpu`, `android-stt-init-crash-process-global-lock`, `content-pack-download-streaming`, `feedback_ios_settings_deeplink_impossible`, `feedback_reader_audio_interruption_longform`, `single-language-stacks`.
