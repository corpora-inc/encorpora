# WORLD_FIX — embedded-render regressions from the Stage-3 perf rework

Teammate **world-fix** domain: `src/world/*` + `src/city/*`. The trunk rendered
FINE in headless standalone `:5174` but was BROKEN in the embedded Corpán app
(gray territory, no roads, invisible trees/scenery, some NPCs untalkable). These
were embedded-WebView-specific regressions — except §2 and §4, which reproduce in
standalone too (the integration agent wrongly called them headless artifacts).

All five are fixed below. Each fix lists **how to verify in the embedded app**.

---

## §1 — Façade worker → gray buildings (EMBEDDED-only)

**Symptom (owner's embedded console):**
`[world-plaza/facadePainter] worker error → main-thread fallback` +
`SyntaxError: Unexpected token '<'`. Buildings stayed GRAY.

**Cause.** `vite.config.ts` emitted the OffscreenCanvas façade painter
(`src/world/painter.worker.ts`) as a SEPARATE chunk file
(`/assets/painter.worker-*.js`). In the packaged IIFE pack the worker URL was
`new Worker(new URL("/assets/painter.worker-*.js", …))`. The embedded host's
`/packs` middleware does NOT serve that sibling file — it returns `index.html`
(a 404 fallback). The worker loaded HTML, hit `<` → `SyntaxError`. The
main-thread fallback existed but the building's blank-stucco prime was never
overpainted in some paths, so buildings read gray.

**Fix** (`src/world/facadePainter.ts`): import the worker via Vite
`?worker&inline` —
```ts
import PainterWorker from "./painter.worker?worker&inline"
…
worker = new PainterWorker()
```
This bundles the worker (and its `drawFacade` import) into a base64
`data:text/javascript;…` **Blob worker inlined into the main IIFE chunk** — NO
sibling file, so there is no URL for the host to mis-resolve. With
`worker.format: "iife"` it's a CLASSIC Blob worker (max WKWebView compat). Added
`src/vite-env.d.ts` (`/// <reference types="vite/client" />`) so `?worker&inline`
typechecks. The feature-detect + permanent main-thread fallback on any worker
error is unchanged, so a building is never left gray either way.

**Verify (embedded).** After the lead rebuilds `dist` + reopens the pack:
- Console must NOT show the `Unexpected token '<'` / worker-error line.
- `dist/app.js` contains `new Worker("data:text/javascript…")` and there is NO
  `dist/assets/painter.worker-*.js` file (confirmed in a temp build).
- Buildings show painted façades (windows/doors/stucco), not flat gray.

---

## §2 — Invisible props (`Vertex buffer is not big enough`) — ALSO standalone

**Symptom:** `glDrawElementsInstanced: Vertex buffer is not big enough` ×13+;
trees/benches/lamps/etc. invisible.

**Cause (proven headless).** `src/city/chunkMesh.ts` builds each chunk's props by
`master.clone()` of a city-lifetime prop master, then `thinInstanceSetBuffer`.
A Babylon `clone()` SHARES the master's `Geometry` (`geometry.applyToMesh`).
`thinInstanceSetBuffer("matrix", …)` writes the per-instance `world0..world3`
vertex buffers into that **shared geometry** (`Mesh.setVerticesBuffer` →
`_geometry.setVerticesBuffer`). With many chunks cloning the SAME master, each
chunk's instance buffer OVERWRITES the previous chunk's on the one shared
geometry — while each chunk keeps its OWN per-mesh `instancesCount`. A chunk then
draws N instances against a geometry whose `world*` buffer was last written by a
DIFFERENT chunk with fewer instances → the WebGL error, draw dropped → invisible.

Headless proof (NullEngine): two clones of one box, A set to 5 instances, B to 12
— both share geometry, the shared `world0` buffer ends up 192 floats (12 inst, B
wrote last); A's 5-instance draw reads the wrong-sized buffer.

**Fix** (`src/city/chunkMesh.ts`): `mesh.makeGeometryUnique()` immediately after
the clone, before thin-instancing. Each chunk clone gets its OWN geometry, so its
instance buffers can't be clobbered by a sibling chunk. Verified headless:
`world0` is then 80 floats (5 inst) and 192 floats (12 inst) on the two clones —
isolated and correctly sized. `makeGeometryUnique` PRESERVES the merged
MultiMaterial submeshes (verified: 2 submeshes + `MultiMaterial` survive), so
prop colors are unchanged. Only the cheap low-poly vertex data is duplicated;
materials stay shared/refcounted.

**Verify (standalone `:5174` AND embedded).** Trees/benches/lamps/barrels/etc.
render across the city; the `Vertex buffer is not big enough` spam is gone.

---

## §3 — Gray ground / no roads (EMBEDDED-only, a CASCADE)

**Cause.** The ground materials (`src/render/materials.ts`, consumed by
`src/city/cityGround.ts`) are fully PROCEDURAL `DynamicTexture` canvas paints with
roads BAKED INTO the one flat ground mesh (no overlay, no z-fight) — they have NO
external URL and paint fine in the embedded host. So "gray ground/no roads" was
NOT a material bug: it was a **build-loop cascade**. `src/city/stream.ts`'s
`drain()` stepped each chunk builder with NO error isolation. When a chunk's
build sub-step threw (the §1 worker path or the §2 instanced path), the exception
propagated out of the per-frame `update()` and KILLED the whole streaming loop —
so no chunks finished → the scene stayed at its gray clear color with no ground,
roads, or scenery.

**Fix** (`src/city/stream.ts`): wrap each `drain()` build step in try/catch.
Any throw is logged LOUDLY (repo rule — never silent) and the offending chunk is
dropped from the queue (+ its half-build disposed) so the REST of the city still
builds. One bad chunk can never blank the world again. (§1/§2 remove the throw
sources; this is the structural guard so a future throw can't cascade.)

**Verify (embedded).** Ground (cobble/flagstone/dirt/grass) + cobble roads render
around the player and stream in as you move; if any chunk ever fails you see a
single `chunk … build step threw → dropping it` log, not a blank world.

---

## §4 — Ambient extras swallow taps → some NPCs untalkable — ALSO standalone

**Cause.** The new ambient population layer (`src/city/population.ts`) creates
background strollers/stall-keepers via `createGroundedCutout` with
`pickTag: undefined`. But `src/render/cutout.ts` sets `plane.isPickable = true`
UNCONDITIONALLY — omitting the tag only drops the routing metadata; the plane
still INTERCEPTS the tap ray. An ambient figure standing between the player and a
real talkable crowd NPC swallowed the tap (pick hit the untagged plane, found no
`npc:` tag, engaged nobody) → "some NPCs can't be talked to". (`npcFocus.ts` is
proximity-based and reads only `crowd.focusables`, so the bug is purely the pick
ray, not the focus list.)

**Fix (interim, then SUPERSEDED — see §4d).** First pass set
`cut.pickMesh.isPickable = false` on ambient cutouts so they couldn't intercept
the tap. NOTE: investigation later showed `npcFocus` does NOT scene.pick by tag
at all — engagement is screen-space proximity to the projected focused NPC — so
the pickable plane wasn't the true blocker; the real near-field issue was density
(ghosts dominating) + the §3 cascade freezing the crowd. The `isPickable=false`
was REVERTED by §4d (strollers are pick targets now that they're talkable).

**Verify (standalone AND embedded).** Tapping a talkable NPC opens dialogue even
when ambient strollers crowd the foreground.

### §4d — NO un-interactable people (owner ruling) → lazy-promote strollers

**Ruling:** "I don't want NPCs that I can't interact with." Every figure that
reads as a PERSON must be walk-up-and-talkable. So §4/§4a/§4b (non-pickable, soft
yield, density rebalance) were the wrong frame — ambient strollers can't stay as
mute background extras at all.

**Route taken: 1 — lazy-promote (protects the 123MB/no-hitch baseline).** Route 2
(densify the real crowd) was rejected: crowd agents are heavy (per-agent generated
persona + a per-frame animator that repaints the texture), which is the exact cost
`population.ts` exists to avoid. Promotion keeps the cheap immutable half-res
billboards and adds talkability for ~zero cost:

- Every stroller AND stall-keeper now exposes a `CrowdFocusHandle` via a new
  `population.focusables`, which game.ts merges into the SAME `npcFocus` list as
  the crowd — proximity focus + the Talk button + dialogue all work on them.
- The expensive `generatePersona` is a **LAZY, cached getter** on `handle.role`:
  built only the first time it's read (i.e. on engage), so an un-talked-to figure
  costs nothing beyond its billboard. Stable `npcId` per pool slot
  (`ambient:<seed>:stroller:<i>`) → a recycled figure stays the same person and
  routes dialogue consistently. Verified headless: the persona is a valid, named,
  deterministic `NpcRole` (`npcRuntime.open`-ready).
- Cutouts are real pick targets again (`pickTag: npc:<npcId>`, pickable) — the §4
  `isPickable=false` is reversed. (The dialogue portrait is initials + text, not a
  rendered face, so the half-res world billboard never appears up close — no
  quality concern from making them talkable.)
- **Disabled figures can't be focused:** an asleep stroller / unbound keeper is
  parked `FAR_AWAY` (1e6) so it's never the nearest-in-range target until enabled
  (npcFocus reads the live handle position; a disabled cutout keeps its last
  position, and an unbound keeper would otherwise sit focusable near spawn).
- **Held = freeze:** new `population.setHeld(npcId|null)` (mirrors `crowd.setHeld`)
  freezes the engaged figure so it waits instead of wandering/recycling mid-chat
  (and a held keeper is never released). Unknown id = no-op, so game.ts can call
  BOTH `crowd.setHeld` and `population.setHeld`.
- §5 (forward-cone spawn + fade-in) and §4b (soft player yield) are preserved.

**game.ts wiring needed (outside this domain):**
1. `createPopulation(world.scene, { …, scene: activeScene })` — pass the content
   scene so personas get scene flavour (absent → neutral, still talkable).
2. Merge the focus lists:
   `createNpcFocus(world, overlay, [...crowd.focusables, ...population.focusables], onEngage, onFocusChange)`.
3. In `onFocusChange`/engage + release, call `population.setHeld(it?.anchorId ?? null)`
   alongside `crowd.setHeld(...)` (both are safe no-ops for the other's ids).

**Verify (standalone `:5174`).** Walk up to ANY ambient stroller or stall-keeper:
the Talk button rises and tapping it opens a real conversation (persona generated
on engage). No visible person is un-interactable; nothing pops into the forward
frustum (still cone-spawned + faded in).

### §4b — "crowd of ghosts": ambient extras dominated the near-field

Follow-up from the owner: even with §4's pick fix, the near-field was DOMINATED
by non-talkable strollers, so the player kept trying to talk to figures that
can't respond. Two within-domain fixes in `src/city/population.ts`:

- **Soft player yield.** A stroller now keeps ≥ `PLAYER_BODY_GAP` (1.0u) from the
  player every frame — it gently steps aside instead of letting you phase
  straight THROUGH it. Applies whether moving, idling, or in reduced-motion (it's
  a position correction, not an animation). These movers are NOT in the static
  streaming obstacle field (rebuilding it per frame for dynamic figures would be
  wrong), so this mutual yield is the right "solid body" model — it mirrors
  `crowd.ts` BODY_GAP so ambient + talkable figures feel identical to walk among.
  A true player-HARD-block on strollers would need a player-controller seam,
  outside this domain — flagged to the lead if the soft yield isn't solid enough.
- **Density rebalance.** `maxStrollers` default 12 → 8, so ambient extras
  COMPLEMENT the ~28 talkable crowd agents rather than outnumber them in the
  near-field. (The crowd `count` is a `game.ts` param, outside this domain;
  raising near-field talkable density further is the lead's call.)

### §4c — focus-sync verified (owner's "render ≠ logical position" hypothesis)

Checked and SOUND — no desync to fix. `crowd.ts:744` does
`a.cutout.setGroundPos(a.x, a.z)`; the focus handle (`crowd.ts:468`) reads
`cut.root.position` — the SAME live `Vector3`. `setGroundPos` (cutout.ts:222)
assigns `root.position.x/z` DIRECTLY (no lerp/smoothing/offset), and the visible
billboard is parented root→body→plane with only a Y-lift, so the plane's absolute
X/Z equals root X/Z. `npcFocus` matches on X/Z proximity (RANGE 4.0u). So walking
to where an NPC RENDERS focuses it; render + logical positions are one object.
(A headless render-assert is blocked by the node test env lacking
`OffscreenCanvas`, but the shared-Vector3 + direct-assign path is unambiguous.)

---

## §5 — NPC / ambient pop-in (figures appear in front of you)

**Cause.** `src/city/population.ts` woke/respawned strollers in a ring
`[wakeR*0.4, wakeR]` around the player with NO regard for the view frustum, so a
figure could materialize directly in front of the camera. Stall-keepers likewise
snapped to full opacity on bind.

**Fix** (`src/city/population.ts`):
1. **Spawn outside the forward view cone.** `pickNear` now takes an optional
   `avoidFwd` bearing; when set it keeps the sampled spawn bearing OUT of a ~140°
   front arc (reflects forward-cone hits into the rear/side 220°). Fed by a new
   optional `getForward(): {x,z}` on `PopulationOptions` (the camera's ground
   heading). `getForward` is wired in `game.ts` (NOT this domain) — absent it
   degrades gracefully and the fade-in below still hides the appearance.
2. **Fade-in.** A woken stroller / bound stall-keeper starts at
   `pickMesh.visibility = 0` and ramps to 1 over `FADE_IN` (0.5 s), so even an
   edge-of-view spawn eases in rather than popping.

**Verify (standalone AND embedded).** Walk around; ambient figures ease in
behind/beside you, none snap into existence in the center of view. With
`getForward` wired, spawns are also positionally kept out of the forward arc.

---

## §6 — Façade: window panes painted over / crowding the door

**Cause** (`src/world/facadePaint.ts`, `drawFacade`). The door is centred on the
WALL (`doorX = (W - doorW)/2`), but the window grid only skipped ONE hard-coded
cell, `doorCol = floor(cols/2)`, in the BOTTOM row. Two failures:
- **Even `cols`:** the door sits on the boundary BETWEEN columns `cols/2−1` and
  `cols/2`, so it overlaps both — but only one was skipped → a window crowded the
  doorway.
- **Tall door:** `doorH` can be up to `1.7×` a row span, so the door rises into
  the row ABOVE the bottom, where NO cell was skipped → windows over-painted the
  door's upper part. (And `drawDoor`'s stone surround + `drawWindow`'s flanking
  shutters extend beyond their nominal boxes, so even a "skipped" cell could graze.)

**Fix.** Compute the door's real painted footprint (stone surround out to
`[doorX−0.12·doorW, doorX+1.12·doorW]`, top at `doorY−0.04·doorH`) plus a clear
margin, then skip ANY window whose painted span — widened to include its shutters
(`[cellX−0.18·winW, cellX+1.08·winW]`) — overlaps that box horizontally AND whose
bottom reaches into the door's vertical extent. This is a real overlap test across
ALL rows/cols, so the door stays clear on every building width (even/odd cols) and
height (tall doors). Verified headless: a 96-case sweep (cols 1–6, storeys 1–4,
W 180–512, all 6 building kinds) — zero window-like shape overlaps the door box.

**Verify (standalone AND embedded).** No window pane is painted on or crowding the
doorway on any building.

---

## Files changed (this domain only)

- `src/world/facadePainter.ts` — inline the painter worker (Blob) — §1
- `src/vite-env.d.ts` (new) — `vite/client` types for `?worker&inline` — §1
- `src/city/chunkMesh.ts` — `makeGeometryUnique()` on prop clones — §2
- `src/city/stream.ts` — try/catch isolation in `drain()` — §3
- `src/city/population.ts` — §4d lazy-promote strollers to talkable (focusables +
  lazy persona + setHeld); §5 forward-cone spawn + fade-in; §4b soft player yield
- `src/world/facadePaint.ts` — door keep-out for the window grid — §6
- `src/city/cityGround.ts` — ground-quad winding flip (gray-ground/no-roads) — §8
- `src/world/props3d.ts` — water-trough readability + de-flicker — §9
- `src/map/mapCore.ts` — `headingVec` sign flip (map pointer inversion) — §10
- `src/city/population.ts` — local-meander wander + player keepout (no crowding) — §11
- `src/world/crowd.ts` — wider `PLAYER_AVOID` (no crowding) — §11
- `src/world/engine.ts` — camera boom collision (no clip into buildings) — §12
- `src/world/cameraFade.ts` — roofs fade-eligible (no roof-interior view) — §12
- `src/contracts/runtime.ts` — `MapView.getMapGeometry?()` seam (map water/blockers) — §13
- `src/city/cityMapGeometry.ts` (new) — derive map water+blocker rects from CityLayout — §13
- `src/map/{mapCore,schematic,minimap}.ts` — render water + map-geometry blockers — §13
- `src/map/fullMap.ts` — full-map zoom (pinch + wheel + ± buttons + drag-pan) — §13
- `src/world/bridge.ts` (new) — real 3D stone arch bridge, water under it — §14
- `src/world/walkSurface.ts` (new) — per-scene raised-walk-surface registry (self-wires #40) — §15
- `src/world/bridge.ts` + `movement/controller.ts` + `world/crowd.ts` + `render/cutout.ts` — walk-surface height profile so the player + keeper walk OVER the deck (auto-wired via the registry) — §15
- `src/wayfinding/roadArrow.ts` — push the on-road arrow further ahead + lateral so the player billboard doesn't cover it — §16

## §15 — Bridge not WALKABLE: player walked UNDER the raised deck (urgent regression on §14)

§14 built a beautiful raised-deck (~y3) arch bridge, but the collision corridor is
FLAT at ground level (the 2D XZ obstacle field has no height), so the player walked
at y=0 UNDER the deck (clipping the arches) and the keeper NPC stood at the ground
anchor under the bridge — the "cross the bridge" quest was unwinnable. My §14 webkit
harness rendered the mesh but never tested player TRAVERSAL — the miss.

FIX — a walk-surface HEIGHT PROFILE sampled by movement:
- `bridge.ts` exposes `heightAt(x,z)` (+ `nearDeckY`): the deck/ramp top Y on the
  bridge footprint (near ramp 0→deck, cambered deck, far ramp deck→0), else 0. It's
  built from the SAME `deckTopAt`/ramp geometry as the mesh, so the collision
  surface can NEVER drift from the visual deck.
- `movement/controller.ts` takes an optional `getGroundHeight(x,z)`; each frame it
  lifts the player figure AND the camera target to that Y → you ride up + over the
  deck (water flows under) instead of clipping through it.
- `world/crowd.ts` takes the same sampler and lifts every agent at its 3 position
  sites → the keeper stationed at `bridge_n` now stands ON the deck, not under it.
- `render/cutout.ts` `setGroundPos(x,z,y?)` lifts the contact point + its welded
  shadow onto the deck (default y=0 → every existing call unchanged).
PROVEN: 5 unit tests on `heightAt` (a full crossing is a continuous rise→hump→fall,
never negative, peaks mid-river > deck height, ends at ground both banks) + a webkit
shot (`/tmp/wp-bridge-player-mid.png`) of a player capsule standing ON the deck at
midspan with water visible to either side flowing UNDER it.
SELF-WIRING — NO game.ts CHANGE NEEDED. The bridge REGISTERS its `heightAt` on a
per-scene walk-surface registry (`src/world/walkSurface.ts`) when built (and
deregisters on dispose). The controller + crowd, when given no explicit
`getGroundHeight`, fall back to `walkSurfaceHeight(scene, x, z)` — so the moment
`buildBridge` runs (game.ts already calls it), the player + keeper lift onto the
deck automatically. This deliberately avoids a manual game.ts wire, because
*forgetting that wire is exactly the regression* — the fix can't be left un-applied.
(An explicit `getGroundHeight` still overrides the registry if a caller wants it.)
Proven end-to-end (`walkSurface` test): before build → flat 0; after `buildBridge`
→ deck height over the span + at the keeper anchor, 0 beside/inland; after dispose
→ flat again; second scene isolated.

## §16 — On-road arrow hidden behind the player billboard

`wayfinding/roadArrow.ts` sat the marker `AHEAD=4.5`u straight along the player's
facing → the paper-doll billboard covered it from the follow-cam. FIX: `AHEAD` 4.5→7
+ a `LATERAL` 1.6u sideways nudge (along the right vector) so the figure never sits
on top of it. (#43.)

## §14 — River bridge: real 3D arch structure, water beneath (`src/world/bridge.ts`)

The crossing was a flat cobblestone road at water level ("a normal road coloured
blue by the water behind it"). `buildBridge` is a real premium stone ARCH bridge:
a cambered raised DECK (top ≈ y3.0, humped +0.7 at midspan) well above the
riverwalk water sheet (≈ y0.07) so water flows BENEATH; balustraded PARAPETS
(kerb + coping + balusters) down both sides; semicircular ARCH rings (fans of
tilted voussoir blocks) springing from PIERS that stand IN the river; and stone
APPROACH RAMPS rising from each bank onto the deck. Low emissive (0.16) + a wide
shade spread so the sun carves real masonry depth (a higher lift washed it flat —
same trap as the trough water). Pure additive set-dressing (own create+dispose),
like the fountain/riverwalk: it does NOT touch the streaming spine, collision, or
layout. The walkable corridor is already open in places' collision field
(`bridgeX`/`bridgeHalfW`) and quest-flow's traverse keys off the `bridge_n`
anchor, so the mesh just makes the crossing READ as a bridge. Coords from
`layout.water` (CityWater): deck spans `[bankZ, farPromZ]` over the river
`[waterZ, farBankZ]` at X=`bridgeX`, half-width `bridgeHalfW`. Verified webkit
(`qa/bridge.{html,ts}`): `/tmp/wp-bridge-3q.png` (arches + piers + water under),
`/tmp/wp-bridge-side.png` (cambered walkable deck + parapets + ramp). game.ts wire:
`buildBridge(world.scene, { x: cityWater.bridgeX, nearZ: cityWater.bankZ, farZ: cityWater.farPromZ, halfWidth: cityWater.bridgeHalfW, waterY: 0.07, palette: scene.palette })`.

## §8 — Gray ground / no roads = inverted ground-quad winding

See `docs/GROUND_INVESTIGATION.md` for the full hunt. Short version: the streaming
ground quads (`buildChunkGround`) were wound CW-from-above, so each quad's single
face pointed DOWN and back-face culling hid the WHOLE ground from every above-
ground camera → invisible ground, sky/clear-colour showing through as a flat
"gray plane, no roads". Buildings were fine (correct winding). FIX: wind CCW-from-
above — `indices.push(v, v+1, v+2, v, v+2, v+3)`. NOT a material/texture/PBR/fog
issue (all ruled out; a red unlit backface-off material drew zero pixels →
geometry-not-rendering, not gray-material). New harness `qa/cityground.{html,ts,mjs}`
exercises the REAL streaming `mountCity` ground under webkit (≈WKWebView); the old
`composition.mjs` used the legacy `bakeGround` path and hid it. Verified:
`/tmp/wp-ground-roads.png` (cobblestone + roads) vs `/tmp/wp-ground-plaza.png` (gray).

## §9 — Water trough: unreadable flat-beige box + rim z-fight flicker

The water-trough prop (`buildTrough`) read as a featureless beige box with an
"open white top" and FLICKERED on its base/rim edges. Two causes, both fixed:
- **Blown-out water.** The slab used pale cyan `#a9dcea` + a 0.32 emissive lift,
  which the sun/hemi rig saturated to flat WHITE (the "white lid"). FIX: a DEEPER
  blue-teal (`shade(pal.water,-0.42)`) at ~0 emissive → reads as actual water. Also
  added a darker stone LIP rim + a dark recessed interior floor so the basin reads
  as a hollow holding water, not a solid block (stone vs stone-dark was too close).
- **Rim/base z-fight.** The 4 wall boxes OVERLAPPED at the corners (full-W front/
  back AND full-D sides → coplanar duplicate faces = flicker). FIX: front/back
  walls span full width; side walls span only the INNER depth so they BUTT against,
  never overlap. Same depth-care family as the §8 ground fix. The water slab sits
  below the rim with a clear gap (no coplanar lid). Verified in webkit via the new
  `qa/prop.{html,ts}` harness: `/tmp/wp-prop-trough.png` (clean, readable basin +
  blue water, no flicker). The PLANTER was already correct — untouched.

## §10 — Map heading pointer inverted (recurring; `src/map/mapCore.ts`)

The minimap/map player wedge pointed where the paper character FACES (toward the
camera), not the travel/camera-forward direction. ROOT CAUSE: `headingVec(f)`
returned `(sin f, cos f)`, but the player controller's actual forward basis is
`(-sin yaw, -cos yaw)` (`movement/controller.ts`: `fx=-sin; fz=-cos`) — the EXACT
NEGATION → the wedge pointed 180° backwards. It "kept coming back" because prior
fixes tweaked the screen-projection sign in `drawPlayer` instead of this root
basis. FIX: `headingVec` returns `(-sin f, -cos f)`. Verified with a 6-yaw unit
test (arrow screen-dir · travel screen-dir ≈ 1; was −1). Walk forward → the wedge
points the way you move.

## §11 — NPCs gather around the player (`src/city/population.ts`, `crowd.ts`)

Ambient strollers re-picked every wander target via `pickNear(player.x, …)` —
always recentred on the player, so they orbited you. FIX: a new `pickWander()`
picks a LOCAL meander from the stroller's OWN position with a `PLAYER_KEEPOUT`
(7u) that rejects any target/spawn near the player (fallback steps AWAY). The wake
RING still keeps density-follows-you, but individuals disperse + never path toward
you. Also widened `crowd.ts PLAYER_AVOID` 5→8. Verified in webkit (`qa/pop.{html,
ts}`): stationary player, 10s sim → 0 strollers inside the keepout at every
timepoint, min 8–14u, mean ~18u (dispersed).

## §12 — Camera clips into buildings / sees roof underside (`engine.ts`, `cameraFade.ts`)

The follow camera could end up INSIDE a house showing the roof interior. Two fixes:
- **Boom collision (`engine.ts`).** Each frame, cast a ray from the player's head
  toward the desired eye; if a building body (`wp-building-*`) or roof (`wp-r-*`)
  bbox is hit, pull the eye in to just before it (`CAM_RADIUS` 0.45 standoff,
  `MIN_BOOM` 0.2 floor). Buildings are `isPickable=false`, so we test each
  building/roof mesh with `ray.intersectsMesh` (bbox-only), resynced only on a
  scene flip, zero per-frame GC. Keeps the camera body physically OUT of geometry.
- **Roofs now fade too (`cameraFade.ts`).** The default fade-eligibility was
  body-only; roofs (`wp-r-*`) are now eligible, so a grazing camera never shows an
  opaque roof underside (belt-and-braces over the boom).
Verified (`qa/camboom.{html,ts}`): realistic near-building standoff → boom 8.8→1.1,
eye OUTSIDE all building AABBs; open ground → full 8.8 boom (no false shortening).

## §13 — Map: bare beige grid → water + blockers + zoom (`map/*`, `contracts/runtime.ts`)

The full map showed no WATER, no blockers, and had no zoom — because `MapView` is
fed `topology` with `blockers: []` (city collision is the streaming field) and no
water (water lives in `CityLayout`). Fix:
- **Seam:** `MapView.getMapGeometry?(): { water, blockers }` (rects in world XZ),
  OPTIONAL so non-city rooms fall back to `topology.blockers` (conformance 17/17).
- **Source of truth:** `src/city/cityMapGeometry.ts` derives it from `CityLayout`
  (every `chunk.water` rect + every chunk building footprint) — the SAME data
  collision/placement read, so map + world can't drift. game.ts wires one line:
  `getMapGeometry: () => cityMapGeometry(layout)`.
- **Render:** `schematic.ts drawBase` paints water (slate-blue, under the grid) +
  prefers the map-geometry blockers; minimap + fullMap pass it through.
- **Zoom (`fullMap.ts`):** pinch + mouse-wheel + ± buttons + drag-pan. zoom 1 =
  fit-whole-city (a bigger NYC-island still opens framed); >1 zooms about the focus
  point (`centeredProjection`), pan clamped to the city. Listeners freed on dispose.
Verified in webkit (`qa/map.{html,ts}`): `/tmp/wp-map-fit.png` (river band + 458
building footprints + the #23-correct "You" wedge) and `/tmp/wp-map-btnzoom.png`
(+ button / wheel / pinch zoom in around the player).

## Build / verify notes

- `npm run typecheck` is clean in this domain. (An UNRELATED pre-existing error
  in `src/i18n/strings.ts` — a teammate's untracked in-progress file using
  `String.replaceAll` against the es2020 lib — is NOT from this domain.)
- Worker inlining + `makeGeometryUnique` were confirmed in a temp `vite build`
  (`--outDir /tmp/…`, so the shared `dist` is untouched per the build-contention
  rule); the lead builds `dist` at merge.
- §5 `getForward` needs a one-line wire in `game.ts`:
  `createPopulation(scene, { …, getForward: () => { const f = world.camera.getForwardRay().direction; return { x: f.x, z: f.z } } })`
  (game.ts is outside this domain — flagged to the lead).
