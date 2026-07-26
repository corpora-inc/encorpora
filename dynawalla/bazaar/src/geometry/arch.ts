/**
 * Two real two-centred arches. Every arched opening in the bazaar is one of
 * these; nothing is a rounded rectangle pretending.
 *
 *   drop arch          centres ±w/6, R = 2w/3, rise = √15·w/6 ≈ 0.645·w
 *                      — stall niches, muqarnas cells
 *   equilateral point  centres ±w/2, R = w,    rise = w√3/2  ≈ 0.866·w
 *                      — ward gates, dome soffits, caravanserai arcades
 */

export type ArchKind = "drop" | "equilateral";

export const archRise = (kind: ArchKind, w: number): number =>
  kind === "drop" ? (Math.sqrt(15) * w) / 6 : (w * Math.sqrt(3)) / 2;

/**
 * Trace the arch from the left springing point up over the apex to the right
 * springing point. `y` is the springing line; the arch rises to smaller y.
 */
export function archPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  w: number,
  kind: ArchKind,
): void {
  const R = kind === "drop" ? (2 * w) / 3 : w;
  const c = kind === "drop" ? w / 6 : w / 2;
  const rise = archRise(kind, w);
  // The left half is struck from the RIGHT centre, and vice versa — that is
  // what makes it two-centred rather than a semicircle with a kink.
  const leftCentre = { x: cx - c, y };
  const rightCentre = { x: cx + c, y };
  // Canvas y grows downward, so increasing angle sweeps visually clockwise:
  // both halves run in increasing angle, up over the apex.
  const aApex = Math.atan2(-rise, -c);
  ctx.arc(rightCentre.x, rightCentre.y, R, Math.PI, aApex, false);
  const bApex = Math.atan2(-rise, c);
  ctx.arc(leftCentre.x, leftCentre.y, R, bApex, 0, false);
}

/** A closed niche: springing line, arch, and back down. */
export function nichePath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  yBase: number,
  w: number,
  h: number,
  kind: ArchKind,
): void {
  const half = w / 2;
  const spring = yBase - h;
  ctx.beginPath();
  ctx.moveTo(cx - half, yBase);
  ctx.lineTo(cx - half, spring);
  archPath(ctx, cx, spring, w, kind);
  ctx.lineTo(cx + half, yBase);
  ctx.closePath();
}
