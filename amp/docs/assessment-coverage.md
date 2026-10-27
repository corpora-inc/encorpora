# Assessment coverage and practice mix

AMP tracks implemented problem families separately from full standards alignment. A related generator does not certify every representation, response format or reasoning requirement of a standard.

## Released-item ledger

The ledger labels each question of a published, bounded question set once, so coverage of that set can be re-reported without relabeling. It describes those fixed questions, not future or unpublished ones.

- `src/curriculum/archetypes.ts` lists task archetypes, the join key across tests, states and AMP families. One archetype is one mathematical task in one representation. The list is meant to become the union of task types across audited sources; add one only when no existing archetype names the task.
- `src/curriculum/released-items/` holds one file per source: URL, edition, retrieval date and SHA-256 of the source and its answer explanations, and one row per item. A row records the section and number, page, response format, calculator rule, standards, archetypes, an original one-line demand, status, templates, limitations and the labeler. Question text, choices and artwork are never copied.
- `src/curriculum/template-archetypes.ts` links templates to archetypes. Skills and facets reach archetypes through their templates. Every template is linked, and the archetype list is the union across K–12 tasks, not only the SAT; archetypes with no linked template are union gaps.

**Status.** *Covered* means a family practices the same task, representation and difficulty range, in a protocol that can take the item's response. Numeric entry needs a numeric family; a numeric family may serve a choice item only when its choices are plain numbers. Point plotting (`point-plot-v1`) can serve graph and drag items. Structured work (`structured-work-v1`) can serve a constructed response whose work is a sequence of exact values, typed expressions or equations and reasons chosen from a bank; a free written explanation scored by a rubric has no protocol. *Partial* means related practice differs in representation, format, difficulty or covers only a sub-step; limitations say how. *Missing* means no family practices the core task. Validation rejects unknown sources, archetypes and templates, duplicate items, templates without an archetype link, missing items that cite templates, and covered items without a capable template linked to one of the item's archetypes.

`npm run coverage:items -- [markdown|json]` reports counts per source and test, response-format gaps, ranked archetype gaps, archetype saturation and link backfill. `npm run coverage:report` includes the summary. The saturation table reads sources in ledger order and shows the new archetypes each one adds and the share of its items on archetypes already seen. Add sources until a new one stops adding archetypes.

### SAT practice tests

All 432 mathematics questions of the eight published nonadaptive digital SAT Practice Tests 4–11 are labeled (two modules of 27 questions each; College Board no longer publishes Tests 1–3). SAT skills are classified against the assessment framework; the answer explanations do not state them.

| Status | Items |
| --- | ---: |
| Covered | 204 (47.2%) |
| Partial | 222 (51.4%) |
| Missing | 6 (1.4%) |

Student-produced numeric responses are covered at 57.1% (64 of 112) and multiple-choice questions at 43.8% (140 of 320). Some numeric-entry questions have related practice only in choice families, and some uncovered choice questions are practiced only by numeric entry, usually because their choices are expressions, equations, graphs or statements. Other partials come from narrower difficulty ranges (percent increases above 200%, radical side lengths, decimal data), linear rules never written in function notation, or single-step families for chained tasks. Five SAT items are closed by variation axes of one family model: the smaller quadratic solution of a squared binomial set equal to a linear expression, a negative leading coefficient, a perpendicular slope from a slope-intercept or standard-form equation, and a radical written with a scaled-up index and power. The largest gaps are linear input-output and rule-building in function notation, exponential models, related-expression values, two-variable linear constraints, angle relationships, intercepts from graphs and nonlinear evaluation and transformation.

Practice Test 11 added no archetypes. Tests 7–10 each added at most three, and 94–100% of their questions fell on archetypes already seen, so the SAT task set is close to saturated at 83 archetypes.

A second labeler re-labeled a seeded random 10% sample (44 questions) without seeing the first labels. Status agreed on 41 (93.2%), archetypes overlapped on 42 (95.5%) and templates on 43 (97.7%). The disagreements were resolved by applying one rule to every test: linear families never use function notation, so linear `f(x)` questions are partial.

### STAAR mathematics

