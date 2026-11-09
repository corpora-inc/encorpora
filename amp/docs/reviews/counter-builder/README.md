# Counter builder

`build-the-number-sentence` practices K.OA.A.1 in `represent-join-separate`. Learners build joining and take-away models, including a two-color ten frame, then choose number and sign tiles for the matching sentence. Each object has one fixed size. Taking away leaves crossed-out ghosts so the starting quantity stays visible.

Add buttons and empty spaces place objects. Tapping a join counter removes one from its group; tapping a take-away counter crosses it out or restores it. Undo removes an accidental placement, and Reset clears the model and sentence. Keyboard controls and live announcements describe the group sizes and sentence. Complete wrong models are submitted as first attempts; the board and sentence must both match for credit.

The `counter-builder-v1` capability gates the interactive format. A client with `figure-choice-v1` and `scenes-v1` receives four pictures of the same quantities and action. The family guessing estimate covers that fallback's 1/4 chance. For the builder itself, independent enumeration covers 66 labelled boards and 2 × 11³ sentence choices; joins accept either group order and either addend order. Physical fingers, claps, sounds and acting out are outside this interaction; the required media is unavailable.

## Verification

`tests/counter-builder.test.ts` checks exact acceptance, malformed inputs, deterministic generation, all variants over 500 seeds, answer privacy, capability fallback, guessing by independent enumeration, print rendering and lesson examples that do not solve the active item. The independent Python oracle reads public prompts and rejects 1,500 deliberately corrupted keys. The runtime contract and family registry tests also pass.

`npm run test:counter-builder-ui` uses the real practice routes and API with a disposable `AMP_TEST_DATABASE_URL`. Set `AMP_EVIDENCE_DIR` to choose the output folder; add `-- --webkit` to run WebKit. It captures empty, filled, correct and incorrect states at 320, 390, 768 and 1280 pixels in both themes. Assertions cover stable geometry when counters and Xs change, no horizontal overflow, 44-pixel targets, keyboard editing, reset announcements, reachable tiles and sentence, visible feedback actions, hidden selection after grading, exact API grading, idempotent retries, legacy capability fallback and stored problem reports. Letter and A4 lesson exports are included in the generated evidence.

## Representative screens

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [Filled join](build-join-320-light-filled.png) | [Filled join](build-join-320-dark-filled.png) |
| 390 | [Filled join](build-join-390-light-filled.png) | [Filled join](build-join-390-dark-filled.png) |
| 768 | [Filled join](build-join-768-light-filled.png) | [Filled join](build-join-768-dark-filled.png) |
| 1280 | [Filled join](build-join-1280-light-filled.png) | [Filled join](build-join-1280-dark-filled.png) |

[Empty](build-join-320-light-empty.png) · [Correct](build-join-320-light-correct.png) · [Incorrect](build-join-320-light-incorrect.png) · [Take-away story](story-take-390-light-filled.png) · [Take-away feedback](story-take-390-light-incorrect.png) · [Ten frame](build-frame-390-dark-filled.png)

The committed screenshots contain synthetic problems. Geometry receipts cover every captured variant, theme and viewport.

Both Chromium and WebKit passed 80 graded browser cases each. The focused contract, generation, oracle, registry and lesson tests passed 14 cases; capability transport and fallback passed 19 cases; the existing legacy-client admission regression passed; TypeScript passed. Letter and A4 lesson exports were visually inspected.
