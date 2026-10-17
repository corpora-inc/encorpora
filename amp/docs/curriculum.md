# Mathematics curriculum catalog

The catalog organizes a mathematics program from kindergarten through precalculus. It supplies instructional objectives, prerequisite relationships, source references, and publishing identifiers. It is a content-production inventory, not a claim that the complete program is available or that completing it guarantees a test score.

The public interfaces are `Skill`, `Standard`, the `skills` and `standards` arrays, and `auditCurriculum()`. Curriculum code has no dependency on the AHA application or its runtime. Original K–8 navigation summaries are derived from Corpora's source-reviewed curriculum inventory.

## Skills and evidence

Skills have durable descriptive identifiers independent of standards identifiers. Each skill names an observable objective and a planned assessment facet. Prerequisite edges are editorial judgments, not official Common Core dependencies or validated learning diagnoses. Grade bands describe typical instructional placement; they do not constrain access by a learner's age or school grade.

Every catalog skill begins with `planned` status. A runtime template can make one narrow task available without completing the associated skill. Consumers must check actual template availability separately. `implemented` means content exists; `verified` requires mathematical, rendering, accessibility, and instructional review. A verified skill cannot contain an unverified facet. Neither status automatically establishes a learner's mastery.

The graph includes number sense, operations, fractions, decimals, ratios, algebra, functions, geometry, measurement, statistics, probability, modeling, and reasoning. Some objectives need further decomposition before their complete assessment can be implemented. Proof, construction, transfer, and contextual interpretation require evidence beyond a numeric answer. Publishers should add targeted facets rather than award whole-skill credit from a single easy calculation.

## Standards and scope

The inventory lists all 229 numbered K–8 Common Core content standards. Each reference links to its official grade/domain page. Lettered components, examples, restrictions, and mathematical practices require additional review against the [official mathematics standards](https://www.thecorestandards.org/Math/). Original summaries help navigation; the official requirements control the meaning of each standard.

High-school references identify the official categories of [number and quantity](https://www.thecorestandards.org/Math/Content/HSN/), [algebra](https://www.thecorestandards.org/Math/Content/HSA/), [functions](https://www.thecorestandards.org/Math/Content/HSF/), [geometry](https://www.thecorestandards.org/Math/Content/HSG/), [statistics and probability](https://www.thecorestandards.org/Math/Content/HSS/), and [modeling](https://www.thecorestandards.org/Math/Content/HSM/). These are broad domain references. They do not constitute a complete inventory of numbered high-school standards. State-specific standards and course requirements need their own versioned crosswalks.

SAT references identify the four domains in [College Board's Math specifications](https://satsuite.collegeboard.org/k12-educators/about/alignment/math). SAT Math readiness is one application of the curriculum. Precalculus extends beyond the SAT Math target, and the catalog does not cover SAT Reading and Writing. The synthetic identifiers prefixed `SAT.` are local crosswalk keys, not official College Board standard codes.

Every alignment states the facet it addresses and labels its editorial basis. A mapped standard may have substantial unmet requirements. A valid audit is a structural check, not certification of complete state, Common Core, or SAT coverage. The audit lists unmapped standards from the inventory and skills with no source mapping; the high-school numbered standards absent from the inventory must be tracked as an additional coverage gap.

## Publishing and assessment

`lessonId` is a stable association for a future lesson or mini-textbook section. It does not assert that a file exists. Lessons should group related skills into coherent units rather than force a fixed number of books per grade. One structured source should produce app explanations, accessible reading material, printable lessons, varied worksheets, and worked answer keys.

Problem instances should record a template version and seed. The same mathematical model should drive prompt text, diagrams, exact grading, and worked steps. Generator checks must include boundary values, domain restrictions, equivalent answers, ambiguous choices, visual consistency, and answer leakage. Independent verification and instructional review are required before publishing a complete facet. Transfer questions and delayed independent practice provide stronger evidence than repeated substitutions into one familiar template.

The prerequisite audit detects missing references and cycles. It also checks duplicate identifiers, source links, assessment facets, alignment references, grade bands, and inconsistent verification claims. Tests exercise both the catalog and deliberately invalid graphs. The audit reports catalog readiness separately from runtime availability so production gaps remain visible.
