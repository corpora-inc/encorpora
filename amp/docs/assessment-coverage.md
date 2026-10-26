# Assessment coverage and practice mix

AMP tracks implemented problem families separately from full standards alignment. A related generator does not certify every representation, response format or reasoning requirement of a standard.

## Released-item ledger

The ledger labels each question of a published, bounded question set once, so coverage of that set can be re-reported without relabeling. It describes those fixed questions, not future or unpublished ones.

- `src/curriculum/archetypes.ts` lists task archetypes, the join key across tests, states and AMP families. One archetype is one mathematical task in one representation. The list is meant to become the union of task types across audited sources; add one only when no existing archetype names the task.
- `src/curriculum/released-items/` holds one file per source: URL, edition, retrieval date and SHA-256 of the source and its answer explanations, and one row per item. A row records the section and number, page, response format, calculator rule, standards, archetypes, an original one-line demand, status, templates, limitations and the labeler. Question text, choices and artwork are never copied.
- `src/curriculum/template-archetypes.ts` links templates to archetypes. Skills and facets reach archetypes through their templates. Every template is linked, and the archetype list is the union across K–12 tasks, not only the SAT; archetypes with no linked template are union gaps.

**Status.** *Covered* means a family practices the same task, representation and difficulty range, in a protocol that can take the item's response. Numeric entry needs a numeric family; a numeric family may serve a choice item only when its choices are plain numbers. Point plotting (`point-plot-v1`) can serve graph and drag items; constructed responses have no protocol yet. *Partial* means related practice differs in representation, format, difficulty or covers only a sub-step; limitations say how. *Missing* means no family practices the core task. Validation rejects unknown sources, archetypes and templates, duplicate items, templates without an archetype link, missing items that cite templates, and covered items without a capable template linked to one of the item's archetypes.

`npm run coverage:items -- [markdown|json]` reports counts per source and test, response-format gaps, ranked archetype gaps, archetype saturation and link backfill. `npm run coverage:report` includes the summary. The saturation table reads sources in ledger order and shows the new archetypes each one adds and the share of its items on archetypes already seen. Add sources until a new one stops adding archetypes.

### SAT practice tests

All 432 mathematics questions of the eight published nonadaptive digital SAT Practice Tests 4–11 are labeled (two modules of 27 questions each; College Board no longer publishes Tests 1–3). SAT skills are classified against the assessment framework; the answer explanations do not state them.

| Status | Items |
| --- | ---: |
| Covered | 139 (32.2%) |
| Partial | 285 (66.0%) |
| Missing | 8 (1.9%) |

Student-produced numeric responses are covered at 37.5% (42 of 112) and multiple-choice questions at 30.3% (97 of 320). Nine numeric-entry questions have related practice only in choice families. 85 uncovered choice questions are practiced only by numeric entry, usually because their choices are expressions, equations, graphs or statements. Other partials come from narrower difficulty ranges (percent increases above 200%, negative leading coefficients, radical side lengths, decimal data), linear rules never written in function notation, or single-step families for chained tasks. The largest gaps are linear input-output and rule-building in function notation, exponential models, related-expression values, two-variable linear constraints, angle relationships, intercepts from graphs and nonlinear evaluation and transformation.

Practice Test 11 added no archetypes. Tests 7–10 each added at most three, and 94–100% of their questions fell on archetypes already seen, so the SAT task set is close to saturated at 83 archetypes.

A second labeler re-labeled a seeded random 10% sample (44 questions) without seeing the first labels. Status agreed on 41 (93.2%), archetypes overlapped on 42 (95.5%) and templates on 43 (97.7%). The disagreements were resolved by applying one rule to every test: linear families never use function notation, so linear `f(x)` questions are partial.

### New York Regents mathematics exams

All 106 questions of the June 2026 Regents Examinations in Algebra I (35), Geometry (35) and Algebra II (36), Next Generation Learning Standards, are labeled. Standards are the cluster codes in each rating guide's map to the learning standards. Every question allows a graphing calculator.

| Exam | Covered | Partial | Missing |
| --- | ---: | ---: | ---: |
| Algebra I | 5 (14.3%) | 28 (80.0%) | 2 (5.7%) |
| Geometry | 4 (11.4%) | 30 (85.7%) | 1 (2.9%) |
| Algebra II | 2 (5.6%) | 34 (94.4%) | 0 (0.0%) |