All 260 mathematics items of the Spring 2025 STAAR released tests for grades 3 through 8 (30, 32, 34, 36, 38 and 40 items) and Algebra I (50) are labeled. TEA publishes these forms only as online practice tests, so each item is labeled from its published rationale and from the answer key, which states the TEKS code, interaction type and points. The code is recorded as printed (grade.strand.expectation.letter), and every row's limitations begin with the exact interaction.

| Test | Items | Covered | Partial | Missing |
| --- | ---: | ---: | ---: | ---: |
| Grade 3 | 30 | 10 (33.3%) | 18 (60%) | 2 (6.7%) |
| Grade 4 | 32 | 11 (34.4%) | 19 (59.4%) | 2 (6.2%) |
| Grade 5 | 34 | 14 (41.2%) | 20 (58.8%) | 0 (0%) |
| Grade 6 | 36 | 14 (38.9%) | 20 (55.6%) | 2 (5.6%) |
| Grade 7 | 38 | 11 (28.9%) | 27 (71.1%) | 0 (0%) |
| Grade 8 | 40 | 12 (30%) | 28 (70%) | 0 (0%) |
| Algebra I | 50 | 17 (34%) | 33 (66%) | 0 (0%) |

Of the 260 items, 179 are multiple choice, 29 drag and drop, 19 inline choice, 12 multiselect, 10 equation editor, 6 hot spot, 3 graphing, 1 number line and 1 match table grid. Hot spot, drag and drop, graphing and number line are `graph/drag`; inline choice and match table grid are `other`; an equation editor is `numeric` when the answer is a number (8) and `constructed` when the learner types an expression or inequality (2). Structured work covers both constructed items: typing a parallelogram's area formula solved for its height, and typing the inequality that compares two rental plans. Only the point-plot protocol takes `graph/drag`, so 38 of the 39 such items are partial: only the graphing item that places two points of a proportional line is covered, while the dashed boundary and shading of an inequality, an exponential curve, number-line endpoints and arrows, hot-spot selection and drag-and-drop assembly have no protocol. The 12 multiselect items have only two families that take a multi-select response (quadrilateral categories and slope triangles), and the 20 inline-choice and match items (dropdown blanks, mostly with two parts) have none.

The largest gaps are order of operations with nested groups, negatives and exponents, choosing or assembling the equation for a story, relationships between paired terms and tables, dot-plot, histogram and stem-and-leaf reading beyond a single count, area and perimeter chains and decimal sides, slope and intercept from points, the coordinate rule of a transformation and area, volume and surface-area chains. Six items have no related practice: properties of solid faces, number-line diagrams of stories, a strip diagram for a multistep story, benchmark fraction estimates, debit and credit card statements and a percentage bar graph.

The STAAR sources are not saturated: from Grade 3 to Algebra I they add 21, 20, 15, 13, 7, 9 and 8 archetypes not seen in any earlier source, and 17% to 76% of their items fall on archetypes already seen. Elementary tests introduce the most.

A second labeler re-labeled a seeded random 10% sample (26 items across all seven tests) without seeing the first labels. Response format agreed on 26 (100%), status on 22 (84.6%), archetypes overlapped on 25 (96.2%) and templates on 22 (84.6%). The status disagreements were resolved by applying two rules to every test: a family counts as related practice only if it practices the item's core operation or reading, not merely its topic or representation (two sampled items and two others of the same kind became missing), and perimeter practice with whole-number sides does not cover decimal sides. A story context or label around a graph read does not change the task.
#### Spring 2024 STAAR (second year)

All 210 mathematics items of the Spring 2024 STAAR released tests for grades 3 through 8 (30, 32, 34, 36, 38 and 40 items) are labeled from TEA's rationale and answer-key PDFs, as for 2025. Algebra I was not labeled.

| Test | Items | Covered | Partial | Missing | New archetypes | Items on archetypes already seen |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Grade 3 | 30 | 5 (16.7%) | 22 (73.3%) | 3 (10%) | 7 | 76.7% |
| Grade 4 | 32 | 9 (28.1%) | 22 (68.8%) | 1 (3.1%) | 0 | 100% |
| Grade 5 | 34 | 10 (29.4%) | 24 (70.6%) | 0 (0%) | 1 | 97.1% |
| Grade 6 | 36 | 9 (25%) | 24 (66.7%) | 3 (8.3%) | 2 | 94.4% |
| Grade 7 | 38 | 12 (31.6%) | 25 (65.8%) | 1 (2.6%) | 2 | 92.1% |
| Grade 8 | 40 | 9 (22.5%) | 31 (77.5%) | 0 (0%) | 1 | 97.5% |

