# Dynawalla harness — baseline visual audit

Captured by `tools/capture.mjs` against the app at `0.1.0`, seeded with the real
`pack.json` of all 27 games. 100 shots: 10 screens × 5 widths (390 / 430 / 834 /
1024 / 1440) × light and dark, plus `measurements.json`.

Everything below is either **visible in a named PNG** or **measured in
`measurements.json`**. Nothing here is inferred from reading a component. Paths
are relative to `dynawalla/dynawalla-app/`.

Re-run with `node tools/capture.mjs`; `--no-build` reuses `dist/`.

## What is already right, and must not be undone

Verified in this run, so a later pass does not re-litigate it:

* **No page scrolls sideways.** `documentElement.scrollWidth == clientWidth` on
  all 100 captures, including `parents-dev` at 390 where the capability strings
  are longest. The `min-w-0` fix in `src/shell/Surface.tsx:46-51` holds.
* **No tap highlight, no selection handle, no double-tap zoom** —
  `src/index.css:40-62`.
* **No bounce on a fixed surface** — `overscroll-behavior: none` on both `html`
  and `body`, `src/index.css:26` and `:48`.
* **The wordmark lockup.** The mark's `mb-[0.16em]` sits it on the letters'
  feet at every width. Correct in all 20 lintel captures.
* **Row height.** Every course row is `min-h-16` (64 px). No child-facing row is
  under the target floor.
* **Contrast, everywhere except one token** — see §0. 22 distinct text/ground
  pairs measured; 20 pass AA, the two failures are the same colour.

---

## 0. Cross-cutting — these appear on more than one screen

### 0.1 The "one warm point" rule is broken by a factor of about 120 · **worst defect**

`src/design/Strapwork.tsx:41` paints every knot of the interlace with
`fill="var(--dw-index)"` — the brass apex colour. The band is `width="100%"` and
the tile repeats every 24 px, so a 390 px screen carries ~16 gold knots per band
and a 1440 px screen ~60. The band is drawn **twice on every screen**: under the
lintel (`src/app/Shell.tsx:49`) and above the navigation (`src/app/Nav.tsx:29`).

The brand rule is one warm point per screen, at the top of something
(`dynawalla/brand/README.md`). What is actually shipping is a repeating gold
ribbon top and bottom of every one of the five destinations, plus a gold index
diamond in the nav, plus gold inside the key art of several cards.

In light theme this is worse: `--dw-index` resolves to `brass-700` `#b45309`
(`src/design/tokens.css:189`), which at 1 px stroke over parchment reads as a
**red-brown dotted ribbon** — see `light/parents-1440.png` and
`light/profiles-390.png`. That is the closest thing in the app to the explicitly
dead "dusty khaki sandstorm feel".

This is the item `docs/HARNESS_FEEDBACK.md` recorded as "noted, not yet acted
on". It is now measured and it is the single loudest thing in every capture.

### 0.2 Selected state is drawn as a recess, so every segmented control reads inverted

`src/shell/Surface.tsx:84`:

```
active ? "bg-ground text-ink" : "bg-ground-raised text-ink-muted"
```

The **chosen** option gets `--dw-ground`; the **unchosen** options get
`--dw-ground-raised`, which is lighter in both themes. So the option that is not
selected is the one that looks like a raised, pressed-able key, and the selected
one looks like a hole.

`light/parents-1440.png` is the clearest: "Developer mode" is Off, and the white
"On" segment is the one that reads as active. `dark/settings-390.png` shows it on
six controls at once — for Sound the lit-looking segment is "Off" while the
diamond says "On".

Every platform convention (iOS segmented control, Android toggle group) does the
opposite: the selection is the raised, lighter chip. The catalogue chip has the
same inversion at `src/catalog/Catalog.tsx:236` — the active chip is
`bg-ground-sunk`, i.e. darker than the page.

### 0.3 The index mark is inserted into flow, so text jumps when state changes

Three places conditionally *insert* an 8 px SVG plus a gap rather than reserving
its space:

