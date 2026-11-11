# Design pass review: every screen, every person

Each screen is judged against [ia.md](ia.md) at 390, 768 and 1280 px, in light and dark, for day 0, day 1 and week 3 where they differ. Screenshots are in [`shots/`](shots/). The person is a seeded persona from `/dev/personas` (`scripts/design-preview.sh`).

Status: **done** means looked at and fixed to the bar. **open** means not yet passed. **worker** means a branch owns it and it is re-checked after merging.

## Public and first run

| Screen | Person | Status | Notes |
|---|---|---|---|
| Pitch `/` | guest | done | prices show in the preview; "100 free problems and 5 workbooks" |
| Sign in, sign up | guest | done | "Password" label; top-aligned on phones |
| What brings you to AMP? `/start` | signed-up | done | tiles hover alike; birth years as tiles, the chosen one filled; the action waits faintly |
| Myself, Parent, Tutor steps | signed-up | done | the birth year is always enough (Myself and /me/start, one year grid); no level chooser anywhere; under 13 to a parent |
| Schools page `/schools` | guest | open | |

## My practice (adult)

| Screen | Person | Status | Notes |
|---|---|---|---|
| Overview `/me` | adult-new, adult-day1, adult-3wk | open | merged (centred, compact, one Practice); day 0 still a two-column block, not the centred hero |
| Pathways | adult-day1, adult-3wk | done | skills, no own name, plain counts, level rows from level-range; the camera moves only when it helps; one search; a chosen skill brings the phone's map back; a short lesson has its own address (?lesson=) |
| Inventory | adult-new, adult-3wk | done | flat rows, counts follow filters, plurals; day 0 is a centred hero |
| Practice | adult-day1 | merged | edge to edge; figure problems top-aligned on phones |
| Allowance pause and Continue | adult-paused | done | recap and included items; plain frame; specific errors |
| Lessons library and reader | adult-3wk | done | Back returns to the card; one-line cards; opens at level; no partner box; search merged |
| Workbooks | adult-3wk | merged | a tab of My practice; builder in a sheet |
| Practice as someone else | adult-3wk | done | its own page from the drawer; Try a level centred, levels after a grade |

## Account (drawer)

| Screen | Person | Status | Notes |
|---|---|---|---|
| Sign-in and security | adult-3wk | done | one Sign in again; centred column |
| Learners | adult-3wk, family | done | own practice first; nickname rules |
| Billing | adult-day1, family | done | per learner: plan or free problems, one action |
| Privacy | adult-3wk, family | done | "your data" without children |

## Family

| Screen | Person | Status | Notes |
|---|---|---|---|
| Today | parent-new, parent-day1, family, second-parent | merged | the Today feed; invites in People |
| Map (K–12) | family | merged | panels per child; drill-in inside the class |
| Grades, Time | family | merged | no Grades tab for 6 or fewer; target in Settings |
| Workbooks | family | merged | |
| People, Settings | family | done | People tab; Settings: code, year with None, target |
| Second parent lands on the class | second-parent | done | a one-class place opens on its Today |
| Join element (Today header, People, Settings) | family, teacher-class | done | the code, then one group of equal 48 px controls: Copy link, Full screen, QR, More (New class code, confirmed); on a phone two rows; while paused New code shows itself |
| Downloads (PDF) | adult-3wk, family | done | progress report, lesson, workbook, solutions and sign-in card PDFs download from the preview |

## Tutor and teacher

| Screen | Person | Status | Notes |
|---|---|---|---|
| Teacher demo lands on Today | teacher | done | was a list of one class |
| Today | tutor, teacher | merged | the feed, as the product shot; title is the class |
| Map, Grades, Time, Workbooks, Students, Settings | teacher-class | done | Students/People titles match their tabs; Final grade in the field style; an unknown address says "This page isn't here" in the class frame |
| Start class board | teacher | open | |

## School

| Screen | Person | Status | Notes |
|---|---|---|---|
| Overview | school | done | titled by the school; two balanced columns; "so far" label clear; You for own classes |
| Classes, Students, Import | school | done | sub-tabs; phone rows instead of cards |
| Staff, Sign-in help, Integrations | school | done (Staff) | full-width table, no avatars, You |
| Settings (year and terms, student experience, license) | school | done | one home; no trapping picker; centred |
| License | school | done | a section of Settings |
| Privacy | school | done | a Settings sub-page, one centred column |
| Activity | school | done | filters span the log |

## Shell

| Screen | Person | Status | Notes |
|---|---|---|---|
| Drawer and place switcher | adult-3wk, family, school | done | places only; learners as quiet rows; no own name or email; exactly one current item (no router prefix match); hover fills only where a pointer hovers |
| Smoothness (every route) | adult-3wk, family | done | preload on intent and on drawer open; no wave under a second; route loaders for Pathways, Inventory and class Settings; `npm run test:smooth-load-ui`: 8 routes, 0 changes after the wave, CLS 0 |
| Workbooks for an adult | adult-3wk | done | a drawer item under Practice; its pages have the plain frame; the one current item there |
| Pathways search | adult-3wk | done | results select their skill (found item first in the panel); no phone overflow; formula-safe snippets; semantic search live in the preview |
| Generic errors | all | done | `lib/api.ts` names what failed |
