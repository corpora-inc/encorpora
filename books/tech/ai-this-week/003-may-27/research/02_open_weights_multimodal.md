# AI This Week — Episode 3 (drops Wed 2026-05-27)
## Open-Weights / Multimodal / Infra & Quant Research — Window: 2026-05-21 → 2026-05-27
Compiled 2026-05-29 (Fri). Editorial lean: the OPEN world only. No big-lab keynote pitches unless DIY-practical (weights drop, open-sourced tool, or self-host price shift). Cross-reference `01_model_releases.md` — this file re-aims toward open/indie/on-device and tries not to duplicate.

**Bottom line up front:** Zero genuinely-new frontier open-weights *model* drops landed inside 2026-05-21→05-27. The real open/DIY news in-window is *plumbing and economics*: SGLang shipped a DeepSeek-V4 stability patch (05-26), and DeepSeek made its V4-Pro 75% API price cut permanent (~05-22/23) — which reshapes the self-host-vs-API calculus for an open-weights (MIT) model. The headline open *model* releases (ZAYA1-8B, the April Chinese wave, Nemotron Omni) are all CONTEXT.

---

## SHIPPED THIS WEEK (open) — 2026-05-21 → 2026-05-27

### 1. SGLang v0.5.12.post1 — DeepSeek-V4 stability patch
- **Date:** 2026-05-26 (published; branch cut 2026-05-23). **INSIDE WINDOW = news.**
- **What:** Stability patch on v0.5.12 (which itself shipped 05-16, day-0 DeepSeek-V4 support). Cherry-picks 12 fixes, mostly DeepSeek-V4: fixes garbled single-token decode on B200/B300, EAGLE/MTP disaggregation crash at ~2000 requests, GSM8K accuracy restored 0.825→0.960 with HiSparse, pipeline-parallel + PD disaggregation. Also `[cu13]` extra for CUDA 13 / sm_103 (B300).
- **Why it matters (open/DIY):** SGLang is one of the two main open self-hosting engines (alongside vLLM). The point of an open-weights frontier model (DeepSeek-V4, MIT) is moot if you can't actually serve it — these fixes are what make in-the-wild V4 self-hosting reliable. Healthy-ecosystem plumbing.
- **Status:** shipped-this-week (infra patch, not a model)
- **Source:** https://github.com/sgl-project/sglang/releases/tag/v0.5.12.post1
- **Source (v0.5.12 base, 05-16, context):** https://github.com/sgl-project/sglang/releases/tag/v0.5.12

### 2. DeepSeek — V4-Pro 75% API price cut made PERMANENT
- **Date:** announced ~2026-05-22/23 (Bloomberg 05-23; was due to expire 05-31). **INSIDE WINDOW = news.**
- **What:** The promotional 75% discount on V4-Pro is now permanent. New pricing ~$0.003625–$0.87 per 1M tokens (down from $0.0145–$3.48), i.e. one-quarter of launch rate. V4-Pro / V4-Flash are **open-weight (MIT)**, released 2026-04-24.
- **Why it matters (open/DIY):** This is the rare big-lab move that *is* DIY-relevant. V4 weights are downloadable, but at $0.87/1M output the API is now cheaper than most people's self-host electricity+GPU amortization for bursty workloads. It re-frames "open-weights" from "must self-host" to "self-host for privacy/offline; API for cheap bursts." It also pressures every other open-weights API host (Together, Fireworks, DeepInfra) on margin.
- **Status:** shipped-this-week (price change on an open-weights model — DIY-practical, so in-scope)
- **Source:** https://www.engadget.com/2180062/deepseek-permanently-reduces-the-price-of-its-flagship-v4-model-by-75-percent/
- **Source:** https://thenextweb.com/news/deepseek-v4-pro-75-percent-price-cut-permanent

### 3. llama.cpp — continuous builds through the window
- **Date:** builds b9374→b9401 span ~2026-05-25 → 2026-05-29 (multiple/day). **INSIDE WINDOW = news (ongoing).**
- **What:** No tagged "release" event — llama.cpp ships per-commit build artifacts. In-window/just-around work: Vulkan aligned-loads in `mul_mat_vec` (~+3.3% tg128 on Qwen3.5-9B BF16 / Intel BMG), WebGPU cleanup, hexagon + ZenDNN backend updates. Broader May arc: full DeepSeek-V4 support (GGUF conversion, native FP4/FP8 quant), IBM Granite 4.0 speech, Sarashina2.2 Vision 3B.
- **Why it matters (open/DIY):** llama.cpp is what the on-device / consumer-GPU world actually runs. Bugfix-and-perf-only cadence with no drama = the engine is mature. The Vulkan/Intel and hexagon work matters specifically for non-NVIDIA and edge/NPU users.
- **Status:** shipped-this-week (ecosystem plumbing)
- **Source:** https://github.com/ggml-org/llama.cpp/releases

