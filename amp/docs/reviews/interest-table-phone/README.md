# Interest tables on narrow phones

The interest-table problem keeps both account columns visible inside the practice pane. At viewport widths up to 380 px, its table uses a 16 px base font while the surrounding prompt retains its 18 px font. Larger viewports keep their existing typography.

The screenshots use synthetic generated problems in the real `PracticeWorkspace` layout harness. The 320 px captures show the question pane scrolled to its table; the answer control and practice actions remain accessible.

| Width | Light | Dark |
| --- | --- | --- |
| 320 | [Screenshot](320-light.png) | [Screenshot](320-dark.png) |
| 390 | [Screenshot](390-light.png) | [Screenshot](390-dark.png) |
| 768 | [Screenshot](768-light.png) | [Screenshot](768-dark.png) |
| 1280 | [Screenshot](1280-light.png) | [Screenshot](1280-dark.png) |

## Focused verification

- Rendered 100 deterministic `interest-table-type` seeds at 320 × 568, plus two seeds at 360 × 640, 380 × 740, 390 × 844, 768 × 1024, 1024 × 768, 1280 × 900 and 844 × 390.
- Ran both light and dark themes with native and Roboto text fonts: 456 checks total.
- Forced 15 px scrollbar gutters to reproduce the constrained 258 px question area. Twenty baseline seeds overflowed; the same twenty seeds fit with the scoped table rule. The representative table measured 241.8 px after the change.
- Used the existing `assertProblemReachable` predicate for portrait, tablet and desktop cases and `assertPhoneLandscapeSmoke` for phone landscape. No assertion or generated problem changed.
- Ran `npm run tsc`, `npm run build` and `npm run test:core` (1,384 passing tests).

These checks cover the affected problem layout. They do not establish full application or launch acceptance.
