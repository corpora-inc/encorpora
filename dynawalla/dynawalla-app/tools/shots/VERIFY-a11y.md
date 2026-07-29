# VERIFY — accessibility and measurement

An adversarial re-measurement of the design pass on `dynawalla-app/src`. The
brief was to **refute** the claims, not to confirm them. Nothing in `src/` was
changed; four measuring tools were added under `tools/` and all raw output is on
disk.

| what | where |
| --- | --- |
| 130 renders × full a11y probe (10 screens + 3 states, 5 widths, 2 themes) | `tools/verify-a11y.mjs` → `tools/shots/verify-a11y.json` (2.4 MB) |
| touch-focus, coarse pointer, reduced motion, focus trap, scroll reset, semantics | `tools/verify-deep.mjs` → `tools/shots/verify-deep.json` |
| nav label fit at 6 widths × 3 text sizes × 5 destinations | `tools/verify-text.mjs` → `tools/shots/verify-text.json` |
| elevation / non-text contrast pairs | `tools/verify-elev.mjs` → `tools/shots/verify-elevation.json` |

The probe is the baseline `capture.mjs` measurement extended with: a **real
`Input.dispatchKeyEvent` Tab walk** (so `:focus-visible` is genuine, not
simulated), a **real `Input.dispatchTouchEvent` tap**, `::placeholder` colour
(never a text node, so never measured before), inherited-`opacity` compositing,
a gradient/image flag on every ground, accessible-name computation, and a
scrollbar-track test that distinguishes `overflow: hidden` clipping from a
painted track.

---

## Verdict

**Not a pass.** Contrast, target size, overflow, focus policy, tap highlight,
selection, overscroll and reduced motion are all genuinely clean — several of
the pass agents' numbers are *conservative*. But three things are wrong, one of
them at the app's default settings, and one whole WCAG requirement (headings /
programmatic structure) is absent from every screen in the app.

---

## P1 — The tab bar truncates its own labels

The five destination labels are `truncate` inside a fifth of the measure
(`src/app/Nav.tsx:86`). Measured at `span.scrollWidth` vs `span.clientWidth`,
five destinations × six widths × three text sizes (`verify-text.json`):

| width | Normal | Large | Largest |
| --- | --- | --- | --- |
| 320 | **2 of 5 cut** | **4 of 5 cut** | **5 of 5 cut** |
| 390 | clean | clean | **4 of 5 cut** |
| 430 | clean | clean | clean |
| 834 / 1024 / 1440 | clean | clean | clean |

Exact numbers, light theme, `#/settings`:

```
320 / Normal   (root 16px, tab 49.6px, label 12px)
  Progress   42px available / 47px needed   → "Progres…"
  Settings   42px available / 45px needed   → "Setting…"

320 / Largest  (root 20px, tab 46.0px, label 15px)
  Packs      36 / 39      Progress 36 / 59      Profiles 36 / 53
  Settings   36 / 56      Parents  36 / 52      — all five

390 / Largest  (root 20px, tab 60.0px, label 15px)
  Progress   50 / 59      Profiles 50 / 53
  Settings   50 / 56      Parents  50 / 52
```

Two separate defects live in that table.

1. **320 × Normal is the shipped default.** No setting has been touched; a
   320 CSS-px phone (and 320 is still the narrowest viewport this bundle has to
   survive) shows a clipped tab label out of the box. The claim in
   `CRAFT-chrome.md` §1 that the active tab carries "full ink" as one of three
   cues is true of the colour and false of the word: the word is not there.
2. **390 × Largest is the app's own accessibility setting on the app's own
   primary device.** Settings offers Normal / Large / **Largest**
   (`src/shell/surfaces.ts:357`), and choosing the third one clips four of the
   five labels of the only navigation in the app. WCAG 1.4.4 asks for 200 %
   without loss of content; this is loss of content at 125 %.

`min-w-0 flex-1` on the `<li>` plus `truncate` on the span means the label can
only ever be a fifth of the measure, and no rung of the type scale is checked
against that budget. `Nav.tsx:54` caps the row at `--dw-measure-text` and
centres it, which is what makes 430+ safe and 320/390 not.

