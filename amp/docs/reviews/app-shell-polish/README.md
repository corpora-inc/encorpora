# App-shell polish review

Scope: every AMP screen outside the practice flow. That covers sign-in and sign-up, the free assessment (start, map, plans), Home, the navigation drawer, Progress, Pathways and the skill view, Inventory, the lesson library and reader, Family (learners, access, privacy, security), plan choice and the signed-out landing page. The practice screen and its response inputs have their own owner. How grade levels are shown to learners is a separate founder decision (#1781): related findings are listed, but that copy is unchanged.

## Method

`scripts/audit-app-shell-ui.ts` runs the real API (accounts mode, loopback only) against a disposable database. Through the real sign-up endpoint it creates three parents (`scripts/app-shell-fixture.ts`):

- a paid family: consent, two learners with access, and about 150 practice answers for Jordan across grades 2–6;
- a parent who has just signed up;
- a parent part-way through the free assessment.

The audit visits 24 screens in Chromium and WebKit. Each runs at 320×640, 390×844, 768×1024, 1024×768 and 1280×800, in light and dark, plus an 844×390 phone-landscape smoke. It runs against the production bundle. Per screen it records:

- horizontal overflow;
- layout movement of every visible heading and control, frame by frame from the first paint (WebKit has no LayoutShift entries, so the recorder measures boxes);
- every primary heading painted on the way, which exposes flashes of an intermediate screen;
- controls whose effective hit area is under 44 px, probing `::before`/`::after` extensions;
- words broken across lines inside a label, heading or control;
- clipped or truncated text, and overlapping controls;
- an axe scan (WCAG 2.2 AA), a keyboard walk for a visible focus indicator, and refresh restoring the same screen (at 390 and 1280);
- back and forward through the main screens.

The before run covered 253 Chromium and 207 WebKit screen states (WebKit at 320, 390, 768 and 1280). Its findings are below, ranked by how much they cost a parent or learner.

`scripts/verify-app-shell-ui.ts` (`npm run test:app-shell-ui`) asserts each fix, measured rather than inspected. It also asserts no overflow, no overlapping controls and no broken words on every screen at every width and theme.

Clean before the work: axe found no violations on any screen in either engine. Every screen had a real URL. Refresh restored every screen. Back and forward restored all eight main screens in order. No screen overflowed horizontally.

## Findings, ranked

| # | Finding | Where | Status |
| - | --- | --- | --- |
| 1 | **Signed-in screens flashed the signed-out landing page.** A cold load of `/progress`, `/lessons` or a lesson painted "Math at exactly the right level." with a "Getting your family ready…" card, then replaced it. Chromium CLS was 0.18 on Progress. | `LegacyApp` | Fixed: signed in, the family loads behind the same first-paint frame; the welcome only renders signed out |
| 2 | **Home jumped 93–111 px after load.** The working-level readout appeared above the Go button once the estimate arrived, moving every control below it. CLS reached 0.39 at 1024. | `Home.tsx` | Fixed: the readout's space is reserved from the first frame; before any answer, a short line holds the same place |
| 3 | **The assessment map and plans jumped 59–187 px.** Their skeleton was centred in the screen, but the loaded page (taller than a screen) starts at the top. The plan teaser then pushed the actions down another 10–17 px as its text changed. | `TrialFrame`, `Trial.module.css`, `TrialPathwaysOffer` | Fixed: both are top-anchored with their skeleton; the teaser holds its signed-in line while the session loads |
| 4 | **Pathways and Inventory moved under the finger.** The learner picker arrived late and pushed search and the map down 56 px on phones; a longer status line moved the map 4 px on tablets and desktops. Inventory's estimated-level line pushed everything down 30 px. | `PathwaysScreen`, `pathways.css`, `InventoryScreen` | Fixed: the picker row, the two-line status and the level line hold their space while loading |
| 5 | **Family tabs reflowed after load.** The Security tab was added once the sign-in mode loaded, so the other three tabs slid 24–133 px left. | `LegacyApp` → `FamilyCenter` | Fixed: the four-tab layout is used until the mode is known (hosted AMP always uses accounts) |
| 6 | **Two error patterns.** Legacy screens (Home, Lessons, Progress) put request errors in a red banner inside the page, pushing everything below it down. | `LegacyApp` | Fixed: they use the shared fixed toast. Errors stay until dismissed and are logged. Dismissing a failed first load leaves the "Try again" card on screen, never a loading frame with no way out. Family's confirmations were already a fixed overlay and are unchanged |
| 7 | **The assessment map hid its next step.** "Continue placement" sat below 14 strand rows, about 1,600 px down on a phone, with a duplicate "See your illuminated pathways" button above it. | `TrialMap.tsx` | Fixed: the next step and "See plans" follow the readout; the map follows them, and the pathways link is a quiet action (the Pathways tab already leads there) |
| 8 | **Headings lost their word spaces.** The global `h1` letter-spacing was `-3px`, sized for a 76 px heading. Every smaller heading that kept it ran its words together ("Youraccountisready"). | `style.css` | Fixed: `-0.04em`, relative to each heading's size |
| 9 | **Bare links were browser blue and visited purple.** For example the landing footer's support address and the plan screen's "Other programs". | `style.css` | Fixed: unclassed links use the brand ink in both themes |
| 10 | **Targets under 44 px.** The app's Practice/Lessons/Progress tabs (38 px), the Family tabs (38 px), the header wordmark (32–40 px), Progress's "Go" (38 px wide) and filters, and the reader's "← All lessons" and "Print lesson" (37 px). | shell, Progress, reader | Fixed |
| 11 | **Pathway callouts were cut off.** With a skill selected the camera moves in, and area labels at the map's edge were clipped ("Algebra & r", "Numbe operat") or sat under the map toolbar. | `Graph.tsx` | Fixed: a callout shows whole or not at all |
| 12 | **Landing hierarchy.** At desktop the wordmark floated in the middle of the header, away from its mark. The card was narrower than the hero, so their edges disagreed. "Parent sign in" was a small 13 px button under a 64 px one. The footer repeated the eyebrow and ended with "Selected curriculum preview · English". | landing | Fixed: the wordmark sits beside the menu, card and hero share one column, both actions share one size, and the footer is one line with the support address as a full-size target |
| 13 | **Home repeated itself.** "Explore your pathways →" sat directly under the Pathways tab. At desktop the Go button stretched across the whole 740 px card. | `Home.tsx` | Fixed: the duplicate link is gone; from 768 px, Go sits beside the name and level at button proportions |
| 14 | **Progress left a card's worth of empty space.** Rows were estimated from the font size (152 px per card) rather than measured, so a 390×844 phone showed two cards above a large gap. | `ProgressWorkspace.tsx` | Deferred: sizing pages from rendered cards made the page size depend on content, so pages re-paged when a parent opened a card and came back (`verify-progress-ui` caught it). It needs a content-independent card height |
| 15 | **Level map axis labels collided.** At 390 px "Grade 6" ran into "Algebra 1+". Dots at either end of the range sat half outside the track. | Home, assessment map | Fixed: the centre label drops when the track is under 420 px (the heading explains the centre line); the track is inset by the dot's radius |
| 16 | "Review · 27" was truncated in Progress's filter at 320 px. | Progress | Fixed: the longer label takes the room it needs |
| 17 | The reader put three stacked download buttons before the lesson, pushing the lesson below the fold on phones. | lesson reader | Fixed: the lesson comes first and its printable copies follow |
| 18 | Family's page title was a small 22 px word at the far right of the header, opposite Back. | Family | Fixed: the title sits beside Back at heading size |
| 19 | The toast's message showed a focus box when it took focus to be announced. | `Toast` | Fixed |
| 20 | **A stale level-map response logged a page error.** If the account session changed while Home's level map was loading, the response was reported with `console.error` ("Frontier map failed to load … Your account session changed"). Other suites count that as a page error. | `LegacyApp` | Fixed: an account change raises a typed `AccountSessionChanged`. The loader discards it, and any response for a learner no longer on screen, with an info note. Real failures are still errors (`lib/__tests__/frontier-load.test.ts`) |
| 21 | The lesson library lists every problem type in a math area as one flat grid (over 100 in Numbers), with no search. The 842 reference lessons are one long list in a disclosure. | `LessonIndex`, `LegacyApp` | Deferred: needs a search-and-group design. Grouping by grade touches #1781 |
| 22 | The pathways graph crashed a Chromium renderer once (320×640, dark) under the audit's parallel load. | `Graph.tsx` | Deferred: not reproduced in isolation; watch in `test:pathways-ui` |
| 23 | Home's two stacked segmented bars (Practice/Lessons/Progress, then Level/Pathways/Inventory) read as two equal navigation levels. | Home, Pathways, Inventory | Deferred: an information-architecture change, beyond polish |
| 24 | Brand lockup varies: "AMP" on sign-in and sign-up, "AMP · Adaptive Math Pathways" on assessment cards, and "Adaptive Math PATHWAYS" on the atlas. | frames | Deferred: brand decision |

Not defects:

- `/reset-password` without a token shows "That password reset link expired or is invalid". That page is reached only from an email link; "Forgot password?" opens `/sign-in/forgot`.
- "Enrollment isn't open yet" and "Card payment is not available" appear because the fixture has no Stripe configuration.
- The first-run path (sign up → account ready → birth year → first problem) has no dead ends. Each step offers exactly the action that succeeds next.

## Grade-level presentation (#1781, unchanged)

These screens show grade numbers to learners. The copy is left as is pending that decision:

- the Home and assessment readout: "Working level 7.35 Grade 7", "Estimated range 5.37–9.33" and "K = 0 · Grades 1–8 · High-school courses = 9–12";
- the "Where you are" axis ("Grade 2 · Grade 5 · Grade 8+");
- the drawer's "Grade 7 · Estimated level";
- Inventory's "Estimated level Grade 7" and per-skill "Grade 3" tags;
- the pathway skill panel's "Grade 2" eyebrow and connection tags.

## Screenshots

`before/` (from the audit, production bundle before the fixes) and `after/` (from the verification, production bundle with them) hold the same Chromium screens at 390 and 1280 px, light and dark. In the before set, `home` and `inventory` show their settled state. The shifts happened during loading and are recorded in the findings above.
