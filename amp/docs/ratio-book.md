# In the Same Proportion

An illustrated workbook for selected grade-six and grade-seven ratio, rate,
proportional relationship and percent ideas. Multiplication, division,
introductory fractions and coordinate pairs are prerequisites. Equal-group and
fraction activities provide entry bridges without assigning a fixed learner
level from one response.

The sequence begins with named quantities and ratio order, then distinguishes
part-to-part comparisons from fractions of a combined whole. Equal-part tapes
make common multipliers visible. Liquid recipes allow fractional quantities;
whole-bead kits impose integer feasibility. The rate chapter connects prices,
fractional quantities and reciprocal units while distinguishing a unit price
from a whole-pack bill and an average rate from constant behavior.

Tables and graphs carry explicit model assumptions and input domains. A finite
set of observed pairs can agree with a proportional rule without proving every
unobserved value. A proportional model defines its zero-input output without
making the quotient zero divided by zero meaningful. Fixed fees are contrasted
with constant multipliers. Percent investigations name the reference whole,
recover missing parts or wholes, and explain changing bases in discounts, tax
and successive percent changes.

Activities include prediction, error repair, drawings, complete constrained
searches, supplier decisions, invented problems, mixed retrieval and a delayed
return. Reasoned keys explain acceptance criteria and permit valid alternative
arguments. The book does not cover every grade-six or grade-seven requirement,
every compound-unit context, or a complete survey of interest, commission,
gratuity and percent-error applications.

## Exact models

A ratio tape uses a single commensurable unit across two or three named rows.
Every drawn part represents an equal amount. Displayed totals and any displayed
part value must agree exactly through rational cross-products. Unknown amounts
are absent from the model. Rates with different units use separately labeled
tables or double scales instead of a shared-unit tape.

Comparable tapes use the same frame and part meaning; print and phone checks
measure their actual cell widths. Text wraps outside the SVG so long quantity
labels cannot obscure parts. Row labels and marks preserve distinctions without
color. Percent grids contain exactly one hundred equal squares and an explicit
reference whole. Selected cells may be contiguous or scattered; zero and one
hundred selected cells are valid. Explicit strokes provide grayscale markings
without raster-heavy SVG pattern resources.

The registered edition requires `ratio-models-v1` and `algebra-models-v1` reader
capabilities. Clients lacking either capability cannot open it. Contextual worked
examples introduce the complete question on its own reading frame, then reveal
one reasoning step at a time. A question dialog keeps the original assumptions
available from each step; short equation examples retain their mathematical
emphasis. Context frames are checked at ordinary and 125% body-text sizes.

## Instruction and assessment scope

The page/task crosswalk in `books/in-the-same-proportion/alignments.ts` identifies
selected components of [grade-six ratio and rate reasoning](https://www.thecorestandards.org/Math/Content/6/RP/)
and [grade-seven proportional relationships](https://www.thecorestandards.org/Math/Content/7/RP/).
Fractional-quantity unit rates are mapped separately to grade seven.

Three existing deterministic families have exact teaching-page bindings:
integer scaling of a paint ratio, constant integer unit-price calculations,
and exact percent-of calculations. Their domains are narrower than the book's
instruction. They do not assess constructed diagrams, explanations, fractional
rate reasoning, missing percent wholes, open design, physical feasibility or
complete standards. Reading a page and answering one item correctly do not
establish durable mastery.

## Review and export

Run `npm test`, `npm run tsc`, `npm run audit`, and
`npx tsx scripts/verify-ratio-reader.ts` for source and semantic-model checks.
`npm run test:book-ui -- --book in-the-same-proportion` checks every registered
reader frame against phone and landscape layouts using the isolated test
database described in the application setup.

Export with `npx tsx scripts/publish-book.ts --book in-the-same-proportion --all-pages`.
The publisher checks text and diagram bounds, PDF page count and extracted text,
and records exact authored and rendering source hashes. These automated proofs
are separate from independent mathematics and rendered-page review.