The second year is close to saturated for grades 4 through 8: 92% to 100% of their items fall on archetypes seen in an earlier source, and only six archetypes were not seen. Grade 3 still adds seven, of which five were minted for it (supply and price, a whole number on a number line, congruent figures with equal-area parts) or for later grades (bank fee comparison, net worth); the others were listed but unused. Items on drag, hot spot, multiselect and inline-choice interactions stay partial except where an inline slope-and-intercept family exists. The largest gaps are choosing the graph of a rule or rate among drawn graphs, coordinate rules of dilations, rotations and translations, volumes with decimal approximations and equations, and tally, percentage bar graph, financial aid and net worth items, which have no related practice.

A second labeler re-labeled a seeded random 10% sample (21 of 210 items) without seeing the first labels. Response format agreed on 21 (100%), status on 15 (71.4%), archetypes overlapped on 19 (90.5%) and templates on 20 (95.2%). Of the six status disagreements, one was changed (a pair of equivalent expressions with a fractional coefficient became partial); the others kept the rule already applied to STAAR 2025: four choices compared with a given fraction are partial, a percentage bar graph with counts is missing, and a numeric family covers choices written as multiples of pi.

The earlier purposive samples (New York grade 7 and three framework requirements) are ledger sources marked incomplete. They are probes for gaps, not frequency samples.

### MCAS mathematics

All 162 mathematics items that the Massachusetts Department of Elementary and Secondary Education released from the Spring 2025 paper-based MCAS tests are labeled: 20 operational items each for grades 3 through 8 (of 40 per form) and all 42 for grade 10. The other 20 items of each grade 3 through 8 form are listed as unreleased and are not labeled; computer-based technology-enhanced items are released separately and are not in these forms. The released-item table of each PDF states the standard, item type and answer, so every row records the standard as printed. The earlier five-item purposive samples of grades 5, 8 and 10 are folded into the same source records.

| Test | Items | Covered | Partial | Missing |
| --- | ---: | ---: | ---: | ---: |
| Grade 3 | 20 | 5 (25%) | 15 (75%) | 0 (0%) |
| Grade 4 | 20 | 8 (40%) | 12 (60%) | 0 (0%) |
| Grade 5 | 20 | 11 (55%) | 9 (45%) | 0 (0%) |
| Grade 6 | 20 | 7 (35%) | 13 (65%) | 0 (0%) |
| Grade 7 | 20 | 8 (40%) | 12 (60%) | 0 (0%) |
| Grade 8 | 20 | 8 (40%) | 11 (55%) | 1 (5%) |
| Grade 10 | 42 | 9 (21.4%) | 32 (76.2%) | 1 (2.4%) |

Of the 162 items, 103 are single-answer choice, 31 multiselect, 16 constructed response and 12 short-answer numeric. Twenty-one multiselect items are covered: the quadrilateral hierarchy, the slope triangles and 19 items practiced by families that grade an exact set of true statements, equations, numbers, tables or expressions. Three of these are reached through variation axes of one family model: true-or-false statement pairs, the smaller quantity of a comparison as the unknown, and powers of pi and radicals. The other 10 multiselect items need a drawn shape, cube arrangement, protractor, symmetry figure or number line, a square fact among result-first equations, or pair word forms with numerals, and have related practice only in single-choice or numeric families. Two of the 16 constructed responses (multipart, with shown work or explanations) are covered by structured work, whose labeled steps are the shown work: grade 6 box costs with a one-time coupon and percents of the 50 states. The others need a written explanation, a drawing or a multipart task that no structured family practices yet.

MCAS adds no single dominant gap. Partial items concentrate on volume and area chains, rates with fractional quantities, percent of a quantity, coordinate distance, scale, systems given in slope-intercept form, scatter plots and true-or-false equation judgment. Two items have no related practice: a graph described as linear or nonlinear and increasing, and naming the parts of an expression.

MCAS is not saturated even though it follows the Common Core. In ledger order, after the SAT and STAAR sources, grades 3 through 10 add 19, 13, 9, 6, 4, 9 and 12 archetypes not seen in any earlier source, and 30%, 50%, 50%, 65%, 85%, 60% and 71% of their items fall on archetypes already seen. Elementary forms introduce the most, as in STAAR. Sixteen archetypes were minted for the MCAS items; the other new ones were already listed from earlier sources but unused by an earlier ledger.

