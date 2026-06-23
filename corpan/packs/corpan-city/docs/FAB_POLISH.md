# Corpan City — FAB / Floating Chrome Premium Polish Spec (`FAB_POLISH.md`)

> Scope: every persistent on-screen element layered over the Babylon world inside
> `.wp-overlay` — Status Capsule, Place Tag, Minimap, Pack button, the unified menu
> dialog and its sections, governed as one system by `chromeVisibility`.
> Baseline = the functional fixes already in `src/styles.css` (corner-FAB tokens;
> fixed-height dialog; pack button moved to bottom-LEFT, minimap owns bottom-RIGHT).
> This doc elevates from there to "best-ever" premium. Build ON these fixes; do not redo them.

---

## 0. TL;DR — the one-paragraph vision

Four paper chips and one dialog, all cut from the **same warm-Antigua paper stock**,
arranged on a strict **safe-area + joystick-aware corner grid** that makes overlap
*structurally impossible* (shared tokens drive the math, not eyeballing). One material,
one type scale, one icon language, one elevation ladder, one motion vocabulary. The
dialog is a rock-stable fixed frame with sticky sub-headers and scroll-edge fades so
nothing ever "jumps." `chromeVisibility` already exists — we complete it (the minimap
is currently ungoverned) and make every surface recede as one cohesive breath.

---

## 1. Current-state audit (file:line, exact)

### 1.1 Status Capsule (top-left) — `src/quest/questTracker.ts`
- **Position/size:** `position:absolute; top: 8px+safe; left: 10px+safe`, `width: min(70vw, 300px)`.
  z `--wp-z-status: 12`. Expanded card `--wp-z-status-detail: 13`, `max-height: min(60vh, 420px)`.
- **Material:** glance `rgba(247,239,224,0.86)`, `blur(6px) saturate(1.05)`, radius `14px`,
  shadow `0 4px 14px rgba(58,47,37,.2)`. Detail card radius `14px`, shadow `0 8px 22px`.
- **Motion:** `wp-status-in` 0.3s; objective `::before` pulse 2.4s; cue rotate; detail fade+scale
  0.22s. Reduced-motion handled.
- **Problems:**
  - **Emoji in a premium surface (violation):** flag emojis `LANG_FLAG` in the lozenge; wallet
    bridge `setIcon("💵")`; badge bridge `setIcon("🏅")` + glyph string. Memory bans emoji in
    premium surfaces → must use `IconRenderer` (`src/items/itemArt.ts`) or inline SVG/flag-pair text.
  - **Radius mismatch:** capsule `14px` vs menu panel `26px` vs minimap `16px` vs pack button `14px`
    vs place tag `11px` — five different radii, no scale.
  - **Width can crowd the Place Tag on tablet:** capsule `min(46vw,360px)` + place tag `max-width:38vw`
    can sum past 100vw at ~700-820px widths in landscape → top-edge collision risk (no shared reservation).
  - Detail card z `13` **collides** with minimap z `--wp-z-minimap:13` — same stacking context,
    undefined paint order if they ever overlapped on a short landscape phone.

### 1.2 Place Tag (top-right) — `src/shell/placeTag.ts`
- **Position:** `top:10px+safe; right:12px+safe`, z `--wp-z-placetag:11`. `max-width:38vw`,
  radius `11px`, `blur(5px)`.
- **Motion:** fade/translate 0.22s in; reduced-motion handled.
- **Problems:**
  - **Emoji:** pin `📍` — violation; replace with inline SVG pin.
  - **Lowest contrast surface:** `rgba(239,227,205,0.62)` over a bright sky / neon Tokyo night can
    wash out (text `#6b5a44`). Intentionally quiet, but needs a minimum-contrast floor.
  - `pointer-events:none` — fine (passive), but means it can never be a tap target if we later want
    "tap place → recenter map."

### 1.3 Minimap (bottom-right anchor) — `src/map/minimap.ts` + `src/map/mapStyles.ts`
- **Position:** `right:14px+safe; bottom:14px+safe`, `width/height: var(--wp-minimap-size, 132px)`,
  `108px` ≤540px. z `--wp-z-minimap:13`. Radius `16px`; shadow `0 6px 18px` + 3px accent inset ring.
