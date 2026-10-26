# Assessment coverage and practice mix

AMP tracks implemented problem families separately from full standards alignment. `npm run coverage:report -- json` includes a dated, item-level assessment sample, related generators and remaining demands. A related generator does not certify every representation, response format or reasoning requirement of a standard.

The sample examines 21 selected released questions from Massachusetts grades 5, 8 and 10, New York grade 7 and College Board SAT Practice Test 10, plus three requirements from the [September 2026 digital SAT framework](https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf). These are deliberately selected probes for gaps, not a representative frequency sample. The source URLs, edition, item numbers and limitations are in `src/curriculum/assessment-sample.ts`; source questions and artwork are not reproduced.

Three problem families address explicit error bounds, symmetric margins of error and radians as arc length divided by radius. Each includes an instance-specific hint, worked answer, standalone lesson, visualization and an independent public-givens mathematics oracle. Their coverage records describe the assessed subset. Unit-circle coordinates, other inference demands and measurement-precision conventions require further families.

Implemented families include one-choice inverse rounding to tenths or hundredths, identifying valid point removals that make a relation a function, and interpreting a linear model's initial value. A quadrilateral-hierarchy family asks learners to select three true statements from five or six choices. Its exact-set grading is independent of selection order, and its lesson distinguishes inclusive shape categories, inherited properties and defining conditions. It shares the existing shape-properties exposure budget. These families assess specific tasks, not every component of their linked standards.

The sample identifies further work: general inverse decimal intervals, congruence correspondence, multi-step geometric reasoning, large percent increases, quadratic parameter constraints and bounds on means from grouped data. Related generators should be checked for reuse before authoring additional families. The multi-select protocol supports a stated number of selections; linked multipart scoring and written reasoning require additional response support and rubrics.

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

## Texas Grade 5 source reconciliation

The coverage report includes the 46 lettered or unlettered requirements in §111.7(b) of Texas Grade 5 mathematics, adopted 2012. Source records identify the retrieved December 2014 chapter edition by URL, date and SHA-256. Original summaries preserve required representations and restrictions; the official source controls their meaning.

Eight requirements have partial task reconciliation. Decimal practice is reused; dot-plot and scatterplot interpretation supply related support without certifying learner-created displays. Stem-and-leaf interpretation, budget-category balancing and gross-versus-net income now have related practice families with partial scope. Stem-and-leaf practice belongs to a grade 6 skill, so grade 5 availability is not certified, and constructing plots or budgets is not assessed. Spring 2025 STAAR rationale items 14 and 21 establish occurrence of the first two tasks, not their frequency. The other 38 requirements are explicitly unreviewed, including the remaining financial-literacy and process requirements.

`src/curriculum/texas-grade5.ts` holds the source inventory and reusable task crosswalk. The report validates source, requirement, skill and template-owner references; invalid links cannot establish reconciliation. Texas has a partial source inventory, while statewide coverage, component reconciliation and the complete STAAR assessment inventory remain incomplete. Custom catalog reports do not inherit production state mappings unless explicitly supplied.

## Florida B.E.S.T. source reconciliation

The coverage report includes 486 requirements from [Florida's B.E.S.T. Standards for Mathematics](https://cpalmsmediaprod.blob.core.windows.net/uploads/docs/standards/best/ma/mathbeststandardsfinal.pdf), the July 2025 PDF linked from the [FLDOE mathematics page](https://cdn.fldoe.org/academics/standards/subject-areas/math-science/mathematics/): every benchmark in kindergarten through grade 8 (298), the 181 benchmarks listed for Algebra 1, Geometry, [Algebra 2](https://cdn.fldoe.org/core/fileparse.php/7576/urlt/Algebra-2.pdf) and [Precalculus Honors](https://cdn.fldoe.org/core/fileparse.php/7576/urlt/PrecalcHonors.pdf), and the seven Mathematical Thinking and Reasoning standards. Sources carry URL, retrieval date (2026-10-26) and SHA-256. Summaries are original; benchmark clarifications such as number ranges, denominators and term limits are kept in each requirement's scope.

Each benchmark is related practice with partial scope, a missing family with a concrete demand, or unreviewed. Of 479 benchmarks, 413 have related practice and 66 are missing; none is unreviewed. Related means a template assesses a real subset, checked against generated samples; limitations record range mismatches (for example generators that exceed a stated limit) and every unassessed representation, including drawing, constructing, explaining and graphing. Related practice never certifies a benchmark. The Mathematical Thinking and Reasoning standards are cross-cutting and not assessed by item practice.

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
