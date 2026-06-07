# SPARK_RUNBOOK — run the Corpán ASR bake-off on a DGX Spark (zero prior context)

You are a fresh agent on an **NVIDIA DGX Spark** (GB10 Grace-Blackwell, GPU
`sm_121`, **aarch64/ARM64**, **CUDA 13.0**, ~128 GB unified memory, Ubuntu
24.04). Your job: run Corpán's Phase-0 ASR bake-off and produce a ranked
`DECISION.md` that answers ONE question:

> **Does Qwen3-ASR-0.6B transcribe >50 of our languages well enough to be
> Corpán's default download tier?**

You don't need any other context. Follow this top to bottom. Everything is
**resumable** (a crash/disconnect → re-run the same command; done work is
skipped). The Spark gives **QUALITY (WER/CER) only** — on-device latency/RAM
and co-resident-with-the-4B-LLM come from a separate mobile leg
(`device/RUNBOOK.md`), NOT here.

---

## 0. The candidates (what you're comparing)

| Engine | How it runs here | HF repo / model id | Size | License |
|---|---|---|---|---|
| **Qwen3-ASR-0.6B** ← the question | `qwen-asr` (transformers, GPU) | `Qwen/Qwen3-ASR-0.6B` | ~1.2 GB | Apache-2.0 |
| **Whisper large-v3** | `faster-whisper` (CTranslate2, float16 GPU) | `large-v3` (auto-pulls `Systran/faster-whisper-large-v3`) | ~3 GB | MIT |
| **Parakeet-TDT-0.6b-v3** | `sherpa-onnx` int8 | release asset `sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8` | ~0.6 GB | CC-BY-4.0 |
| **SenseVoice-Small** | `sherpa-onnx` int8 | release asset `sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17` | ~0.9 GB | "other" (license-gated — benchmark only, do NOT ship) |

Eval corpus: **FLEURS** (`google/fleurs`, CC-BY), the `test` split, 50 of our
languages, streamed on demand (no full-dataset download). WER for spaced/RTL
scripts, **CER** for CJK/Thai.

---

## 1. Get the code

The harness lives in the Corpán monorepo on branch **`worktree-phone-os-shell`**
(the integrator may have merged it into `corpan-city` by the time you read this
— if `worktree-phone-os-shell` is gone, use `corpan-city`). Commit that
introduced it: **see the "HARNESS COMMIT" line the orchestrator gives you**;
if unsure, the latest commit touching `infra/asr-bakeoff/` is correct.

```bash
# If the repo isn't already on the Spark:
git clone <corpan-repo-url> corpan-mono
cd corpan-mono
git fetch origin
git checkout worktree-phone-os-shell    # or corpan-city if merged
git pull

cd corpan/infra/asr-bakeoff             # ← everything below runs from HERE
```

Sanity check you're in the right place:
```bash
ls Makefile run_bakeoff.py build_report.py langs.py requirements-cuda.txt
```

---

## 2. Environment (project-local venv — NEVER system python)

```bash
python3 -m venv .venv
. .venv/bin/activate
python -V                                # expect 3.10–3.12

pip install -U pip

# torch FIRST, from the CUDA-13 aarch64 index (GB10 = sm_121 needs CUDA 13;
# the default cu124 wheels are x86_64 + libcudart.so.12 and WILL fail here):
pip install --extra-index-url https://download.pytorch.org/whl/cu130 \
    "torch>=2.9" "torchaudio>=2.9"

# then the rest (this also re-reads the cu130 index from the file's header):
pip install -r requirements-cuda.txt
```

**Verify the GPU is visible to torch before spending hours:**
```bash
python - <<'PY'
import torch
print("torch", torch.__version__, "cuda", torch.version.cuda)
print("cuda available:", torch.cuda.is_available())
print("device:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU ONLY")
PY
```
Expect `cuda available: True` and a GB10/Blackwell device name. If it says
`CPU ONLY` or import errors mention `libcudart.so.12`, your torch is the wrong
(cu124/x86_64) wheel — reinstall from the cu130 index above.

**Troubleshooting (known GB10 pitfalls):**
- `libcudart.so.12: cannot open shared object` → a dep pulled a cu12 torch.
  `pip uninstall -y torch torchaudio` then reinstall from cu130.
- `sherpa-onnx` may only have a CPU aarch64 wheel — that's FINE, Parakeet/
  SenseVoice are non-autoregressive and fast on CPU; they don't need the GPU.
- If a wheel has no aarch64 build, check the NVIDIA DGX Spark forums; for the
  bake-off you only strictly need torch+transformers+faster-whisper on GPU.

---

## 3. Fetch the sherpa models (Qwen3 + Whisper auto-download on first run)

```bash
bash fetch_models.sh     # pulls Parakeet-v3 + SenseVoice int8 into models/
```

Qwen3-ASR (`qwen-asr`) and Whisper (`faster-whisper`) download from Hugging
Face automatically the first time their adapter loads — no manual step. The
optional Common Voice tier (see Appendix) is gated; only then run
`huggingface-cli login`.

---

## 4. THE RUN — Qwen3 first, then the rest (resumable)

