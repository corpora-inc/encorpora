# Figures: the authoring guide

Every new figure is a **scene**: plain data that a generator emits and one renderer draws, for the screen (light and dark), for print, and for screen readers. Design and rationale: [figures-rfc.md](figures-rfc.md). The code lives in `src/math/scene/`.

## Emit a figure from a generator

```ts
import { numberLine, areaModel, graph, f } from "./scene/author";

figure = { kind: "scene", scene: numberLine({ min: 0, max: 20 }).mark(a).hop(a, b).scene() };
```

- A new family whose problems need their figure sets `requiredFigureCapability: "scenes-v1"`, or `"scenes-v2"` when it draws a second-set component (below). Clients that cannot draw it then never receive it.
- Do not add a figure kind to `contracts.ts`, and do not write a one-off component.
- `.scene()` validates with zod and throws on a bad spec. Run the generator's tests.

## The author API

| Builder | Draws |
|---|---|
| `numberLine({min, max, step?, denominator?})` then `.mark(at)`, `.hop(from, by)`, `.then(by)`, `.interval(from, to, open)` | number lines, fraction lines, jumps, inequality rays |
| `graph({x, y, grid?, tick?, aspect?, axisNames?})` then `.point`, `.line`, `.curve(fn, {domain, ends, features})`, `.shade("y < 2x + 1", …)`, `.shadeCurve`, `.circle`, `.segment`, `.slope`, `.secant`, `.scatter(points, fit, residuals)` | coordinate planes and function graphs |
| `f.poly(2, -3, 1)` (highest power first), `f.vertex(a, h, k)`, `f.rational(num, den)`, `f.exp`, `f.log`, `f.sin`, `f.cos`, `f.tan`, `f.abs`, `f.sqrt` | exact functions; zeros, vertex, intercepts, asymptotes and holes come from the formula |
| `areaModel(34, 6)` (split by place value) or `areaModel([30, 4], [6])` | area models |
| `polyArea(across, down)` | polynomial products as algebra tiles |
| `array(rows, cols, {splitAfterRow})`, `tenFrame(8, 5)`, `baseTen(247)`, `fractionBar({shaded, parts})`, `clock(h, m)` | early-number models |
| `table({…})`, `rowBars({…})` | two-way tables and row-percentage bars |
| `angle({rays, marks, labels})`, `protractor(rays, labels)` | angles and measuring |
| `{type: "circleGraph", sectors}` | circle graphs: sector angle = value ÷ total; `text` (percent, angle or count) may be absent or `derived` |
| `{type: "thermometer", unit, min, max, minor, major, reading}` | a liquid thermometer in °F or °C, negatives included |
| `{type: "ruler", unit, length, parts, object}` | inch rulers in halves to sixteenths, centimeter rulers in halves or millimeters, with an object whose ends sit on ticks |
| `{type: "coins", coins}` | pennies, nickels, dimes and quarters drawn to scale without values |
| `{type: "isoSolid", solid}` | unit-cube prisms (`cubes`), labeled boxes, composites and stepped solids (`steps`) |
| `scene(a, b, {type: "brace", …}).build({title})` | several elements in one coordinate system; primitives (`text`, `segment`, `arrow`, `brace`, `polygon`, `arc`, `point`, …) annotate a component in its own math units |

Geometry is in math units with y pointing up. Mark sizes, label sizes and offsets are in pixels and stay fixed whatever the data scale. Width, fit, label placement and print are handled for you: do not pass pixel positions.

## Never show the answer

- A value the learner must find is **derived**: hop landings, area-model products, `featureLabels: "derived"`, table cells in `derived`. These draw as `?` and are described as unknown.
- Lessons render their example revealed. Problems and hints never do.
- Do not put an answer as a literal anywhere in a public scene: not in a primitive `text`, and not in a caption. Captions refer to values by id (`{area.product.0.0}`), so they read `?` in a hint.
- `tests/scene-timeline.test.ts` shows the check to copy for a new family. It runs 300 seeds and verifies that no caption or label states the answer.