Reproduce: `node tools/verify-text.mjs --no-build`, then read
`verify-text.json` → any key `*-320-Normal` or `*-390-Largest` → `nav[].cut`.

## P2 — The search field draws a focus ring on touch

`src/catalog/catalog.css:170`

```css
.dw-find:focus-within {
  border-color: var(--dw-focus);
  box-shadow: 0 0 0 2px var(--dw-focus);
}
```

`:focus-within` is not `:focus-visible`. Every other control in the app is
correctly `:focus-visible`-scoped (`src/index.css:160`), and I confirmed that
with a real `Input.dispatchTouchEvent` on a coarse-pointer emulation: a card and
a chip both come back `focus: true, focusVisible: false, outline-style: none`.
The search field does not. Measured, `verify-deep.json → touchFocus`:

```
before touch : boxShadow "none"                          borderColor rgb(201 188 236)
after TOUCH  : boxShadow "rgb(109 40 217) 0px 0px 0px 2px"  borderColor rgb(109 40 217)
               .dw-find :focus-within = true, input :focus-visible = false
```

That is the standing bar's named tell — "a focus ring that appears on touch" —
drawn by the one control a child is most likely to poke at. It is also the one
place in the app where the same event produces two different treatments, which
is the inconsistency an adult notices without naming.

The intent behind `:focus-within` (ring on the shell, not around the text run,
`catalog.css:150-155`) is right; the selector is not. `:has(:focus-visible)` is
Safari 15.4+ and is inside this bundle's iOS 16.0 floor.

Side effect worth recording: because the input's own outline is suppressed
(`catalog.css:175`), my Tab walk logs the search field as the **one tab stop in
the whole app with no ring on the focused element** — 1 of 42 on every `packs`
render, 0 of N everywhere else. That one is a false alarm (the shell rings), but
it is only a false alarm on a keyboard.

## P3 — No headings, no `<h1>`, and no programmatic identity for any destination

Measured on all five destinations at 1024, both themes
(`verify-deep.json → semantics`, and `headings: []` on every one of the 130
renders in `verify-a11y.json`):

```
packs     headings []   landmarks header, main, section(no name), nav
progress  headings []   landmarks header, main, svg[role=img], nav
profiles  headings []   landmarks header, main, nav
settings  headings []   landmarks header, main, 6× div[role=group], nav
parents   headings []   landmarks header, main, 1× div[role=group], nav
document.title = "Dynawalla"   on every route, never updated
```

* There is **no `<h1>` in the application at all**. The only heading anywhere is
  the pass sheet's `<h2>` (`src/pass/PassSheet.tsx:175`), which therefore starts
  at level 2 under nothing.
* Every course is a bare `<ul>` (`src/shell/Surface.tsx:443`) with no
  `aria-labelledby` and no visible heading, so Settings is one undifferentiated
  list of twenty controls — the "Look / Feel / Device" grouping that exists in
  `surfaces.ts` (`key: "look"`, `"feel"`, `"device"`, `"controls"`,
  `"diagnostics"`) is drawn but never named.
* `<section>` in `Catalog.tsx:317` has no accessible name, so it is not exposed
  as a region.
* Route changes update neither the title nor a live region and move focus
  nowhere, so a screen-reader user pressing a tab hears the tab and then
  silence. WCAG 2.4.2 (Page Titled) and 2.4.6 (Headings and Labels) both fail.

This is not a regression from the pass — it was already true — but it is the
largest single a11y hole in the harness and no agent's write-up mentions it.

## P4 — Which learner is current is unavailable to a screen reader

`src/shell/Surface.tsx:277-307`. The doc comment claims the state is "carried
three ways — the index mark, `aria-current`, and the absence of the 'Use'
button". Measured, all three are invisible to AT:

* the index mark is `aria-hidden="true"` (`src/design/IndexMark.tsx:10`);
* `aria-current="true"` is on a bare `<div>` with no role and no accessible name
  (`Surface.tsx:281`) — a generic container, which AT does not announce;
* the "Use" button is `disabled` **and** `aria-hidden` **and** `tabIndex={-1}`
  (`Surface.tsx:297-299`), so its absence is an absence.

