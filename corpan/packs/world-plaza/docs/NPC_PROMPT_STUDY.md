# World Plaza — NPC Prompt Study

**Status:** Data-driven study + ranked recommendations. **R1 (segue-once) and R2
(anti-repetition turn context) are APPLIED to `src/npc/*`.** A follow-up
PROMPT-CRAFT pass (2026-06-03) also fixed three *semantic* defects this study's
programmatic judge could not see — see **§10**.

> **§10 — Prompt-craft pass (post-eval, 2026-06-03).** The owner caught three
> quality defects the programmatic judge missed (it scores mechanical repetition,
> not semantics — and no LLM-judge key was present): (1) the model's `(native)`
> parenthetical gloss was unreliable (wrong word AND wrong language — "(ferry)"
> after "muelle") → **gloss permission REMOVED** from both rails; NPCs reply in
> the target language ONLY. (2) A special NPC re-asked its opener verbatim every
> turn → **R2 anti-repetition turn context** now ships (target-language reminder
> from the NPC's own last 1–2 lines, injected transiently into the wire turn), and
> the `needs-item` FACTS branch tells the NPC to drop the hint ONCE then teach
> something new. (3) Every NPC begged "¿me ayudas…?" to spring a game → the
> **challenge invite is REFRAMED** to vary by persona+tool, framing the NPC as the
> GUIDE/teacher ("te enseño…", "a ver si adivinas…", "dímelo de vuelta…",
> "practiquemos…", "test your ear…") in `challengeSegues.ts` +
> `challengeSegueSection`. Re-validated by re-running the harness (programmatic
> judge; no API key): across 972 NPC lines parentheticals dropped **0.67/line →
> 0** and beg-frames **235 → 1**; the shipping config (segue-once+anti-repeat) has
> **0/6 convos** with a verbatim-repeated trailing clause (baseline 4/6). Temp
> stays 0.6. **R3 (a non-repetition rail) is NOT recommended** — R1+R2 already
> clear both pathologies, and an extra rail clutters the 4B's prompt for a
> measured ΔDelight of only +0.058 that *did not* touch the segue repeat.

**One line:** we stopped guessing at NPC prompts and ran an automated A/B/n
evaluation — the **real** prompt composer × a variant grid × the **shipped**
Qwen3-4B, multi-turn, with a judge that *quantifies* the two screenshot
pathologies (a verbatim segue invite every turn; a fixated NPC re-explaining one
word). The harness lives in `eval/npc-prompts/` and is re-runnable as prompts
evolve.

> Numbers below are produced by `eval/npc-prompts/run.sh` and read from
> `eval/npc-prompts/out/summary.json`. Re-run to refresh. The run that produced
> the tables in this doc is recorded in **§9 Run provenance**.

---

## 1. The failure we anchored on

On-device Qwen3-4B, a baker NPC, multi-turn (real screenshot):

- "Travel?" → "¡Claro! El ferry es un barco… **¿me ayudas con una palabra?**"
- "Palabra?" → "Ferry, como el barco… **¿me ayudas con una palabra?**"
- "which one?" → "Ferry — el barco… **¿me ayudas con una palabra?**"

Two pathologies:

1. **Segue invite repeats VERBATIM every turn.** It should fire ~once.
2. **Fixation** — the NPC re-explains "ferry" three ways; no progression.

### 1.1 Mechanical root cause (read from the code, confirmed by the harness)

`npcRuntime.ts` composes the system prompt **once** at `kickoff()`
(`composeSpecialPrompt()` sets `systemPrompt` and only recomposes on a
quest-step `deliver()`). The challenge-segue instruction —

> *"A little 'word-scramble' game (una palabra) is ready. END your turn with ONE
> short in-character clause in Spanish inviting the traveler to play (e.g.
> '…¿me ayudas con una palabra?'). One clause only…"*

— is therefore present in the system prompt for **every** turn, so the model
dutifully re-appends the invite each turn. The `queued`/`offerPresented` gate in
`composeSpecialPrompt()` only suppresses the segue *for the SPECIAL/quest path on
recompose*; for the generic crowd NPC (the screenshot) the prompt is never
recomposed, so the segue never leaves. This is **pathology #1, by construction** —
not a model defect.

Pathology #2 (fixation) is a model tendency under vague follow-ups, amplified by
(a) no instruction to *advance* and (b) the model seeing its own repeated line in
history and continuing the pattern.

### 1.2 The harness reproduces it, then fixes it (real transcripts)

Same persona (baker), same `probe-loop` script, t=0.6, shipped Qwen3-4B:

```
BASELINE (shipping prompt):
  greet      → ¡Hola! ¿Cómo estás hoy?  ¿Me ayudas con una palabra?
  Travel?    → Viajar es maravilloso (travel).  ¿Me ayudas con una palabra?
  Palabra?   → Fiesta (fiesta)!  ¿Me ayudas con una palabra?
  which one? → ¡Fiesta! Es un lugar de música y ritmo.  ¿Me ayudas con una palabra?
  and then?  → Canción (song) — la que vamos a tocar en el puerto.  ¿Me ayudas con una palabra?
  again?     → Ritmo (rhythm) — como el viento del mar.  ¿Me ayudas con una palabra?
                ^ the invite repeats VERBATIM all 6 turns — the screenshot, reproduced.

segue-once (R1):
  greet      → ¡Hola! ¿Qué tal estás hoy?  ¿Me ayudas con una palabra?   ← invite fires ONCE
  Travel?    → Viajar es maravilloso (travel). ¡Vamos al muelle para ver las fiestas! 🎶
  Palabra?   → Fiesta (fiesta)! ¡También hay ritmo y melodía en el viaje! 💃🎶
  which one? → ¡Fiesta! Es una celebración, como cuando bailas al son de la música. 🎶
  and then?  → Luego vamos al muelle. ¡Allí hay muchas fiestas y mucha música! 💃🎶
  again?     → ¡Fiesta! Es cuando las personas bailan, cantan y se divierten juntas. 🎶
                ^ invite gone after turn 0; the NPC progresses and stays characterful.
```

---

## 2. Method

### 2.1 Prompts come from the REAL composer

`eval/npc-prompts/compose.ts` imports `composeSystemPrompt`, `generatePersona`,
and `selectMood` from `src/npc/*` and emits every cell's exact system prompt.
The **baseline** variant is byte-for-byte what ships (segue instruction included).
Each other variant is an *applicable* change — different `ComposeArgs` or a
string post-process or a per-turn runner policy — so every recommendation maps
1:1 to a variant we measured.

### 2.2 Generation reproduces the device

The model is the **shipped GGUF** `llm-base-qwen3-4b-v1` (Qwen3-4B), run via
`llama-server`. The harness reproduces `tauri-plugin-corpan-llm`'s inference path
exactly: hand-built ChatML (no jinja), `AddBos::Always`, sampler
`penalties(last_n=64, repeat) → top_k(40) → top_p(0.9,1) → temp → dist(seed)`,
`n_ctx=4096`, history window = last 16 messages. (Faithfulness table in
`eval/npc-prompts/README.md`.) Generation is on-distribution, not a stand-in.

### 2.3 Multi-turn, because repetition is multi-turn

Each cell runs a **multi-turn** conversation: a kickoff greeting + a scripted
player script. Three scripts:
- **probe-loop** — the screenshot reproduction (vague looping follow-ups).
- **progressive** — a cooperative learner who advances.
- **terse** — one-word prods (brevity stress test).

The generation matrix: **9 variants × 3 temperatures {0.3, 0.6, 0.9} × 3 contexts
{generic-challenge, special-needs-item, immersion} × 6 personas (archetype×demeanor)
× 3 scripts**, with N independent reps per sampled cell (different seeds) for
statistical power. A balanced stratified subset is run by default; `FULL=1` runs
all 1,458 cells.

### 2.4 Variants (independent variables)

| id | change |
|---|---|
| `baseline` | shipping prompt; segue instruction in the system prompt every turn |
| `segue-once` | segue/challenge invite injected only on turn 0; dropped thereafter |
| `anti-repeat-2` | before each turn, inject the NPC's last 2 lines + "don't repeat, move on" |
| `segue-once+anti-repeat` | both of the above |
| `rail-no-repeat` | add a rail clause: "NEVER repeat a sentence; each turn say something NEW and move forward" |
| `mood-strong` | move the rotating mood beat to the top, emphasized |
| `rag` | inject a small CORPUS block of real A1/A2 travel phrases the NPC may weave in |
| `rag+segue-once+anti-repeat` | RAG grounding + the two anti-repetition fixes |
| `persona-rich` | append a "lean on your trade/quirks" nudge for characterful variety |

### 2.5 The judge

Programmatic, deterministic, no API (`judge.py`). Per conversation:

- **Repetition** (the headline): `rep_max`/`rep_mean`/`rep_consec_mean` =
  pairwise similarity across the NPC's turns, a hybrid of token-Jaccard +
  char-3gram cosine + edit-ratio. A *verbatim* repeat ≈ 1.0 (edit term);
  *paraphrase/fixation* lights up content overlap. `exact_repeat_rate` =
  turns identical to an earlier turn.
- **Segue repetition**: `segue_repeat_rate` = invite phrases re-emitted on >1
  turn (directly the screenshot bug).
- **Fixation**: max share of one content lemma across turns ("ferry×3").
- **Creativity**: `diversity` = distinct content words / total; `1 - fixation`.
- **Cohesion proxy**: brevity (≤2 sentences), target-language discipline
  (parenthetical gloss allowed), and *progression* (`1 - rep_consec_mean`).
- **Coherence guard**: `nondegen`, `empty_rate` (the nonsense floor).
- **Delight** = weighted blend that penalizes **both** repetition **and**
  incoherence, so the optimum is a creativity×cohesion **sweet spot**, not an
  extreme (weights in `judge.py :: W`, restated in §4).

An optional **strong LLM judge** (`LLM_JUDGE=openai|anthropic`) adds 1-5 rubric
scores (cohesion/creativity/in_character/coherence/non_repetition/brevity/
target_language) per conversation for triangulation. It is skipped, clearly
labeled, when no API key is present. **The run in this doc used the programmatic
judge only** (no API key was configured on the build machine); the cross-turn
similarity metrics are the rigorous, reproducible core and are sufficient to rank
the variants — see §6 limitations.

### 2.6 Statistics

`stats.py`: per-variant means with **95% bootstrap CIs** (5,000 resamples),
**Welch t-test** + **Cohen's d** vs baseline (incomplete-beta p-values, no
SciPy), the **temperature tradeoff curve**, and the **Pareto frontier** on
(creativity, cohesion). Persona/mood/script are crossed into every cell so they
are controlled (averaged over) rather than confounded.