## Names: what a step or a hint can point at

Every element has an `id`, and its parts have dotted names. The common ones:

| Component | Parts |
|---|---|
| numberLine `nl` | `nl.tick.5`, `nl.label.5`, `nl.mark.0`, `nl.hop.0` (with `.head`, `.label`, `.landing`), `nl.interval.0` |
| graph `g` | `g.axis.x`, `g.point.0`, `g.line.0`, `g.curve.0` (`.piece.N`, `.vertex`, `.zero.N`, `.yint`, `.asymptote.x.N`, `.hole.N`, `.label`), `g.region.0`, `g.circle.0`, `g.slope.0.run`, `g.secant.0`, `g.scatter.N`, `g.residual.N` |
| areaModel `area` | `area.region.i.j`, `area.across.i`, `area.down.j`, `area.product.i.j` |

A target matches the part it names and every part below it. Run the gallery and inspect the `data-id` attributes when you need a name that is not listed here.

## Timelines: hints and lessons on the learner's numbers

```ts
import { act, step, lessonStep } from "./scene/author";

numberLine({ id: "nl", min: 0, max: 20 }).mark(8).hop(8, 2, { landing: "none" }).then(3).scene({
  steps: [
    step("Start at the greater number, 8.", act.highlight("nl.mark.0")),
    step("8 needs 2 more to make 10. Jump 2.", act.trace("nl.hop.0")),
    step("5 is 2 + 3, so jump the other 3.", act.trace("nl.hop.1")),
    lessonStep("8 + 5 = {nl.hop.1.landing}", act.highlight("nl.hop.1.landing")),
  ],
});
```

- **Actions:**
  - `appear` (pass `true` to stagger) and `disappear`;
  - `trace` draws a stroke;
  - `highlight` lasts for its own step only;
  - `fill(target, role)`;
  - `move(target, [dx, dy])` in math units;
  - `count` counts a label up to its value.
- An element that a step brings in (`appear`, `trace`) is hidden before that step. **The start frame is the problem's figure**, so put the givens in the start frame.
- `lessonStep` reveals the result. Hints stop before it.
- The hint panel plays the problem's own scene, masked. For a hint that the server derives, attach a cue on the private side of the problem:

  ```ts
  return { public: { …, figure }, hint, hintCue: [step("Multiply only the tens part: 30 × 6 = {area.product.0.0}", act.highlight("area.region.0.0"))], … };
  ```

  `/hints` sends the cue with the hint text. A cue that names an element the scene lacks is logged and ignored, and tests should assert `missingTargets(layout, cue)` is empty.
- Motion durations and easing are tokens (`--motion-step`, `--motion-trace`, `--motion-hold`, `--ease-standard`). Reduced motion shows the final frame and every caption.

Complete examples: `src/math/scene/explanations.ts` (`makeTenHops`, `partialProducts`, `partialProductsHint`).

## Second component set: `scenes-v2`

Circle graphs, thermometers, rulers, coins and the `steps` form of `isoSolid` were added after clients shipped with `scenes-v1`. A client that cannot draw one must never receive it:

- A component (or a later form) declares `capability` in `registerComponent`; `sceneCapability(scene)` and `sceneCapabilitiesIn(problem)` report what a figure needs.
- A template whose every instance draws one declares `requiredFigureCapability: "scenes-v2"`.
- An existing family moves a figure onto a new component with a figure-surface axis whose new value declares `needs: { value: "scenes-v2" }` (number-domain-axes.ts). The server generates through `generateProblemFor(templateId, seed, clientFigures)`: for a client without the capability the axis shows its legacy value, and any instance that still needs more than the client declared is rebuilt on legacy surfaces or refused. Lesson examples are drawn for the oldest client that can receive the template.
- An older API rejects `scenes-v2`; the web client then retries once without it (`batch-capability-fallback.ts`).

