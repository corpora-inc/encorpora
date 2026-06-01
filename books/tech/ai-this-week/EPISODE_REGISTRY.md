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

Unused ideas on deck (pick from here or invent new): knowledge distillation /
1-step decoders, KV cache & cache-read pricing, speculative decoding, RAG vs
long-context, tokenization/BPE, forced alignment, LoRA/QLoRA fine-tuning,
context-window mechanics, RLHF vs DPO, embeddings/vector search, flash
attention, model merging, watermarking/provenance (C2PA/SynthID), MoE routing
(if ever revisited, a different angle), diffusion vs autoregressive.

## Per-episode ledger

| Issue | Date | Title | Lead story | Top story (deep dive) | Concept of the week | Notable recurring framings |
|---|---|---|---|---|---|---|
| 1 | 2026-05-13 | Rate Cuts and Routers | model releases of the week | (bigger picture) US Federal Reserve chair & AI | mixture of experts | — |
| 2 | 2026-05-20 | Magnifica Humanitas | open weights (GLM-5 on Ascend, ZAYA1 on AMD) | Pope Leo XIV's first encyclical on AI | quantization | "Chinese open models lead OpenRouter usage" |
| 3 | 2026-05-27 | The Most-Used Model on Earth | SGLang patch + DeepSeek permanent price cut (self-host economics) | state of open text-to-speech (Chatterbox/OmniVoice/VoxCPM2/MOSS-Nano/Voxtral license trap) | neural audio codecs | "DeepSeek/Chinese open model #1 on OpenRouter usage" (2nd time — demote next week) |

## Notes for future issues
- The "open model is #1 by usage" beat has now run twice. If it recurs, it's
  context (one line), not a leaderboards section.
- Top stories so far have been: macro (Fed), institutional (Vatican), and
  domain deep-dive (open TTS). Rotate — e.g. a hardware/training-infra deep
  dive, a dataset/provenance story, an eval-integrity deep dive.