- **Problems (most severe):**
  - **NOT governed by `chromeVisibility`.** game.ts registers only tracker/placeTag/packButton. The
    minimap stays **fully lit at z=13 during dialogue, challenge, and menu** while everything else
    recedes — the single biggest "chrome feels incoherent" defect. mapStyles.ts has **no**
    `[data-wp-chrome]` rule at all.
  - **Token duplication / drift hazard:** minimap sizes itself with `--wp-minimap-size`. The earlier
    pack-stack experiment introduced a separate `--wp-minimap-h`; now that the pack moved to the
    bottom-left corner this coupling is gone, but the minimap-size token should still be unified to
    a single source if any element ever needs to reference it again.
  - **z=13 collides** with status-detail z=13 (see 1.1).
  - The 3px accent inset ring is the only element with a saturated colored border — inconsistent with
    the rest of the paper language.

### 1.4 Pack button (bottom-LEFT) — `src/shell/menuButton.ts` + `.wp-menu-button` styles.css
- **Position:** `bottom: --wp-fab-inset(14)+safe; left: --wp-fab-inset+safe`. `44px`
  (`50px` on `hover:none`). z `--wp-z-menu-button:38`. Radius `14px`. Owns its own corner — cannot
  overlap the minimap.
- **Joystick:** correctly swallows pointerdown/up (menuButton.ts) so the move-stick half can't steal
  its tap. **Good — keep.**
- **Problems:**
  - Comment in styles.css says fallback `65` but the var is `38` — stale comment (also
    chromeVisibility dim/hidden rules reference `65`). Cosmetic, but confusing.

### 1.5 Unified menu dialog — `src/shell/menuPanel.ts` + `.wp-menu*` styles.css
- **Frame:** `width: min(420px, 100%-40px)`, **fixed** `height: min(620px, 100%-40px)` — the good fix.
  Grows to 680×820 @700px, 820×880 @1100px. Radius `26px`/`30px`. Body is sole scroll region.
- **Tabs:** SECTION_ORDER `["map","inventory","quest"]` — **Badges is NOT a tab** though it's a
  registered section and reachable only via the capsule deep-link / inventory link. Tabs are a
  segmented control.
- **Problems:**
  - **No sticky sub-headers:** Badge filter pills (`.wp-badges-filter`) and inventory headings scroll
    away with the grid — the owner's "filter should pin" ask is unmet.
  - **No scroll affordance:** `.wp-menu-body` overflow has no top/bottom fade or inset shadow.
  - **Empty-state weakness on a fixed frame:** a short tab leaves a tall void. `.wp-menu-coming` is a
    thin italic line centered in 132px — looks unfinished in an 820px frame.
  - **Badges grid contrast:** cells use a blue-grey ink palette (`#243842`) that does **not** match the
    warm-Antigua menu (`#3a2f25`) — the "mismatched" feel, literally a different color family inside
    the same dialog.
  - Tab switch re-runs `renderSection` with no cross-fade → content pops. Frame is stable now (good)
    but the *content* swap is abrupt.

### 1.6 Map contrast + markers — `src/map/schematic.ts`, `mapCore.ts`, `mapStyles.ts`
- **"7 types, 2 colors" — largely already addressed:** `MARKER_STYLES` now gives each of 11 types a
  **distinct shape + saturated color + glyph**, single source of truth, legend swatches painted by the
  same `drawMarker`. This critique is mostly *resolved in code*. Remaining gaps:
  - **Ground contrast:** stage bg `#efe1c2` under markers whose halo is `rgba(255,255,255,.95)` is
    fine, but the **minimap** (small, `detail:false`) reads muddy. Minimap markers are tiny (size 3-5)
    with `lineWidth 1.4` halo — low separation at 108-132px.
  - **Glyph emoji in markers:** `⚓ ⌂ ✦ ¤ ≈` are Unicode symbols rendered as text glyphs on the canvas
    — acceptable (canvas-drawn, not DOM emoji) but inconsistent weight; on full map only.
  - **Crowded pills — already mitigated:** priority + overlap-drop placement, traveller cap of 5.
    Remaining: pills use `rgba(249,243,230,.94)` — low contrast vs the paper stage; needs a stronger
    pill or a hairline border.