Layout rules for these components: a circle graph labels every sector inside when all labels fit, otherwise numbers the sectors and lists number, swatch, category and value in a key below; a thermometer keeps minor ticks at least 6 px and labels at least 28 px apart; an inch ruler in eighths is at most 4 inches so eighths stay 7 px apart on a 288 px phone stage, and millimeters are never finer than a real ruler; coins keep true relative diameters and are described by size, color and edge, never by name or value.

## Add a component

1. Create `src/math/scene/components/<name>.ts`. It holds the zod schema (built from `../base`), its type, and `registerComponent("<name>", { compile, describe, maxScale })`.
   - `compile` returns primitives in math units with local part ids.
   - `describe` writes the screen-reader sentence and masks derived values.
2. In `components/index.ts`, add one import line and one array entry, in alphabetical order. Add a builder to `author.ts` if it helps.
3. Add a gallery case to `src/math/scene/gallery.ts`, and unit tests for its geometry and masking.

Labels never need hand placement. Give a label `place` candidates or mark it `optional`, and use `halo` for a paper backing over grids.

## Type size on screen

Figure text sits below the prompt in the type hierarchy and never grows with the room a layout gives a figure.

- A scene draws at its own layout width or smaller, never above 1×. Its labels are `sm` 15 px (ticks, categories, captions), `md` 18 px (table entries, point names) or `lg` 22 px (clock numerals). On a phone a figure may shrink until its smallest label is 12 px; past that the stage scrolls.
- Legacy figures (fixed view boxes) are wrapped in `FigureTextCap`, which caps the box so their largest label is at most 18 px.
- `verify-ui` and `verify-graphical-ui` measure every label at phone, tablet and desktop sizes. Data figures stay at or under 18 px everywhere, and no figure text is larger than the prompt at 768 px and wider.

## Charts

Bar charts, histograms, dot and line plots, box plots, scatter plots and tables follow one standard.

- **Type.** Tick labels are `sm` in the muted text role. Category names are `sm` ink. A scale's name is a muted `sm` caption, left-aligned with the tick labels above the plot. It is not a title.
- **Values.** When an item asks the learner to read the graph, the bars carry no value labels and the gridlines carry the reading. Value labels are only for explanations where the number is given, as in `bars`.
- **Scale.** Use the finest nice step (1, 2, 5, 10…) that keeps 14 or fewer gridlines, so every asked value sits on a gridline. Gridlines are at least 10 px apart and labeled ones at least 28 px apart. Label every gridline, or every 2nd or 5th, and end the scale on a labeled gridline.
- **Lines.** Gridlines are 1 px hairlines in the grid role. The baseline is 1.5 px ink and is drawn over the bars' feet. Bar charts have no vertical axis line. Number-line axes are 1.5 px with 1.25 px ticks, 10 px major and 6 px minor.
- **Marks.** Use one accent for the data. Bars fill 0.6 of their band, up to an 80 px band, and their top corners have a 3 px radius (`roundTop`). Histogram bins touch, stay square, and are separated by a paper hairline. A box plot is a 2 px accent outline with a 3 px radius. Its median is the one highlight, in the warm role.
- **Spacing.** The plot is 150 to 200 px tall and grows by 20 px for each gridline. Labels sit 7 to 8 px from what they name.

## Verify

- `npm run tsc`, `npm test` and `npm run lint:colors`. Paints are role names, never colors.
- `npx tsx scripts/scene-gallery.ts`: every scene at 320, 390, 768 and 1280 px in light and dark. It fails on overflow, a label outside the view box, overlapping labels, a stroke through a label, loose math spacing, or a starved plot. Look at the screenshots in `artifacts/scene-gallery/`.
- `npx tsx scripts/scene-print.ts`: every scene on Letter and A4 print pages through the print layout oracle.
- `npx tsx scripts/verify-scene-player-ui.ts`: walkthroughs in a lesson and in a hint. The panel must not resize, controls must be at least 44 px, playback must finish, and reduced motion must show the final frame.
