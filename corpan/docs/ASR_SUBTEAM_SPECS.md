# ASR subteam — worker specs (disjoint-by-dir, frozen-contract parallel)

The Corpan City rule: **frozen contract + disjoint file/dir ownership +
orthogonal axes = clean parallel.** The contract is FROZEN (below). Each
worker owns a disjoint dir tree; none edits another's; all conform to the
contract. The lead (asr-lead) integrates their branches into the ASR branch.

## The frozen contract (DO NOT EDIT — depend on it)

- **Rust:** `corpan/plugins/corpan-asr-contract/` — `AsrCapability`,
  `TranscribeArgs`, `TranscriptOut`, `PartialEvent`/`LevelEvent`/
  `SessionErrorEvent`, `IsAvailable*`/`Ensure*`, `commands::*` names.
  `cargo test -p corpan-asr-contract` is green (4 tests). It is the serde
  wire gatekeeper — every field a layer reads MUST be declared here.
- **TS:** `corpan/packs/shared/asr/{contract,host,index}.ts` — `AsrProvider`,
  `AsrSession`, `AsrApi`, `ModelsApi`, `rankProviders`, `attachMicInput`.
- **SDK:** `corpan/packs/sdk/index.d.ts` — `HostApi.asr?`/`models?` slots.
- **Design:** `corpan/docs/STT_MASTERPLAN.md`; **integration map:**
  `corpan/docs/ASR_INTEGRATION_MANIFEST.md`.

If a worker needs a contract change, they request it from the lead — they do
NOT edit the contract crate/TS themselves. That's how it stays frozen.

---

## Worker A — `asr-bakeoff-exec` (the decision; highest priority)

**Owns (exclusive):** `corpan/infra/asr-bakeoff/corpus/`,
`corpan/infra/asr-bakeoff/models/`, `corpan/infra/asr-bakeoff/results/`, and
may EXTEND (not rewrite) `langs.py`, the per-source lang maps (`MMS_VOICE` in
`corpora/corpan_phrases.py`, `CV_LANG` in `corpora/common_voice.py`), +
`fetch_models.sh`. Does NOT touch the harness logic (`run_bakeoff.py`,
`metrics.py`, `build_report.py`, `corpora/*`, `adapters/*`) except a bug fix
coordinated with lead — those are TESTED (12 tests).

**Run box: the owner's DGX Spark (CUDA).** One-command + resumable via the
`Makefile`. `make setup` (project-local venv from `requirements-cuda.txt` —
NEVER system python) → `make north-star` (Qwen3-ASR-0.6B FIRST, both tiers) →
`make full`. Full instructions (local + SSH): `DGX_RUNBOOK.md`.

