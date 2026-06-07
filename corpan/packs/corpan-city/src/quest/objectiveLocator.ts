/**
 * objectiveLocator — resolve the LIVE world point of the current quest step's
 * objective NPC, for the road arrow + the objective beacon to point at.
 *
 * The objective NPC is stationed at the active step's anchor and HOVERS within a
 * small radius of it (crowd.ts stations a special — or a generic "objective"
 * agent — per step anchor). So "where is the objective" is the NPC's LIVE
 * position, not the static anchor: the beacon hovers over the actual person, and
 * the road arrow points at where they're standing right now. When (for any
 * reason) no agent is stationed at the anchor, we fall back to the static anchor
 * point so the wayfinding still aims at the right SPOT.
 *
 * Pure + tiny: given the live focusables, the current step's anchorId, and an
 * anchor-point resolver, it returns a `{ x, z }` or null. No DOM/host/storage.
 */

/** The minimal shape this locator reads from a crowd focus handle. */
export interface LiveFocusable {
  anchorId: string
  billboard: { root: { position: { x: number; z: number } } }
}

/**
 * Resolve the live world point of the objective NPC at `anchorId`.
 *
 * @param anchorId   the current step's anchor (objective), or null/undefined
 *                   when there is no active objective → returns null.
 * @param focusables the live crowd focus handles (read their CURRENT position).
 * @param anchorPoint fallback resolver: the static anchor's world point, or null.
 */
export function locateObjective(
  anchorId: string | null | undefined,
  focusables: readonly LiveFocusable[],
  anchorPoint: (id: string) => { x: number; z: number } | null,
): { x: number; z: number } | null {
  if (!anchorId) return null
  // The stationed objective NPC's handle.anchorId === the step anchor. There may
  // be several agents tagged with crowd ids; only a stationed special/objective
  // agent carries the step's anchorId, so the first match is the right person.
  const npc = focusables.find((f) => f.anchorId === anchorId)
  if (npc) {
    const p = npc.billboard.root.position
    return { x: p.x, z: p.z }
  }
  // No NPC placed there (e.g. an anchor with no stationed agent) → the static spot.
  return anchorPoint(anchorId)
}