### 1.7 chromeVisibility coherence — `src/shell/chromeVisibility.ts`
- Clean state machine: `world/focused/dialogue/challenge/menu/onboarding` → per-role `shown/dim/hidden`.
  Band stays on `focused`, pack dims.
- **Gaps:**
  - **Minimap unregistered** (the big one — see 1.3).
  - **No `dim` styling exists for `band` surfaces** — `focused` returns `shown` for band, so band never
    visually steps back even when a Talk button + NPC are the point of attention.
  - The status **detail card** isn't force-collapsed on state change; if chrome goes `hidden` while
    expanded, the open card's `pointer-events:auto` could linger one frame.

---

## 2. Unified spatial system — the corner/edge grid

### 2.1 The grid
Four anchored zones around the safe-area rectangle, center reserved for toasts/blooms:

```
┌─────────────────────────────────────────────┐
│ [TL: Status Capsule]        [TR: Place Tag]  │  ← TOP BAND (role: band)
│                                              │
│              (center: toast/bloom)           │
│                                              │
│ [BL: Pack]                      [BR:Minimap] │  ← BOTTOM CORNERS (split L/R)
└─────────────────────────────────────────────┘
        left half = MOVE stick      right half = LOOK stick
```

### 2.2 Shared token set (single source of truth)
ONE token block in `:root` (styles.css). The minimap should consume the **same** size token
(unify `--wp-minimap-size` → a single root token):

```css
:root {
  /* Insets & gaps */
  --wp-fab-inset: 14px;          /* corner inset (all corners) */
  --wp-fab-top: 8px;             /* top-band inset */
  /* Sizes */
  --wp-minimap-h: 132px;         /* THE minimap size (square). One token. */
  --wp-pack-size: 44px;          /* pack button (50px coarse-pointer) */
  /* Elevation ladder (see 3.3) */
  --wp-e1: 0 2px 9px rgba(58,47,37,.14);
  --wp-e2: 0 4px 14px rgba(58,47,37,.20);
  --wp-e3: 0 8px 22px rgba(58,47,37,.28);
  --wp-e4: 0 24px 64px rgba(58,47,37,.45);
  /* Radii scale (see 3.2) */
  --wp-r-chip: 12px; --wp-r-card: 18px; --wp-r-panel: 26px; --wp-r-pill: 999px;
  /* Blur tiers */
  --wp-blur-chip: 6px; --wp-blur-card: 8px; --wp-blur-scrim: 3px;
}
@media (max-width:540px){ :root{ --wp-minimap-h:108px; --wp-pack-size:50px; } }
@media (min-width:700px){ :root{ --wp-minimap-h:152px; } }   /* roomier tablet */
@media (hover:hover) and (pointer:fine) and (min-width:1100px){
  :root{ --wp-minimap-h:168px; }                              /* desktop */
}
```

`mapStyles.ts`: change `.wp-minimap { width/height: var(--wp-minimap-h); }` and delete the
`--wp-minimap-size` media query. Now ONE number drives the card.

### 2.3 The non-overlap guarantee
The bottom corners are split L/R: pack owns bottom-LEFT, minimap owns bottom-RIGHT. With a phone
minimap of 108px and a pack of ~50px, a 320px-wide viewport still leaves `320 - 14 - 50 - 108 - 14 ≈
134px` of clear gutter between them — they cannot meet. (No vertical-stack math needed anymore.)

**Top band horizontal reservation** (prevents capsule↔place-tag collision):
- Reserve a center gutter: capsule `max-width: min(58vw, 360px)`, place tag `max-width: min(34vw, 240px)`.
  `58 + 34 = 92vw` leaves an 8vw center gutter at the worst case. On phone-portrait the place tag is
  icon-only so the capsule may take `70vw` safely.

### 2.4 Joystick-zone reservation
`input.ts`: sticks spawn at the touch point anywhere in their half (dynamic origin), radius 56px. The
only hard rule is **a FAB that takes taps must `stopPropagation` on pointerdown** so it doesn't spawn a
stick (pack button already does). Spatial guidance:
- **Pack** sits bottom-left (move-stick half), **minimap** bottom-right (look-stick half). Both must
  stop the pointer — pack does; **the minimap is a `<button>` but does NOT currently swallow pointerdown**
  → ADD the same swallow so tapping the minimap can't also fling the look camera.
