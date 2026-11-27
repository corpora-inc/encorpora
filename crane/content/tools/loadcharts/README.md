# Load charts

Original, fictional crane load charts and deterministic practice-problem
generators for exam-style load-chart practice. Every chart is invented for
training. None copies a manufacturer's chart, and none may be used to plan a
real lift.

## Contents

| Path | What it is |
| --- | --- |
| `schema.json` | JSON Schema for a chart. |
| `charts/*.json` | Five charts (below). Capacities in pounds, lengths in feet. |
| `index.ts` | Types, the `CHARTS` registry, and lookups that apply the chart rules. |
| `generators.ts` | Seeded problem generators: 14 families. |
| `schema-check.ts` | A tiny JSON Schema validator for the tests. |
| `*.test.ts` | `node --test` suites. |

Charts:

| id | Class | Configurations |
| --- | --- | --- |
| `ht-50` | Hydraulic truck crane, swing cab, 38–110 ft boom, 33/56 ft extension | outriggers full 360°, mid 360°, on rubber over the rear |
| `rt-40` | Rough-terrain crane, 35–105 ft boom, 30/50 ft jib | outriggers full, mid, on rubber 360°, on rubber over the front, pick and carry |
| `lc-150` | Lattice-boom crawler, 50–190 ft boom, 30/60 ft jib at 5°/15°/25° | tracks extended, tracks retracted |
| `bt-23` | Telescopic boom truck, fixed cab, 26–86 ft boom, 24/40 ft jib | outriggers full, mid |
| `ak-30` | Articulating (knuckle) boom crane, 0–4 extensions | stabilizers full, mid |

Each chart has structural-strength flags per cell (shaded cells), range-diagram
data that matches the boom geometry, jib ratings with offsets, deductions,
a line-pull table, and plain chart notes (85% / 75% of tipping, next longer
radius, longer boom or lower capacity, blank cells, no-load minimum angles).

## Use from the app

Import by relative path from the repo root; there are no runtime dependencies.

```ts
import { CHARTS, capacityAt, netCapacity, jibCapacityAt } from 'crane/content/tools/loadcharts/index.ts';
import { FAMILIES, createRng, generate, generateProblem, toItems } from 'crane/content/tools/loadcharts/generators.ts';

const p = generateProblem('net-capacity', 1234); // same seed, same problem
const q = generate('jib', createRng(seed));      // or any { next(): number } source
const [mcItem, numericItem] = toItems(p);        // harvest/practice Item shape
```

A `Problem` carries `stem`, an exam-style `setup` table, `answer`, a 4-choice
`mc` form with a rationale per choice, a `numeric` form, worked `steps`, the
chart `cells` it uses (to highlight), `skillId`, `difficulty` (0–1), and
structured `inputs` that recompute the answer. Answers and every intermediate
value are integers or one-decimal values: no calculator needed.

## Skill ids

| skillId | Practices |
| --- | --- |
| `loadchart.read-gross` | Read gross capacity at a listed radius and boom. |
| `loadchart.radius-between-rows` | Radius between rows: use the next longer radius. |
| `loadchart.boom-between-lengths` | Boom between columns: next longer boom, or the lower capacity. |
| `loadchart.deductions` | Total the deductions: block, ball, jib stowed/erected, attachments, rigging. |
| `loadchart.net-capacity` | Gross minus deductions. |
| `loadchart.can-lift` | Can it lift: yes or no, and the margin. |
| `loadchart.percent-capacity` | Percent of gross capacity used. |
| `loadchart.configuration` | Outriggers full vs mid vs on rubber; tracks extended vs retracted. |
| `loadchart.jib` | Jib or extension rating with offset, by boom angle or radius, net of deductions. |
| `loadchart.parts-of-line` | Minimum parts of line for the total load and the line pull. |
| `loadchart.load-weight` | Load weight from dimensions (concrete, steel plate), then the margin. |
| `loadchart.range-diagram` | Boom angle and tip height from the range diagram; radius and clearance from geometry. |
| `loadchart.structural-vs-stability` | Shaded (structural) vs stability cells; percent of tipping. |
| `loadchart.quadrants` | Over the front vs over the side on rubber. |

## Test

```sh
cd crane/content/tools
npm install
npm test        # node --test, 10,000 problems per family
npm run tsc
```