Additionally all three name fields carry the identical accessible name `"Name"`
(`aria-label={strings.profiles.name}`, `Surface.tsx:286`) with the learner's
name only in `value`/`placeholder`. `verify-deep.json → semantics.profiles.inputs`:

```
{ ariaLabel: "Name", labels: [], placeholder: "Amina"     }
{ ariaLabel: "Name", labels: [], placeholder: "Yusuf"     }
{ ariaLabel: "Name", labels: [], placeholder: "Learner 3" }
```

## P5 — `Erase everything` has no programmatic armed state

`src/shell/Surface.tsx:233-247`. The `Learner` remove button gets
`aria-pressed={armed}` (`Surface.tsx:311`) and the destructive `Action` does not.
Measured on `#/parents`:

```
{ text: "Erase everything", pressed: null, role: null }        ← Action
{ text: "Remove", pressed: "false" } ×3                        ← Learner
```

The armed state *is* carried by a label swap (`surfaces.ts:419`,
`view.armed ? eraseConfirm : erase`) so it is not silent — but it is a silent
*name change* on a focused control with no live region, and it is the opposite
convention to the control two screens away. One of the two is wrong.

## P6 — Sticky chrome has no scroll padding, so keyboard focus lands under the tab bar

`grep -rn "scroll-padding\|scroll-margin" src/` → nothing. Both the lintel
(`Shell.tsx:36`, `sticky top-0`) and the tab bar (`Nav.tsx:48`,
`sticky bottom-0`) sit over the scroller, and `body` is the scroller. Tab-walk
evidence on `light/packs-390` (`verify-a11y.json → tabStops`):

```
tab stop 11  CLAIM        top=494  height=352  → bottom 846
tab bar                   top=780  height=56   → covers 780…836
```

Eight of the twenty-seven cards come to rest with roughly 64 px of the card —
including the bottom of its focus ring and the "Play" control — behind the
sticky tab bar. `scroll-padding-block: <lintel> <bar>` on the scroller is the
one-line native equivalent of a `contentInset`.

---

## Claims that are TRUE, and by how much

Everything below was independently re-measured, not taken on trust.

### Contrast — better than claimed

130 renders, every text run, ink composited through inherited `opacity` and
every semi-transparent ancestor, ground resolved to the first opaque paint.
**Zero AA failures.** 27 unique pairs in light, 31 in dark. The lowest pair in
the app is not the one the rows agent quoted (5.81) — it is lower, and it still
passes, because I also captured the armed and error states nobody had rendered:

```
LIGHT   5.49  18px  rgb(172 20 66) on rgb(238 220 238)  "Erase everything — press again"   (parents, ARMED)
        5.81  14px  rgb(91 81 117) on rgb(233 226 251)  "System"                            (settings)
        6.39  14px  rgb(172 20 66) on rgb(244 240 255)  "Remove"                            (profiles)
        7.16  14px  rgb(172 20 66) on rgb(255 255 255)  "That's not it. Try again."          (gate, MISSED)

DARK    5.70  20px  rgb(255 255 255) on rgb(124 58 237) "Choose another game"                (pass)
        6.42  14px  rgb(255 125 158) on rgb(38 26 82)   "That's not it. Try again."          (gate, MISSED)
        6.85  18px  rgb(255 125 158) on rgb(45 23 43)   "Erase everything — press again"     (parents, ARMED)
        7.44  14px  rgb(26 16 51) on rgb(255 125 158)   "Remove"                             (profiles, ARMED)
```

Placeholders — a `::placeholder` is not a text node and the baseline harness
never saw one — also pass: **5.81:1** light, **9.46:1** dark
(`rgb(91 81 117)` / `rgb(185 166 236)` on the recessed field).

The focus ring itself, `--dw-focus`, clears the 3:1 non-text floor by a wide
margin: `#6d28d9` on `#f4f0ff` = **6.4:1**, on white **7.06:1**; dark `#b88cff`
on `#0b0618` is higher still.

### Touch targets — clean, at every size I could reach

