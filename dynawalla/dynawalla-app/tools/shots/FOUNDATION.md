# Dynawalla — the foundation

What `src/design/tokens.css` and `src/index.css` now define, and the rules that
come with it. Every other file in the harness builds on this; nothing else may
name a colour, a duration, an easing or a gap.

Two files, and only two. Colours live in `tokens.css`. A hex literal anywhere
else is a defect and `src/design/tokens.test.ts` fails the build over it.

---

## 1. The spacing rhythm

One scale. Eight steps, doubling and then stepping by eighths of a rem so
nothing lands on a half pixel at the 16 px default.

```
--dw-space-1  4px    --dw-space-5  24px
--dw-space-2  8px    --dw-space-6  32px
--dw-space-3  12px   --dw-space-7  48px
--dw-space-4  16px   --dw-space-8  64px
```

Components do not use the steps directly. They use the **roles**, which are
what keep five screens on one rhythm:

| token | Tailwind | what it spaces |
|---|---|---|
| `--dw-frame-pad` | `p-frame` | screen edge → content |
| `--dw-surface-pad` | `p-surface` | inside a card or a course |
| `--dw-lintel-pad` | `p-lintel` | inside the lintel |
| `--dw-stack-gap` | `gap-stack` | course → course |
| `--dw-stack-gap-tight` | `gap-stack-tight` | within a course |
| `--dw-row-pad` | `py-row` | a row's own vertical padding |
| `--dw-row-gap` | `gap-row-gap` | a row's label → its value |
| `--dw-label-gap` | `gap-label` | a legend → the control it labels |
| `--dw-grid-gap` | `gap-grid` | the catalogue grid |
| `--dw-inset` | `p-inset` | inside a chip or a segment |

`--dw-label-gap` is new and it is the fix for the alternating rhythm the audit
found on Settings (§4.2): a fact row was optically centred at 12 px while a
choice row put 8 px above its control and 12 px below it, so two spacing
systems ran down one screen.

**Sizes that are facts about a hand, not taste**, and which therefore never
scale down with the rungs:

```
--dw-target-min       2.75rem / 44px   the platform touch floor
--dw-target-comfort   3.5rem  / 56px   anything a CHILD taps
--dw-row-min          4rem    / 64px   a child-sized row
```

**The rungs.** Everything in the first table comes down together on short
viewports — `max-height` 900 / **820** / 720 / 620. The 820 rung is new: iPad
landscape is 1024 × 768 and fell into the 900 rung, where Settings overran the
fold by 65 px. Measured after: `scrollHeight == clientHeight == 768`. Fixed
from tokens alone.

**The two measures.** The audit found three competing ones on a desktop
screen, so the wordmark, the content and the tab labels each started at a
different x and Parents at 1440 × 900 used about a fifth of the screen.

```
--dw-measure-text    42rem / 672px   a column of rows
--dw-measure-frame   72rem / 1152px  the widest the chrome ever gets
```

Everything aligns to one of these two and nothing invents a third. The lintel
and the navigation take `--dw-measure-frame`; the column of rows takes
`--dw-measure-text` centred inside it. `.dw-frame` and `.dw-measure` in
`index.css` do this in one class each — `.dw-frame` also widens its gutter by
the safe-area inset on the side that has one, which a symmetric padding cannot
do for a phone held in landscape.

---

## 2. Elevation

Five rungs, each a **triple**: a background, an edge and a cast light. A
surface that borrows one of the three from somewhere else is how a design ends
up with a card whose shadow and border disagree about how high it is.

| rung | class | is |
|---|---|---|
| ground | — | the page |
| sunk | `.dw-sunk` | a recess: a segmented-control **track**, a well |
| surface | `.dw-surface` | a card, a course |
| raised | `.dw-raised` | something pressable **on** a surface: the selected segment, a chip, the tab bar |
| overlay | `.dw-overlay` | a sheet over everything: the pass sheet, the gate |

Also `.dw-bar` (a bar the content scrolls under — it casts **up**) and
`.dw-scrim` (the dimming behind a sheet).

**The two themes carry height by opposite means, and both are the native
convention.**

* **Light**: every raised thing is the same white and stands off the page by
  casting violet light onto it. Two shadow layers each — a tight contact
  shadow that seats the object and a wide soft one that gives it height. One
  layer alone always looks like a CSS default.