### 4. (Borderline / out-of-scope flag) Google AI Edge Portal — on-device LLM benchmarking
- **Date:** announced 2026-05-20 (one day BEFORE window). **CONTEXT (edge of window).**
- **What:** Benchmark/debug on-device LLMs across 120+ physical Android devices (init time, prefill, decode, peak mem), Model Explorer graph viz, CPU/GPU/NPU backends, LiteRT-LM format. Free **private preview**, allowlist only. **Not open-source** (proprietary Google Cloud service).
- **Why it matters / why we'd SKIP:** Touches the on-device theme, but it's a closed Google Cloud product behind an allowlist, not a weights drop or open tool. Per editorial lean, mention only as a one-liner if at all. Note the open counterpart that *is* DIY: Google AI Edge Gallery (open-source app, runs Gemma 4 / Qwen / Phi-4-mini / DeepSeek-R1-Distill on-device, Android+iOS, Snapdragon NPU) — but that shipped April, also context.
- **Status:** context / borderline-out-of-scope
- **Source:** https://cloud.google.com/blog/products/ai-machine-learning/benchmark-llms-on-device-with-ai-edge-portal

---

## CONTEXT — RECENT OPEN RELEASES STILL THE STORY

### Zyphra ZAYA1-8B — reasoning MoE trained ENTIRELY on AMD
- **Date:** 2026-05-06. **CONTEXT (2.5 weeks before window).**
- **What:** Reasoning MoE, <1B active params, matches/exceeds much larger open models on reasoning/math/coding. Pretrained from scratch on **1,024 AMD Instinct MI300X** GPUs with Pensando Pollara interconnect on IBM Cloud — not ported, trained on AMD. **Apache 2.0**, weights on Hugging Face, free serverless endpoint on Zyphra Cloud.
- **Why it matters (open/DIY/infra):** The most important *training-infra* open story of the spring — first credible end-to-end frontier-quality pretrain on AMD silicon, breaking the NVIDIA-only training narrative. Directly relevant to anyone watching the open hardware/training-stack diversification. Small enough to run locally.
- **Status:** context-from-earlier
- **Source:** https://www.zyphra.com/post/zaya1-8b
- **Source:** https://www.marktechpost.com/2026/05/06/zyphra-releases-zaya1-8b-a-reasoning-moe-trained-on-amd-hardware-that-punches-far-above-its-weight-class/

### The April Chinese open-weights wave — DeepSeek V4, Qwen 3.6, Kimi K2.6, GLM-5.1, MiniMax M2.7
- **Date:** ~2026-04-20 → 2026-05-05 (all pre-window). **CONTEXT.**
- **What:** Four-to-five frontier open-weights models in a ~12-day April window. Kimi K2.6 (1T MoE, 32B active, native INT4, "Agent Swarm" 300 sub-agents) scores 54 on Artificial Analysis Intelligence Index — highest of any open-weights model. DeepSeek V4-Pro (1.6T) / V4-Flash (284B), MIT, 1M context. Qwen 3.6 (4B / 27B dense / 35B-A3B MoE), Apache 2.0 — the current open Qwen flagship (3.7-Max is closed/API-only).
- **Why it matters (open/DIY):** This is *the* open-weights story of Q2; the window-of-27 is the quiet aftermath. Worth a context beat: the open frontier is now Chinese-led and the cadence is brutal.
- **Status:** context-from-earlier
- **Source:** https://artificialanalysis.ai/articles/kimi-k2-6-the-new-leading-open-weights-model
- **Source:** https://www.abhs.in/blog/chinese-open-weights-models-4-in-12-days-glm-minimax-kimi-deepseek-cost-war-2026

### NVIDIA Nemotron 3 Nano Omni — open any-to-any multimodal
- **Date:** 2026-04-28/29. **CONTEXT.** (Also in `01_model_releases.md`.)
- **What:** 30B total / 3B active MoE, vision+audio+text+video in, text out. Open weights + datasets + training recipes on Hugging Face. Edge-oriented.
- **Why it matters (open multimodal/omni):** Still the credible *open* omni model — the contrast to Google's closed Gemini Omni (I/O, 05-19) and Alibaba's closed Qwen3.7-Plus. If Ep 3 covers "omni," the open story is Nemotron, not Gemini.
- **Status:** context-from-earlier
- **Source:** https://thenextweb.com/news/nvidia-nemotron-nano-omni-multimodal-agent-edge

### Hugging Face — "State of Open Source: Spring 2026" report (framing context)
- **Date:** report published 2026-03-17 (data thru Feb 2026). **CONTEXT (framing).**
- **What:** Chinese models = 41% of Hub downloads. Alibaba has more derivatives than Google + Meta combined; Qwen family = 113,000+ derivatives. Independent/unaffiliated devs rose 17%→39% of downloads; industry's share of development fell ~70%→~37%.
- **Why it matters:** The macro backdrop for every "open world" segment — open AI is now indie- and China-led, and the derivative/quant layer (Unsloth et al.) is where most of the action is.
- **Source:** https://huggingface.co/blog/huggingface/state-of-os-hf-spring-2026
- **Source:** https://thenewstack.io/china-leads-open-ai-models/