| where | file:line | what moves |
|---|---|---|
| segmented option | `src/shell/Surface.tsx:87` | the option label shifts right ~16 px the moment it is chosen, and the two labels beside it re-centre |
| learner row | `src/shell/Surface.tsx:129` | the current learner's name field starts 44 px further right than every other learner's — visible in `light/profiles-390.png`, where "Amina" is indented and "Yusuf" is not |
| pack card | n/a | (correct — no mark) |

This is the named defect "text that reflows or jumps as state changes". The
`Action` row at `src/shell/Surface.tsx:108` gets it right (`opacity-0`, space
reserved) — but then produces 0.4 below.

### 0.4 Three different left edges on one screen

Because `Action` reserves the index mark's width, an action label starts 44 px
in while a fact label starts at 0. In `dark/parents-dev-390.png`, "Version",
"Learners" and "Platform" are flush with the rules; "Erase everything" is
indented. In `light/profiles-390.png`, "Add a learner" is indented and the
learner names are not.

Files: `src/shell/Surface.tsx:103-110` (Action) vs `:46-52` (Fact) vs `:123-157`
(Learner).

### 0.5 A drawn scrollbar track, on the front door, on a phone

Measured, not guessed. `measurements.json` records for `light/packs-390`:

```
div.-mx-1.flex.gap-2.overflow-x-auto  x:auto  overflow 440px  scrollbar-width:auto
body                                  y:auto  overflow 4202px scrollbar-width:auto
```

`src/index.css:78-87` suppresses scrollbar tracks **only** under
`@media (pointer: coarse)`. That is a defensible call for the page scroller on a
desktop — but two consequences were not intended:

1. The subject-chip row (`src/catalog/Catalog.tsx:186`) draws a **horizontal
   track inside the content** at 390 and 430. It is plainly visible in
   `dark/packs-390.png` as a grey bar under "All / Number sense / Addition &
   subtraction". A horizontal track sitting between the search field and the
   game grid is the loudest web-page tell in the app.
2. Desktop and tablet-with-trackpad are first-class targets, and every capture
   at 1024 and 1440 has a painted page track down the right edge.

The chip row also overflows by **440 px at 390** with no fade, no gradient and no
peeking half-chip beyond the clipped fourth one — a child has no signal that
three more subjects exist.

### 0.6 `--dw-strike` fails AA in light theme — measured 4.45:1, needs 4.5:1

`src/design/tokens.css:218` — `--dw-strike: var(--color-copper-500)` = `#c2453c`.
On `--dw-ground` (`parchment-100`, `#f4f0ff`) that measures **4.45:1**, below the
4.5:1 floor for normal text. It fails on two controls, both destructive:

| text | size | file:line | ratio |
|---|---|---|---|
| "Erase everything" | 20 px / 400 | `src/shell/Surface.tsx:105` | 4.45 ✗ |
| "Remove" | 14 px / 400 | `src/shell/Surface.tsx:151` | 4.45 ✗ |

Dark theme is fine (`copper-400` on the void = 8.20:1). Every other pair in the
app passes; the next-worst is 6.52:1.

`docs/HARNESS_FEEDBACK.md` flagged the coral hue as semantically odd against
violet and left it for a deliberate decision. It is now also an accessibility
failure, so the decision is forced.

### 0.7 There are no transitions between destinations at all

`src/app/router.tsx:33` uses a plain `createHashRouter` and `src/app/Nav.tsx`
plain `NavLink`s. Tapping a tab swaps the entire surface in one frame. The only
motion tokens in use are 120 ms `transition-colors` on hover/press states
(`src/shell/Surface.tsx:83`, `:104`, `src/catalog/Catalog.tsx:67`, `:235`).

Named defect: "transitions that are absent". Nothing explains where a screen
came from. A View Transition here would be explanatory rather than decorative,
and `--dw-motion-detent` / `--dw-ease-detent` already exist for it
(`src/design/tokens.css:272-275`) with reduced-motion already collapsing them
(`:466-503`).