* **Dark**: nothing casts. Height is *lighter stone* plus a one-pixel lit top
  edge, the way a raised face catches the light above it. The ramp is
  `basalt-800 → 700 → 600 → 500`; `600` and `500` are new and they are what
  makes a dark sheet read as a sheet. The pass sheet measured **1.13:1**
  against its own backdrop before they existed.

**Every shadow is violet.** `rgb(45 20 92)` — basalt pushed a little further
into the blue. A neutral grey shadow on a violet ground is the single fastest
way to look like a framework default, because it is one.

`--dw-ground-lifted` is what finally lets a segmented control be drawn the way
every platform draws one: **a recessed track with a raised thumb in it**. The
whole app was drawing it inverted (audit §0.2) — selected option darker,
unselected options lighter. The correct construction is now:

```
track     bg-ground-sunk  .dw-sunk
selected  bg-ground-lifted .dw-raised   (+ shadow)
other     transparent, text-ink-muted
```

---

## 3. Motion

Three motions, and the app needs no fourth. Each is a duration paired with an
easing, and the pairing is **asymmetric on purpose**: one curve used in both
directions is the loudest motion tell of a web page, because nothing physical
decelerates into a stop and out of one at the same rate.

| motion | duration | easing | why |
|---|---|---|---|
| **press** | `--dw-motion-press` 90ms | `--dw-ease-press` decelerate | the finger is already there; acknowledge before the eye can doubt. Over ~100 ms reads as lag, not feedback |
| **enter** | `--dw-motion-enter` 260ms | `--dw-ease-enter` emphasised decelerate | a surface arriving explains where it came from |
| **exit** | `--dw-motion-exit` 160ms | `--dw-ease-exit` accelerate | leaving is always quicker than arriving; the decision is already made |

Composites, so a component cannot pair the wrong curve with the wrong
duration: `--dw-transition-press`, `--dw-transition-enter`,
`--dw-transition-exit`, `--dw-transition-state`.

Kept from before because they are named in EXPERIENCE_DESIGN and in shipping
components: `--dw-motion-quick` (120 ms, a state change), `--dw-motion-detent`
(200 ms, the seat), `--dw-motion-settle` (420 ms, the world moving).

Classes: `.dw-press` (transform on the press curve, colour on the state curve —
they are different events and running both on one timing is what makes a web
button feel like a web button), `.dw-anim-enter`, `.dw-anim-exit`,
`.dw-anim-fade`.

**Reduced motion.** Every `--dw-motion-*` collapses to `0ms` in *both* the
`prefers-reduced-motion` block and the `[data-motion="reduced"]` block — the
in-app switch exists because a child on a shared tablet whose OS setting is
somebody else's is exactly who it is for. The displacement tokens
(`--dw-press-scale`, `--dw-enter-lift`) collapse too, because a 0 ms
transition into a displaced position is still a jump; it just happens
instantly, which is worse. `tokens.test.ts` fails if a fourth duration is
added and the collapse is forgotten.

Hover is scoped to `@media (hover: hover) and (pointer: fine)`. Applied on
touch it leaves a control looking pressed after the finger has gone.

---

## 4. Typography

Nine sizes, each carrying its **own line-height and its own letter-spacing**.
Optical tracking is not decoration: type set at one tracking across nine sizes
is the most reliable way to look like a website. Small text opens up, large
text closes in — SF and Roboto are both drawn expecting it.

| step | size | line | track | role |
|---|---|---|---|---|
| `xs` | 12 | 1.35 | +0.02em | metadata, chips |
| `sm` | 14 | 1.45 | +0.01em | secondary |
| `base` | 16 | 1.5 | 0 | body |
| **`md`** | **18** | 1.45 | −0.005em | **the row label — the size a child reads down a list** |
| `lg` | 20 | 1.4 | −0.01em | card title, action |
| `xl` | 24 | 1.3 | −0.015em | course legend |
| `2xl` | 30 | 1.22 | −0.02em | screen title |
| `3xl` | 38 | 1.15 | −0.022em | display |
| `4xl` | 48 | 1.05 | −0.025em | numerals, hero |

`text-md` is new. The jump from 16 to 20 is too coarse for a screen whose whole
job is a column of rows.

