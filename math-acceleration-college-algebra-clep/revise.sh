#!/bin/bash

set -e

INSTRUCTIONS="
Return the same file with the following changes:
1. Add detailed explanations of concepts and methods.
2. Clean up vertical white space:
    Be generous with vertical space following conventional markdown linting guidelines.
    Separate markdown features with a single blank line. Do not use more than one blank line.
3. Give intuition about the concepts to help the reader understand and remember.
4. Make figure descriptions (image alt text) concise and clear with proper inline math. inline-latex can be used eg $f(x)=x^2$.

The focus is on teaching the College Algebra material in a way that is engaging and easy to understand.

Remove anything that does not contribute to the student's mastery of Algebra for the College Algebra CLEP exam.

Expand on anything that is not clear or could be better explained.

Proofread and return the file to be a part of the greatest College Algebra course ever.

If the file is already perfect, return it unchanged.
"

# Define the list of filenames
files=(
"01-00-unit-intro-foundational-algebraic-concepts.md"
"01-01-lesson-understanding-variables-and-algebraic-expressions.md"
"01-02-lesson-operations-on-numbers-and-algebraic-terms.md"
"01-03-lesson-simplifying-expressions-and-combining-like-terms.md"
"01-04-lesson-the-distributive-property-and-its-applications.md"
"01-05-lesson-evaluating-algebraic-expressions.md"
"01-06-lesson-solving-basic-linear-equations.md"
"01-07-lesson-solving-equations-with-variables-on-both-sides.md"
"01-08-lesson-real-number-classifications-and-properties-rational-irrational.md"

"02-00-unit-intro-linear-equations-and-inequalities.md"
"02-01-lesson-solving-linear-equations-with-single-variable.md"
"02-02-lesson-solving-linear-inequalities-and-graphing-solution-sets.md"
"02-03-lesson-solving-equations-with-absolute-value.md"
"02-04-lesson-solving-inequalities-with-absolute-values.md"
"02-05-lesson-applications-of-linear-equations-in-real-life.md"

"03-00-unit-intro-functions-and-graphing.md"
"03-01-lesson-defining-functions-and-function-notation.md"
"03-02-lesson-graphing-linear-functions-and-understanding-slope.md"
"03-03-lesson-function-transformations-and-shifts.md"
"03-04-lesson-graphing-and-analyzing-quadratic-functions.md"
"03-05-lesson-inverse-functions-and-composite-functions.md"
"03-06-lesson-domain-and-range-of-functions.md"
"03-07-lesson-algebra-of-functions-sums-products-and-quotients.md"

"04-00-unit-intro-polynomial-functions-and-operations.md"
"04-01-lesson-adding-and-subtracting-polynomials.md"
"04-02-lesson-multiplying-polynomials-and-special-products.md"
"04-03-lesson-factoring-polynomials-and-common-factors.md"
"04-04-lesson-polynomial-division-and-synthetic-division.md"
"04-05-lesson-solving-polynomial-equations-using-the-zero-product-property.md"

"05-00-unit-intro-quadratic-functions-and-equations.md"
"05-01-lesson-solving-quadratic-equations-by-factoring.md"
"05-02-lesson-solving-quadratic-equations-using-the-quadratic-formula.md"
"05-03-lesson-completing-the-square-technique.md"
"05-04-lesson-graphing-quadratic-functions-using-vertex-form.md"
"05-05-lesson-analyzing-the-discriminant-and-nature-of-roots.md"
"05-06-lesson-solving-and-graphing-quadratic-inequalities.md"

"06-00-unit-intro-exponential-and-logarithmic-functions.md"
"06-01-lesson-defining-exponential-functions-and-their-properties.md"
"06-02-lesson-graphing-exponential-functions-and-real-world-applications.md"
"06-03-lesson-introduction-to-logarithms-and-their-properties.md"
"06-04-lesson-solving-exponential-equations-using-logarithms.md"
"06-05-lesson-solving-logarithmic-equations-and-applications.md"

"07-00-unit-intro-rational-and-radical-functions.md"
"07-01-lesson-simplifying-rational-expressions-and-identifying-domain-restrictions.md"
"07-02-lesson-graphing-rational-functions-and-understanding-asymptotes.md"
"07-03-lesson-understanding-radical-functions-and-nth-roots.md"
"07-04-lesson-solving-equations-involving-radicals.md"
"07-05-lesson-real-world-applications-of-rational-and-radical-functions.md"

"08-00-unit-intro-complex-numbers-and-conic-sections.md"
"08-01-lesson-understanding-complex-numbers-and-basic-operations.md"
"08-02-lesson-representing-complex-numbers-on-the-complex-plane.md"
"08-03-lesson-introduction-to-conic-sections-and-standard-equations.md"
"08-04-lesson-graphing-parabolas-circles-ellipses-and-hyperbolas.md"
"08-05-lesson-applications-of-conic-sections-in-science-and-engineering.md"

"09-00-unit-intro-systems-of-equations-and-matrix-methods.md"
"09-01-lesson-solving-systems-of-linear-equations-by-substitution.md"
"09-02-lesson-solving-systems-of-linear-equations-by-elimination.md"
"09-03-lesson-graphical-interpretation-of-systems-of-equations.md"
"09-04-lesson-introduction-to-matrices-and-basic-matrix-operations.md"
"09-05-lesson-using-determinants-and-inverse-matrices-to-solve-systems.md"

"10-00-unit-intro-sequences-series-and-advanced-topics.md"
"10-01-lesson-arithmetic-and-geometric-sequences.md"
"10-02-lesson-finding-the-sum-of-arithmetic-series.md"
"10-03-lesson-sum-of-geometric-series-and-tests-for-convergence.md"
"10-04-lesson-exploring-recursive-sequences-and-formula-derivation.md"
"10-05-lesson-introduction-to-combinatorics-and-basic-probability.md"
"10-06-lesson-factorials-and-binomial-theorem.md"

"11-00-unit-intro-function-applications-and-modeling.md"
"11-01-lesson-constructing-functions-to-model-real-world-scenarios.md"
"11-02-lesson-interpreting-and-analyzing-graphical-data.md"
"11-03-lesson-working-with-piecewise-defined-functions.md"
"11-04-lesson-solving-problems-using-composite-and-inverse-functions.md"
"11-05-lesson-exploring-parameterized-equations-and-models.md"

"12-00-unit-intro-comprehensive-review-and-challenge-problems.md"
"12-01-lesson-integrated-review-of-algebraic-concepts.md"
"12-02-lesson-mixed-problem-solving-techniques.md"
"12-03-lesson-advanced-challenge-problems-for-critical-thinking.md"
"12-04-lesson-strategies-for-test-taking-and-timed-practice.md"
"12-05-lesson-final-challenge-problems-for-college-algebra-clep-preparation.md"
)

# Loop through files and run `corpora workon`
for file in "${files[@]}"; do
    corpora infer "$file" --check ./build.sh --instructions "$INSTRUCTIONS"
    git add "$file"
    git commit -m "Infer $file" --no-gpg-sign
    corpora sync --noinput
done
