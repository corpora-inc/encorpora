# Design pass review: every screen, every person

Each screen is judged against [ia.md](ia.md) at 390, 768 and 1280 px, in light and dark, for day 0, day 1 and week 3 where they differ. Screenshots are in [`shots/`](shots/). The person is a seeded persona from `/dev/personas` (`scripts/design-preview.sh`).

Status: **done** means looked at and fixed to the bar. **open** means not yet passed. **worker** means a branch owns it and it is re-checked after merging.

## Public and first run

| Screen | Person | Status | Notes |
|---|---|---|---|
| Pitch `/` | guest | open | prices now show in the preview; "Free assessment" copy |
| Sign in, sign up | guest | open | "Password" label; top-align on phones |
| What brings you to AMP? `/start` | signed-up | open | tiles hover alike |
| Myself, Parent, Tutor steps | signed-up | worker | `nicknames-not-picture-names`, `guided-family-setup` |
| Schools page `/schools` | guest | open | |

## My practice (adult)

| Screen | Person | Status | Notes |
|---|---|---|---|
| Overview `/me` | adult-new, adult-day1, adult-3wk | worker | `polish-me-and-workbooks` |
| Pathways | adult-day1, adult-3wk | open | no own name; skills, not crystals; plain copy |
| Inventory | adult-day1, adult-3wk | open | counts follow filters; plurals; one meter a row |
| Practice | adult-day1 | worker | `immersive-practice-again` |
| Allowance pause and Continue | adult-paused | open | recap; plain frame |
| Lessons library and reader | adult-3wk | open | Back restores place; short cards; no partner box |
| Workbooks | adult-3wk | worker | `polish-me-and-workbooks` |
| Practice as someone else | adult-3wk | open | levels only after a grade |

## Account (drawer)

| Screen | Person | Status | Notes |
|---|---|---|---|
| Sign-in and security | adult-3wk | open | no button that can only fail |
| Learners | adult-3wk, family | open | own practice listed |
| Billing | adult-day1, family | open | P0: plan, free problems, Continue |
| Privacy | adult-3wk, family | open | "your data" without children |

## Family

| Screen | Person | Status | Notes |
|---|---|---|---|
| Today | parent-new, parent-day1, family, second-parent | worker | `polish-family-class`: no greeting by own name; invites off Today |
| Map (K–12) | family | worker | `polish-me-and-workbooks` |
| Grades, Time | family | worker | `polish-family-class` |
| Workbooks | family | worker | `polish-me-and-workbooks` |
| People, Settings | family | worker | `polish-family-class` |
| Second parent lands on the class | second-parent | done | a one-class place opens on its Today |

## Tutor and teacher

| Screen | Person | Status | Notes |
|---|---|---|---|
| Teacher demo lands on Today | teacher | done | was a list of one class |
| Today | tutor, teacher | worker | `polish-family-class`: no avatars, no own name |
| Map, Grades, Time, Workbooks, Students, Settings | teacher | worker | re-check after merging |
| Start class board | teacher | open | |

## School

| Screen | Person | Status | Notes |
|---|---|---|---|
| Overview | school | done | titled by the school; two balanced columns; "so far" label clear; You for own classes |
| Classes, Students, Import, Student experience | school | open | sub-tabs done |
| Staff, Sign-in help, Integrations | school | done (Staff) | full-width table, no avatars, You |
| Calendar | school | open | |
| License | school | open | |
| Privacy | school | open | |
| Activity | school | done | filters span the log |

## Shell

| Screen | Person | Status | Notes |
|---|---|---|---|
| Drawer and place switcher | adult-3wk, family, school | open | place named once; no options already held |
| Generic errors | all | open | `lib/api.ts` fallback |
