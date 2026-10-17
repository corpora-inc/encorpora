# Independent math review

The review scripts compare generated answers with separately written Python
solvers. They require Node.js, AMP development dependencies and Python 3. The
oracle uses the standard library and exact `fractions.Fraction` arithmetic.

From the AMP directory, run:

```sh
set -o pipefail
npx tsx scripts/export-math-cases.ts | python3 scripts/independent-math-review.py
```

The exporter emits a manifest followed by cases. The oracle reads public prompts
and semantic figure data, calculates expected answers, and compares them with the
generated answers. It does not import the TypeScript generator, grading function,
explanations or canonical-answer helpers. Generated answers enter only the final
comparison. The exporter imports the production engine to produce the cases under
test.

The default checks seeds `independent-0` through `independent-255` for every family.
`--seeds COUNT` changes sample size, with a minimum of 256; `--start INDEX` selects
another contiguous range:

```sh
set -o pipefail
npx tsx scripts/export-math-cases.ts --start 256 --seeds 512 |
  python3 scripts/independent-math-review.py
```

Success reports counts and zero mismatches. Failures exit nonzero. Missing or
unreviewed families, duplicate or missing cases, out-of-range seeds and undersized
samples fail. Adding a family requires an independently derived oracle. Removing
a family requires explicit review of the oracle inventory. Do not weaken the
inventory gate to make a release pass.

`tests/independent-review.test.ts` runs the complete check, then deliberately
corrupts an answer, truncates coverage, duplicates a case, adds an unreviewed family
and declares an undersized sample. Each negative case must fail. Scripts write to
stdout; generated cases need not be stored in the repository.

## Provenance and limits

On October 16, 2026, a separate review agent examined 13 reference families and
18 additional families from commit `0c2b646c3`. The reviewer parsed and independently
solved 7,936 generated cases: 256 seeds per family across 31 families, with no
arithmetic answer mismatches. The reviewer also read lesson worked examples,
explanation formulas, semantic figure geometry and publication pairing code.
That source review is distinct from the automated oracle.

The review identified a grading regression case: `line-slope`, seed `review-2`,
asks for slope through `(-8, -4)` and `(-2, -1)`. The correct leading-dot decimal
`.5` must be accepted as equivalent to `1/2`. Keep this in input-parser tests;
the oracle compares generated answers and does not test answer-entry acceptance.
Decimal answer formatting also requires editorial attention: an exact fractional
representation can be correct while a decimal is clearer for decimal arithmetic.

Rerun the scripts against the exact release revision. Sampling does not prove all
parameter combinations. The oracle assumes specific prompt structures and needs
independent maintenance when those structures change. It checks selected figure
consistency, not rendered SVG/PDF appearance or screen-reader behavior. It does
not certify every explanation, lesson quality, full accessibility, curriculum
completeness, standards alignment, adaptive effectiveness or student outcomes.
Editorial and visual review are separate release requirements.

## Graphical families

The oracle also solves coordinate reading, slope from marked points, chart totals
and differences, elapsed minutes from an analog start time, and number-line
distance. It checks bounds, labels, category references, clock domains and whether
a represented straight line passes through the marked points. Slope answers use
exact fractions; floating line coefficients are checked within 1e-12 only for
rendering consistency. A negative test corrupts a line coefficient while keeping
the answer intact, demonstrating that inconsistent visual givens are rejected.

`tests/graphical-independent.test.ts` renders 256 seeds for every graphical family
and independently recovers mathematical coordinates from SVG attributes. It
checks line collinearity and clipping, bar proportions and baselines, partial-hour
clock hand angles, and number-line point placement. It fails if a new graphical
representation lacks a geometry check. These tests check SVG geometry, not the
visual readability of printed labels or browser/font differences.

## Interpretation choices

`choice_math_oracle.py` derives a unique correct option from the public fraction,
equation, or graph. It compares exact rational values and rejects mathematically
equivalent duplicate options. Graph cases check that the drawn line passes through
both given points. Correct choice IDs are compared as strings; numeric families
retain exact rational comparison. The choice oracle and instructional examples
were reviewed by a worker separate from their author.

Choice questions assess recognition within a bounded vocabulary. They do not
establish independent explanation, equation construction, or mastery of a whole
standard. Browser checks cover native radio keyboard behavior, phone layouts,
selected-distractor feedback, human-readable answers, and focus restoration.

## Practice graph readability

`npm run test:graphical-ui` exercises the actual practice workspace with 33 deterministic public problem fixtures. It checks ordinary phone and landscape compositions, rendered labels of at least 12 CSS pixels, SVG text bounds, text-label collisions and the absence of workspace scrolling. Edge fixtures include signed coordinate corners, near-axis point labels, adjacent negative number-line points, every five-minute clock position and a tall comparison chart. `AMP_GRAPH_BROWSER=webkit` selects WebKit; Chromium is the default. The same check inspects 199 diagrams in the reference-print lesson, workbook and solution layouts, including the general renderer used by printed choice exercises. An isolated test PostgreSQL database is required through `AMP_TEST_DATABASE_URL`.

Coordinate grids retain each unit line and use sparse numbered ticks. Point annotations show letters without printing the requested coordinate. The existing accessible description conveys the graph's quantities verbally; these checks do not establish equivalent assessment difficulty for every assistive presentation. Independent geometry tests recover the mathematical positions and quantities from rendered SVGs. Visual review of the exported screenshots complements the measured checks.
