# The pass sheet and the parental gate

What changed, why, and what was measured on a rendered screen rather than read
off the source.

Files touched — and only these three:

| file | what |
|---|---|
| `src/pass/PassSheet.tsx` | rebuilt: one panel, three stages, real elevation, real focus behaviour |
| `src/pass/parentalGate.ts` | new `reissue()`; the year form demoted from a coin flip to one draw in five |
| `src/pass/parentalGateReissue.test.ts` | **new**, 5 tests, holds the two properties above |

Nothing outside `src/pass/` was edited. The two shared stylesheets were read and
obeyed, never changed.

---

## 1. The sheet was not a sheet

`AUDIT.md` §6.1: the panel was `bg-ground` on a `bg-ground-deep/85` backdrop,
which in dark measured **1.13:1** — the only thing separating a modal from the
screen behind it was a one-pixel border.

It is now the elevation ladder from `index.css`, unmodified: `.dw-scrim` behind,
`.dw-overlay` for the panel. In dark that puts the sheet on `basalt-500` over
`basalt-950` — **12.7× the luminance of its own backdrop** (0.0179 vs 0.00141),
plus the overlay's cast shadow and its lit top edge. (The WCAG *ratio* for two
near-black surfaces is a useless number — 1.31 — because the +0.05 flare term
dominates at that end; the luminance multiple is the honest measure, and the
captures are the proof.) In light the panel is white on a violet-black scrim with
a two-layer violet cast shadow.

**One panel, mounted once.** The three stages used to each render their own
`Panel`, so moving from rest → gate → offer tore the modal down and built a new
one: the entrance replayed, `aria-labelledby` pointed at a heading that had just
been unmounted, and focus was taken three times. The panel is now hoisted into
`PassSheet` and the stages swap inside it, keyed so each one fades in.

## 2. The warm point, and the mark

The brand rule is one warm point per screen, at the top of something. The sheet
had it in the wrong place — a small gold diamond buried inside a button — and the
rest stage was, in the audit's words, *the least joyful screen in the app*: a dark
rectangle, two serif sentences and a bordered word.

The Dynawalla mark is now at the head of every stage, 36 px, in `--dw-index`.
It is the sheet's single warm point and its only ornament.

| | ratio | floor |
|---|---|---|
| gold mark on the sheet, light (`brass-800` on white) | **6.28:1** | 3.0 (graphic) |
| gold mark on the sheet, dark (`brass-300` on `basalt-500`) | **12.80:1** | 3.0 |

The lifetime plate's frame moved off gold and onto `--dw-accent`, so there is
exactly one warm thing on the offer stage rather than two: **7.10:1** light,
**4.12:1** dark, both against the plate they bound, both clearing the 3.0 floor
for a graphic.

## 3. Three type families in one row → one

§6.3. A plate set the name in Iowan Old Style, the note in system sans and the
price in SF Pro Rounded — three faces in one row, which reads as three products.
Everything in a plate is now the text face; the price asks only for
`tabular-nums`, so a column of prices lines up. The serif is now reserved for the
three headings, which is what a display face is for.

§6.4: name and price now share a baseline and the note sits under both. The price
used to float in the vertical middle of a two-line row, level with neither.

## 4. Two of the three prices did not look like buttons

§6.2. `border-line-cut` in dark is `basalt-950` — darker than the panel, so the
month and day plates were unbounded text with a number beside them. The only
option that looked like an option was the one a parent spends eighty dollars on.

All three are now `.dw-raised` faces **inside a `.dw-sunk` track** — the
construction the foundation prescribes for a group of choices, a recess with
raised faces in it. This is load-bearing in dark, where `.dw-raised`
(`basalt-600`) is a step *darker* than `.dw-overlay` (`basalt-500`): a plate
drawn straight onto the sheet reads as a slot cut into it. Against the track
(`basalt-950`) it reads as a key standing on it, which is what it is.

## 5. Nothing appears without moving something else

Two places where state changed and text jumped:

* **the gate's "That's not it"** — an error line that appeared *between* the
  field and Continue, pushing the button down the screen under a finger already
  reaching for it;
* **the offer's store-unavailable line** — same shape of problem, above the way
  out.

Both are now permanent elements with a reserved height, empty until they have
something to say, and both are live regions so a screen reader is told.

