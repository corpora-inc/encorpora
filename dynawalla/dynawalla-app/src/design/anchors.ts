// Anchors: the three places the reaction stage is allowed to draw.
//
// A class name is a poor coupling and a deliberate one. The alternative is the
// reaction layer holding refs to the answer row and the rosette, which means
// the work surface and the world both handing pieces of themselves to something
// that must never be able to reach back into either (`Q-05`). A marker class
// is one-way: whatever draws puts one on, the stage measures whatever it finds,
// and neither side imports the other.
//
// They style nothing. `rg dw-anchor- src/**/*.css` returns nothing, and that is
// the invariant — the moment one of these carries a rule, removing it from an
// element silently changes the picture as well as the reaction.

/** The answer row: where the child's answer seats. */
export const ANCHOR_SEAT = "dw-anchor-seat"

/** The construction band. */
export const ANCHOR_CARTOUCHE = "dw-anchor-cartouche"

/** The aperture cut by the answer just given. */
export const ANCHOR_APERTURE = "dw-anchor-aperture"

export const ANCHORS: readonly string[] = [ANCHOR_SEAT, ANCHOR_CARTOUCHE, ANCHOR_APERTURE]
