# The row primitives — `src/shell/Surface.tsx`

One file. It draws four of the five destinations, so its vocabulary *is* the
app's feel. Everything below was verified on a rendered screen at 390 / 430 /
834 / 1024 / 1440 in both themes, not by reading the component.

**Scope:** `src/shell/Surface.tsx` only. Nothing else was touched — the lintel,
the navigation, the catalogue, the strapwork, the tokens and `index.css` all
belong to other passes and were being edited concurrently.

---

## 1. One rhythm, written once

Five row types were *nearly* the same, which is the version the eye catches.
`Fact` was optically centred at 12 px; `Choice` put 8 px above its control and
12 px below it, so two spacing systems alternated down Settings (audit §4.2).

There is now a single constant every row is built from:

```
const ROW = "flex min-h-row-min w-full items-center gap-row-gap py-row"
```

Every length in it is a role token — `--dw-row-min` (64 px, the child-sized
row), `--dw-row-pad`, `--dw-row-gap` — so a short viewport brings the padding
down at the rungs in `tokens.css` while the target floor stays put. Two more
constants keep the type honest: `ROW_LABEL` (`inscription text-md`, the 18 px
row-label step FOUNDATION defines) and `FACT_VALUE`.

`tracking-wide` is gone from every label. The type scale carries its own
optical tracking at every step; adding a second one on top of it is what made
the labels read as a web dashboard.

## 2. The divider is inset to the text origin

A 1 px line running the full width between every pair of rows is a web table.
Native lists inset the separator to where the text starts and run it to the
trailing edge.

The rule *above* a course is still full-bleed — it is the top edge of the group
— and the rules *between* rows are now drawn by an absolutely-positioned
`start-inset` span, so the row content itself stays full-bleed and nothing had
to be padded to buy the inset. Both are `.dw-hairline-{t,b}`, which is 0.5 px at
≥ 2 dppx: `border-b` on a 3× phone is three device pixels and roughly three
times what the platform draws.

The section list also moved from `max-w-2xl` to `.dw-measure`
(`--dw-measure-text`), which removes the third competing measure the audit found
on a desktop screen (§0.8). Section gaps moved from an inline
`gap-[var(--dw-stack-gap)]` to `gap-stack`.

## 3. `Choice` — a real segmented control

Every segmented control in the app was drawn **inverted** (audit §0.2): the
chosen option got `--dw-ground` and the unchosen ones `--dw-ground-raised`, so
the option you had *not* picked looked like the pressable key.

It is now the construction FOUNDATION §2 describes — **a recessed track with a
raised thumb in it**:

| part | drawn as |
|---|---|
| track | `.dw-sunk`, `rounded-cut-md`, `p-1` (= `--dw-space-1`) gutter |
| thumb | `.dw-raised`, absolutely positioned, `w-1/2` or `w-1/3` |
| unchosen | transparent, `text-ink-muted` |

**The selection slides.** The thumb is one element that translates on
`--dw-motion-detent` / `--dw-ease-detent` (200 ms, the seat) rather than the
background hard-swapping between two buttons. Because `style-src 'self'`
discards a React `style` prop in the shipped build, the position cannot be
computed inline — the two, three and four positions a real control ever has are
written out as static classes (`translate-x-0`, `translate-x-full`,
`translate-x-[200%]`, `translate-x-[300%]`) and picked from. Verified present in
the built stylesheet, not assumed. Reduced motion collapses the duration to
0 ms through the token, and the thumb has no displacement of its own to leave
behind.

**It survives a monochrome screen.** Three carriers, none of them a colour: the
thumb's elevation (lighter stone + cast light), the index mark, and
`aria-pressed`. The mark is now `text-accent`, not `text-index` — six gold
diamonds on Settings was six warm points against a rule of one, and the one
belongs to the navigation.

**The mark no longer moves the label.** It is always rendered and fades between
`opacity-0` and `opacity-100`; it used to be *inserted*, which shifted the
chosen option's word ~16 px sideways the moment it was chosen and re-centred the
two beside it (audit §0.3).

**`<div role="group" aria-labelledby>` replaces `<fieldset><legend>`.** A legend
is laid out in the fieldset's border area under its own padding rules, so the
gap between a label and the control it labels could not be `--dw-label-gap` no
matter what was written. That gap is why a choice row was ~120 px.

**Width.** A two-way control now sits on the row beside its label at *every*
width — so a choice row is exactly the same 64 px object as a fact row, and
Settings stops alternating between two rhythms. Three options cannot fit a
phone's half-row without truncating "Largest", so those take a line of their own
below `sm` and take the row's rhythm with them. The control is capped at half
the measure instead of stretching to 42 rem, which fixes the 224 px segment
holding a 14 px word at 1440 (audit §4.3).

Measured result: **light and dark `settings-390` now fit 844 px with no scroll
at all** (was 55 px past the fold), and `settings-1024` — iPad landscape, the
shortest wide viewport — fits 768 px.

## 4. `Action` — and what destructive looks like now

The reserved index-mark gutter is gone. It made an action label start 44 px in
while a fact label started at 0, which is where "three different left edges on
one screen" came from (audit §0.4). Every label on every screen now starts at
the same x.

