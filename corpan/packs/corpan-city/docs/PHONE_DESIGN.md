# PHONE_DESIGN — the in-world Phone, designed like a real device

> The "phone" the player carries in Corpan City is the single in-game menu. The
> owner's brief: make it **EPIC** — a real, slick device experience, "like an iOS
> Simulator," right-anchored, as big as reasonably fits, with a Maps app that
> feels like a real Maps app and every app slicker. "You kids might love the fake
> phone, man. It's going to be epic. Don't short-change it."
>
> This is the **design system** for that device. It is opinionated on purpose. It
> is the frozen contract the implementation workers build against and the mockups
> the owner reacts to BEFORE we build. Read §1 (the one fix), then §2 (the device),
> then your app section.

---

## §0. The one-paragraph thesis

Today the phone is a **content-sized bottom drawer**: a paper card that is as tall
as whatever app is open, docked to the bottom-right on tablet/desktop. Open *Things*
and it's short; open *Music* and it's tall; the frame jumps every time you change
apps. That is the **#1 thing to kill.** A phone is a *device*: a slab with a FIXED
outer size and a FIXED inner viewport. Apps don't resize the slab — **content
scrolls inside the screen.** We are rebuilding the *frame* into an honest device:
a bezel, a status bar (time · signal · battery), a home-screen springboard, a
home-indicator gesture bar, and crisp app-switch transitions — all at a **constant
size that never changes between apps.** The section renderers (Map/Things/Quest/
Badges/Music) are REUSED verbatim; we re-skin and re-frame them, we do not rebuild
them. This document specifies the device down to the pixel.

---

## §1. THE CONSTANT-SIZE INVARIANT (non-negotiable)

**Invariant:** From the moment the phone opens to the moment it closes, the
**device frame and the screen viewport are a single fixed size.** Switching apps,
scrolling a long list, opening a tall Music player — none of it changes the frame
by even one pixel. The ONLY thing that moves is content *inside the screen's clip*.

How we guarantee it (and how we PROVE it):

- The device is one element, `.wp-phone-device`, with a **fixed `width` and a fixed
  `height`** (computed once per open from the form factor, §2.2). It is NOT
  `max-height: min(content, …)`. There is no content-driven sizing anywhere on the
  device or the screen.
- The **screen** (`.wp-phone-screen`) is `position: absolute; inset: <bezel>` inside
  the device, with `overflow: hidden`. It is a fixed rectangle.
- Each app stage scrolls in its OWN inner region (`overflow: hidden auto`) that is
  100% of the screen height minus the status bar and the app top-bar. The scroll
  lives *under* the device's clip; the device cannot grow.
- The home-screen and every app share the SAME screen rectangle. The springboard
  does not "size to its grid"; it fills the screen and centers/anchors the grid.

**Proof harness (frozen acceptance test):** `__verify__/shot.mjs` measures
`.wp-phone-device.getBoundingClientRect()` on the home screen, then on EACH app
(Map, Things, Quest, Badges, Music-off, Music-on), and asserts the rect is
**byte-identical** across all of them. A diff of even 1px fails the build. This is
the single most important test in this subsystem — write it first, keep it green.

