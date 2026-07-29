# Craft pass — the catalogue

The front door (`/`), raised to the finish the rest of the harness now has. Not
a redesign: same square cards, same generated key art, same search, same subject
chips, same "the whole tile is the button". Everything below is either visible
in a re-captured PNG or measured in `measurements.json`.

Files touched, and only these two:

* `src/catalog/Catalog.tsx`
* `src/catalog/catalog.css`

Re-run with `node tools/capture.mjs --only=packs`.

---

## 1. A card now answers a finger

`Catalog.tsx` — the tile was `hover:border-line-strong` and nothing else, which
is a pointer idea. On a phone there is no pointer, so **the card acknowledged a
child's tap with nothing at all**: it changed at the moment the next screen
appeared, and not before.

It now carries `.dw-press`, the one press behaviour in the design system: the
transform on the 90 ms press curve, the colour on the state curve, both
collapsing to nothing under either reduced-motion source. Hover survives as a
second, pointer-only layer (`hover:shadow-raised` — Tailwind already scopes
`hover:` inside `@media (hover: hover)`, verified in the built stylesheet, so it
cannot become the stuck-hover tell on a tablet).

## 2. A card is an object, not a bordered rectangle

`border-line bg-ground-raised` → `.dw-surface`, the elevation rung a card is
supposed to sit on, which carries background, edge and cast light as one triple.

This is audit §1.5. In light theme a card was white on near-white inside a rule
measuring 1.06:1, and `--dw-art-void` stays basalt in both themes by design — so
the near-black artwork read as the object and the card read as nothing. It casts
violet light now (`light/packs-834.png`, `light/packs-1440.png`).

## 3. The grid reads as a grid — audit §1.3

Three blocks used to be sized by their own content, so a one-line name put its
blurb where the next card put its second line, and a game filed under one
subject put its small print where its neighbour put its second chip. `h-full` +
`mt-auto` guaranteed only that the cards *ended* together.

Every block now reserves its maximum, in `catalog.css`:

