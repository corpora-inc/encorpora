# Dynawalla — harness feedback

Founder feedback on the **host app** — the shell, the chrome, the navigation,
the parent area. Not the games; those have their own review loop.

The point of this file is that feedback given once should not need giving twice.
Each item records what was said, what was actually wrong underneath it, and
whether it is done. An item is only ticked when it was verified on a rendered
screen, not when the code looked right.

## The standing bar

> "we need premium native-like behavior"

That is the test every item here is measured against: nothing may read as a web
page in a wrapper. The tells are specific and worth naming, because they are
what gets noticed without being articulated — a drawn scrollbar track, a
selection handle raised by a long press, a page that slides sideways, a tap
highlight, a bounce at the wrong edge.

## Open

_(nothing currently open)_

## Done

### Wordmark and mark were not a lockup — 2026-07-29

> "I think the Dynawalla word should be better laid out next to the logo - like
> maybe even with the bottom and let the logo be taller."

A 28px emblem was vertically centred against 18px uppercase, which made it read
as a bullet beside the word rather than as a mark.

Fixed: the mark is 40px, so the spire rises above cap height, and the two are
aligned at the letters' feet. `items-end` alone is not enough — a text box
extends below its baseline by the font's descender space even for all-caps with
no descenders, so the emblem hangs low. The mark's `margin-bottom: 0.16em` takes
up exactly that slack; the value was rendered at 0 / 0.10 / 0.16 / 0.22em and
compared rather than guessed. `items-baseline` cannot do this job because an SVG
has no baseline of its own.

### The parent area scrolled sideways — 2026-07-29

> "parent tab has some horizontal scroll ish behavior. the text goes off the
> side."

`Fact`'s value carried `shrink-0`. For "35 kB" or "Native (Tauri)" that looked
free; developer mode then printed `@tauri-apps/api/app.getVersion`, and a flex
child that will neither shrink nor wrap pushes its parent wider than the screen
— taking the header with it.

Fixed: the value shrinks and wraps. **Both** children also carry `min-w-0`,
because a flex item's default `min-width: auto` refuses to shrink below its
content no matter what `shrink` says — that is the version of this bug that
survives a naive fix. `overflow-x: hidden` on `html, body` is the backstop: wide
content scrolls in its own box, the page never does.

### A drawn scrollbar in the app — 2026-07-29

> "I dont want to see scrollbar in mobile, do I?"

No. Touch platforms draw their own transient indicator during the gesture, so a
persistent track is noise and one of the loudest web-view tells.

Fixed under `@media (pointer: coarse)` only — a mouse user genuinely needs a
scrollbar, so this is scoped to touch rather than applied everywhere.

### Long-press raised a selection handle — 2026-07-29

Not reported, found while fixing the above, and the same class of tell: a child
pressing hard on a card got a text-selection handle over the label. `user-select:
none` on `body`, with `input`, `textarea` and `[contenteditable]` opting back in
so a parent can still edit a name they typed.

### "Erase everything" was coral — 2026-07-29

Was: `--dw-strike` came off the copper ramp, a leftover from the pre-purple
palette, and a bare coral phrase floated in white space with nothing around it
to say it was the most consequential control in the app.

Fixed, and the decision was taken rather than drifted into. The strike ramp is
now **rose**, and its hue is the arc's own rose end (`--color-arc-11`, hue 348°)
— danger drawn in a colour the app already contains rather than a fifth family.
It is three tokens, not one: `--dw-strike` (the word), `--dw-strike-line` (the
frame it is bounded by) and `--dw-strike-ground` (the wash it fills with once
armed), so the control is a bounded plate that visibly changes state before the
press that actually erases. Light measures 6.39:1, up from copper's 4.45:1.

The plate's resting border is `--dw-line-strong`, not `--dw-line`: at
`--dw-line` it was the same rgb as the hairline between two ordinary rows, so
"bounded" was true in dark and not in light.

The same hue reached Profiles' three "Remove" buttons and put three crimson
words down one screen. It should not have: at rest that control is now the muted
ink and only becomes rose when it is armed and a second press would really
remove a child. Danger is a state, not a decoration.

### The strapwork band was gold, and there were two of them — 2026-07-29

Was: the interlace band paints one knot every 24 px in `--dw-index`, and it ran
under the lintel AND above the tab bar. A 1440 px screen carried about a hundred
and twenty gold knots against a brand rule of ONE warm point per screen, and in
light `--dw-index` resolved to `brass-700`, a red-brown that read as exactly the
"dusty khaki sandstorm" the brand explicitly kills.

Fixed in two steps:

1. **The band is cool.** `--dw-band-strap` / `--dw-band-knot` are the app's own
   violet, read directly by `Strapwork.tsx`. The warm point moved to the one
   place a gold mark earns its keep — the navigation index that says which
   destination you are on. Light `--dw-index` is now `brass-800` (hue 42°,
   struck gold, 5.61:1), not `brass-700` (hue 30°, terracotta).
2. **There is one band, not two.** Cool or not, a repeating interlace at both
   edges of every screen framed the whole app in ornament, at the two places the
   eye returns to most. The band is the brand's al-Andalus reference and it is
   worth having once, as the carved course under the wordmark. At the bottom of
   the screen the bar's own material and its upward cast are the edge — which is
   quieter, and is what a tab bar looks like.

### The tab bar cut its own labels — 2026-07-29

Not reported; found by measuring the shipped app at the text sizes it ships. At
390 px on the app's own **Largest** setting, four of the five destination names
clipped to "Prog…", "Profi…", "Setti…", "Pare…"; at 320 px it happened at the
DEFAULT size. That is WCAG 1.4.4 failing at 125%, not at 200%.

Two causes, both fixed. The anchors carried a horizontal margin, so they did not
tile the bar — 8 px of dead gutter between every pair of tabs, 20 px dead at each
end, and 8 px stolen from the word. And a fifth of a 320 px screen is 60 px,
which no fix to padding alone reaches.

So each tab cell is now a container and the label's size is capped against the
cell's own inline size (`min(step, 21cqi)`), which is what a native tab bar does:
the label shrinks to fit and is never cut. At every ordinary width the cap is
inert. Verified at 320 / 390 / 430 / 834 / 1024 / 1440 × normal and Largest:
zero clipped labels.

### Everything on a screen started at a different x — 2026-07-29

At 1440 the wordmark began at 160, the catalogue cards at 160, the rows on the
other four screens at 384 and the tab labels at 388 — and Parents used about a
fifth of the glass. Four origins on one app.

The rule is now one sentence: **the chrome is always the frame, and the only
thing ever narrower than the frame is a column of prose.** The tab bar sits in
`dw-frame`; a course of rows is a list, not prose, so it takes the frame too;
above 64 rem the courses lay out in two columns inside it. Measured at every
width, on every destination, the wordmark, the first row, the first card and the
first tab all begin at the same x.

## Noted, not yet acted on

- **Progress says how many, never how well.** "Answered 1284 / Correct 1102" is
  two counts with no rate, no streak and no sense of a day. The drawing beside
  them was re-inked this pass (it was a white card with two solid black rosettes
  in a violet brand) but the numbers are unchanged. Adding a rate is new copy and
  a small model change, not a design fix, so it is left for a deliberate call.
- **The pass sheet cannot be reached in the shipped app.** `pass/model.ts` opens
  unconditionally while `billing().wired` is false and nothing calls
  `setBilling`, so there is no sequence of taps on a device that puts the sheet
  on screen. It is verified only in `tools/harness/`. Wiring billing is not a
  design change.
