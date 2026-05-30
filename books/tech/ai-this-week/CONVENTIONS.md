# AI This Week — Conventions

Single source of truth for how this series is drafted, fact-checked, and
narrated. Read this before drafting any issue. The drafting and fact-
check subagents should be given this file directly.

---

## Cast & voice

- **Vindy** (host) — Gemini Vindemiatrix voice. Mature, likeable, NPR-style.
  Warm, relaxed, friendly, with a quiet gleam of wonder. Polished and
  intelligent, conversational, not theatrical. Asks the questions a
  listener would ask. Light, dry, sometimes a touch of humor. Per-speaker
  director_prompt lives in `narration.yaml` `speakers.host.director_prompt`.
- **Ron** (analyst) — Gemini Charon voice. Bare, no director_prompt.
  Patient explainer. Brings the numbers and the context.

Host asks. Analyst answers. Mismatches (analyst asking, host explaining)
are bugs. The speaker-audit step exists to catch these.

---

## Anti-repetition (READ FIRST, every issue)

Before drafting, read `EPISODE_REGISTRY.md` at the series root. **The
concept-of-the-week must never repeat** — ep1 and ep3 both nearly shipped
"mixture of experts"; that must not happen again. Also avoid re-anchoring the
top story on the same theme, and demote any lead framing that already ran two
weeks straight (e.g. "Chinese open model is #1 on OpenRouter usage") to a
one-liner. After shipping, append the issue's row to the registry and update
its "concepts used" list in the same commit.

## Episode format (~10–13 min) — revised Ep 2+

1. **Cold open** — Vindy intros herself + Ron + the sections
2. **Open-weights & releases** — what shipped in open / DIY land,
   community models, training infra. Lead here. (~3 min)
3. **Leaderboards & evals** — what the boards did, eval-quality and
   contamination notes (~2 min)
4. **Headlines** — fast clip of big-co + industry news, light touch,
   no PR voice (~2 min)
5. **Top Story** — one deep dive. Usually an open-source or technical
   trend, but a meaty outside-AI piece (a la a papal encyclical, a
   labor / policy / geopolitics story) can anchor when it has the
   gravity (~3 min)
6. **Concept of the week** — one technical concept, plain language to
   a little deeper. Drawn from what the week's news made interesting
   (~2 min)
7. **Sign-off** — short, warm

No "after this," no "up next," no "stay with us" — there is no
commercial break. Transitions flow continuously: "Okay, let's get to
the leaderboards", "Now let's move to headlines", "Now let's pull back
to the top story", etc.

**Older "Bigger Picture" framing** (single AI-orthogonal world event
with bidirectional AI angle) can still appear when a story really
demands it, but it is no longer the default closer. Top Story is.

**Cadence:** weekly Wednesday. The show drops mid-week. Sign-off
should say "next Wednesday", NOT "next week". Avoid "for the week
ending..." framing — drops too — say "AI This Week for May 13, 2026"
plain.

---

## Editorial voice (Ep 2+)

This show leans **scrappy, open-weights, on-device, nitty-gritty
technical**. We are not a mouthpiece for the big labs. Big-co products
get covered — we don't ignore Google I/O or a new Claude — but we
cover them the way an open-source maintainer would: noted, contextualized
against the open alternatives, not extolled.

**Concretely:**
- Open-weights releases lead the show. The big-co keynote highlights
  go in Headlines, fast clip, not in the lead section.
- When a closed model claims a benchmark win, we say "they claim" or
  cite the company; we don't repeat marketing claims as fact.
- We surface the open alternative for every big-co product when one
  exists. Gemini Spark on cloud VMs? Mention that you can run a 70B
  open model on a single workstation today. Apple's 2-bit on-device?
  Mention llama.cpp's Q4_K_M ships in every consumer-grade model.
- We track training infra (which chips, which countries, whose stack),
  inference engines (vLLM, llama.cpp, SGLang, MLX), and quantization
  formats (AWQ, GGUF, FP8, QAT) the way a serious newsroom tracks
  the supply chain.
- The audience is the engineer / builder / curious technical person.
  Not the procurement manager.

If a draft segment sounds like a product launch press release, rewrite
it from the "what does this mean for the open ecosystem" angle.

## Drafting style

### Voice
- Conversational, podcast-style. Two smart people who like each other,
  not a script-read.
- Hosts can interrupt with light follow-ups, confirm dates with each
  other, push back briefly on hype.
- No overuse of "Right.", "Period.", "So...", "Exactly." as one-word
  Vindy reactions — they're flat and they trip TTS on weak first words.
  When Vindy reacts, use 4–8 words: "Tell us a little bit more about
  that, Ron", "Walk me through it", "And on the open weights side?"

### Numbers
- Spell every number as words in `tts.text` (Chatterbox-safe even though
  we are on Gemini today — series may go cross-engine later).
- Display can keep numerals; the `text` and `tts.text` fields diverge
  on numbers only.

### Acronyms
- `AI` reads cleanly bare in Gemini. Use as-is.
- Other letter acronyms (`GPT`, `MoE`, `NPR`) — use bare in display, use
  full name in `tts.text` when the listener wouldn't recognize letters
  (`mixture of experts`, `national public radio`-style host).

---

## Dates — anchored, never robotic

**Research must produce absolute dates.** Drafting renders them
**conversationally**.

### Default: relative-but-anchored
Hosts talk like people remember things, not like they're reading from
a timestamped feed:
- "back in mid-April" / "back in March" / "earlier this spring"
- "a couple weeks ago" / "late last month"
- "wasn't it back in mid-April when Opus 4.7 first cracked fifteen
  hundred?" / "yeah, mid-April"

