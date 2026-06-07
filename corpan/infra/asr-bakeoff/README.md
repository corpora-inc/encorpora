# Phase-0 ASR Bake-off Harness

The decision gate from `corpan/docs/STT_MASTERPLAN.md` §9. Benchmarks the
four candidate transcription engines across our ~50 languages and produces a
ranked table + a go/no-go on the **north-star question**:

> Does **Qwen3-ASR-0.6B** transcribe enough of our languages well enough,
> **on our real input**, to be Corpán's **default download tier**?

No plugin is built for an engine that loses here.

## Two eval tiers (the methodology — read this)

FLEURS is native, clean, professional read-speech. Corpán's REAL input is a
**non-native learner saying a SHORT target phrase on a phone mic**. So a model
that tops FLEURS hasn't yet earned the default tier — it must ALSO survive our
shape. We evaluate in two tiers and the winner must clear **both**:

- **Tier 1 — `fleurs`** — cross-language RANKING (the decision gate).
- **Tier 2 — domain-matched** — validates the FLEURS winner on our shape:
  - `corpan_tts` — our own ~10k/lang phrases (`dja/release.sqlite3`), TTS'd
    (MMS-TTS). Domain-TEXT fit (clean audio, not accent).
  - `common_voice` — accent/L2-leaning natural speech (gated; HF login).
  - `gold` — the owner's real learner recordings, dropped in as a manifest
    (the truest signal; see DGX_RUNBOOK.md).

**The DGX Spark (GPU) is the run box** — see **`DGX_RUNBOOK.md`** + the
**`Makefile`** (`make north-star` → `make full`). Desktop = QUALITY only;
device latency/RAM + co-resident-with-4B = `device/RUNBOOK.md` (mobile).

## Candidates

| Engine | Desktop runtime (this harness) | Ships as | License |
|---|---|---|---|
| **Qwen3-ASR-0.6B** | `qwen-asr` (transformers) | GGUF on llama.cpp (`ggml-org/Qwen3-ASR-0.6B-GGUF`, runtime-shared with corpan-llm) | Apache-2.0 |
| **Whisper large-v3** | `faster-whisper` int8 (proxy) | `ggml-large-v3-q5_0.bin` whisper.cpp | MIT |
| **Parakeet-TDT-0.6b-v3** | `sherpa-onnx` int8 | onnxruntime (asr-sherpa) | CC-BY-4.0 |
| **SenseVoice-Small** | `sherpa-onnx` int8 | onnxruntime (asr-sherpa) | "other" — **license-gated, do not ship until cleared** |

Desktop measures **accuracy** (WER/CER), which is weight-bound and transfers.
Desktop latency/RAM is only a RELATIVE signal — the real device numbers come
from `device/RUNBOOK.md` (Android CPU-only + iOS Metal), which the owner runs.

## Setup — project-local venv ONLY

NEVER use system/Homebrew python (`memory/feedback_never_break_system_python`).

```bash
cd corpan/infra/asr-bakeoff
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt          # or install engine groups piecemeal
```

If a build picks up the wrong compiler (NDK clang missing macOS SDK headers),
prefix: `CC=/usr/bin/clang CXX=/usr/bin/clang++ pip install ...`.

Sherpa models (Parakeet + SenseVoice) are downloaded into `models/` by
`fetch_models.sh`. Qwen3/Whisper pull from HF on first run (cached).

## Run

```bash
python run_bakeoff.py --list                       # show the language plan

# NORTH-STAR FIRST: Qwen3 across ALL 50 langs before any other model, so the
# "can Qwen3-ASR-0.6B be the default tier?" answer lands without waiting for
# the full matrix. (engine-major order is the default.)
python run_bakeoff.py --engines qwen3 --samples 20
python build_report.py            # → DECISION.md with the Qwen3 column filled

# THEN the rest (resumable — skips Qwen3's done rows, fills Whisper/Parakeet/
# SenseVoice). build_report.py re-renders the full table.
python run_bakeoff.py --engines qwen3,whisper,parakeet,sensevoice --samples 20
python build_report.py

# spot-check a few hard langs across all engines:
python run_bakeoff.py --langs hi,ja,yue-Hant-HK,pl,te --engines all
```

The runner is **resumable** (skips done pairs), **partial** (a missing engine
dep is an error row, not a crash), **engine-major by default** (`--order engine`
finishes one engine across all langs before the next; `--order lang` for the
other grouping), and only touches FLEURS-backed langs. `build_report.py` reads
only `results/rows.jsonl` — safe to re-run anytime, even mid-run.

## How the verdict is decided (auditable)

A language *passes* for an engine when its error rate is ≤ `PASS_ABS` (25%,
independently usable) OR within `PASS_MARGIN` (5 points) of the best engine
for that language. Qwen3 earns the **default-tier** title only if it passes
≥ `PASS_RATIO` (90%) of tested langs AND ≥ `PASS_FLOOR` (45) absolute. These
constants live at the top of `build_report.py` — change them in one place.

WER for spaced + RTL scripts; **CER** for CJK/Thai (no word boundaries →
WER is meaningless there). The script class is set once per language in
`langs.py`, never inside an engine adapter.

## Tests

```bash
python test_harness.py     # 12 tests: lang plan, WER/CER, tiers, corpus, report, verdict
```

These prove the decision logic without touching a model (the metric tests
self-skip if `jiwer` isn't installed; the corpan-phrases test self-skips if
`release.sqlite3` is absent).

## Files

| File | Role |
|---|---|
| `Makefile` | one-command, resumable GPU run (`make north-star` / `full` / `report`) |
| `DGX_RUNBOOK.md` | the GPU desktop leg (DGX Spark), local + SSH |
| `requirements-cuda.txt` | pinned CUDA deps (torch cu124 + engines + MMS-TTS) |
| `langs.py` | our codes ⇄ FLEURS configs + script class + which engines compete |
| `corpora/` | multi-tier corpus loaders behind one `Sample`: `fleurs.py` (T1), `corpan_phrases.py` (our phrases→TTS), `common_voice.py` (accent/L2), `gold_recordings.py` (owner manifest), `wavio.py` (16k mono helper) |
| `metrics.py` | WER (jiwer) / CER, light script-aware normalization |
| `adapters/` | one lazy-import adapter per engine, uniform `transcribe()` |
| `run_bakeoff.py` | the runner — source×engine×lang, writes `results/rows.jsonl` |
| `build_report.py` | `rows.jsonl` → `results/DECISION.md` (per-tier, BOTH-tiers verdict) |
| `device/RUNBOOK.md` | exact Android + iOS on-device legs (owner-run) |
| `fetch_models.sh` | download the sherpa onnx models into `models/` |