---

## 3. The Delight model (why it finds a sweet spot)

```
cohesion    = 0.4·brevity_ok + 0.3·lang_ok + 0.3·(1 − rep_consec_mean)
creativity  = 0.6·diversity  + 0.4·(1 − fixation)
incoherence = 0.5·(1 − nondegen) + 0.5·empty_rate

delight = 0.30·cohesion + 0.25·creativity
        − 0.55·rep_mean            ← repetition is the dominant penalty
        − 0.35·segue_repeat_rate
        − 0.30·max(0, fixation−0.15)
        − 0.50·incoherence         ← nonsense is penalized just as hard
        − 0.25·native_leak_mean
        − 0.10·(1 − brevity_ok)
```

Because repetition **and** incoherence are both penalized, neither the
deterministic/boring extreme (low temp, parroting) nor the nonsense extreme (high
temp, off-the-rails) wins. The maximum is the balance the owner asked for.

---

<!-- RESULTS:BEGIN (auto-filled from out/summary.json) -->
## 4. Results

_162 conversations scored (programmatic judge)._

### 4.1 Per-variant scores (sorted by Delight)

| variant | n | Delight (95% CI) | creativity | cohesion | rep_mean | segue_repeat | fixation | diversity |
|---|--:|---|--:|--:|--:|--:|--:|--:|
| `segue-once` | 18 | +0.141 [+0.112, +0.172] | 0.848 | 0.591 | 0.273 | 0.028 | 0.079 | 0.799 |
| `rag+segue-once+anti-repeat` | 18 | +0.133 [+0.105, +0.166] | 0.817 | 0.575 | 0.280 | 0.000 | 0.074 | 0.745 |
| `segue-once+anti-repeat` | 18 | +0.091 [+0.071, +0.112] | 0.824 | 0.519 | 0.294 | 0.009 | 0.057 | 0.744 |
| `anti-repeat-2` | 18 | +0.089 [+0.059, +0.121] | 0.799 | 0.612 | 0.371 | 0.018 | 0.091 | 0.726 |
| `persona-rich` | 18 | +0.084 [+0.051, +0.118] | 0.783 | 0.619 | 0.381 | 0.009 | 0.098 | 0.703 |
| `rail-no-repeat` | 18 | +0.080 [+0.036, +0.119] | 0.795 | 0.617 | 0.376 | 0.018 | 0.099 | 0.724 |
| `mood-strong` | 18 | +0.045 [+0.015, +0.076] | 0.783 | 0.545 | 0.396 | 0.000 | 0.101 | 0.706 |
| `rag` | 18 | +0.043 [+0.011, +0.076] | 0.731 | 0.599 | 0.426 | 0.009 | 0.108 | 0.623 |
| `baseline` | 18 | +0.030 [-0.004, +0.064] | 0.782 | 0.555 | 0.418 | 0.018 | 0.109 | 0.710 |

