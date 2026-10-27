# Mathematics problem-family production

AMP's target is the mathematics standards of all 50 states and DC, their general statewide mathematics assessments and end-of-course exams, and SAT, PSAT/NMSQT, PSAT 10 and PSAT 8/9. AP, IB, ACT, specialized admissions tests and alternate assessments are outside this target. A complete claim requires a dated, component-level source inventory and reviewed evidence for every requirement. Future or unpublished questions cannot be exhaustively inventoried.

## Find and track a gap

Run `npm run coverage:report -- json` for machine-readable evidence or `npm run coverage:report -- markdown` for a checklist. Redirect output to a local artifact when needed. The report joins the runtime registry, curriculum, explicit facet mappings and validated book bindings; it does not search source strings to infer implementation.

The target list records membership, not completed source research. All target inventories remain pending until their official standards, subparts, assessment specifications, scoring rubrics and blueprints have been reconciled. Shared mathematical requirements reuse canonical families; state-specific requirements need explicit additional records. Common Core mappings do not certify state alignment.

A missing facet mapping means the report has no declared assessment evidence for that facet; related content may exist under another skill or in a book. Reconcile before authoring. The initial checklist distinguishes known instruction from adaptive practice and lists acceptance cases. Its entries are open tasks, not machine-verified completion records. Broad skill presence never closes a narrow task.

Choose the next task by assessment importance, prerequisite value, distinct requirements closed, and implementation plus verification effort. Do not count duplicate state mappings or randomized instances as independent value. Claim one coherent issue, use a worktree, and link its PR and review evidence to the task. Follow the repository trunk procedure.

## Author problems before supporting material

1. Read the official source and identify the exact task, requested answer, representations, numeric ranges, restrictions and reasoning demand. Check the complete registry and book instruction for reusable content.
2. Specify representative easy, typical, challenging, transfer and boundary cases. Review these before generating a large family.
3. Implement deterministic generation and server-owned grading. The same mathematical model drives givens, figure, answer and worked steps. Preserve existing generator versions and saved instances.
4. Independently verify by a separate derivation, solver, enumeration or invariant. The author and reviewer are separate workers. Verify grading equivalence, units, domain restrictions, unique choices, exact figures and answer leakage.
5. Add an instance-specific hint naming a given quantity and teaching the first useful step without revealing the answer. Register a method, common-error guidance and principle.
6. Supply a validated lesson or book-page binding before activation. A polished lesson can follow verified problems, but public practice must have instructional support.
7. Run the applicable local gates, independent mathematics checks and rendered checks. Merge through required gates; only then attach the merged revision to evidence.

Verify all generated cases are reachable through the public engine and supported by the client and printable renderer.

## Register a family: new files only

Adding a family adds files; it does not edit a shared registry. The lists in `src/math/engine.ts`, `src/content/lessons.ts`, `problem-methods.ts`, `problem-principles.ts`, `facet-mappings.ts`, `src/curriculum/archetypes.ts`, `template-archetypes.ts`, `connections.ts`, `sat-coverage.ts`, `released-items/index.ts` and the dispatch in `scripts/independent-math-review.py` are frozen legacy entries. Each registry appends family contributions after them in family-id order, so existing template order, generated problems and public payloads never change.

1. `src/math/<id>-practice.ts`: the templates and `generate(templateId, seed)`.
2. `src/content/<id>-lessons.ts`: lessons, methods and principles keyed by template id; facet mappings here or in `<id>-coverage.ts`.
3. `src/families/<id>.ts` exports the descriptor:

   ```ts
   import type { ContentFamily } from "./registry/types";
   export const family = {
     id: "<id>",
     practice: { templates, generate, preserveAlgebra: true },
     lessons, methods, principles, facetMappings, archetypeLinks,
     // optional: archetypes, connections, satTasks, satTaskTemplates, releasedLedgers
   } satisfies ContentFamily;
   ```

   `preserveAlgebra: true` keeps authored strings verbatim; `false` applies the legacy noun/number copy-edit. `satTaskTemplates` appends templates to an existing SAT task; `satTasks` adds rows. A released-item ledger without practice is a descriptor with only `id` and `releasedLedgers`; it appends after the legacy saturation order. A descriptor and its imports must not import a registry value (engine, lessons, methods and the other lists above), because the registries import the descriptors.
4. `npm run families:index` adds the descriptor's one line to `src/families/index.ts`, sorted by file name. This is the only shared line a family adds; sorted one-line inserts merge cleanly unless two new families sort next to each other. `tests/family-index.test.ts` fails when the index is stale.
5. `scripts/<id_with_underscores>_math_oracle.py` defines `SUPPORTED`, `solve(public)`, `review_problem(problem)` and `self_test()`. The review script discovers it by file name. By default `review_problem` is a check and `solve` gives the expected answer, compared as an exact number. Set `REVIEW_RETURNS_ANSWER = True` when `review_problem` returns the expected answer; set `CHOICE_REVIEW` to the template ids whose `solve` returns an option id (or `'choice-response'` for every template with a choice response).
6. `tests/<id>-practice.test.ts`.

Loading fails on a template, method, principle or archetype link that another family or a legacy entry already defines, and on an oracle template that another oracle already supports. A new skill (`src/curriculum/catalog.ts`), a new exposure objective (`selection.ts`), and changed rows of an existing released-item ledger or source inventory are deliberate curriculum edits and still change those shared files.

