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

## Noted, not yet acted on

- **"Erase everything" is coral** (`--dw-strike`, from the copper ramp) against a
  violet ground. Semantically a destructive action should read as danger, but the
  hue is the one leftover from the pre-purple palette and sits oddly. Worth a
  deliberate decision rather than a drive-by change.
- **The strapwork bands** at the top and bottom of the chrome carry the gold
  index colour across the full width. The brand rule in
  [`../brand/README.md`](../brand/README.md) is *one warm point per screen*;
  a repeating full-width band is arguably two.