Part I multiple choice is 72 of 106 items and 10 of them are covered. The 34 constructed-response items are the main gap: 6 require a drawn graph (graph/drag) and 18 a written expression, construction, proof or explanation (constructed), and AMP has no protocol that can take either. The graph items need curves, shaded regions or scaled sketches, while point plotting accepts lattice points on a line. Nine items require a written proof, justification or explanation. The remaining 10 constructed-response items ask for one number and are numeric, but the rating guides also credit shown work, which AMP does not score, so only one is covered. Three items have no related family: building a polynomial from its degree and coefficients, graphing an absolute-value function and the perpendicular-bisector property.

The largest gaps are parallelogram and rhombus properties and proofs, factoring beyond one-variable trinomials, unit and density chains in volume problems, drawing nonlinear graphs, rational exponents and exponent rules, zeros of nonmonic factors and growth rates read from exponential bases. Algebra I and Algebra II families usually stop short on one feature: decimal coefficients, a positive leading coefficient with irrational roots, two denominators or two radicals, a generic f(x) in transformations and fractional ratios in series.

Each exam still added 12 to 15 archetypes that earlier sources had not used and only 40 to 56 percent of its questions fell on archetypes already seen, so the high-school task set is not saturated; the SAT and state samples saw few of these tasks. Fourteen archetypes were minted for tasks no existing archetype named.

A second labeler re-labeled a seeded random 10% sample (11 questions) without seeing the first labels. Status agreed on 11 (100%), archetypes overlapped on 10 (90.9%), templates on 11 (100%) and response format on 10 (90.9%). The disagreements were a proposed archetype for rationalizing denominators, resolved by widening `expression.radical-simplify`, and a multipart graphing item (Algebra II 36) that the first labeler recorded as graph/drag because a graph is the first required response.
### STAAR mathematics

All 260 mathematics items of the Spring 2025 STAAR released tests for grades 3 through 8 (30, 32, 34, 36, 38 and 40 items) and Algebra I (50) are labeled. TEA publishes these forms only as online practice tests, so each item is labeled from its published rationale and from the answer key, which states the TEKS code, interaction type and points. The code is recorded as printed (grade.strand.expectation.letter), and every row's limitations begin with the exact interaction.

| Test | Items | Covered | Partial | Missing |
| --- | ---: | ---: | ---: | ---: |
| Grade 3 | 30 | 3 (10%) | 24 (80%) | 3 (10%) |
| Grade 4 | 32 | 3 (9.4%) | 25 (78.1%) | 4 (12.5%) |
| Grade 5 | 34 | 2 (5.9%) | 31 (91.2%) | 1 (2.9%) |
| Grade 6 | 36 | 2 (5.6%) | 28 (77.8%) | 6 (16.7%) |
| Grade 7 | 38 | 5 (13.2%) | 32 (84.2%) | 1 (2.6%) |
| Grade 8 | 40 | 7 (17.5%) | 33 (82.5%) | 0 (0%) |
| Algebra I | 50 | 13 (26%) | 37 (74%) | 0 (0%) |

Of the 260 items, 179 are multiple choice, 29 drag and drop, 19 inline choice, 12 multiselect, 10 equation editor, 6 hot spot, 3 graphing, 1 number line and 1 match table grid. Hot spot, drag and drop, graphing and number line are `graph/drag`; inline choice and match table grid are `other`; an equation editor is `numeric` when the answer is a number (8) and `constructed` when the learner types an expression or inequality (2). Only the point-plot protocol takes `graph/drag`, so 38 of the 39 such items are partial: only the graphing item that places two points of a proportional line is covered, while the dashed boundary and shading of an inequality, an exponential curve, number-line endpoints and arrows, hot-spot selection and drag-and-drop assembly have no protocol. The 12 multiselect items have only two families that take a multi-select response (quadrilateral categories and slope triangles), and the 20 inline-choice and match items (dropdown blanks, mostly with two parts) have none.

The largest gaps are order of operations with nested groups, negatives and exponents, choosing or assembling the equation for a story, relationships between paired terms and tables, dot-plot, histogram and stem-and-leaf reading beyond a single count, area and perimeter chains and decimal sides, slope and intercept from points, the coordinate rule of a transformation and area, volume and surface-area chains. Fifteen items have no related practice: number words, percent-fraction-decimal renaming, credit and expense vocabulary, classification of number sets, benchmark fraction estimates, percentage bar graphs, strip diagrams for multistep stories, ratio writing, number-line diagrams of stories and properties of solid faces.