* **Plain** — `text-accent-ink` (8.02 : 1 light, 10.87 : 1 dark) with `.dw-press`.
  A row that *is* a control and a row that states a fact must not look the same;
  "Add a learner" used to be the same ink as "Learners 3".
* **Destructive** — a bounded plate, centred, inside the row rather than being
  the row, so the frame never comes within a hairline of the rule belonging to
  the control above it. Rose, from the palette's own rose ramp:
  `text-strike` on the ground measures **6.39 : 1 light / 8.24 : 1 dark**.
  Armed, it takes `--dw-strike-line` and fills with `--dw-strike-ground`;
  computed against the washed ground that is **5.39 : 1 light / 6.88 : 1 dark**,
  both clear of AA. Hover goes to the strike wash rather than the generic lifted
  ground. The `armed` flag is threaded from `Surface`'s own state, so the plate
  visibly changes state before the press that actually erases — the label still
  swaps in place and nothing above or below it moves.

## 5. `Fact` — long and empty values, both deliberate

`min-w-0` on both children and `shrink-0` on neither: kept exactly, comments
kept. That is the parent-area sideways-scroll fix and the naive version of it
does not survive `min-width: auto`.

* **Long** — past a 34-character label+value budget the row stacks: label, then
  value beneath it, both flush left, same padding and same rules. Developer
  mode's `core:app:allow-version` against `@tauri-apps/api/app.getVersion` used
  to wrap to two lines on each side with a ragged gutter down the middle, which
  the audit called the ugliest block in the app (§5.3).
* **Empty** — an em dash, never a blank space.
* **One row, one voice** — the value left `--font-numeral`. A rounded-grotesque
  version string beside an old-style-serif label is the collision FOUNDATION
  §4 names on the pass sheet. It is body face with `tabular-nums`, which keeps a
  column of figures lining up without dragging a third typeface into the row,
  and it is `text-base` whether the row is inline or stacked.

## 6. `Learner`

* **The index mark moved to the trailing end.** Drawn at the leading end it
  indented the current learner's name by 44 px and left the other two flush
  (audit §0.3 / §3.3). Names now start where every other row's label starts.
* **The trailing controls line up.** "Use" is still laid out for the current
  learner — `invisible`, `disabled`, `aria-hidden`, out of the tab order — so
  switching learner does not reflow the row.
* **The field is a recess**, not an underline. `.dw-sunk` + `rounded-cut-sm` +
  `px-inset` + `min-h-target`. A transparent `flex-1` input with a bottom border
  took its width from whichever siblings happened to be present, so three
  learners had three underline lengths and two left edges, and nothing about it
  said "you may type here" (audit §3.2).
* **Remove takes two presses.** It erases a child's whole record and sits a
  finger's width from "Use", while two rows away the *less* destructive "Erase
  everything" was already armed before it fired (audit §3.1). Rest is a quiet
  rose word in a 44 × 44 target; armed is a solid `--dw-strike-fill` plate
  (`on-strike` on it measures 7.16 : 1 light / 7.44 : 1 dark) and `aria-pressed`
  says so. It disarms on blur.

## 7. `Figure`

`py-3` → the shared `py-row`. Capped at a hand's width on a phone and let out
from `sm` up: Progress was using 25 % of a 1440 screen and is the one
destination a child visits to feel something about their own work. Not the full
measure — at 1024 × 768 the full-measure drawing pushed the two rows under it
eight pixels past the fold, measured, so it is capped one step below.

---

## Measured, after

`node tools/capture.mjs --only=progress,profiles,settings,parents,parents-dev`
— 50 captures, 5 widths × 2 themes.

| check | result |
|---|---|
| horizontal page overflow | **0 px on all 50** |
| boxes that scroll sideways | **0** |
| interactive targets < 44 px | **0** |
| elements escaping the viewport | **0** |
| AA failures | **0** — lowest measured pair is 5.81 : 1 (an unchosen segment label, 14 px, on the sunk track) |
| vertical overflow | only `parents-dev` (a long developer list, expected) |

Gates: `npm run tsc` clean · `npm test` 226/226 · `npm run lint` clean ·
`npm run build` clean. `boundary.test.ts`'s "no inline style anywhere" and
`surfaces.test.ts`'s "no destination renders empty" both still pass; there is no
`style` prop anywhere in this file and the surface model was not touched.

## Not done, and why

* **Remove has no armed copy.** The two-press guard changes the plate, not the
  word, because `strings.ts` is outside this pass's file scope and a new string
  is five translations. A `profiles.removeConfirm` would make the second press
  self-explanatory the way `parents.eraseConfirm` does.
* **The grey sill under the Progress drawing** (audit §2.1) and the ghost-outline
  rosette (§2.4) are in `src/world/Screen.tsx`.
* **"Reduce motion" is still a double negative** (§4.4) — that is copy and model,
  in `strings.ts` / `surfaces.ts`.
* **Progress still shows two raw counts and no rate** (§2.3) — `surfaces.ts`.
* The destination transition, the lintel, the tab bar, the catalogue grid and
  the pass sheet all belong to other passes.
