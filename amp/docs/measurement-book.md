# Measure, Border, Cover

An illustrated workbook for selected grades three through five measurement ideas,
with a ruler-interval entry bridge. The learner distinguishes distance along a
path, distance around a boundary, and coverage in square units. Whole-number
operations and introductory fractions and decimals are prerequisites.

The sequence moves from equal intervals and shifted ruler starts to perimeter,
unit-square area, disjoint decompositions, and mixed-unit problems. A shared
L-shaped region supports three arguments: count its outside edges, add two
nonoverlapping rectangles, or subtract a missing corner. Design investigations
compare equal areas and equal perimeters and require complete searches within
explicit positive whole-number rectangle constraints. They do not assert a
general optimization theorem.

Workbook activities include prediction, error repair, physical measurement,
multiple decompositions, counterexamples, invented challenges, mixed retrieval,
and a delayed return. Reasoned keys state acceptance criteria for open work and
allow alternate valid methods. Actual measurement and constructed explanations
require human observation; a numeric practice answer does not assess that work.

The crosswalk covers selected components of [grade-three measurement and
data](https://www.thecorestandards.org/Math/Content/3/MD/),
[grade-four measurement and data](https://www.thecorestandards.org/Math/Content/4/MD/),
and [grade-five measurement and data](https://www.thecorestandards.org/Math/Content/5/MD/).
The ruler bridge draws on [grade-two length
measurement](https://www.thecorestandards.org/Math/Content/2/MD/). Fractional ruler
readings extend that bridge; they are not attributed to grade-two requirements.
Only selected metric-length conversions are taught. Volume, angles, customary
unit systems and general polygon area are outside the book's scope.

`books/measure-border-cover/alignments.ts` records page, task, skill and standard
relationships with explicit limits. `practice.ts` binds sixteen deterministic
families to exact teaching pages: rectangle area, ruler intervals, perimeter,
missing sides, comparisons, selected conversions, bounded design decisions and
whole-pack costs. Cost comparison draws on selected [grade-four multistep story
requirements](https://www.thecorestandards.org/Math/Content/4/OA/).
Constructed designs, explanations and physical measurement require human review. Book presence, a page visit, or one correct response does not establish
complete standard coverage or durable mastery.

## Equal-unit region diagrams

The `unit-region` model describes one connected, hole-free collection of equal
squares on a bounded integer grid. Cells are unique, normalized to a zero origin,
and limited to twelve columns and eight rows. Boundary edges are derived by
canceling shared edges. Horizontal and vertical unit lengths use the same scale. Direct comparison
diagrams declare a common bounded `scaleFrame`, which fixes both unit size and
viewport height. Print and device checks measure the rendered cells and reject
inconsistent scales within a comparison pair.

Partition guides must follow shared interior edges for their entire length.
Known-length labels must follow complete exterior segments and face outward;
labels are calculated from displayed unit coordinates. Validation rejects
out-of-bounds, colliding or region-overlapping label placements. Narrow concave
regions can therefore require fewer labels rather than smaller lettering.
There is no hidden missing-dimension value or independent area/perimeter field.

The print and screen readers share the semantic renderer. A dedicated print
opening shows the same known region as a boundary and a unit-square covering.
All drawings are schematic; physical measurement activities require a real
ruler. The book requires both `unit-regions-v1` and `algebra-models-v1` reader
capabilities because it includes exact region models and conversion tables.
Clients that lack either feature cannot open this edition.

## Review and export

Run `npm test`, `npm run tsc`, `npm run audit`, and
`npx tsx scripts/verify-unit-region-reader.ts` for source and model checks.
`npm run test:book-ui -- --book measure-border-cover` checks every reading frame
in the registered book against the phone and landscape layouts; it requires the
isolated test database described by the application's test setup.

Export with `npx tsx scripts/publish-book.ts --book measure-border-cover --all-pages`.
The publisher validates page and SVG text bounds, physical PDF page counts, text
extraction, and authored/rendering source hashes. Those automated checks are
separate from independent mathematical and rendered-page review. The manifest
identifies the exact content and renderer used for an edition.