The STAAR sources are not saturated: from Grade 3 to Algebra I they add 20, 20, 13, 13, 7, 8 and 8 archetypes not seen in any earlier source, and 20% to 76% of their items fall on archetypes already seen. Elementary tests introduce the most.

A second labeler re-labeled a seeded random 10% sample (26 items across all seven tests) without seeing the first labels. Response format agreed on 26 (100%), status on 22 (84.6%), archetypes overlapped on 25 (96.2%) and templates on 22 (84.6%). The status disagreements were resolved by applying two rules to every test: a family counts as related practice only if it practices the item's core operation or reading, not merely its topic or representation (two sampled items and two others of the same kind became missing), and perimeter practice with whole-number sides does not cover decimal sides. A story context or label around a graph read does not change the task.

The earlier purposive samples (Massachusetts grades 5, 8 and 10, New York grade 7, and three framework requirements) are ledger sources marked incomplete. They are probes for gaps, not frequency samples.

### Adding a source

1. Download the official question and answer PDFs into a scratch directory. Record the URL, edition, retrieval date and SHA-256, and read them with text extraction only.
2. Create `src/curriculum/released-items/<source-id>.ts` with `defineLedger`. Label every mathematics item and set `complete: true` only when none is skipped. Write an original demand, the source's stated standards and response format, and the closest existing archetypes.
3. Check candidate families by id, title and description, and generate two samples of each before citing it. Apply the status rules strictly. Link each cited template in `template-archetypes.ts`.
4. Append the ledger to `releasedLedgers` in `index.ts`, run `npm run coverage:items`, and have a second labeler blind-relabel a random 10% sample. Record the agreement in the PR.

### Limits

Labels are editorial judgments checked by samples and a blind 10% relabel, not learner evidence. *Covered* means AMP practices the task, not that a learner masters it or that a whole standard is covered. Eight practice forms give occurrence counts, not operational frequencies. Item difficulty and calculator strategy are not modeled.

Three problem families address explicit error bounds, symmetric margins of error and radians as arc length divided by radius. Each includes an instance-specific hint, worked answer, standalone lesson, visualization and an independent public-givens mathematics oracle. Their coverage records describe the assessed subset. Unit-circle coordinates, other inference demands and measurement-precision conventions require further families.

Implemented families include one-choice inverse rounding to tenths or hundredths, identifying valid point removals that make a relation a function, and interpreting a linear model's initial value. A quadrilateral-hierarchy family asks learners to select three true statements from five or six choices. Its exact-set grading is independent of selection order, and its lesson distinguishes inclusive shape categories, inherited properties and defining conditions. It shares the existing shape-properties exposure budget. These families assess specific tasks, not every component of their linked standards.

The purposive samples identify further work: general inverse decimal intervals, congruence correspondence, multi-step geometric reasoning, large percent increases, quadratic parameter constraints and bounds on means from grouped data. Related generators should be checked for reuse before authoring additional families. The multi-select protocol supports a stated number of selections; linked multipart scoring and written reasoning require additional response support and rubrics.

The point-plot protocol (`point-plot-v1`) lets learners place one to four lattice points on a coordinate grid. The server grades an exact set, an ordered list of labeled images, or any distinct points on a target line; the grading rule never reaches the client, and clients that do not declare the capability, including offline packs, are never served these items. Three families use it: plotting signed pairs, points described by distances from the axes and reflections across both axes; graphing a line from slope-intercept, standard or point-slope form, a horizontal line or a proportional relationship; and placing the ordered images of a segment or triangle under a translation, an axis reflection or a rotation of 90° or 180° about the origin. Printed workbooks show the empty grid and the solutions draw the answer. Shading inequality regions, drawing curves, dragging segments and graphing non-lattice points require further response support.

