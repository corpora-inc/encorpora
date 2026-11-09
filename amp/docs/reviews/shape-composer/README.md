# Shape composer

Grade 1 learners fill an outline with flat pieces, then use a completed shape as a piece in a larger shape. `compose-flat-shape` joins the existing `composite-shapes` skill. It has two-piece, many-piece and two-stage variants, with 20 recipes spanning squares, rectangles, triangles, trapezoids, half-circles and quarter-circles.

The client declares `shape-composer-v1`. Older clients continue to receive compatible formats, including the existing shape-recognition problems. The composer uses the existing practice route, answer dock, feedback and lesson system.

Tap a tray piece and a grid space to place it. Turn rotates clockwise by a quarter turn; Flip mirrors the right-trapezoid piece. Placed pieces can be moved or removed. Dragging also places pieces. The tray wraps to keep every piece visible on phones. Its cards draw the current turn; placed pieces are dimmed and checked. Keyboard controls use arrows, Enter, R, F, Delete and Escape. A live region announces the selected piece, turns in everyday language, placement, overlap or overhang, and an approximate percentage left empty. The percentage is an accessibility estimate; grading is exact.

The target has a lightly tinted interior and a contrasting outline above the pieces, with space around the grid to keep its edge visible. Overlaps and overhangs have stripes. A faint preview follows the pointer or keyboard focus and disappears after grading. Two-stage problems use a fixed two-step indicator: make a shape, then use it as one piece.

The board fills the available phone width during placement. In review, the inactive tray is hidden and the board fits the space above feedback, keeping the prompt visible. Incorrect feedback names the gaps, overlaps or overhangs in the submitted board. “Show one way” replaces the displayed arrangement in the same board. Screen-reader review describes every displayed piece, its turn and its position for either arrangement.

## Exact grading and guess chance

Straight-edged cells use four triangular atoms. Quarter-disks use symbolic curved fills. Turns and flips preserve this lattice representation, so acceptance needs no floating-point tolerance. Every stage must cover its target with no gaps, overlaps or overhangs, and satisfy any named-piece requirements. Different valid tilings earn credit. Unused optional pieces are allowed.

The declared guess chance counts all accepted arrangements among independent, uniformly chosen unused/position/turn/flip states for every labelled tray copy. Symmetric poses and alternative solutions are counted; the two-stage chance is the product of the stage chances. This describes random placement, not a learner strategy. The largest generated chance is `2 / 441`.

An independent Python oracle reconstructs the geometry and exhaustively searches valid covers. It checks reference answers, required pieces, inert distractors, target names, composite reuse and the declared probability. Tests also attack the keys with missing, duplicated, shifted and rotated pieces.

## Scope

The board has five columns and four rows, at most six tray pieces and at most two stages. Stage 2 supplies two copies of the completed stage-1 shape as whole pieces. Rotation and reflection preserve size. The interaction covers 2D composition; 3D stacking is outside this implementation. Printable exercises show outlines and piece trays; the lesson illustrates triangles making a square and two squares making a rectangle.

## Verification

Run these commands from `amp/`; supply a disposable PostgreSQL database with a test-labelled name for the browser script. `AMP_EVIDENCE_DIR` selects the screenshot destination. The script creates and drops an isolated schema, starts its own app and Vite server on port 4586, and uses real attempt and problem-report endpoints.

```sh
node --import tsx --test tests/shape-composer.test.ts
npm run tsc
npx vitest run --environment jsdom src/web/lib/__tests__/batch-capability-transport.test.ts
npm run test:shape-composer-ui
npm run test:shape-composer-ui -- --webkit
```

The Chromium and WebKit browser matrices cover 320, 390, 768 and 1280 px in both themes, with empty, preview, filled, gap, correct, incorrect and reference-solution states. The 390 px viewport is 844 px tall. Assertions cover visible prompts and target outlines; the full tray without horizontal scrolling; the complete active workspace without scrolling at 390 × 844; stable prompt, board, tray, controls and answer-dock bounds during placement, turns, removal, reset and step transitions; 44 px targets; keyboard operation; mouse dragging; touch tapping; canonical retries; problem reports; and legacy-format delivery. Chromium also checks native touch dragging. Geometry receipts accompany the screenshots.

## Representative screens

| Width | Light | Dark |
| --- | --- | --- |
| 320 | ![House filled at 320 px, light](house-320-light-filled.png) | ![House filled at 320 px, dark](house-320-dark-filled.png) |
| 390 | ![Joined half-circles at 390 px, light](joined-circle-390-light-filled.png) | ![Joined half-circles at 390 px, dark](joined-circle-390-dark-filled.png) |
| 768 | ![Flipped trapezoid at 768 px, light](flip-trapezoid-768-light-filled.png) | ![Flipped trapezoid at 768 px, dark](flip-trapezoid-768-dark-filled.png) |
| 1280 | ![Triangles at 1280 px, light](triangles-1280-light-filled.png) | ![Triangles at 1280 px, dark](triangles-1280-dark-filled.png) |

![Empty outline on a phone](triangles-320-light-empty.png)
![Correct composition on a phone](triangles-320-light-correct.png)
![Overlapping triangles after grading](triangles-320-light-incorrect.png)

![Two-step composition at 320 px](joined-circle-320-dark-filled.png)
![Full tray and board at 390 × 844](house-390-light-gap.png)
![Turned piece and landing preview](flip-trapezoid-390-light-preview.png)
![Overlap feedback with the target outline visible](triangles-1280-dark-incorrect.png)

Geometry receipts: [Chromium](geometry-chromium.json), [WebKit](geometry-webkit.json).

Printable lesson: [Letter](lesson-Letter.pdf), [A4](lesson-A4.pdf).