### Exact dates only when the date IS the point
- "Today, the Senate confirmed Warsh."
- "OpenAI rolled this out on Monday."
- "Anthropic shipped Opus 4.7 on April sixteenth — five weeks ago." (when
  precision matters for the story)

### Replayability
"Back in mid-April" is still correct three months from now relative
to the issue date in the title. "Last month" rots. Prefer the former.

---

## Fact-checking — never confidently wrong

### Pre-draft research
The three research subagents (model releases / leaderboards / macro) must
each produce claims that carry:
1. An **absolute date** (e.g., April 16, 2026 — not "last month")
2. A **verifying source URL**
3. For "this week" claims: date must be inside the actual current week.
   Anything older is **context**, not news.
4. For leaderboard claims: cite the specific board + the specific date
   the model's score was published.

### Post-draft fact-check pass (gating)
Before TTS spend, every substantive claim in the manuscript gets
verified by a fact-check subagent:
- **Input:** manuscript markdown
- **Output:** `<issue>/fact_check.json` with one entry per claim:
  `{claim, status: VERIFIED | CORRECTED | UNVERIFIED, citation_url,
  suggested_rewrite}`
- **Gate:** TTS does NOT run on a draft with unresolved CORRECTED claims.

### Hedging unverified claims
- Company-stated stats: "OpenAI says...", "Anthropic claims..." (not
  "the model writes thirty percent fewer words" — that's their internal
  number, not yet independent)
- Rumors / leaks: "reports suggest...", "credible chatter has it that..."
- Predictions: "Polymarket is pricing X at Y percent" with the date

---

## Per-segment text discipline

### Segment sizing — one sentence per segment (Ep 2+)

**One sentence per segment.** Issue 1 shipped with some multi-sentence
segments and the listen sounds good (Gemini Flash 3.1 reads paragraphs
with great intra-segment cadence), but at scale the multi-sentence
shape has three concrete downsides for a language-learning catalog:

1. **Blast radius.** A Gemini truncation on a 3-sentence segment ruins
   3 sentences of audio. Single-sentence segments contain the damage
   to one sentence. Issue 1 JA had 5 of 6 stuck segments in long
   multi-sentence ones; the short-segment JA in the same pack went
   clean.
2. **Drill loop.** The reader's tap-to-replay UX is the language-
   learning atom. A 3-sentence segment makes tap-to-replay span ~12s
   instead of ~3s. Single is the natural drill unit.
3. **Auto-rewrite risk surface.** Codex rewrites a multi-sentence
   segment as one unit; preserving meaning across all sentences while
   addressing a truncation defect is harder than rewriting one
   sentence. One sentence in, one sentence out is bounded.

The intra-paragraph cadence we'd lose by splitting is rebuildable in
the reader via per-segment `pause_after_ms` chosen with intent:

- Within a thought (clause continuing): 250–400ms
- New sentence within same idea: 500–700ms
- Topic shift / paragraph break: 1000–1500ms
- Section break (heading): 1500–2000ms

**Trim aggressively** so the trailing silence in the audio is ~50ms
and the reader-side pause dominates. `narration.yaml` has
`trimming.always_trim: true` for this pack and that should stay.

Result: the listen sounds nearly identical to a multi-sentence
recording, the drill loop is preserved, and the Gemini failure
surface shrinks.

### Speaker correctness
Every `**HOST:**` line is a question, a framing, a quick reaction, or a
confirmation. Every `**ANALYST:**` line is fact-delivery, an explanation,
or context. Flip-flopped lines confuse listeners and trip the catalog
metadata.

### No commercial implications
No "after this", no "up next", no "stay with us", no "we'll be right
back". The show is uninterrupted.

### Avoid plateau triggers
- Don't end Vindy questions with single weak words ("right?", "so?")
  — they trip `tail_zero_duration_run` on Gemini
- Don't repeat a phrase verbatim in adjacent segments — Gemini sometimes
  loses its place
- Keep each segment under ~120 chars in the source language (longer
  segments hit Gemini truncation limits, especially in JA/KO/AR/HE).
  This naturally follows from one-sentence-per-segment.

---

## File layout per issue

```
ai-this-week/
├── series.yaml          # series-wide metadata
├── CONVENTIONS.md       # this file
├── 001-may-13/
│   ├── book.yaml
│   ├── fact_check.json  # post-draft fact-check report
│   ├── manuscript/
│   │   └── 00-script.md
│   ├── scripts/
│   │   ├── generate_dialog_segments.py
│   │   └── apply_pacing.py
│   └── packs/
│       └── vindy-ron-gemini-v1/
│           ├── manifest.json
│           ├── narration.yaml
│           ├── segments.json
│           ├── audio_manifest_en.json
│           └── audio/en/*.m4a
└── 002-may-20/ ...
```

---

## Release flow (per issue)

1. **Research** — 3 parallel WebSearch agents with dated claims
2. **Draft** — manuscript per conventions (style + dates + transitions)
3. **Fact-check** — `fact_check_pass.py` runs; user reviews report
4. **Corrections applied** — manuscript edited per fact_check.json
5. **Speaker audit** — hand pass for now; subagent for issue 2+
6. **Generate** — `ttsctl generate` (only changed segments)
7. **Pacing pass** — `apply_pacing.py` sets per-segment pause_after_ms
8. **Listen-test** — `concat_with_pauses.py` produces /tmp m4a
9. **User verdict** — A+ or iterate per-segment
10. **Publish** — `ttsctl publish` + `patch-catalog.py`