| class | reserves | how the number is derived |
|---|---|---|
| `.dw-card-title` | 2 lines | leading set to 1.3 here (the title's 15px is an arbitrary size and inherits nothing sensible), so `2lh`, with `2.6em` as the pre-Safari-16.4 fallback |
| `.dw-card-blurb` | 2 lines | `text-xs` carries 1.35 from the type scale; `2.7em`, then `2lh` |
| `.dw-card-chip` | 1.375rem | 12px text at 1.35 + 0.125rem padding + a hairline, each side |
| `.dw-card-subjects` | 2 chip rows | every pack shipped files under one subject or two, so this is the maximum, not a guess |

`lh` lands in Safari 16.4 and this bundle's floor is iOS 16.0, so each rule
states the `em` equivalent first and lets `lh` win where it exists.

The small print was also restructured. It used to be one wrapping run of
`Addition & subtraction · Multiplication · Grades 1–5 · Play`, which produced
four different bottom-block shapes in one row of six and wrapped "Play" onto a
line of its own. It is now two fixed lines: the chips, then the grade band left
and the control right. Verified across the whole catalogue at 390 and 1440
(`x-deep-*` in the scratch run): the `Grades … / Play ›` line lands at the same
y on every card in every row.

## 4. "Play" is a control, not a metadata string — audit §1.2

It sat in the same 11px muted run as "Grades 1–5" and read as one string. It is
`--dw-accent-ink` now, on its own line, right-aligned, with a monoline chevron —
the same single stroke weight as the mark. Measured 8.98:1 light / 10.19:1 dark.

`resting` keeps its rule ("not a lock and never drawn as one") and finally has a
difference you can see without reading: "Tomorrow" in the muted ink, and no
chevron. No padlock, no dimming, no re-sorting. That is audit §1.8 closed
without breaking the design intent it was protecting.

## 5. Fewer, larger cards on a desktop — audit §1.1

`minmax(10.5rem, 1fr)` with `auto-fill` and no ceiling drew six ~170px columns
at 1440 — twenty-seven postage stamps. The 10.5rem *floor* is measured and
stays (COUNTERWEIGHT needs 142px of text box at the title's 15px). The ceiling
is now a decision:

```
≤ 639   auto-fill  →  2 columns at 390  (172px card, 148px of text)
640     3 columns  →  192px
768     4 columns  →  172px   ← the tightest rung, still 148px of text
1024    4 columns  →  237px
1280+   4 columns  →  265px, and no wider: the shell's frame stops at 1152
```

**A fifth column was built, captured and removed.** With `xl:grid-cols-5` a
1440px screen drew 211px cards while a 1024px iPad drew 237px ones — a card that
gets *smaller* as the screen gets *bigger*, which is the six-column defect
wearing a different number. Above 1152 the frame stops growing, so a column
added there can only take width away.

## 6. The search field

* A **recess** (`.dw-sunk`), which is what every platform draws. It was a rung
  *above* the page, so the one control that receives something looked like the
  controls that do something.
* A magnifier glyph and the clear control live **inside** the shell, so the box
  is one object and a tap in the padding lands in the field.
* `min-h-target-comfort` (56px) — the child-sized floor, not the platform one.
* **Focus is on the shell, not on the input.** `:focus-visible`'s outline drew a
  ring around the text run inside a bordered box — two nested rectangles. The
  input's outline is suppressed and the shell takes an accent edge plus a 2px
  ring, an equivalent visible indicator (WCAG 2.4.7) and what iOS does. First
  cut used `--dw-accent` for the edge and `--dw-focus` for the ring; they are
  different violets and read as two concentric rings, so both are `--dw-focus`
  now — the same colour the app draws focus in everywhere else.
* WebKit's `::-webkit-search-cancel-button` is suppressed — a ~14px grey disc,
  off-palette and under a third of the touch floor. The replacement is 44px.

## 7. The subject rail feels like a carousel — audit §0.5

Three defects, all closed:

1. **A painted horizontal track between the search field and the grid.**
   `index.css` suppresses scrollbars under `(pointer: coarse)` only, which is
   right for the page scroller and wrong for a chip rail; `.dw-rail` takes the
   bar away on every pointer.
2. **No signal that more subjects exist** (the row overflowed by 440px with
   nothing saying so). Both edges now dissolve, and **only on the side that has
   more** — `useRailEdges` writes `data-lead` / `data-trail` from `scrollLeft`
   and `catalog.css` reacts. A permanent fade on both ends is a decoration; a
   fade that is *absent* at the end is how you know you have reached it.
   Captured in all three states: start, mid-scroll, end.
3. **The chosen subject could be off screen.** Filtering by Fractions on a
   390px phone left "All / Number sense / Addition & subtraction" on screen with
   none of them lit — a control whose state you cannot see. The selection is now
   revealed to just clear of the dissolve (not centred, so a chip already
   comfortably visible does not move), smooth-scrolled, with the reduced-motion
   branch taken **in JS** because a `behavior` passed to `scrollTo` outranks the
   CSS `scroll-behavior: auto !important` the reduced-motion block sets.

**The mask must not be on the scrolling element**, and this cost a capture cycle
to find: Chrome sizes a mask on a scroll container against the *scrollable
overflow* area, so `calc(100% - 24px)` put the fade 450px off the right of a
390px phone and the screenshot showed a chip clipped stone dead. The mask is on
a static wrapper; the scroller is its only child.

Also: the chips were **inverted** (audit §0.2) — the selected one was
`bg-ground-sunk`, i.e. a hole in the page, while the five unselected ones looked
like raised pressable keys. Selected is `.dw-raised` now and the rest are
transparent, which is the iOS segmented control and the Android toggle group
both. `min-w-target` fixes audit §1.6: "All" measured 42.1 × 44px, under the
floor, on the control that clears the filter.

## 8. "No games match" is designed

It was `<p class="text-ink-muted py-8 text-center text-sm">` — a fallback.

It is now a centred block: an **empty niche**, drawn as the arch this app's mark
is built on, cut twice with nothing standing in it, monoline in the accent at
64px (48px read as a stray glyph in a 1152px column); the one line of prose the
catalogue owns, at `text-md`; and **the way back**. The way back matters most —
the state is reachable from the search field, from a subject chip, or from both
at once, and a child who cannot see which one caused it needs one control that
undoes all of them. It reuses `strings.catalog.all`, so no new string ships.

## 9. Filtering explains itself

The grid is keyed on the active subject, so changing the filter cross-fades the
new listing in on the enter curve rather than swapping it in one frame.
Deliberately **not** keyed on the query — a cross-fade on every keystroke is
decoration, and this app does not animate for the sake of it.

---

## Measured, after

`tools/shots/measurements.json`, `packs` at 390 / 430 / 834 / 1024 / 1440, both
themes:

| | result |
|---|---|
| horizontal page overflow | **0** at all ten |
| interactive targets under 44px | **0** at all ten |
| AA failures on any text pair | **0** at all ten |
| scrollbar on the chip rail | `scrollbar-width: none`, every pointer |

The four `escaping` elements reported at 390 and 430 are the subject chips
beyond the fold **inside** the rail. That is what a horizontal rail is; the page
itself does not move (`overflow.horizontal == 0`), and the dissolve is now the
thing that says so.

## Gates

```
npm run tsc     clean
npm test        226 pass, 0 fail
npm run lint    clean
npm run build   dist/assets/index-*.css 52.32 kB │ gzip 10.15 kB
                dist/assets/index-*.js 466.71 kB │ gzip 144.77 kB
```

## Not done, and why

* **Descriptions are still cut mid-word** (audit §1.4). `line-clamp` clips at a
  pixel, not at a word, and no CSS changes that. The blurb now *reserves* two
  lines so the raggedness no longer moves the cards around it, but "A
  bioluminescent reef that keeps growing whi…" is still what a child reads. The
  real fix is a short summary field in the manifests, or shorter first
  sentences — both live in `dynawalla/games/*/pack.json`, which is another
  agent's scope.
* **`--dw-art-void` stays basalt in light theme** by design in `tokens.css`, so
  the artwork is still a dark square on a pale page. With the card casting light
  the card now reads as the object, which was the actual complaint; changing the
  token is a design-system decision and `tokens.css` is not in this scope.
* **At 1280+ every card carries one empty chip row**, because no pack files
  under more than two subjects and both chips fit on one line at 265px. It is a
  uniform reserve rather than a ragged one, which is the trade the grid rhythm
  is bought with.