A second labeler re-labeled a seeded random 10% sample (16 of 162 items, across all seven forms) without seeing the first labels. Response format agreed on 16 (100%), status on 12 (75%), archetypes overlapped on 14 (87.5%) and templates on 14 (87.5%). The four status disagreements were resolved by applying three rules to every form: matching an expression with words does not cover choosing a times-as-large statement about its value (Grade 5 item 10 became missing, with a new archetype); changing a dot plot to a listed data set, or adding an outlier to removing it, does not change the task; and a model statement for an exponential written with a per-period growth factor is the same task as one written with an exponent in years (Grade 10 items 19 and 29 became covered). Grade 8 item 4 stays covered because the family chooses exactly the equation for a starting amount plus a per-unit rate, as it does for STAAR Grade 8 item 40.
### New York Regents mathematics exams

All 106 questions of the June 2026 Regents Examinations in Algebra I (35), Geometry (35) and Algebra II (36), Next Generation Learning Standards, are labeled. Standards are the cluster codes in each rating guide's map to the learning standards. Every question allows a graphing calculator.

| Exam | Covered | Partial | Missing |
| --- | ---: | ---: | ---: |
| Algebra I | 26 (74.3%) | 9 (25.7%) | 0 (0%) |
| Geometry | 24 (68.6%) | 11 (31.4%) | 0 (0%) |
| Algebra II | 19 (52.8%) | 17 (47.2%) | 0 (0%) |

Of the 106 items, 72 are multiple choice, 10 numeric, 6 graph/drag and 18 constructed response. 67 of the 72 multiple-choice items are covered. The five that are not are Algebra II items whose form differs from the practice: the radian measure of a drawn angle (13), a circle centered off the origin with an oblique line (8), a rational equation whose denominators have a leading coefficient of 4 (11), an absolute value set equal to a nonlinear function (20) and a decay factor given as a calculator decimal (24).

None of the 10 numeric items is covered. Their rating guides award credit for shown work, and AMP checks only the final answer, so each is partial ("Final answer practiced; shown-work credit not assessed") until a structured-work-v1 family practices the shown work. Structured work covers two constructed items whose work is a sequence of typed lines (a grouped linear inequality and the triangle area formula solved for its height). The other 16 constructed items need constructions, written explanations or tasks no structured family practices yet, and the 6 graph items need curves, shaded regions or scaled sketches, while point plotting accepts lattice points on a line. Nine items require a written proof, justification or explanation. One item has no related family: graphing an absolute-value function.

Decimal coefficients, a positive leading coefficient with irrational roots, two denominators or two radicals, a generic f(x) in transformations, fractional ratios in series, a circle with a line, and graph-reading items that compare a plotted curve with a rule are practiced, along with the dilation, rigid-motion, parallel-segment and altitude items of Geometry, normal-distribution probabilities, and choosing among drawn graphs for functions, inequalities and logarithms.

Each exam still added 8 to 11 archetypes that earlier sources had not used and 58 to 77 percent of its questions fell on archetypes already seen, so the high-school task set is not saturated; the SAT, STAAR and MCAS sources saw few of these tasks. Fourteen archetypes were minted for tasks no existing archetype named.

A second labeler re-labeled a seeded random 10% sample (11 questions) without seeing the first labels. Status agreed on 11 (100%), archetypes overlapped on 10 (90.9%), templates on 11 (100%) and response format on 10 (90.9%). The disagreements were a proposed archetype for rationalizing denominators, resolved by widening `expression.radical-simplify`, and a multipart graphing item (Algebra II 36) that the first labeler recorded as graph/drag because a graph is the first required response.
### New York Regents mathematics exams, January 2026

All 107 questions of the January 2026 Regents Examinations in Algebra I (35), Geometry (35) and Algebra II (37) are labeled the same way as the June 2026 exams, each in its own file. The rating guides state the cluster codes, and every question allows a graphing calculator.

| Exam | Covered | Partial | Missing |
| --- | ---: | ---: | ---: |
| Algebra I | 24 (68.6%) | 11 (31.4%) | 0 (0%) |
| Geometry | 24 (68.6%) | 11 (31.4%) | 0 (0%) |
| Algebra II | 18 (48.6%) | 19 (51.4%) | 0 (0%) |

