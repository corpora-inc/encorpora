# The chrome — the lintel, the wordmark, the five destinations, the bands

The frame every screen sits in, and therefore most of the "is this native"
verdict. Four files: `src/app/Shell.tsx`, `src/app/Nav.tsx`,
`src/design/Strapwork.tsx`, `src/design/IndexMark.tsx` (unchanged — see §7).

Everything below was decided against a rendered screen at 390 / 430 / 834 /
1024 / 1440 in both themes, not against the source.

---

## 1. The navigation is a tab bar now, not a row of links

**Audit §7.1 / §7.3 — an 8 px diamond over a 12 px word in a 288 px cell, and
no elevation relationship to the content it scrolls over.**

Four changes, and the point of each is that no single one of them carries the
state:

* **`dw-bar`.** The one rung in the elevation ladder whose shadow points at the
  ceiling. A bar the content scrolls *under* has to be over it; before this the
  catalogue's cards passed behind an opaque strip with no shadow, no scrim and
  no blur, and the bar read as the bottom of the page rather than as something
  above it. Verified on a deliberately scrolled capture, not inferred.
* **A seat under the current tab.** `bg-accent/12`, and `dark:bg-accent/18`
  because a dark ground swallows a wash — measured, the seat stands **1.22:1**
  off the bar in light and needed 18 % rather than 12 % to reach **1.24:1** in
  dark. That is a *shape* cue and is not required to clear 3:1.
* **The index diamond, at 10 px, with its space reserved.** This is the app's
  one warm point and it is spent here, because where you are is the only thing
  on a screen worth spending it on. `opacity-0` when idle, so nothing moves
  when the tab changes (audit §0.3, applied pre-emptively to the nav).
* **`aria-current="page"`** still comes from `NavLink`, so the state is in the
  markup as well as in the drawing.

**Targets.** Every tab is `min-h-target-comfort` (56 px) by a full fifth of the
measure — 70 px at 390 px wide, 134 px from 834 up. `dw-press` gives the
90 ms decelerating scale on touch, and its hover is already scoped to
`(hover: hover) and (pointer: fine)` so nothing sticks after a finger leaves.

**Safe area.** `pb-[max(var(--safe-bottom), var(--dw-space-2))]` — a *floor*
under the inset, not the inset alone. A desktop window and an Android device
with gesture navigation both report zero, and the tabs then sat 4 px off the
bottom edge of the glass at 1440 (visible in the previous run's
`light/parents-1440.png`).

**Label size: `text-xs sm:text-sm`, and the split is deliberate.** 14 px from
640 px up. It stays at 12 px on a phone because `tokens.css` records that the
12.5 % text-size steps were chosen as the largest that keeps five labels on one
line at 320 px, and 14 px × 1.25 measures ~67 px against a ~62 px cell. Raising
the phone label would trade a legible tab bar at Normal for a truncated one at
Largest. The phone gets the seat and the diamond instead, which is what §7.1
actually asked for.

## 2. Three competing measures, reduced to two — and the two now agree

**Audit §0.8 — full-bleed lintel, `max-w-6xl` surface, `max-w-2xl` courses,
full-bleed five-cell tab bar, so the wordmark, the content and the tab labels
all started at a different x.**

* The lintel's row and `<main>` are both `dw-frame` now (72 rem, gutter widened
  by the safe-area inset on the side that has one). At 1440 the wordmark moved
  from x ≈ 16 to x ≈ 164 — **the same left edge as the first card in the
  catalogue grid**, confirmed in `light/packs-scrolled-1440.png`.
* The bar's *material* still runs edge to edge, because an edge that stops is
  not an edge — but the tabs inside it are capped at `--dw-measure-text` and
  centred, so they sit on the same 42 rem the courses use. At 1024 and 1440 the
  tab row and the rows on Settings/Parents now share both centre and width.

What is left is one honest split: the lintel and the catalogue share the
**frame**; the tabs and the courses share the **measure**. Two systems that
each mean something, rather than four that mean nothing. Closing the last gap
means changing the courses' measure, which lives in `shell/Surface.tsx` and
belongs to another pass.

## 3. The lintel stays

A title bar that scrolls away is a page; one that stays is an app. `sticky
top-0` plus `shadow-surface`, which is the other half of it — without a cast
the band is just a rule the content happens to pass under.

`z-30`, and the number matters: the pack stage is `fixed inset-0 z-50`, so the
obvious `--z-sticky` (1001) would have painted the tab bar **over a running
game**. Both sticky surfaces sit below 50 on purpose.

`shadow-surface` rather than the `dw-surface` rung, because the rung's hairline
border would draw a second edge immediately beneath the strapwork band.

## 4. The strapwork reads as architecture at 1440, not as a craft border

An SVG `<pattern>` repeats in *user* units and a pattern's `width` is an
attribute, not a CSS property — so no media query and no arithmetic can resize
the motif. A 24 px tile is right on a phone and wrong at 1440, where sixty
repeats of a fine zigzag stop reading as a carved course.