Zero interactive elements under 44 × 44 CSS px across all 130 renders
(`smallTargetCount: 0` everywhere), and zero at 320 × 568 as well. The wordmark
lockup measures exactly 44 px (`min-h-target` on `Shell.tsx:58`), which was the
one sub-floor control the audit named, and the chip `min-w-target` fix holds
("All" is 44 px, not 42.1).

### Focus — complete coverage, correct policy

Real Tab keys, one stop at a time, ring read after the transition lands:

```
packs      41 focusable / 42 stops (incl. wrap) / 1 no-ring (the search input, P2)
progress    6 / 7 / 0        profiles  15 / 16 / 0      settings 20 / 21 / 0
parents     9 / 10 / 0       parents-dev 13 / 14 / 0
pass-rest   2 / 3 / 0        pass-gate  3 / 4 / 0       pass-offer 5 / 6 / 0
```

Every focusable element is reachable, the order is DOM order and ends on the tab
bar, and every ring is `2px solid var(--dw-focus)` with a 2 px offset. A real
mouse press and a real touch both produce `focusVisible: false` and
`outline-style: none` on cards, chips and tabs.

*(One trap for whoever measures this next: `transition-colors` includes
`outline-color`, so a computed style read in the same tick as the key event
catches the ring mid-flight at `currentColor` and looks like a per-control ring
colour that is not there. `verify-a11y.mjs` waits 220 ms; the comment says why.)*

### The pass sheet — every claim holds

* One panel, mounted once; `role="dialog"` + `aria-modal="true"` +
  `aria-labelledby` pointing at an element that **exists** (verified by id
  lookup, not by reading).
* Focus lands on the dialog container at rest (`focusedIsDialog: true`) and on
  `#pass-gate-entry` at the gate — both correct.
* The trap is real, driven with twelve real Tab presses: the two controls cycle
  and focus never leaves the dialog.
