# Activity Spec v1 (`src/activity/`)

The model writes the activity; the app checks it, draws it, and grades it. A live LLM (gpt-4o
through the Free2Z gateway) writes complete activities: the question text, figures, the answer
key, hints and a worked explanation. The app validates every field and renders the activity.
It grades the answer on the device and records the result. Nothing here is wired into
`Controller.tsx` yet; see [Wiring plan](#wiring-plan).

| File | Role |
|---|---|
| `spec.ts` | zod schema → TS types + strict validator + semantic rules; batch parsing (`extractJsonObject`, `recoverBatchItems`, `validateActivityBatch`) |
| `schema.ts` | JSON Schema exports: standard draft 2020-12, plus an OpenAI strict-mode variant for a future `response_format` |
| `text.ts` | Rich-text grammar (`plain text with $TeX$`), TeX/markup/link safety, KaTeX rendering |
| `expr.ts` | Safe expression parser/evaluator. It never calls `eval` or `Function`, and its length, depth and value range are bounded |
| `grade.ts` | Pure deterministic grader → `{correct, normalized, misconceptionTag?, invalid?}` |
| `learnerState.ts` | Builds the compact learner summary the model receives. Also defines `ActivityAttemptRecord` and `specHash` |
| `prompt.ts` | Batch prompt: rules + compact grammar + 2 format examples + learner summary + standards window |
| `render/` | `<ActivityView>` plus pure-SVG/HTML figure renderers and response widgets. Import `render/index.ts` to load the CSS |
| `fixtures/` | 43 hand-authored **test fixtures** covering K–8, all 15 figure types and all 8 response types. They are not AI output |
| `gallery/` + `scripts/gallery.mjs` | Dev-only visual gallery: `npm run gallery [-- ids…] [--states]` → `.gallery/index.html` |
| `scripts/spec-eval/` | Dev-only prompt evaluation against a local stand-in model: `npm run spec-eval` → `.spec-eval/<run>/` (see [Prompt evaluation](#prompt-evaluation-dev-only)) |

## Grammar (summary; `ACTIVITY_GRAMMAR` in `prompt.ts` is the model-facing version)

```
Activity  { version:1, id, title?, skillIds[1–3], difficulty 1–10, prompt: Block[1–8],
            figures?: Figure[0–4], response, keyCheck?, hints?: RT[0–4], explanation: RT,
            misconceptions?: {tag, description}[] }
Block     text{text:RT} | math{tex} | figure{figureId}
RT        plain text with inline $TeX$; literal dollar = \$
Figure    bar_chart | line_chart | scatter_plot | pie_chart | data_table | coordinate_plane |
          geometry | number_line | fraction_model | array_grid | place_value_blocks | clock |
          money | ruler | picture       (every figure has id + alt)
Response  numeric | fraction | expression | multiple_choice | multi_select | ordering |
          plot_point | tap_region
keyCheck  {value:"arithmetic"} for numeric/fraction, {x,y} for plot_point
```

Design decisions:

- **Rich text is a string, not a list of runs.** LLMs write `"Add $\frac{1}{2}$ cups"` reliably
  and cheaply, while nested run arrays cost tokens and fail often. The validator splits the
  string into text and math segments and checks each one.
- **Coordinates are `{x,y}` objects, not tuples.** Some structured-output dialects do not
  support `prefixItems`.
- **Geometry uses its own coordinates with y pointing up** (`width × height`, at most 100
  units). The renderer scales them to pixels, so the model never writes SVG.
- **Pictures come from 52 bundled lucide icons** (ISC licence), which the model refers to by
  name. Raw SVG, HTML and URLs are never accepted.
- **Ordering items are written in the correct order.** The app shuffles them with a seed, and
  never shows them already solved.
- **Money is US currency only in v1.** CCSS 2.MD.C.8 is US-specific. Coins and bills are
  stylized, not copies of real currency.
- **Long keys are kept.** The fixtures average about 880 chars (~270 tokens), so four
  activities plus a rationale fit in roughly 1.2k output tokens, well under the ~2.5k target.
  Short keys would save little and make the activities harder to read and debug.

## Trust model

AI output is untrusted data, and it is never executed, linked or injected as HTML.

1. **Structural.** Every object is strict: unknown keys are rejected. Every string and array
   has a length limit, and every number must be finite and within bounds. A cheap pre-pass
   rejects oversized or deeply nested input before the schema runs. Optional fields set to
   `null` count as absent, because strict-mode models emit nulls.
2. **Text.** Text segments may not contain markup, HTML entities, link-like text (`https:`,
   `javascript:`, `www.`, common TLDs) or bidi/control characters. Text is rendered only as
   React text nodes.
3. **TeX.** KaTeX runs with `trust:false`, `strict:'error'`, `maxExpand:50` and `maxSize:8`.
   A denylist blocks `\href`, `\url`, `\html*`, `\def`, `\newcommand`, `\color` and others,
   and the TeX must parse. English words inside math are rejected; this catches the
   unescaped-currency trap (`$3 and $5`). Environment names in column arithmetic
   (`\begin{array}{r}…\end{array}`) are not counted as words. `\phantom` is denied except in
   the exact blank-box form `\boxed{\phantom{0}}` (1–3 zeros); `\square` and `\boxed{}`
   also work. `renderTex` applies the same denylist again at render time.
4. **Expressions.** Function plots, `keyCheck` and expression answers go through `expr.ts`.
   It accepts a fixed grammar: numbers, the declared single-letter variables, `+ - * / ^`,
   and a fixed set of functions and constants. It never runs code. Function plots and answers
   must be defined on most of their domain.
5. **Semantics.** `skillIds` must be in the standards set that was offered. Every figure must
   be shown exactly once, and every reference must point to a real figure. A multiple-choice
   question has exactly one correct option. A `plot_point` answer must lie on the plane and
   must not already be drawn. A `tap_region` target must exist, with at least two regions to
   choose from. Misconception answers must differ from the key.
6. **Key check.** For numeric, fraction and plot answers, the model also writes the arithmetic
   behind the key (`"2*25+10+5+3"`). The app evaluates it locally and rejects the activity if
   the result disagrees with the key. This is required by default (`requireKeyCheck`).
7. **Batch.** An invalid activity is dropped on its own, never repaired, and the rest of the
   batch is kept. Code fences and surrounding chatter are tolerated. If the reply is not one
   valid JSON object, `recoverBatchItems` parses each activity on its own. This covers a reply
   truncated by the token cap and a JSON slip, such as a missing brace or quote, inside one
   activity. Each activity begins at its `"version"` key, and no read goes past the next one.
   The damaged activity is rejected as malformed and its neighbours are kept. Nothing is ever
   repaired.
8. **Grading is local and deterministic.** Expression equivalence is checked by sampling the
   domain at points chosen by a seeded random generator (seeded with the activity id). Fraction
   form rules (`simplest`/`exact`) and polynomial form rules (`expanded`/`simplified`) produce
   tags such as `not_simplified`.

## Rendering

- Charts are hand-built SVG (no chart library). Each figure measures its container, so text
  stays at real pixel size at phone (390), tablet (820) and desktop (1280) widths. The layout
  uses container queries to adapt to the card width.
- The four chart colours (teal, coral, blue, gold, in that fixed order) pass the dataviz
  palette validator in light and dark mode: lightness band, chroma floor, colour-blind and
  normal-vision ΔE, and 3:1 contrast. Pie slices 5–8 use softer tints of the same hues, and
  every slice carries a legend label.
- **Theme.** `theme="light"` is the default, to match today's light-only studio. `"dark"`
  forces dark mode, and `"auto"` follows `prefers-color-scheme`.
- **Accessibility.**
  - SVGs have `role="img"` with `<title>`/`<desc>` taken from `alt`; interactive figures
    become labelled groups.
  - Tap regions are focusable `role="button"` elements, and a row of chips offers the same
    choices.
  - The plane can be driven with arrow keys or the ±x/±y steppers.
  - Every target is at least 44px. Number inputs set `inputmode`. Ordering uses up/down
    buttons and announces each move.
  - Transitions are reduced or off under reduced motion.
- **No hover tooltips on charts, on purpose.** Reading values off the graph is usually the
  task itself.

## Prompt evaluation (dev only)

`npm run spec-eval` is a **development tool for tuning `prompt.ts` before any Free2Z spend**. It
never calls Free2Z, and nothing it produces ships in the app. Its activities are written by a
local stand-in model on synthetic learners, so they must never be presented as Free2Z or product
AI output. Outputs and the reply cache live in `.spec-eval/` (gitignored); never commit them.

```
npm run spec-eval -- [--n 45] [--provider codex|claude] [--model haiku|gpt-6-astra] [--effort low]
                     [--judge-provider codex] [--judge-model gpt-6.1-sol] [--judge-effort medium]
                     [--no-judge] [--no-render] [--only g3-] [--concurrency 4] [--run name]
                     [--port 1438] [--dry]
```

1. **States.** `states.mjs` builds 45 synthetic learners (grades K–8 × cold start, strong,
   struggling with a misconception, review due, guided-only skill practised through AI activities)
   through `learnerState.ts` and the learning engine. `--n` above 45 adds fresh samples.
2. **Author.** Each real `buildActivityPrompt` prompt goes to `codex exec` (read-only sandbox, empty
   directory), or `claude -p` with tools disabled. At most 4 run at once. Replies are cached by a
   hash of the prompt, model and sample, so re-runs are free.
3. **Validate.** `validateActivityBatch` is the same parser and validator production uses.
   Per item the harness records validity and reasons, keyCheck status, skill ids against the
   offered window and the graph, difficulty against `suggestedDifficulty`, response and figure
   types, and size (chars/4).
4. **Render.** Every valid spec is screenshotted through `ActivityView` at phone size (light) into a
   contact sheet `.spec-eval/<run>/index.html`, grouped by learner state.
5. **Judge.** One `codex exec` call per batch returns BINARY verdicts: correct key, level and next
   step, variety within the batch, figure helps, and child-appropriate. Read the contact sheet
   yourself too; the judge is lenient about redundant figures and near-repeats.
6. **Summary.** `summary.json` + `summary.md`: schema pass rate, keyCheck pass, judge pass rates,
   diversity, and reply size against the ~2.5k-token batch budget (gpt-4o ≈ 3 2Z per call).

The codex models available on a ChatGPT login (`gpt-6-astra`, `gpt-6.1-sol`) are far stronger than
gpt-4o, so they flatter the prompt; treat them as a ceiling. `--provider claude --model haiku` is the
main gpt-4o stand-in. Expect about ±2 points of run-to-run noise in every rate (one sample per state).

### Results (2026-10-04, 45 batches, 3–5 activities each, judge = codex gpt-6.1-sol)

| | Haiku before | Haiku after | Ceiling before | Ceiling after |
|---|---|---|---|---|
| Schema valid | 80% | 92.2% | 96.7% | 99.4% |
| keyCheck pass | 96.6% | 100% | 100% | 100% |
| Judge: correct key | 89.8% | 84.3% | 98.9% | 99.4% |
| Judge: level / next step | 83.3% | 86.7% | 98.3% | 98.3% |
| Judge: varied | 95.4% | 97.6% | 100% | 100% |
| Judge: figure helps | 71.4% | 69.5% | 96% | 100% |
| Judge: child-appropriate | 100% | 98.2% | 99.4% | 100% |
| Mean reply (chars/4) | 840 | 857 | 800 | 712 |

"Haiku before" is the first 34 batches; that run was interrupted. The ceiling author is
gpt-6-astra at low effort. Across the last three Haiku iterations the rates stayed in narrow bands,
within noise of each other:

| Measure | Range |
|---|---|
| Schema valid | 90–93% |
| keyCheck pass | 98–100% |
| Judge: correct key | 84–92% |
| Judge: level / next step | 83–87% |
| Judge: figure helps | 69–76% |

What changed in the prompt:

- **Grammar wording where models slipped.**
  - Every figure needs `alt`. The alt gives the parts a blind learner needs, never the answer.
  - Money is `\$`, words never go inside math, and a blank is `\square`.
  - `keyCheck` is forbidden outside numeric, fraction and plot_point answers. A fraction's keyCheck
    is `{value:"2/5+2/5"}`.
  - Points are `{x,y}` objects, ids are lowercase, every geometry shape has a `kind`, and
    `place_value_blocks` always lists hundreds, tens and ones.
  - The prompt now states the label length limits.
- **Skill fit.** Each activity makes the learner do what its first skill title says, read
  literally. Difficulty starts within 1 of `suggestedDifficulty`.
- **Figures.** Add a figure only when the learner uses it, never one that repeats the text. It
  must match the text, and its labels and alt must not reveal the answer. Leave out a doubtful
  figure.
- **Variety.** At least three response types per batch, and no near-duplicates. Use hands-on
  types (plot_point, tap_region, ordering, multi_select) only where finding the answer is the
  math.
- **Correctness.** Options are shuffled, so never refer to them by position, and misconception
  answers differ from the key.
- **Self-check.** A final check runs before answering (solve it, check every option and the
  ordering, then the format checks), and a third format example shows `\$` and a fraction
  keyCheck.

The grammar and parser also changed:

- `validateActivityBatch` recovers each activity on its own from a malformed or truncated reply.
- `\boxed{\phantom{0}}` is accepted as a blank box.
- `\begin{array}` column arithmetic is no longer rejected as words in math.

Remaining gaps:

- **Haiku's limits.** Haiku plateaus below the judge targets on level fit and figure helps. Its
  figures contradict the text, and it puts answers in alt text even when told not to. The
  strong model meets every target with the same prompt, so the rest looks like model capability,
  not missing instructions.
- **Terse standards titles.** The STANDARDS window gives one short title per skill, and most
  level-fit misses come from reading it loosely. Richer skill descriptions in the user message
  would help any model; that is a `learnerState`/standards change.
- **Long units in the answer dock.** Units such as "square meters" overlap the placeholder in
  the focus-stage answer dock. That is a UI issue, not a prompt issue.
- **No vertical multi-digit layout figure.** Column arithmetic now typesets via `array`, but
  there is still no dedicated figure for it.

## Wiring plan

These steps are for a later PR; this one changes no live flow.

1. **Call.** `buildActivityPrompt(buildLearnerSummary({gradeHint, ledger, activityAttempts}))`
   returns the system and user messages. Send them through `Free2zTutor.reply` with a larger
   `max_output_tokens` (`prompt.maxOutputTokens` = 2600). The provider journal currently pins
   1800, so the journal shape needs a versioned bump. Do not use `max_output_tokens_strict`
   yet.
2. **Structured output, later.** When the gateway accepts it, pass
   `response_format: prompt.responseFormat`, which is `json_schema` + strict and uses
   `activityBatchStrictJsonSchema`. Keep the prompt grammar; it still steers the content.
3. **Validate.** Call `validateActivityBatch(replyText, {skillIds: prompt.allowedSkillIds})`.
   Log the rejected activities as model-quality telemetry and show only the accepted ones.
4. **Prefetch queue.** Keep 1–2 validated activities ready. Request the next batch while the
   learner works on the second-to-last activity, so there is never a spinner between
   questions. Persist the queue together with the presentation session; the journal already
   recovers completed answers.
5. **Record.** When the learner submits, run `gradeActivity(spec, response)`. If the result is
   `invalid`, ask again and record nothing. Otherwise append an `ActivityAttemptRecord`
   (`specHash`, `skillIds`, `difficulty`, `responseType`, `correct`, `hintsUsed`,
   `activeMs`, `misconceptionTag`) to the native evidence ledger. Store the spec JSON next to
   it so disputes and rebuilds can re-grade exact content.
6. **Mastery.** The current mastery engine scores only the verified `CanonicalTask` kinds. AI
   activities should count as practice evidence feeding `buildLearnerSummary`, but they must
   not certify whole-standard mastery. That policy decision is for the learning-engine owner.
