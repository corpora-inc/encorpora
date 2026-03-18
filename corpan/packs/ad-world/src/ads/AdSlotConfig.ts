export type BillboardConfig = {
  id: string
  /** Babylon.js units for the mesh */
  width: number
  height: number
  /** World position */
  x: number
  y: number
  z: number
  /** Y-axis rotation in radians */
  rotationY: number
  /** Neon frame color */
  color: { r: number; g: number; b: number }
  /** GPT ad size in pixels */
  adWidth: number
  adHeight: number
}

/**
 * Billboard layout — positioned around the world.
 * Each has a physical size (Babylon units), position, rotation, and ad pixel size.
 */
export const BILLBOARD_LAYOUT: BillboardConfig[] = [
  // Straight ahead — large leaderboard
  {
    id: "hero",
    width: 5,
    height: 0.7,
    x: 0,
    y: 3.5,
    z: -8,
    rotationY: 0,
    color: { r: 0, g: 0.8, b: 1 },
    adWidth: 728,
    adHeight: 90,
  },
  // Right side — medium rectangle (poster)
  {
    id: "poster-r1",
    width: 2.4,
    height: 2,
    x: 8,
    y: 2.5,
    z: -3,
    rotationY: -Math.PI / 4,
    color: { r: 1, g: 0, b: 0.6 },
    adWidth: 300,
    adHeight: 250,
  },
  // Left side — skyscraper
  {
    id: "sky-l1",
    width: 1.2,
    height: 4.5,
    x: -7,
    y: 3,
    z: 2,
    rotationY: Math.PI / 5,
    color: { r: 0.4, g: 0, b: 1 },
    adWidth: 160,
    adHeight: 600,
  },
  // Far right — mobile banner (small sign)
  {
    id: "sign-r2",
    width: 2.5,
    height: 0.4,
    x: 12,
    y: 2,
    z: 5,
    rotationY: -Math.PI / 3,
    color: { r: 0, g: 1, b: 0.5 },
    adWidth: 320,
    adHeight: 50,
  },
  // Behind and left — medium rectangle
  {
    id: "poster-l2",
    width: 2.4,
    height: 2,
    x: -10,
    y: 3,
    z: -5,
    rotationY: Math.PI / 4,
    color: { r: 1, g: 0.3, b: 0 },
    adWidth: 300,
    adHeight: 250,
  },
  // Deep — large leaderboard on distant building
  {
    id: "far-banner",
    width: 6,
    height: 0.8,
    x: 5,
    y: 5,
    z: 15,
    rotationY: -Math.PI / 8,
    color: { r: 0.8, g: 0, b: 1 },
    adWidth: 728,
    adHeight: 90,
  },
  // Nearby right — another poster
  {
    id: "poster-r3",
    width: 2.4,
    height: 2,
    x: 6,
    y: 2.5,
    z: 10,
    rotationY: -Math.PI / 2,
    color: { r: 0, g: 0.6, b: 1 },
    adWidth: 300,
    adHeight: 250,
  },
  // Left path — small banner
  {
    id: "sign-l3",
    width: 2.5,
    height: 0.4,
    x: -8,
    y: 2,
    z: 12,
    rotationY: Math.PI / 3,
    color: { r: 1, g: 1, b: 0 },
    adWidth: 320,
    adHeight: 50,
  },
]
