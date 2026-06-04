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

## Shared-file coordination

- `layout.ts` / `collision.ts` / `generateCity.ts` / `stubCity.ts` are touched
  here for the water model. `world-fix` owns the core `world/collision.ts` field
  math (untouched) + crowd behavior + bridge structure; the water collider rides
  on top purely via `chunkObstacles`.
- `bridgeX = 0`, `bridgeHalfW = (AVENUE_W + 4)/2 + 1` (≈7u half). If world-fix
  builds a wider/narrower bridge deck (#29), align `bridgeHalfW` so the collider
  gap matches the visible deck.
