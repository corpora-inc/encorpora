# Build shapes on a peg board

The `peg-board-v1` response lets learners join two pegs with a stick, remove a
stick by tapping it, and reset their build. Drawing tasks also accept dragging
between pegs. The five-by-five board keeps every peg's touch target at least
44 pixels wide and tall at a 320-pixel viewport. The selected starting peg is
a dashed ring; it does not add a stick or change the counts.

The `build-and-draw-shapes` skill includes three builder templates:

- `build-shape-sticks-balls`: triangles, squares, rectangles and hexagons,
  with build/draw skins and given-side completion tasks.
- `build-shape-by-count`: any simple shape with 3–6 sides or corners.
- `copy-peg-shape`: an exact copy at another position, with rotation permitted
  only when stated. Reflection and resizing do not count as copying.

Clients without the capability use the skill's existing planning and drawing
judgment templates. The interaction grades peg-to-peg drawing; freehand drawing
and a pictured-object building variant are outside these templates.

## Geometry and evidence

Answers are sets of undirected edges. Integer geometry requires one closed
loop, actual turns at every corner and no intersecting nonadjacent sides.
Square corners use perpendicular edge vectors; equal sides use squared lengths.
A square satisfies a rectangle task. Copy matching uses exact dot and cross
products, preserving orientation while allowing either traversal direction.

Guessing estimates use a declared model: choose 3–8 distinct pegs in random
order and close the walk, retaining a given first side when present. Other side
counts fail, so their probability is integrated exactly. For the required side
count, 2,048 deterministic samples estimate the geometric acceptance fraction,
with add-one smoothing, then divide by six. Triangle and count-only tasks can
have substantial chance success under this model; squares and copies have
much smaller estimates. The family-level upper bound is 1/6. These estimates
describe random walks, not measured learner behavior.

The focused tests exhaust lattice triangles and rectangles, check exact
copying and malformed answers, and send 480 generated cases to an independent
Python geometry oracle. The browser script uses real practice routes, an
isolated database schema, server grading, canonical retries and problem reports.
It tests keyboard movement, provisional selection, pointer and keyboard removal,
dragging, reset announcements, 44-pixel pegs, overflow and stable bounding boxes.
It checks that feedback leaves the entire board and counts visible.

Run the browser test with a disposable `AMP_TEST_DATABASE_URL` and an optional
`AMP_EVIDENCE_DIR`:

```sh
npm run test:peg-board-ui
npm run test:peg-board-ui -- --webkit
```

Screenshots cover 320, 390, 768 and 1280 pixels, light and dark themes, with
empty, provisional, filled, correct and incorrect states. Selected evidence:

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [Square](square-320-light-filled.png) | [Copy, correct](copy-320-dark-correct.png) |
| 390 | [Drawing](draw-390-light-filled.png) | [Finish a rectangle](finish-390-dark-filled.png) |
| 768 | [Count corners](count-768-light-filled.png) | [Copy, incorrect](copy-768-dark-incorrect.png) |
| 1280 | [Count corners](count-1280-light-filled.png) | [Square](square-1280-dark-filled.png) |

See also the [empty board](square-320-light-empty.png),
[provisional start](square-320-light-provisional.png), and
[open shape feedback](square-320-light-incorrect.png).