Successive-percent practice applies two stated changes to a price, using the changed price as the second base. It includes decimal percentage rates, equal opposite changes, discount followed by tax and final-only cent rounding. [New York's Spring 2026 Grade 7 item 17](https://www.nysedregents.org/ei/math/2026/2026-released-items-math-g7.pdf#page=12), mapped to NY-7.RP.3, demonstrates the discount-then-tax demand. The family uses numeric answers and shares the existing ratios-percent exposure budget. Inverse recovery, rounding after each change and written justifications require separate assessment.

Slope-triangle practice connects geometry and algebra through three-of-six statements about right triangles on one line. Learners compare matching angles, similarity, congruence, lengths and signed slopes, including both same-size translated pairs and scaled pairs. [MCAS Spring 2025 Grade 8 item 19](https://www.doe.mass.edu/mcas/2025/release/g8-math.pdf#page=25) demonstrates this combined demand. The family shares the existing linear-models exposure budget; constructed proofs and full standard coverage require further assessment.

## Skill-level practice coverage

Every one of the 321 catalog skills has at least one adaptive practice family with a hint, worked explanation, standalone lesson and facet mapping. Previously 65 high-school skills had none, including 33 of 35 precalculus skills. The added families cover:

- trigonometry: special angles, symmetry, graphs, inverse functions, equations, identities, oblique triangles, triangle area and periodic models;
- polynomial and rational function behavior, graphical solving, identities, the binomial theorem and number-system closure;
- geometric measurement and modeling, Cavalieri's principle, solids of revolution and similarity theorems;
- probability distributions, expected value, fair decisions, simulation and randomization tests, report critique and model validation;
- vectors, matrices and matrix transformations;
- the complex plane, polar and parametric forms, and conic sections;
- reasoning for proofs, definitions and constructions, chosen from options. Written proofs and drawn constructions are not assessed.

A second round added task types inside existing skills, chosen by an audit of SAT question archetypes and Common Core standards. Examples are root relations, expression values from systems, rates, absolute inequalities, trigonometry in context, midpoints, circle segments, frequency-table centers, independence, proportional graphs, story graphs, triangle uniqueness, percent applications, compound events, series, compound growth, factoring patterns, residual fits, unit chains and estimation.

Every template now maps to the facets it assesses, all with partial extent. Each family has an independent oracle in `scripts/independent-math-review.py` that derives answers from public problem text. Skill presence does not establish full standard coverage: the report still lists facets without mapped evidence, and state inventories remain pending.

Editorial connections in `src/curriculum/connections.ts` link every practiced skill to a later skill, either through a prerequisite or an extension, application or related link. A test keeps it that way.

## Texas mathematics source reconciliation

The coverage report inventories every student expectation, lettered or unlettered, in the 19 TAC Chapter 111 mathematics standards for Kindergarten through Grade 8 (§111.2–§111.7, §111.26–§111.28) and for Algebra I, Geometry, Algebra II and Precalculus (§111.39–§111.42), all adopted 2012. Source records identify the retrieved TEA chapter PDFs (Subchapter A December 2014, B July 2025 and C October 2015 updates) by URL, retrieval date and SHA-256. Original summaries preserve required representations and restrictions; the official source controls their meaning.

Each inventory validates its requirement identifiers against an outline of the official document, and records the sources, a requirement per expectation, and reusable task links. Process standards (1)(A)–(G) are one cross-cutting group per course, recorded as unreviewed and not assessed by item practice. Grade 5, reconciled first, keeps its seven process rows.

| Course | Requirements | Related practice | Missing family only | Unreviewed (including process) | Open-ended among unreviewed |
| --- | ---: | ---: | ---: | ---: | ---: |
| K | 30 | 17 | 8 | 5 | 4 |
| 1 | 44 | 29 | 10 | 5 | 4 |
| 2 | 44 | 30 | 11 | 3 | 2 |
| 3 | 47 | 32 | 7 | 8 | 6 |
| 4 | 47 | 34 | 6 | 7 | 5 |
| 5 | 46 | 27 | 5 | 14 | 0 |
| 6 | 53 | 31 | 14 | 8 | 7 |
| 7 | 44 | 35 | 4 | 5 | 3 |
| 8 | 46 | 36 | 4 | 6 | 5 |
| Algebra I | 50 | 45 | 4 | 1 | 0 |
| Algebra II | 49 | 41 | 6 | 2 | 1 |
| Geometry | 43 | 34 | 6 | 3 | 2 |
| Precalculus | 51 | 41 | 8 | 2 | 1 |
| Total | 594 | 432 | 93 | 69 | 40 |

Every related-practice link is partial. Its limitations say what the linked templates establish, such as a numeric response without a learner-built model, a range narrower than the standard, or a skill authored for another grade; one generated sample of each linked template was reviewed, and a test regenerates two problems from each. A missing-family record names a concrete absent demand and the closest skill; sixteen more requirements have related practice and also name a missing demand. Open-ended demands (explain, describe, create, draw, list) are unreviewed because tap-response items do not assess them. Spring 2025 STAAR rationale items 14 and 21 establish occurrence of two Grade 5 tasks, not their frequency.

`src/curriculum/texas/` holds the band files (`k2.ts`, `35.ts`, `68.ts`, `hs.ts`), the shared builder and the aggregate; `src/curriculum/texas-grade5.ts` holds Grade 5. The report validates source, requirement, skill and template-owner references; invalid links cannot establish reconciliation. The 2025 advanced middle-school courses, the other high-school courses, the introduction rules for each course and the complete STAAR and end-of-course assessment inventories remain unreviewed. Texas has a partial source inventory, while statewide coverage and component reconciliation remain incomplete. Custom catalog reports do not inherit production state mappings unless explicitly supplied.

## Florida B.E.S.T. source reconciliation

The coverage report includes 486 requirements from [Florida's B.E.S.T. Standards for Mathematics](https://cpalmsmediaprod.blob.core.windows.net/uploads/docs/standards/best/ma/mathbeststandardsfinal.pdf), the July 2025 PDF linked from the [FLDOE mathematics page](https://cdn.fldoe.org/academics/standards/subject-areas/math-science/mathematics/): every benchmark in kindergarten through grade 8 (298), the 181 benchmarks listed for Algebra 1, Geometry, [Algebra 2](https://cdn.fldoe.org/core/fileparse.php/7576/urlt/Algebra-2.pdf) and [Precalculus Honors](https://cdn.fldoe.org/core/fileparse.php/7576/urlt/PrecalcHonors.pdf), and the seven Mathematical Thinking and Reasoning standards. Sources carry URL, retrieval date (2026-10-26) and SHA-256. Summaries are original; benchmark clarifications such as number ranges, denominators and term limits are kept in each requirement's scope.

Each benchmark is related practice with partial scope, a missing family with a concrete demand, or unreviewed. Of 479 benchmarks, 428 have related practice and 51 are missing; none is unreviewed. Related means a template assesses a real subset, checked against generated samples; limitations record range mismatches (for example generators that exceed a stated limit) and every unassessed representation, including drawing, constructing, explaining and graphing. Related practice never certifies a benchmark. The Mathematical Thinking and Reasoning standards are cross-cutting and not assessed by item practice.

| Band                                        | Benchmarks | Related | Missing |
| ------------------------------------------- | ---------: | ------: | ------: |
| K-2                                         |         75 |      64 |      11 |
| 3-5                                         |        109 |      97 |      12 |
| 6-8                                         |        114 |      94 |      20 |
| Algebra 1, Geometry, Algebra 2, Precalculus |        181 |     158 |      23 |

Calculus, further data analysis, logic and discrete mathematics, financial literacy and benchmarks used only by other 9-12 courses (156 in all) are out of scope. `src/curriculum/florida/` holds the inventory; the Florida statewide assessment blueprints are not inventoried, and the target stays incomplete.

## Selection weights

General adaptive learning uses a versioned blend of instructional importance and editorial assessment emphasis. The default gives each equal influence. This reduces extension objectives such as constructions and complex numbers while preserving central arithmetic and algebra weights. `objectiveExposureWeights(blend)` produces the explicit map stored in the compiled practice policy. Policy overrides can replace any objective, skill or family weight. These are editorial estimates, not measured test frequencies.

For SAT preparation, `satPracticeConfiguration(templates, basePolicy)` returns a filtered pool and a compiled policy together. Pass both to `planMixedPractice`. Its four domain budgets follow the framework’s approximate operational-question targets: 35% Algebra, 35% Advanced Math, 15% Problem-Solving and Data Analysis, and 15% Geometry and Trigonometry. Mapping AMP objectives into those domains and distributing a domain budget among objectives are editorial choices. The profile is opt-in; the general learning service does not automatically place every learner into SAT preparation.

Exposure is allocated by objective, then skill, then family. Authoring more generators inside a skill does not increase its objective’s budget. Domain percentages describe the prior when the pool is available and candidates fit equally well. Learner readiness, missing prerequisites, review, recency and unavailable content change the realized mix. Missing skills are returned explicitly; neither the weights nor the sample establishes complete SAT simulation. PSAT tests have different blueprints and must not silently reuse the SAT proportions.

## Full-coverage claim

A claim of covering every state standard requires dated inventories for all 50 states and DC, component-level reconciliation and reviewed evidence for each requirement. Common Core mappings and released test samples are useful shared evidence but do not establish that claim. A bounded, published test specification can be audited; future and unpublished questions cannot be enumerated. The coverage report keeps target completion false until the required inventories and evidence exist.
