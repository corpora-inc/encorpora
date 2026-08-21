import * as THREE from "three";

/**
 * World space <-> screen space, at one depth on the causeway.
 *
 * This exists because of a bug that made the whole game unplayable, and the bug
 * is worth writing down.
 *
 * The three gate candidates used to be placed in world space, at the lanes,
 * fanned outward by a factor that grew with distance. That cannot work, and no
 * amount of tuning makes it work: the camera sits 11.4 units behind a causeway
 * whose lanes are 3.35 units apart, so the *widest* the lane pitch ever gets on
 * screen is about 12% of the viewport — and only in the last third of a second
 * before the gate arrives. For the whole reading window the three numerals were
 * a few dozen pixels apart, and two-digit values ran together into one string:
 * 13 | 42 | 36 read as "134236". On a 390px phone the fan-out compensation
 * overshot the other way and pushed the third numeral off the right edge.
 *
 * Perspective is the wrong tool for laying out text a child has 0.45s to read.
 * So the numerals are laid out in *screen* units — an explicit pitch, an
 * explicit gutter, an explicit page margin — and this class converts that layout
 * back into the world positions the instanced digit shader wants, so they still
 * fog, still bend with the causeway, still belong to the world.
 *
 * `at()` linearises the projection around a depth. It is exact for the camera
 * pointing straight down -z and a few tenths of a percent off under the small
 * yaw the chase camera applies, which is far inside the gutter.
 */
export class Projector {
  private vp = new THREE.Matrix4();
  private v = new THREE.Vector3();
  private bendX = 0;
  private bendY = 0;

  /** NDC x of pre-bend world x = 0, at the last `at()` depth. */
  x0 = 0;
  /** NDC x per world unit. */
  kx = 1;
  /** NDC y of world y = 0. */
  y0 = 0;
  /** NDC y per world unit. */
  ky = 1;

  /** Call once per frame, after the camera is posed. */
  update(camera: THREE.PerspectiveCamera, bendX: number, bendY: number): void {
    camera.updateMatrixWorld(true);
    this.vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.bendX = bendX;
    this.bendY = bendY;
  }

  /**
   * Linearise at world depth `z`, referenced around height `yRef`.
   *
   * The baseline is deliberately wide (12 units, about the span the numeral row
   * actually occupies) rather than a unit step, so the secant it measures is the
   * one the layout will use instead of a tangent at the centre.
   */
  at(z: number, yRef: number): void {
    const d = Math.max(0, -z);
    const k = d * d;
    const bx = this.bendX * k;
    const by = this.bendY * k;
    const B = 6;
    const v = this.v;
    const vp = this.vp;

    v.set(bx, yRef + by, z).applyMatrix4(vp);
    this.x0 = v.x;
    const centreY = v.y;

    v.set(B + bx, yRef + by, z).applyMatrix4(vp);
    const right = v.x;
    v.set(-B + bx, yRef + by, z).applyMatrix4(vp);
    const left = v.x;
    let kx = (right - left) / (2 * B);
    if (!Number.isFinite(kx) || Math.abs(kx) < 1e-6) kx = 1e-6;
    this.kx = kx;

    v.set(bx, yRef + B + by, z).applyMatrix4(vp);
    const up = v.y;
    v.set(bx, yRef - B + by, z).applyMatrix4(vp);
    const down = v.y;
    let ky = (up - down) / (2 * B);
    if (!Number.isFinite(ky) || Math.abs(ky) < 1e-6) ky = 1e-6;
    this.ky = ky;

    // Re-anchor to world y = 0 using the measured slope.
    this.y0 = centreY - ky * yRef;
  }

  /** Pre-bend world x whose rendered position lands at NDC `ndcX`. */
  worldX(ndcX: number): number {
    return (ndcX - this.x0) / this.kx;
  }

  /** Pre-bend world y whose rendered position lands at NDC `ndcY`. */
  worldY(ndcY: number): number {
    return (ndcY - this.y0) / this.ky;
  }

  /** NDC y of a world height, at the current depth. */
  ndcY(worldY: number): number {
    return this.y0 + this.ky * worldY;
  }

  /** World size that renders `n` NDC units tall at the current depth. */
  worldFromNdcY(n: number): number {
    return n / Math.abs(this.ky);
  }
}
