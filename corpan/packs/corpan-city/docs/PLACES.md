# PLACES — waterfront layout, riverwalk & placement physics

Owner: teammate **places**. Scope: the LAYOUT, WALKABILITY & PLACEMENT PHYSICS
of the special waterfront places (riverwalk / bank, bridge approaches, harbor,
docks). Bridge STRUCTURE (#29), core collision-field math + crowd behavior are
**world-fix**; bank DECORATION (railings/lamps/foliage) is **env-art**. This doc
defines WHERE walkable land vs water vs the bank edge are, and how that reaches
collision + placement.

## The bug it fixes (#30)

NPCs, ambient strollers, stall-keepers, and props were spawning/wandering in the
OPEN WATER (owner screenshot: an NPC standing in the river, a row of bollards
floating on it). Root cause: the crowd (`world/crowd.ts`) and population
(`city/population.ts`) already test `field.blocked(x,z,r)` before they spawn or
step — but **water was never an obstacle in that field**. `city/collision.ts`'s
`chunkObstacles` only emitted building boxes, prop circles, and the fountain.

## The model: water is first-class layout data

`city/layout.ts` now carries the river as DATA so the generator, collision, and
layout never drift:

- **`CityLayout.water: CityWater`** — `{ waterZ, bankZ, bridgeX, bridgeHalfW }`.
  The river runs along the +Z edge: `z ≥ waterZ` is open water; the band
  `[bankZ, waterZ)` is the walkable **riverwalk promenade** (a solid stone quay,
  not a road bleeding into blue); `bridgeX ± bridgeHalfW` is the one crossing
  corridor.
- **`CityChunk.water: CityWaterRect[]`** — the open-water footprint(s) inside a
  chunk. Each is the collision + placement truth. A rect crossed by the bridge
  deck carries a `bridgeGap: [x0,x1]` so the corridor stays walkable.

`generateCity.ts` promotes the old buried `waterZ` into this model, pulls the
harbor zone + buildings inland of `bankZ`, bakes the riverwalk stone strip across
`[bankZ, waterZ)`, and emits a `CityWaterRect` for every water-painted chunk.

## The fix: water becomes a blocked obstacle (#30)

`city/collision.ts :: chunkObstacles` now appends, per chunk, a BOX obstacle for
each `CityWaterRect` (via `waterBoxes`). A rect with a `bridgeGap` is split into a
LEFT + RIGHT box flanking the deck so the crossing never blocks. Because a box
obstacle's `resolve` slides a body along its OUTSIDE face, the player and crowd
are stopped at the shoreline (or deck edge), and `field.blocked` — the exact
predicate every spawner already consults — reports the river as solid. **No
spawner change was needed; getting water INTO the field was the whole fix.**

Defense-in-depth at generation time: blocks whose footprint reaches `bankZ` are
skipped, and any prop that lands on the water side of `bankZ` is dropped, so
generation never even seeds a floating prop.

## The fix: a real riverwalk promenade (#31)

The waterfront is now a coherent **stone quay** (`stone` ground baked across
`[bankZ, waterZ)`), `RIVERWALK_W` (16u) wide, with harbor warehouses set back on
land, cargo barrels lined up on the quay (clamped inland of the bank), and the
`harbor`/`bridge_n` anchors placed ON the promenade — never on the water. env-art
decorates this band; its extent is owned here.

## Proof

- **`src/city/waterPlacement.test.ts`** (vitest, headless, pure data): every
  water-painted chunk carries a collision rect; a dense probe grid over the open
  water reads `blocked` for the spawner radius (off-bridge); the bridge corridor
  stays open; the riverwalk band stays walkable; no prop sits past the bank.
  Covers both `generateCity()` and `stubCity()`.
- **`qa/cityground.mjs`** (WebKit ≈ WKWebView): frames the riverwalk + a top-down
  of the bank/water boundary, and reports the live-field placement stats. Last
  run:
  - open-water probes blocked: **1404/1404** (nobody on the river)
  - bridge corridor open: **17/17** (crossable)
  - riverwalk band walkable: **94/94** (real promenade)
  - shots: `/tmp/wp-ground-riverwalk.png`, `/tmp/wp-ground-bank.png`

## Crafted world boundary (#32)

The world no longer dead-ends into fog. The +Z edge is the river/sea; the three
LAND edges get a designed perimeter rampart with gates, and the river crosses to
a FAR-BANK district (more city), not the map edge.

**River is a BAND, not water-to-edge.** `CityWater` gained `farBankZ`/`farPromZ`:
`[bankZ, waterZ)` near quay → `[waterZ, farBankZ)` open river → `[farBankZ,
farPromZ)` far quay → far-bank warehouses → sea wall. The bridge spans the band
(`bridgeX ± bridgeHalfW`) and ARRIVES on walkable far-bank land. A `bridge_s`
anchor marks the far approach (quest-flow #26 "cross the bridge" lands there).

**Perimeter rampart.** `CityBoundary` (`inset`/`thickness`/`gates`) drives a
rampart on S/E/W inset from the bounds, plus a sea wall capping the far bank.
Each edge is sliced into per-chunk `CityWallRect` segments (with a `gateGap`
where a cardinal avenue / the bridge mouth passes through). `city/collision.ts ::
wallBoxes` turns each into a box obstacle (split around the gate), so the player
meets a wall — never raw ground — and nothing spawns past it. `world/cityWall.ts`
(`buildCityWall`) builds the matching rampart mesh (merged body + cap +
thin-instanced gate piers) from the SAME segments, wired as a city-lifetime layer
in `mountCity` (built once, frozen, disposed with the city). Collider ↔ mesh are
one source of truth. env-art dresses the edge (boats, distant skyline, horizon
atmosphere); the layout owns where land/water/walls/far-bank/gates sit.

All boundary knobs are relative to `bounds`/`half`, so a later world-size bump
(#34) keeps a coherent edge for free.

## Proof

- **`src/city/waterPlacement.test.ts`** (vitest, headless, pure data): water —
  every water-painted chunk has a collision rect; the river band reads `blocked`
  off-bridge; bridge corridor open; riverwalk walkable; no prop in the river band;
  bridge arrives on far-bank land. Boundary — every off-gate rampart point reads
  `blocked`; every gate is walkable; all three land edges + the sea wall present;
  the sea wall leaves the bridge mouth open. Covers `generateCity()` + `stubCity()`.
- **`qa/cityground.mjs`** (WebKit ≈ WKWebView): frames the riverwalk, river band,
  far bank, and the wall; reports live-field placement. Last run:
  - open-water blocked **702/702**; bridge corridor **17/17** open; riverwalk
    **92/94** walkable.
  - rampart off-gate blocked **698/698**; gates **8/8** walkable; bridge reaches
    far bank **PASS**. (`page errors: none`.)
  - shots: `/tmp/wp-ground-riverband.png` (near bank → river → far bank → wall),
    `/tmp/wp-wall-corner.png` (rampart ring), `/tmp/wp-ground-farbank.png`.

## Shared-file coordination

- `layout.ts` / `collision.ts` / `generateCity.ts` / `stubCity.ts` / `mountCity.ts`
  + new `world/cityWall.ts` are touched here for the water + boundary model.
  `world-fix` owns the core `world/collision.ts` field math (untouched) + crowd
  behavior + bridge structure; the water/wall colliders ride on top purely via
  `chunkObstacles`.
- `bridgeX = 0`, `bridgeHalfW = (AVENUE_W + 4)/2 + 1` (≈7u half). The bridge now
  spans Z ∈ `[bankZ, farBankZ]` (≈[294, 344]); world-fix's bridge STRUCTURE (#29)
  reads `layout.water` for that span + the far-bank arrival. Align `bridgeHalfW`
  if the visible deck width changes.
- env-art reads `layout.water` (`waterZ`/`bankZ`/`farBankZ`) for the riverwalk +
  distant-skyline/horizon dressing, and `layout.boundary` + the wall segments for
  gate-tower / banner dressing on the rampart.
