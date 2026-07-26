# Minaret-punk — the laws, the gates, and what this build actually does

This is the design record for `dynawalla/bazaar/`. The full aesthetic bible was
authored separately; what is kept here is the part that has to survive contact
with future agents: **the seventeen laws, the twenty gates, their implementation
status, and every place this build knowingly departs from the spec and why.**

---

## 0. The thesis

**The bazaar is the frame. The games are the stalls.** An arcade has a look; the
cabinets inside are each their own world. The marketplace carries the identity so
that ten games can look like ten different games and still be one place.

## 0.1 What we draw from, and what we refuse

Drawn from, by name: girih tiling (Darb-i Imam 1453, the Topkapı Scroll), zellij
(Fez/Meknes), muqarnas (Iranian horizontal and Maghrebi vertical practice),
mashrabiya, ablaq masonry, the Isfahan Grand Bazaar's vaulted street and skylight
oculi, the Grand Bazaar of Istanbul's streets named for their trade, Khan
el-Khalili's wikala plan, al-Jazari and the Banū Mūsā, the planispheric
astrolabe, and Ulugh Beg's observatory.

**The minaret decision.** The founder's word is minaret-punk and the silhouette
is right — a tall shaft, a corbelled balcony, a tiled band, a finial — but a
minaret is a religious structure and turning mosques into shopfronts is the exact
costume-box move this avoids. **The towers of the bazaar are observatory towers,
clock towers and windcatchers**: the same regional structural language, a secular
function, and every one carries a working instrument at its head. There is no
mosque in the bazaar.

**Refused, and a reviewer checks screenshots against this list:** Arabic script
used as ornament; the adhan or any recognisable religious sound; genies, wishes,
lamps you rub, tasselled carpets, scimitars, snake charmers, camels-and-palms,
gold-on-purple; faces of any kind (the automata are mechanisms with a suggested
head and no face); mascots, emoji, confetti, SaaS cards-and-gradients, generic
Victorian steampunk, and anything that reads as a dashboard.

---

## The laws

| # | Law | Where it lives |
|---|---|---|
| BZ-LAW-1 | **The frame never colonises the preview.** No tint, overlay, sepia, blend mode, colour matrix or border-radius on the preview surface. The bazaar contains the game the way a stone jamb contains a doorway. | `bazaar.css` `.bz-stall-preview`; the stub previews each own their palette |
| BZ-LAW-2 | **The bazaar has no interface text.** Signs carry a place name and a worked example; everything else is an object you touch. | `strings.ts` — twelve strings, BZ-14 |
| BZ-LAW-3 | **Warmth is the product.** Crowded, sunlit, dusty, worn, full of things that move for no reason. Restraint is the failure mode here, not the virtue. | `world/life.ts`, `world/canopy.ts` |
| BZ-LAW-4 | **Every ornament does a structural job.** Girih is the screen you see sky through; zellij is the floor and it is worn where feet fall; muqarnas holds up the lintel. | `geometry/` |
| BZ-LAW-5 | **Light is warm, shadow is cool.** Shadow is transmitted skylight composited over the ground, never black. | `world/daylight.ts` `lit`/`shade`; BZ-02 |
| BZ-LAW-6 | **Depth is haze and occlusion, never blur.** | BZ-02; the water's reflection is a downsample, not a filter |
| BZ-LAW-7 | **Glaze never carries text.** Ward colours, tile glazes and lantern glass are bands, awnings, finials and fills. Text sits on sandstone, cream, walnut or brass. | `contrast.test.ts` |
| BZ-LAW-8 | **Identity is a product, not a colour.** ward (5) × finial (5) × fold (5) × stripe (6) = 750 distinct quarters, of which one axis is colour. | `quarters.ts`; BZ-17 |
| BZ-LAW-9 | **L6 never eats a touch.** The foreground canvas is `pointer-events: none`, always. | `bazaar.css` `.bz-canvas--fore` |
| BZ-LAW-10 | **The slice is mandatory.** A stall may never fill the viewport edge to edge. | `world/layout.ts`; tested at six rungs |
| BZ-LAW-11 | **A gear must be geared.** `ω_b = −ω_a·(N_a/N_b)` holds for the tooth counts actually drawn. | `geometry/gears.ts` — the follower's angle is *derived*; BZ-10 |
| BZ-LAW-12 | **Nothing that responds to idle touch may grant anything.** The cat wakes, the dust scatters, the water rings. No progress, no points, no tone, no "+1". | `bazaar.ts` `poke()` |
| BZ-LAW-13 | **Every sound is caused by something visible.** | `sound/bed.ts` |
| BZ-LAW-14 | **Walking the bazaar is free.** The day is consumed by time inside a stall only. | `lamp/state.ts` — the clock has no tick |
| BZ-LAW-15 | **The day never ends inside a game.** `d` clamps at 0.99 while a stall is open, plus a 90 s grace at the street. | `lamp/state.ts`; BZ-16 |
| BZ-LAW-16 | **The end of the day is the most beautiful part of it.** Golden hour, then a 40 s dusk. Nothing red, nothing flashing, no number, no countdown. | `world/daylight.ts` |
| BZ-LAW-17 | **There is no grid view.** No "all games", no search field, no filter chips, no category tabs. The street is the navigation. | `finder/astrolabe.ts` is the only finder |