### Step 1 — the north-star answer (Qwen3-ASR-0.6B alone, all 50 langs)

```bash
make north-star
# == python run_bakeoff.py --engines qwen3 --tiers fleurs --samples 20 --device cuda
#    && python build_report.py
```

This transcribes 20 FLEURS utterances/language with Qwen3-ASR-0.6B across all
50 languages and writes `results/DECISION.md` with **Qwen3's full WER/CER
table + a preliminary verdict** — BEFORE any heavier model runs. This is the
single result the owner is waiting for. **Read `results/DECISION.md` now.**

### Step 2 — the full matrix (adds Whisper, Parakeet, SenseVoice)

```bash
make full
# == python run_bakeoff.py --engines qwen3,whisper,parakeet,sensevoice \
#    --tiers fleurs --samples 20 --device cuda && python build_report.py
```

Resumable: Qwen3's rows from Step 1 are skipped; it fills in the other three
and re-renders the ranked table. Re-run this exact command after any
interruption.

### Re-render the report anytime (no model calls)
```bash
make report          # rebuilds results/DECISION.md from results/rows.jsonl
```

### Knobs
- `make north-star SAMPLES=40` — more utterances for languages whose call is close.
- `make full TIERS=fleurs` is the default; FLEURS-only is the DECISION
  (per the owner). The domain-matched tier is an OPTIONAL appendix (Appendix A).
- Driving over SSH: every `make` target is headless. After a run,
  `scp <spark>:.../results/DECISION.md .`

---

## 5. Read the result

**`results/DECISION.md`** contains:
1. **Per-language table** — each engine's WER/CER per language; `*` marks the
   per-language winner; the `Winner` column names it.
2. **Per-engine summary** — mean error (spaced vs CJK/Thai), median latency,
   peak RSS, languages scored.
3. **North-star verdict** — Qwen3 "passes" a language if its error ≤ 25% OR
   within 5 points of the best engine there; it earns the **default-tier**
   title if it passes **≥90% AND ≥45** of the languages tested. The verdict
   line reads **YES** / **NOT YET / NO** / **PRELIMINARY** (FLEURS-only is a
   complete answer for the decision).

**`results/rows.jsonl`** — one JSON row per (language, engine): `error_rate`,
`median_latency_s`, `peak_rss_mb`, `metric` (wer/cer), `n_failed`, `tier`,
`source`. This is the raw data; `DECISION.md` is the human read.

Report back: the verdict line, the per-engine summary table, and any languages
where Qwen3 failed badly (so we know the Whisper/Parakeet/SenseVoice fallbacks
those need).

---

## 6. Rough runtime + caveats

- **Setup**: ~10–20 min (torch + model downloads dominate).
- **Step 1 (Qwen3, 50 langs × 20)**: roughly 20–60 min on the GB10 GPU
  (model load + ~1000 short clips). FLEURS streams, so first touch of each
  language adds a little download.
- **Step 2 (3 more engines)**: a few hours total; Whisper large-v3 is the
  slowest (autoregressive). It's resumable, so chunk it freely.
- **GPU memory** is ample on the Spark; all four models fit comfortably.
- **These are QUALITY numbers.** Latency/RSS here are a desktop GPU and do NOT
  represent a phone. The Android-CPU latency, the iOS peak RAM, and the
  Qwen3-ASR co-resident-with-the-4B-LLM number are the **mobile leg** —
  `device/RUNBOOK.md`, run by the owner on real devices. Don't extrapolate
  phone behavior from the Spark.

---

## Appendix A — OPTIONAL domain-matched tier (do NOT block the decision on this)

The owner de-scoped this for the go/no-go: **FLEURS alone decides.** If you
later want to validate the winner on Corpán's REAL input shape (a non-native
learner saying a short phrase on a phone mic), run the domain tier:

```bash
make full TIERS=fleurs,domain
```
It adds three sub-sources: `corpan_tts` (our own ~10k/lang phrases from
`dja/release.sqlite3`, MMS-TTS'd — domain-text shape), `common_voice`
(accent/L2 natural speech; needs `huggingface-cli login`), and `gold` (the
owner's real learner recordings if dropped into
`corpus/gold/<lang>/refs.jsonl`). The report then requires the winner to clear
BOTH tiers. Treat any of these as a follow-up appendix, never a gate.

---

## Appendix B — Qwen3-ASR via GGUF (matches what actually ships)

The bake-off scores Qwen3-ASR through `qwen-asr` (transformers) for accuracy.
What SHIPS on device is the **GGUF on llama.cpp** — `ggml-org/Qwen3-ASR-0.6B-GGUF`
(Q8_0 ≈ 805 MB), a multimodal (`libmtmd`) model: the Qwen3-0.6B **decoder**
GGUF + an audio **mmproj** encoder GGUF, run via `llama-server -hf
ggml-org/Qwen3-ASR-0.6B-GGUF:Q8_0` (or `predict-woo/qwen3-asr.cpp`). Accuracy
is the same weights; the GGUF path is the runtime that rides the same llama.cpp
the corpan-llm 4B already uses. You don't need it for the WER/CER decision, but
if you want to confirm the GGUF transcribes, that's the command.
