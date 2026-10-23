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

Generator integration normally touches the runtime engine registry, template-to-facet mappings, methods/principles, lesson or book bindings, and independent review cases. Search for a neighboring family and follow its actual registration path. Verify all generated cases are reachable through the public engine and supported by the client and printable renderer.

A template can assess only part of a broad skill. Record its actual scope and exclusions. Selecting an equation, explanation or graph does not certify constructing one. Written explanations awaiting rubric review cannot produce automatic mastery credit.

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