---

## INFRA & QUANT

### Inference engines — version map (most recent stable as of window)
- **vLLM v0.21.0** — 2026-05-15 (pre-window, CONTEXT). C++20 build requirement, KV-offload + Hybrid Memory Allocator, spec-decode respects thinking budget, TOKENSPEED_MLA backend on Blackwell (DeepSeek-R1 / Kimi-K2.5), torch 2.11. No in-window vLLM release. https://github.com/vllm-project/vllm/releases
- **SGLang v0.5.12.post1** — 2026-05-26 (IN WINDOW, see Shipped #1).
- **Ollama v0.24.0** — 2026-05-14 latest stable (pre-window). v0.30.0 is still pre-release (rc, dated 05-13). MLX-on-Apple-Silicon backend (preview since 03-30) is the standing story. No new stable in-window. https://github.com/ollama/ollama/releases
- **llama.cpp** — continuous (IN WINDOW, see Shipped #3).
- **MLX** — mlx_lm 0.21 (production spec-decode) is earlier-year context; no notable in-window event found.

### Quantization
- **Unsloth Dynamic 2.0 GGUFs** — per-layer dynamic quant across all architectures (not just MoE), model-specific schemes, 1.5M-token hand-curated calibration set. **CONTEXT** (launched ~Feb 2026) but the community-quant *practice* is live: Unsloth shipped optimized GGUFs of Qwen 3.6 (27B, 35B-A3B) within weeks of the April release. Source: https://unsloth.ai/blog/dynamic-v2
- **No NEW quant method/format shipped in-window.** GGUF / AWQ INT4 / GPTQ / FP8 / FP4 / QAT remain the standing toolkit. The in-window quant *work* is inside the engines: SGLang's W4A4/W4A8 MegaMoE kernels and FP4 paths for DeepSeek-V4; llama.cpp native FP4/FP8 DeepSeek-V4 quant in GGUF conversion. Source: https://sesamedisk.com/quantization-techniques-ai-inference-2026/

### Training infra / hardware
- **AMD-trained open model** = ZAYA1-8B (see Context). The in-window angle is that the open ecosystem is actively de-risking off NVIDIA-only training.
- SGLang `[cu13]` / sm_103 (B300) support landing 05-26 = Blackwell-B300 self-hosting maturing.

---

## RUMORED / UPCOMING (next 2-3 weeks)

### Qwen 3.7 open-weights mid-tier (27B dense / 35B-A3B equivalent)
- **Date:** not committed; expected Jun–Jul 2026 on the 3.6 cadence. **As of 05-27 NOTHING on Hugging Face.**
- **What:** Apache-2.0 open mid-tier to follow the closed 3.7-Max flagship (announced 05-20, API-only). This is the open-weights shoe yet to drop — the story to watch.
- **Status:** rumored-upcoming (cadence inference, no date)
- **Source:** https://www.yottalabs.ai/post/qwen-3-7-vs-qwen-3-6-what-actually-exists-and-what-to-use-in-production

### DeepSeek R2 / V4-Thinking
- **Date:** no confirmed date as of window (Reuters' "early May" slipped). **Status:** rumored-upcoming.
- **Source:** (tracked in `01_model_releases.md`)

---

## NEGATIVE FINDINGS (what the open world did NOT ship in-window)

- **No new frontier open-weights LLM** dropped 05-21→05-27. The Chinese wave (DeepSeek V4 / Qwen 3.6 / Kimi K2.6 / GLM-5.1 / MiniMax M2.7) was all April–early-May.
- **No new open omni/multimodal model** in-window. Nemotron Omni (04-28) remains the open omni; Gemini Omni (05-19) and Qwen3.7-Plus (05-20) are both CLOSED and out-of-scope per lean.
- **Qwen 3.7 open weights: not shipped.** Flagship 3.7-Max is API-only — Alibaba is forking closed-flagship / open-mid-tier (Mistral playbook). Open Qwen still tops out at 3.6.
- **Meta:** no Llama in-window (no Llama 5; org rebranded "Muse Spark" in April).
- **No new vLLM, no new stable Ollama, no new MLX release in-window.** Only SGLang (post-patch) and llama.cpp (continuous) moved.
- **No new quantization method or format** introduced in-window — only engine-internal kernel work on existing formats.
- **No notable new open dataset release** surfaced for the window (HF Spring report notes robotics datasets up 23x YoY, but that's a Feb-2026 trend, not in-window).

---

## EDITORIAL TAKE FOR EP 3 (one-liner)
"In the open world this was a plumbing-and-pricing week, not a weights week: SGLang shored up DeepSeek-V4 self-hosting and DeepSeek made its V4-Pro 75% price cut permanent — so the live question isn't 'which new open model dropped' but 'now that an MIT frontier model costs $0.87/1M on tap, when do you even bother self-hosting?' Meanwhile the open omni crown still sits with NVIDIA Nemotron while Google and Alibaba ship their omni models closed, and the real frontier-of-the-frontier story stays Zyphra proving you can train a real model entirely on AMD."
