# VERIFY — the verdict lens

Independent verification of the design pass on the host harness
(`dynawalla/dynawalla-app/src`). The brief was to **refute** that it is good.

Method, so every number below can be re-derived:

* `node tools/capture.mjs` re-run clean → **100 shots, 0 capture problems**,
  `tools/shots/measurements.json` regenerated.
* A geometry probe (scratchpad copy of `capture.mjs` with `MEASURE` replaced by
  a `getBoundingClientRect` dump) for exact x/width/height per element. The
  screenshots alone cannot settle an alignment claim.
* Two states the shipped harness **cannot** reach, captured on purpose because
  claims were made about them and nobody had looked:
  * `textSize: "largest"` — the app offers it, the harness only ever seeds
    `"normal"`.
  * the **armed** destructive rows — the harness never presses anything, so
    `--dw-strike-line` on `--dw-strike-ground` had only ever been computed by
    hand.
* Pixel scans (PIL) where a screenshot is ambiguous — edges, masks, shadows.
* `npm test` → **226/226 pass**.

Annotated crops are in `tools/shots/crops/`. Every finding below names the
screen, the size, the theme, and a file:line.

---

## Verdict

**It is a large, real improvement and it is not done.** Six of the audit's
findings are genuinely closed on evidence. Three of the audit's own "three to
fix first" are closed, half-closed and open respectively. Two *new* defects were
introduced or exposed, one of which (the tab bar at the largest text size) is a
shipped, reachable, broken state on every screen in the app.

Light mode is no longer an afterthought in *structure* — it is still an
afterthought in *weight*. Dark reads premium at every size. Light reads
under-inked: the pack art is a near-black brick on paper, the plate around the
one destructive control is ~1.06:1 against its page, and the tonal range of a
segmented control is 244 → 233 → 255.

---

## What I tried to refute and could not

Recorded first, because a review that only lists faults is not a review.