* Escape does **not** close it. Deliberate, and it holds.
* No focusable element exists outside the dialog.
* Both text links have `text-decoration-line: none`.
* Gate field: `inputmode="numeric"`, a real `<label>` ("Type the current year,
  all four digits."), `aria-invalid`, and a `role="status" aria-live="polite"`
  error line with **20 px of reserved height while empty**.
* **The no-jump claim is proved, not asserted.** I recorded the top and height of
  every control in the sheet, submitted a wrong answer, and re-recorded: 5 of 7
  boxes byte-identical, and the two that differ are the same live region before
  and after (`"" → "That's not it. Try again."`) at the **same 480,20**. Nothing
  moves.

### Native tells — all clean

Measured under coarse-pointer emulation (`verify-deep.json → coarse`):

```
pointer: coarse = true,  hover: none = true
html   scrollbar-width none   overscroll-behavior none
body   scrollbar-width none   overscroll-behavior none   user-select none
.dw-rail  scrollbar-width none   overscroll-behavior "contain auto"
.dw-find input  user-select text        ← a parent can still edit a name
-webkit-tap-highlight-color: rgba(0,0,0,0) on every element sampled
```

No page ever scrolls sideways: `documentElement.scrollWidth - clientWidth = 0`
and `body.scrollWidth - body.clientWidth = 0` on all 130 renders, at 320 px, and
at Largest text on all five destinations. The four `escaping` boxes at 390/430
are the chip rail's own chips beyond its edge, which is what a rail is.

Only one thing draws a scrollbar track anywhere, and it is `body` on a **fine**
pointer with `scrollbar-width: thin` — the deliberate desktop behaviour, gone
the moment `(pointer: coarse)` matches.

### Reduced motion, scroll reset, destination transition

`prefers-reduced-motion: reduce` collapses everything: `.dw-anim-enter`,
`.dw-anim-fade`, `.dw-press`, `.dw-find`, `nav a`, the card and the rail all go
from `0.26s / 0.12s / 0.09s` to `0.001s`. Nothing is missed.

The scroll-reset fix is real and I reproduced the bug it fixes:
`document.body.scrollTop = 900` sticks (900), `documentElement.scrollTop = 900`
does not (0) — body **is** the scroller. After navigating, both read 0. The
chrome agent's defect (a) is genuine and correctly fixed.

`.dw-anim-enter` computes to `animation-name: dw-enter, 0.26s, fill-mode both`.

### Segmented controls and nav semantics

```
Theme        System=false  Light=true   Dark=false      ← aria-pressed, correct
Text size    Normal=true   Large=false  Largest=false
Sound        Off=false     On=true
Haptics      Off=false     On=true
Reduce motion Off=true     On=false
Quality      Full=true     Plain=false
Developer mode Off=true    On=false                     (parents)
nav          Packs [current=page]  Progress  Profiles  Settings  Parents
```

`role="group"` + `aria-labelledby` resolves to the real label on all seven.
`aria-current="page"` is on exactly one tab, on every destination. Every
icon-only control has an accessible name: the pack-stage back chevron
(`Stage.tsx:218`), the search clear button, the world figure
(`role="img" aria-label="37 apertures cut."`). No duplicate ids anywhere. No
`<ul>` with a non-`<li>` child. No focusable element inside `aria-hidden` or at
zero opacity — the invisible "Use" button is correctly `disabled` + `tabIndex=-1`.

---

## Measured but not called defects

Recorded so the next reviewer does not have to re-derive them.

**The elevation ladder is a shadow-and-edge system, not a fill system.** Every
"raised/sunk" fill delta is far under the 3:1 that WCAG 1.4.11 would want if the
fill were the only state cue (`verify-elevation.json`):

```
                                     light   dark
segmented track vs page               1.12   1.02
segmented THUMB vs track              1.25   1.20
chip chosen vs chip unchosen          1.12   1.17
card vs page                          1.12   1.07
search recess vs page                 1.12   1.02
chosen ink vs unchosen ink            2.47   1.93
```

Note that `card vs page` moved from the audit's 1.06 to 1.12 — the `.dw-surface`
change is real but it is the border and the cast shadow doing the work, not the
fill. In every case a second cue carries the state above 3:1 (the index mark on
the chosen segment is **7.10:1 light / 4.12:1 dark**, the nav's brass diamond is
**4.78:1 / 14.82:1** against its seat) *and* `aria-pressed` / `aria-current`
carries it in the markup, so none of these is a failure. But the whole system
rests on an 8 px glyph, and if that glyph is ever removed for tidiness the
selected state of six Settings controls goes with it.

**`nav a` labels are 12 px at phone widths** (`text-xs sm:text-sm`). Below the
app's own body minimum, though above iOS's own 10 px tab label. It is the reason
P1 bites at 320 rather than 375.

**The chip-rail edge dissolve is a `mask-image`**, so a chip under the fade is
literally drawn at reduced alpha and its real contrast at the edge is lower than
any number in this file. Correct as an affordance; unmeasurable as a text pair.

**Card accessible names run 190–260 characters** — the whole tile is one
`<button>`, so its name is name + blurb + two subject chips + grade band +
"Play". 27 of them on the front door. Native list cells do the same thing; it is
long, not wrong.

**A 13 px `body.scrollWidth` overshoot at 320 × Largest did not reproduce.** It
appeared once, immediately after the text-size click, and a re-run with a settle
returned `bodyScrollWidth 320, clientWidth 320, wide: []`. Transient layout, not
a defect.

## One process finding

`capture.mjs` **replaces** `measurements.json` rather than merging into it, so a
partial run silently deletes the record of every screen it did not shoot. This
was not theoretical during this review: when I started, the committed
`measurements.json` held `capturedAt: 2026-07-29T06:30:21Z` with **ten keys, all
`*/packs-*`** — someone's `--only=packs` run had erased the evidence behind the
per-screen numbers in `CRAFT-rows.md`, `CRAFT-pass.md` and `CRAFT-chrome.md`. A
concurrent full run at `06:42:02Z` restored all 100 while I was measuring, and
that run agrees with mine exactly:

```
their fresh 100-render run   small targets 0   AA failures 0   h-scroll 0   min ratio 5.70
my independent 130-render run small targets 0   AA failures 0   h-scroll 0   min ratio 5.49*
```

`*` mine is lower only because I also rendered the armed and missed-gate states,
which nobody had captured. Two independent probes, same conclusion.

The fix is a merge rather than a replace, or the next `--only=` run erases the
record again.