**Already validated (lead's spike).** A standalone prototype of the device frame +
the constant-size assertion is committed at `docs/phone-proto/device-frame.html`
(rendered shots: `wp-proto-desktop-{home,app}.png`, `wp-proto-tablet-home.png`).
The assertion PASSES: on a 1280×800 host the device is a fixed **347×752** slab
hugging the right edge (x=909), **byte-identical across home + all five apps** while
a 14-row list scrolls inside the screen; on an 834×1112 tablet it's **425×920**,
also constant. Worker A's job is to port this proven CSS/math into the real
`phoneSheet.ts`/`phone.css` behind the existing seams — the approach is de-risked.
The core sizing rule that makes it work:

```css
.wp-phone-device{
  height: clamp(560px, calc(100svh - 48px), 920px);   /* from VIEWPORT, not content */
  width:  calc(clamp(560px, 100svh - 48px, 920px) * 9 / 19.5);  /* aspect-locked */
  inset-inline-end: max(24px, env(safe-area-inset-right,0px));   /* right-anchored */
  top: 50%; transform: translateY(-50%);
}
.wp-phone-screen{ position:absolute; inset:var(--wp-dev-bezel-w); overflow:hidden }
```

> Mental model: the old phone was a *speech bubble that grew to fit its words*. The
> new phone is a *television*: the box is the box; the channel changes inside it.

---

## §2. THE DEVICE

### 2.1 Anatomy (one mockup to rule them all)

```
   ╭───────────────────────────────────────╮  ← device bezel (rounded slab,
   │  ▕                                   ▕  │     ink-dark, soft outer shadow)
   │  ▕  9:41        ●●●● 5G        ▮▮▮▮▯  ▕  │  ← STATUS BAR  (time · signal · batt)
   │  ▕  ───────────────────────────────  ▕  │
   │  ▕                                   ▕  │
   │  ▕   [Corpán mark]   Corpan City     ▕  │  ← APP TOP-BAR (home: brand + city
   │  ▕                          ⌕  ⚙     ▕  │     name; in-app: ‹ back · title · ✕)
   │  ▕                                   ▕  │
   │  ▕   ┌────┐  ┌────┐  ┌────┐  ┌────┐  ▕  │
   │  ▕   │ 🗺 │  │ 🎒 │  │ 📍 │  │ 🎖 │  ▕  │  ← SPRINGBOARD  (icon grid;
   │  ▕   └────┘  └────┘  └────┘  └────┘  ▕  │     this region SCROLLS, frame doesn't)
   │  ▕    Map   Things  Quest  Badges    ▕  │
   │  ▕                                   ▕  │
   │  ▕   ┌────┐                          ▕  │
   │  ▕   │ 🎵 │                          ▕  │
   │  ▕   └────┘                          ▕  │
   │  ▕    Music                          ▕  │
   │  ▕                                   ▕  │
   │  ▕                                   ▕  │
   │  ▕   ▸ Active quest: Find the café   ▕  │  ← DOCK / OBJECTIVE STRIP (optional,
   │  ▕   ───────────────────────────────  ▕  │     a pinned "what now" widget)
   │  ▕               ▁▁▁▁▁▁              ▕  │  ← HOME INDICATOR (gesture bar)
   │  ╰───────────────────────────────────╯  │
   ╰───────────────────────────────────────╯  ← outer device edge
```

Layers, top to bottom inside the device:

1. **Bezel** — the device body. A dark, slightly metallic ink frame (`--wp-dev-bezel`)
   with a large outer radius (`--wp-dev-radius`, 44px), a soft drop shadow, and a
   subtle top-edge specular highlight so it reads as a physical slab, not a `<div>`.
   Bezel thickness `--wp-dev-bezel-w` (10px phone-in-tablet / 12px desktop, 3px on a
   real phone — §4).
2. **Screen** — `inset: bezel`, radius `--wp-dev-radius - bezel`, `overflow: hidden`,
   a paper background (`--wp-phone-paper`). Everything else lives in here.
3. **Status bar** — fixed height `--wp-statusbar-h` (34px). Faux but believable:
   live clock (the player's real wall time, updates each open + each minute), a
   signal-dots glyph, a "5G"/Wi-Fi glyph, a battery pill. Tints to match the screen
   chrome (dark glyphs on paper). NOT interactive. This sells "real phone" instantly.
4. **App top-bar** — fixed height `--wp-topbar-h` (52px). Home variant: the Corpán
   mark + "Corpan City" wordmark, plus a search affordance ⌕ and a settings ⚙ that
   open the relevant apps (search → Map search; ⚙ → an About/settings sheet; both
   optional in v1, but the SLOTS exist). In-app variant: a ‹ back chevron, the app
   title, and a ✕ that closes the whole phone.
5. **Body** — the single scroll region the home springboard OR an app mounts into.
   `overflow: hidden auto`. This is the ONLY scroller.
6. **Home indicator** — a centered gesture pill at the bottom (`--wp-homebar-h`,
   24px reserved). A swipe-down / tap on it = "go home" (app→springboard) or close
   (already home). Mirrors a real device's home gesture; ALSO the grab handle on a
   real phone form factor (the bottom-sheet drag).

### 2.2 Sizes per form factor — the fixed-viewport math

The device is sized ONCE per open, from the host viewport. The **aspect ratio is
locked** to a phone (`--wp-dev-aspect`, default `9 / 19.5`, the modern tall-phone
ratio). We pick the LARGEST device that fits the available height with margin, then
right-anchor it.

```
DESKTOP / large tablet (host ≥ 1024w, "device floats on the right"):
  deviceH = clamp(560px, host.vh - 2*margin, 920px)
  deviceW = deviceH * (9/19.5)            ≈ 0.46 * deviceH  → ~258..425px wide
  anchor : right: max(24px, safe-right) ; vertically centered (or bottom-biased)
  margin : 24px

MEDIUM tablet / split (720..1023w):
  deviceH = clamp(520px, host.vh - 2*16px, 880px)
  deviceW = deviceH * aspect
  anchor : right: max(16px, safe-right) ; bottom-biased so the FAB corner reads
  margin : 16px

PHONE (host < 720w) — see §4. A phone-in-a-phone is silly:
  The device frame DISSOLVES to near-full-bleed. We keep the status bar + home
  indicator (they're the OS chrome of the GAME's phone), drop the thick bezel to a
  3px hairline, and the device fills the width with a small top inset. It reads as
  "the game took over your screen" — which is the truth on a phone.
```

The key change vs. today: **`deviceH` is a function of the host viewport, not of
content.** Every app gets the same `deviceH`. The aspect lock makes width follow
height, so the slab is always phone-shaped.

Why right-anchored + as-big-as-fits: the owner explicitly wants it on the RIGHT
(good, not centered) and BIG. On a 13" laptop that's a ~820px-tall phone hugging the
right edge — genuinely "iOS Simulator" energy. The left ~60% of the screen stays the
living 3D city, which is the point: you're holding a phone *in* the world.

### 2.3 The design tokens (frozen)

All under `--wp-phone-*` / `--wp-dev-*`, scoped to `.wp-phone-root`. Workers consume
these; only the device-frame worker DEFINES the new `--wp-dev-*` set.

```
DEVICE
  --wp-dev-aspect        : 9 / 19.5     /* locked phone aspect */
  --wp-dev-radius        : 44px         /* outer corner radius */
  --wp-dev-bezel-w       : 12px         /* desktop; 10 tablet; 3 phone */
  --wp-dev-bezel         : #15110d      /* near-black device body */
  --wp-dev-bezel-spec    : rgba(255,255,255,.10)  /* top-edge highlight */
  --wp-dev-shadow        : 0 40px 90px -20px rgba(20,14,8,.55), 0 12px 30px rgba(20,14,8,.30)
  --wp-statusbar-h       : 34px
  --wp-topbar-h          : 52px
  --wp-homebar-h         : 24px

SCREEN / PAPER  (kept from today's palette so apps don't re-skin)
  --wp-phone-paper       : #f7efe0
  --wp-phone-paper-2     : #efe3cd
  --wp-phone-ink         : #3a2f25
  --wp-phone-ink-soft    : #7a6a55
  --wp-phone-accent      : <Scene.palette.accent, fallback #c46b4a>
  --wp-phone-accent-ink  : #fff7f0
  --wp-phone-hairline    : rgba(120,100,70,.18)

MOTION
  --wp-phone-ease        : cubic-bezier(.22,1,.36,1)   /* the spring-out */
  --wp-phone-ease-in     : cubic-bezier(.4,0,.9,.4)
  --wp-phone-t-open      : .42s        /* device rise/scale on open */
  --wp-phone-t-app       : .30s        /* app push/pop transition */

RADII / ELEV (icon tiles, cards)
  --wp-r-tile            : 22px         /* iOS squircle-ish app icon */
  --wp-r-card            : 18px
  --wp-e-tile            : 0 6px 16px rgba(58,47,37,.18), inset 0 1px 0 rgba(255,255,255,.5)
```

The **accent is the world's accent** (`Scene.palette.accent`), so the phone tints
with the district you're in — a quiet, premium touch that ties device to world.

---

## §3. MOTION — the phone should feel ALIVE

A real device's joy is in its transitions. Three motions, all **compositor-only**
(transform/opacity), so we never threaten the 60 FPS Babylon baseline.

1. **Open / Close** (`--wp-phone-t-open`): the device **rises + scales** from the FAB
   corner. `transform: translateY(8%) scale(.92); opacity:.4 → translateY(0) scale(1);
   opacity:1`, eased with `--wp-phone-ease`. The scrim cross-fades. Transform-origin is
   the bottom-inline-end (the FAB corner) so it grows OUT of the launcher — the iOS
   "app opens from its icon" feel, applied to the whole device.
2. **App push / pop** (`--wp-phone-t-app`): opening an app SLIDES the new screen in
   from the inline-end (+12% → 0, opacity 0→1) while the springboard slides out to
   the inline-start (0 → −6%, opacity 1→0) and dims. Back/home reverses it. This is
   the iOS nav-push. Two layers cross-fade inside the screen clip; the device is
   static. RTL mirrors direction via logical sign.
3. **Icon press** (micro-interaction): `:active` scales the tile to `.93` with the
   spring ease (already present) PLUS a soft inner-shadow "press". On release it
   springs back. Cheap, but it's the haptic-feeling detail the owner asked for.

`prefers-reduced-motion`: all three collapse to a ≤.18s opacity fade, no transform.

---

## §4. FORM FACTORS — tablet/desktop vs. a REAL phone

Tablet + desktop are **first-class** (project rule): they show the full device frame,
right-anchored, big. That's the hero experience and where the "iOS Simulator" line
comes from.

On an **actual phone** running the game, a phone-frame-inside-a-phone is absurd. We
adapt — the device frame *dissolves*, but the phone's *OS chrome* stays so it still
reads as "my city phone took over":

| | Phone (`<720w`) | Tablet (`720–1023`) | Desktop (`≥1024`) |
|---|---|---|---|
| Bezel | 3px hairline | 10px | 12px |
| Outer radius | top corners only (sheet) | 40px | 44px |
| Anchor | full-width bottom-sheet, ~6% top inset | right, bottom-biased | right, centered |
| Size | fills width; height = `92svh` (still FIXED, content scrolls) | `clamp(520, vh−32, 880)` tall | `clamp(560, vh−48, 920)` tall |
| Status bar | shown (game-phone OS chrome) | shown | shown |
| Open motion | rise from bottom (sheet) | grow from FAB corner | grow from FAB corner |

**Crucially, even the phone form factor keeps the constant-size invariant:** the
sheet height is `92svh` and FIXED for the session-open; apps scroll inside it; it
does not grow/shrink per app. The bottom-sheet drag handle == the home indicator.

A note on the real-phone bezel: we keep a *thin* one (3px) + the rounded top so the
sheet still reads as "a device surface," not a raw modal — but it never wastes the
precious phone width on a fake chrome border.

---

## §5. THE SPRINGBOARD (home screen) + ICON LANGUAGE

### 5.1 Layout

```
  ┌─ screen ──────────────────────────────┐
  │  9:41         ●●●● 5G          ▮▮▮▯    │  status bar
  │                                        │
  │   Corpán·mark   Corpan City      ⌕ ⚙  │  home top-bar (wordmark + actions)
  │                                        │
  │   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
  │   │  🗺  │ │  🎒  │ │  📍  │ │  🎖  │ │   4-up grid (phone-in-tablet)
  │   └──────┘ └──────┘ └──────┘ └──────┘ │
  │     Map     Things   Quest   Badges    │
  │                                        │
  │   ┌──────┐                             │
  │   │  🎵  │                             │
  │   └──────┘                             │
  │     Music                              │
  │                                        │
  │   ┌──────────────────────────────────┐ │
  │   │ ▸ Find the café  ·  2 of 3 done  │ │  OBJECTIVE WIDGET (taps → Quest app)
  │   └──────────────────────────────────┘ │
  │                                        │
  │   ⎋ Leave the Plaza                    │  quiet exit row
  │              ▁▁▁▁▁▁                     │  home indicator
  └────────────────────────────────────────┘
```

- **Grid**: `repeat(4, 1fr)` columns, fixed-size tiles. On a narrow desktop device
  (~258w) it may drop to 3-up via a container query; the grid centers, the frame
  doesn't change. Tiles are a fixed px size (`~62px` icon + label), NOT `1fr` of a
  growing card.
- **Objective widget** (NEW, premium): a pinned "what now" card reading the active
  quest's title + progress, tappable → opens the Quest app. This is the iOS-widget
  touch that makes the home screen feel *yours*. Hidden if no active quest.
- **Leave the Plaza**: stays, but quieter — a small text row above the home
  indicator, not a big pill.

### 5.2 Icon language — BEAUTIFUL app icons (not line glyphs on paper)

Today's icons are thin monochrome strokes on a near-white tile. That reads as a
wireframe, not an app. The new icon system, per the brief ("beautiful app icons"):

- Each icon is a **filled, two-tone squircle tile** with its OWN gradient wash (a
  per-app hue), a soft inner highlight, and a crisp white-knockout glyph — the
  visual language of a real home screen. Tiles are `--wp-r-tile` (22px) squircles.
- Per-app palettes (warm, cohesive with the paper world, NOT candy):

  | App | Tile gradient | Glyph |
  |---|---|---|
  | Map | sage → teal (`#7fae8c → #4f8f86`) | folded map, white |
  | Things | tan → ochre (`#caa15a → #a9762e`) | satchel, white |
  | Quest | terracotta → rust (accent) | waypoint pin, white |
  | Badges | gold → bronze (`#d8b24a → #9c7a2a`) | rosette, white |
  | Music | brand terracotta, carries the **Corpán mark** | brand mark |

- Each glyph is an inline SVG (crisp at any DPR, RTL-safe, theme-able), painted
  white on the gradient. The Music tile keeps the **Corpán brand mark** (it's the
  signature app), now on a richer terracotta wash with the glossy tile treatment.
- Icons get a faint top specular and a 1px inner hairline so they sit *on* the
  paper like real iOS icons (depth, not flat).

> Design intent: open the phone and the home screen should make you smile — five
> jewel-like app tiles on warm paper, a live clock up top, your quest pinned below.
> That first impression is 80% of "epic."

---

## §6. THE MAPS APP — make it feel like a REAL Maps app

The brief calls this out specifically: *"The Map app must feel like a REAL Maps app
— roomier, more features: smooth pan/zoom, labeled pins by category, search/filter,
recenter on me, directions/route to the active objective, maybe layers."* Today it's
a competent static-ish schematic in a small drawer. Inside the new full-height device
screen it has room to BREATHE. The renderer (`src/map/fullMap.ts`) already has
pan/zoom/pinch + categorized markers + a legend + wayfinding — strong bones. We
elevate it into a Maps *app*, not a map *panel*:

```
  ┌─ Map app (fills the device screen) ───────────────────┐
  │  ‹  Map                                            ✕   │  app top-bar
  │  ┌──────────────────────────────────────────────────┐ │
  │  │ ⌕  Search the city…                              │ │  SEARCH BAR (filter pins)
  │  └──────────────────────────────────────────────────┘ │
  │  [ All ][ Shops ][ Transit ][ Food ][ People ]  ‹scroll› │  CATEGORY CHIPS (filter)
  │  ┌──────────────────────────────────────────────────┐ │
  │  │                                                  │ │
  │  │            (big canvas map — pan/zoom)           │ │
  │  │        labeled pins · YOU · objective route      │ │
  │  │                                            ⊕     │ │  RECENTER-ON-ME button
  │  │                                            +     │ │  zoom +
  │  │                                            −     │ │  zoom −
  │  └──────────────────────────────────────────────────┘ │
  │  ┌──────────────────────────────────────────────────┐ │
  │  │ ▸ Route to: The Café   ·  ~120m   ·  [ Go ]      │ │  DIRECTIONS STRIP (objective)
  │  └──────────────────────────────────────────────────┘ │
  │              ▁▁▁▁▁▁                                     │  home indicator
  └────────────────────────────────────────────────────────┘
```

New / elevated features (additive to `fullMap.ts`; keep its seam):

1. **Search bar** — a text field that filters the labeled POIs live; matching pins
   stay bright, others dim; the map can fly-to a chosen result. Localized
   placeholder. (`map.search.placeholder`)
2. **Category filter chips** — a horizontal, scrollable chip row (All / Shops /
   Transit / Food / People / Landmarks) derived from the existing `PoiCategory`
   buckets + `LEGEND_ORDER`. Tapping a chip filters which pins/labels draw. Replaces
   the static legend with an *interactive* one (the legend's color-coding moves into
   the chips). RTL-safe horizontal scroll.
3. **Recenter-on-me** — a ⊕ button that animates the pan/zoom back to the player
   (resets `panX/panZ` to the player's live world pos, zoom to a sensible default).
   Sits with the +/− zoom stack.
4. **Directions / route strip** — when there's an active objective, a bottom strip
   shows "Route to {place} · ~{dist}" with a **Go** affordance that flies the camera
   to frame player→objective and emphasizes the existing dashed wayfinding leader.
   Distance is the world-space straight-line (cheap, honest "~").
5. **Layers (stretch)** — a small layers button toggling, e.g., "Transit only" or a
   district tint. Optional in v1; the chip row covers most of this need.
6. **Roomier canvas** — the map fills the device screen minus the search/chip header
   and the directions strip, so it's a genuine map view, not a thumbnail.

The map stays a **pure consumer of the `MapView` bundle** — no new data coupling.
All additions are UI/interaction on top of the existing projection + draw calls.

---

## §7. PER-APP POLISH (Things, Quest, Badges, Music)

These reuse the existing `MenuSectionView` renderers via `createSectionApp` — we do
NOT rebuild their internals. We give them the device screen's room + a consistent
**app scaffold**: a tidy app top-bar, generous content padding, section headers in
the eyebrow style, and the paper-card list treatment. The polish is mostly the
*frame + spacing + typography rhythm* the device provides, plus per-app accents.

- **Things (Inventory)** — full-height list of paper item cards; the wallet/currency
  row becomes a pinned header strip at the top of the screen (doesn't scroll away).
  Wardrobe entry reads as a featured card. Generous 16px gutters.
- **Quest** — the active quest as a hero card (title, the step checklist with done
  ticks, the reward), then the switch/abandon affordance below. The objective widget
  on the home screen mirrors this.
- **Badges** — the badge case as a 3-up grid of rosette tiles inside the screen,
  earned ones in full color, locked ones embossed-gray. Tap → a detail line.
- **Music** — already the most "app-like." Keep the consent switch, now-playing card,
  big transport, volume, station browser — just re-housed in the full screen with
  album-art-sized now-playing artwork (the Corpán mark on a tinted card) so it reads
  like a real Now Playing screen.

All four keep their lazy re-localization (read live locale on each open) and their
RTL behavior. None of them drive the device size — they scroll inside it.

---

## §8. i18n / RTL / single-language — the rules workers MUST honor

- **New strings**: add to the `en` source dict AND the `I18nKey` union in
  `src/i18n/strings.ts` ONLY. Do **not** run `tools/gen_i18n.py` — the orchestrator
  runs the 46-lang gen as one pass. Author clean, literal English source values.
  New keys this design introduces (final list lives in the worker specs):
  `phone.home.city` ("Corpan City"), `phone.status.*` (if any are text), `phone.go`
  (home-indicator/home aria), `phone.objective.widget` ("{title} · {done} of {total}"),
  `map.search.placeholder`, `map.filter.{all,shops,transit,food,people,landmarks}`,
  `map.recenter`, `map.route` ("Route to {place}"), `map.route.distance` ("~{dist}"),
  `map.route.go`.
- **RTL**: everything uses logical properties (`inset-inline-*`, `margin-inline-*`)
  and the existing root `dir="rtl"`. The device anchors to the inline-END corner so
  in RTL it sits bottom-LEFT, mirroring the FAB. App push/pop direction flips by
  logical sign. The back chevron + map directions arrow mirror. Verify `?dir=rtl`.
- **Single-language stack**: the phone is content-agnostic; nothing here gates on a
  target language. The Map/objective features degrade gracefully when there's no
  active objective (no directions strip) — already the pattern.

---

## §9. HARD CONSTRAINTS (don't regress what shipped)

1. **DOM overlay, compositor-only, no layout shift.** The device is `position: fixed`
   inside `.wp-overlay` (NEVER `document.body` — the M0 host-clip lesson),
   `contain: layout size style`, open/close + app transitions are transform/opacity
   ONLY. It must never push the Babylon canvas or threaten `wp-60fps-baseline`.
2. **Reuse the seams.** `createPhoneSheet` keeps its `PhoneSheetOptions` shape and the
   `PhoneApp` contract (`phoneApp.ts`); the FAB stays the Corpán-mark `createPhoneFab`;
   section apps still flow through `createSectionApp`. We re-skin/re-frame the SHELL,
   we don't rebuild the section renderers' internals.
3. **No `window.confirm/alert/prompt`** (no-op in WKWebView). In-pack DOM only.
4. **Noisy errors** — every `catch` logs visibly (`[wp/phone] …`).
5. **Pointer-swallow** stays so the dual-joystick layer can't steal device taps.
6. **Escape stack** stays: in-app → home → close.
7. **Verify visually** at phone / tablet / desktop + RTL via `__verify__` before
   declaring done; the constant-size assertion is the gate.

---

## §10. WORK BREAKDOWN (disjoint-by-file worker specs)

Frozen contract so workers don't collide. Each owns disjoint files. The
**device-frame worker lands FIRST** (defines the frame + tokens + the invariant
test); the rest build on the frozen `.wp-dev-*` tokens + screen rectangle.

### Worker A — Device frame + fixed viewport (FOUNDATION, lands first)
- **Owns:** `src/shell/phone/phoneSheet.ts` (frame DOM: device → status bar → top-bar
  → body → home indicator), `src/shell/phone/phone.css` (the `.wp-dev-*` tokens +
  device/screen/status-bar/home-bar CSS + the form-factor sizing + the open/close +
  app push/pop transitions), `src/shell/phone/statusBar.ts` (NEW — clock/signal/batt),
  `src/shell/phone/__verify__/shot.mjs` (+ the **constant-size assertion**).
- **Delivers:** the constant-size invariant (§1), the device anatomy (§2), motion
  (§3), form factors (§4). The springboard region is laid out but its icon-tile
  visuals are Worker B's.
- **Freezes for others:** the `--wp-dev-*` tokens, the screen rectangle, the
  `.wp-phone-screen` / `.wp-phone-body` class names, the app-stage push/pop hooks.

### Worker B — Springboard + icon language
- **Owns:** `src/shell/phone/springboard.ts` (NEW — the home grid + objective widget +
  leave row, extracted from `renderHome`), `src/shell/phone/appIcons.ts` (NEW — the
  filled two-tone squircle icon set + per-app palettes, replacing the line glyphs in
  `sectionApp.ts`'s `APP_ICONS`), the home-screen CSS block (a clearly-fenced section
  in `phone.css` Worker A leaves for B, OR a co-located `springboard.css`).
- **Delivers:** §5 (springboard layout + beautiful icons + objective widget).
- **Consumes:** Worker A's screen rectangle + tokens.

### Worker C — Maps app elevation
- **Owns:** `src/map/fullMap.ts` (additive: search bar, category chips, recenter,
  directions strip), `src/map/mapStyles.ts` (new chrome styles), new `I18nKey`s in the
  `map.*` namespace (en source only). Round-1 wp-map work is done/idle, so this file
  is free.
- **Delivers:** §6. Pure-consumer of `MapView`; no data coupling.
- **Consumes:** Worker A's screen rectangle (the map fills the device screen).

### Worker D — Per-app polish (Things / Quest / Badges / Music re-housing)
- **Owns:** `src/shell/phone/musicApp.ts` (Now-Playing artwork treatment), the
  app-scaffold CSS for the section apps (a fenced block), and any small adapter in
  `sectionApp.ts` for the pinned-header pattern (wallet strip, quest hero). Does NOT
  touch the section renderers' internals.
- **Delivers:** §7.
- **Consumes:** Worker A + B tokens/scaffold.

> Ordering: A → (B, C, D in parallel). A's frozen tokens + screen rect are the
> contract. The phone-design lead integrates B/C/D branches onto A.

---

## §11. ACCEPTANCE — what "epic" means, measurably

- [ ] **Constant size:** `.wp-phone-device` rect is byte-identical across home + all
      5 apps + Music-on/off (the `shot.mjs` assertion is green).
- [ ] Reads as a **device**: bezel, status bar with live clock, home indicator —
      a screenshot is unmistakably "a phone," not "a drawer."
- [ ] **Right-anchored + big** on desktop (≥800px-tall device hugging the right) and
      tablet; **full-bleed-sheet** + thin chrome on a real phone — all three shot.
- [ ] **Maps app** shows search + category chips + recenter + a directions strip to
      the objective; pan/zoom smooth; roomy canvas.
- [ ] **Springboard** shows five jewel-tile app icons + the objective widget; app
      open/close uses the push/pop transition; icon press springs.
- [ ] RTL mirrored (device on the inline-end → bottom-left), back/arrow flipped.
- [ ] 60 FPS untouched (transform/opacity only; no canvas push); single-language safe;
      no window dialogs; noisy errors.

---

### Appendix — current state (what we're replacing)

Captured baseline screenshots in `/tmp/wp-phone-{home,app-things,desktop-music,
tablet-home}.png`: a content-sized paper drawer, bottom-right on desktop, that is a
DIFFERENT height for Things vs. Music — the exact resize the owner is calling out.
The frame below is what we build instead.
