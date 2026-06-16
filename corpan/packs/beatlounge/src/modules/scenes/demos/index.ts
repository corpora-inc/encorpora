/**
 * beatlounge — DEMOS public surface. Import from here:
 *   `import { DEMO_SONGS, getDemo, compileDemo } from ".../demos"`
 */

import { DEMO_SPECS } from "./catalog"
import type { DemoSongSpec } from "./types"

export { compileDemo, validateDemo } from "./compile"
export type { DemoSongSpec, DemoTrackSpec, DemoNote } from "./types"

/** Every shipped demo, in catalog order. */
export const DEMO_SONGS: readonly DemoSongSpec[] = DEMO_SPECS

/** Look up a demo by id (undefined if unknown). */
export const getDemo = (id: string): DemoSongSpec | undefined =>
  DEMO_SONGS.find((d) => d.id === id)
