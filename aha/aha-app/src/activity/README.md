# Activity Spec v1 (`src/activity/`)

The model writes the activity; the app checks it, draws it, and grades it. A live LLM (gpt-4o
through the Free2Z gateway) writes complete activities: the question text, figures, the answer
key, hints and a worked explanation. The app validates every field and renders the activity.
It grades the answer on the device and records the result. The controller uses it when a
learner is signed in to Free2Z and AI is ready; see [Wiring](#wiring). The wiring is tested
with TEST fixtures only and has not been verified against the live service.

| File | Role |
|---|---|
| `spec.ts` | zod schema → TS types + strict validator + semantic rules; batch parsing (`extractJsonObject`, `salvageTruncatedBatch`, `validateActivityBatch`) |
| `schema.ts` | JSON Schema exports: standard draft 2020-12, plus an OpenAI strict-mode variant for a future `response_format` |
| `text.ts` | Rich-text grammar (`plain text with $TeX$`), TeX/markup/link safety, KaTeX rendering |
| `expr.ts` | Safe expression parser/evaluator. It never calls `eval` or `Function`, and its length, depth and value range are bounded |
| `grade.ts` | Pure deterministic grader → `{correct, normalized, misconceptionTag?, invalid?}` |
| `learnerState.ts` | Builds the compact learner summary the model receives. Also defines `ActivityAttemptRecord` and `specHash` |
| `prompt.ts` | Batch prompt: rules + compact grammar + 2 format examples + learner summary + standards window |
| `render/` | `<ActivityView>` plus pure-SVG/HTML figure renderers and response widgets. Import `render/index.ts` to load the CSS |
| `fixtures/` | 43 hand-authored **test fixtures** covering K–8, all 15 figure types and all 8 response types. They are not AI output |
| `gallery/` + `scripts/gallery.mjs` | Dev-only visual gallery: `npm run gallery [-- ids…] [--states]` → `.gallery/index.html` |

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
   unescaped-currency trap (`$3 and $5`). `renderTex` applies the same denylist again at
   render time.
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
   batch is kept. Code fences and surrounding chatter are tolerated. A truncated reply keeps
   its complete activities.
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

## Wiring

When the learner is signed in and AI is ready, this module drives learning. Local practice is
the fallback, and signed-out practice is unchanged.

| File | Role |
|---|---|
| `application/aiQueue.ts` | Prefetch policy and queue ownership (no dependencies, in the startup bundle): `shouldPrefetch`, `mergeBatch`, `takeNext`, `pruneQueue`, plus `AiQueueBox`, `presentFromQueue` and `deliverBatch`, which keep a background batch delivery and the foreground consistent across awaits |
| `application/aiActivities.ts` | Lazy runtime: `buildBatchRequest` (ledger → learner summary → prompt), `parseBatch`, `gradeSpecAttempt`, and the restore verifier `specRestorer` |
| `ui/Studio.tsx` (`spec` prop) | The focus stage renders the spec with a lazily loaded `<ActivityView compact>`. Hints and the worked explanation come from the spec through `onSupport` (each one counts as assistance before the answer). The dispute flag and curiosity work as for local tasks |

1. **Call.** One paid call asks for a batch of 4 activities (`BATCH_SIZE`; the prompt allows
   3–5). It goes through `Free2zTutor.reply` with the resume context
   `{kind:'activities', profileId, allowedSkillIds}` and an output budget of `'2600'`. The usage
   journal is version 2: each operation records its budget (`'1800'` or `'2600'`). Version 1
   journals, which pin 1800, stay readable and recoverable, and are rewritten as version 2 on
   their first write. The estimate and cap check still run before every send.
   `max_output_tokens_strict` and `response_format` are not sent yet.
2. **Validate.** A fresh reply and a same-key recovered reply both go through
   `parseBatch(text, allowedSkillIds, operationId)`, which calls `validateActivityBatch`.
   Rejected activities are logged as model-quality telemetry (`ai-batch` in diagnostics). A
   reply cut off by the output budget (`finish_reason` of `length`) is still delivered for this
   context only, and its complete activities are kept. If a reply yields no valid activity, it
   counts as an AI failure: the backoff applies and local practice continues. A receipt-only
   replay is never treated as content.
3. **Queue.** Activity ids are `${operationId}:${index}`. Accepted activities are added to the
   queue, the queue is saved in the presentation session (`aiQueue`; the activity on screen is
   saved as `aiActivity`), and only then is the reply acknowledged. A restart between those steps
   delivers the same batch again; `mergeBatch` drops the duplicates, so nothing is bought or
   queued twice. If the acknowledgement fails, the reply stays saved and new paid calls stay
   blocked until a later delivery acknowledges it. A delivery re-checks the account, provider and
   learner after every await. If any of them changed, it touches nothing and leaves the reply
   saved for its own learner. A failed queue save removes only that delivery's additions. A
   duplicate delivery waits for the first one's save. Ids use each activity's position in the
   model's batch, so a stricter validator cannot shift them.
4. **Prefetch.** When at most `PREFETCH_AT` (1) activity remains, a single background request
   fetches the next batch while the learner works. It is skipped during the fallback backoff or
   a Retry-After window. A Continue with an empty queue waits for an in-flight prefetch. If
   that fails too, it makes one foreground request, and if that fails, it serves local practice.
5. **Record.** `gradeSpecAttempt` grades the answer locally. Unreadable input (`invalid`) asks
   again and records nothing. Otherwise `recordSpecAttempt` appends `source:'ai-spec'` evidence
   containing the spec hash, skillIds, difficulty, response type, the learner's structured
   response, the misconception tag, hints used, active time, and the exact spec content. The
   displayed spec is also stored as the activity record, so disputes can refer to it.
6. **Mastery (decided).** Validated AI activities are real evidence for every skill they tag,
   under the same rules as local tasks. An answer is independent when it is correct and no hint
   was used. Three distinct independent successes since the last error make a skill provisional.
   An independent success after the review date counts as the delayed review, and two delayed
   reviews make it retained. This makes guided-only standards reachable. Optional timed fluency
   still requires local recall items, which continue as a short interleave every fifth task
   when a skill qualifies. Restore re-validates each stored spec against the curriculum graph,
   checks its hash, and re-grades the stored response; stored correctness is never trusted.
   Disputes quarantine the activity, as for local tasks.
7. **Feedback loop.** `buildLearnerSummary` reads the evidence ledger (local and `ai-spec`
   evidence). It reports the recent streak, the misconception tags, per-skill `missStreak` (for
   #860) and suggested difficulty. It includes no names, ids or timestamps finer than a day.

### Known limits (v1)

- **Expression equivalence is numeric.** `expression` answers are checked by evaluating both
  expressions at seeded sample points within the domain. Algebraic identities that differ only
  outside the sampled domain, or at removable singularities, can be graded as equivalent. Form
  rules (`expanded` and `simplified`) are structural checks on monomials, not a CAS. Only
  single-letter variables and the fixed function set are supported.
- **Money is US currency only.** Other currencies need new figure kinds.
- **Evidence size.** Each `ai-spec` attempt stores the full spec (usually 1–3 kB, at most 24k
  characters), well within the native 512 kB record limit.