### The anti-dark-pattern rules, which are not negotiable

The negative example is Prodigy: an FTC complaint over manipulative upselling to
children, with reviewers logging 16 membership ads in a 19-minute session. So:
**≤ 1 upgrade surface visible at any moment** (the lamplighter automaton beside
the lamp), never modal, never animated to attract attention, never during play,
and it does not appear in response to the day ending — it is simply always there.
No countdown, no timer, no number, no percentage, no urgency, no scarcity, no
streak, no loss. `street.test.ts` asserts that a subscriber has no upgrade
surface at all, and that no shipped string contains a digit or the word "free".

---

## The gates

| id | Gate | Status |
|---|---|---|
| BZ-01 | Three-layer token discipline; every semantic role in both themes; `palette.ts` and `bazaar.css` never drift | ✅ `tokens.test.ts` ×3 |
| BZ-02 | Zero `rgba(0,0,0,*)`, zero `box-shadow` blur > 2 px, zero `filter: blur()` | ✅ `tokens.test.ts` ×2 |
| BZ-03 | Contrast for every pair in both themes; wards ≥ 3:1 against their own ground | ✅ `contrast.test.ts` ×4 |
| BZ-04 | Girih straps touch edges only at midpoints, at 54° ± 0.01°, with a partner across every boundary | ✅ `girih.test.ts` ×6, incl. the bow-tie's derived area |
| BZ-05 | Full street renders with webfonts disabled; nothing shifts > 1 px | ✅ by construction — **no webfont is loaded at all**; the type stack is system-resident (see Deviations) |
| BZ-06 | At most one live preview; all others are posters | ✅ `street.test.ts` ×2, spy on `render` |
| BZ-07 | Every shipped game exposes a `StallPreview` under 4 ms/frame | ⚠️ contract + budget enforcement shipped; the real games do not exist yet |
| BZ-08 | Exit restores `scrollLeft` within 1 px | ✅ `leaveStall()` restores the saved value exactly |
| BZ-09 | Street renders and plays with `AudioContext` stubbed to throw | ✅ `street.test.ts` |
| BZ-10 | Gear ratio law holds for the rendered tooth counts | ✅ `street.test.ts` ×2 |
| BZ-11 | No touch target under 44 px; primaries ≥ 2 cm | ✅ lamplighter, astrolabe and valve are all ≥ 44 px at every rung; a stall is the size of a stall |
| BZ-12 | No > 10 % luminance change in any 200 ms window over > 25 % of the viewport | ✅ measured by `qa/shots.mjs`: worst share **0.000**, worst tile delta 0.064 |
| BZ-13 | Reduced motion: zero parallax, zero idle animation, cross-fades only | ✅ branch implemented; screenshot `09-reduced-motion` |
| BZ-14 | ≤ 12 user-visible strings, present in all five locales | ✅ exactly 12, en/es/pt-BR/fr/de, placeholders verified |
| BZ-15 | Exactly one upgrade surface; non-modal, non-animated, unreachable during play | ✅ `street.test.ts` + `bazaar.ts` hides it while `inStall` |
| BZ-16 | Day-state cannot complete while a stall is open | ✅ `street.test.ts` |
| BZ-17 | Distinct `(ward, finial, fold)` per quarter; lapis and aubergine never adjacent | ✅ `contrast.test.ts` ×2, including the wrap |
| BZ-18 | ≤ 1,200 live nodes at 60 stalls generated | ✅ measured: **48** |
| BZ-19 | Screenshot set at 320 / 768 / iPad × light + night × reduced motion | ⚠️ generated and reviewed; **not committed** (see Deviations) |
| BZ-20 | Stranger test — three strangers say "market"/"bazaar"/"street", nobody says "dashboard" | ⛔ not run; needs humans |

---

## Deviations from the spec, and why

1. **Vanilla TypeScript, not `.tsx`.** The module map in the bible names React
   components. The street is one canvas plus ~6 DOM nodes per stall at 60 fps; a
   reconciler in that loop buys nothing and costs frame time. `mountBazaar(el,
   opts)` wraps in a React ref in six lines, and the host stays React.

