# Activity Spec v2 (`src/activity/v2/`)

The model writes one model of the math. The app derives everything else from it: the numbers in
the text, the figures, the answer key, the options, the alt text and the speech.

Status: **design approved; implementation in progress** (see [Plan and status](#15-plan-and-status)).
Nothing in v2 is wired into the live controller. v1 (`../README.md`) stays the production path, and
its validator and grader stay forever so stored `ai-spec` evidence can be restored.

This document is the RFC as accepted, refined where mapping it onto the v1 code showed a sharper
choice. Every departure from the draft is listed in [Changes from the RFC draft](#17-changes-from-the-rfc-draft).

---

## 1. Problem

v1 asks the model to write the same mathematics **five times, independently**:

1. the numbers in the prose
2. the figure data
3. the key and its `keyCheck`
4. the option strings
5. the alt text, plus any figure-kind words in the prose ("this rectangle")

Nothing binds these copies, and the app checks shape, not meaning. All four live gpt-4o failures
(Free2Z, strict `json_schema` structured output) were schema-valid:

| # | Live failure | Class | Root mechanism |
|---|---|---|---|
| 1 | "3 groups of 4 apples", key `3*4`, picture of 2 groups of 4, alt "Two groups" | structure | text, figure, key and alt restate the numbers independently |
| 2 | "Which section of the rectangle is 1/4?" over a pie of 4 equal slices, one keyed | kind + ill-posed | the prose names a shape the figure never declares, and correctness is *asserted per region* instead of *evaluated from meaning* |
| 3 | "Square units in this rectangle" drawn as a pie (Square = 25, Unused = 0.5) | representation bending | the figure vocabulary is chart types with no area representation, so the model bent a chart |
| 4 | "What is the area of the rectangle in square units?" over a bare 4 × 5 polygon with no labels and no unit squares | insufficient information | nothing ties what a view reveals to what the ask needs |

Other classes seen in spec-eval and on the lint branch: answer *leaks* (a label, the alt or the
prose states the answer), *option equivalence* (0.5 marked wrong beside 1/2), *chart/total*
mismatches, and *arithmetic slips* in keys (judge correct-key on Haiku: 84–92%).

**Why not patch v1.** The heuristic lint (`origin/add-aha-semantic-checks` @c3d54869c) is the
evidence. It caught 95.6% of synthetic contradictions and ran 26.6k fuzzed plus 2,429 real cached
activities without a crash, yet its own review concluded that guessing intent from prose is
unreliable: shape words collide with story words ("square root", "apples on the table"),
equal-value detection rejects valid items ("tap the group that shows 7 − 2"), value-versus-text
comparison misses leaks (3/4 vs 0.75, U+2212, "6 inches"), and every guard spawned another guard.
What a region means depends on what the question means, and only a **declared model** knows that.

**Variety is the same problem one level up.** On `origin/add-aha-variety-grid` @57cc5c618,
novelty rules cut figure-type reuse from 28% to 7% and question-form reuse from 89% to 66%, but
level fit fell from 90% to 77%: the model invented off-level representations (a coordinate plane
for K counting). The representation space was unconstrained per skill, so novelty competed with
pedagogy.

## 2. Principles

1. **One statement of the math.** Text numbers, figures, key, options, alt, speech, hints and the
   worked explanation are all functions of one declared model.
2. **The app computes; the model chooses.** The model owns the situation, the story, the nouns, the
   choice of representation, the choice of ask and the difficulty. The app owns arithmetic,
   drawing, description and grading.
3. **Inexpressible first, detectable second, judged third.** Inexpressible comes from the strict
   schema and the per-band catalog; detectable from deterministic invariants; judged from an
   optional verifier and the offline judge.
4. **Semantic intents, not chart types.** Each intent declares its legal views. A pie cannot depict
   area because `rect_area` has no chart view.
5. **One registry entry per intent** generates its schema fragment, prompt catalog line, role
   types, measures, invariants, views (lowering, reveals, regions, accepted response forms) and
   description. This extends the single-source pattern of #891.
6. **No natural-language understanding of prose.** v2 never reads meaning back out of English.
   Prose rules are closed lists only ("no numerals outside placeholders").
7. **Each fact has one binding site.** A quantity bound to a structure role is named in prose
   *through the role* (`{{s.groups}}`), so the prose and the figure cannot disagree about which
   number is which.
8. **Variety operates inside the skill's representation set.**
9. **Field order is reasoning order.** Wire keys are single lowercase words whose alphabetical
   order *is* the authoring order; a test pins it at every level.
10. **Never repair model output.** Invalid activities are dropped; prefetch refills.

## 3. Wire data model

The model emits a batch. The app stamps `version` and `id`; the model never writes either.

```ts
interface Batch { activities: Activity[] }          // 1–5
interface Activity {                                  // keys: alphabetical = authoring order
  aim: { skills: SkillId[]; theme: Theme; why: string };   // 1–3 skills; closed theme list; why ≤160
  level: Int;                                         // 1–10, relative to the first skill
  model: { quantities: Quantity[]; structures: Structure[] };   // 1–8 quantities, 1–2 structures
  prompt: Block[];                                    // 1–8
  response: Response;
  support: { explanation: Templ; hints: Templ[] };    // 0–3 hints
}
interface Quantity {
  id: Id;                                             // ^[a-z][a-z0-9]{0,7}$, shared namespace with structures
  kind: 'count' | 'number' | 'fraction' | 'length' | 'area';   // first slice; later money, time, …
  noun: { icon: string | null; one: string; other: string } | null;   // counts name what they count
  unit: Unit | null;                                  // closed registry; required for length/area
  value: string;                                      // exact literal ("12", "2.5", "3/4") or an
}                                                     // exact expression over other ids ("t/g")
type Block = { text: Templ; type: 'text' } | { tex: Templ; type: 'math' } | { of: Id; type: 'view' };
type Response =                                       // one variant per form; fields only where they mean something
  | { ask: Expr; distractors: Distractor[]; form: 'number' }
  | { ask: Expr; distractors: Distractor[]; exactness: 'any' | 'simplest' | 'exact'; form: 'fraction' }
  | { ask: Expr; candidates: Expr[] | null; distractors: Distractor[]; form: 'choose' }
  | { ask: Expr; candidates: Expr[]; form: 'select' }
  | { candidates: Expr[]; direction: 'ascending' | 'descending'; form: 'order' }
  | { ask: Expr; form: 'tap' | 'shade' | 'place'; on: Id };
interface Distractor { expr: Expr; tag: Tag }        // a misconception RULE, evaluated by the app
```

The first-slice structures (each one registry entry, §5):

```ts
interface EqualGroups { groups: Id; id: Id; kind: 'equal_groups'; show: 'objects' | 'jumps' | null; size: Id }
interface ArrayS      { cols: Id; id: Id; kind: 'array'; rows: Id; show: 'dots' | 'objects' | null }
interface RectArea    { id: Id; kind: 'rect_area'; rects: { h: Id; w: Id }[]; show: 'unit_squares' | 'labeled' | null }
interface Fraction    { id: Id; kind: 'fraction'; parts: Id; selected: Id | null;
                        show: 'rect' | 'circle' | 'strip' | 'set' | 'line' | null; wholes: Id | null }
```

- **Values are exact rationals** (`learning/rational.ts`), converted to floats only at draw time.
  A literal keeps its written form for display (`2/4` stays `2/4`); arithmetic never depends on it.
- **`value` is one field.** A literal is an expression with no references, so a given (`"3"`) and a
  derived quantity (`"t/g"`) share one grammar: numbers, ids, `id.measure`, `+ − × ÷`, parentheses,
  `min`, `max`. A quantity whose value references other ids is *derived*.
- **Roles are typed.** Each structure role binds a quantity id with a kind signature: `groups`,
  `size`, `rows`, `cols`, `parts`, `selected` and `wholes` are counts; `rect_area` widths and heights
  are lengths in one unit. Expressions are dimension-checked: `area ÷ length` is a length,
  `length + area` is rejected, and no unit conversion exists in the first slice.
- **`show: null`** keeps a structure as a computational model with no figure (a division story told
  in words). A structure with a view must be shown by exactly one `view` block, and a `view` block
  needs a structure with a view.
- **`level` sits beside `aim`**, not inside it, so `aim` can read skills → theme → why.
- **Themes are a closed list** (orchard, kitchen, garden, ocean, space, sport, art, music, travel,
  building, market, school, weather, animals, games, library, park, farm, camping, science, …), so
  variety is tracked from declared fields, never from prose.
- **Strict-mode JSON:** every key is present, unused nullable fields are `null`, and
  `additionalProperties` is false everywhere (§9).

## 4. Semantic-intent catalog (K–8)

Each row is a structure. "Views" lists its legal representations and the existing v1 renderer each
lowers to, or NEW.

| Intent | Roles | Askable measures | Views → renderer | Grades |
|---|---|---|---|---|
| `collection` | items[{count, noun}] | total, count_i, more/fewer | objects (row, scattered, ten frame) → picture; tally NEW | K–1 |
| `change` | start, delta, dir (join/separate) | result, start, delta | objects (crossed out) → picture; jumps → number_line; tape NEW | K–2 |
| `part_whole` | parts[], whole | whole, missing part | objects → picture; tape NEW; number bond NEW | K–3 |
| `compare` | a, b, mode (additive/times) | difference, factor, which | tape (two bars) NEW; matched objects → picture | 1–4 |
| **`equal_groups`** | groups, size | total | objects → picture (`repeat`); jumps → number_line; tape NEW (later) | 2–4 |
| **`array`** | rows, cols | total | dots → array_grid; objects → array_grid icons | 2–4 |
| **`rect_area`** | rects[{w, h}] (rectilinear composite, bottom-aligned) | area, perimeter | unit_squares → geometry graph paper + `unitSquares`; labeled → geometry with dimension labels | 2–7 |
| **`fraction`** | parts, selected, wholes | fraction, complement, unit | rect/circle/strip → fraction_model; set → picture; line → number_line | 1–5 |
| `number_line` | points[{value, label}], jumps | value at label, distance | number_line; vertical (thermometer) NEW | 2–7 |
| `place_value` | number | digit value, rounded, expanded | blocks → place_value_blocks; chart NEW; disks NEW | 1–5 |
| `money` | items[{denomination, count}], currency | total, change due | coins_bills → money | 2, 4 |
| `time` | time or interval | reading, elapsed, end time | analog → clock; digital; timeline NEW | 1–3 |
| `measure` | object span, unit, tool | reading, difference | ruler → ruler; scale/beaker NEW | 1–4 |
| `shape` | class, dims or coordinates | perimeter, area, volume, angles, … | drawing → geometry; net NEW; solid NEW | K–8 |
| `angle` | measures[], relation | measure, missing angle | drawn → geometry; protractor NEW | 4–7 |
| `plane` | points, segments, polygon, line | coords, distance, slope, f(x) | grid → coordinate_plane | 5–8 |
| `dataset` | type, values, unit | count, total, diff, mean, median, … | pictograph → picture; bar → bar_chart; dot_plot/histogram/box NEW; scatter → scatter_plot; line → line_chart; circle → pie_chart only for parts of a whole, grade 6+; table → data_table | 1–8 |
| `ratio` | a, b, scale | unit rate, scaled term, percent | tape NEW; ratio_table NEW; double number line NEW; plane | 6–7 |
| `equation` | expression or equation | solution, value, equivalent form | math (TeX from the tree); balance NEW; tape NEW | 6–8 |
| `chance` | outcomes[{label, weight}], trials | P(event), expected count | spinner (the only legitimate wedge figure) → pie renderer; bag → picture | 7 |
| `computation` | op, operands | result, partial products, remainder | column NEW; area_model NEW; math | 2–6 |
| `relation` | derived quantities only | any | text only, no figure | all |

**Bold** rows are the first slice. The renderer, not the model, owns layout and scale: icon size,
graph paper versus a labeled drawing, number-line range and ticks, and the grade-appropriate name
of each view. The model never writes coordinates, except where coordinates *are* the math (`plane`,
and `shape` given by vertices).

## 5. The registry

One file per intent under `v2/structures/`. Everything the app knows about an intent lives there,
and every other layer reads it.

```ts
interface StructureDef<S> {
  kind: string;
  grades: GradeRange;
  roles: Record<string, RoleType>;                    // kind signature (+ unit agreement) per role
  measures: Record<string, MeasureDef<S>>;            // askable derived quantities, with their inputs
  invariants(s: Bound<S>, grade: Grade): Problem[];   // magnitudes, divisibility, render caps
  views: Record<Show, {
    grades: GradeRange;
    noun: string;                                     // what {{s.view}} says: "rectangle", "number line"
    accepts: ResponseForm[];                          // which on-view forms (tap/shade/place) it hosts
    reveals(s: Bound<S>, ask: AskTarget): Record<string, 'shown' | 'countable' | 'hidden'>;
    regions?(s: Bound<S>): { id: string; value: Value; label: string }[];
    lower(s: Bound<S>, ctx: LowerCtx): DrawFigure;    // app-internal drawing IR (§5.1)
    describe(s: Bound<S>, hide: Hide): { full: string; brief: string };
  }>;
  wire: ZodObject;                                    // → strict schema fragment, filtered per band
  catalog: string;                                    // the model-facing catalog line
}
```

### 5.1 The drawing IR

v1's fifteen figure renderers stay. They become the **app-authored drawing IR** that `lower()`
targets: a good drawing vocabulary, but the wrong authoring vocabulary. The IR is the v1 `Figure`
union plus app-only fields that the v1 *wire* schema never gains:

- `geometry.grid: {unit}` draws graph paper; a polygon's `unitSquares` tiles it with unit squares
  (ported from `add-aha-variety-grid`).
- `picture` groups take `repeat` (one group drawn n times, so equal groups are stated once) and
  `shaded` (the first n icons of a set highlighted).
- Interactions add `shade` (tap parts of a fraction model) and `place` (put a point on a number
  line) to v1's `tap` and `plot`.

Every lowered figure must still satisfy v1's figure invariants once the IR-only fields are
removed; a test holds every gold spec to that.

## 6. Placeholder text

**Syntax.** Mustache-style `{{path}}`, chosen because models know it and it does not clash with
TeX braces; inside math, `{{` is always a placeholder. A path is an id followed by at most two
member names.

| Placeholder | Renders |
|---|---|
| `{{q}}`, `{{s.groups}}`, `{{s.total}}` | the value with its noun or unit: "4 apples", "6 cm", "20 square units", a TeX fraction |
| `….n` | the number only |
| `….noun` | the noun inflected for the value ("apple" / "apples") |
| `….one`, `….other` | the singular or plural noun regardless of value |
| `….word` | the number in words (K–1) |
| `….unit` | the unit name inflected for the value |
| `{{s.view}}` | the view's kind noun: "rectangle", "circle", "number line" |

- `{{q}}` names a free or derived quantity. A quantity bound to a structure role is named through
  the role (`{{s.groups}}`, `{{s.size.noun}}`), never by its own id: the binding is stated once, in
  the structure, so a prose sentence cannot narrate "3 baskets of 4" over a structure bound the other
  way round (principle 7).
- **Locale.** `Intl.NumberFormat` handles grouping and the decimal separator. `Intl.PluralRules`
  picks between the model's `one` and `other` forms; locales with more plural categories add
  nullable `few`/`many` forms later. Unit names come from the app's unit registry.

**Closed-list prose rules (not NLU).** They apply to every learner-visible string: text and math
blocks, hints, the explanation and noun forms.

- **Numeral firewall:** no numerals of any script outside placeholders (Unicode `\p{N}`, which also
  covers ½, ² and Ⅻ).
- **No number words** of two or more, from a per-locale list ("two", "dozen", "twice", "half",
  "quarter", "fourth", …). "one" and "a" stay legal as articles and pronouns.
- **No view-kind words** ("rectangle", "circle", "number line", "bar graph", "pie", "array", …)
  outside `{{s.view}}`. "square" stays legal because it is also a unit word.
- **The answer is never named.** In the prompt and hints, a placeholder for the ask target renders
  as the unknown, □, inside math, and is rejected in text. The explanation may name it.

**Alt text and speech** come from `describe()`; the model writes none (§8.4).

## 7. The reveal rule

A view must reveal what the ask needs, and must not reveal the answer.

Every view declares, for each role and measure of its structure, what the learner can learn from
it: `shown` (printed, e.g. a dimension label), `countable` (drawn as countable units: objects, unit
squares, equal parts, ticks) or `hidden`. Reveals may depend on the ask: a `labeled` rectangle
prints every side except the one asked for, which shows "?".

A reference is **knowable** when it is shown by the prose (an unmasked placeholder in the prompt),
shown or countable in a view that the prompt includes, or computable from knowable references (a
measure from its inputs, a derived quantity from its expression).

- **Answer forms** (`number`, `fraction`, `choose`): every reference in the ask must be knowable,
  and the ask itself must not be shown. A measure that is `countable` in a view is fine (counting is
  a legitimate strategy); one that is `shown` is a leak.
- **Act forms** (`tap`, `shade`, `place`, `select`, `order`): the target *is* the instruction, so it
  must be shown in the prose ("Shade {{u}} of the {{f.view}}"), and the hosting view must not
  already mark the answer (a `shade` target over a fraction that already shows selected parts, a
  `place` target already marked).

Live 4 fails this rule: a `rect_area` area ask needs `w` and `h`, the bare polygon of the live
reply corresponds to no legal view, and with `show: null` and no dimensions in the prose neither
input is knowable.

## 8. Key, grading, uniqueness, distractors

### 8.1 The key

The key is the value of `ask`, computed by the app. The response form must fit the value: `number`
takes an integer or a terminating decimal, `fraction` a rational, and `shade`/`place` a value that
lands on a part or tick of the hosting view. Units come from the quantities. Grading compiles to v1
`ResponseSpec` and reuses `grade.ts`; `shade` and `place` are added to the app-internal grading IR
(never to the v1 wire schema).

An answer-form ask must be **computed**: a measure, a derived quantity, or a role quantity that a
view makes countable. A literal given that nothing determines would be a key asserted by the model,
and is rejected.

**Leaks are referential, not textual.** The prompt may not state the ask, nor a quantity of the
same kind, the same noun or unit, and the same exact value as the key ("12 apples" in the prose
when the answer is 12 apples). A coincidentally equal number of another kind ("4 groups of 4") is
not a leak.

### 8.2 Distractors are rules, not values

`{expr: "g+n", tag: "added_instead"}`. The app evaluates each rule, drops any whose value equals
the key (so 0.5 ≡ 1/2 by construction), dedupes by value, formats every option identically, and
requires at least two options for `choose`. For typed answers the same rules map a learner's answer
to a misconception tag. Tags come from a curated per-domain list so learner-state counts do not
fragment.

### 8.3 Uniqueness is computed, not asserted

| Form | Rule |
|---|---|
| `choose` | options = candidates, or the key plus the surviving distractors; exactly one equals the key |
| `select` | each candidate is correct iff its value equals the target; at least one correct and one not |
| `order` | the app sorts the candidates by value; ties are rejected |
| `tap` | regions come from the view's `regions()`; the correct set is the regions whose value equals the target; exactly one is required, ties are rejected |
| `shade` | graded by the shaded value, so any 1 of 4 parts is ¼; the target times the parts must be whole and fit |
| `place` | the target must land on a tick of the hosting view |

The catalog teaches `shade` for "show ¼". A `tap` over equal parts can never pass: L1 computes four
regions of value ¼ and rejects the activity as ill-posed (live 2).

### 8.4 Description

`describe(s, hide)` writes the alt text and speech for each view from its bound structure. It
returns `full` (every value the learner needs) and `brief`. `brief` is used whenever `full` would
state the answer; it turns countable values into countable words ("basket: apple, apple, apple,
apple; …") so a learner using a screen reader can still count. This ports the `figureAlt` idea
from the lint branch, without reading any prose.

### 8.5 Verification level

| Level | When |
|---|---|
| `computed` | the ask is a measure, or a role quantity a view makes countable |
| `derived` | the ask is a model-written expression or a derived quantity (the honest analogue of v1's `keyCheck`) |

## 9. Strict-mode JSON schema

- **Derivation.** The schema is derived from the registry's zod definitions through v1's
  `strictMode` (#891): every key required, optional fields nullable, `additionalProperties:false`,
  `anyOf` only below the root, no reliance on length or pattern keywords (the validator enforces
  those). Each structure's `show` enum lives in its own variant, so legal views are enforced per
  intent at decode time.
- **Size.** Target **≤ 20 KiB per band** (Free2Z's limit is 32 KiB; v1 is 28.6 KB). A test enforces
  it.
- **Bands.** Each request ships only the structures and views allowed for its grade band, as three
  cached variants: K–2, 3–5 and 6–8. Off-band intents are inexpressible, which rules out the
  coordinate plane for K counting. Bands, not per-request windows, keep schema compile caching alive
  within the 6 s `BATCH_WAIT_MS`. No `$ref`; everything is inlined.
- **Key order (zuu#1132).** The gateway sorts properties by name and the model generates them in
  that order. v2's keys are **single lowercase words** whose alphabetical order is the authoring
  order at every level: `aim < level < model < prompt < response < support`; `skills < theme < why`;
  `quantities < structures`; `id < kind < noun < unit < value` (the model types and names a
  quantity before it writes the number); `explanation < hints`. Single lowercase words sort the same
  under byte order and every collation, so the order is invariant whether or not, and however, the
  gateway sorts. A test pins it, including nested objects. The envelope is `{activities}`; v1's
  `rationale` is replaced by each activity's `aim.why`. `json_schema.name` is
  `aha_activity_batch_v2`.

## 10. Prompting

**System prompt, in order:**

1. **Contract:** "You author the situation; the app computes answers, draws and describes."
2. **Pedagogy rules**, kept from v1: skill choice, difficulty, misconceptions, language by grade.
3. **Authoring order**, mirroring the key order.
4. **The band's intent catalog**, generated from the registry's `catalog` lines: roles, measures,
   views, the response forms each view hosts, and "use when".
5. **Placeholder grammar** and the closed-list prose rules.
6. **Three gold few-shots** retrieved to match the window's intents, contexts rotated, with
   "never reuse their context".
7. **A self-check.**

**User message:** `LEARNER` (including `recentContent`) and `STANDARDS`, each skill with its
**representation set** and magnitude bounds, e.g.
`3.NF.A.1 fraction{rect,circle,strip,set} ask{fraction,complement} parts≤8`.

**Representation map** (`representations.ts`): per-skill data listing the allowed intents × views ×
response forms, magnitude bands and an anchor view (3.NF.A.2 → line). A strong model drafts it from
CCSS and the progressions, the pedagogy lead reviews it, and the validator enforces it.

**Variety.** `recentContent` (a port of `variety.ts`) is rebuilt from **declared** fields: skill,
intent, view, response form, theme and nouns with a bundled icon. The regex theme and question-form
detectors go away. Repetition is legitimate only for `dueReviews` and `fluency`.

## 11. Validation layers

| Layer | Checks | Cost |
|---|---|---|
| L0 Schema | strict decode; size and depth budget; text and TeX safety (v1 `text.ts`) | free |
| L1 Model | literals and expressions parse; references resolve; role kinds and units typecheck; dimensions agree; magnitudes fit the grade; the skill allows this intent, view and form; measures and ask are computable; the answer fits the form; placeholders resolve; numeral, number-word, view-word and leak rules; distractors distinct by value; uniqueness for choose/select/order/tap/shade/place; the **reveal rule** | free |
| L2 Render | pure `lower()`: v1 figure invariants on the IR, ≤100 icons, ≤40 ticks, labels fit at 320 px | free |
| L3 Verifier (optional) | a second call sees the *resolved* activity (text, description, options, key) and gives binary verdicts on whether the prose fits the ask and on child-appropriateness | ≈25–30% of an authoring call on the same model; ≈3% on a mini tier |

Every rejection is a `Problem {layer, code, path, message}` with a stable `code`, so acceptance can
be reported per layer with a histogram of reasons. The residual risk is prose whose question does
not match the ask ("how many are left?" bound to `total`); that is exactly what L3 and the judge
focus on. Run L3 only for weak-tier models and evals, and decide from the measured residual.

## 12. Evaluation

### 12.1 Gold set (CI, deterministic)

Hand-authored v2 activities covering every (intent, view, response form) cell of the slice, the
four live failures expressed correctly, and `fixtures/inconsistent.ts` (lint branch) translated to
v2. Each must validate in its band, lower and render in the gallery, compute its key equal to the
hand key, and render its prompt text exactly as recorded.

**File format.** `v2/gold/{k2,g35,g68}.ts`, re-exported as `gold` from `v2/gold/index.ts`. Gold
specs are TypeScript so the wire type checks them, and they double as the prompt's few-shot pool.

```ts
export interface GoldSpec {
  /** Stable kebab-case id: `<grade>-<intent>-<slug>`, e.g. "g3-equal-groups-orchard". */
  id: string;
  /** What this spec demonstrates, for reviewers and the gallery. */
  note: string;
  /** Set when this spec is one of the live failures, expressed correctly. */
  fixes?: 'live-1' | 'live-2' | 'live-3' | 'live-4';
  /** Exactly the strict wire instance a model would emit: every key present, null where unused. */
  activity: WireActivity;
  expect: {
    /** The hand-computed key: an exact literal ("12", "1/4"), "region:<id>" or "order:<i,j,…>". */
    key: string;
    /** Learner-visible text of each text block after rendering, in order. */
    prompt: string[];
    /** Optional: the alt text the first view must carry. */
    alt?: string;
  };
}
```

Coverage (intent, view, response form, grade) is derived from `activity`, never restated.

### 12.2 Mutation corpus (CI, deterministic)

`v2/gold/mutations.ts` defines mutation classes. Each class is a generator that turns a gold spec
into zero or more mutants that are *defective by construction*; a class never emits a mutant that is
merely different (swapping a rectangle's width and height is not a defect, so no class does it).

```ts
export interface MutationClass {
  id: 'swap_role' | 'wrong_measure' | 'equal_region_tap' | 'off_band_view' | 'numeral_in_prose'
    | 'hidden_dimensions' | 'named_answer' | 'view_word' | 'unbound_view' | 'kind_mismatch';
  /** Defective variants of one gold activity (empty when the class does not apply). */
  mutate(activity: WireActivity, spec: GoldSpec): { why: string; activity: unknown }[];
}
```

The corpus must be rejected at **≥ 99%**, reported per class and per layer.

### 12.3 Offline eval and the go/no-go

spec-eval v2 runs the Haiku stand-in and the codex ceiling, single batches and `--sequence`. The
**judge sees the resolved render**: a screenshot of the focus stage plus the learner-visible text,
not raw JSON. The go/no-go compares v2 with v1 on grades 2–4 skills that use the slice intents and
reports acceptance per layer, judge correct-key, level fit and figure-helps, defects per 100
activities, and tokens.

### 12.4 Live matrix and ship bar (later, on Free2Z)

Every listed model with `structured_output`, × structured or prompt-only, × band, × 45 learner
states, in 5-batch sequences.

| Metric | Bar |
|---|---|
| Accepted | ≥ 90% |
| Judge correct-key | ≥ 98% |
| Figure contradictions | 0 (by construction, verified) |
| Figure-helps | ≥ 90% |
| Level fit | ≥ v1 baseline − 2 points |
| Question-form reuse | ≤ 50% |
| Context reuse | ≤ 15% |
| Cost per accepted activity | ≤ v1 + 15% |

A human also reviews 50 random contact-sheet items.

## 13. The live failures in v2

**Live 1: equal groups.** The text, picture, key and alt are computed from one structure. The prose
names the groups and their size through the structure's roles, so it cannot say 3 while the
picture draws 2, nor narrate the roles the other way round.

```json
{"aim":{"skills":["3.OA.A.1"],"theme":"orchard","why":"Frontier skill; start with a countable picture."},
 "level":3,
 "model":{"quantities":[
   {"id":"g","kind":"count","noun":{"icon":"basket","one":"basket","other":"baskets"},"unit":null,"value":"3"},
   {"id":"n","kind":"count","noun":{"icon":"apple","one":"apple","other":"apples"},"unit":null,"value":"4"}],
  "structures":[{"groups":"g","id":"s","kind":"equal_groups","show":"objects","size":"n"}]},
 "prompt":[{"text":"Ana fills {{s.groups}} with {{s.size}} each.","type":"text"},{"of":"s","type":"view"},
           {"text":"How many {{s.total.other}} are there in all?","type":"text"}],
 "response":{"ask":"s.total","distractors":[{"expr":"g+n","tag":"added_instead"}],"form":"number"},
 "support":{"explanation":"{{s.groups.n}} groups of {{s.size.n}} make {{s.total}}.",
            "hints":["How many {{s.size.other}} are in each {{s.groups.one}}?"]}}
```

The text reads "Ana fills 3 baskets with 4 apples each." The picture is 3 groups of 4 apples, the
alt is "3 baskets with 4 apples in each", the key is 12 (computed) and the answer dock says
"apples".

**Live 2: a quarter of a rectangle.**

```json
"model":{"quantities":[{"id":"p","kind":"count","noun":null,"unit":null,"value":"4"},
                       {"id":"u","kind":"fraction","noun":null,"unit":null,"value":"1/4"}],
 "structures":[{"id":"f","kind":"fraction","parts":"p","selected":null,"show":"rect","wholes":null}]},
"prompt":[{"text":"Shade {{u}} of the {{f.view}}.","type":"text"},{"of":"f","type":"view"}],
"response":{"ask":"u","form":"shade","on":"f"}
```

"rectangle" comes from the view, which draws that same rectangle; a circle needs `show:"circle"`
and then the text says "circle". Writing "rectangle" in the prose is rejected by the view-word
rule. Had the model chosen `form:"tap"`, L1 computes four regions of value ¼ and rejects the
activity as ill-posed.

**Live 3: square units.** A pie is inexpressible at decode time: `rect_area` has no chart view.

```json
"model":{"quantities":[{"id":"w","kind":"length","noun":null,"unit":"unit","value":"5"},
                       {"id":"h","kind":"length","noun":null,"unit":"unit","value":"5"}],
 "structures":[{"id":"r","kind":"rect_area","rects":[{"h":"h","w":"w"}],"show":"unit_squares"}]},
"prompt":[{"text":"How many square units cover this {{r.view}}?","type":"text"},{"of":"r","type":"view"}],
"response":{"ask":"r.area","distractors":[{"expr":"2*(w+h)","tag":"perimeter_for_area"}],"form":"number"}
```

The figure is graph paper with the rectangle tiled in unit squares (ported from the variety
branch), with the legend "each square is 1 square unit". The key is 25 square units, computed.

**Live 4: area with no information.** `show:"labeled"` prints both sides; `show:"unit_squares"`
makes the area countable. The bare polygon of the live reply corresponds to no legal view, and the
remaining expressible version of it, `show:null` with no dimensions in the prose, is rejected by
the reveal rule: `r.area` needs `w` and `h`, and neither is knowable.

## 14. Migration

- New code lives in `src/activity/v2/`. **v1's validator and grader stay forever** to restore
  stored `ai-spec` evidence. Stored specs are never converted.
- **Evidence.** `SpecAttemptData.content.version` dispatches verification and grading. Evidence also
  records the verification level and `validatorVersion`.
- **Restore** re-checks shape, safety and grading only, never newer invariants: a rule change must
  not drop activities already queued or answered (the lint lesson).
- **Journal.** The `activities` resume context gains `specVersion`. A pending v1 operation recovers
  with its identical v1 body and is parsed by v1.
- **Queue.** Queued v1 items render through v1 until consumed; `mergeBatch` is unchanged.
- **Rendering.** The v1 renderers become the lowering target, and `ActivityView` takes a *resolved*
  spec (v1 specs are resolved specs already). The NEW renderers of §4 are additive.
- **Local fallback** is unchanged. Later, `learning/tasks.ts` can emit v2 models, giving one
  renderer for local and AI practice.
- **Rollout.** A per-batch flag; v2 becomes the default only after the §12.4 bar.

## 15. Plan and status

| # | PR | Status |
|---|---|---|
| 1 | This document; the gold-spec format | this PR |
| 2 | `quantity.ts` (exact literals and expressions on `rational.ts`, kinds, units with dimensions, Intl formatting) and `text.ts` (placeholders, plurals, numeral, number-word, view-word and masking rules) | |
| 3 | Registry, `StructureDef`, strict schema per band (≤ 20 KiB test, key-order test); L0/L1 skeleton; `equal_groups`, `array`, `rect_area`, `fraction` with lowering (ports `repeat`, graph paper, `unitSquares`); the reveal rule | |
| 4 | Responses: ask over measures, distractor rules, computed uniqueness, `shade` and `place`; compile to v1 `ResponseSpec`, reuse `grade.ts` | |
| 5 | `describe()` alt and speech; resolved-spec adapter so `ActivityView` renders v2; gallery entries for every structure × view | |
| 6 | Gold set (≥ 40, K–5) and the mutation corpus (≥ 99% rejection) | |
| 7 | Prompt v2 (generated catalog, retrieved gold few-shots, representation sets) and spec-eval v2 (resolved-render judge). **Go/no-go: v2 vs v1 on grades 2–4** | |
| 8 | Intents: number_line, place_value, money, time, measure | |
| 9 | Intents: dataset (dot plot, histogram, box NEW), plane, shape, angle | |
| 10 | Intents: ratio, equation, chance, computation, relation | |
| 11 | `representations.ts` for all skills, variety v2 from declared fields | |
| 12 | Wiring: journal context, parse/queue/evidence/restore dispatch, flag, telemetry | |
| 13 | Live matrix on Free2Z, verifier experiment, ship decision | |
| 14 | Retire v1 authoring (prompt and schema); keep v1 restore | |

Step 7 is deliberately early: if gpt-4o-class models cannot author abstract models reliably, we
learn it before building nineteen more intents.

## 16. Trade-offs and what we would not do

**Trade-offs.**

- **Expressiveness ceiling.** An activity outside the catalog gets no figure; `relation` keeps
  text-only creativity at the `derived` level.
- **Weak-model risk.** The abstraction may cost acceptance early. The mitigations are the authoring
  order, gold few-shots and band specialization, checked at the step-7 gate.
- **Tokens.** Quantity declarations add tokens; dropping figure data and alt removes some. Expect
  roughly ±20%; measured at step 7.
- **Closed lists cost some prose.** The numeral rule forbids "Room 12" trivia, and the view-word
  rule forbids "sat in a circle". Both are acceptable.

**Would not:** merge the prose lint (keep only its quantity-adapter and `figureAlt` ideas, inside
`describe()`); template the question prose; let the model write alt text, SVG or coordinates that
are not the math; grade with an LLM or make the verifier mandatory; add repair loops; use
per-request skill-window schemas; build a CAS; add a generic "diagram" escape hatch; auto-convert
ill-posed taps into select-all; migrate stored v1 evidence.

## 17. Changes from the RFC draft

Made while mapping the draft onto the v1 code; none changes the approved direction.

1. **`level` is a top-level key** (`aim < level < model < prompt < response < support`) instead of
   `aim.difficulty`, and `aim.form` is dropped: the question form is derived from the response form
   and the view, never stated twice.
2. **All wire keys are single lowercase words**, so the order is identical under every sort the
   gateway might use, and the quantity's keys (`id < kind < noun < unit < value`) make the model
   type and name a quantity before writing its number.
3. **`value` and `expr` merge into one `value`**, because a literal is an expression with no
   references.
4. **`Response` is a union per form**, so `candidates`, `on`, `exactness` and `direction` exist only
   where they mean something (inexpressible first), instead of one object of nullable fields.
5. **Role placeholders** (`{{s.groups}}`): a quantity bound to a role is named through the role, so
   the prose cannot restate the structure's binding independently.
6. **Answer forms and act forms** split the reveal and leak rules: for `shade`, `place`, `tap`,
   `select` and `order` the target is the instruction and must be shown.
7. **Leaks are referential**: the prompt may not state the ask, nor a quantity of the same kind,
   noun or unit and value as the key. Plain value equality would reject "4 × □ = 16".
8. **A view-word closed list** makes live 2's "rectangle" over a circle a rule violation, not just a
   placeholder convention.
9. **The drawing IR is a typed superset of v1 `Figure`**, so graph paper, `unitSquares`, `repeat`,
   set shading and the `shade`/`place` interactions never touch the frozen v1 wire schema.
10. **`fraction.show` names the whole** (`rect`, `circle`, `strip`, `set`, `line`); a separate
    `whole` field would restate it. `array` keeps dots and objects; tiled unit squares belong to
    `rect_area`.
11. **First-slice grades**: `rect_area` starts at grade 2 for `unit_squares` (2.G.A.2 counts the
    squares of a tiled rectangle); `labeled` starts at grade 3.