- Keep the **bottom-center 120px-wide × 110px-tall** band clear of tap FABs (the Talk button lives there).
- Capsule/place tag are top-edge, far from either stick spawn comfort zone — fine.

---

## 3. Unified visual language

### 3.1 Material — the paper stack (one spec)
All chips/cards are cut from the same stock; they differ ONLY by opacity + elevation tier:

| Surface        | bg                                  | blur | radius        | elevation |
|----------------|-------------------------------------|------|---------------|-----------|
| Place Tag      | `rgba(244,234,212,0.74)`*           | 6px  | `--wp-r-chip` | `--wp-e1` |
| Status Capsule | `rgba(247,239,224,0.88)`            | 6px  | `--wp-r-chip` | `--wp-e2` |
| Pack button    | `rgba(247,239,224,0.88)`            | 6px  | `--wp-r-chip` | `--wp-e2` |
| Minimap        | `linear-gradient(#f7efe0,#ece0c6)`  | —    | `--wp-r-card` | `--wp-e2` |
| Capsule detail | `rgba(247,239,224,0.95)`            | 8px  | `--wp-r-card` | `--wp-e3` |
| Menu panel     | `linear-gradient(#f7efe0,#efe3cd)`  | —    | `--wp-r-panel`| `--wp-e4` |

\* Place Tag raised from `0.62`→`0.74` to clear the contrast floor on bright/neon skies while staying
the quietest chip.

**Inset highlight (the "cut paper" top edge):** every surface keeps `inset 0 1px 0 rgba(255,255,255,0.55)`.
Standardize (currently varies .45–.6).

**Border:** drop the minimap's saturated 3px accent ring; replace with the shared
`inset 0 0 0 1px rgba(255,255,255,0.5)` + a 1px hairline `rgba(120,100,70,0.18)` so it matches the
inventory cells. Tint comes from the player wedge + POIs *inside* the canvas, not the frame.

### 3.2 Radii scale
`--wp-r-chip:12 · --wp-r-card:18 · --wp-r-panel:26 · --wp-r-pill:999`. Apply everywhere; retire the
one-off 11/14/16/30px values.

### 3.3 Elevation ladder
`e1`(passive chip) → `e2`(interactive chip/anchor) → `e3`(popover) → `e4`(modal panel). Defined as
tokens in 2.2. Shadow depth = conceptual depth.

### 3.4 Type scale (one ramp)
```
label-xs : 700 11px/1   uppercase .08em   (#9a8868)  — section headings, "Step N of M"
label-sm : 700 12.5px/1.2                  — chip titles, tab labels
body-sm  : 500 13.5px/1.4                  — hints, lore, step rows
body-md  : 700 14.5–16px/1.3               — objective, currency name
title-sm : 800 18px/1.2                    — section titles
title-md : 800 22px → 26px @700 → 28 @1100 — dialog title
```
Family: `ui-rounded, "SF Pro Rounded","Nunito",system-ui`. **Unify** — the badges slice uses
`ui-sans-serif`; switch it to the rounded stack to match.

### 3.5 Icon language — zero emoji
All glyphs become inline SVG (stroke `currentColor`, accent-inheriting) OR `IconRenderer` canvases for
currency/medal art:
- **Replace** `📍` (placeTag) → 16px inline SVG pin.
- **Replace** flag emojis (questTracker) → a flag-pair rendered as 2-letter caps in tinted lozenges
  (`EN→ES`) or tiny IconRenderer flag chips; emoji flags don't render on Windows anyway.
- **Replace** `💵`/`🏅` bridge icons (questTracker) → IconRenderer currency glyph + medal glyph.
- Map marker Unicode glyphs are canvas-drawn — acceptable, but normalize or drop glyphs on the minimap
  (shape+color already disambiguate at small size).

### 3.6 State styling (one set, every interactive FAB)
```
rest          : material above
hover (fine)  : bg opacity +0.10, no transform (chips)  /  translateY(-1px) (minimap/pack)
active        : transform: scale(0.96)  (200ms ease back)
focus-visible : outline: 2px solid var(--accent); outline-offset: 2px   (ALREADY consistent — keep)
dim   (data-wp-chrome=dim)   : opacity .45; pointer-events:none; filter:saturate(.9)
hidden(data-wp-chrome=hidden): opacity 0; pointer-events:none; aria-hidden
```
Accent (`#c46b4a`) is used ONLY for: focus ring, the objective pulse dot, the progress fill, the
primary Resume button, deep-link action text, and the player wedge. Never for backgrounds of passive chips.