**TWO EVAL TIERS — the winner must clear BOTH** (owner's methodology: FLEURS is
native clean read-speech; our REAL input is a non-native learner saying a SHORT
phrase on a phone mic):
- **T1 `fleurs`** — cross-language ranking (the gate). Loader exists.
- **T2 domain** — `corpan_tts` (our ~10k/lang phrases from
  `dja/release.sqlite3`, MMS-TTS'd — domain-text shape), `common_voice`
  (accent/L2, HF login), `gold` (owner's real learner recordings via a
  per-lang `corpus/gold/<code>/refs.jsonl` manifest — the truest signal).

**Job:** run `qwen3` (+1.7B if it fits) vs `whisper-large-v3` vs `parakeet-v3`
vs `sensevoice` across both tiers → `results/rows.jsonl` → `DECISION.md`.

**Acceptance:** a populated `DECISION.md` with per-tier → per-source winner
tables + per-engine summaries + the BOTH-TIERS verdict (Qwen3 ≥90% AND ≥45
langs in EVERY tier evaluated). Every model claim cited. Flag the coverage gaps
the loaders print (no MMS voice / no CV lang). Device legs (latency/RAM +
co-resident) handed to the OWNER per `device/RUNBOOK.md` — worker does NOT run
device builds.

---

## Worker B — `asr-native` (the zero-download Phase-1 win)

**Owns (exclusive):** `corpan/plugins/tauri-plugin-asr-native/` (entire new
plugin dir: Cargo.toml, src/, ios/Sources/, android/src/, permissions/,
build.rs, CHANGELOG.md).

**Job:** Implement the contract over OS-native STT. iOS:
SpeechAnalyzer/`SpeechTranscriber` (26) with SFSpeechRecognizer fallback
(probe `supportsOnDeviceRecognition`) — Swift. Android: on-device
`SpeechRecognizer` — Kotlin. Desktop: macOS-native or report unavailable.
Commands per `commands::*`; emit `PartialEvent`/`LevelEvent`/
`SessionErrorEvent` keyed by sessionId. `capabilities()` returns
`residentMemoryMB:0, onDevice:true, needsDownload:false` for the OS's locale
set; `is_available(lang)` probes the OS. Model the wire structs in this
plugin's OWN `models.rs` by RE-USING `corpan-asr-contract` (path dep) — do not
redeclare.

**Hard constraints (from memory):** out-of-process so NO process-global init
lock needed; coexist with `tauri-plugin-radio-stream`'s `.longForm`
AVAudioSession (do NOT reset/strip it — verify a radio stream survives a
session); `INTERRUPTED` clean-cancel on call/Control-Center; permission denial
→ structured `MIC_DENIED` (the JS launchpad handles openSettingsURLString).
No WhisperKit/CoreML.

**Acceptance:** `cargo check` clean from corpan-app/src-tauri (wire the path
dep); contract-conformant command surface; a desktop/sim smoke that
`capabilities()` + `is_available("en")` round-trip. **iOS DEVICE build is
OWNER-OWNED** — ship the code + a redeploy runbook; do not run the device
build. Add the path dep line to `corpan-app/src-tauri/Cargo.toml` ONLY via a
patch the lead applies (shared file — see "shared-file edits" below).

---

## Worker C — `asr-registry` (host.models backing + memory arbiter)

**Owns (exclusive):** `corpan/plugins/tauri-plugin-model-registry/` (entire
new plugin dir) OR a `model_registry` module under corpan-app/src-tauri (lead
decides; default = new plugin for symmetry).

**Job:** The Rust store behind `host.models` (TS surface already frozen in
`packs/shared/asr/host.ts` + SDK). Refcount + dedup over ALL asset classes
(asr-model/llm/narration/phrase-pack/sound), `install`(stream-to-disk, reuse
the proven path)/`evict`/`locate`/`list`. The **Budget Arbiter**: read live
device memory (iOS `os_proc_available_memory`, Android availMem/physical) +
the resident set (each runtime registers residency on load/unload), answer
`fits`/`whatFitsAlongside`. Conform to the `ModelsApi` TS shape exactly.

**Acceptance:** `cargo check` clean; unit tests for refcount (2 consumers → 1
download, evict at 0) + `fits` against a synthetic resident set + a
`whatFitsAlongside` that excludes an engine too big for current headroom.
Wire into hostApi is the lead's integration step.

---

## Worker D — `asr-qwen-spike` (KEPT BY LEAD)

The Qwen3-ASR ↔ corpan-llm runtime-sharing validation (#97). Tightly coupled
to the contract + corpan-llm's llama.cpp; research largely done
(`qwen3-asr.cpp` GGML+Metal benched ~0.5 GB co-resident; official
`ggml-org/Qwen3-ASR-0.6B-GGUF`). Lead owns it. **Owns:**
`corpan/infra/asr-bakeoff/device/qwen-coresidency/` + a findings doc; does NOT
create a plugin yet (gated on the bake-off result).

---

## Shared-file edits (the ONE coordination point)

Only the lead edits these (workers send a patch/request):
- `corpan-app/src-tauri/Cargo.toml` (path deps for new plugins)
- `corpan-app/src-tauri/src/lib.rs` (plugin registration)
- `corpan-app/src/contentPacks/{types.ts,hostApi.ts}` (the `asr`/`models`
  runtime wiring)
- `corpan-asr-contract` (the frozen contract — change only on lead approval)

Everything else is disjoint by dir. Workers branch from the ASR branch in
their own worktree, report to the board + lead, lead integrates.