Of the 107 questions, 72 are multiple choice, 10 numeric, 6 graph and 19 constructed response. No question is covered unless a family practices the same task in a protocol that takes the response; 65 of 72 choice questions and 1 of 19 constructed questions are covered, and none of the 10 numeric questions, whose rating guides award shown-work credit ("Final answer practiced; shown-work credit not assessed") until a structured-work-v1 family practices the work; every question has related practice, including the three that had none: building a polynomial from its degree, leading coefficient and constant term, the centroid of a triangle, and a normal-distribution probability between two values.

The January exams are far closer to saturation than the June exams. Each added 2, 4 and 5 archetypes that no earlier source had used, against 8 to 11 for June, and 87 to 94 percent of their questions fell on archetypes already seen, against 58 to 77 percent for June. Two archetypes were minted (the centroid and the graph of a logarithm). Of the 98 archetypes the three January exams use, 69 appear in the June exams. The 11 first used in January are narrow tasks: Algebra I added graphical solution of two functions and interpreting a fitted model; Geometry added identifying and placing images under rigid motions, whole trips for a volume, quadrilateral claims from coordinates and the centroid; Algebra II added sinusoid models, parabola focus and directrix, trigonometric identities, simulation judgments and the graph of a logarithm.

The gaps match June: constructed response (19 questions, one covered by a two-column congruence proof built from statement and reason banks) and graph drawing (6) are largely unserved, and most partials are a representation change, such as reading a figure instead of coordinates, choosing among written forms, rounding a calculator decimal, or chaining two single-step families.

A second labeler re-labeled a seeded random 10% sample (11 questions) without seeing the first labels. Response format agreed on 11 (100%), archetypes overlapped on 11 (100%), status on 9 (81.8%) and templates on 9 (81.8%). Two disagreements were resolved against the first labeler's status or citations: a family that draws a triangle and its image covers choosing a rigid motion (Geometry 1), and a family that reads logarithmic graphs is related practice for choosing a logarithm graph, so that question is partial instead of missing (Algebra II 4). One citation was widened to the family that interprets a coefficient (Algebra I 8).

### Virginia SOL mathematics (2014 released tests)

All 140 mathematics items of the spring 2014 Virginia Standards of Learning released tests for grades 3, 4 and 5 (40, 50 and 50 items) are labeled, one file per grade. These are the newest complete forms VDOE publishes: they assess the 2009 Mathematics Standards of Learning, and no form for the 2016 or 2023 revisions is released. The PDFs print each item as a picture and the answer key states the item type, the answer and one of four reporting categories, never a standard. Standards are classified against the 2009 grade standards, numbered as in VDOE's 2009 to 2016 crosswalk. doe.virginia.gov refused automated requests, so the files and their SHA-256 come from the Internet Archive's capture of the VDOE URLs. Virginia is not a Common Core state, and its forms use technology-enhanced items (drag, typed response, select all, click on a graph or number line).

| Test | Items | Covered | Partial | Missing | New archetypes | Items on archetypes already seen |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Grade 3 | 40 | 6 (15%) | 27 (67.5%) | 7 (17.5%) | 13 | 65% |
| Grade 4 | 50 | 15 (30%) | 28 (56%) | 7 (14%) | 5 | 86% |
| Grade 5 | 50 | 12 (24%) | 29 (58%) | 9 (18%) | 8 | 80% |

Of the 140 items, 120 are multiple choice, 9 typed numeric, 8 drag or click on a graph, and 3 select all. Covered items are mostly whole-number and decimal computation, estimation, unit renaming and fraction sums and differences. Statements, lists and drawn options keep most choice items partial. Of 23 missing items, 19 name one of 12 archetypes minted for this source: reading a thermometer, congruent figures, repeating patterns, properties of operations (identity, associative, distributive), building a set or spinner for a likelihood, a probability on a zero to one number line, triangles by sides, the figures made by cutting a shape, the mode, naming a measure of center or variation, a tile model of an equation, and the variable in a situation. The other four lack a family for hours renamed as minutes, a table matched to a survey total, a two-way table built from a description and the story for a subtraction sentence.

