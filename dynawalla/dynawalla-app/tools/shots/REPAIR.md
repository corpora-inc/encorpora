# REPAIR — what the verifiers found, and what was done about it

Four independent verifiers reviewed the design pass and returned 47 findings.
This file records every one: fixed, refuted, or consciously left. Nothing was
silently skipped.

Everything below was **measured after the change**, not read. The evidence is
`tools/shots/measurements.json` (now 240 screens: 6 widths × 2 themes × 10
screens, at both the shipped text size and the app's own Largest) and the PNGs
beside it. Final state of the whole sweep:

```
screens recorded 240   problems 0
horizontal scroll 0    targets under 44 px 0    AA failures 0
lowest measured text ratio 5.70:1  (dark/pass-rest-390, white on rgb(124 58 237))
tab labels clipped 0   at every width × normal AND Largest
```

The base was **rebased first** (finding P11): the branch was 17 commits behind
and every earlier gate ran against a stale tree. `git merge --ff-only origin/main`
took it to `4a3715d6e`; the suite went 226 → 243 tests, all passing, before a
single edit.

---

## Fixed

### The front door

**[gates P1] The chip rail's leading dissolve was on at rest and faded out the
selected chip.** Two causes, both fixed at the cause. `.dw-rail` now carries
`scroll-padding-inline: var(--dw-space-1)`, so proximity snapping rests the rail
at `scrollLeft: 0` instead of at the 4 px gutter; and `useRailEdges` compares
`scrollLeft` against the first chip's own `offsetLeft` rather than against zero,
so the fade is right even where snapping is not. Measured at every width: `lead`
is `off` at rest, `scrollLeft` 0.

**[look WORST 2, gates P12b] At 834 the rail overflowed by exactly 18 px** — a
row that looked scrollable, travelled less than a fingertip, and put the
dissolve on the last *word* of the last chip. Above 40 rem the rail is no longer
a rail: the chips wrap. Measured at 834 / 1024 / 1440, `scrollWidth -
clientWidth` is 0 and both dissolves are off. Below 40 rem it still scrolls,
because a phone has no room for a second line.

**[gates P4] The search field's ✕ was labelled "All" and silently dropped the
subject filter.** It now clears the field and only the field, under a string
that says so (`catalog.clear`, "Clear the search"). The empty state's way out
still clears both and now says `catalog.showAll`, "Show every game" — a control
whose label describes what the control does.

**[csp P1] `min-block-size: 2.6em` was stripped by the minifier**, so the `2lh`
reserve shipped with no fallback on exactly the iOS 16.0–16.3 devices it was
written for. The `lh` version moved into `@supports (min-block-size: 1lh)`,
which is uncollapsible. Verified against `dist/`: `2.6em` present, `@supports
(min-block-size:1lh){.dw-card-title,.dw-card-blurb{min-block-size:2lh}}` present.

**[csp P2, a11y P2] `.dw-find:focus-within` drew a focus ring on touch.** Now
`:has(:focus-visible)`. The input's own outline suppression moved inside
`@supports selector(:has(*))`, so an engine without `:has()` keeps the
platform's ring rather than being left with none. Built CSS: `focus-within` 0
occurrences, `has(:focus-visible)` 1.

### The chrome

**[a11y P1, look WORST 1] The tab bar cut its own labels.** At 390 on the app's
own Largest setting four of five clipped; at 320 it happened at the default
size. Two fixes: the anchors lost their horizontal margin, so they tile the bar
(measured at 390, five cells of 71.6 px at a pitch of 71.6 — no dead gutter, no
dead ends), and each cell is now a container with the label capped at
`min(step, 21cqi)`. Native behaviour: the label shrinks to fit and is never cut.
**Zero clipped labels across 6 widths × 3 text-size states.** The cap lives in
`@supports (container-type: inline-size)` rather than as a second `font-size` —
the minifier is entitled to collapse two declarations of one property, which is
the P1 lesson applied before it bites.

**[gates P3, csp P5, look WORST 4] Three x-origins became two, not one.** Now
one. The rule is statable in a sentence: *the chrome is always the frame, and
the only thing ever narrower than the frame is a column of prose.* The tab bar
moved onto `dw-frame`; a course of rows is a list rather than prose, so it takes
the frame too. Measured, every destination, every width:

| width | wordmark | first row / card | first tab |
|---|---|---|---|
| 320 | 12 | 12 | 12 |
| 390 | 16 | 16 | 16 |
| 834 | 20 | 20 | 20 |
| 1024 | 24 | 24 | 24 |
| 1440 | 168 | 168 | 168 |

**[look WORST 4] Parents used ~20 % of a 1440 × 900 screen.** Above 64 rem the
courses lay out in two columns inside the frame. A course whose only row is an
action ("Add a learner") spans both columns instead of sitting beside the list
it belongs to — without that it was laid level with the first learner and read
as a second list with one thing in it.

**[gates P6] The strapwork band was drawn twice on every screen.** Now once,
under the lintel. The colour half was already fixed (violet knots, not brass);
the count half was not, and ~96 maximum-contrast points at the two edges the eye
returns to most is not "elegant and minimal". The tab bar's own material and its
upward cast are its edge — quieter, and what a bar looks like.

**[look 38] `dw-bar` cast up in one theme only.** A cast shadow cannot separate
anything from a near-black ground (measured: it moved the pixels above the bar
by one unit). The dark bar's lit top edge went from `sheen-soft` to `sheen-mid`,
so the separation is deliberate rather than accidental.

**[csp P3] Tailwind's `color-mix` fallbacks are fully opaque.** The active tab's
1.22:1 seat would have painted as a solid violet plate under dark ink below
Safari 16.2, against a declared floor of 16.0. It is now a token,
`--dw-accent-seat`, backed by two new wash materials written as rgb-alpha. Built
CSS: `bg-accent-seat{background-color:var(--dw-accent-seat)}`, no `color-mix` in
any live rule.

**[csp P4] `.dw-rail::-webkit-scrollbar` used logical sizes** on a non-standard
pseudo-element, so it lost to `*::-webkit-scrollbar{width:10px}` and a desktop
build would have painted a channel under the chip rail. Now `width`/`height`,
agreeing with its sibling.

**[a11y P6] No scroll padding under sticky chrome.** `scroll-padding-block:
calc(safe-top + 5.5rem) calc(safe-bottom + 5.5rem)` on `<html>` — the one-line
equivalent of a native `contentInset`. Eight of 27 focused cards used to come to
rest behind the tab bar.

**[csp minor] No body scroll lock while the pass sheet is open.** `html.dw-locked`
is added on mount and removed on unmount; both boxes are told, because
`overflow-x: hidden` on `html` makes `body` the scroller.

### The rows

**[gates P2, look WORST 3] "A choice row is the same 64 px object as a fact row"
was false at every width.** It is true now, and the cause was in `ROW` itself:
`--dw-row-pad` was inert on a one-line row (the 64 px minimum won) and decisive
on a row holding a 44 px control (44 + 8 track + 2 border + 2 × 10 = 74). The
padding left the base rhythm and comes back only on the genuinely two-line
variants. Measured:

```
parents   320/390/430/834/1024/1440 → 64,64,64,64,64  (was 64,64,64,74,64)
settings  834/1024/1440             → 64 × 6          (was 74 × 6 / 70 × 6)
profiles  every width               → 64 × 4
settings  320/390/430               → 104/116/120 ×2 then 64 × 4
```

The last line is deliberate and is not the defect: below `sm` a three-option
control will not fit beside its label without truncating a word, so it takes a
line of its own. That is a real two-line row, and it is now the only kind of row
in the app that is not 64 px.

**[look 33] Tab targets did not tile the bar** — see above; fixed with the same
edit as the label clipping.

**[look 36] An unselected segment's label sat ~10 px right of its optical
centre**, because the index mark was in flow at zero opacity. The mark is now
absolutely positioned in the segment's own padding: the label is centred, and
nothing still moves when the choice changes.

**[look 35] Stacked developer rows did not read as label/value pairs** — the gap
inside a pair equalled the gap across the hairline to the next one. A stacked
pair now uses `--dw-space-1` between its two lines while the row keeps
`--dw-row-pad` around them, so a pair is tighter inside than the gap between
pairs.

**[P12e] Segmented options carried no `.dw-press`.** They do now, against
`index.css`'s own "one press behaviour for everything a finger lands on".

**Controls no longer grow without limit.** Half the course is right on a phone
and absurd on a tablet — at 1024 the parent area drew a 480 px On/Off pair.
`TRACK_MAX` caps the track per option count from `sm` up.

### Colour and brand

**[look 31, P12g] Three crimson "Remove" words on one Profiles screen.** At rest
the control is the muted ink; it turns rose when it is *armed*, which is when a
second press would really remove a child. Danger is a state, not a decoration.

**[look 32] The two destructive controls armed with different grammars.**
"Remove" now becomes "Press again", the same grammar as "Erase everything —
press again". Both labels are stacked in one grid cell with the longer one
always in flow and invisible, so the word changes and the `flex-1` name field
beside it does not move.

**[look 37b] The "Erase everything" plate did not read as bounded in light** —
its border was the same rgb as the hairline between two ordinary rows. Now
`--dw-line-strong`.

**[look WORST 5, look 37a] Progress was the weakest screen in the app.** In
light it was a white card with a 1 px dark border and two *solid black*
rosettes, in a violet brand, sitting on a periwinkle slab that read as a failed
drop shadow. Fixed at three points: the plate is `--dw-ground-sunk` (stone, not
paper); light `--dw-aperture` is `lapis-800` rather than the deepest lapis, so a
hole is violet rather than 19:1 black; and both chrome rects are inset by half
their own stroke, which is what made the plate a device pixel wider than its own
frame. The sill is half a unit of `--dw-line-cut` inside the plate instead of a
full unit of `--dw-line-strong` running past it.

**[P12c, csp P6] The screen gutter was keyed to viewport HEIGHT**, so a 1024 ×
768 iPad landscape got 14 px while a 390 × 844 phone got 16 and a 430 × 932
phone got 20 — a wider screen with a tighter margin, and a 6 px re-gutter of the
whole app on rotation. `--dw-frame-pad` is the one horizontal role in that list
and now has its own width rungs. Measured, monotonic: **12 / 16 / 16 / 20 / 24 /
24** at 320 / 390 / 430 / 834 / 1024 / 1440. The vertical roles stay on the
height rungs, which is what made Settings fit the fold at 1024 and still does.

**[P12a] Scrollbars were painted under `(pointer: fine)`**, so an iPad with a
Magic Keyboard — a first-class target — got a drawn track, the first named tell.
The suppression is now `@media (any-pointer: coarse)` and it comes *after* the
desktop block, so a device with a touchscreen wins whatever else is plugged into
it. Verified with real touch emulation: `any-pointer: coarse` true,
`scrollbar-width: none` on every scroller.

**[look 39] Every destination opened with two parallel horizontals** — the first
course's top rule restating the strapwork band 24 px above it. `.dw-course:first-of-type`
drops it, and in two-column mode the whole top row drops it. Done in CSS with
`:nth-of-type`, because "the top row" is one course at phone width and two at
desktop, and because `:nth-of-type` does not count the screen-reader heading
beside them.

**[P7] The `pattern[id^="dw-strapwork"]` compat block was dead code.** Deleted;
`Strapwork.tsx` reads `--dw-band-*` directly, which its own comment said was the
condition for removing it.

**[P10] Two files stated opposite rules about recolouring the mark.**
`Shell.tsx`'s "no coloured wash of the mark, ever" was a rule about the lockup
being one object in one ink, overstated into a rule about the asset.
`brand/README.md` says only that the mark recolours from `currentColor`, and the
governing rule is one warm point per screen — which is what the pass sheet
spends on it. The comment now says that, and says why it used to say otherwise.

### Accessibility

**[a11y P3] No headings anywhere, and `document.title` was "Dynawalla" on every
route.** Each destination now renders an `<h1>` — the same word the tab is
labelled with, so it costs no new copy — and sets the document title. It is
`sr-only`: the tab bar already says where you are, permanently, and two places
saying it are two places to disagree. Per-group labels are NOT done; see below.

**[a11y P4] Which learner is current was unavailable to a screen reader.** All
three name fields answered to "Name"; each is now named for its own learner. The
current one carries a visually-hidden "Current", so the state is in words and
not only in an `aria-hidden` diamond, an `aria-current` on a role-less `div` and
the *absence* of a button.

**[a11y P5] "Erase everything" had no programmatic armed state** while the
Remove button two screens away did. `aria-pressed` added.

**[look 30] The pass sheet autofocused the gate input**, drawing a 2 px ring on
mount with no user interaction — two concentric rectangles, the exact pattern
this design removed from the search field — and raising the keyboard over the
sheet before an adult had decided to answer. Removed; `Panel` already focuses the
dialog container, which is where a modal's focus belongs and what the write-up
always claimed happened.

### The tools

**[P5] Four 900-line near-identical forks of `capture.mjs` would have been
committed** (`verify-a11y`, `verify-deep`, `verify-elev`, `verify-text` — ~155 kB
of copy-paste), along with four scratch JSON files. Deleted, and the reason they
existed is now a feature: `--probe=file.js` evaluates one expression in every
captured page and writes `shots/probe.json` (gitignored). A question about the
DOM is an expression; the harness around it is one file.

**[a11y PROCESS] `capture.mjs` replaced `measurements.json` instead of merging**,
so an `--only=packs` run erased the ninety numbers behind every per-screen claim
beside it. It merges now, and each entry carries its own `measuredAt`.

**Two blind spots closed.** 320 × 568 — the narrowest screen the app ships to,
and where the tab-bar clipping happened at the DEFAULT text size — was not in
the viewport table at all. And only `textSize: "normal"` was ever seeded, though
the app ships a Largest option; `--textsize=large|largest` now sweeps it, into
its own filenames and measurement keys so the two sit side by side. `--coarse`
also now actually works: it set `setEmitTouchEventsForMouse`, which changes
which events fire and does not move the pointer media queries, so a `--coarse`
run proved nothing about the suppression it exists to check.

**[csp P9] Two test nits in `parentalGateReissue.test.ts`.** The tautological
assertion — `passes()` upper-cases both sides, so lower case could not fail, and
the message claimed the opposite of what the line tested — now asserts what is
true and is joined by a near-miss that can actually fail. The one call taking
the real `Math.random` in a file whose header promises "a test is a test, not a
coin toss" now takes the seeded generator.

**[P8] `docs/HARNESS_FEEDBACK.md` was not updated.** It is now: both
"noted, not yet acted on" items are written up as done, with what was actually
wrong underneath them, and three new entries record the tab-bar clipping, the
band count and the x-origins. Two new items are noted as deliberately not acted
on (below), so the next agent does not re-derive them either.

**[P13] The nvm bin directory must be on `$PATH`, not merely used to address
npm.** Every command in this pass ran with
`export PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"`; `node -v` confirmed
v24.18.0 before `npm ci`.

---

## Refuted by measurement

**[P12d] `.dw-card-subjects` always reserves two chip rows "though the chips fit
one line at ≥ 640 px".** They do not. On `dark/packs-834` ABYSSAL BLOOM draws
"Addition & subtraction" and "Multiplication" on two lines in a 186 px column,
and the same is true at 1024 and 1440 where the column is 235 and 265 px. The
reserve is the maximum, as documented, not dead space.

**[look 34 in part] "Card blurbs are still cut mid-word."** They are clamped to
two lines with an ellipsis, which is what `line-clamp` does and what every game
listing does. Reserving the box fixed the grid rhythm; showing eight lines of
prose per card is a different product. Not changed — see below.

**A row separator that appeared to stop where the control begins.** Pixel-scanned
`light/settings-834` at the row boundary: a continuous `rgb(201 188 236)` line at
every sampled x from 100 to 1600 device px. What reads as a second, shorter line
in a downscaled screenshot is the segmented track's own top border 12 px lower.

---

## Consciously not done

**[gates P9] The pass sheet is unreachable in the shipped app.** True, and
recorded in `HARNESS_FEEDBACK.md`. `pass/model.ts` opens unconditionally while
`billing().wired` is false and nothing calls `setBilling`. Wiring billing is not
a design change and is not this pass's to make; the sheet's drawing is verified
in `tools/harness/`, which is what that harness is for.

**[csp P7] In dark, 36 elements paint in exactly `--dw-index`** because the pack
artwork's `--dw-art-warm` and the navigation's index are both `brass-300`. Real,
and not changed. `tokens.css` declares the art tokens identically in both themes
on purpose — a game's key art is a picture of that game, and inverting it would
be a second drawing, not theming — and the "one warm point" rule governs the
chrome, not the illustration inside a card. Changing `--dw-art-warm` would change
27 pieces of shipped artwork to satisfy a rule about screen furniture. The
audit's actual headline defect (light `--dw-index` was `brass-700`, the dead
sandstorm; ~120 gold strapwork knots) is closed.

