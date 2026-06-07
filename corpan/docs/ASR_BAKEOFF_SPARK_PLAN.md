# ASR Bake-off — DGX Spark Run Plan

**Self-contained.** Hand this whole file to an agent on the DGX Spark. It does not
depend on any other repo file. Goal: pick Corpán's default on-device transcription
model by measuring real accuracy across our ~50 languages.

## North-star question (the verdict this run must answer)
**Does `Qwen3-ASR-0.6B` transcribe well across >50 languages** — well enough to be
Corpán's default downloadable transcription tier? Concretely, emit a yes/no with
evidence:
- **Yes** if median WER ≤ ~20% (CER ≤ ~15% for non-spaced scripts) on **≥ 45 of our
  ~50 languages**, and it's not catastrophically worse than Whisper-large-v3 on any
  major-population language.
- If no, the table shows which model wins which languages (we'll route per-language).

Run **Qwen3-ASR-0.6B FIRST** and print its full per-language table before starting
the other models, so the headline answer lands early even if the rest is still running.

## Hardware / environment
- Target: **NVIDIA DGX Spark (GB10 Grace-Blackwell, ARM64 + CUDA)**. Ample RAM/VRAM.
- **Project-local venv only — never system python** (`python -m venv .venv && . .venv/bin/activate`).
- CUDA torch for aarch64+Blackwell: install the CUDA build matching the box's driver
  (use NVIDIA's aarch64 cu12x index or the preinstalled DGX torch; verify
  `torch.cuda.is_available()` before proceeding).
- Pinned deps: `transformers>=4.48 datasets soundfile librosa jiwer sacremoses
  faster-whisper sherpa-onnx nemo_toolkit[asr] huggingface_hub`. (Install lazily —
  only what each engine needs; SenseVoice/Parakeet can go via `sherpa-onnx` if NeMo
  is heavy on aarch64.)

## Models under test
| key | model | how to run | size | langs | license | notes |
|---|---|---|---|---|---|---|
| **qwen06** | `Qwen/Qwen3-ASR-0.6B` (HF) or `ggml-org/Qwen3-ASR-0.6B-GGUF` Q8_0 | transformers (GPU) or llama.cpp | ~0.6B / 805MB GGUF | 52 | Apache-2.0 | **PRIMARY candidate — run first** |
| qwen17 | `Qwen/Qwen3-ASR-1.7B` | transformers (GPU) | ~1.7B | 52 | Apache-2.0 | optional upper bound |
| whisper | `openai/whisper-large-v3` via `faster-whisper` (`Systran/faster-whisper-large-v3`, compute_type `float16` on GPU) | faster-whisper | ~1.5B | 99 | MIT | the incumbent baseline |
| parakeet | `nvidia/parakeet-tdt-0.6b-v3` | NeMo or sherpa-onnx int8 | 0.6B | 25 EU | CC-BY-4.0 | non-autoregressive; EU only |
| sensevoice | `FunAudioLLM/SenseVoiceSmall` | funasr or sherpa-onnx | ~0.9B | 50+ | **AMBIGUOUS → benchmark only, DO-NOT-SHIP flag** | strong CJK/Cantonese |

Expect parakeet to only cover the EU subset and sensevoice to shine on CJK — that's
fine, the table captures per-language strengths. The decision hinges on **qwen06**.

## Dataset — FLEURS (approved)
Use **`google/fleurs`** (HF datasets), `test` split, per language config. It's read
speech with gold transcripts (CC-BY). Sample **N = 200** clips per language (or the
whole test set if smaller) for stable numbers. Cache 16 kHz mono.

> Honest caveat to record in the report (don't fix it this run): FLEURS is clean
> native read-speech; our real input is short, possibly-accented learner phrases on a
> phone mic. FLEURS ranks the models reliably; treat absolute WER as optimistic.

### Our language set → FLEURS config (best-effort; agent fills gaps)
Corpán targets (~50): `ar bg bn ca cs da de el en es fa fi fr gu he hi hr hu id it
ja ko lt mr ms ne nl no pa pl pt ro ru sk sl sr sv sw ta te th tr uk ur vi yue zh`.

FLEURS config hints (verify against the dataset's config list):
`ar→ar_eg, bg→bg_bg, bn→bn_in, ca→ca_es, cs→cs_cz, da→da_dk, de→de_de, el→el_gr,
en→en_us, es→es_419, fa→fa_ir, fi→fi_fi, fr→fr_fr, gu→gu_in, he→he_il, hi→hi_in,
hr→hr_hr, hu→hu_hu, id→id_id, it→it_it, ja→ja_jp, ko→ko_kr, lt→lt_lt, mr→mr_in,
ms→ms_my, ne→ne_np, nl→nl_nl, no→nb_no, pa→pa_in (Gurmukhi; pa-Arab/Shahmukhi has NO
FLEURS → mark keyboard-floor, skip), pl→pl_pl, pt→pt_br, ro→ro_ro, ru→ru_ru, sk→sk_sk,
sl→sl_si, sr→sr_rs, sv→sv_se, sw→sw_ke, ta→ta_in, te→te_in, th→th_th, tr→tr_tr,
uk→uk_ua, ur→ur_pk, vi→vi_vn, yue→yue_hant_hk, zh→cmn_hans_cn`.
Any config that 404s → record "no FLEURS eval" for that lang and move on.

## Metrics
- **WER** for spaced scripts; **CER** for non-spaced: `zh, yue, ja, th` (and treat
  `ko` with both, report CER as primary).
- Normalize before scoring: lowercase, strip punctuation, collapse whitespace
  (Whisper's `BasicTextNormalizer` is fine; apply the SAME normalizer to every model's
  output and the reference). Use `jiwer` for WER, `jiwer.cer` for CER.
- Also log **per-clip RTF / wall-clock** per model (rough latency signal).

## Procedure
1. For each model (qwen06 first), for each language config:
   - Load FLEURS test (N=200), resample to 16k mono.
   - Transcribe each clip with the language hint where the API supports it.
   - Normalize hyp + ref; accumulate WER/CER.
   - Append a row to `results/rows.jsonl`: `{model, lang, n, wer, cer, rtf}`.
2. After qwen06 finishes all langs, **print its table immediately** (the north-star).
3. Build `DECISION.md`: per-language winner (lowest error among models that support
   it), per-model macro-average (over the langs it supports), the north-star yes/no
   with the supporting counts, and the `license / do-not-ship` flags (sensevoice).

## Reference eval skeleton (adapt as needed)
```python
# eval.py  — run: python eval.py --model qwen06 --n 200
import json, argparse, time, librosa, jiwer
from datasets import load_dataset
from transformers.models.whisper.english_normalizer import BasicTextNormalizer
NORM = BasicTextNormalizer()
CER_LANGS = {"zh","yue","ja","th","ko"}
LANG2FLEURS = { "ar":"ar_eg", "es":"es_419", "zh":"cmn_hans_cn", "yue":"yue_hant_hk", ... }  # full map above

def load_engine(key):
    if key == "qwen06":
        # transformers path (GPU). Or call llama.cpp/qwen3-asr.cpp for the GGUF.
        from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor  # or Qwen3-ASR's own class
        ...
        return lambda wav, lang: transcribe(wav, lang)
    if key == "whisper":
        from faster_whisper import WhisperModel
        m = WhisperModel("large-v3", device="cuda", compute_type="float16")
        return lambda wav, lang: " ".join(s.text for s in m.transcribe(wav, language=lang)[0])
    if key == "parakeet": ...   # NeMo or sherpa-onnx
    if key == "sensevoice": ...  # funasr or sherpa-onnx

def score(model_key, n):
    eng = load_engine(model_key)
    for lang, cfg in LANG2FLEURS.items():
        try: ds = load_dataset("google/fleurs", cfg, split=f"test[:{n}]")
        except Exception: print(f"{lang}: no FLEURS"); continue
        refs, hyps, t0 = [], [], time.time()
        for ex in ds:
            wav = librosa.resample(ex["audio"]["array"], orig_sr=ex["audio"]["sampling_rate"], target_sr=16000)
            hyps.append(NORM(eng(wav, lang))); refs.append(NORM(ex["transcription"]))
        cer = jiwer.cer(refs, hyps); wer = jiwer.wer(refs, hyps)
        row = {"model":model_key,"lang":lang,"n":len(ds),"wer":round(wer,4),"cer":round(cer,4),
               "primary": round(cer if lang in CER_LANGS else wer,4),"rtf":round((time.time()-t0),1)}
        print(row); open("results/rows.jsonl","a").write(json.dumps(row)+"\n")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--model"); ap.add_argument("--n", type=int, default=200)
    a = ap.parse_args(); score(a.model, a.n)
```
Run order: `python eval.py --model qwen06` → print table → then `whisper`, `parakeet`,
`sensevoice`, (`qwen17`). Then a small `build_report.py` to fold `rows.jsonl` into
`DECISION.md`.

## What this run does NOT measure (separate device leg)
The Spark gives **accuracy (WER/CER)** only. On-device **latency + peak RAM**, and
**co-residency next to the 4B Qwen LLM** (the ~0.4–0.7 GB budget — `qwen3-asr.cpp`
benched ~0.5 GB on a 92 s clip), must come from a **real Android (CPU-only) + iOS**
run later. Note non-autoregressive models (parakeet, sensevoice) decode far cheaper on
mobile CPU than the autoregressive qwen/whisper decoders — weigh that when the device
numbers arrive.

## Deliverable back to us
`DECISION.md` with: per-language winner table, per-model macro-avg WER/CER, the
**north-star yes/no for Qwen3-ASR-0.6B**, runtime notes, and the sensevoice
do-not-ship license flag. That single doc decides which provider plugin we build first.