**Three faces, used for three things and nothing else.** `--font-inscription`
(old-style serif) is display: what reads as cut into a surface.
`--font-numeral` is where digits live, always with `.numeral` so figures are
tabular. `--font-text` is everything else. The audit found all three colliding
inside one pass-sheet row (§6.3) — a rounded-grotesque price beside an
old-style-serif name reads as two different products. **One row, one face.**

**Where uppercase tracking belongs**, and it is a short list:

* `.dw-wordmark` (`--tracking-wordmark`, 0.22em) — DYNAWALLA in the lintel.
  Nothing else.
* `.dw-caps` (`--tracking-caps`, 0.09em) — a pack title that arrives from a
  manifest already in capitals.

**Where it does not**: a settings legend, a tab label, a section heading, a
metadata run. A small tracked capitalised label over a form control is a web
dashboard idiom; every native platform sets that same label in sentence case at
reading size.

---

## 5. The two deferred items, resolved

### "Erase everything" was coral

`--dw-strike` was `copper-500` `#c2453c` — left over from the pre-purple
palette, a hue that belonged to no other colour on the screen, **and** 4.45:1
on the light ground, failing AA on the two most consequential controls in the
app ("Erase everything", "Remove").

Resolved with a **rose** ramp whose hue is taken from the arc's own rose end
(`--color-arc-11`, hsl 348°). Danger is now drawn in a colour the app already
contains rather than one imported from a generic red: unmistakably a warning,
unmistakably from here. The copper ramp is gone.

Measured after, by the capture harness on the real screen: **6.39:1 light,
8.24:1 dark**.

A destructive control also needs three parts, not one, so there are now three
tokens: `--dw-strike` (the word), `--dw-strike-line` (the frame it is bounded
by) and `--dw-strike-ground` (the wash it sits in once armed), plus
`--dw-strike-fill` / `--dw-on-strike` for a solid one. "Erase everything" was a
bare coral phrase floating in white space with nothing to say it was the most
consequential control in the app.

### The strapwork bands were the screen's warm point, sixty times over

The band paints one knot every 24 px in `--dw-index`, and it is drawn twice on
every screen — so a 1440 px screen carried roughly a hundred and twenty gold
knots against a brand rule of **one warm point per screen**. In light the same
knots resolved to `brass-700`, which at 1 px over parchment read as a red-brown
dotted ribbon: the closest thing in the app to the explicitly-dead sandstorm.

Resolved by **making the bands cool**. The band is structural — it is the edge
of the surface above it, not decoration laid on one — so it is now drawn in the
app's own violet (`--dw-band-strap`, `--dw-band-knot`), and the warm point moves
to the one place a gold mark earns its keep: the navigation index that says
where you are. One warm point per screen, exactly.

`index.css` scopes the two tokens onto the band's `<pattern>` so `Strapwork.tsx`
still names roles and never a colour. When that component is next touched it
should read `--dw-band-*` directly and that block can go.

---

## 6. Light mode, brought up

Light was a bleached dark: a card measured **1.06:1** against the page it sat
on, so the near-black key art read as the object and the card read as nothing.

* `--dw-line` was `parchment-300`, **1.16:1 on white** — a rule you cannot see.
  It is now `stone-200`, **1.77:1**, about what iOS draws a table separator at,
  and the reason a light list now has a spine.
* `--dw-line-strong` was fainter than a hairline is supposed to be (1.6:1). New
  material `stone-500`, **2.66:1**. `stone-400` itself is untouched, because
  dark `--dw-ink-muted` is drawn from it and darkening it would cost 9.23:1 of
  body contrast.
* Cards now cast violet light. Same white, same ground, but a two-layer contact
  + height shadow, so the card is an object rather than a rectangle of paper on
  paper.
* The warm point is `brass-800` (hue 42°, a struck old gold) rather than
  `brass-700` (hue 30°, terracotta) — and 5.61:1 where the old one sat at 4.79
  and looked orange doing it.
* `--dw-seat` is `tile-700`; `tile-600` fell to 4.27:1 on a sunk row.
* `--dw-accent-fill` / `--dw-on-accent` exist as a **pair** because the obvious
  construction (`bg-accent` + `text-ink-inverse`) measures **4.34:1 in dark**
  and fails. Never build a solid accent control by hand.

It is recognisably the same product: same violet ground, same mark, same
interlace, same one warm point. It is not a bleached version of the dark one.

---

