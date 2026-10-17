# Fraction practice and the Field Guide

The fraction practice set connects 21 deterministic task families to specific pages of the Fraction Field Guide. Learners practice fractional units, number-line positions, equivalent names, mixed-number renaming, subtraction, scaling, and the distinction between sharing an amount and counting groups of a given size. Responses are numbers or fractions; these tasks do not grade a learner's written explanation, drawing, or choice of representation.

`fractionPracticeTemplates` and `generateFractionPracticeProblem()` live in `src/math/fraction-practice.ts`. The public engine includes these families without changing existing template IDs or versions. A seed and template version reproduce the same question, exact answer, hint, explanation, and diagram. Answers reduce to an integer or a fraction with positive denominator. A mixed-number question requests either one specified component or a fraction answer because the response interface does not accept mixed-number notation.

## Units and diagrams

The `rational-line` model records an integer denominator, a whole-number endpoint, and marker numerators. Only whole-number axis values and letter marker labels appear before an answer. Equal intervals represent equal quantities; each marker's position is derived from its exact rational value. The model supports reading one marker and measuring the gap between two. Accessible descriptions state the interval size and marker interval counts so a screen-reader user receives the mathematical givens.

The `fraction-strips` model keeps the same whole length across every row. Heavy outlines separate wholes, and subdivisions identify equal fractional units. It can show an improper amount or compare a total with the amount in one container. The number of wholes is a measuring frame; unshaded cells do not add to the shaded quantity. In sharing tasks the answer measures liters per person. In grouping tasks it counts containerfuls, including a partial containerful where requested.

Both models are responsive SVG with no fixed pixel width. Geometry tests check tick counts, marker positions, equal cell widths, whole boundaries, and shaded counts. Figure schemas reject off-grid markers, duplicate marker positions or labels, invalid subdivisions, and quantities outside the measuring frame.

## Bounded coverage

`fractionRequirements` inventories 38 numbered and lettered requirements across [grade 3 fractions](https://www.thecorestandards.org/Math/Content/3/NF/), [grade 4 fractions](https://www.thecorestandards.org/Math/Content/4/NF/), [grade 5 fractions](https://www.thecorestandards.org/Math/Content/5/NF/), and [grade 6 fraction division](https://www.thecorestandards.org/Math/Content/6/NS/). Each record links to the official component, identifies relevant task families, and states unmet requirements. Source review date: October 17, 2026.

Grade-three families use denominators 2, 3, 4, 6, and 8. Grade-four renaming and arithmetic use smaller subsets of the official denominator domain to keep models legible and focus the assessed operation. The inventory distinguishes `partial-practice` from `planned`; it does not mark any whole standard complete.

Important gaps include learner-created models and explanations, comparison symbols, multiple decompositions, mixed-number addition, general mixed unlike-denominator arithmetic, decimal fractions, fractional rectangle area, and noncomputational scaling judgments. Sharing and grouping contexts use bounded amounts of liquid; performance does not establish transfer to every other context. Fluency, delayed retention, and broad mastery need separate evidence.

`fractionPracticeBindings` connects every family to its existing skill ID, instructional grade, official component IDs, and book page IDs. Each binding declares `numeric-result-only` and identifies unassessed outcomes. `validateFractionPracticeCoverage()` rejects stale page IDs, unknown skills or templates, mismatched skills, unlinked components, and unsupported coverage claims. These are teaching links rather than learner progress awards. The book reader can use them without duplicate compact reference lessons.

## Verification

`npm test` exercises 10,752 new deterministic instances, key edge cases, exact diagram geometry, schema rejection, and book/component bindings. `npm run review:math` exports public givens and generated answers to a separate Python checker. `fraction_math_oracle.py` derives each answer from the public prompt and diagram using exact rational arithmetic; it never imports the generator or uses its answer to solve the question. It also checks unit labels and agreement between prose and diagram data.

The oracle is a verification tool, not independent author certification. A separate reviewer must examine mathematical meaning, instructional limits, and rendered figures before recording independent-review evidence. Changing a prompt, figure contract, or mathematical domain requires updating and reviewing its public-givens solver and immutable-version policy.