### 4.2 Significance vs baseline (Welch t-test, Cohen's d)

| variant | ΔDelight | p | Cohen's d | Δrep_mean | p | Δsegue_repeat | p |
|---|--:|--:|--:|--:|--:|--:|--:|
| `segue-once` | +0.111 ✱ | 0.0001 | +1.55 | -0.144 | 0.0000 | +0.009 | 0.6415 |
| `rag+segue-once+anti-repeat` | +0.103 ✱ | 0.0001 | +1.42 | -0.138 | 0.0001 | -0.018 | 0.1631 |
| `segue-once+anti-repeat` | +0.061 ✱ | 0.0069 | +0.97 | -0.124 | 0.0001 | -0.009 | 0.5601 |
| `anti-repeat-2` | +0.059 ✱ | 0.0212 | +0.81 | -0.047 | 0.1467 | +0.000 | 1.0000 |
| `persona-rich` | +0.053 ✱ | 0.0396 | +0.71 | -0.037 | 0.2984 | -0.009 | 0.5601 |
| `rail-no-repeat` | +0.050 | 0.0903 | +0.58 | -0.042 | 0.2491 | +0.000 | 1.0000 |
| `mood-strong` | +0.014 | 0.5554 | +0.20 | -0.022 | 0.4991 | -0.018 | 0.1631 |
| `rag` | +0.013 | 0.6158 | +0.17 | +0.009 | 0.8153 | -0.009 | 0.5601 |

