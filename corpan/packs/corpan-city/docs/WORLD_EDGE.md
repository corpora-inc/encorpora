# WORLD_EDGE — crafted world-boundary VISUALS (teammate **env-art**, #32)

The world has a CRAFTED edge (owner's call: not infinite/procedural). `places`
owns the LAYOUT (where land/water/walls/far-bank sit — `layout.water` river band
+ `layout.boundary` rampart + `world/cityWall.ts` structure, see `docs/PLACES.md`).
**env-art owns the VISUALS** that make the edge stunning + intentional: boats,
distant skyline, horizon atmosphere, gate-tower/banner dressing. Each is a NEW
additive module (create / [update] / dispose), perf-aware, frozen, reading the
canonical `layout.water` / `layout.boundary` seam — never the core render spine.

## Shipped

### `src/world/harborBoats.ts` — docked boats (DONE, wired)
Low-poly HD-2D fishing boats moored along the near + far quays so the river reads
as a living waterfront, not an empty blue band. Two species (a cabin SMACK + a
masted SLOOP), rich saturated painted hulls (oxblood / teal-green / slate /
bottle-green — their OWN palette, NOT the pale scene trim, so they pop and don't
wash out under the bright rig), warm-wood decks, off-white sails. Each species×
hull is ONE merged mesh, thin-instanced along the quays + FROZEN; a gentle moored
BOB (pre-allocated matrix buffer, no per-frame alloc) is the only cost and is
RM-gated. ~12 boats = a few draw calls / ~2.4k base verts. Reads `layout.water`
(`waterZ`/`farBankZ` + bridge gap) so boats clear the bridge channel.

Bow geometry lesson: rotating a `tessellation:3` prism into a bow was fragile;
an EXPLICIT VertexData wedge (6 verts, dummy UVs so MergeMeshes' attribute sets
match) is deterministic and always correct.

### `src/world/distantSkyline.ts` — distant city silhouette (DONE, wired)
A layered silhouette of a far metropolis ringing the horizon, so reaching the
edge lands the eye on "the world continues into a great city," not bare sky. Two
camera-followed cylinder bands (far pale ridge + nearer darker ridge) at a real
radius just inside the camera far-clip (≈365u), painted with procedural towers
(varied widths/heights, a few peaked landmarks) that rise from the horizon, fade
to transparent toward the sky, and dissolve into a haze band at the feet. FROZEN
texture, recentred on the camera each frame (no edge); pure backdrop, no collision.

**Depth/visibility lessons (cost iterations — see also [[corpan-city-riverwalk-env-art]]):**
- An `infiniteDistance` skyline is OCCLUDED by the atmosphere sky DOME (also
  infinite-distance, depth ≈ far plane) → switched to a real-radius cylinder
  inside `maxZ` (game `maxZ≈380`), camera-followed, so it draws over the dome and
  is correctly occluded by nearer buildings.
- Babylon cylinder V=0 is at the BOTTOM; the painted towers (upper texture rows)
  land BELOW the horizon unless V is flipped (`vScale=-1, vOffset=1`).
- A TALL cylinder spreads the texture over a huge vertical range → use a MODEST
  height (~150u) so the silhouette sits compactly at the horizon.
- **Open coordination (flagged to lead/atmosphere):** the production `atmosphere.ts`
  fog is heavy at distance and softens the skyline to a faint hint (clear-air
  `?noatmo=1` shows it reads beautifully — `/tmp/wp-sky-noatmo.png`). For the
  skyline to read under fog, the far-fog should ease slightly at the horizon band
  — that's an `atmosphere.ts` tuning call, NOT this module. The skyline also
  strengthens for free when #34 enlarges the world / lightens fog.

## QA: `qa/edge.{html,mjs}` + `qa/edge-mount.ts`
WebKit (≈ WKWebView) screenshotter over the REAL streaming river band (`?city=1`
default; `?city=0` flat ground; `?noatmo=1` isolates the skyline from the dome;
`?noskyline=1` A/Bs the bare horizon; `?reduce=1` proves the still path). Guards
`generateCity`/`city.update` (loud, never silent) so the dressing is verifiable
through a teammate's mid-edit. Shots: `/tmp/wp-edge-{hero,close,across,topdown}.png`
+ `/tmp/wp-sky-noatmo.png` (the clear-air skyline proof).

### `src/world/gateDressing.ts` — gate-tower banners + braziers (DONE, wired)
Each land-gate (south/east/west) reads as a handsome THRESHOLD, not a bare gap in
the wall: a tall heraldic BANNER (accent cloth + dark hem/emblem stripe +
swallowtail + a flag on the pier cap) draped down the inner face of each gate
PIER, and a warm glowing BRAZIER (iron tripod + bowl + flickering flame) at each
jamb. Reads `layout.boundary.gates` (the SAME data `places`' `cityWall.ts` uses to
place the piers) so the dressing lands on the piers without coupling to that
module. One merged master per element, thin-instanced across all 6 jambs (3 gates
× 2) + FROZEN; the flame flicker is the only per-frame cost (one emissive lerp,
RM-gated). Banner faces INWARD (toward the city), braziers toward the gateway.

## Roadmap (env-art, #32 remainder)
- Far-bank district flavour (warehouses/cranes silhouette) once `places` finalizes
  the far quay.
- Coordinate the atmosphere/horizon-haze tuning so the skyline reads in fog.
- Foliage / market-awning dressing of the plaza + promenade (the broader "special
  places stunning" mandate).