* **The rail dissolve works.** I read a hard vertical line at the right edge of
  `dark/packs-390` as a chip "clipped stone dead" and was wrong — a pixel scan
  at y=364 shows that line is the *third* chip's own right border
  (x=732, `27,16,50`), and the fourth chip's leading border at x=750 is already
  ghosted to `15,8,30` (~25%) by the mask. The mask is on a static wrapper and
  is behaving. (It is still too subtle to be useful — see WORST #2.)
* **Segmented-control thumb geometry is exact.** `dark/settings-390`, Theme:
  track outer 16.5–374 css, `p-1` → inner 20.5–370, one third = 116.5;
  the "Dark" thumb measures 253.5–370. `translate-x-[200%]` on a `w-1/3` thumb
  in a zero-padding containing block is arithmetically right, and it renders
  right. No off-by-a-gutter.
* **The armed states pass AA — rendered, not asserted.**
  `light/parents-armed-390`: "Erase everything — press again" `rgb(172 20 66)`
  on `rgb(238 220 238)` = **5.49:1**. Dark = **6.85:1**. Armed "Remove"
  `rgb(255 255 255)` on `rgb(172 20 66)` = **7.16:1** light, **7.44:1** dark.
  (`CRAFT-rows.md` claimed 5.39/6.88; measured is 5.49/6.85 — off by a rounding,
  in the safe direction.)
* **AA everywhere else.** 100 captures, **0 failures**, lowest pair **5.70:1**
  (`rgb(255 255 255)` on `--dw-accent` `rgb(124 58 237)`, the pass sheet's
  primary button). §0.6 is closed.
* **The CSP constraints hold.** `grep 'style={'` over `src/` → nothing.
  `grep -E '#[0-9a-fA-F]{6}'` over `**/*.tsx` → nothing. `dist/assets/*.css`
  contains `md\:hidden`, `md\:block`, `md\:grid-cols-`, and all ten new
  `.dw-*` utilities. The interpolation trap they describe is genuinely absent
  from the shipped CSS.
* **§0.9 is fixed.** `light/settings-1024` and `light/progress-1024` now report
  **no scrollers at all** (was: body scrolled 65px). Same at 390/430/834/1440.
* **Card-grid rhythm is fixed.** The "Grades … / Play ›" line lands on one y for
  every card in a row: y=653 across all four cards at 1440 (both themes), y=915
  and y=1762 for rows one and two at 834. §1.3 closed.
* **Reduced motion is thorough.** `tokens.css:944` collapses the duration *and*
  displacement tokens under the OS query, `:914` does the same under
  `:root[data-motion="reduced"]` for the in-app switch, and both are backed by a
  `*` belt-and-braces rule. Two sources, both wired.
* **Scope respected.** `git status` shows nothing under `dynawalla/games/` or
  `packs/shared/`.

---

## The three best things

**1. Every segmented control in the app is now drawn the way a platform draws
one.** Audit §0.2 — the app-wide inversion, six controls on Settings, one on
Parents, the chip rail — is completely closed. `Surface.tsx:155-171`: a
`.dw-sunk` track with a `.dw-raised` thumb that slides on the detent curve, and
the index mark is *always rendered and faded* rather than inserted, so choosing
an option no longer shifts its own label. Verified on 20 captures in both
themes, and the thumb's arithmetic is exact to the pixel (above). This was the
second of the audit's "three to fix first" and it is genuinely done.

**2. The gold ribbon is gone, and the replacement is measured, not asserted.**
`Strapwork.tsx:55-59` now paints `--dw-band-strap` / `--dw-band-knot`
(`stone-400`/`aurora-600` light, `stone-600`/`aurora-500` dark) instead of
`--dw-index`. That removes ~120 brass knots per screen. The only warm thing left
in the chrome is one 10px `--dw-index` diamond in the active tab — literally one
warm point per screen on Packs, Settings and Progress. The "dusty khaki
sandstorm ribbon" the audit called the app's loudest brand violation does not
exist any more. The two-tile solution ({24,10} / {36,14}) is also the right
answer to a real constraint: an SVG `<pattern>` width is an attribute, so no
media query can resize the motif.

**3. The pass sheet was rebuilt properly, and the parts that were invisible are
now visible.** §6.1 (panel 1.13:1 against its own backdrop in dark) is gone —
`dark/pass-rest-390` shows a clearly raised sheet. §6.2 (two of three plates
unbounded in dark) gone — `light/pass-offer-390` and its dark twin show three
plates that all read as buttons in a recessed track. §6.3 (three type families
in one row) and §6.4 (nothing shares a baseline) both closed: one face,
`tabular-nums`, name and price on one baseline, note below. §6.5 both underlines
removed. And the sheet is *one* panel mounted once with the stages swapped
inside it, which is the structurally correct fix, not a cosmetic one.

---

## The five worst

### WORST 1 — The tab bar breaks at the app's own largest text size, on every screen

**Screens:** all five destinations. **Sizes:** 390 and 430. **Themes:** both.
**File:** `src/app/Nav.tsx:90` — `class="inscription w-full truncate text-center text-xs sm:text-sm"`.

Set Text size → Largest (a setting this app ships, on the Settings screen, three
rows down) and four of the five destination names truncate:

> Packs · **Prog…** · **Profi…** · **Setti…** · **Pare…**

This is not an eyeball call. The measurement walker reports, on *every*
destination at 390:

```
span.inscription.w-full.truncate.text-center  v0 h9
span.inscription.w-full.truncate.text-center  v0 h3
span.inscription.w-full.truncate.text-center  v0 h6
span.inscription.w-full.truncate.text-center  v0 h2
```

Four boxes whose content is wider than the box. Crop:
`crops/B-nav-truncates-at-largest-390.png`.

The user who turns on Largest is a six-year-old, or a parent setting up for one.
The navigation is the one thing in the app that must never be a guess. Two other
things fall over in the same state: Settings at 390/largest scrolls again
(`body v70`, so §0.9's fix is normal-text-only), and the catalogue collapses to
**one card per screen** at 390 because `minmax(10.5rem, 1fr)` is in rem and
scales with the text setting — 27 games become 27 full-screen scrolls.

The harness never seeds anything but `textSize: "normal"`, so none of this was
in any of the 100 committed captures. That is a hole in the tool as much as in
the chrome.

### WORST 2 — iPad portrait clips the last filter mid-word, and calls it a scroll cue

**Screen:** packs. **Size:** 834 (iPad Air portrait — a first-class target).
**Themes:** both. **File:** `src/catalog/catalog.css:241-248`.

Crop: `crops/A-packs-834-chip-clipped-midword.png`. It reads:

> Equality & algeb**ra**

with the last two letters dissolving into nothing and the chip's right border
cut off. There is no chip beyond it.

Cause: the rail overflows by exactly **18px** at 834 (measurements.json,
`light/packs-834`: `div.dw-scroll-x.dw-rail … h18`). The mask fades over
`--dw-space-5`, so at an 18px overflow the fade lands *on the last word of the
last chip* rather than on a following chip. Mechanically the mask is correct;
perceptually the result is "the text faded out", which every reader will parse
as a rendering fault, not as "scroll right".

The same mechanism under-delivers at 390: after the third chip ends at x=366css
there is roughly **18px of a ghosted border at ~25% opacity** and then page
ground. A child gets essentially no signal that four more subjects exist. iOS
solves this by guaranteeing a partial cell; this guarantees nothing, because
the peek distance is whatever the content happens to leave.

Two contradictory failure modes from one rule is the tell that the rule is
overflow-driven when it needs to be layout-driven.

### WORST 3 — "One rhythm" is false by measurement: a choice row is 74px, a fact row is 64px

**Screens:** Settings, Parents. **All sizes, both themes.**
**Files:** `src/shell/Surface.tsx:35` (`ROW`), `:143-146`, `:183`.

`CRAFT-rows.md` says *"a choice row is now the same 64px object as a fact row"*
and *"ONE RHYTHM: all five primitives now build from a single ROW constant"*.
Probed heights:

| screen | row heights, top to bottom |
|---|---|
| `parents` @1440 | 64, 64, 64, **74**, 64 |
| `parents` @390 | 64, 64, 64, **74**, 64 |
| `settings` @1440 | **74** × 6 |
| `settings` @390 | **116.1**, **116.1**, 74, 74, 74, 74 |
| `profiles` @any | 64, 64, 64, 64 |

A choice row is 74px because the option `<button>` carries `min-h-target` (44) +
the track's `p-1` (8) + `py-row` (22). So on Parents, the fourth of five rows is
10px taller than its neighbours; on Settings at 390 there are **three** distinct
row heights on one screen. Audit §4.2 ("two spacing systems, alternating down
the screen") is reduced, not closed — and it is now a *cross-screen*
inconsistency too: the same "Developer mode" control is a 74px row sitting in a
list of 64px rows, while every row on Profiles is 64.

This is the defect the brief calls out as the easiest to miss and the most
common tell. It is 10px, and it is on the two screens an adult reads most.

### WORST 4 — Desktop is still mostly empty, and the left edge now jumps 224px between screens

**Screens:** all. **Sizes:** 834, 1024, 1440. **Themes:** both.
**Files:** `src/index.css:271` (`.dw-frame`), `:279` (`.dw-measure`),
`src/design/tokens.css:639-640`.

`CRAFT-chrome.md` claims *"THREE MEASURES → TWO THAT AGREE"*. Probed x-origins:

| element | @1440 | @834 |
|---|---|---|
| lintel wordmark link | x=160 | x=20 |
| catalogue grid (packs) | x=160, w=1120 | x=20, w=794 |
| rows (progress/profiles/settings/parents) | **x=384**, w=672 | **x=81**, w=672 |
| tab-bar links | x=388 → 1052 | x=85 → 749 |

So the lintel and the *catalogue* agree. The other four destinations do not: at
1440 the wordmark sits at x=160 and the rows under it start at **x=384**. Tap
Packs → Settings and every left edge on screen moves 224px. At 834 the same jump
is 61px. That is the audit's §0.8 relocated, not resolved — and because the tab
bar is capped at `--dw-measure-text` (672) while the *cells* are 632 wide,
the "share width" half of the claim is 40px out too.

Screen utilisation, measured (content area ÷ 1440×900 viewport):

| screen | before (AUDIT) | now |
|---|---|---|
| parents | ~20% | **18.2%** (352 × 672) |
| profiles | ~10% | **14.4%** (278 × 672) |
| progress | ~25% | **27.7%** (535 × 672) |
| settings | — | **24.0%** (466 × 672) |

`light/parents-1440.png`: five rows and a red plate occupying the top fifth of a
1440×900 screen, with 380px of flat lavender below and a tab bar stretched
across the bottom. It still reads as a phone app in a desktop window. This was
the third of the audit's "three to fix first" and it is the one that did not
move.

### WORST 5 — Progress is untouched, and in light it reads as a broken image

**Screen:** progress. **All sizes, both themes.** Worst at
`light/progress-1440.png` — crop `crops/C-progress-figure-1440-light.png`.

Nothing in any of the four write-ups claims Progress beyond "let the figure out
from `sm` up", so this is a gap rather than a regression — but the brief asks
whether a ten-year-old would want to touch it, and the honest answer is no.

* §2.1 (the grey slab) is **still there**: a solid periwinkle bar under the
  frame, running 1px wider than the frame on the right. It looks like a drop
  shadow that failed to render.
* §2.4 (the second rosette reads as broken) is **still there**: half the petals
  are outline-only ghosts at this scale.
* In light theme the whole figure is a **white rectangle with a 1px dark
  border** on a lavender page, containing two **solid black** eight-point stars.
  On the app's only celebratory screen, in the app's own violet brand, the hero
  graphic is black-and-white in a bordered box.
* §2.3 is untouched: "Answered 1284 / Correct 1102". No rate, no streak, nothing
  built. This is the screen closest to the stated anti-goal.
* Fourth left edge on one screen: the figure runs x=432–1006 while its own
  labels run x=384–1056, so the drawing's left edge is 48px inboard of
  "Answered".

---

## Also found (ranked, below the top five)

**6. A focus ring is drawn, on mount, with no user interaction — on the gate.**
`src/pass/PassSheet.tsx:251` — `useEffect(() => field.current?.focus(), [])`.
`CRAFT-pass.md` says §6.6 is closed and "All measured PASS"; the fix moved focus
off the child-facing *button* to the dialog container, and left the gate's input
autofocused. Pixel scan down x=600 of `dark/pass-gate-1440.png`:

```
y432-433  (184,140,255)   ← --dw-focus, 2px
y434-435  (38,26,82)      ← outline-offset gap
y436      (42,27,77)      ← the field's own border
y437+     (6,3,16)        ← field ground
```

Two concentric rectangles around the field — the exact pattern
`CRAFT-catalog.md` says was eliminated on the search field. Same in light
(`109,40,217` ring, `201,188,236` border). Whether WKWebView's `:focus-visible`
heuristic suppresses this after a real touch is a device question the audit also
flagged; what is certain is that it was not verified and the claim that it was
is wrong.

**7. Profiles carries four warm points, and the loudest thing on it is
"Remove ×3".** `light/profiles-390.png`: three crimson `rgb(172 20 66)` words in
a column, plus the tab bar's brass diamond. The brand rule is one warm point per
screen. `docs/HARNESS_FEEDBACK.md` explicitly listed the strike hue as
"noted, not yet acted on — worth a deliberate decision", and this pass made the
AA half of the decision (copper → rose, 4.45 → 6.39, good) without making the
brand half. On Parents the same colour is a full-measure plate — `x=384 w=672`
at 1440, i.e. the widest control on the screen — so `CRAFT-rows.md`'s
"a **bounded** rose plate, centred, inside the row" is true only of the text.

**8. The two destructive controls in the app arm differently.** Parents changes
its words ("Erase everything" → "Erase everything — press again"). Profiles
changes only its colour — `light/profiles-armed-390.png` shows "Remove" on a
solid crimson plate saying nothing about what a second press does, on the row of
the *currently selected* learner. One app, two grammars for the same gesture.

**9. Nav tap targets do not tile the bar.** Probed at 390: link boxes at
x=20 / 91.6 / 163.2 / 234.8 / 306.4, each w=63.6 — a pitch of 71.6, so there are
**8px dead gutters between every pair of tabs** (`Nav.tsx:65`,
`mx-[var(--dw-space-1)]`) plus 20px dead at each end. The `<li>` is `flex-1` and
tiles; the anchor inside it does not. Every platform's tab bar makes the cells
contiguous, because a tap that lands between two tabs must still choose one.

**10. Card blurbs are still cut mid-word, and the overflow is enormous.**
Audit §1.4, unclaimed and unfixed. Measured on `light/packs-390`: **27 blurb
spans**, each a scroll box with 33–178px of vertical overflow inside a 2-line
clamp. On screen: "…a bioluminescent growth arena. You are a **numb…**",
"…the tower carries numbers. **Punch…**". Reserving the box (which they did, and
which fixed §1.3) does not fix truncating a paragraph to two lines.

**11. Stacked developer rows do not read as label/value pairs.**
`dark/parents-dev-390.png`, crop `crops/D-parents-dev-stacked-pairs.png`. The
gap between a label and its own value (~41px) is the same as the gap from that
value across the hairline to the *next* label (~44px), so
"@tauri-apps/api/app.getVersion" is as plausibly attached to "packs_list" as to
"core:app:allow-version". `Surface.tsx:75` uses `gap-label` inside a row whose
`py-row` is nearly as large.

**12. An unselected segment's label sits right of its cell's centre.**
`Surface.tsx:189-195`: the index mark is always in flow at `opacity-0` with
`gap-label` before the word. Correct for "no jump", but it means the *inactive*
option's word is centred with an invisible mark in front of it — visible on
`dark/settings-390` where "Off" sits ~10px right of the centre of its half.
The cost of the right fix, but it is a visible optical error on six controls.

**13. Light theme is under-inked in three specific places.**
(a) `--dw-art-void` is `basalt-800` in both themes by design, so
`light/packs-834.png` is eight near-black bricks on paper — the art still reads
as the object, which is half of §1.5 and the half that was not fixed.
(b) The "Erase everything" plate border in `light/parents-1440` is
`parchment-300`-family on `parchment-100` — the plate the write-up describes as
"bounded" does not read as bounded; in dark it does.
(c) A segmented control's entire tonal range in light is
244,240,255 → 233,226,251 → 255,255,255. It works, but there is no depth in it,
where dark gets a genuine recess.

**14. In dark, the bottom bar has no perceptible elevation.** Pixel scan up from
the bar edge at x=80: light ramps 244,240,255 → 230,224,243 over ~19px (a real
upward cast); dark ramps 11,6,24 → 10,5,22 — a Δ of 1-2 units on a near-black
ground, i.e. invisible, leaving a 1px hairline at y=813 as the only separation.
`dw-bar` "casts up" in one theme only.

**15. A hairline restates the strapwork band 24px below it.** Every destination,
both themes — crop `crops/E-double-horizontal-under-band.png`. The first group's
`dw-hairline-t` sits immediately under the chrome band, so a screen opens with
two parallel horizontals. Minor, but it is on all five destinations at all five
widths.

---

## Would a ten-year-old want to touch it? Would an adult feel condescended to?

**Packs: yes, and no.** `dark/packs-1440.png` is the best screen in the app —
the cards read as objects, the art carries them, "Play ›" is a control, and the
grid has a rhythm. A child would scroll this.

**Progress: no.** See WORST 5. This is the screen a child goes to for a feeling
and it gives them a bordered box and two numbers.

**Profiles: no, and slightly alarming.** The three loudest things on it are
"Remove", "Remove", "Remove".

**Settings / Parents: an adult would not feel condescended to.** They are
sober, legible, correctly built lists. They are also 18–24% of a desktop screen
and one row in five is the wrong height.

**Pass sheet: much improved and still the least joyful screen.** §6.7 stands: a
dark rectangle, two serif sentences, one violet slab. Honest policy, no timer,
no loss framing — and nothing that makes a seven-year-old want to press
"Choose another game".

---

## Named-tell checklist

| tell | status |
|---|---|
| drawn scrollbar track | suppressed under `pointer: coarse`; `.dw-rail` now suppresses on every pointer (real fix). Desktop page track remains, deliberately. |
| selection handle on long press | `user-select: none` intact |
| page scrolls sideways | **0px horizontal on all 100 captures**, incl. `parents-dev` at 390 |
| tap highlight | intact |
| bounce on a fixed surface | `overscroll-behavior: none` intact; `overscroll-contain` added on the pass panel |
| text reflows as state changes | fixed on segments, learner rows and the gate; **the armed Erase label still changes length** (deliberate, and the plate does not move) |
| targets < 44px | **0 across all 100 captures**. §1.6 and §1.7 both closed. 8px dead gutters *between* tabs remain (#9) |
| transitions absent / decorative | `dw-anim-enter` on a pathname-keyed outlet; both reduced-motion sources collapse duration *and* lift |
| inconsistent spacing between screens | **NOT CLOSED** — WORST 3 and WORST 4 |
| focus ring on touch | **NOT CLOSED** — #6, gate stage |

## Files

* fresh captures — `tools/shots/{light,dark}/*.png` (100)
* measurements — `tools/shots/measurements.json`
* crops — `tools/shots/crops/A-…` through `E-…`
</content>
</invoke>