The Virginia forms are not saturated. Grade 3 adds 13 archetypes not seen in any earlier source (5 minted, 8 existing archetypes no earlier source used) and 35% of its items fall on archetypes not yet seen. Grades 4 and 5 add 5 and 8, and 86% and 80% of their items fall on archetypes already seen, in line with the STAAR 2024 elementary tests. Early grades keep finding narrow tasks: measurement tools, properties, probability vocabulary and statistics vocabulary.

A second labeler re-labeled a seeded random 10% sample (14 items across the three tests) without seeing the first labels. Response format agreed on 14 (100%), status on 13 (92.9%), archetypes overlapped on 10 (71.4%) and templates on 11 (78.6%). The archetype disagreements were a different archetype for the same task (a spinner or bag built for equal chances, a table matched to a total) or a minted archetype where the second labeler used the nearest existing one (the mode). The one status disagreement kept the rule from earlier sources: a family counts as related practice only if it practices the item's core operation, and customary renaming of lengths, weights and capacities is not renaming hours as minutes, so that item stays missing.

### Adding a source

1. Download the official question and answer PDFs into a scratch directory. Record the URL, edition, retrieval date and SHA-256, and read them with text extraction only.
2. Create `src/curriculum/released-items/<source-id>.ts` with `defineLedger`. Label every mathematics item and set `complete: true` only when none is skipped. Write an original demand, the source's stated standards and response format, and the closest existing archetypes.
3. Check candidate families by id, title and description, and generate two samples of each before citing it. Apply the status rules strictly. Link each cited template to an archetype: in `template-archetypes.ts` for a legacy template, or in its family descriptor's `archetypeLinks`.
4. Register the ledger with a descriptor `src/families/<source-id>.ts` that exports `{ id, releasedLedgers: [ledger] }` and run `npm run families:index` ([content-family playbook](content-family-playbook.md#register-a-family-new-files-only)); it appends after the legacy ledger order. Run `npm run coverage:items`, and have a second labeler blind-relabel a random 10% sample. Record the agreement in the PR.

### Limits

Labels are editorial judgments checked by samples and a blind 10% relabel, not learner evidence. *Covered* means AMP practices the task, not that a learner masters it or that a whole standard is covered. Eight practice forms give occurrence counts, not operational frequencies. Item difficulty and calculator strategy are not modeled.

Three problem families address explicit error bounds, symmetric margins of error and radians as arc length divided by radius. Each includes an instance-specific hint, worked answer, standalone lesson, visualization and an independent public-givens mathematics oracle. Their coverage records describe the assessed subset. Unit-circle coordinates, other inference demands and measurement-precision conventions require further families.

Implemented families include one-choice inverse rounding to tenths or hundredths, identifying valid point removals that make a relation a function, and interpreting a linear model's initial value. A quadrilateral-hierarchy family asks learners to select three true statements from five or six choices. Its exact-set grading is independent of selection order, and its lesson distinguishes inclusive shape categories, inherited properties and defining conditions. It shares the existing shape-properties exposure budget. These families assess specific tasks, not every component of their linked standards.

The purposive samples identify further work: general inverse decimal intervals, congruence correspondence, multi-step geometric reasoning, large percent increases, quadratic parameter constraints and bounds on means from grouped data. Related generators should be checked for reuse before authoring additional families. The multi-select protocol supports a stated number of selections; linked multipart scoring and written reasoning require additional response support and rubrics.

The point-plot protocol (`point-plot-v1`) lets learners place one to four lattice points on a coordinate grid. The server grades an exact set, an ordered list of labeled images, or any distinct points on a target line; the grading rule never reaches the client, and clients that do not declare the capability, including offline packs, are never served these items. Three families use it: plotting signed pairs, points described by distances from the axes and reflections across both axes; graphing a line from slope-intercept, standard or point-slope form, a horizontal line or a proportional relationship; and placing the ordered images of a segment or triangle under a translation, an axis reflection or a rotation of 90° or 180° about the origin. Printed workbooks show the empty grid and the solutions draw the answer. Shading inequality regions, drawing curves, dragging segments and graphing non-lattice points require further response support.

The multi-part choice protocol (`multi-part-choice-v1`) answers state-test inline-choice, match-table-grid and drag-into-slots items. A problem has two to six blanks, each with two to six options, laid out as blanks in a sentence, rows of a table that share their column options, or labeled slots; drag-and-drop tiles are offered as one picker per slot, so no dragging is needed. Credit requires every blank to be correct. The attempt records which blanks were right, its first feedback line names the parts to recheck, and the problem marks each part. The answer key stays on the server, and clients that do not declare the capability, including offline packs, are never served these items. Three families use it: completing a line's slope, y-intercept and direction, or the m and b of y = mx + b, from a graph, two points or a table; marking equations and sets of pairs as proportional or not; and labeling the coefficients, terms, exponent, constant and factors of an expression. Printed workbooks show a box for each option, and the solutions tick the correct boxes. Hot spots, selecting objects in a drawing and composing an expression from shared tiles require further response support.
The figure-choice protocol (`figure-choice-v1`) answers "choose the graph" items: a single choice whose two to four options are drawn figures, each a small graph or number line from the scene framework with a text description written from the same model, so screen readers can tell the options apart. Option identifiers are positions after shuffling, and the answer stays on the server; clients that do not declare the capability and draw scenes, including offline packs, are never served these items. Every distractor is a specific misconception with its own feedback. Four families use it: the graph of a line from $y = mx + b$, words, a table or $ax + y = c$ (slope sign flipped, slope and intercept swapped, intercept on the $x$-axis); the graph of a rate in context (not starting at zero, the total used as the rate, the rate inverted, the rate added once); the number line of a solved one- or two-step inequality (endpoint, unreversed sign, sign or inverse-operation slip); and the graph of a vertex-form parabola, a shifted $f(x) = x^2$ or $a \cdot b^x$ (shifts the wrong way or swapped, reflection, growth and decay swapped, the intercept read at $x = 1$, a line through the same points). Printed workbooks letter the figures and the solutions ring the correct one. Choosing among drawn regions of two-variable inequalities, scatter plots, data displays and tables of values requires further families.

The structured-work protocol (`structured-work-v1`) answers constructed responses whose written work can be graded exactly: "show your work", "justify each step" and two-column proofs. A problem is an ordered list of steps; each step has one or two fields, an exact number, a typed expression, equation or inequality, or an option from a bank of reasons or statements. The learner builds every step, fills in the steps a scaffold leaves blank, or orders given steps. Typed lines are parsed and compared by exact symbolic algebra (polynomials and rational functions with exact rational coefficients, no floating point). Grading is per step and on the server: a derivation's every line must follow from the line before it by the move its reason names, so any valid path is accepted; a proof's every line must be justified by its reason from statements above it; labeled values must equal the expected values. Credit needs every step; the attempt records which steps were right, its first feedback lines name the steps to recheck and why, and the problem marks each step. The rule and the key stay on the server, and clients that do not declare the capability, including offline packs, are never served these items. Three families use it: solving a linear equation, a grouped linear inequality, a formula for a named variable or a quadratic by factoring, with the property for each line; two-column triangle congruence and parallel-line angle proofs; and multipart word problems answered as labeled values and expressions (costs with a one-time coupon, percents of a total, two rental plans compared by an inequality). Further families answer constructed responses whose credited work is a short sequence of exact steps: polynomial products entered as partial products and coefficients, a line written from a point, an AA similarity proof ending in a proportion, similar triangles, scale drawings and scientific notation as labeled values, and five two-credit Regents responses (recursive terms, a remainder by evaluation, two overlapping groups, an average rate from a table, items within a budget or goal). An item whose response format is numeric stays numeric: a structured family covers only items whose rating guide credits the work, which are labeled constructed. Printed workbooks show a blank line for each step and the banks; the solutions print the worked steps. Written explanations scored by a rubric, constructions, drawn work and proofs written without banks are not covered.

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
| 5 | 46 | 28 | 4 | 14 | 0 |
| 6 | 53 | 31 | 14 | 8 | 7 |
| 7 | 44 | 35 | 4 | 5 | 3 |
| 8 | 46 | 36 | 4 | 6 | 5 |
| Algebra I | 50 | 45 | 4 | 1 | 0 |
| Algebra II | 49 | 41 | 6 | 2 | 1 |
| Geometry | 43 | 34 | 6 | 3 | 2 |
| Precalculus | 51 | 41 | 8 | 2 | 1 |
| Total | 594 | 433 | 92 | 69 | 40 |

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
