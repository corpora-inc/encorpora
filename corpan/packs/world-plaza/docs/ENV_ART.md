# ENV_ART — premium environmental dressing (teammate **env-art**)

Mission: lift the world from "Hello-World" to Octopath / best-game-ever. I own an
ADDITIVE environmental DRESSING + DETAIL layer — NEW modules that decorate the
world. I do NOT touch world-fix's core render systems (engine/camera/streaming)
or the bridge STRUCTURE (world-fix owns #29). I read the data those systems
expose and lay beauty along it.

This is task **#31's visual half** (riverwalk + special places: stunning, not
Hello-World).

---

## What shipped: `src/world/riverwalk.ts` — the waterfront promenade

A single additive, bounded layer (create → `update(dt)` → `dispose()`, the same
pattern as `fountain.ts` / `harborWater.ts`) that dresses the +Z water edge:

- **Stone BALUSTRADE** — turned vase balusters under a capping rail + a kerb,
  with heavier stone PIERS (ball finial) at ~7u "bays". Opens with a clean GAP at
  the bridge so the deck is never walled off.
- **Harbour LAMP POSTS** — a tapered iron column crowned by a six-sided glass
  LANTERN (peaked roof + finial) with a hot glowing orb inside. Set just shoreward
  of the rail, ~every 2 bays.
- **Mooring BOLLARDS** — iron-capped stone stubs on the promenade side of the rail
  (you walk past them), staggered so they never hide behind a baluster.
- **Richer WATER** — ONE quad a hair above the baked water, painted with a depth
  gradient (deep teal far → luminous near the bank), tiling RIPPLE striations that
  drift sideways with the tide (a per-frame U-scroll), and a soft FOAM lip lapping
  the shoreline. Replaces the old flat-blue `harborWater` sheen (which is now only
  built when the riverwalk has no edge to key off).
  - **River BAND (#32, `farEdgeZ`):** when `CityWater.farBankZ` is passed, the
    water sheet spans only `[edgeZ, farEdgeZ]` (the open river) instead of running
    to the world edge over the far bank + sea wall, the depth gradient is SYMMETRIC
    (shallow+luminous at both banks, deep mid-channel), and the foam laps BOTH
    shorelines — so it reads as a crossing, not an endless sea. Verified top-down:
    `/tmp/wp-river-bandtop.png` (water capped at both banks). TODO (places offered):
    dress the symmetric FAR quay with a balustrade run too.

### The edge seam (coordinate with world-fix / places)
The module takes plain numbers — `edgeZ` (water line), `bounds`, and a bridge
`gap` (`x` + `halfWidth`). It is decoupled from how those are derived. `game.ts`
reads them from the canonical **`layout.water`** (`CityWater`:
`waterZ`/`bankZ`/`bridgeX`/`bridgeHalfW`) added by world-fix/places, with a
`bridge_n`-anchor fallback. If `places` defines a real bank polyline later, swap
ONLY how `edgeZ`/`gap` are computed in `game.ts` — the dressing geometry is
unchanged. (Open coordination: the balustrade sits at `edgeZ-0.7`, on the bank
between `bankZ` and `waterZ`; the player can currently stand where the rail is.
Whether collision should keep them a touch shoreward of the rail is world-fix's
collision call — flagged, non-blocking for the visual.)

### Performance (protect the 123MB / no-hitch baseline)
Everything repeated is ONE merged master mesh drawn via THIN INSTANCES (one draw
call + one shared frozen material for the whole run): ~798 balusters, ~106 piers,
~66 bollards, ~54 lamp posts → 4 instanced meshes. Plus 2 merged rail meshes + 1
water quad = **7 meshes, ~1225 base verts** for the entire waterfront. Built once,
frozen; never streams or rebuilds. The only per-frame cost is one emissive lerp +
a UV-offset on the water, skipped entirely under reduced-motion.

---

## QA: `qa/riverwalk.{html,mjs}` + `qa/riverwalk-mount.ts`

WebKit (≈ WKWebView) screenshotter, extends the `qa/prop.*` / `qa/cityground.*`
pattern. Default mode builds the riverwalk over a flat fallback ground for
DETERMINISTIC geometry verification (independent of world-fix's live city churn);
`?city=1` mounts the REAL streaming city for in-context shots. Produces
`/tmp/wp-river-{hero,eye,water,gap}.png` and a machine-checkable probe of the
water DynamicTexture's painted spread (gradient+ripple → std ≫ 10; a flat wash →
~0). `reduce=1` proves the reduced-motion (still) path.

Run: `node qa/riverwalk.mjs` (from the pack dir).

---

## Hard-won lessons (don't repeat these)

1. **A `clone()` of a disabled master is itself disabled.** The whole balustrade
   was invisible for several iterations because `instanceSet` did
   `master.setEnabled(false)` (template) → `master.clone()` → the clone inherited
   `enabled=false` and never drew. The rail (not cloned) drew, so it read as a
   flat ribbon with no posts. FIX: `clone.setEnabled(true)` before thin-instancing.
   Diagnostic that cracked it: a per-mesh probe showing `enabled:false` on every
   thin-instanced mesh while the merged rails were `enabled:true`.

2. **ArcRotateCamera `setTarget()` RECOMPUTES alpha/beta/radius.** In the harness,
   setting `cam.radius = 5` then calling `cam.setTarget(...)` blew the radius back
   to ~39, so every "close" shot was actually far and the rail collapsed to a
   line. FIX: call `setTarget` FIRST, then impose alpha/beta/radius.

3. **Proportions + occlusion + emissive, in that order, decide readability.**
   Slender 0.3u balusters at one z-plane, sandwiched between a wider cap and kerb,
   read as a flat curb from every angle. Premium HD-2D needs CHUNKY posts (fat
   vase bellies that BULGE past a narrower cap), the cap/kerb depth < the belly so
   the bellies protrude, and LOW emissive (0.18, not 0.34) — a high lift blows
   pale stone to flat white under the sun/hemi rig (the trough §9 lesson again).

4. **Verify against the REAL angle AND the real city.** Friendly top-down framing
   hid the disabled instances for a while; a grazing/eye-level perpendicular shot
   and `?city=1` are what proved it. (Repo rule: verify the embedded reality, not
   just the convenient view.)

5. **A QA harness that imports the live city must be resilient to a teammate's
   mid-edit.** world-fix's `generateCity`/`collision` threw transiently while they
   added `CityWater.walls`/`farBankZ`. The harness guards `generateCity` +
   `city.update` in try/catch (logged loudly — never silent) and defaults to a
   no-city fallback so MY geometry is always verifiable.

---

## Roadmap (env-art, beyond the riverwalk)
- Foliage / tree variety, vines, potted plants along the promenade + plaza.
- Market awnings, banners, signage in the market quarter.
- Tasteful light shafts / dust motes (perf-cheap), beyond the atmosphere layer.
- Decorate the other "special places" (#31's other half) once `places` names them.