## 7. Native tells closed at the foundation level

Not new rules — these are in `index.css` now and apply everywhere without a
component doing anything:

* **The desktop scrollbar** is a thumb on nothing, in the theme's own violet,
  inset by a transparent border so it floats. A painted grey channel down the
  edge of the page was on every 1024 and 1440 capture. (Touch still gets no
  scrollbar at all; that was already right and is untouched.)
* **`text-size-adjust: 100%`** — WebKit inflates text in a narrow column on
  rotation. Left on, a phone rotated to landscape re-flows every label by a few
  percent: "text that jumps as state changes", arriving from the platform.
* **`-webkit-font-smoothing: antialiased`** — every native surface on iOS and
  macOS is drawn this way. Off, it is a small constant weight difference that
  reads as "browser".
* **`font-size: max(1rem, 16px)` on fields** — iOS zooms the viewport when a
  field under 16 px takes focus, and does not zoom back out. `max()` rather than
  a flat 16 so the text-size settings still scale it.
* **`accent-color` / `caret-color`** — native checkboxes, radios and the text
  caret are drawn by the platform in the platform's tint unless told otherwise.
* **`--dw-hairline`**, 0.5px at 2dppx and above. `1px` on a 3× screen is three
  device pixels — the width of a border on a web page and about three times the
  width of a separator in a native list. `.dw-hairline`, `.dw-hairline-b`,
  `.dw-hairline-t`.
* **`.dw-fade-x`** — a row that scrolls sideways inside the page dissolves at
  both edges rather than stopping, which is the signal every native carousel
  uses. The subject-chip row overflows by 440 px on a phone with nothing
  currently saying so.

---

## 8. Measured contrast

WCAG 2.1, sRGB. AA needs 4.5 for normal text, 3.0 for large text and graphics.
The full table is in the header comment of `tokens.css`; the summary:

| pair | light | dark |
|---|---|---|
| ink / ground | 16.09 | 17.80 |
| ink / raised | 18.01 | 16.69 |
| ink / lifted | 18.01 | 15.26 |
| ink / float | 18.01 | 13.87 |
| ink-muted / ground | 6.52 | 9.23 |
| ink-muted / raised | 7.30 | 8.66 |
| accent-ink / ground | 8.02 | 10.87 |
| accent-ink / raised | 8.98 | 10.19 |
| index (the warm point) / ground | 5.61 | 16.43 |
| **strike / ground** | **6.39** | **8.24** |
| strike / raised | 7.16 | 7.72 |
| seat / ground | 6.10 | 8.98 |
| on-accent / accent-fill | 7.10 | 5.70 |
| on-strike / strike-fill | 7.16 | 7.44 |
| accent as line art / ground *(needs 3.0)* | 6.35 | 4.81 |
| index-lit as a glint / ground *(needs 3.0)* | 3.43 | 10.07 |

Every text pair passes AA. The only values under 4.5 are graphics, where the
floor is 3.0.

Confirmed on rendered screens rather than only on paper: the capture harness
measures the computed colour of every text run against the ground it actually
sits on, and reports **0 AA failures** across `packs`, `settings`, `parents`
and `pass-offer` at 390 and 1440 in both themes. The baseline had 2, both
`--dw-strike`.

---

## 9. Rules for anyone building on this

1. **`className`, never a React `style` prop.** `style-src 'self'` silently
   discards inline styles in the shipped build. It works in dev and dies on
   device. There is a test.
2. **No hex outside `tokens.css`'s `@theme` block.** There is a test for that
   too, and it reads comments as well as code.
3. **No Tailwind built-in colour utility** (`bg-violet-500`, `text-gray-700`).
   They compile, they contain no hex, and they do not re-cut for dark — which
   is exactly the silent light-on-dark failure the semantic layer exists to
   prevent. There is a test.
4. **Pick a rung, not a background.** `.dw-surface` / `.dw-raised` /
   `.dw-overlay` carry background, edge and cast light together.
5. **Pick a role, not a number.** `p-surface`, `gap-stack`, `py-row`. If a gap
   needs a value the roles do not have, the roles are wrong — fix them here.
6. **Never pair a duration with a curve by hand.** Use
   `--dw-transition-press` / `-enter` / `-exit`.
7. **One warm point per screen.** `--dw-index`, once. If a screen needs a
   second, one of them is not the apex.