The third jump was subtler and is why `parentalGate.ts` changed. A miss called
`makeChallenge()` again, which switched *form* half the time — and the two forms
are not the same height, because a word challenge renders a line of display type
above the field and a year challenge does not. `reissue()` keeps the form and
changes the challenge: a missed word is replaced by one of the other seventeen,
never by itself. Measured, on the rendered gate:

```
a wrong answer moves nothing on the gate
  before {"go":488,"field":388,"kind":"year"}
  after  {"go":488,"field":388,"kind":"year","said":"That's not it. Try again.","invalid":"true"}
```

## 6. Focus

§6.6 flagged that the rest stage was captured **with a focus ring already drawn**
on "Choose another game", because Chrome matches `:focus-visible` for
programmatic focus when there has been no prior interaction. "A focus ring that
appears on touch" is a named defect and this was the one place in the app that
moved focus programmatically.

Focus now goes to the dialog *container* (`tabindex="-1"`, `outline-none`), Tab
is trapped in both directions, and whatever held focus before the sheet opened
gets it back when it closes. Measured on a real render at 390 × 844:

```
PASS  focus lands on the dialog container, not a control  — {"activeIs":"dialog","ringOnActive":"none","leaveMatchesFocusVisible":false}
PASS  no focus ring is drawn on the child-facing stage
PASS  Tab is trapped inside the sheet, both directions    — {"wrapsForward":true,"wrapsBackward":true,"stops":2}
PASS  the trap still holds after the stage changes        — {"stops":3,"wrapped":true}
PASS  focus is returned to what held it when the sheet closes — {"heldBefore":"outside","afterClose":"outside"}
```

## 7. Native tells closed

* **No underlined links.** §6.5 — "Grown-ups" and "Restore a pass" were
  `underline underline-offset-4`. An underlined inline phrase is a web idiom, and
  on the child-facing stage it made "Grown-ups" the most conspicuous thing on
  screen. Both are now plain tinted controls at the platform's 44 px floor.
* **No accidental dismissal.** There is deliberately no tap-outside-to-close. A
  scrim that closes on a stray palm is how a child dismisses the one screen an
  adult was reading; every stage has a labelled way out and Escape works from all
  three.
* **No bounce on a fixed surface.** The panel carries `overscroll-contain`, so a
  drag inside a sheet that does not overflow neither rubber-bands nor chains to
  the document behind it.
* **Safe areas.** The scrim's four paddings are `max(--dw-frame-pad, --safe-*)`
  per side, which a symmetric padding cannot do for a phone held in landscape,
  where the inset is on exactly one edge.
* **The right keyboard.** The year challenge sets `inputMode="numeric"` and turns
  capitalisation off; the word challenge asks for letters in capitals. The field
  is 64 px and 24 px, so iOS never zooms the viewport on focus.
* **`className` everywhere; not one `style` prop.** CSP is `style-src 'self'`.

## 8. Motion

One entrance, one exit curve, both from the tokens — `.dw-anim-fade` on the
scrim, `.dw-anim-enter` on the panel (260 ms, emphasised decelerate), `.dw-press`
on every control (90 ms decelerate, 0.97 scale). Nothing decorative: the sheet
rises a little so it is obvious it came from below, and each stage fades so it is
obvious the *content* changed and the surface did not.

Measured, with `prefers-reduced-motion` emulated both ways:

```
PASS  the sheet has an entrance, on the enter curve
        {"panel":"0.26s cubic-bezier(0.05, 0.7, 0.1, 1)","scrim":"0.26s","lift":".5rem","press":".97"}
PASS  reduced motion collapses the entrance
        {"panel":"0.001s","scrim":"0.001s","lift":"0px","press":"1"}
```

The lift and the press scale collapse too — a 0 ms transition into a displaced
position is still a jump.

## 9. The parental gate, verified

The requirement is that it is **not arithmetic** — this is a maths app, and
Apple's canonical multiplication gate is one this audience is trained daily to
defeat. Verified rather than assumed, against the real generator:

```
 1 year  | Type the current year, all four digits.   | answer: 2026
 4 word  | Type this word:  CORRESPONDENCE           | answer: CORRESPONDENCE
 6 word  | Type this word:  REPRESENTATIVE           | answer: REPRESENTATIVE
 9 word  | Type this word:  TRANSPORTATION           | answer: TRANSPORTATION
16 word  | Type this word:  CIRCUMSTANTIAL           | answer: CIRCUMSTANTIAL
19 word  | Type this word:  ACCOMMODATION            | answer: ACCOMMODATION

arithmetic present in any of 2000 challenges: false
reissue after a miss (TRANSPORTATION) -> UNPRECEDENTED, RECONSTRUCTED, CIRCUMSTANTIAL
lower case accepted: true
```