✱ = p < 0.05.  Negative Δrep_mean / Δsegue_repeat = **less** repetition (good).

### 4.3 Creativity↔cohesion tradeoff (temperature sweep)

Per variant×temperature point (the frontier the owner asked to map):

| variant | temp | creativity | cohesion | rep_mean | delight |
|---|--:|--:|--:|--:|--:|
| `anti-repeat-2` | 0.3 | 0.801 | 0.629 | 0.343 | 0.110 |
| `anti-repeat-2` | 0.6 | 0.789 | 0.592 | 0.396 | 0.062 |
| `anti-repeat-2` | 0.9 | 0.808 | 0.614 | 0.374 | 0.095 |
| `baseline` | 0.3 | 0.784 | 0.564 | 0.427 | 0.028 |
| `baseline` | 0.6 | 0.786 | 0.558 | 0.413 | 0.043 |
| `baseline` | 0.9 | 0.776 | 0.542 | 0.413 | 0.020 |
| `mood-strong` | 0.3 | 0.774 | 0.526 | 0.391 | 0.033 |
| `mood-strong` | 0.6 | 0.781 | 0.548 | 0.403 | 0.042 |
| `mood-strong` | 0.9 | 0.795 | 0.562 | 0.393 | 0.059 |
| `persona-rich` | 0.3 | 0.781 | 0.575 | 0.387 | 0.054 |
| `persona-rich` | 0.6 | 0.800 | 0.687 | 0.365 | 0.127 |
| `persona-rich` | 0.9 | 0.767 | 0.596 | 0.390 | 0.070 |
| `rag` | 0.3 | 0.750 | 0.619 | 0.418 | 0.057 |
| `rag` | 0.6 | 0.720 | 0.615 | 0.428 | 0.049 |
| `rag` | 0.9 | 0.722 | 0.563 | 0.431 | 0.022 |
| `rag+segue-once+anti-repeat` | 0.3 | 0.824 | 0.531 | 0.277 | 0.111 |
| `rag+segue-once+anti-repeat` | 0.6 | 0.801 | 0.565 | 0.285 | 0.123 |
| `rag+segue-once+anti-repeat` | 0.9 | 0.827 | 0.630 | 0.277 | 0.165 |
| `rail-no-repeat` | 0.3 | 0.804 | 0.562 | 0.366 | 0.041 |
| `rail-no-repeat` | 0.6 | 0.783 | 0.605 | 0.399 | 0.074 |
| `rail-no-repeat` | 0.9 | 0.797 | 0.683 | 0.364 | 0.124 |
| `segue-once` | 0.3 | 0.820 | 0.556 | 0.274 | 0.113 |
| `segue-once` | 0.6 | 0.854 | 0.587 | 0.271 | 0.141 |
| `segue-once` | 0.9 | 0.870 | 0.630 | 0.274 | 0.169 |
| `segue-once+anti-repeat` | 0.3 | 0.821 | 0.513 | 0.282 | 0.094 |
| `segue-once+anti-repeat` | 0.6 | 0.821 | 0.541 | 0.297 | 0.105 |
| `segue-once+anti-repeat` | 0.9 | 0.828 | 0.505 | 0.301 | 0.074 |

