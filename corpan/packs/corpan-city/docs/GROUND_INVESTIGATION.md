# Gray-ground / no-roads (task #17) — ROOT CAUSE FOUND + FIXED + screenshot-verified

Status: **FIXED.** One-line winding fix in `src/city/cityGround.ts`. Reproduced in
WebKit (≈ WKWebView) and verified fixed with before/after screenshots.

## TL;DR

The streaming ground quads were wound CLOCKWISE-from-above, so each quad's single
face pointed DOWN. Babylon's default back-face culling then hid the entire ground
from every above-ground camera → the ground rendered INVISIBLE and the sky / clear
colour showed through as a flat "gray plane, no roads". It was never a material,
texture, lighting, fog, or PBR problem — the geometry simply wasn't drawn.

**Fix:** flip the two triangles to CCW-from-above so the top face is front-facing:
`indices.push(v, v+1, v+2, v, v+2, v+3)` (was `v,v+2,v+1 / v,v+3,v+2`).

**Proof:** `/tmp/wp-ground-FIXED.png` — full cobblestone/flagstone ground + roads
under the town (vs the prior flat gray). Buildings were never affected because
their faces were already wound correctly.

---

## Original investigation (kept for the record)

## The harness (new QA tooling)

`qa/cityground.{html,ts,mjs}` mounts the REAL streaming city ground
(`generateCity` → `mountCity` → `src/city/cityGround.ts`), the path the live game
uses — NOT the old `composeDressing`/`bakeGround` path the existing
`qa/composition.mjs` exercises (that one renders the ground fine, which is why the
streaming-ground regression was hidden). It uses the same `createWorldEngine` +
`applyAtmosphere` as the game (correct hemi/sun lighting + skybox + fog), Playwright
`webkit` (the engine closest to the iOS/macOS WKWebView), and exposes `__wpGround`
hooks (`setView`, `lookDownAt`, `diag`). Run: `node qa/cityground.mjs`.

## What REPRODUCES (screenshots)

`/tmp/wp-ground-plaza.png` (over-the-shoulder): buildings, props, fountain all
render correctly on the horizon, but the entire GROUND below them is a flat,
untextured blue-gray plane — no cobble streets, no flagstone plaza, no roads.
This matches the owner's embedded report exactly. So it is NOT standalone-only and
NOT a headless artifact — webkit reproduces it.

## The KEY finding (changes the diagnosis)

The gray plane is **NOT the ground mesh rendering with a flat material — the ground
geometry does not render AT ALL.** Proven by a `__WP_STD_GROUND`/`__WP_RED_GROUND`
diagnostic that swapped the ground material for a **bright-red, unlit,
backface-culling-OFF** StandardMaterial: the over-the-shoulder + top-down frames
show **ZERO red pixels**. The "gray ground" the owner and we see is the
skybox/atmosphere/fog floor showing THROUGH where the ground should be.

`diag()` on the enabled ground meshes reports everything healthy yet invisible:
- 137 ground meshes built, ~33 enabled (within the stream visibility radius).
- valid geometry (768–1348 verts, 384–674 faces), `isReady: true`.
- `isEnabled: true`, `visibility: 1`, `inFrustum: true`.
- correct world transform: a chunk mesh at absPos (-47,0,-47) with a world bbox
  (-95..0) — i.e. positioned + sized correctly.
- the albedo `DynamicTexture` IS painted (canvas pixel std ≈ 32) and bound
  (`coordinatesIndex 0`, mesh `hasUV: true`).

So: enabled + ready + in-frustum + valid geometry + a real (red, unlit, unculled)
material → still zero pixels. The triangles are simply not being drawn.

## Hypotheses RULED OUT (each tested in the webkit harness)

1. **PBR-shader-specific** — NO. A StandardMaterial ground (same baked albedo)
   renders identically gray; and the red StandardMaterial draws nothing either.
2. **Canvas→DynamicTexture `drawImage` blit failing in WebKit** — NO. The
   composition harness's `bakeGround` does the same blit and renders fine; and
   painting directly into the DynamicTexture context didn't change anything.
3. **Lazy texture creation mid-render-frame** — NO. Eager pre-warming every ground
   material at mount (before the render loop) didn't change it.
4. **`freezeWorldMatrix()` frozen before the chunkMesh reparent collapsing it** —
   NO. Removing the freeze didn't change it.
5. **Back-face culling / winding** — NO. The red diagnostic set
   `backFaceCulling = false` and still drew zero pixels.
6. **Lighting** — NO. Harness uses the real hemi+2×directional rig; the red test
   was unlit (`disableLighting`/emissive) and still invisible.

## Where I think the cause lives (NOT yet my-domain-confirmed)

Given valid geometry + enabled + ready + in-frustum + unculled + unlit still
produces nothing, the remaining candidates are pipeline-level and partly OUTSIDE
`src/world`+`src/city`:
- **renderingGroupId / depth-clear interaction** (the documented World-Plaza depth
  lesson: a higher rendering group auto-clears depth and paints over). The skybox
  dome is `renderingGroupId 0`; need to confirm the ground isn't being drawn into a
  group that the sky/atmosphere then overwrites. (`src/world/atmosphere.ts`.)
- A possibility that the **harness ArcRotateCamera** never truly frames the ground
  despite `inFrustum:true` (the streaming `getCameraPos` enable logic + the
  degenerate top-down `beta≈0` pole). The over-the-shoulder view is reliable and
  still shows no ground, which argues against this — but it isn't fully excluded.

## Next steps (need a decision — likely cross-domain)

The fix is probably in `src/render/materials.ts` or `src/world/atmosphere.ts`
(render domain, not `src/world`+`src/city`), OR a render-order fix. Recommend
pairing with whoever owns render/atmosphere, OR authorize me to edit those files.
Decisive next experiments queued:
- Log the ground mesh's `renderingGroupId` vs the buildings' and the sky dome's.
- Temporarily disable the skybox + fog and re-shoot — does the ground appear?
- Compare a building mesh and a ground mesh side-by-side in the SAME frame with the
  red material (building visible, ground not → isolates to the ground mesh build).