**One change of substance.** The two forms were drawn evenly, and they are not
equally hard. The word form is the real barrier — fourteen letters of a word a
primary-school child has no reason to have typed, transcribed without losing the
place: minutes for a seven-year-old, four seconds for an adult. The year form is
instant for an adult and *also* instant for a nine-year-old, who writes the date
at the top of a page every day. At an even split, half of a child's attempts
landed on the one form they can beat.

`YEAR_SHARE` is now `0.2`. Both forms stay reachable — a single form is a single
thing to memorise — but the word is what a child meets four times in five.

## 10. Measured, on 24 captures of these three screens

`tools/capture.mjs --only=pass-rest,pass-gate,pass-offer` at 390 / 834 / 1024 /
1440, both themes:

| check | result |
|---|---|
| horizontal page overflow | **0 px**, all 24 |
| boxes that scroll sideways | **0** |
| interactive targets under 44 px | **0** |
| elements escaping the viewport | **0** |
| AA failures | **0** |
| worst text pair | **5.70:1** — `on-accent` on `accent-fill`, dark, 20 px |

Text pairs, measured on the rendered screen against the ground each run actually
sits on:

| pair | light | dark |
|---|---|---|
| heading / sheet | 18.01 | 13.87 |
| body, notes / sheet | 7.30 | 7.20 |
| plate name, price / plate | 18.01 | 15.26 |
| "Restore a pass" (`accent-ink`) / sheet | 8.98 | 8.47 |
| primary button label (`on-accent` / `accent-fill`) | 7.10 | **5.70** |
| plate note / plate | 7.30 | 7.91 |

### Stressed deliberately

* **A long price string.** `Rp 1.299.000,00` in all three plates, 390 and 834,
  both themes: the price wraps onto its own line under the name in the headline
  plate, stays inline in the smaller two, and the page overflow stays at 0. Two
  shrinkable children and `flex-wrap` — the fix that outlives the naive one,
  because a flex item's default `min-width: auto` refuses to shrink below its
  content no matter what `shrink` says.
* **A fourteen-letter challenge.** `TRANSPORTATION`, `PROFESSIONALLY`,
  `INFRASTRUCTURE` all render on one line at 390 with no mid-word break.
* **The wrong-answer state.** Rose frame on the field, rose line in the reserved
  slot, `aria-invalid="true"`, and nothing above or below it moves.

---

## Left undone, deliberately

* **`.dw-press:hover` is a no-op on a plate.** The hover colour in `index.css` is
  `--dw-ground-lifted`, which is the same value `.dw-raised` already paints, so a
  desktop mouse gets no hover lift on the three plates. Fixing it belongs in
  `index.css` — a hover rung, or hover scoped to the rung below the element's own
  — and that file is not mine to change. Touch and keyboard are unaffected; the
  press scale fires everywhere.
* **The dark ladder has no rung above `overlay`.** Anything pressable *on* a
  sheet is drawn darker than the sheet. The sunk track works around it correctly
  for a group of choices, but a single raised control on an overlay has nowhere
  to go. Worth one more token (`--dw-ground-crest`, or an `.dw-overlay-raised`)
  next time the foundation is opened.
* **The sheet is a centred form sheet at every width**, not a bottom sheet on
  phone. A bottom sheet wants a grabber, and a grabber that does not drag is a
  lie; a modal that must not be dismissed by accident is a form sheet on every
  platform that has both.
* **Not seen on device.** Everything here is headless Chrome at true viewport
  sizes over CDP. `overscroll-contain`, the `inputMode` keyboards and the
  `:focus-visible` heuristic are the three that behave differently in WKWebView
  and want a look on the iPad.

## Reproducing any of it

```sh
cd dynawalla/dynawalla-app
node tools/capture.mjs --only=pass-rest,pass-gate,pass-offer --widths=390,834,1024,1440
```

The behaviour probe (focus, trap, return, motion collapse, the no-jump proof) is
not committed — it is thirty lines of CDP against `tools/.harness-dist` and it is
quoted verbatim above. The two properties worth keeping are in
`src/pass/parentalGateReissue.test.ts`, which runs in `npm test`.