A template can assess only part of a broad skill. Record its actual scope and exclusions. Selecting an equation, explanation or graph does not certify constructing one. Written explanations awaiting rubric review cannot produce automatic mastery credit.

## Variation axes: one model, many surfaces

Released items often differ from practice only in surface: an equation written result-first (7 = 63 ÷ 9), the other quantity asked for, true-or-false statement pairs instead of select-all, a single choice, or π, radicals and powers in the numbers. Do not add a template or a `variant === N` branch for these. Put the family on the variation layer in `src/math/variation/`:

- The family writes one exact model: givens, the relation or statements with computed truth, and the misconception transforms that make distractors. `defineVariedFamily` declares the axes it supports; `generateVaried` draws each axis from its own hash stream, then renders prompt, response, answer, hint, explanation and figure from that model.
- Reusable axes: `orientationAxis` (operation-first, mixed, result-first), `answerFormatAxis` with `statementSurface` (select-all, true-false-pair, single-true, single-false), `targetAxis` with `factEquations` (which quantity of `whole = first ∘ second` is unknown), and `numberDomainAxis` with the exact real model (`ex`, `valueOf`, `isRational`) and rational display styles. A family may restrict an axis or define its own with `defineAxis`.
- Formats reuse existing response protocols, and every format of a family must need its template's one declared capability. Axes add no templates, so exposure budgets stay per objective, skill and family.
- Legacy axis values reproduce the pre-axis output byte for byte. Freeze a digest fixture before migrating a family and assert it, as `tests/variation-axes.test.ts` does. Saved instances keep their stored JSON and grading.
- The chosen values are saved as `variant.axes` on the private problem and copied to its attempt, so calibration and review can compare axis values.
- The independent oracle judges each displayed statement once; `scripts/variation_axes_oracle.py` decodes the answer format, splits either equation orientation and decides rationality exactly.

Older families whose generators are one switch case or a `build(r)` function keep that shape: declare the family's axes in `src/math/number-domain-axes.ts` (`sweepAxes`), draw them with `sweepChoose(id, seed)` (their own hash streams, so the legacy value reproduces the old output), branch on the value inside the generator, and attach `sweepVariant(label, axes)` to the problem. Printed worksheets call the print case without axes and keep the legacy problems. `tests/number-domain-sweep.test.ts` freezes digests of the legacy output for every such family.

A figure-surface axis draws the same model with a newer scene component (a circle graph instead of its table of sectors, coins without printed values, a ruler instead of a strip). Its new value may need a figure capability the template does not declare; declare it with `needs` on the axis. The server then shows the legacy value to a client without that capability ([figures](figures.md#second-component-set-scenes-v2)), so the template keeps its audience.

Add an axis when the task, its answer and its misconceptions are unchanged and only the way they are shown or asked differs. Add a family when the mathematics differs: another relation, another reasoning step, other misconceptions or another required skill. Record what each axis value practices in the ledger row it closes.

## Lesson structure

Every lesson builds through these layers:

1. Simple statement and intuition: explain the idea in plain language and give a short meaning for any term needed immediately.
2. Example: state the givens and requested answer, show justified steps, and check the result.
3. Method: generalize the example into reusable steps. Place each visualization beside the explanation it supports. Include a real application only when it teaches a useful relationship.
4. Watch for: explain the likely mistake and how to avoid or detect it.
5. Principle and definitions: collect the precise rule, notation, assumptions, restrictions and appropriate justification or proof.

Reference lessons mark sections as `intuition`, `method` or `formal`; the shared library/PDF renderer orders them around the example and pitfalls. Problem lessons put the plain `intuition` before their generated example and the formal `principle` and `terms` at the end. Mathematical conditions must be accurate throughout. Explain essential vocabulary briefly at first use even when its fuller definition belongs at the end.

Independently review elementary, middle-school and high-school examples before extending a revised authoring pattern across the inventory. Keep diagrams and intermediate reasoning that teach the idea; remove repetition and intimidating openings rather than stripping explanations to slogans.

Each lesson must stand on its own: a reader should understand the example's givens, local terms and notation, and explanations without completing another AMP lesson first. Repeat short, useful definitions across lessons when needed.

Inspect mobile widths 320 and 390, larger widths 768 and 1280, both themes, reduced motion, and Letter/A4 pages. Check first-time comprehension, not just overflow. Practice and feedback belong in the active view.

## Weighting and difficulty acceptance

Content coverage, instructional review and empirical calibration are separate evidence dimensions. The coverage report's unrecorded review fields do not mean no reviews have ever occurred; they mean this report has no applicable evidence records.

Select purpose, requirement/family, difficulty variant, then instance. Adding equivalent templates must not change a family's allocation. General learning uses the planned 60% current learning, 25% review/remediation and 15% diagnostic exploration as provisional product defaults; production adoption requires simulation and shadow evaluation. Test-goal practice uses versioned official blueprint weights where available, and explicitly editorial subtopic weights otherwise. Faithful exam simulation must report unavailable formats or coverage, not silently substitute and claim completeness.

Curriculum grade is placement metadata, not calibrated item difficulty. Record generator revision, variant, assistance, selection policy and probability for empirical fitting. Pool sparse variants, retain uncertainty, and validate on held-out learners and future periods against production. Synthetic learners test algorithm behavior, not real calibration. Do not promote a difficulty model or make test-score claims without real held-out evidence.
