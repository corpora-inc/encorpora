# App-shell premium pass

Follows [the app-shell polish review](../app-shell-polish/README.md). It covers the same screens outside practice and lesson bodies, plus the workbook list. The practice workspace, lesson bodies and the navigation drawer's settings sections are owned elsewhere and are unchanged here.

## Method

- `scripts/audit-app-shell-ui.ts` in Chromium at 320, 390, 768 and 1280 px, plus the 844×390 smoke, in light and dark, against the synthetic fixture.
- Every screen photographed and reviewed by eye, including screens the audit does not visit: the first-run steps, access, purchase routes, workbooks and the drawer scrolled to its end.
- Two probes were added to `scripts/app-shell-probe.ts`. `hoverHugs` hovers every visible control and reports any filled or hover background that comes within 8 px of its label. A layout-shift recorder lists the elements that moved while each screen loaded.

The audit found no overflow, no targets under 44 px, no broken words and no axe violations. Its remaining failures were layout shifts. The other findings below come from reviewing the screenshots and from the probes.

## Findings, ranked

| # | Finding | Where | Status |
| - | --- | --- | --- |
| 1 | **Security settings jumped 21 px after load** (CLS 0.17 at 390 px). The freshness line rendered "Changes require a sign-in…" and swapped to "Sign in again…" a frame later. While loading, a "Load security settings" button stood in place of the settings. | `AccountSecurity` | Fixed: one clock reading decides the line on the first frame; a placeholder of the settings' shape holds their place while they load; the button appears only after a failure, as "Try again" |
| 2 | **Progress cards dropped 128 px** when the history arrived (CLS 0.08–0.10). The area picker and filters were added above them. | `ProgressWorkspace` | Fixed: the controls hold their place, hidden and inert, until the history loads |
| 3 | **Quiet buttons could lose their inset.** A feature rule that zeroes `padding-inline` to line a label up with its column leaves the hover fill hugging the words, as with "Reset practice level" in the navigation sheet. | `ui/Button`, `Controls.module.css` | Fixed in the kit: a quiet button's inset outranks any single feature selector. `align="start"` lines the label up with its column by moving the fill into the gutter with a negative margin |
| 4 | The branded bar put the wordmark at the far edge, away from the menu, on every top-bar `PageFrame` screen. Workbooks shows it. The legacy global `header` rule spaced them apart. | `PageFrame` | Fixed |
| 5 | Picker chevrons were a text glyph (⌄) sitting on the baseline, visibly below the label's centre. This affected the header learner picker, Progress, Lessons, Family and the purchase pickers. | `ui/Select` | Fixed: the drawn chevron the kit's Listbox and Menu use. The options dialog's × is a drawn icon too |
| 6 | Signed-in addresses split at a hyphen ("new-" / "c39…@example.com") on account ready and confirm email. | `AccountReady`, `VerifyEmailStep` | Fixed: an address moves to its own line whole |
| 7 | Landing: "Try free" was 64 px and 22 px type, beside a 56 px / 17 px "Parent sign in". | landing | Fixed: one size, one type |
| 8 | Plans: at desktop the three education-fund buttons wrapped unevenly ("Use Arkansas / EFA funds" beside one line). "Other programs" sat centred in a grid cell, out of line with its label. | `Paywall` (`Trial.module.css`) | Fixed: one program per row at every width; the link aligns with the label |
| 9 | The wordmark's hover fill touched its letters on every centred card (sign-in, sign-up, assessment, plans). | `FrameBrand` | Fixed (found by `hoverHugs`) |
| 10 | The level map flashed shorter while the curriculum loaded. Its rows were filtered by a catalog that had not arrived, so the map grew under the reader. | `LegacyApp` (Home) | Fixed: every area holds its row while the catalog loads |
| 11 | Purchase: the learner's name arrived late and moved both payment cards down 28 px. | `ChooseHowToPay` | Fixed: the line is reserved |
| 12 | Inventory: the explainer slid down from under the loading line (CLS 0.06–0.09). | `InventoryScreen` | Fixed: it follows the skills once they load |
| 13 | Pathways on a phone: the learner picker jumped 116–166 px left when a skill's notice hid the count beside it. | `pathways.css` | Fixed: the picker is pinned to the row's end |
| 14 | Security sat in a narrower 704 px column, centred inside Family's 800 px tabs. The other tabs use the full column. | `account-security.css` | Fixed |
| 15 | Family › Access had no visible heading. Its siblings show "Who's learning?", "Privacy and records" and "Sign-in & security". | `FamilyCenter` | Fixed: "Learning access" is shown |
| 16 | "Where you are" was a serif heading on the assessment map and a sans heading on Home. | `theme.css` | Fixed: one section heading |
| 17 | Workbooks: "Enter results with the workbook code" wrapped at the input's width, leaving the space above "Open" empty. | `Workbooks.module.css` | Fixed: the label spans the field and its button |
| 18 | The drawer's "Progress" group was titled "Your progress" above a link also named "Your progress". Four account links shared one icon. | `DrawerContents` | Fixed |
| 19 | Lessons: the search placeholder was clipped mid-word at 390 px and inherited the label's semibold weight. | `LessonLibrary.module.css` | Fixed: regular weight, ellipsis when a phone is too narrow |
| 20 | Workbooks on a 320 px phone: while the list loaded, its 168 px placeholder pushed the page footer off screen. The footer then returned when the list came back empty (CLS 0.03). | `WorkbookHistoryScreen` | Fixed: the empty line's place is held while the list loads |
| 21 | Two focus rings: 2 px primary from `theme.css` on legacy controls, 3 px focus-ring colour on the kit. | `theme.css` | Fixed: one ring (3 px, `--color-focus-ring`) |

## Remaining

- **Stale sign-in still offers security actions.** With a sign-in older than five minutes, "Add passkey" and the other actions stay on screen and answer with an error. That breaks the no-guaranteed-failure rule. The next step should be "Sign in again" in place of each action.
- Purchase still moves 24 px (CLS 0.007) when the card offer replaces "Loading…" with a taller plan list. With Stripe configured, the plan list is much taller. It needs a skeleton of the plan options' size.
- Inventory's filter chips change width when their counts replace "—" (no vertical movement).
- Home, Pathways and Inventory use different frames. Inventory is 1072 px wide with "Keep learning" in its header; Home is 800 px under the Practice, Lessons and Progress tabs. This is the information-architecture item already deferred (#23 in the previous review).
- Family is a long run of ad hoc values: radii of 10, 12, 14, 16 and 18 px, and paddings of 9 to 28 px. They should move to the space and radius tokens screen by screen, each change reviewed in screenshots.
- The header's 6 px between the brand mark and the tabs below is tight on every app screen. Changing the 60 px bar height moves every sticky offset, so it needs its own pass.
- `npm run format:check` reports 20 files on `main` that this change does not touch.

## Verification

`scripts/verify-app-shell-ui.ts` (`npm run test:app-shell-ui`) now also asserts:

- no filled or hover background within 8 px of its label on any screen (Chromium, 390 and 1280);
- no layout shift above 0.01 while any screen loads (Chromium);
- the landing actions share one height;
- the picker chevron is centred on its label within 1 px, in both themes;
- the wordmark sits beside the menu in both frames;
- the account-ready address stays on one line.

Workbooks joined the swept screens.

## Screenshots

`before/` and `after/` hold the same Chromium screens: landing, account ready, workbooks and progress at 390 px, and plans and security at 1280 px.
