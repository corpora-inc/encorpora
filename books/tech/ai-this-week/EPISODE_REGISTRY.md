# AI This Week — Episode Registry (anti-repetition ledger)

**READ THIS BEFORE DRAFTING ANY EPISODE.** Its only job is to stop the show
repeating itself. Do NOT reuse a concept-of-the-week, a top-story spine, or a
lead/headline framing that already ran — listeners notice, and it makes the
show feel like slop. When you draft a new issue, pick angles that are NOT in
the "used" lists below, then append this issue's row.

## Hard rules
- **Concept of the week MUST be new every episode.** Check the "Concepts used"
  list. No repeats, ever.
- **Top-story spine should be new.** Don't re-anchor on the same theme two
  weeks running.
- **Watch recurring lead framings.** "Chinese open model is #1 on OpenRouter
  usage" already carried weight in ep2 AND ep3 — if it's still true, demote it
  to a one-liner; do not build a section around it a third time.
- After shipping, append the row and update the "used" lists in the same commit.

## Concepts used (never repeat)
- mixture of experts — **ep1** (and mistakenly ep3, corrected → codecs)
- quantization — **ep2**
- neural audio codecs — **ep3**
- speculative decoding — **ep4**
- diffusion vs autoregressive — **ep5**
- Remaining Performance Obligations (RPO) — **ep6**
- knowledge distillation — **ep7**

Unused ideas on deck (pick from here or invent new): 1-step decoders,
KV cache & cache-read pricing, RAG vs long-context, tokenization/BPE,
forced alignment, LoRA/QLoRA fine-tuning, context-window mechanics, RLHF
vs DPO, embeddings/vector search, flash attention, model merging,
watermarking/provenance (C2PA/SynthID), grouped-query attention,
mixture-of-depths, test-time compute / reasoning-token budgets, sparse
attention, MoE routing (if ever revisited, a different angle).

## Per-episode ledger

| Issue | Date | Title | Lead story | Top story (deep dive) | Concept of the week | Notable recurring framings |
|---|---|---|---|---|---|---|
| 1 | 2026-05-13 | Rate Cuts and Routers | model releases of the week | (bigger picture) US Federal Reserve chair & AI | mixture of experts | — |
| 2 | 2026-05-20 | Magnifica Humanitas | open weights (GLM-5 on Ascend, ZAYA1 on AMD) | Pope Leo XIV's first encyclical on AI | quantization | "Chinese open models lead OpenRouter usage" |
| 3 | 2026-05-27 | The Most-Used Model on Earth | SGLang patch + DeepSeek permanent price cut (self-host economics) | state of open text-to-speech (Chatterbox/OmniVoice/VoxCPM2/MOSS-Nano/Voxtral license trap) | neural audio codecs | "DeepSeek/Chinese open model #1 on OpenRouter usage" (2nd time — demote next week) |
| 4 | 2026-06-03 | Frontier on the Countertop | MiniMax M3 + NVIDIA Nemotron 3 Ultra (open frontier) | DIY frontier rig — AMD Strix Halo & NVIDIA DGX Spark put frontier inference on a desk | speculative decoding | Anthropic IPO filing; SWE-bench Verified deprioritized after contamination audit |
| 5 | 2026-06-14 | Sundays, and Who We Are | open weights deep (DiffusionGemma, dots.tts, Higgs Audio v3) | beatlounge in Corpán — a sequencer where the samples are sentences; show introduces Corpora | diffusion vs autoregressive | Sunday cadence begins; on-mic intro of the team |
| 6 | 2026-06-21 | Megawatts and Market Caps | Anthropic Mythos/Fable Commerce withdrawal (US pulled a model in 72h) | data-center buildout PR-vs-reality (Stargate 11GW announced/200MW live; Oracle as bag-holder) | Remaining Performance Obligations | US-China HBM binding constraint; China $295B NDRC plan |
| 7 | 2026-06-28 | The Student and the Score | open on-device — Liquid AI LFM2.5-230M (runs on a phone) + Qwen-AgentWorld Apache-2.0 | Anthropic accuses Alibaba of the largest known distillation attack on Claude (25k accounts, 28.8M exchanges) | knowledge distillation | Cursor reward-hacking study (benchmarks gamed); GPT-5.6 Sol gov-gated preview; export-control thread continues from ep6 |

## Notes for future issues
- The "open model is #1 by usage" beat has now run twice. If it recurs, it's
  context (one line), not a leaderboards section.
- Top stories so far have been: macro (Fed), institutional (Vatican), and
  domain deep-dive (open TTS). Rotate — e.g. a hardware/training-infra deep
  dive, a dataset/provenance story, an eval-integrity deep dive.
