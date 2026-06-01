# AI This Week — Episode 3 (drops Wed 2026-05-27)
## Model Releases Research — Window: 2026-05-21 → 2026-05-27
Compiled 2026-05-23 (Sat). Editorial lean: open-weights / on-device first.

---

## SHIPPED THIS WEEK (2026-05-21 → 2026-05-27)

### 1. Alibaba — Qwen3.7-Max & Qwen3.7-Plus (preview)
- **Date:** 2026-05-20 announce at Apsara/Qwen Conference Hangzhou; OpenRouter routing live 2026-05-21
- **What:** Closed-weights, API-only. Qwen3.7-Max = text-only flagship. Qwen3.7-Plus = multimodal/vision. Context: **1M tokens** (up from 256K). Alibaba claim: model can run autonomously up to **35 hours** without degradation. Pricing on OpenRouter $2.50 in / $7.50 out per 1M tokens. LM Arena: #13 text, #16 vision (per LM Arena, week of release).
- **Why it matters (open-weights angle):** Qwen historically ships weights — but Max/Plus are **API-only, no weights**. The open Qwen line stops at 3.6. Worth flagging that Alibaba is starting to fork closed flagship vs. open mid-tier, same playbook as Mistral.
- **Status:** shipped-this-week
- **Source:** https://www.scmp.com/tech/big-tech/article/3354212/alibaba-unveils-new-qwen-model-custom-chips-bid-become-chinas-ai-factory
- **Source:** https://codersera.com/blog/how-to-run-qwen-3-7-locally-2026/

### 2. llama.cpp — bugfix release
- **Date:** 2026-05-23
- **What:** Fixes integer overflow in perplexity function. Multi-platform artifacts (macOS / Linux / Android / Windows, CPU + CUDA + Metal + Vulkan).
- **Why it matters:** Quiet ecosystem-plumbing news — llama.cpp is what millions of on-device deployments run on. Bugfix-only week = healthy project.
- **Status:** shipped-this-week
- **Source:** https://github.com/ggml-org/llama.cpp/releases

### 3. OpenAI — ChatGPT / Codex platform update (no new model)
- **Date:** 2026-05-21
- **What:** Codex Mac app "Appshots," Goal mode GA, in-app browser annotation improvements, C2PA + SynthID provenance preview. No new model weights, no new API model.
- **Why it matters:** Confirms the lull — OpenAI's frontier model this month is GPT-5.5 Instant (shipped May 5–6); the week-of-27 cadence is plumbing/agent surface, not capability jumps.
- **Status:** shipped-this-week (product, not model)
- **Source:** https://releasebot.io/updates/openai

---

## CONTEXT — RELEASED EARLIER, STILL THE STORY

### Google DeepMind — Gemini 3.5 Flash + Gemini Omni + Gemini Spark (Google I/O)
- **Date:** 2026-05-19 (I/O 2026 keynote)
- **What:** Gemini 3.5 Flash GA, $1.50/$9 per 1M tokens, 1M context. Google claim: outperforms Gemini 3.1 Pro on coding/agentic (Terminal-Bench 2.1 76.2%, MCP Atlas 83.6%, CharXiv 84.2%) at 4× speed. Also: Gemini Omni (any-input-to-any-output, video-first) rolling out to AI Plus/Pro/Ultra. Gemini Spark = 24/7 agentic assistant in beta to Ultra subs.
- **Why it matters:** Dropped Tuesday before our window — too big to skip in Ep 3 even though technically "last week." Flash undercuts Anthropic/OpenAI on price; the agentic harness (Spark) is the real story.
- **Status:** context-from-earlier (released 2 days before our window)
- **Source:** https://techcrunch.com/2026/05/19/with-gemini-3-5-flash-google-bets-its-next-ai-wave-on-agents-not-chatbots/
- **Source:** https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5/

