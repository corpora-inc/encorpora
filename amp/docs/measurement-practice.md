# Measurement practice

Fifteen deterministic problem families connect ruler positions, rectangle borders,
surface coverage and metric lengths. They participate in the same mixed practice
and spaced review as arithmetic, fractions and algebra. A focused family is also
available from the practice chooser.

| Family group | What a response establishes | Important limits |
| --- | --- | --- |
| Shifted rulers | An exact whole, half or quarter-centimeter interval between displayed positions | Does not assess choosing or using a physical measuring tool. Fractional intervals extend the whole-unit entry skill. |
| Rectangle dimensions | A full perimeter or missing side from stated dimensions, area or perimeter | Positive integer sides only; a numerical result does not establish a construction or explanation. |
| Border and coverage | A unit choice or comparison between two rectangles | Same area need not mean same perimeter. Same perimeter need not mean same area. Selection does not assess an independently constructed counterexample. |
| Metric lengths | Selected meter/centimeter and kilometer/meter conversions, a mixed-unit sum or perimeter | Exact fractional outputs are allowed. Mass, capacity, time, customary units and area-unit conversions are outside these families. |
| Design constraints | A choice satisfying fixed area and perimeter conditions, or an impossibility decision | The domain is positive whole-number sides. An exhaustive factor-pair argument is required to justify impossibility; real-valued rectangles are outside that claim. |
| Material costs | A total-bill comparison between whole packs and divisible ribbon | Pieces join without loss, no other charges apply, and unused material does not reduce the bill. Ties are possible. |

The standard crosswalk represents selected components of grade-two length
measurement, grade-three perimeter, grade-four rectangle formulas and larger-to-smaller
unit conversion, grade-five metric conversion, and grade-four multistep whole-number
stories. No family or book visit establishes complete standard mastery. The detailed
domains and teaching destinations are recorded in `src/content/measurement-definitions.ts`.

## Diagrams and compatibility

Ruler ticks use exact integer numerators and denominators. The strip begins at a
nonzero position, so its length cannot be read from its final label alone. Accessible
figure descriptions state the same endpoints and subdivisions as the drawing.

Missing-side rectangles contain only known measurements and an explicit unknown.
Their fixed schematic shape cannot reveal the answer through proportions. Comparison
rectangles use one common physical unit scale on both axes. Text and letter labels
preserve meaning without color. Every drawing is schematic, not a life-size ruler.

The app and reference publications share the SVG renderer. A client advertises
`measurement-models-v1` in `figureCapabilities` before the server selects these
figures; choice responses independently require `single-choice-v1`. Unsupported
focused requests fail before an instance is saved. Older clients receive supported
families in mixed practice.

## Review

`npm test` includes exact public-givens solving by an independent Python oracle,
strict model validation, choice uniqueness, boundary coverage and shared-scale
geometry. `npm run test:db` verifies client compatibility, ownership, immutable
server grading and attempt replay against an isolated test database.

`npm run test:measurement-ui` checks rendered labels, collisions, viewport fit,
focused feedback and printed figures. It requires `AMP_TEST_DATABASE_URL`; set
`AMP_MEASUREMENT_BROWSER=webkit` for the WebKit run. Browser emulation does not
replace physical-device acceptance.