**[csp P8] The unexplained `221 tests / 1 fail` first run.** Not reproduced —
the suite ran green at 243/243 on every one of a dozen runs across this pass,
before and after the rebase. Recorded, not chased.

**[a11y P3, second half] Per-group accessible names.** Settings is still one
list of controls rather than three named groups. Doing it properly needs a
visible heading per section — `look` / `feel` / `device` are internal keys, not
copy — which is eight to ten new strings at five translations each, on a design
whose governor is "elegant and minimal" and which deliberately has no headings
on any screen. The `<h1>` and the document title close the WCAG 2.4.2 half; the
2.4.6 half is a copy decision for the founder, not a drive-by.

**[look 34] Blurbs clamped to two lines.** See above — the platform idiom, and
the alternative is a listing of paragraphs.

**[look WORST 5, remainder] Progress still says how many, never how well.**
"Answered 1284 / Correct 1102" has no rate and no streak. The drawing is fixed;
the numbers are a copy-and-model decision, noted in `HARNESS_FEEDBACK.md`.

**[csp P3, remainder] `bg-ground/85` on the pack stage's Leave button** is the
one live `color-mix` left. Below Safari 16.2 it paints as opaque `--dw-ground`
behind a `backdrop-blur` and a border, which is legible and arguably better —
not a defect worth a token. Two *dead* `color-mix` rules also survive in the
built CSS (`bg-accent/12`, `bg-ground-deep/85`); they are emitted because
Tailwind extracts candidates from the raw text of the committed `.md` reports in
this directory, they match no element, and the fix would be editing prose.

**[P12c] The vertical rungs stay keyed to viewport height.** Only the gutter
moved to width. That was the finding's actual ask — a conscious ruling — and the
ruling is: vertical space is what runs out on a short screen, so the vertical
rhythm answers height; a screen edge is horizontal, so it answers width.

---

## Gates

```
npm run tsc     pass
npm test        243 / 243
npm run lint    pass
npm run build   pass  (dist/assets/index-*.css 55.6 kB, gzip 10.7 kB)
node tools/capture.mjs                     120 shots, 0 problems
node tools/capture.mjs --textsize=largest  120 shots, 0 problems
```