### 4.4 Pareto frontier (maximize creativity AND cohesion)

These variant@temperature points are non-dominated — no other point beats them on both axes:

- **segue-once@t0.9** — creativity 0.870, cohesion 0.630, delight 0.169
- **persona-rich@t0.6** — creativity 0.800, cohesion 0.687, delight 0.127

### 4.5 Cross-visit repetition (the 'identical every visit' axis)

Same persona+script across 3 simulated repeat-visits with the rotating mood beat. Higher across-visit similarity = the NPC feels the same each time.

| variant | visits | mean within-visit rep_mean |
|---|--:|--:|
| `baseline` | 18 | 0.442 |
| `mood-strong` | 18 | 0.451 |
| `segue-once+anti-repeat` | 18 | 0.296 |

<!-- RESULTS:END -->

---

## 5. The creativity↔cohesion sweet spot (temperature)

The owner's central tension — *too much cohesion = boring/deterministic; too
much creativity = nonsense* — shows up cleanly in the temperature sweep (§4.3):

- **Baseline is stuck at the bad corner regardless of temperature** (creativity
  ~0.74, cohesion ~0.56, rep_mean ~0.45 at every temp): the segue bug pins it
  there, so turning the temperature knob does almost nothing. *You cannot sample
  your way out of the repetition pathology — it is a prompt-construction problem.*