So there are two tiles and CSS chooses: `{unit 24, height 10}` below 768 px,
`{unit 36, height 14}` at and above it. Same geometry, same single stroke
weight, more band given to each repeat. Compare `dark/settings-1440.png`
against the baseline: the band is now an open interlace instead of a chain.

The component also reads `--dw-band-strap` / `--dw-band-knot` directly, which
is what `FOUNDATION.md §5b` asked the next person to touch it to do. The
compatibility block at `index.css:193` that remaps `--dw-line-strong` and
`--dw-index` inside the pattern is now dead and can be deleted by whoever owns
that file.

## 5. Arriving somewhere is now an event

**Audit §0.7 — no transitions between destinations at all.**

`<Outlet>` is wrapped in a div keyed by `pathname` and carrying `dw-anim-enter`:
260 ms, emphasised-decelerate, rising by `--dw-enter-lift`. The direction is the
explanation — it came from under the tab that was just pressed. Reduced motion
collapses the duration *and* the lift, which the foundation already handles.

The key changes nothing about mounting: react-router already swaps the route
element, and the key is identical for an identical path.

## 6. Two defects this pass found by building rather than by reading

**a. The scroll reset was a silent no-op.** `overflow-x: hidden` on `html, body`
promotes overflow-y to `auto` on **body**, so body is this app's scrolling box
— while `document.scrollingElement` and `window.scrollTo` both address
`documentElement`, which does not move. Written the obvious way, tapping a tab
would have left you halfway down the next screen on every device. Caught by
instrumenting the capture harness to scroll before shooting: the "scrolled"
shot came back byte-identical to the unscrolled one. `Shell.tsx` now sets both.

**b. A Tailwind class that types, lints, builds — and never ships.** Written
`` `md:hidden${extra}` ``, the candidate Tailwind extracts from the source text
is `md:hidden${extra}`, which matches no utility. The rule is simply absent
from the built stylesheet, so every screen silently kept the phone-scale band.
Found by grepping `dist/assets/*.css` for `md\:`, which is now worth doing
after any responsive change. A space before the interpolation is the fix and
there is a comment in `Strapwork.tsx` saying why.

## 7. Not changed, on purpose

* **The wordmark lockup.** Mark 40 px, `items-end`, `mb-[0.16em]` — untouched,
  per `docs/HARNESS_FEEDBACK.md`. The only edit is `min-h-target`, which raises
  the *link box* from the measured 43.2 px to 44 without moving a letter
  (`items-end` guarantees that), closing the one sub-44 px target the audit
  found in the chrome. `tracking-[0.22em] uppercase` became `dw-wordmark`,
  which is the same two values from the foundation.
* **`IndexMark.tsx`.** It earns its place — it is the app's warm point and the
  non-colour half of the tab state — and it is sized by the caller's className,
  so it needed no change. Editing its `width`/`height` attributes would have
  moved it in `shell/Surface.tsx` too.
* **The bands stay full-bleed.** They are the edge of the surface above them,
  and an edge that stops mid-screen is a decoration.

---

## Measured, after

Capture harness, 60 shots across the five destinations at 390 / 430 / 834 /
1024 / 1440 in both themes:

| check | result |
|---|---|
| screens with horizontal page overflow | **0** |
| interactive targets under 44 px | **0** (baseline: the wordmark, 220.3 × 43.2) |
| AA failures | **0** |
| body vertical overflow, Settings at 1024 × 768 | **0** — the chrome grew ~25 px and still fits the 820 rung |
| capture failures | **0** |

Chrome contrast, computed from the palette (WCAG 2.1, sRGB):

| pair | light | dark |
|---|---|---|
| active tab label on its seat | 14.74 | 13.29 |
| idle tab label on the bar | 7.30 | 7.91 |
| index diamond on the seat *(graphic, needs 3.0)* | 5.14 | 11.36 |
| seat against the bar *(shape cue, no floor)* | 1.22 | 1.24 |

The 4 "escaping" elements the harness still reports on `packs` at 390/430 are
the catalogue's subject chips, which scroll sideways inside their own box by
design. Not chrome.

## Gates

```
npm run tsc     ✓
npm test        ✓  226 tests, 0 fail
npm run lint    ✓
npm run build   ✓  52.25 kB css / 466.13 kB js
```

## Left undone

* The courses' 42 rem measure in `shell/Surface.tsx` is the last piece of
  audit §0.8. Out of this pass's file scope.
* Motion cannot be reviewed from a still frame. The destination transition and
  the press scale were verified as shipped CSS in `dist/assets/*.css`, not
  watched.
* `env(safe-area-inset-*)` is 0 in headless Chrome, so the nav's home-indicator
  clearance is reasoned, not seen. Worth one look on a device.
* The capture harness was temporarily patched with a `scroll:` option to prove
  the sticky lintel and to catch defect 6a, then restored byte-identical. That
  option is worth adding permanently by whoever owns the tool — a sticky
  surface cannot be reviewed at scrollTop 0.
