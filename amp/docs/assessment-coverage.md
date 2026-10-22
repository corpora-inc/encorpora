# Assessment coverage and practice mix

AMP tracks implemented problem families separately from full standards alignment. `npm run coverage:report -- json` includes a dated, item-level assessment sample, related generators and remaining demands. A related generator does not certify every representation, response format or reasoning requirement of a standard.

The first sample examines 20 selected released questions from Massachusetts grades 5, 8 and 10 and College Board SAT Practice Test 10, plus three requirements from the [September 2026 digital SAT framework](https://satsuite.collegeboard.org/media/pdf/assessment-framework-for-digital-sat-suite.pdf). These are deliberately selected probes for gaps, not a representative frequency sample. The source URLs, edition, item numbers and limitations are in `src/curriculum/assessment-sample.ts`; source questions and artwork are not reproduced.

Three problem families address explicit error bounds, symmetric margins of error and radians as arc length divided by radius. Each includes an instance-specific hint, worked answer, standalone lesson, visualization and an independent public-givens mathematics oracle. Their coverage records describe the assessed subset. Unit-circle coordinates, other inference demands and measurement-precision conventions require further families.

The sample identifies useful follow-up work: inverse decimal rounding, repairing a plotted relation to make a function, congruence correspondence, multi-step geometric reasoning, large percent increases, quadratic parameter constraints and bounds on means from grouped data. Related arithmetic, function, scale-drawing and study-design families should be reused before authoring additional generators. Multi-select questions, linked multipart scoring and written reasoning need response-format and rubric work as well as content.

## Selection weights

General adaptive learning uses a versioned blend of instructional importance and editorial assessment emphasis. The default gives each equal influence. This reduces extension objectives such as constructions and complex numbers while preserving central arithmetic and algebra weights. `objectiveExposureWeights(blend)` produces the explicit map stored in the compiled practice policy. Policy overrides can replace any objective, skill or family weight. These are editorial estimates, not measured test frequencies.

For SAT preparation, `satPracticeConfiguration(templates, basePolicy)` returns a filtered pool and a compiled policy together. Pass both to `planMixedPractice`. Its four domain budgets follow the framework’s approximate operational-question targets: 35% Algebra, 35% Advanced Math, 15% Problem-Solving and Data Analysis, and 15% Geometry and Trigonometry. Mapping AMP objectives into those domains and distributing a domain budget among objectives are editorial choices. The profile is opt-in; the general learning service does not automatically place every learner into SAT preparation.

Exposure is allocated by objective, then skill, then family. Authoring more generators inside a skill does not increase its objective’s budget. Domain percentages describe the prior when the pool is available and candidates fit equally well. Learner readiness, missing prerequisites, review, recency and unavailable content change the realized mix. Missing skills are returned explicitly; neither the weights nor the sample establishes complete SAT simulation. PSAT tests have different blueprints and must not silently reuse the SAT proportions.

## Full-coverage claim

A claim of covering every state standard requires dated inventories for all 50 states and DC, component-level reconciliation and reviewed evidence for each requirement. Common Core mappings and released test samples are useful shared evidence but do not establish that claim. A bounded, published test specification can be audited; future and unpublished questions cannot be enumerated. The coverage report keeps target completion false until the required inventories and evidence exist.
