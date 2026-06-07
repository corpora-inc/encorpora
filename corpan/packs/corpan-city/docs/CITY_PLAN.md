# CITY_PLAN — Corpán City master-plan (NYC-inspired archipelago)

> **Status: DESIGN PROPOSAL (task #34). No code yet.** This is the plan the owner
> reacts to BEFORE we build. The owner was brainstorming "islands vs cliffs vs
> NYC" — this is a concrete take to approve/adjust. Owner: teammate **places**
> (layout); env-art dresses districts/landmarks/boundaries; world-fix owns
> streaming-at-scale + the bridges.

The current world is one 760×760 square with one river and one bridge — "too toy
demo by far." This plan grows it into a **believable little metropolis modeled on
New York**: islands/boroughs joined by bridges, distinct districts with their own
character, named destination landmarks (AIRPORT, PORT, a Central-Park green,
stadium, station…), and crafted natural boundaries (MOUNTAIN CLIFFS on one side,
SEA around the islands) — never a raw fog edge.

---

## 1. The shape: a three-island harbor, ringed by sea, backed by cliffs

NYC's legibility comes from **water + bridges + a central park**: a dense long
island, a green spine down its middle, a separate downtown tip, an outer-borough
across the water, and an island park. We map that onto an archipelago the streamer
can grow island-by-island.

```
                          N  (open SEA → horizon)
   ┌──────────────────────────────────────────────────────────────────────┐
   │   ~~~~~~~~~~~~~~~~~~~~~~~  H A R B O R   B A Y  ~~~~~~~~~~~~~~~~~~~~~~~  │
   │   ~~~~~~~~~┌───────────────┐~~~~~~~~~~~~~~~~~~~~~~~┌──────────────┐~~~  │
   │   ~~~~~~~~~│  HARBOR ISLE  │~~~~~~~~~~~~~~~~~~~~~~~│  AIRPORT KEY  │~~~  │
   │   ~~~~~~~~~│  ▟ PORT/docks │~~~~~~~~~~~~~~~~~~~~~~~│  ✈ AIRPORT    │~~~  │
   │   ~~~~~~~~~│  warehouses   │~~~ ╔═══════╗ ~~~~~~~~ │  terminal+    │~~~  │
   │   ~~~~~~~~~└──────╤────────┘~~~║FERRY  ║~~~~~~~~~~└──────╤───────┘~~~  │
   │   ~~~~~~~~~~~~~~~~ ║ Harbor Br. ╚═══╤═══╝ ~~~~~~~~~~~~~~~ ║ Sound Br.    │
 W ├══════════════════╬═══════════════════════════════════════╬════════════┤ E
 (CLIFFS)  ┌──────────╨───────────────────────────────────────╨──────────┐  (SEA)
   │ ▲▲▲▲  │                    M A I N L A N D   I S L E                 │  │
   │ ▲▲▲▲  │  ┌─────────────┐   ┌────────────────────┐   ┌─────────────┐  │  │
   │ CLIFF │  │  UPTOWN     │   │   ░ CENTRAL GREEN ░ │   │  RAIL YARDS │  │  │
   │ WALK  │  │ residential │   │   ░ (the park)    ░ │   │  ▆ STATION  │  │  │
   │ ▲▲▲▲  │  │  + STADIUM ◍│   │   ░ lake, paths   ░ │   │  + arena    │  │  │
   │ ▲▲▲▲  │  └──────╥──────┘   └─────────╥──────────┘   └──────╥──────┘  │  │
   │ ▲▲▲▲  │  ════════╬══════ Grand Ave (the spine) ═══════════╬═════════ │  │
   │ ▲▲▲▲  │  ┌──────╨──────┐   ┌─────────╨──────────┐   ┌──────╨──────┐  │  │
   │ CLIFF │  │  MIDTOWN    │   │  ★ GRAND PLAZA ★    │   │  MARKET     │  │  │
   │ GATE  │  │ downtown    │   │  (SPAWN) fountain   │   │  QUARTER    │  │  │
   │ ▲▲▲▲  │  │ shops/inns  │   │  hospital nearby    │   │ stalls/halls│  │  │
   │ ▲▲▲▲  │  └─────────────┘   └────────────────────┘   └─────────────┘  │  │
   │ ▲▲▲▲  └────────────────────────────╥─────────────────────────────────┘  │
   │ ▲▲▲▲ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ ║ South Br. ~~~~~~~~~~~~~~~~~~~~~~~~~  │
   │ ▲▲▲▲ ~~~~~~~~~~~~~~┌────────────────╨───────────────┐~~~~~~~~~~~~~~~~~~~  │
   │ ▲▲▲▲ ~~~~~~~~~~~~~~│   DOWNTOWN  TIP (financial)     │~~~~~~~~~~~~~~~~~~~  │
   │ ▲▲▲▲ ~~~~~~~~~~~~~~│   ▮ towers, ⛂ bank/exchange     │~~~~~~~~~~~~~~~~~~~  │
   │ ▲▲▲▲ ~~~~~~~~~~~~~~└────────────────────────────────┘~~~~~~~~~~~~~~~~~~~  │
   │ ~~~~~~~~~~~~~~~~~~~~~~~~~~  O P E N   S E A  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  │
   └──────────────────────────────────────────────────────────────────────┘
                          S  (open SEA → horizon)

  Legend: ║═ bridge   ~ water/sea   ░ park green   ▲ mountain cliff (W wall)
          ★ spawn   ◍ stadium   ▆ station   ✈ airport   ▟ port   ⛂ bank
          ╔FERRY╗ = ferry hub (water-crossing alternative to a bridge)
```

**Why this shape**
- **Reads as NYC instantly:** a long main island with a green park down the
  middle (Central Park), a financial **Downtown Tip** (Lower Manhattan), an
  **Uptown** residential quarter, a separate **Harbor Isle** (the working
  waterfront / Brooklyn-ish), and an **Airport Key** out on the water (a
  JFK/LaGuardia analogue you reach by bridge or ferry).
- **The west edge is a mountain CLIFF wall** (the Palisades) — a dramatic, non-
  walkable natural boundary with a clifftop walk + a land gate. The other three
  sides are **open sea to the horizon**. No fog dead-end anywhere (extends #32).
- **Bridges are the connective tissue + gameplay:** every island-to-island hop is
  a bridge (or the ferry hub), so "cross to X" is a real traversal objective and
  each crossing is a set-piece (#29 bridge structure scales to several decks).

---

## 2. Scale target

| | Today | **Proposed** | Multiple |
|---|---|---|---|
| World side | 760 u | **2160 u** | 2.84× |
| World area | 0.58 Mu² | **4.67 Mu²** | **8×** |
| Chunk side | 95 u | 120 u | — |
| Chunk grid | 8×8 = 64 | **18×18 = 324** | 5.06× |
| Walkable land | ~100% | **~55%** (rest is sea/park-water/cliff) | — |

**8× the area** is the headline. It is large enough to feel like a city you can
get lost in, while the **water + cliffs eat ~45%** of the square — so the
*built-chunk* count (chunks with real buildings) is ~180, not 324, keeping the
build budget sane. (Sea/cliff chunks are cheap: a ground plane + a water/cliff
collider, no façades.) Knobs stay relative to `bounds`/`half` (already true post
#32), so this is a `WORLD_SIZE`/grid change, not a rewrite.

> **Open question for the owner:** 8× now, or stage to ~4× first (1520 u) and grow
> to 8× once streaming-at-scale is proven? My recommendation: **build the full
> 8× layout DATA immediately** (it's just numbers) but **gate how much streams**
> behind world-fix's budget, so we can dial coverage up as perf lands.

---

## 3. Streaming-at-scale (the hard part — coordinate with world-fix)

**The risk.** Today the streamer is *build-once, never dispose*: it builds all 64
chunks and just toggles visibility. At 324 chunks (or even ~180 built ones) that
4–5×'s resident memory and total build time — it won't hold on a phone.

**The plan (world-fix owns the impl; this is the requirement):**
1. **Re-introduce proximity DISPOSE with hysteresis** (it existed before the
   build-once rewrite — `disposeRadius`/`disposesPerTick` are still in the
   `StreamOptions` as deprecated knobs). Keep a generous KEEP radius (so the
   near district never thrashes) but dispose distant districts. The whole island
   you're on stays resident; the island across the bay doesn't.
2. **Cheap far-LOD for water/cliff/park chunks** — these have no façades, so they
   can stay resident cheaply and give the horizon its silhouette even when far.
3. **District-coherent chunking** so a "warm" set of chunks = the district you're
   in + its bridges, not a blind radius. (Layout can tag each chunk with a
   `district` id; the streamer prioritizes same-district + bridge-adjacent.)
4. **Curvature reveal (#33/#36 already spiked)** hides the far-chunk pop-in at the
   horizon, so dispose/rebuild at distance is invisible.

**BUDGET (confirmed by world-fix, 2026-06-04):** design to **~96 BUILT LAND
chunks max resident** (call it 90–100). Reasoning grounded in the current
streamer: the heavy work is already shared city-lifetime (façade pool, prop
masters, 6 tileable ground materials) and does NOT grow with chunk count; what
grows per built chunk is *geometry* — ground + merged buildings + prop clones
(each clone now carries its OWN geometry after the thin-instance-clobber fix, so
prop vertex memory is ~linear in built chunks). ~96 built ≈ tens of MB geometry;
that's a **RAM ceiling, not a draw ceiling** (only the near ring renders; far-but-
resident chunks are `setEnabled(false)` — ~free to skip but still hold RAM). The
naive 8× "build everything" (~180 land chunks) is ~2× over → build-once won't hold
on a phone. **Confirmed: we need dispose.** (The ~96 is the DESIGN ANCHOR — a
chunk-count proxy for the real ceiling, which is resident GEOMETRY BYTES + draw
budget. world-fix will add a runtime resident-geometry meter when wiring dispose,
so we tune to actual on-device MB; the count stays the sizing anchor, the meter is
the safety net.)

**Approach (world-fix owns the impl, green-lit):** revive **dispose-with-
hysteresis** (proven infra still present: the `built` map + per-chunk `dispose()`
+ the deprecated `disposeRadius`/`disposesPerTick`). `keepRadius > disposeRadius`
with a gap so the bay boundary never thrashes; dispose ≤N/frame (amortized, no
hitch); **NEVER dispose** a chunk tagged `landKind ∈ {sea, park-water, cliff}`
(cheap → keep resident as the far silhouette, satisfying the LOD ask) or a
bridge-adjacent chunk. Net: the island you're on + its bridges stay resident; the
island across the bay is disposed and rebuilt on approach (build-once *within a
visit*, dispose *across the water gap*). Prefer this over impostors/merged-far-LOD
for v1 (lowest risk, reuses proven infra); impostors are later polish.

**LAYOUT TAGS I'll add (so the streamer can do the above):** per-chunk
`district` id + `landKind` (`land`/`sea`/`park-water`/`cliff`). world-fix warms by
same-district + bridge-adjacent, keeps cheap landKinds always-resident, and counts
**only LAND chunks** against the ~96 budget (sea/cliff/park-water are near-free).

**SIZING RULE this imposes on me:** size each district + its immediate neighbours
so **no more than ~96 LAND built chunks fall within `keepRadius` at once**. A
contiguous land mass bigger than that needs internal sub-streaming (dispose within
the district) — fine, just don't make one solid borough require >96 near
simultaneously. This is why the city is an ARCHIPELAGO (water gaps between
boroughs = natural dispose seams) rather than one giant land slab.

---

## 4. Districts (character per patch — visual only, never learning domains)

Zones already exist (`CityZoneId`) and are *visual* only. We extend the roster and
arrange them into the islands above. Each district has a distinct silhouette so you
always know where you are.

| District | Island | Zone(s) | Character |
|---|---|---|---|
| **Grand Plaza** (spawn) | Mainland | `plaza` | civic heart, fountain, low + monumental |
| **Midtown** | Mainland | `downtown` | dense mid-rise shops/inns, the busiest streets |
| **Uptown** | Mainland | `residential` + new `uptown` | calmer townhouses, gardens, the stadium |
| **Central Green** | Mainland | `park` | the Central-Park analogue: lake, paths, trees, few buildings |
| **Market Quarter** | Mainland | `market` | stalls, market halls, awnings |
| **Rail Yards** | Mainland | `station` + `industrial` | the transit hub + arena + workshops |
| **Downtown Tip** | Downtown island | new `financial` | the tallest towers, bank/exchange (Lower Manhattan) |
| **Harbor Isle** | Harbor island | `harbor` + `industrial` | working port, warehouses, cranes |
| **Airport Key** | Airport island | new `airport` | the terminal + apron + a control tower |
| **Cliff Walk** | West edge | new `cliff` (boundary) | clifftop promenade under the mountain wall |

**New zones to add** (additive to `CityZoneId`): `uptown`, `financial`, `airport`,
`cliff`. Each just steers building-kind weights + dressing, exactly like today.

---

## 5. Landmark roster (every one a real destination)

Landmarks are generic, stable, **id-targetable** anchors (quests/map bind by id,
never by zone — established pattern). Existing ids are preserved so current quests
keep working; new ones are additive.

| id | kind | District | Notes |
|---|---|---|---|
| `plaza` | `spawn` | Grand Plaza | **kept** — spawn |
| `fountain` | `fountain` | Grand Plaza | **kept** |
| `market` | `vendor` | Market Quarter | **kept** |
| `harbor` | `docks` | Harbor Isle | **kept** — the PORT (owner-requested) |
| `station` | `portal` | Rail Yards | **kept** — Central Station |
| `hospital` | `landmark` | near Grand Plaza | **kept** |
| `airport` | `landmark`* | Airport Key | **NEW** — terminal; ✈ owner-requested |
| `stadium` | `landmark`* | Uptown | **NEW** — arena/ballpark |
| `central_green` | `landmark`* | Central Green | **NEW** — park entrance / lake |
| `exchange` | `merchant` | Downtown Tip | **NEW** — bank/money-changer (ties to economy) |
| `ferry` | `docks` | Ferry hub (bay) | **NEW** — water crossing to Airport Key |
| `cliff_gate` | `city_gate` | Cliff Walk | **NEW** — the land gate in the mountain wall |
| `bridge_*` | `landmark` | each crossing | **per-bridge** approach anchors (n/s pairs) |

\* `airport`/`stadium`/`central_green` use `kind:"landmark"` today (map/quests
target by **id**). **Open question:** extend `AnchorKind` enum with
`airport`/`stadium`/`park`? It's additive + optional (contract already allows
unknown→`landmark` fallback), nice for map icons. Recommend yes, low-risk.

Each landmark gets a **hero footprint + props** in `buildLandmark` (already the
pattern): airport = a long terminal shed + apron + control tower + a row of
hangars; stadium = an oval stand ring; central_green = a lake disc + tree masses +
a bandstand; exchange = a columned hall.

---

## 6. Bridges & crossings (world-fix builds the structures, #29)

| Crossing | Connects | Type |
|---|---|---|
| **South Bridge** | Mainland ↔ Downtown Tip | bridge (kept/relocated `bridge_n`/`_s`) |
| **Harbor Bridge** | Mainland ↔ Harbor Isle | bridge |
| **Sound Bridge** | Mainland ↔ Airport Key | bridge |
| **Ferry** | Harbor Isle ↔ Airport Key | ferry hub (a `docks` portal pair) |

Each bridge reuses the #32 model exactly: a river/sea BAND between two banks, the
deck corridor carved out of the water collider, walkable land on both ends, paired
approach anchors. The data already supports this (`CityWater` was built for one
band; we generalize to **a list of water bodies + crossings** — see §8). A ferry
is a portal pair (no deck) for variety + to prove the "boat crossing" quest step.

---

## 7. Boundaries (extends #32 — no raw edge anywhere)

- **West = MOUNTAIN CLIFF wall.** A tall non-walkable cliff band (like the water
  band): a clifftop **Cliff Walk** promenade on the city side, a sheer drop, and
  the mountain rising beyond into the skybox. One **`cliff_gate`** lets a road out
  (a tunnel/pass). Modeled as a `cliff`-kind boundary band with a collider, same
  mechanism as the sea wall — env-art dresses the rock face + peaks.
- **N / S / E = open SEA to the horizon.** The islands are ringed by sea; the sea
  is the boundary (non-walkable water collider out to the world edge, then the
  curvature/fog horizon). Distant-skyline silhouettes + a far landmass on the haze
  (env-art) sell "the world continues," not "the world stops."
- **No perimeter rampart now** (the #32 rampart was for the old land-locked square;
  here water + cliffs ARE the boundary). The #32 `CityBoundary`/wall code stays for
  any land edge that needs it, but most edges are natural.

---

## 8. Data-model deltas (additive; keeps current contract valid)

1. `CityZoneId` += `uptown | financial | airport | cliff`.
2. **Generalize water to a LIST.** Today `CityLayout.water: CityWater` (one band,
   already carrying `bankZ/waterZ/farBankZ/farPromZ` + a precomputed `deck`
   `{z0,z1,x,halfW}` the bridge reads — landed in the #32 work). Proposed
   `CityLayout.waters: CityWaterBody[]` where each body is a rect/region with its
   own banks + crossing/`deck`; **keep `water` as the primary river for back-compat**
   so env-art's riverwalk/boats + world-fix's bridge don't break (they'll iterate
   `waters` once it's real). Per-chunk `water: CityWaterRect[]` already supports
   many rects — only the top-level summary becomes plural.
3. **`CityLayout.districts: District[]`** — id, label, bounds/centroid, island id —
   AND a per-chunk `district` id tag. Drives streaming warm-priority (same-district
   + bridge-adjacent), the map legend, and "you are in X" UX.
4. **`CityLayout.islands: Island[]`** — id, bounds, the bridges that reach it.
5. **`landKind` per chunk** (`land | sea | park-water | cliff`) — the streaming +
   collision discriminator: world-fix keeps cheap landKinds always-resident (far
   silhouette) and counts ONLY `land` against the ~96 budget (§3); collision/
   placement already knows water/cliff are non-walkable.
6. New landmark cases in `buildLandmark`; new `LandmarkPlan`s positioned per §1.

All additive — existing `generateCity()` output stays a valid (degenerate, single-
island) case, and the stub stays valid. The 324-tile generator is the same recipe
with a bigger grid + an island/water mask.

---

## 9. Phased build plan (grow incrementally, NOT one rewrite)

Each phase is shippable + independently verifiable (headless placement tests +
WebKit screenshots, the #30/#32 pattern). We do **not** land a giant rewrite.

- **Phase 0 — APPROVAL (this doc).** Owner reacts; we adjust shape/scale/landmarks.
- **Phase 1 — Scale the existing square to the Mainland Isle.** Bump `WORLD_SIZE`
  to ~1520 (4×), grid to 13×13, keep the single river→Downtown Tip as today's
  bridge. Add the **Central Green** park + **Grand Ave spine** + the Midtown/
  Uptown/Market/Rail-Yards districts. Prove streaming holds at 4× **with world-fix**
  (dispose-with-hysteresis back on). *Deliverable: a believably bigger single
  island, same boundary tech.*
- **Phase 2 — Water bodies + a second island.** Generalize to `waters[]`; add
  **Harbor Isle** across **Harbor Bridge** with the **PORT**. Prove the multi-band
  water collider + a second bridge (world-fix #29). *Deliverable: two islands, one
  new crossing, the port landmark.*
- **Phase 3 — Airport Key + ferry + new landmarks.** Add **Airport Key** across
  **Sound Bridge**, the **ferry** hub, and the `airport`/`stadium`/`central_green`/
  `exchange` landmark heroes. *Deliverable: the full island set + the owner's named
  landmarks.*
- **Phase 4 — Cliff boundary + full scale to 8×.** Add the **west cliff wall** +
  Cliff Walk + `cliff_gate`; bump to the full 2160 u / 18×18. Final perf pass with
  world-fix (LOD for far water/cliff/park chunks). *Deliverable: the crafted NYC
  archipelago at full scale.*
- **(Continuous) env-art** dresses each district/landmark/boundary as it lands
  (skyline silhouettes, port cranes, terminal, stadium, cliff rock, park lake);
  **content/quest** agents route quests across the new crossings ("ferry to the
  airport", "meet at the exchange").

---

## 10. Open questions for the owner (decide before Phase 1)

1. **Scale:** full **8×** layout data now (recommended) vs. stage 4×→8×?
2. **Shape:** does the **3-island + cliff-west** archipelago land, or do you want
   a different silhouette (e.g. a single big island with a cliff on TWO sides, or
   more/fewer boroughs)?
3. **Landmark roster:** airport + port + central-park + stadium + station + bank
   confirmed — any others you want as real destinations (museum? cathedral?
   university? a "Times Square" lights plaza)?
4. **Ferry vs. all-bridges:** keep a ferry hub (variety + a boat-crossing quest)
   or make every crossing a bridge?
5. **Cliff side:** west cliffs only, or cliffs on the north too (a mountain
   backdrop behind the skyline)?

Once you react, I'll lock the numbers and start **Phase 1** with world-fix on
streaming and env-art on dressing.