### 0.8 Desktop and large tablet: three competing measures, and most of the screen is empty

At 1440 (`light/parents-1440.png`, `light/settings-1440.png`,
`light/packs-1440.png`) there are three different alignment systems on screen at
once:

* the lintel is **full-bleed**, mark at x≈16 — `src/app/Shell.tsx:25`
* the surface is **`max-w-6xl`** (1152 px) centred — `src/app/Shell.tsx:72`, and
  the courses inside it are **`max-w-2xl`** (672 px) centred —
  `src/shell/Surface.tsx:244`
* the navigation is **full-bleed** with five equal 288 px cells —
  `src/app/Nav.tsx:30`

So the wordmark, the content, and the tab labels all start at different x. On
`parents` at 1440 the content occupies 672 × 380 px of a 1440 × 900 viewport —
about 20% — with the remaining 80% flat ground and a bottom tab bar stretched
across it. It reads as a phone app in a desktop window.

### 0.9 iPad landscape (1024 × 768) cuts the last row off Settings

Measured: `light/settings-1024` — `body` scrolls by 65 px. The vertical rungs at
`src/design/tokens.css:302-327` step at 900 / 720 / 620 px height, so a 768 px
viewport gets the 900 rung and the six choice rows overrun. On the widest tablet
orientation, with 1024 px of unused width, the "Quality" control is below the
fold. See `light/settings-1024.png`.

---

## 1. Packs — the front door (`/`)

Files: `src/catalog/Catalog.tsx`, `src/catalog/PackArt.tsx`,
`src/shell/surfaces.ts:245`.