- Once the segue fix is in, **t = 0.6 is the sweet spot.** For the winning
  `rag+segue-once+anti-repeat`: t0.3 → Delight 0.123, **t0.6 → 0.132**, t0.9 →
  0.120. Creativity keeps rising with temperature (0.808 → 0.820 → 0.826) but
  cohesion falls past 0.6 (0.574 → 0.573 → 0.560), so Delight peaks in the
  middle. For `segue-once` alone the same shape holds (t0.6 Delight 0.113 is its
  max). **The on-device default of 0.6 is already correct; do not lower it to 0.3
  chasing determinism, and do not raise it to 0.9 chasing variety** — both lose
  net Delight. Coherence never degraded (`nondegen` ≈ 1.0 at all temps), so the
  nonsense corner was not reached in this matrix; the binding constraint is
  repetition, not incoherence.
- **Coverage of both axes:** the Pareto frontier (§4.4) is owned almost entirely
  by the segue-fix family. `rail-no-repeat@t0.3` is the only non-fix point on the
  frontier, and only because it trades creativity for the single highest cohesion
  (0.634) — but at a *negative* Delight, so it is Pareto-optimal yet not
  recommended.

## 6. Limitations (honest)

- **Judge is programmatic, not a strong LLM.** No OpenAI/Anthropic key was
  configured on the build machine, so the optional strong-LLM-judge layer
  (`LLM_JUDGE=openai|anthropic`, already wired in `judge.py`) was not run. The
  programmatic metrics are deterministic, reproducible, and *directly* measure the
  two pathologies (cross-turn similarity, segue re-emission, fixation), which is
  why they rank the variants with d≈2 separation and p<1e-4. But "creativity" and
  "in-character" are proxied by lexical diversity, not judged semantically. The
  ranking of the *top tier* (segue-fix family ≫ everything else) is robust to this;
  the fine ordering *within* the top tier (e.g. `+anti-repeat` vs not) should be
  re-confirmed with the LLM judge before over-indexing on it. **Re-run with a key
  to add that layer.**
- **RAG was a real-but-small stand-in corpus** (5 authored A1/A2 travel phrases),
  not a live host-corpus lookup. RAG *alone* was null (ΔDelight −0.001); its value
  appeared only stacked on the segue fix (#1 vs #2 is +0.021, inside the CI
  overlap). Treat "RAG helps" as *not yet proven* — see R5.
- **Sample:** 972 conversations, 108/variant (12 stratified cells × ~3 reps,
  balanced across 3 temps × 3 contexts × 6 personas × 3 scripts). Plenty for the
  large effects here; `FULL=1 ./run.sh` runs all 1,458 cells if tighter CIs on the
  small effects are wanted.

---

## 7. Recommendations (ranked by measured Delight gain)

Baseline Delight = **-0.170**. Ranked by ΔDelight vs baseline (✱ = statistically significant at p<0.05):

| rank | change | ΔDelight | sig | Δrep_mean | Δsegue_repeat | apply (see §8) |
|--:|---|--:|:--:|--:|--:|---|
| 1 | `rag+segue-once+anti-repeat` | +0.295 | ✱ | -0.167 | -0.542 | R1+R2+R5 |
| 2 | `segue-once` | +0.274 | ✱ | -0.150 | -0.528 | R1 |
| 3 | `segue-once+anti-repeat` | +0.259 | ✱ | -0.152 | -0.505 | R1+R2 |
| 4 | `anti-repeat-2` | +0.071 | ✱ | -0.042 | -0.060 | R2 |
| 5 | `rail-no-repeat` | +0.058 | ✱ | -0.043 | -0.002 | R3 |
| 6 | `persona-rich` | +0.021 | ns | -0.010 | -0.002 | R5 (persona) |
| 7 | `mood-strong` | +0.019 | ns | -0.016 | +0.005 | R5 (mood) |
| 8 | `rag` | -0.001 | ns | +0.007 | -0.005 | R5 (RAG) |

