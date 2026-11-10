# Arrays and equal addends

`array-equal-addends-equation` practices 2.OA.C.4 in the `arrays` skill. Learners set rows and columns to build a story's array, or group a given array by tapping its rows or columns. They build an addition sentence with one equal addend per group and enter the total. Problems include rectangular arrays, squares, a columns-only prompt, and array-building stories. Each dimension is at most five.

The control shares the counter builder's object drawings, sentence slots, sign drawings, and number keypad. The array occupies a fixed area. Drawings shrink on phones while horizontal and vertical gaps stay at least a quarter of the drawing's size. Tappable rows and columns retain 44-pixel targets. The equation keeps the page's side gutter and tiles of at least 44 pixels. If the complete sentence cannot fit on one line, it breaks before the equals sign, with the addends and “= total” centred on separate lines. Addends never split across lines. The keypad uses two rows with Erase beside them. Short screens scroll the problem above the Reset/Check bar. Reset clears the learner's work. Switching grouping direction starts a fresh sum; selecting a group with a different count also starts that count's sum.

Tab selects a sentence slot. Number keys fill it; arrow keys move between slots. Backspace removes an addend or erases a total digit. The number keypad dims other addend values after the first choice. Live announcements describe the array and the sentence. Incorrect feedback identifies the dimension, addend, count, or addition error in one sentence.

Server grading requires the story's exact array dimensions, equal addends matching the permitted row or column grouping, the correct number of addends, and the correct total. Both directions earn credit when the prompt allows either. Complete wrong models, including directly submitted mixed addends, are recorded as incorrect attempts.

`equal-addends-v1` gates the interaction. Clients supporting `single-choice-v1` and `scenes-v1` can receive four equations for the same array instead. The declared interactive guessing bound uses five addend values, five counts, and 100 total entries; array-building also has 25 possible dimension pairs. One or two sentences are accepted depending on orientation and whether the array is square. The family estimate covers the fallback's 1/4 guessing chance.

## Verification

`tests/equal-addends.test.ts` checks every permitted dimension and orientation, malformed input, complete wrong answers, deterministic generation over 2,000 seeds, fallback uniqueness, guessing, printing, and lesson examples that do not solve the active array. The Python oracle derives sums from public dimensions or the story and rejects corrupted dimensions, addends, and totals. Reporting-migration tests cover fresh installs and upgrades while retaining other response formats.

Run `npm run test:equal-addends-ui` with a disposable `AMP_TEST_DATABASE_URL`; set `AMP_EVIDENCE_DIR` to a local folder for screenshots and geometry receipts. Keep measurement JSON outside the repository. Add `-- --webkit` for WebKit or `-- --smoke` for the 390 × 844 phone smoke check. The browser test uses real practice routes and API grading. It checks horizontal overflow, object gaps, sentence gutters and wrapping, fixed geometry while resizing/building/grading, keypad visibility and clickability above the dock, 44-pixel targets, keyboard entry, reset, grouping, announcements, exact grading, idempotent retries, older-client fallback, and stored problem reports. It also exports the lesson in Letter and A4 formats.

## Representative screens

All screenshots use synthetic problems.

The Chromium and WebKit matrix covers all four variants at 320 × 900, 390 × 844, 768 × 1024, 1280 × 900, 320 × 568 and 844 × 390, in both themes. Every object is also exercised in the two 320-pixel viewports. On macOS, WebKit keyboard tests use Option-Tab to include buttons in navigation.

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [Build an array](chromium-build-array-320-light-right-filled.png) | [Build an array](chromium-build-array-320-dark-right-filled.png) |
| 390 | [Build an array](chromium-build-array-390-light-right-filled.png) | [Build an array](chromium-build-array-390-dark-right-filled.png) |
| 768 | [Build an array](chromium-build-array-768-light-right-filled.png) | [Build an array](chromium-build-array-768-dark-right-filled.png) |
| 1280 | [Build an array](chromium-build-array-1280-light-right-filled.png) | [Build an array](chromium-build-array-1280-dark-right-filled.png) |

[Empty](chromium-build-array-320-light-empty.png) · [Correct](chromium-build-array-320-light-correct.png) · [Incorrect](chromium-rows-or-columns-390-light-incorrect.png) · [Five by five](chromium-square-390-dark-right-control.png) · [Wrapped sentence](chromium-square-320-dark-right-filled.png) · [Columns](chromium-by-columns-390-light-right-control.png)