---

## 4. The dialog/menu system, premium

### 4.1 Stable frame (done) + add Badges as a real tab
- Keep the fixed frame. **Add `"badges"` to `SECTION_ORDER`** (menuPanel.ts) so the segmented control is
  **Map · Inventory · Quest · Badges**. At 4 tabs the control still fits ≥320px. On phone-portrait, allow
  the tab strip to become horizontally scrollable (snap) if needed.

### 4.2 Sticky sub-headers + scroll affordances
Restructure each section into a non-scrolling **sub-head** + a scrolling **list**:

```css
.wp-menu-body { position: relative; }
.wp-menu-subhead {
  position: sticky; top: 0; z-index: 2;
  padding: 6px 0 10px;
  background: linear-gradient(180deg,#f7efe0 70%, rgba(247,239,224,0));
}
.wp-menu-body::before, .wp-menu-body::after{
  content:""; position:sticky; left:0; right:0; height:14px; display:block;
  pointer-events:none; z-index:1;
}
.wp-menu-body::before{ top:0;    background:linear-gradient(#f7efe0, transparent); }
.wp-menu-body::after { bottom:0; background:linear-gradient(transparent, #efe3cd); }
```
- **Badges:** move `.wp-badges-filter` into a `.wp-menu-subhead` so In Progress / Recent / All **pins**
  while the medal grid scrolls — the owner's exact ask.
- **Inventory:** the `.wp-inv-heading` rows become sticky sub-heads per group.

(Pure CSS sticky pseudo-els; no JS scroll listeners.)

### 4.3 Empty-state design (so a fixed frame never looks empty)
Replace the thin `.wp-menu-coming` line with a centered **empty card**: a soft IconRenderer glyph (48px,
debossed), a one-line title, a one-line hint, in a `min-height:100%` flex-center container:
```css
.wp-menu-empty { min-height:100%; display:grid; place-content:center; gap:10px; text-align:center; color:#9b8a72; }
```
- Inventory empty: "Your pack is empty — earn items by helping townsfolk." + satchel glyph.
- Badges empty filter: existing `.wp-badges-empty` → restyle into this card.

### 4.4 Badge grid: contrast + warm palette
- Reskin badge cells from the blue-grey palette to the warm-Antigua ink (`#2e261d` / `#7a6a52` / heading
  `#9a8868`) so the Badges tab belongs to the same dialog.
- Cells: same material as `.wp-inv-cell` (gradient, hairline, inset highlight, `--wp-e1`).
- Medal legibility: add a debossed well behind each medal (`inset 0 1px 2px rgba(58,47,37,.18)`).
- Locked badges: `opacity .55; grayscale .5` is fine — keep.

### 4.5 Section transition
On tab switch, cross-fade the body content: render new section at opacity 0, swap, `rAF` → opacity 1 over
140ms (reduced-motion: no fade). Frame stays fixed, so no size jump. Optional P2: sliding tab highlight.

### 4.6 Map section contrast (dialog + full-map)
- Darken the stage ground one step: `#e9d8b4` (from `#efe1c2`); bump bounds-frame line to `rgba(120,96,60,.32)`.
- POI label pills: stronger fill `rgba(252,247,235,0.97)` + hairline `1px rgba(120,96,60,.22)` + `--wp-e1`.
- **Minimap-specific:** at 108-132px, drop marker glyphs, increase halo `lineWidth` to 1.8, raise the
  objective star to size 6. Add a 1px inner vignette on the minimap canvas edge.

---

## 5. Motion & juice

One vocabulary, all compositor-only (opacity/transform), all reduced-motion-gated:

