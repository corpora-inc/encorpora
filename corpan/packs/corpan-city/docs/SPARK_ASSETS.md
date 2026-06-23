# Corpan City — DGX Spark Asset Generation Brief

Ready-to-run directions for an agent running on the **DGX Spark** to generate the
3D assets that the Corpan City **Look layer** will consume. Hand this whole file
to a headless Claude Code / Agent SDK instance on the Spark (over Tailscale SSH),
or run the steps yourself.

> **Why this exists.** The game's systems (map, crowd AI, dialogue, challenges,
> items, shell) are art-direction-agnostic. Rendering goes through a pluggable
> `WorldLook` (see `docs/RENDER_LOOK.md`). The current stylized look is procedural
> (no assets). This brief produces the **pro 3D assets** for a future
> `create3DLook()` — "bubble people" + PBR town — without changing any game logic.
> Assets are pure data: drop them in, point the Look at them, ship.

---

## 0. The bar (style guide — non-negotiable for consistency)

- **Characters = "bubble people":** rounded, soft, slightly inflated forms
  (think Pokémon-Sleep / Alto's-Odyssey / Untitled-Goose warmth). Friendly,
  wholesome, readable at small size. Low-poly (≤4–6k tris), clean quad topology,
  **rigged** (a simple humanoid skeleton: hips/spine/head/2 arms/2 legs is enough),
  with a few baked animations: **idle, walk, talk, wave**.
- **Parametric, not one-offs:** characters must support the existing
  `CharacterSpec` (skin tone, hair style+color, clothing layers top/bottom/outer/
  hat/accessory, props). Prefer **a base body + swappable layered parts +
  tintable materials** over hundreds of unique meshes, so we get infinite variety
  from a small kit (same model the procedural look uses, now in 3D).
- **World = warm colonial (Antigua-1770) PBR:** cobblestone streets, terracotta
  TILE roofs (real geometry, not flat slabs), stucco walls (subtle normal),
  flagstone plaza, wooden doors/shutters, market stalls. Eras are themeable later
  (Tokyo-2050 etc.) — keep materials/parts modular.
- **Mobile budget is sacred:** every asset must earn 60fps on a phone. Low-poly,
  shared/atlased PBR materials, **KTX2/Basis-compressed** textures, GLB Draco/
  meshopt compression.

---

## 1. Toolchain on the Spark

- **3D model gen:** Meshy / Tripo (fast, game-ready, auto-rig) for characters +
  props; Rodin for hero pieces. (See the earlier research: Tripo = clean quads +
  rig, Meshy = speed + great PBR, Rodin = hero quality.) Use their **REST APIs**
  for batch.
- **Textures/materials:** generate (or pull CC0 from Poly Haven / ambientCG /
  Kenney / Quaternius) cobblestone, terracotta tile, stucco, flagstone, wood —
  albedo + normal + roughness, tiling, power-of-two.
- **Cleanup / retopo / rig / export:** **Blender + Blender-MCP** (agentic) — decimate
  to budget, fix topology, ensure a humanoid rig + the 4 animations, bake/atlas
  materials, **export glTF 2.0 (.glb)** with Draco/meshopt + KTX2 textures.
- **Pipeline shape:** the AGENT designs + validates the recipe; a **deterministic
  worker** does the batch (don't burn agent tokens per asset). Job spec in → GLB +
  texture set + a manifest entry out.

---

## 2. First batch (prove the look, then scale)

Generate this concrete starter set, validate it renders at budget, then scale:

**Characters (the kit):**
- 1 **base bubble-body** (neutral), rigged, with idle/walk/talk/wave.
- Swappable parts as separate meshes/morphs that fit the base socket points:
  hair (6 styles), hats (8: straw, tricorn, kerchief, bonnet, feathered…),
  tops (8), bottoms (4), outers/coats (4), accessories (6: satchel, basket,
  spectacles, quill…), aprons (2).
- Tintable materials (skin, hair, each clothing layer) so color variety is a
  shader param, not new geometry.

**Buildings (modular kit):**
- Wall modules (1/2/3-storey), 4 roof types (gabled / hipped / **tiled** / domed
  chapel), door + shuttered-window pieces, awning, hanging sign, balcony, stoop.
  Snap to the existing blocker footprints.

**Props:** street lamp, tree, potted palm, market stall, crate/barrel/sack, bench,
fountain, signpost, bunting — match the current dressing catalog ids.

**Materials/texture sets:** cobblestone, terracotta tile, stucco, flagstone, wood.

---

## 3. Output contract (so it drops straight into the game)

- **Models:** `.glb` (glTF 2.0), Draco or meshopt compressed, +Y up, 1 unit = 1m,
  origin at the feet/footprint for characters/buildings.
- **Textures:** KTX2 (UASTC/ETC1S), power-of-two, ≤1024 for hero / ≤512 for props.
- **Layout:** `art/3d/characters/`, `art/3d/buildings/`, `art/3d/props/`,
  `art/3d/materials/` — plus an **`assets-manifest.json`** mapping our existing ids
  → GLB/material paths (character part ids match `CharacterSpec` slots; building
  kit ids match the `BuildingKind`s; prop ids match the dressing catalog). The
  `create3DLook()` implementation reads this manifest; nothing else changes.
- **Delivery:** these ship as a downloadable **asset pack** (the pack already has a
  two-zip streaming installer + CDN, SHA-256 verified) — NOT bundled in the app
  payload. Push the batch to the asset CDN; the Look downloads on first 3D session.

---

## 4. Directions for the Spark agent (paste this as its task)

> You are an asset-generation agent on a DGX Spark for "Corpan City". Read this
> brief (`docs/SPARK_ASSETS.md`) and the style guide. (1) Stand up the toolchain
> (Meshy/Tripo/Rodin API keys, Blender + Blender-MCP, KTX2/Draco exporters).
> (2) Produce the **First Batch** in §2 to the **Output Contract** in §3, matching
> our existing `CharacterSpec` part slots, `BuildingKind`s, and dressing ids.
> (3) Build the **deterministic batch worker** (job-spec → GLB+textures+manifest)
> so we can scale to hundreds of variants without per-asset agent calls.
> (4) Validate each asset at the mobile budget (tris/texture/draw) and render a
> turntable PNG for QA. (5) Emit `assets-manifest.json`. Report the batch, the
> worker, perf, and turntables. Keep everything wholesome + warm-colonial +
> consistent; bubble-people must be adorable and readable at small size.

When this batch lands, the Corpan City `create3DLook()` (a new `WorldLook`
implementation) points at the manifest and the whole town + crowd become 3D —
zero changes to map/crowd/dialogue/challenges/items/shell.
