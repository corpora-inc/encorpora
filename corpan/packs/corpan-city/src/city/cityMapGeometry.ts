import type { MapGeometry, MapRect } from "../contracts/runtime"
import type { CityLayout } from "./layout"

/**
 * city/cityMapGeometry.ts — derive the MAP's static geometry (#35: water +
 * building footprints) from the streaming `CityLayout`, so the full map / minimap
 * draw the SAME water and blockers the world's collision + placement use. The map
 * was a bare beige grid because its `MapView.topology.blockers` is empty (collision
 * comes from the streaming field) and topology carries no water.
 *
 * Pure data, world XZ rects. Computed ONCE at city mount (the layout is static),
 * handed to the MapView producer (game.ts) as `getMapGeometry()`.
 *
 * - WATER: every chunk's open-water footprints (`CityChunk.water`), each a
 *   `{x0,x1,z0,z1}` rect. The bridge GAP carved into a rect is intentionally NOT
 *   subtracted on the map — at map scale a hairline gap would be invisible noise;
 *   the crossing reads from the bridge anchor/POI instead.
 * - BLOCKERS: every chunk's building footprints (`CityBuilding{x,z,w,d}` → a
 *   centered rect). These are the solid masses the player routes around, so the
 *   map shows the street network as the negative space between them.
 */
export function cityMapGeometry(layout: CityLayout): MapGeometry {
  const water: MapRect[] = []
  const blockers: MapRect[] = []
  for (const chunk of layout.chunks) {
    for (const w of chunk.water) {
      water.push({ x0: w.x0, x1: w.x1, z0: w.z0, z1: w.z1 })
    }
    for (const b of chunk.buildings) {
      blockers.push({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 })
    }
  }
  return { water, blockers }
}
