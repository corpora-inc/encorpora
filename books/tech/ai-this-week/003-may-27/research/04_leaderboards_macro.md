# AI This Week — Episode 3 (drops Wed 2026-05-27)
## Leaderboards, Evals & Macro Top-Story — Window: 2026-05-21 → 2026-05-27
Compiled 2026-05-29. Editorial lean: open-weights / DIY-practical, builder audience.
Skeptical framing: company benchmark numbers = "they claim", not fact. News vs context flagged on every item.

---

## LEADERBOARDS & EVALS (THIS WEEK)

### 1. OpenRouter usage rankings — Chinese OPEN models lap US for 4th straight week (THE in-window story)
- **Date:** Usage window **May 18–24, 2026** (INSIDE our window); report published **2026-05-26** (INSIDE).
- **What (they report, OpenRouter's own usage telemetry — actual invocations, not vibes):**
  - Total global volume **28.9T tokens** for the week, +7.4% WoW, 5th straight week of growth.
  - **DeepSeek-V4-Flash is #1 by usage at 3.43T tokens/week**, "leaving all competitors far behind." It's an open-weight (MIT) 284B-total / 13B-active MoE, 1M context.
  - **Chinese models 9.223T tokens (+19.89% MoM) vs US models 4.93T (+16.27%)** — Chinese models top global usage for the **4th consecutive week**.
- **Why it matters (open angle):** This is a *usage* board, not a quality board — and the most-USED model on earth right now is an open-weight Chinese MoE you can self-host. The open vs closed gap on the metric builders actually feel (what's running in prod) has *inverted* at the top.
- **Source:** https://english.dotdotnews.com/a/202605/26/AP6a151281e4b09ea2331677fb.html
- **Source (model card/price):** https://openrouter.ai/deepseek/deepseek-v4-flash

### 2. Tencent Hy3 surge on OpenRouter — and a great cautionary tale on usage rankings
- **Date:** Analysis published **2026-05-26** (INSIDE window); Hy3 flipped free→paid SKU **2026-05-08** (context, 2 wks before).
- **What:** Tencent's open Hy3 (preview) rocketed up OpenRouter usage (one tracker cites +799% to top spot). Max Woolf's skeptical teardown: Hy3 is cheap on paper ($0.066/1M in vs DeepSeek V4 Flash $0.10) but with **44% cache-read cost vs DeepSeek's 2%**, effective price is *nearly double* DeepSeek. He suspects a single large non-Tencent app is using Hy3 as a data-processing backbone — i.e., usage rankings can be one whale, not broad adoption.
- **Why it matters:** Perfect builder-facing lesson — usage leaderboards measure *who's spending*, not *what's good*. "Trending" ≠ "best." Pair with item #1 as the skeptical counterweight.
- **Source:** https://minimaxir.com/2026/05/openrouter-hy3/
- **Source:** https://finance.biggo.com/news/nWlD9J0B6tLPsnrZBCc6

### 3. SWE-bench Verified / Terminal-Bench / Aider snapshots (board state, mostly CONTEXT)
- **Date:** Board snapshots read **2026-05-28** (just after window); underlying scores mostly posted earlier.
- **What (mix of board reads + vendor claims — treat vendor numbers as "they claim"):**
  - **SWE-bench Verified (third-party trackers, read 2026-05-28):** top is Anthropic Claude Mythos Preview ~93.9% / Opus 4.8 ~88.6% (closed). **Best OPEN models tie ~80.2%: MiniMax M2.5 and Kimi K2.6**; **DeepSeek V4 Pro Max claimed ~80.6%** (open, 1.6T MoE) — open weights now sit in the SWE-bench top 10. NOTE: trackers disagree (one shows GPT-5.5 at 88.7% as the lead); numbers are unreconciled vendor/third-party mixes — do not state any single figure as fact.
  - **Terminal-Bench 2.0 (board read 2026-05-28):** lead is Codex CLI + GPT-5.5 at 82.0%, ForgeCode + GPT-5.4 81.8% (closed harnesses). No open model at the top.
  - **Aider Polyglot:** Claude Opus 4.5 ~89.4% (Anthropic-reported); DeepSeek V3.2-Exp ~74.2% at ~$1.30/run is the open cost-leader.
- **Why it matters (open angle):** On *capability* boards, open trails closed by a clear margin on agentic/terminal tasks but is at parity-ish on SWE-bench. The interesting tension vs item #1: open dominates *usage*, closed still wins *hardest evals*.
- **Source:** https://www.swebench.com/
- **Source:** https://andrew.ooo/answers/swe-bench-verified-leaderboard-may-2026/
- **Source:** https://www.tbench.ai/leaderboard/terminal-bench/2.0

### 4. Artificial Analysis Intelligence Index — open within 3–6 pts of frontier (CONTEXT, late April)
- **Date:** Articles published **2026-04-21 (Kimi K2.6)** and **2026-04-24 (DeepSeek V4 Pro/Flash)** — CONTEXT, not in-window. Index still cited as current.
- **What (they claim):** Best open weights = **Kimi K2.6 (Reasoning) and Xiaomi MiMo V2.5 Pro tied at 54**; DeepSeek V4 Pro at 52. Frontier closed = GPT-5.5 xhigh **60**, Gemini 3.1 Pro / Claude Opus 4.7 **57**. So open is **~3–6 index points behind** the best closed — all top-3 open are trillion-plus-param MoE with permissive licenses.
- **Why it matters:** The "open is one quarter behind closed" framing is holding; good context bed under the in-window usage story.
- **Source:** https://artificialanalysis.ai/articles/kimi-k2-6-the-new-leading-open-weights-model
- **Source:** https://artificialanalysis.ai/articles/deepseek-is-back-among-the-leading-open-weights-models-with-v4-pro-and-v4-flash

### 5. LMArena / Chatbot Arena text Elo (CONTEXT)
- **Date:** Snapshot read **2026-05-28**; top tier unchanged for weeks.
- **What:** Claude Opus 4.6 #1 (~1418), Gemini 3.1 Pro (~1406), GPT-5.2 (~1402) — CIs overlap, statistically tied. All closed. By March 2026 best open models were within ~25–55 Elo of proprietary leaders (only a 54–58% win rate edge). No in-window open-model move at the very top.
- **Source:** https://openlm.ai/chatbot-arena/

---

## EVAL-INTEGRITY DISCOURSE

### A. New paper: "LLM Benchmark Datasets Should Be Contamination-Resistant" (in-window-adjacent, strong)
- **Date:** Submitted to arXiv **2026-05-19** (2 days before window opens — fresh, treat as in-window discourse).
- **What:** Argues benchmarks must be *unlearnable during pretraining yet still usable at inference* — because so many current benchmarks leak into training corpora that scores measure recall, not generalization. Calls on the community to build contamination-resistant methodologies into eval frameworks.
- **Why it matters:** Direct, builder-relevant framing of "benchmaxxing." Pairs naturally with the Hy3 usage-gaming story — two flavors of "the leaderboard is lying to you."
- **Source:** https://arxiv.org/abs/2605.19999

### B. The standing benchmaxxing backdrop (CONTEXT — don't present as new)
- **Dates:** LMArena policy tightening **Apr 2025**; LeCun "results were fudged" re Llama 4 **Jan 2026**; LMArena→"Arena" rebrand **2026-01-28**. All CONTEXT.
- **What:** Goodhart's-law discourse — labs submitting many private variants, publishing only winners; Meta's Llama 4 gaming is the canonical case. Contamination-resistant boards (LiveCodeBench, FrontierMath, MMLU-Pro, SWE-bench Pro) are the 2026 standard answer.
- **Why it matters:** Use as one-line context to set up paper (A); do NOT imply it broke this week.
- **Source:** https://blog.collinear.ai/p/gaming-the-system-goodharts-law-exemplified-in-ai-leaderboard-controversy
- **Source:** https://simonwillison.net/2025/Apr/30/criticism-of-the-chatbot-arena/

---

## PRICE & ECONOMICS

### Self-hosting math for the #1-used open model (DeepSeek V4 Flash)
- **Date:** Pricing/specs current as of late May 2026 (INSIDE window for the V4 Pro discount below).
- **What (they advertise):**
  - **API:** ~$0.14/1M input (cache miss), $0.28/1M output; cache hits ~$0.0028/1M (98% off). Claimed **35–100× cheaper** than GPT-5.5 / Claude Opus 4.7 at equivalent context.
  - **Self-host:** MIT-licensed weights on HF. V4-Flash needs ~170–175GB VRAM (158GB weights + ~10GB 1M KV cache); fits **2× H200 or 2× RTX Pro 6000 Blackwell** (~$7.18/hr cloud). Break-even vs API only at multi-billion tokens/day; below that the API wins. Real ops cost of a TP cluster: "$80k–$150k/yr, half an engineer." (Skeptical: vendor break-even claims ignore this; flag it.)
  - **In-window price event:** DeepSeek V4 Pro **temporarily discounted through 2026-05-31 15:59 UTC** (INSIDE window). Anthropic Opus 4.8 holds $5/$25; cut fast mode to $10/$50.
- **Why it matters (DIY economics):** This is the concrete "should I self-host?" answer for builders — and the honest take (API still wins unless you're at whale scale) is more useful than the hype.
- **Source:** https://www.runpod.io/blog/deepseek-v4-in-the-wild-and-how-to-run-it-on-runpod
- **Source:** https://aitechconnect.in/news/deepseek-v4-pro-self-host-break-even-8xh100
- **Source:** https://api-docs.deepseek.com/quick_start/pricing

---

## MACRO TOP-STORY CANDIDATES (2-3)

### CANDIDATE 1 (STRONGEST) — Nvidia "largely conceded" China's AI-chip market to Huawei
- **Date:** Jensen Huang said it in a **CNBC interview on 2026-05-21** (INSIDE window), alongside an earnings beat (rev +85% to $81.62B). Context lead-up: Trump's China visit May 13–15, China customs refusing approved H200s, Huang telling investors to "expect nothing."
- **What:** Huang concedes the advanced-AI-chip segment in China — once ~20% of data-center revenue, now ~zero — to Huawei. Beijing is *blocking* even US-approved H200 imports to force investment into domestic silicon (Huawei Ascend, Cambricon, Biren). Huawei's Ascend "went from punchline to production line in ~3 years."
- **Bidirectional AI angle (why a newsroom anchors on it):** The open-weight Chinese models topping OpenRouter usage (DeepSeek V4, Hy3, Kimi, MiMo — see Part A item #1) are increasingly **trained and served on Huawei Ascend, not Nvidia**. Export controls intended to slow Chinese AI instead bootstrapped a parallel, sovereign open-AI stack — hardware *and* weights — outside US reach. The leaderboard story and the chip story are the same story.
- **Source:** https://www.cnbc.com/2026/05/21/nvidia-jensen-huang-china-ai-chip-market-huawei.html
- **Source:** https://www.tomshardware.com/tech-industry/trump-says-china-is-blocking-h200-purchases
- **Source:** https://www.cnbc.com/2026/05/25/huawei-chip-logicfolding-semiconductor-nvidia-china.html

### CANDIDATE 2 — Publishers + Scott Turow sue Meta over pirated books used to train Llama (open-weights licensing gravity)
- **Date:** Class action filed **2026-05-05** (CONTEXT — 2.5 wks before window; still actively discussed, no in-window ruling found).
- **What:** Elsevier, Cengage, Hachette, Macmillan, McGraw Hill + author Scott Turow sue Meta & Zuckerberg, alleging Meta torrented **267TB of pirated books from LibGen/Anna's Archive** to train Llama, with Zuckerberg's personal sign-off. They seek statutory damages, an injunction, and an order to **destroy the infringing material**.
- **Bidirectional AI angle:** Directly threatens the *open-weights* model — if a court orders Llama-derived weights tainted/destroyed, every downstream fine-tune and on-device deployment built on Llama inherits legal risk. Contrast with Bartz v. Anthropic (training = fair use, but pirated *copies* aren't → $1.5B settlement). The open ecosystem's data provenance is on trial.
- **Source:** https://variety.com/2026/digital/news/meta-ai-mark-zuckerberg-copyright-infringement-lawsuit-publishers-scott-turow-1236738383/
- **Source:** https://www.hachettebookgroup.com/articles/publishers-and-authors-file-class-action-lawsuit-against-meta-and-zuckerberg-for-willful-copyright-infringement-to-develop-llama-ai-models/

### CANDIDATE 3 — AI's grid crunch: power becomes the binding constraint (slow-burn macro)
- **Date:** Ongoing through May 2026 (WEF analysis 2026-05; CNN 2026-04-23) — CONTEXT/trend, no single in-window trigger.
- **What:** PJM (largest US grid op) projects a 6GW reliability shortfall by 2027; Gartner says power will restrict 40% of AI data centers by 2027. US DC demand heading from ~180 TWh to 400–600 TWh by decade's end. Hyperscalers spending ~$400B/yr; Altman-backed Helion fusion promises Microsoft power by 2028.
- **Bidirectional AI angle:** Most relevant *for builders* as the case FOR small/efficient open models + on-device inference — every watt the frontier labs can't get is an argument for the 3B-active MoE you run locally. Weaker as a hard-news anchor (no in-window event); best as a thematic close.
- **Source:** https://www.weforum.org/stories/2026/05/electricity-data-grid-connectivity-strategic-bottleneck-ai-transformation/
- **Source:** https://www.cnn.com/2026/04/23/business/ai-compute-power-electricity-grid

---

## NEGATIVE FINDINGS
- **No in-window open-model move at the TOP of LMArena text Elo or Terminal-Bench** — top tiers are all closed (Claude/Gemini/GPT) and have been static for weeks. The open story is in *usage* (OpenRouter), not the quality leaderboards' top spots.
- **No new contamination-resistant benchmark *launched* in-window** — the arXiv paper (May 19) is a call-to-action, not a shipped board. Don't overstate it as a new eval.
- **SWE-bench numbers are unreconciled** — third-party trackers disagree (93.9% vs 88.7% leads) and mix vendor claims with independent runs. Cite as "trackers report," never a single hard figure.
- **No in-window AI-copyright *ruling*** — Turow v. Meta (May 5) is a filing; SCOTUS cert denial on AI authorship was 2026-03-02. No verdict landed May 21–27.
- **No in-window AI-specific chip *policy* change** — the H200 framework dates to Jan 2026; the in-window news is Huang's *commentary* (May 21), not a new rule.
- **Hy3 ranking is likely one-whale-driven**, not broad adoption (Max Woolf) — do not present as "Tencent's open model is beloved."

---

## EDITORIAL TAKE (one-liner)
"The leaderboard that matters this week isn't a quality board — it's OpenRouter's usage meter, where an MIT-licensed Chinese MoE you can self-host is now the most-invoked model on Earth (4th straight week China > US); and the chip story is the same story, with Nvidia conceding China to Huawei on May 21 — export controls didn't slow China's AI, they bootstrapped a sovereign open stack, silicon and weights both."