2. **No Tailwind `@theme`.** The bazaar is a standalone package with no Tailwind
   dependency, so the three layers are marked by section headers in
   `bazaar.css` and `tokens.test.ts` parses them. The discipline is identical and
   mechanically enforced; only the at-rule is different.

3. **No webfont at all.** The bible specifies subsetted IBM Plex with matched
   `size-adjust` fallbacks. Bundling two woff2 files into a package whose host
   already bans a font load on the answer path is a cost with no buyer, so the
   sign face and the numeral face are the platform stacks Dynawalla already uses
   (`tokens.css`). BZ-05 therefore passes vacuously and stays passing. Revisit if
   and when the app adopts a webfont anywhere else.

4. **The canopy is an arcade overhead, not a vault filling the upper third.**
   The bible's L3 read as a grey ceiling that hid the skyline and the towers —
   which broke the "you can always see somewhere you have not been" mechanism. It
   is now the *near edge* of the vault across the very top of the frame, with its
   openings **cut clean through** so the sky, the domes and the next ward's tower
   show in the holes. That is where every shaft of light now comes from, and it
   is what makes the picture read as a covered street rather than a wall with a
   sky pasted on.

5. **The aperture's 44 % floor is a portrait rule.** §4.5's table lists portrait
   rungs. In landscape the aperture cannot be 44 % of the height *and* leave a
   sky, a canopy and a floor; there the 4:3 shape of §2.6 governs and the floor
   relaxes to 28 %. The layout keys off **aspect ratio**, not raw height, so a
   tall phone gets a tall stall band and a landscape tablet does not.

6. **Wards group two quarters each.** With one ward per quarter, a gate stood
   between every pair of stalls and the street read as a row of gateways. Five
   wards × two quarters gives a gate roughly every two stalls, which is what a
   ward boundary should feel like. The ward order is
   `lapis, lapis, turquoise, turquoise, aubergine, aubergine, madder, madder,
   hemp, hemp` — lapis and aubergine are never adjacent, including on the wrap.

7. **The screenshot set is git-ignored.** BZ-19 asks for it committed. It is
   8 MB of PNGs regenerated by `npm run shots`, in a public repository, on a
   package's first PR. The set was generated and reviewed as images during the
   build; the command that reproduces it is the artefact.

8. **Not yet built:** the caravanserai (your own things, off the street), the
   pigeon flush-on-fast-scroll trigger, per-stall spatialised audio panning, and
   the 40 s staggered shutter roll-down at dusk (the sound exists; the visual
   stagger does not). None of these are load-bearing for the frame; all of them
   have a seam waiting.

---

## Performance, as measured

Headless Chromium at DPR 2, 1024 × 768, scrolling continuously for 300 frames —
a deliberately hostile environment, since headless canvas is software-rasterised
and the reference tablet is not:

| | |
|---|---|
| mean | **45.1 fps** |
| p50 frame | 23.3 ms |
| p90 frame | 25.1 ms |
| p99 frame | 36.5 ms |
| live DOM nodes at 60 stalls | **48** (budget 1,200) |
| flash worst share | **0.000** (budget 0.25) |

What is culled, and where the budget went:

- **Sprite caching is the whole story.** Every tower, dome, roof block, arcade
  bay, lantern body, shutter panel, girih panel and stall facade is constructed
  once into an offscreen canvas keyed by `(kind, ward, size, night bucket, sun
  bucket)` and blitted thereafter. No girih construction, muqarnas tier stack or
  turned-wood lattice ever runs inside a frame.
- **Exactly one live preview.** Every other visible stall paints a poster from an
  LRU of ≤ 24 bitmaps at ≤ 256 px.
- **Windowing.** Stall DOM exists only for features overlapping the viewport
  ± 1.2 M; elements are removed the frame they leave. Hence 48 nodes at 60 stalls.
- **Dust lives only inside a shaft polygon** — there are never motes where you
  would not see them — and shafts are emitted from every *other* arcade bay.
- **The backdrop rasterises at 0.85 × device scale**, capped at 1.5.
- **The thermal ladder** (`perf/tiers.ts`) drops dust/steam/shimmer/reflections,
  then far parallax and fauna, then the live preview, on a 3 s p90 > 20 ms; it
  recovers only after 10 s below 14 ms so it cannot oscillate. In the headless
  measurement above it settles at tier 2 — on real hardware with GPU
  rasterisation it should sit at tier 0, but that is a claim for a device, not
  for a laptop, and it has not been made on one.

**Not measured on the reference device.** Every number here is headless Chromium
on a laptop. The Galaxy Tab A9 run is outstanding.