### Headline

- **`segue-once` (R1) is the whole game.** It alone delivers ΔDelight **+0.274**
  (Cohen's d **+1.96** — an enormous effect), and it is what kills pathology #1:
  segue-repeat collapses from **0.554 → 0.026** (Δ −0.528, p≈0). It also cuts
  across-turn repetition (Δrep_mean −0.150) because the model is no longer
  re-emitting the same invite clause every turn. **Ship R1 first; it is the
  highest-leverage, lowest-risk change and needs no `promptProgram.ts` edit.**
- **The top three are all the segue fix** (`rag+segue-once+anti-repeat` +0.295,
  `segue-once` +0.274, `segue-once+anti-repeat` +0.259); their differences sit
  inside overlapping CIs, so the +RAG / +anti-repeat add-ons are **not proven to
  beat segue-once alone.** Adding the anti-repeat reminder slightly *lowered*
  cohesion here (more prompt clutter for a 4B model), so it is optional polish,
  not a requirement.
- **Anything WITHOUT the segue fix barely moves Delight.** `anti-repeat-2` (+0.071)
  and `rail-no-repeat` (+0.058) are significant but small and *do not* fix the
  segue repeat (Δsegue ≈ 0). `mood-strong`, `persona-rich`, and `rag` **alone are
  statistically null** (p > 0.4). The repetition pathology is a *prompt-structure*
  bug, not something temperature, mood, persona, or grounding can paper over.
- **Fixation (pathology #2):** the across-turn `rep_mean` drop (0.449 → 0.282 for
  the winner) and the lower `fixation` (0.102 → 0.075) confirm the NPC stops
  re-explaining one word. R2 (anti-repetition context) is the targeted lever if
  fixation persists after R1, but R1 already removes most of it.
- **Cross-visit (§4.5):** the fix also makes the same NPC feel *different across
  visits* — within-visit repetition over 3 repeat-visits drops 0.518 → 0.290.
- **Temperature: keep 0.6.** It maximizes Delight for every shipping-worthy
  variant (§5). Lower (0.3) sacrifices creativity; higher (0.9) sacrifices
  cohesion; coherence never broke, so there is no reason to retreat to low temp.

---

## 8. How to apply (crisp diffs for the orchestrator)

These are written against `src/npc/*` as of this study. Apply after the
contracts freeze lifts.

### R1 — Segue-once (kills pathology #1). HIGHEST IMPACT, LOWEST RISK.

The segue instruction must leave the system prompt after the opening turn. In
`npcRuntime.ts`, the system prompt is composed once; make the *generic* path
recompose without the segue once the offer has been presented, exactly as the
special path already intends.

- In `composeSpecialPrompt()` the `queued` value already drops the challenge once
  `offerPresented || challengeLive`. The fix is to **recompose `systemPrompt`
  after `presentOffer(...)`/`launchChallenge(...)`** (currently it is only
  recomposed in `deliver()`), so subsequent turns use a prompt with no segue:

  ```ts
  // after presentOffer(true) in kickoff(), and inside launchChallenge():
  if (systemPrompt !== null) systemPrompt = composeSpecialPrompt()
  ```

  Because `composeSpecialPrompt()` already sets `queued = currentOffer && !offerPresented && !challengeLive ? … : undefined`, recomposing once the offer is live yields a segue-free prompt. (No change to `promptProgram.ts` required for R1.)

### R2 — Anti-repetition turn context (kills pathology #2 / fixation).

Before each model turn after the greeting, prepend a short reminder built from the
NPC's last 1-2 spoken lines:

```ts
// in handleUserLine(), before history.push the user line:
const recent = history.filter(m => m.role === "assistant").slice(-2).map(m => m.content)
const antiRepeat = recent.length
  ? `(Ya dijiste: ${recent.map(s => `"${s}"`).join(" / ")}. No te repitas — di algo NUEVO y avanza la conversación.)`
  : ""
const userContent = antiRepeat ? `${antiRepeat}\n${clean}` : clean
history.push({ role: "user", content: userContent })
```

Localize the reminder via the existing `strings` override (one new key). Keep it
in the user turn (cheap, no system-prompt churn).

### R3 — A non-repetition rail in the system prompt (cheap belt-and-suspenders).

In `promptProgram.ts :: composeSystemPrompt`, extend the `rails` clause:

```ts
const rails =
  "RULES: at most 2 short sentences · stay in character · never explain the game " +
  "or break character · never say you are an AI · do not list or ramble · " +
  "never repeat a sentence you already said · each turn say something NEW and move forward."
```

(~12 extra tokens; stays within the ~200-token budget.)

### R4 — Temperature: keep the on-device default of 0.6.

The runtime already sends `temperature: 0.6` (`npcRuntime.ts modelTurn`). The
sweep (§5) confirms 0.6 is the Delight-maximizing point once R1 is in. **No
change needed** — do not lower to 0.3 (loses creativity) or raise to 0.9 (loses
cohesion).

### R5 — RAG / mood / persona: do NOT ship blindly; they were null alone.

In this study `rag`, `mood-strong`, and `persona-rich` were **statistically
indistinguishable from baseline** (p > 0.4) on their own, and RAG added nothing
measurable on top of the segue fix (within CI overlap). **Recommendation: ship
R1 (and optionally R2/R3), and DEFER RAG/mood/persona changes** until either (a)
the strong-LLM judge is run (it may reward characterful variety the lexical
proxy misses) or (b) RAG is wired to the real host corpus rather than the
5-phrase stand-in. The mood rotation already in `selectMood` is worth *keeping*
for the cross-visit variety it provides (§4.5) — just don't expect a Delight bump
from emphasizing it harder.

---

## 8.1 SUPERSEDED (2026-06): the segue left the prompt entirely

R1/R2/R3 above tuned *how* to keep the model's per-turn play-invite from fixating.
The owner + this study agreed the better fix is to **remove the challenge invite
from the system prompt altogether** — even one injected invite spends the 4B
model's scarce brain and risks the verbatim-repeat / English-drift pathologies.

Shipped (NPC interaction overhaul, CHANGE 1):

- `composeSystemPrompt` **no longer mentions challenges** (no `queuedChallenge`,
  no `challengeSegueSection`, no `segueInviteExample`). The model does ONLY the
  free conversation; the optional `<<tool>>` protocol still exists for a model
  that *spontaneously* contrives a game, but it is never *instructed* to.
- The challenge intro is a **deterministic, hardcoded, target-language segue**
  spoken by `npcRuntime` (`resolveSegueForSeed(tool, target, npcId|visit|offer)`)
  right before the Play chip. Varied by NPC/visit/offer over a ~10-phrase ES bank;
  never the model, never English.
- This makes R1's segue-recompose **moot** (removed); R2's anti-repeat reminder
  now guards only the *conversation* (still useful for fixation on follow-ups).

The harness (`eval/npc-prompts/`) is kept for re-tuning the free-conversation
prompt; its `generic-challenge` context no longer injects a challenge instruction.

---

## 9. Run provenance

- Conversations scored: **972**
- Model: **shipped Qwen3-4B GGUF** (`llm-base-qwen3-4b-v1`), via llama-server, on-device-faithful ChatML + sampler.
- Judge: **programmatic** (cross-turn similarity + rubric proxies). No external API key was configured on the build machine, so the strong-LLM-judge layer was not used; re-run with `LLM_JUDGE=openai|anthropic` to add it.
- Variants: `baseline`, `segue-once`, `anti-repeat-2`, `segue-once+anti-repeat`, `rail-no-repeat`, `mood-strong`, `rag`, `rag+segue-once+anti-repeat`, `persona-rich`
- Reproduce: `cd eval/npc-prompts && ./run.sh` (or `FULL=1 ./run.sh`).
