# DGX Spark runbook — the GPU desktop leg

One portable, resumable command set for the owner's DGX Spark (CUDA, ample
VRAM). Produces the **quality ranking** across both eval tiers. The on-device
latency/RAM + co-resident-with-4B numbers come from `device/RUNBOOK.md`
(mobile, owner-run) — the DGX does NOT produce those.

## The two-tier methodology (why this matters)

FLEURS is native, clean, professional read-speech. Corpán's REAL input is a
**non-native learner saying a SHORT target phrase on a phone mic**. So:

- **Tier 1 — FLEURS**: ranks the models across all ~50 langs (the gate).
- **Tier 2 — domain-matched**: validates the FLEURS winner survives OUR shape:
  - `corpan_tts` — our own ~10k/lang phrases (`dja/release.sqlite3`), TTS'd
    (MMS-TTS). Measures domain-TEXT fit. (Clean audio — not accent.)
  - `common_voice` — accent/L2-leaning natural speech (gated; needs HF login).
  - `gold` — the owner's real learner recordings, if dropped in (see below).

**The winner must clear BOTH tiers.** FLEURS alone can flatter a model that
then folds on accented, short, phone-mic input.

## Run it (local on the DGX)

```bash
cd corpan/infra/asr-bakeoff
make setup            # venv + CUDA deps (torch cu124) + sherpa models
.venv/bin/huggingface-cli login    # only needed for the common_voice tier

make north-star       # Qwen3-ASR-0.6B FIRST, all langs, BOTH tiers → DECISION.md
#   → emits the north-star answer (does Qwen clear FLEURS AND domain?) before
#     any heavy model is pulled.

make full             # then whisper/parakeet/sensevoice (resumable, keeps Qwen rows)
make report           # re-render results/DECISION.md anytime
```

Tune: `make north-star SAMPLES=40` (more utterances for close calls);
`make full TIERS=fleurs` (skip domain); `DEVICE=cuda` is the default.

## Run it (driven over SSH)

The same targets work headless. From the controlling host:

```bash
ssh dgx 'cd ~/corpan/infra/asr-bakeoff && make setup'
ssh dgx 'cd ~/corpan/infra/asr-bakeoff && make north-star SAMPLES=20'
scp dgx:~/corpan/infra/asr-bakeoff/results/DECISION.md ./
```

It's resumable, so a dropped SSH session just means re-running the same `make`
target — done triples are skipped.

## Expected outputs

- `results/rows.jsonl` — one row per (lang, engine, source): `error_rate`
  (WER spaced/RTL, CER CJK/Thai), `median_latency_s`, `peak_rss_mb`, `tier`,
  `source`, `n_failed`.
- `results/DECISION.md` — per-tier → per-source tables (per-language winner +
  per-engine summary) + the north-star verdict (Qwen3 must clear ≥90% AND ≥45
  langs in EVERY tier). Console prints the same as it runs.

GPU latency/RAM here are RELATIVE signals only; they do NOT transfer to phones.

## Adding the gold learner recordings (owner)

When you have real learner audio (Parlometron captures etc.), drop per-language
manifests — zero code changes:

```
corpus/gold/<our_code>/refs.jsonl      # {"wav":"0001.wav","reference":"...","id":"..."}
corpus/gold/<our_code>/0001.wav        # any sample rate/channels; auto-remuxed to 16k mono
```

Then `make domain` picks them up as the `gold` source. This is the truest
signal — when present it should weigh most in the call.

## Coverage gaps (honest)

- `corpan_tts` skips languages with no MMS-TTS voice (e.g. pa-Arab) — recorded,
  not crashed.
- `common_voice` skips languages CV doesn't cover (he, te, gu, ms, pa-Arab in
  the current map) — recorded.
- A language absent from a source simply shows `—` in that source's table; the
  verdict only tallies langs Qwen3 was actually tested on per tier.