| Moment                  | Animation                                                        | Duration / easing |
|-------------------------|-----------------------------------------------------------------|-------------------|
| Chip enter (capsule/tag)| opacity 0→1, translateY(-4→0)                                    | 300ms `cubic(.22,1,.36,1)` |
| Pack/minimap enter      | opacity 0→1, scale(.9→1)                                         | 220ms same        |
| Hover (fine)            | bg +opacity / translateY(-1px)                                  | 120–160ms ease    |
| Tap                     | scale(.96)                                                      | 100ms → 200ms back|
| Dialog open             | scrim opacity + panel scale(.94→1)+translateY(10→0)             | 220/280ms (in place)|
| Tab content swap        | inner fade 0→1                                                  | 140ms ease        |
| Glance update (capsule) | the *value* text does a 1px rise + opacity flicker on change    | 180ms             |
| Objective pulse         | `box-shadow` ring 2.4s (existing)                               | infinite, gentle  |
| Minimap objective       | expanding ring (existing schematic pulse) ~1.6s                 | infinite          |
| Reduced-motion          | all of the above → opacity-only or none                         | —                 |

**Glance micro-animation (new, dignified):** when wallet/badge/objective text changes, briefly tint the
changed value to accent then ease back over 600ms (no bounce, no number-rolling — that reads as a
"nag/dopamine" pattern the owner dislikes). DOM-chrome micro-anims live in CSS transitions on class
toggles — keep them separate from `createJuice` (which is scene-space).

---

## 6. Responsive (phone → iPad → desktop, tablet/desktop first-class)

| Element        | Phone (≤540)                     | Tablet (700–1099)                  | Desktop (≥1100 fine)               |
|----------------|----------------------------------|------------------------------------|-------------------------------------|
| Capsule        | `min(70vw,300)`, 3 rows          | `min(58vw,360)`, +1px type         | `clamp(320,26vw,420)`, "Details" pill |
| Place Tag      | icon-only (pin+pip)              | `place · era` + pip                | `place · era` + "N online"          |
| Minimap        | 108px                            | 152px                              | 168px                               |
| Pack           | 50px (coarse)                    | 44px                               | 44px + hover                        |
| Dialog         | `min(420,100%-40)` × `min(620,…)`| 680 × 820, pad 30/32               | 820 × 880, pad 36/40                |
| Dialog radius  | 22                               | 26                                 | 30                                  |
| Body type      | base                             | +1–2px                             | +1–2px, 2-col bridges/legend        |

Principle: **grow roomy on big screens**, **stay snug on phone**. The minimap growing to 168px on
desktop is the headline "premium on big screens" move.

---

## 7. chromeVisibility coherence (one cohesive recede)

### 7.1 Register the minimap (P0 bug)
- Add a `"map"` role to `ChromeRole` (chromeVisibility.ts) so the minimap can **stay visible (dim)
  during `focused`** like the band, but recede fully on dialogue/challenge/menu.
- In `game.ts`: `chrome.register({ el: minimap.el, role: "map" })`.
- In `mapStyles.ts`, add:
```css
.wp-minimap{ transition: opacity .22s ease, transform .16s ease; }
.wp-minimap[data-wp-chrome="dim"]   { opacity:.4; pointer-events:none; }
.wp-minimap[data-wp-chrome="hidden"]{ opacity:0; pointer-events:none; }
```
- `visibilityFor("map", state)`: `world→shown`, `focused→dim`, everything else→`hidden`.

### 7.2 Make `focused` actually step the band back
Add a lighter `dim` for band on `focused` (opacity .7, still interactive) so the Talk CTA is clearly the
hero. Keep the capsule *readable* (.7 not .4).

### 7.3 Force-collapse capsule detail on recede
When state leaves `world`/`focused` into a blocking state, call `tracker.collapse()` from `refreshChrome()`
so an open detail card never lingers with `pointer-events:auto` under a dialogue.

### 7.4 The cohesive "breath"
With minimap + band-dim + collapse wired, all surfaces recede *together* on a single 220ms ease when any
blocking surface opens, and return together on close — one system, one breath.

---

## 8. Prioritized, sequenced implementation checklist

### P0 — correctness + the visible incoherence (do first)
1. **Register the minimap with chromeVisibility.** `src/shell/chromeVisibility.ts` (add `"map"` role +
   `visibilityFor`), `src/game.ts` (register), `src/map/mapStyles.ts` (add `[data-wp-chrome]` rules +
   transition). *Fixes minimap-stays-lit-during-dialogue.*
