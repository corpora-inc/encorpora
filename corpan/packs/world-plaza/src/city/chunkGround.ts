import type { GroundRegion, SurfaceName } from "../render/materials"
import type { GroundBakeRequest } from "./cityCache"
import type { CityChunk, CitySurface } from "./layout"

/**
 * city/chunkGround.ts — build the BAKE REQUEST for a chunk's single ground mesh
 * (the §2 z-fight rule: roads are BAKED into the one ground texture, never
 * overlaid).
 *
 * SMOOTH-STREAMING CHANGE. The painting itself (the ~25ms DynamicTexture
 * composite) is no longer done per chunk here. Instead this module produces a
 * translation-INVARIANT bake request — regions in chunk-LOCAL coords (centered
 * on the chunk) plus a stable fingerprint `key` — and hands it to the shared
 * `CityCache.groundFor`. Two chunks whose ground would bake pixel-identically
 * (same zone base + same local road/plaza layout + same palette) share ONE baked
 * texture+material; each just stamps a cheap `CreateGround` mesh at its center.
 * The expensive paint happens once per DISTINCT ground, not once per chunk.
 *
 * SURFACE MAPPING. `bakeGround` knows the six warm `SurfaceName`s. The city adds
 * two visual surfaces — `grass` and `water` — expressed by REUSING existing
 * swatch painters under a per-chunk PALETTE tuned to the chunk's zone:
 *   • grass → the `dirt` painter recolored green (a soft mottled lawn);
 *   • water → the `flagstone` painter recolored a hazy blue (calm dock water).
 *
 * WORKER SEAM: the only paint lives inside `bakeGround` (called by the cache);
 * this module is pure data prep, so the later OffscreenCanvas-worker stage only
 * needs to relocate `bakeGround`, not this.
 */

/** Map a city surface to the `bakeGround` SurfaceName that paints it. */
function surfaceName(s: CitySurface): SurfaceName {
  switch (s) {
    case "grass":
      return "dirt" // dirt painter, recolored green via palette
    case "water":
      return "flagstone" // flagstone painter, recolored blue via palette
    case "cobble":
      return "cobble"
    case "flagstone":
      return "flagstone"
    case "stone":
      return "stone"
    case "dirt":
    default:
      return "dirt"
  }
}

/**
 * A per-chunk palette tuned by zone. We bias the `dirt`/`ground` and `plaza`
 * colors so the reused painters read as grass / water / warm street earth for
 * that district, while cobble/stone keep the warm city key.
 */
function chunkPalette(chunk: CityChunk, base?: Record<string, string>): Record<string, string> {
  const p: Record<string, string> = { ...(base ?? {}) }
  const usesGrass = chunk.ground.some((g) => g.surface === "grass") || chunk.zone === "park"
  const usesWater = chunk.ground.some((g) => g.surface === "water")
  // base ground (the `dirt` SurfaceName) → green lawn in parks, warm earth else.
  p.ground = usesGrass ? "#7da25a" : (base?.ground ?? "#cdbf9f")
  // `flagstone`/`plaza` color → hazy dock blue where water is painted, warm
  // flagstone otherwise. (Water and plaza never coexist in one chunk: the plaza
  // disc is centered far from the waterfront, so this single bias is safe.)
  if (usesWater) {
    p.plaza = "#7fb3c4"
    p.groundAlt = "#7fb3c4"
  } else {
    p.plaza = base?.plaza ?? "#e3d3ad"
  }
  return p
}

/** Round a coord into the cache fingerprint at 0.1u so float noise doesn't bust
 *  otherwise-identical layouts into separate bakes. */
const q = (n: number): number => Math.round(n * 10) / 10

/**
 * Produce the translation-invariant bake request + center for a chunk's ground.
 * The bake bounds are a LOCAL box centered on (0,0); regions are shifted into
 * that local frame so two chunks with the same layout produce the same `key` and
 * share one baked ground. The returned `center` positions the stamped mesh in
 * the world.
 */
export function chunkGroundRequest(
  chunk: CityChunk,
  baseSurface: CitySurface,
  palette?: Record<string, string>,
): { request: GroundBakeRequest; center: { x: number; z: number } } {
  const b = chunk.bounds
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2

  // LOCAL bounds centered on origin (translation-invariant for caching).
  const localBounds = { minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2 }

  // translate city ground regions → bakeGround regions, shifted to local coords.
  const regions: GroundRegion[] = chunk.ground.map((g) =>
    g.kind === "rect"
      ? {
          kind: "rect",
          surface: surfaceName(g.surface),
          cx: g.cx - cx,
          cz: g.cz - cz,
          w: g.w,
          d: g.d,
          metersPerTile: g.metersPerTile,
        }
      : {
          kind: "disc",
          surface: surfaceName(g.surface),
          cx: g.cx - cx,
          cz: g.cz - cz,
          r: g.r,
          metersPerTile: g.metersPerTile,
        },
  )

  const pal = chunkPalette(chunk, palette)
  const base = { surface: surfaceName(baseSurface), metersPerTile: baseSurface === "grass" ? 8 : 6 }

  // Fingerprint: zone + base + every (local) region + the palette keys that
  // actually steer the paint. Identical fingerprints → one shared baked ground.
  const palKey = `${pal.ground}|${pal.plaza}|${pal.groundAlt ?? ""}|${palette?.road ?? ""}|${palette?.roadEdge ?? ""}|${palette?.stone ?? ""}`
  const regKey = regions
    .map((r) =>
      r.kind === "rect"
        ? `R${r.surface}:${q(r.cx)}:${q(r.cz)}:${q(r.w)}:${q(r.d)}:${r.metersPerTile}`
        : `D${r.surface}:${q(r.cx)}:${q(r.cz)}:${q(r.r)}:${r.metersPerTile}`,
    )
    .join(";")
  const key = `${chunk.zone}|${base.surface}:${base.metersPerTile}|${q(w)}x${q(d)}|${palKey}|${regKey}`

  return {
    request: {
      key,
      bounds: localBounds,
      base,
      regions,
      palette: pal,
      // chunks are small; keep texels modest so streamed grounds stay light.
      // 512² cap (was 1024²): the ground bake set was ~28 textures × 1024² ≈
      // 150 MB; halving the edge is 4× less (~38 MB) and the warm-graded cobble
      // reads fine under the cruise camera (not a top-down close-up).
      texelsPerUnit: 6,
      maxEdge: 512,
    },
    center: { x: cx, z: cz },
  }
}
