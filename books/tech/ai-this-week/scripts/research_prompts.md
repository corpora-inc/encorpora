# AI This Week — Research-agent prompt templates

These are the templates the orchestrator uses to spawn the three weekly
research agents. Updated 2026-05-14 after issue 1 shipped a stale
leaderboard claim ("Opus 4.6 first past 1500" when Opus 4.7 had already
beaten it a month prior).

## Hard rules every agent must follow

1. **Every claim must carry an absolute date.** "Last month" / "this
   week" / "recently" do not count. Use `YYYY-MM-DD` or
   `Month DD, YYYY`.
2. **Every claim must carry a verifying source URL.** No claims without
   citation.
3. **For "this week" claims:** the date must fall inside the current
   week (Mon-Sun of issue date). Anything older is **context**, not
   news. The agent must label which.
4. **Confidence intervals:** if a claim is rumored / unverified /
   pre-release, the agent must say so explicitly. Hedge: "reports
   suggest", "company-stated benchmark", "Polymarket pricing", etc.

## Agent 1 — Model releases

```
Today is {WEEKDAY}, {DATE_LONG}. I am producing a weekly AI news
podcast called "AI This Week" and need real research on this week's
AI model releases.

**Window:** {WEEK_START} to {WEEK_END} (and credibly telegraphed
upcoming releases for the next 2-3 weeks).

**Coverage:** all major labs and credible open-weights groups, including:
- Anthropic (Claude family)
- OpenAI (GPT, o-series)
- Google DeepMind (Gemini family)
- Meta (Llama, MSL)
- xAI (Grok)
- Mistral
- DeepSeek
- Alibaba / Qwen
- AI21, Cohere
- Allen AI, other notable open-weights labs
- Chinese labs (Zhipu, MiniMax, Moonshot)

**For each release, capture:**
1. Lab + model name + RELEASE DATE (absolute, YYYY-MM-DD)
2. What's new technically (capability claim, benchmark scores,
   modality, parameter/context window)
3. Why it matters in plain language (one sentence — the angle a
   non-technical listener would care about)
4. Source URL
5. STATUS: shipped-this-week | context-from-earlier | rumored-upcoming

**Hard rules:**
- Every claim has an absolute date AND a source URL.
- A model released before {WEEK_START} is CONTEXT, not news, even if
  it's still being discussed. Label it.
- Rumored / leaked releases must be clearly labeled rumored.
- Company-stated benchmarks are claims, not facts. Cite as "Lab says X"
  not "Model achieves X".

**Use WebSearch heavily.** Training cutoff is January 2026 — every
date must be verified on the live web.

**Length:** cap your response at ~700 words. Structured list, not prose.

Return the structured findings as your output.
```

## Agent 2 — Leaderboard movement

```
Today is {WEEKDAY}, {DATE_LONG}. I am producing a weekly AI news
podcast called "AI This Week" and need real research on AI model
leaderboard / evaluation movement.

**Window:** {WEEK_START} to {WEEK_END} (and notable shifts in the prior
2-3 weeks IF they are still being actively discussed).

**Coverage:** at minimum check:
- LMSYS Chatbot Arena (overall + categories: coding, math, hard prompts,
  multimodal)
- HuggingFace Open LLM Leaderboard
- MMLU-Pro, GPQA
- Coding evals: SWE-bench (Verified, Lite, Pro), LiveCodeBench
- Agent / tool-use evals: WebArena, OSWorld, GAIA
- Math evals: AIME, MATH, HMMT, FrontierMath
- Multimodal / vision: MMMU
- Long-context: RULER, needle-in-haystack at 1M+
- Cost / speed: Artificial Analysis intelligence index

**For each notable movement:**
1. Which leaderboard
2. Which model climbed or fell
3. By how much (score before → after) if available
4. ABSOLUTE DATE of the change (YYYY-MM-DD)
5. One-sentence "why this matters" angle
6. Source URL

**Pay special attention to:**
- Records broken: "first model past X" claims must specify the EXACT
  date and the EXACT prior holder. Errors here are catastrophic for
  the show's credibility.
- Contamination / gaming reports
- New evals launched this week
- Open-vs-closed gap shifts

**Hard rules:**
- A leaderboard "first" or "record" must cite the date it happened AND
  verify the prior holder.
- Numbers must be specific (score, rank, % move). No "improved",
  "climbed", "moved up" without numbers.

**Use WebSearch heavily.** Verify EVERY first/record claim against the
live leaderboard.

**Length:** cap at ~500 words. Structured list.

Return the structured findings as your output.
```

## Agent 3 — Macro / editorial focus

```
Today is {WEEKDAY}, {DATE_LONG}. I am producing a weekly AI news
podcast called "AI This Week" and need ONE editorial-focus story for
this week: the most significant non-AI-first news story that has a
meaningful, bidirectional AI angle.

**Window:** {WEEK_START} to {WEEK_END}.

**Where to look:**
- US / global markets (S&P 500, NASDAQ, Nvidia, hyperscalers, etc.)
- Federal Reserve / central bank news (rates, inflation, jobs)
- Antitrust / regulation
- Energy / data-center buildout
- Major court rulings (AI copyright / antitrust)
- Geopolitics: wars, sanctions, export controls
- Major lawsuits / corporate moves
- Elections, public health, climate events

**Pick the TOP 1-2 stories** that genuinely link to AI/tech in BOTH
directions:
- How does the story affect AI? (capex cycle, regulation, supply, etc.)
- How does AI affect the story? (automation, jobs, content, infra)

**For each chosen story:**
1. Headline + 2-sentence summary
2. ABSOLUTE DATE(S) of key events this week
3. The AI ↔ story bidirectional relationship in plain language
4. Source URLs (2-3 per story preferred)
5. STATUS: this-week-only | this-week-plus-context

**Hard rules:**
- Story dates must be inside the issue's window.
- "AI is the cause/cure for inflation" style claims must cite an
  analyst or economist, not asserted as the agent's opinion.
- Numbers ($X billion capex, X% growth) must come with sources.

**Length:** cap at ~600 words.

**Tone:** factual, even-keeled. If the week's strongest non-AI story
has only a weak AI angle, prefer "this week was quiet on macro" over
forcing a connection.

Return the structured findings as your output.
```

## Orchestrator variables

Fill before spawning each agent:
- `{WEEKDAY}` — today, e.g., "Wednesday"
- `{DATE_LONG}` — today, e.g., "May 21, 2026"
- `{WEEK_START}` — Monday of issue week, e.g., "May 19"
- `{WEEK_END}` — Sunday of issue week, e.g., "May 25"