### Anthropic — Claude Managed Agents new features
- **Date:** 2026-05-07 (still being discussed)
- **What:** "Dreaming" (memory consolidation from past sessions), multi-agent orchestration with shared filesystem, M365 add-ins GA (Excel/PPT/Word), Outlook beta, Claude for Small Business.
- **Status:** context-from-earlier
- **Source:** https://9to5mac.com/2026/05/07/anthropic-updates-claude-managed-agents-with-three-new-features/

### NVIDIA — Nemotron 3 Nano Omni
- **Date:** 2026-04-28
- **What:** 30B total / 3B active MoE, vision+audio+text+video, open weights on Hugging Face, OpenRouter (free), build.nvidia.com NIM. Topped 6 leaderboards on document / video / audio understanding per NVIDIA.
- **Why it matters:** The credible open-weights multimodal of the spring — relevant context for Qwen3.7 going closed.
- **Status:** context-from-earlier
- **Source:** https://blogs.nvidia.com/blog/nemotron-3-nano-omni-multimodal-ai-agents/
- **Source:** https://huggingface.co/blog/nvidia/nemotron-3-nano-omni-multimodal-intelligence

### Mistral — Medium 3.5 (128B open-weight)
- **Date:** 2026-04-29
- **What:** 128B open-weight, 256K context, configurable reasoning, native multimodal. Replaces Devstral 2 + Magistral.
- **Status:** context-from-earlier
- **Source:** https://huggingface.co/mistralai/Mistral-Medium-3.5-128B

---

## RUMORED / UPCOMING (next 2-3 weeks)

### Google — Gemini 3.5 Pro
- **Date:** Pichai onstage at I/O 2026-05-19: "Give us until next month." → June 2026 expected.
- **What:** Reasoning-focused complement to Flash. No benchmarks public.
- **Status:** rumored-upcoming (Google-confirmed window, no date)
- **Source:** https://wavespeed.ai/blog/posts/gemini-3-5-pro-coming-next-month/

### OpenAI — GPT-5.6
- **Date:** Polymarket ~80–89% by 2026-06-30. Internal Codex logs briefly referenced gpt-5.6 (canary leak). Not officially announced.
- **What:** Rumored expanded context (~1.5M tokens), UltraFast Codex mode.
- **Status:** rumored-upcoming (leak only, NOT confirmed)
- **Source:** https://wavespeed.ai/blog/posts/gpt-5-6-canary-leak-what-we-know/

### xAI — Grok 5
- **Date:** xAI official account points to Q2 2026; rumored public beta May/June, full API Q3.
- **What:** Rumored 6T parameter MoE, native multimodal, 1.5M context. Has slipped twice.
- **Status:** rumored-upcoming (treat as vapor until shipped)
- **Source:** https://www.mindstudio.ai/blog/xai-grok-roadmap-7-models-training-grok-5-10-trillion

### DeepSeek — R2 / V4-Thinking
- **Date:** No confirmed date as of 2026-05-23. Reuters had earlier reported "early May" but slipped.
- **Status:** rumored-upcoming
- **Source:** https://chat-deep.ai/guide/deepseek-roadmap-rumors/

---

## NEGATIVE FINDINGS (what did NOT ship)
- **Meta:** No Llama release in May 2026. Meta Superintelligence Labs is now branding under "Muse Spark" (April 2026), Llama 5 not shipped.
- **Anthropic:** No new Claude model in window. Mythos Preview still Glasswing-only (released 2026-04-08).
- **DeepSeek / Kimi / Zhipu / MiniMax / Moonshot:** No new model releases in window. (Moonshot took $2B at $20B valuation 2026-05-07 — funding, not model.)
- **Cohere / AI21 / Allen AI:** No new model in window. Ai2's $152M NSF/Nvidia cluster came online early May — capability build, not a release.
- **vLLM / SGLang / MLX:** SGLang 0.5.12 on PyPI 2026-05-16 (week before). No new in-window release found.

---

## EDITORIAL TAKE FOR EP 3 (one-liner)
"Quiet week after a loud one: Google's I/O blast (Flash + Omni + Spark) is still the news, Alibaba quietly went closed-weights on its flagship, and the open-weights story this week is llama.cpp shipping a bugfix — which is exactly what a healthy ecosystem looks like."