**1.1 The grid never grows a column past 10.5 rem.**
`src/catalog/Catalog.tsx:209` — `minmax(10.5rem, 1fr)` with `auto-fill`. At 1440
that produces six ~170 px columns inside the 1152 px frame
(`light/packs-1440.png`): 27 postage stamps with 11 px metadata. The comment
above the line justifies the 10.5 rem *floor* correctly (COUNTERWEIGHT needs
142 px at the title's 15 px) — but a floor is not a ceiling, and no breakpoint
raises it. A desktop should get fewer, larger cards, not more, smaller ones.

**1.2 "Play" is small print, not a control.**
`src/catalog/Catalog.tsx:110-112` puts the word in the same 11 px muted numeral
run as "Grades 1–5", on the same line. In `dark/packs-390.png` it reads
"Grades 1–5 Play" as one metadata string. The whole tile is the button, which is
right — but the one word that says so is the least visible thing on the card.

**1.3 The metadata block is ragged across a row.**
`src/catalog/Catalog.tsx:100-113`. Two subject chips are shown, and the names are
long ("Addition & subtraction" is 22 characters), so each chip takes its own
line at narrow columns. In `light/packs-1440.png`, ABYSSAL BLOOM and DEEPSWARM
have two chip lines, ARENA has one, and CLAIM wraps "Play" onto a line of its
own. Four different bottom-block shapes in one row of six. `mt-auto` pins the
block to the bottom, so the raggedness lands exactly where the eye scans.

**1.4 Descriptions are cut mid-word, and the manifests are far too long for two
lines.** Measured: the clamped `span` at `src/catalog/Catalog.tsx:98` overflows
its 2-line box by 30–165 px across cards — i.e. some descriptions are eight lines
of text shown as two. "A bioluminescent reef that keeps growing whil…" is what a
child reads. Either the card needs a real summary field or the manifests need a
short line; truncating a paragraph is neither.

**1.5 Light theme: the cards barely exist, and the art is a black brick on
paper.** `src/catalog/Catalog.tsx:65` gives the card `bg-ground-raised` (`#fff`)
and `border-line` (`parchment-300`, `#dcd2f5`) over a `parchment-100` ground —
about 1.06:1 between card and page. Meanwhile `--dw-art-void` stays
`basalt-800` in both themes by design (`src/design/tokens.css:248`), so each
card is a near-black square sitting on white with almost no card edge around it.
In `light/packs-1440.png` the art reads as the object and the card reads as
nothing.

**1.6 The "All" chip is 42.1 × 44 px.** Measured on all 20 catalogue captures.
`src/catalog/Catalog.tsx:234` sets `min-h-11` and `px-3` but no minimum width,
and "All" is a short word. Below the 44 px floor on the axis it is thinnest, and
it is the control that clears the filter.

**1.7 The wordmark link is 220.3 × 43.2 px.** Measured on all 70 shell captures.
`src/app/Shell.tsx:40-46` — 0.8 px under the floor, and it is the "go home"
control. Fixed by the lintel padding, not by the link.

**1.8 `resting` reads as nothing at all.** The seed marks one pack as rested;
its card differs from its neighbours by one word ("Tomorrow" instead of "Play")
in 11 px muted type. The design intent — "not a lock and never drawn as one" —
is honoured, but the fact is now invisible. See `dark/packs-full-390.png`.

---

## 2. Progress (`/progress`)

Files: `src/shell/surfaces.ts:275-298`, `src/world/Screen.tsx`,
`src/shell/Surface.tsx:168-174`.

**2.1 A grey slab under the drawing.** `src/world/Screen.tsx:71-77` draws the
"sill" as a rect of height 1 in a small viewBox that is then scaled to the
container width, so it renders as a ~10 px bar in `--dw-line-strong` —
`stone-600` `#5b5175` in dark. Against a violet field it reads as flat grey and
looks like an unstyled element, not a sill. Plainly visible in
`dark/progress-390.png`.

**2.2 The screen is 45% used at 390 and 25% used at 1440.** Two numbers and one
`max-w-sm` drawing (`src/shell/Surface.tsx:171`). At 1440 the drawing is 384 px
wide in a 1440 px viewport. This is the destination a child visits to feel
something about their own work, and it is the emptiest screen in the app.

**2.3 The two numbers are for a parent, not a child.** "Answered 1284 / Correct
1102" (`src/shell/surfaces.ts:292-293`) — no rate, no streak, no sense of
having built anything, and the number that matters (1102/1284 = 86%) is left for
the reader to compute. Against the anti-goal ("a public school teacher crashing
out telling everyone to work on their worksheet") this is the screen closest to
the failure mode.

**2.4 The second rosette reads as broken.** Half the apertures are ghost
outlines at `--dw-line-strong` 0.3 (`src/world/Screen.tsx:23`), which at this
scale looks like a rendering fault rather than "not yet cut".

---

## 3. Profiles (`/profiles`)

Files: `src/shell/Surface.tsx:123-158`, `src/shell/surfaces.ts:308-340`.

**3.1 "Remove" deletes a child's entire record with one tap, no confirmation.**
`src/shell/Surface.tsx:147-155` calls `remove` directly. Two rows away, in
Parents, "Erase everything" is a deliberate two-press armed control
(`src/shell/surfaces.ts:409-417`). The less-destructive action is guarded and
the per-child one is not. It is also the smallest, reddest thing on the row and
sits 12 px from "Use".

**3.2 The name field does not look editable, and its underline is ragged.**
`src/shell/Surface.tsx:136` — `border-b` only, `bg-transparent`, and the input
is `flex-1`, so its width depends on which siblings are present. In
`light/profiles-390.png` the current learner's underline runs from x≈38 to 294
and the other two from x≈16 to 231: three different lengths, two different left
edges. Nothing signals "you may type here".

**3.3 The current learner's row is indented.** See 0.3 — `dark`/`light`
`profiles-390.png` both show it.

**3.4 The screen is 22% used at 390, 10% at 1440.** Three rows and a button.

---

## 4. Settings (`/settings`)

Files: `src/shell/Surface.tsx:63-95`, `src/shell/surfaces.ts:342-394`.

**4.1 Every control on the screen is inverted.** See 0.2. Six of them.

**4.2 The rhythm of a choice row does not match the rhythm of a fact row.**
`Fact` is `min-h-16 items-center py-3` — label and value on one optically centred
line (`src/shell/Surface.tsx:46`). `Choice` is `min-h-16 py-3` with a legend at
`mb-2` and then the control (`:70-72`), which makes the row ~120 px with 8 px
between the legend and the control and 12 px between the control and the rule
below it. In `light/settings-1440.png` the rule for the next row sits 6 px under
the previous control while the label sits 24 px above its own. Two spacing
systems, alternating down the screen.

**4.3 Segment width is huge and the label is tiny.** At 1440 each segment is
224 px wide holding a 14 px word (`light/settings-1440.png`). At 390 the
three-way controls are fine; the two-way ones give 175 px to the word "On".
Nothing caps the control's width — `src/shell/Surface.tsx:72` is a plain flex row
at the full 42 rem measure.

**4.4 "Reduce motion" is phrased as a setting whose On means less.** The row
reads "Reduce motion / Off | On" (`src/shell/surfaces.ts:357-359`), so the state
a parent wants is double-negative. Every other switch on the screen is a
positive.

**4.5 At 1024 × 768 the last row is below the fold.** See 0.9.

---

## 5. Parents (`/parents`)

Files: `src/shell/surfaces.ts:396-470`, `src/shell/Surface.tsx:97-112`.

**5.1 "Erase everything" fails AA in light theme (4.45:1).** See 0.6.

**5.2 The destructive control has no frame, no confirmation affordance, and is
indented.** `src/shell/Surface.tsx:99-110` draws it as a borderless full-width
text button. In `light/parents-1440.png` it is a red serif phrase floating in
white space, 44 px right of every label above it, with nothing to say it is the
most consequential control in the app. Arming it replaces the label in place —
correct, and worth keeping — but nothing before the first press signals weight.

**5.3 Developer mode rows overflow into two-line label / two-line value.**
`dark/parents-dev-390.png`: "core:app:allow-version" wraps to two lines on the
left while "@tauri-apps/api/app.getVersion" wraps to two on the right, producing
a 120 px row with a ragged gutter. It no longer breaks the page (fixed, and
verified), but it is the ugliest block in the app and it is what a developer
looks at most.

**5.4 The screen is 42% used at 390, 20% at 1440.**

---

## 6. The pass sheet and the parental gate

Files: `src/pass/PassSheet.tsx`. Captured through `tools/harness/`, because the
sheet **cannot currently be reached in the shipped app at all**: `Stage` only
mounts it when `usePass.mayOpen()` is false (`src/packs/Stage.tsx:100`), which
routes through `canOpen` (`src/pass/model.ts:206`) and returns `true`
unconditionally while `billing().wired` is false — and nothing in `src/` ever
calls `setBilling`. This is deliberate for today, but it means three screens are
shipping unlooked-at. That is what the harness is for.

**6.1 The dialog does not read as a raised sheet in dark theme.**
`src/pass/PassSheet.tsx:51` overlays `bg-ground-deep/85`, and `:56` gives the
panel `bg-ground`. In dark those are `basalt-950` `#060310` and `basalt-800`
`#0b0618` — 1.13:1. The only thing separating the panel from the backdrop is a
1 px `border-line-strong`. See `dark/pass-rest-390.png`, where the panel edge is
nearly invisible and the sheet reads as text floating on black.

**6.2 The two cheaper plates do not read as buttons.**
`src/pass/PassSheet.tsx:227` gives the non-headline plates `border-line-cut`,
which in dark is `basalt-950` (`src/design/tokens.css:362`) — darker than the
panel they sit on, so the border is invisible. In `dark/pass-offer-390.png`
"One month" and "Day pass" are unbounded text with a price beside them; only the
gold-framed lifetime plate looks pressable. On the one screen where a parent
spends money, two of the three options do not look like options.

**6.3 Three type families collide in one row.** The plate name is
`--font-inscription` (Iowan Old Style), the note is `--font-text` (system UI),
and the price is `--font-numeral` (`ui-rounded` / SF Pro Rounded,
`src/design/tokens.css:39`). "$79.99" in a rounded grotesque beside "Lifetime"
in an old-style serif looks like two different products
(`src/pass/PassSheet.tsx:241-247`).

**6.4 Nothing aligns vertically in a plate.** `src/pass/PassSheet.tsx:221` —
`items-center` on a row whose left side is two lines and whose right side is one,
so the price floats between the name and the note rather than sharing a baseline
with either.

**6.5 Two underlined text links.** "Grown-ups" (`:109`) and "Restore a pass"
(`:349`) are `underline underline-offset-4`. An underlined inline link is a web
idiom; native sheets use a tinted control. On the child-facing stage,
"Grown-ups" being the only underlined thing on screen also makes it more
conspicuous than intended.

**6.6 A focus ring appears on the child-facing screen — verify on device.**
`src/pass/PassSheet.tsx:82` calls `leave.current?.focus()` on mount, and
`src/index.css:92` draws a 2 px `--dw-focus` outline on `:focus-visible`. In
`dark/pass-rest-390.png` the "Choose another game" button is captured **with the
ring already on**, because Chrome matches `:focus-visible` for programmatic
focus when there has been no prior user interaction. On a tablet where the sheet
opens after a touch the heuristic should suppress it, but "a focus ring that
appears on touch" is a named defect and this is the one place in the app that
moves focus programmatically. Needs a WKWebView check; the safe form is to focus
the dialog container rather than the button.

**6.7 The child-facing stage is the least joyful screen in the app.** A dark
rectangle, two serif sentences and a bordered word. `dark/pass-rest-390.png`.
It is honest copy and correct policy — no timer, no price, no loss framing — but
nothing about it makes a seven-year-old want to press "Choose another game".

**6.8 The gate's answer field is 16 px+ and typed in caps.** Correct, and worth
recording as verified: `src/pass/PassSheet.tsx:174` is `min-h-16 text-2xl`, no
iOS zoom-on-focus risk, `autoCapitalize="characters"` matches the challenge.

---

## 7. Navigation and lintel (every screen)

**7.1 The active tab is carried by a 8 × 8 px diamond and a small ink shift.**
`src/app/Nav.tsx:48-50`. At 1440 that is an 8 px mark above a 12 px word in a
288 px cell (`light/parents-1440.png`). Target size is fine (`min-h-14`, 56 px);
legibility of the *current* state is not.

**7.2 The tab labels are 12 px serif with `tracking-wide`.**
`src/app/Nav.tsx:51`. Small for a child, and the serif at 12 px is where this
typeface is weakest.

**7.3 The nav has no elevation relationship to the content it scrolls over.**
`src/app/Nav.tsx:28` is `sticky bottom-0` with `bg-ground-raised` and the
strapwork band above it. While the catalogue scrolls under it, card art passes
behind an opaque bar with a gold ribbon on top and no shadow, blur or scrim —
see the clipped CLAIM/COLOSSUS cards in `dark/packs-390.png`.

---

## Measured summary

| check | result |
|---|---|
| horizontal page overflow | 0 px on all 100 captures ✓ |
| boxes that scroll sideways | 1 — the subject-chip row, 440 px at 390 px wide |
| painted scrollbar tracks | `body` on all screens, chip row on `packs` at 390/430 |
| interactive targets < 44 px | 2 distinct — wordmark link 220.3 × 43.2, "All" chip 42.1 × 44 |
| text/ground pairs measured | 22 distinct |
| AA failures | 2, both `--dw-strike` on light ground, both 4.45:1 (need 4.5) |
| capture failures | 0 |

## The three to fix first

1. **§0.1** — the gold strapwork, twice per screen, ~120 warm points against a
   rule of one. It is the first thing seen on every screen and the brand rule it
   breaks is explicit.
2. **§0.2** — every segmented control in the app draws the selected option as a
   recess and the unselected ones as raised keys. Six on Settings, two on
   Parents, the chip row on Packs.
3. **§0.8** — desktop and large tablet: full-bleed lintel, 1152 px surface,
   672 px courses and a full-bleed five-cell tab bar, with 80% of a 1440 × 900
   screen empty.
