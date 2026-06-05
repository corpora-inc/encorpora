# World Plaza — Decisions & Learnings

## Art direction: HD-2D ("Octopath" style) — committed 2026-06-03
- **World = real 3D.** Buildings (already) + props (pivoting from flat cutouts to
  cheap procedural 3D meshes): real volume, real lighting/shadows, never flat.
- **Characters = 2D billboard sprites ("paper people") — ON PURPOSE.** This is
  HD-2D (Octopath Traveler / Triangle Strategy): a celebrated AAA aesthetic —
  flat sprites in a 3D world that always face the camera (so they're *never*
  paper-thin), with cheap animation and no rigging. It is a STYLE, not a
  compromise — and it's the *one* place "flat" actually buys us simplicity.
- **Why 3D-for-props is the SIMPLER path (counterintuitive but true):** the
  billboard-hybrid (per-prop orientation decisions, wall-proximity rules,
  per-frame re-yawing of thin-instance buffers) is the complexity *hack*, and it
  STILL leaves paper-thin edge cases (the wall-adjacent fixed ones). Real 3D
  objects delete all of that — geometry just exists; depth/lighting/shadows come
  free; paper-thinness is physically impossible. Fewer moving parts AND better.

## Pathway to swap characters → 3D "bubble people" later (door stays open)
We may later do intricate, bubbly, stylized 3D-cartoon people. Keep the seam clean:
- **Single chokepoint:** character rendering = `createGroundedCutout`
  (`src/render/cutout.ts`), consumed by `crowd.ts` + `controller.ts`. A future
  `Character3D` implements the SAME interface (setGroundPos / hop / faceCamera /
  animate) → drop-in swap. Promote it to a pluggable `CharacterLook` (mirroring
  the world `WorldLook`) so paper↔3D is one line.
- **Data already portable:** `CharacterSpec` (skin/hair/clothing layers) describes
  a 3D bubble-person just as well as a paper doll. The Spark asset pipeline
  (`docs/SPARK_ASSETS.md`) feeds the 3D impl.
- **For now:** keep paper people while we iterate on the gameplay the owner hasn't
  seen yet (interactions / rewards / quests). Switch when the 3D character
  pipeline (procedural or Spark) is ready, behind the same seam — no rewrite.

## Camera + Scene wave (committed 2026-06-03) — "cruise-cam over a breathing town toward a hero horizon"
Three coherent moves, tuned AS ONE (dispatched as a parallel agent cohort):
- **Camera & Vista:** lower, over-the-shoulder third-person "cruise" cam that looks
  OUT toward the horizon (was too high/top-down; far-clip `maxZ` was 80 → blocked
  any distance). Raise far clip, add sky gradient + exp2 distance fog, and a
  `src/world/vista.ts` distant LANDMARK (Mount Fuji / Eiffel / cathedral / skyline /
  volcano) on the horizon. Long sightlines + haze + a hero landmark are the payoff.
- **Room composition:** props look great but placement was a "tornado pile" (50
  benches, lamp forest, crowded). Enlarge the map ~10× area and spread the SAME
  count with INTENTIONAL zoning (central plaza, market quarter, tree-lined avenues,
  garden, quiet residential edges) + spacing rules. Bigger baked ground must keep
  0.0000% road-flicker.
- **Scene divergence (proves the spine):** the SAME `plaza-grand` topology renders
  as warm **Antigua-1770 day** OR neon **Tokyo-2050 night**, switchable LIVE, with
  identical collisions. `buildings.ts` switches on `scene.buildingStyle`
  (`antigua-stucco` vs `tokyo-neon`); `tokyo-2050.json` is the divergent twin.

**Contract seam (orchestrator-owned, added to `contracts/src/scene.ts`):** Scene
gained optional `sky` ({horizon,zenith,fog,fogColor,timeOfDay}), `landmark`
({kind,tintHex,label,azimuth,scale}), and `buildingStyle`. Camera/vista READ
sky+landmark; buildings READ buildingStyle; scene JSON AUTHORS them. All optional →
backward-compatible. `worldLook.ts` + `game.ts` are orchestrator-owned integration
files (no agent edits them; they hand me exact wiring) to avoid render-seam collisions.

## Lessons (do not repeat)
- **Road z-fighting:** NEVER overlay a coplanar road mesh on the ground and nudge
  it with depth offsets — it ALWAYS fails at grazing angles (depth precision).
  Bake roads INTO the single ground mesh (no overlapping geometry → physically
  immune). Texture shimmer/moiré = `anisotropicFilteringLevel=16` + mipmaps (+
  MSAA), not offsets. (Cost us hours of band-aids before naming the real cause.)
- **Billboard vs 3D:** billboarding hides the edge but adds orientation logic AND
  leaves paper-thin cases; for simple objects, real 3D is simpler *and* better.
  Reserve billboards for characters (intentional HD-2D).
- **Dev double-mount:** the pack mounted TWICE in dev (React StrictMode /
  re-injection) → two Babylon engines, doubled LLM streams, ghost WASDQE while a
  chat was open. Tell-tale: TWO `Babylon.js` boots in the console. Fix: idempotent
  `mount` (dispose any prior instance). `src/main.ts`.
- **Don't double-book keys:** `e` was engage + camera-look + sometimes "enter".
  Engage = Talk button / tap only; `e` is camera-look only.
- **Verify in the REAL app, not just standalone:** agents self-reporting "fixed"
  against a friendly standalone camera angle while the real app still broke burned
  hours. The orchestrator verifies the *actual* symptom in the real build before
  declaring done. The pack loads from the corpan-app vite (`:1421`) `/packs`
  middleware — NOT a separate `:8989` server; **rebuild `dist` + reopen the pack**
  to see pack changes; corpan-app `src` changes HMR live.
- **Storage:** shared-origin `localStorage` (~5MB) overflows when whole catalogs
  are persisted (`store/phrasePackCatalog.ts` + `store/catalog.ts`). Big caches /
  state / analytics → IndexedDB, quota-safe writes that never throw to callers.
  See `corpan/docs/STORAGE_ANALYTICS.md`.

## Foundation: latest-stable engine + mature physics/navmesh — committed 2026-06-05
- **Always run the LATEST STABLE major.** World Plaza was on Babylon **6.49 (a
  2024 release) while 9.x was stable** — three majors behind. That is the root of
  a long tail of hand-rolled-system bugs (collision, slopes, camera, crowd).
  Upgraded to Babylon **9.11** (clean: modular import paths held, 378 tests green,
  renders correctly). New work starts on latest stable, full stop.
- **Use mature best-in-class libraries over hand-rolled systems.** Installed
  **Havok** (AAA physics, `@babylonjs/havok`) and **recast-detour** (industry
  navmesh). The player becomes a Havok capsule controller (retires the
  walk-surface height registry + slope/clip bugs); NPCs become Recast navmesh
  agents (retires hand-rolled wander/stationing/avoidance). A web pack in a WebView
  does NOT force lite tech — these run in-stack.
- **Real 3D characters** replace the paper-billboard cutouts via the `CharacterLook`
  seam (`createGroundedCutout` → GLB/3D). Billboards were always a placeholder.
