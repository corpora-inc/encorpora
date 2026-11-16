/**
 * Rules the layout sweep (scripts/verify-layout-sweep.ts) applies in the
 * page, kept here as plain functions so they can be tested on their own.
 * The sweep hands each one to the page by its source: no imports, no
 * closures.
 */

/** A full-screen frame (the practice screen): fixed, the window's size. Its
 * one scroll region (the problem area) is allowed when it is the page's only
 * vertical scroll, the page itself never scrolls, and every control outside
 * the region (the answer controls) stays in view. */
export function frameRegionAllowed(facts: {
  /** The page itself scrolls up and down. */
  pageScrolls: boolean;
  /** Vertical scroll regions inside the frame, not counting allowed ones. */
  regions: number;
  /** Every control in the frame but outside the region is in the window. */
  controlsInView: boolean;
}): boolean {
  return !facts.pageScrolls && facts.regions === 1 && facts.controlsInView;
}
