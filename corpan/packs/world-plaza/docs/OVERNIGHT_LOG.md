# Overnight craft session — what landed, what's next (2026-06-05, ~02:00–04:30)

Mandate: "rethink everything, deliver a world-class game by morning, ship nothing
until it's truly great." See docs/NORTH_STAR.md for the vision.

## SHIPPED + VERIFIED (committed; trunk green: typecheck + 395 tests + build)
1. **Babylon 6.49 → 9.11** (latest stable) + **Havok + Recast** installed; Havok
   proven to init in-game (kept out of the bundle until the controller's WASM
   packaging is done). Plus repo-wide dep bumps (zod 4, TypeScript 6, vite/vitest).
2. **The visual leap** (4 parallel craft agents, integrated + verified by the lead
   with real-app screenshots):
   - Cinematic rendering: warm golden-hour sun, soft contact shadows, IBL,
     ACES tone-mapping, bloom, vignette, FXAA (SSAO perf-gated). Fixed 2 real bugs
     (rim light killing shadows; PBR walls blowing out hot).
   - Real 3D characters: the creepy tacked-on paper face is GONE (cohesive skin
     head, features-only paint, charm), chibi proportions, expressive gait.
   - Living world: 12-hue painted town, furnished plaza, per-district paving, a
     hero clock-tower landmark.
3. **Sound**: subtle WebAudio ambient bed + speed-driven footsteps + engage/reward
   SFX, opt-out + reduced-motion aware. Disposed with the world.
4. **The learning leans on our strengths**: each scene drills its OWN corpus-mined
   vocabulary (café→coffee/counter, market→buy/price, directions→where/near),
   auto-localized to 51 langs; the gate challenge VOICES the target phrase (TTS).
5. Earlier tonight: cinematic quest-completion, mic-free winnable core loop,
   atmospheric pop-in, placement invariants, the EN→ES language-pick fix.

## HONEST: still NOT great (the next passes)
- **Cast shadows on the city**: only characters/props cast contact shadows; the
  streamed buildings don't cast the SUN's directional shadows yet (props "float"
  slightly). The rendering rig is built (`world.registerShadowCaster`); wiring it
  needs per-chunk register/deregister in the city-streaming spine (mountCity/
  stream.ts onActiveChange → resident chunk MESHES, not data). Deferred as risky
  unattended; HIGH value next.
- **Physics capsule controller (Havok)**: the bridge-side "jump", walk-under-deck,
  rail clip-through all trace to the hand-rolled walkSurface height registry. The
  Havok capsule retires them. Needs: out-of-bundle WASM packaging (single-file
  pack inlines the ~5MB wasm → must emit it as a separate dist asset) + the
  controller + static colliders from the collision field. Deferred (deserves
  attended bridge testing).
- **Recast navmesh NPCs**: replace hand-rolled wander/stationing/avoidance.
- **Audio aesthetics**: built conservative but UNHEARD — audition qa/audio-test.html
  and tune volumes / the ambient pad.
- **Ground still reads repetitive**; back buildings plainish; composition can be
  art-directed further.
- **Narrative spine**: scenes are still isolated chores, not a journey you care
  about. A real story arc is the soul work left.
- **On-device verification**: all screenshots are standalone webkit. The real
  embedded app on the iPad is the final judge (perf of the cinematic pipeline +
  shadows especially — headless webkit perf is NOT representative).
