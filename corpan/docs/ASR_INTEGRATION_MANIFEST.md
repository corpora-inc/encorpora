# ASR domain — 0.17.0 Integration Manifest

**Branch:** `worktree-phone-os-shell` (ASR slice; the orchestrator integrates
into the 0.17.0 trunk). **Owner:** asr-lead. **Plan:** `STT_MASTERPLAN.md`.

This is the precise "what lands where / what's in vs out / what device
validation remains" for the ASR overhaul. Everything below is **additive**
(no shipping behavior changed) unless flagged.

---

## What landed in this branch (built + tested)

### 1. Frozen `AsrProvider` contract — the spine
| Path | What | Tests |
|---|---|---|
| `plugins/corpan-asr-contract/` | Rust crate: wire structs (`AsrCapability`, `TranscribeArgs`, `TranscriptOut`, `PartialEvent`/`LevelEvent`/`SessionErrorEvent`, `commands` names). The serde gatekeeper — incl. the uppercase-`MB` rename trap. | `cargo test -p corpan-asr-contract` → **4/4** |
| `packs/shared/asr/contract.ts` | TS twin: `AsrProvider`/`AsrSession`/`AsrCapability` + `ASR_COMMANDS`. | strict tsc clean |
| `packs/shared/asr/host.ts` | `AsrApi` (`provider`/`pick`) + `ModelsApi` (registry + Budget Arbiter `fits`/`whatFitsAlongside`) surfaces. | strict tsc clean |
| `packs/shared/asr/README.md` | What a provider plugin must expose + the inherited non-negotiables. | — |

### 2. Host plumbing (Phase-1 reusable pieces)
| Path | What | Tests |
|---|---|---|
| `packs/shared/asr/router.ts` | `rankProviders` — the `host.asr.pick` algorithm (native-first → fits-budget → latency(goal) → Android-NAR → WER). Pure, no bridge. | `router.test.ts` → **6/6** |
| `packs/shared/asr/micInput.ts` | `attachMicInput` — the vanilla-DOM "speak into any field" primitive. 44px hit zone, partials→field, VU, RTL, INTERRUPTED=clean-stop, MIC_DENIED launchpad (`openAppSettings`/openSettingsURLString), keyboard floor. | `micInput.test.ts` → **7/7** (happy-dom) |
| `packs/shared/asr/index.ts` | barrel re-export. | — |

### 3. SDK type seam (additive, optional)
| Path | What |
|---|---|
| `packs/sdk/index.d.ts` | `AsrApi`/`ModelsApi`/`AsrProvider`/… types + `HostApi.asr?`/`HostApi.models?` optional slots. Packs can program against them; absent host → keyboard/`stt` fallback. |

### 4. Phase-0 bake-off harness — the DECISION GATE
| Path | What | Tests |
|---|---|---|
| `infra/asr-bakeoff/` | FLEURS corpus loader, WER+CER metrics, 4 lazy engine adapters (Qwen3/Whisper/Parakeet/SenseVoice), resumable runner, `build_report.py`→`DECISION.md` with auditable north-star verdict. Project-local venv. | `test_harness.py` → **7/7** |
| `infra/asr-bakeoff/device/RUNBOOK.md` | the owner-run Android + iOS legs (real CPU latency + co-resident-with-4B RAM). | — |

---

## What's IN vs OUT for 0.17.0 (honest scope)

**IN (this branch, reviewable now):**
- The frozen contract (Rust crate + TS).
- The bake-off harness + device runbook (the decision; desktop run pending models).
- `host.asr` router + `MicInput` + `host.models` TYPE seam (SDK + shared).

**OUT (exceeds 0.17.0 — Phase-2+):**
- The 4 provider plugins themselves (`tauri-plugin-asr-{native,whisper,qwen3,sherpa}`). Only **#96 asr-native** is the realistic Phase-1 plugin if the iOS device leg lands in time; the rest are Phase-2 and gated on the bake-off (build NOTHING for a loser).
- The Rust **model-registry plugin** backing `host.models` (refcount/dedup/arbiter). The TS surface is defined; the native store is Phase-2.
- The `tauri-plugin-stt` → "scoring on top of a transcription runtime" refactor (§5.2). **Not started; pronunciation-coach is UNTOUCHED and keeps working.**

---

## corpan-app runtime wiring — DONE (type-checked against the real app)

The corpan-app now *provides* `asr`/`models` on its concrete `hostApi`
(additive, optional, `tsc --noEmit` clean against the full app):

1. **`corpan-app/src/contentPacks/types.ts`** — mirrors the SDK's `AsrApi`/
   `ModelsApi`/`AsrProvider`/… + `HostApi.asr?`/`models?`. ✓
2. **`corpan-app/src/contentPacks/hostApi.ts`** — `models.budget()` reports
   REAL signals: device memory via `stt.get_status`
   (`availableMemoryMB`/`physicalMemoryMB`) + the resident LLM via
   `llm.status().loaded` (a `resident` entry ≈ 2500 MB). `models.fits` computes
   against live headroom. Store ops (`list`/`ensure`/`locate`/`evict`) are
   honest "not yet" stubs until the registry plugin (#98). ✓
3. **`asr.pick`/`asr.provider`** — return `null` (keyboard floor) until a
   provider plugin registers; the seam is present so packs program against it
   today. When #96 asr-native lands: `provider("native")` returns it and `pick`
   routes through `rankProviders` over the registered providers' capabilities +
   the live budget. ← the only asr-side follow-on.

### Still remaining (small, post-provider)

- **World Plaza speak challenge** — swap the `host.sttAvailable()` gate to
  `host.asr.pick({lang, goal:"challenge"})` + the pure-JS known-target scorer
  (the `STT_RESEARCH.md` scorer, unchanged); keep the self-rate floor. Do this
  once #96 gives `pick` something to return; until then the whisper-gated path
  stays.
- **Plugin registration** — add the `asr-native` / `model-registry` path deps
  to `corpan-app/src-tauri/Cargo.toml` + register in `lib.rs` (lead-applied
  shared-file patch) when those plugins land.

---

## Migration safety (tauri-plugin-stt → scoring-on-top)

Not done in this branch by design. The seam (§5.2): keep `tauri-plugin-stt`'s
public command shape EXACTLY (start_session w/ expectedText + the 18 scoring
fields out) so **pronunciation-coach is untouched**. Internally, later, the
whisper.cpp wrapper becomes the shared runtime that `tauri-plugin-asr-whisper`
also calls in a "rich" (logprob-exposing) mode. Until that refactor, `stt`
(scoring) and `asr` (dictation) coexist as separate slices — which is exactly
how the SDK seam is shaped.

---

## Device validation that remains (owner-run)

Per `infra/asr-bakeoff/device/RUNBOOK.md`:
- **Android (CPU-only):** Whisper-q5 vs NAR (Parakeet/SenseVoice) vs Qwen3
  real latency + RSS — the headline gap that justifies NAR.
- **iOS:** the Qwen3-ASR co-resident-with-4B RAM delta (§3.3 number; expect
  +0.4–0.7 GB, evidenced by qwen3-asr.cpp's ~0.5 GB bench) + which of the ~24
  native locales actually transcribe on-device.
These two numbers (real CPU latency, co-resident RAM) are the only ones the
desktop bake-off can't honestly produce; they close the Phase-0 gate.
