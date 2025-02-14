#!/bin/bash

set -e

# Define the list of filenames
files=(
"00-00-unit-intro-comprehensive-grade-level-overview.md"
"00-01-lesson-how-this-book-is-structured-and-how-to-use-it.md"
"00-02-lesson-introduction-to-mathematical-thinking-and-problem-solving.md"
"00-03-lesson-key-math-terms-and-symbols-used-in-this-book.md"

"01-00-unit-intro-using-tables-graphs-and-charts.md"
"01-01-lesson-what-is-data-and-how-do-we-use-it.md"
"01-02-lesson-different-types-of-data-categorical-vs-numerical.md"
"01-03-lesson-collecting-data-through-surveys-and-experiments.md"
"01-04-lesson-organizing-information-in-charts-and-tables.md"
"01-05-lesson-creating-picture-graphs-with-real-world-examples.md"
"01-06-lesson-reading-and-interpreting-picture-graphs.md"
"01-07-lesson-creating-and-reading-bar-graphs.md"
"01-08-lesson-creating-and-interpreting-line-plots.md"
"01-09-lesson-comparing-information-from-multiple-graphs.md"
"01-10-lesson-introduction-to-likely-vs-unlikely-outcomes.md"
"01-11-lesson-introduction-to-certain-vs-impossible-events.md"

"02-00-unit-intro-building-fluency-with-addition-and-subtraction.md"
"02-01-lesson-understanding-addition-and-subtraction-facts.md"
"02-02-lesson-using-doubles-and-near-doubles.md"
"02-03-lesson-make-a-ten-strategy-for-addition.md"
"02-04-lesson-counting-on-and-counting-back.md"
"02-05-lesson-subtraction-as-unknown-addend-problems.md"
"02-06-lesson-adding-two-digit-numbers-without-regrouping.md"
"02-07-lesson-adding-two-digit-numbers-with-regrouping.md"
"02-08-lesson-subtracting-two-digit-numbers-without-regrouping.md"
"02-09-lesson-subtracting-two-digit-numbers-with-regrouping.md"
"02-10-lesson-mental-math-strategies-for-addition-and-subtraction.md"
"02-11-lesson-solving-word-problems-with-addition-and-subtraction.md"
"02-12-lesson-recognizing-patterns-in-addition-and-subtraction.md"
"02-13-lesson-introduction-to-balancing-equations-and-missing-numbers.md"

"03-00-unit-intro-measuring-lengths-and-distances.md"
"03-01-lesson-understanding-standard-and-non-standard-units-of-measurement.md"
"03-02-lesson-how-to-use-a-ruler-inches-vs-centimeters.md"
"03-03-lesson-measuring-objects-using-inches-and-feet.md"
"03-04-lesson-measuring-objects-using-centimeters-and-meters.md"
"03-05-lesson-estimating-lengths-and-distances.md"
"03-06-lesson-comparing-lengths-of-objects.md"
"03-07-lesson-solving-word-problems-with-measurements.md"

"04-00-unit-intro-extending-place-value-understanding-to-1000.md"
"04-01-lesson-place-value-hundreds-tens-and-ones.md"
"04-02-lesson-reading-and-writing-three-digit-numbers.md"
"04-03-lesson-expanded-form-of-three-digit-numbers.md"
"04-04-lesson-comparing-three-digit-numbers.md"
"04-05-lesson-skip-counting-by-5s-10s-and-100s.md"
"04-06-lesson-identifying-odd-and-even-numbers.md"
"04-07-lesson-using-place-value-to-add-and-subtract.md"

"05-00-unit-intro-representing-sums-and-differences-within-1000.md"
"05-01-lesson-adding-three-digit-numbers-without-regrouping.md"
"05-02-lesson-adding-three-digit-numbers-with-regrouping.md"
"05-03-lesson-subtracting-three-digit-numbers-without-regrouping.md"
"05-04-lesson-subtracting-three-digit-numbers-with-regrouping.md"
"05-05-lesson-estimating-sums-and-differences.md"
"05-06-lesson-solving-word-problems-with-three-digit-numbers.md"

"06-00-unit-intro-exploring-geometry-and-patterns.md"
"06-01-lesson-identifying-and-classifying-2d-shapes.md"
"06-02-lesson-identifying-and-classifying-3d-shapes.md"
"06-03-lesson-understanding-symmetry.md"
"06-04-lesson-partitioning-shapes-into-equal-parts.md"
"06-05-lesson-naming-and-writing-fractions-halves-thirds-and-fourths.md"
"06-06-lesson-comparing-fractions-using-models.md"
"06-07-lesson-introduction-to-angles-and-their-measurements.md"
"06-08-lesson-recognizing-and-creating-patterns-with-shapes.md"

"07-00-unit-intro-measuring-time-and-money.md"
"07-01-lesson-reading-analog-and-digital-clocks.md"
"07-02-lesson-telling-time-to-the-nearest-five-minutes.md"
"07-03-lesson-understanding-am-and-pm.md"
"07-04-lesson-calculating-elapsed-time.md"
"07-05-lesson-identifying-coins-and-bills.md"
"07-06-lesson-counting-money-up-to-one-dollar.md"
"07-07-lesson-making-change.md"
"07-08-lesson-solving-word-problems-involving-time.md"
"07-09-lesson-solving-word-problems-involving-money.md"

"08-00-unit-intro-reasoning-with-equal-groups.md"
"08-01-lesson-multiplication-as-repeated-addition.md"
"08-02-lesson-using-arrays-to-visualize-multiplication.md"
"08-03-lesson-introduction-to-multiplication-tables.md"
"08-04-lesson-division-as-sharing-and-grouping.md"
"08-05-lesson-relating-multiplication-and-division.md"
"08-06-lesson-solving-word-problems-with-multiplication-and-division.md"

"09-00-unit-intro-culminating-capstone-unit-applying-everything-you-have-learned.md"
"09-01-lesson-solving-mixed-word-problems.md"
"09-02-lesson-applying-math-to-real-life-situations.md"
"09-03-lesson-second-grade-final-test-preparation.md"
"09-04-lesson-second-grade-final-test-assessment.md"
"09-05-lesson-strategies-for-solving-word-problems-step-by-step-approach.md"
"09-06-lesson-review-of-key-math-concepts-learned-in-second-grade.md"
)

# Loop through files and run `corpora workon`
for file in "${files[@]}"; do
    corpora infer "$file" --check ./build.sh
    git add "$file"
    git commit -m "Infer $file"
    corpora sync
done