2. **Unify the minimap size token.** `src/map/mapStyles.ts` (use `--wp-minimap-h`, delete
   `--wp-minimap-size` + its media query); `src/styles.css` (FAB token block, tablet/desktop sizes).
3. **Resolve z-collision.** Give the minimap a distinct z (e.g. `--wp-z-minimap: 13` → `36`) and bump
   `--wp-z-status-detail` to `14` (off the minimap's old 13). *No undefined paint order.*
4. **Minimap swallows pointerdown/up.** `src/map/minimap.ts` (mirror menuButton). *Tapping the minimap
   can't fling the look camera.*
5. **Force-collapse capsule detail on recede.** `src/game.ts` `refreshChrome` → `tracker.collapse()`.

### P1 — the premium unification (the "best-ever" pass)
6. **De-emoji premium surfaces.** `src/quest/questTracker.ts` (flags →2-letter lozenge or IconRenderer;
   `💵`/`🏅`→IconRenderer), `src/shell/placeTag.ts` (`📍`→inline SVG).
7. **Apply the shared material + radii + elevation tokens** to all chips/cards/panel: `src/styles.css`,
   `src/quest/questTracker.ts` CSS, `src/shell/placeTag.ts` CSS (bg .62→.74), `src/map/mapStyles.ts`
   (.wp-minimap frame → shared border, drop accent ring). Unify font family in `src/badges/badgeCase.ts`.
8. **Add Badges as a 4th tab.** `src/shell/menuPanel.ts` (`SECTION_ORDER`), `src/styles.css` (tab strip
   scroll/snap on phone).
9. **Sticky sub-headers + scroll-edge fades.** `src/styles.css` (`.wp-menu-subhead`, body `::before/::after`);
   `src/badges/badgeCase.ts` (filters → subhead), `src/inventory/inventoryPanel.ts` (headings → subhead).
10. **Premium empty-state card.** `src/shell/menuPanel.ts` (`placeholder`→`.wp-menu-empty`), `src/styles.css`.
11. **Warm-up the badge grid.** `src/badges/badgeCase.ts` palette → Antigua ink, cells → shared `.wp-inv-cell`
    material, debossed medal wells.
12. **Band-dim on `focused`.** `src/shell/chromeVisibility.ts` (band `focused→dim@.7`), capsule/placeTag/minimap CSS dim rules.

### P2 — polish & juice (nice-to-haves)
13. **Map contrast bump** (ground `#e9d8b4`, stronger pill fill+hairline, minimap halo 1.8 + no glyphs +
    edge vignette). `src/map/mapStyles.ts`, `src/map/schematic.ts`.
14. **Tab content cross-fade** (140ms) + sliding tab highlight. `src/shell/menuPanel.ts`, `src/styles.css`.
15. **Glance micro-animation** (value tint-on-change, 600ms ease-back). `src/quest/questTracker.ts`.
16. **Top-band horizontal reservation** clamps (capsule ≤58vw, tag ≤34vw). `src/quest/questTracker.ts` +
    `src/shell/placeTag.ts` CSS.
17. **Stale comments cleanup** (z fallbacks 65→38). `src/styles.css`, `src/shell/chromeVisibility.ts`.

### Flagged — needs host/plugin change (out of FAB scope, do NOT attempt here)
- **TTS voice selection / native STT** is a Tauri plugin concern, not chrome. If a "voice settings"
  affordance is ever added to the menu, it needs the host's voice list — coordinate separately.
- **`presenceCount`** (place tag pip) depends on the net client landing — already omit-graceful.

---

## 9. Acceptance bar
- Open dialogue / challenge / menu → **all FABs recede as one** 220ms breath; none (incl. minimap) stays
  lit. Close → they return together.
- Resize phone↔iPad↔desktop: zero overlap at any width/orientation; dialog grows roomy, never jumps on
  tab switch.
- Switch Map/Inventory/Quest/Badges and In Progress/Recent/All: frame fixed, sub-head pinned, scroll
  fades present, footer always reachable, no empty void on short tabs.
- Zero emoji in any premium surface; one radius scale, one shadow ladder, one type ramp, one warm palette.
- `prefers-reduced-motion`: every animation degrades to opacity-only/none.
- All ≥44px touch targets; safe-area-aware; nothing mounts on `document.body`.
