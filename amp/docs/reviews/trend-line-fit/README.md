# Fit and read trend lines

The `trend-line-fit-v1` response lets a learner fit a straight line to a scatter plot with two square handles. Drag a handle, or select it and use arrow buttons or keys. The line extends across the plot. The handles must have different horizontal coordinates; they move in the horizontal axis's step and one vertical unit.

The grade 8 `scatterplots` skill includes three families in this change:

| Family | Task |
| --- | --- |
| `trend-line-fit` | Fit a line to a rising or falling cloud. |
| `trend-line-compare` | Compare two lines on identical data and scales. |
| `trend-line-read` | Read a rounded estimate from a fitted line within the observed range. |

The existing four-line comparison, fit assessment (including curved clouds), prediction and slope-meaning families continue to use their existing protocols. Clients must declare `trend-line-fit-v1` to receive the fitter. Its teaching examples and printed exercises use the shared scatter scene; paper asks for a line, without referring to controls.

## Informal grading

Let `MSE` be the mean of the squared vertical gaps from the dots to a line. The reference is the least-squares line, which minimizes that quantity. A submitted line passes when both conditions hold:

- `MSE(student) <= 1.6 * MSE(least squares)`.
- Its slope divided by the least-squares slope is between `0.65` and `1.5`, inclusive. This also requires the same sign.

Two complete lattice points with different horizontal coordinates are required. Swapping them preserves the answer. The server grades the whole cloud; it does not compare against one exact pair. A line through two data points can pass if it fits the whole cloud. Merely touching two dots does not earn credit.

After grading, the learner's solid rust line and one dashed good fit appear together. Vertical sticks show the distances to both lines. Handles disappear, while the plot and controls' reserved space stay fixed. The data table exposes each dot and its distances after grading. Coordinate and slope changes are announced before grading, without revealing closeness scores or above/below counts.

The schema declares a conservative 5% guessing estimate. The explicit model chooses two distinct lattice columns uniformly and a height independently in each. Exhaustive enumeration across 500 seeded clouds gives a pass-rate range of **0.266%–2.878%**. Every audited cloud has at least 15 accepted pairs spanning the left and right thirds, and at least 25% of center-passing lines within 20% of the reference slope pass. The tolerance is an engineering calibration backed by these checks, not a learner-study result.

## Verification and screenshots

`tests/trend-line-fit.test.ts` checks determinism, cloud diversity, both signs, all six contexts, hand-fit reachability, guessing, malformed submissions, capability gating, misconceptions, lessons and print. An independent Python oracle uses rational arithmetic to check 600 generated problems and deliberately corrupted keys.

`npm run test:trend-line-fit-ui` runs the real practice routes and server grading against a disposable test database. `--webkit` runs the same checks in WebKit. The matrix covers 320, 390, 768 and 1280 px in light and dark themes, both trends, initial and fitted states, and correct and incorrect results. It asserts no horizontal overflow or movement of the prompt, plot, controls or answer dock; verifies 44 px targets, drag, tap, arrows, Reset, equal-horizontal-coordinate refusal, disappearance of handles, visible feedback and idempotent answer replay. Companion comparison and reading screens are captured at every size and theme.

Run with `AMP_TEST_DATABASE_URL` set to a disposable database and `AMP_EVIDENCE_DIR` set to the screenshot destination. The script starts loopback API and Vite servers, uses an isolated database schema, and removes its fixtures afterward.

| Initial, 320 px | Fitted, 320 px |
| --- | --- |
| ![Initial scatter plot](fit-positive-320-light-empty.png) | ![Fitted line with square handles](fit-positive-320-light-filled.png) |

| Correct, 390 px | Incorrect, 320 px dark |
| --- | --- |
| ![Accepted hand fit and reference](fit-positive-390-light-correct.png) | ![Incorrect horizontal fit and vertical distances](fit-negative-320-dark-incorrect.png) |

[Tablet interaction](fit-positive-768-light-filled.png) · [Desktop feedback](fit-negative-1280-dark-correct.png) · [Two-line comparison](trend-line-compare-390-light.png) · [Reading an estimate](trend-line-read-390-light.png).

Geometry receipts: [Chromium](geometry-chromium.json), [WebKit](geometry-webkit.json).
