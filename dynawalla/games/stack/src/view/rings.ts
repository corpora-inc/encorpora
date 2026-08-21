/**
 * Shockwave rings: a flat annulus that snaps out from the point of contact and
 * dies in half a second.
 *
 * It is the cheapest large-scale juice there is — one additive draw call per
 * ring, no lighting, no depth write — and it is the thing that makes a big
 * combo read as an EVENT at arm's length rather than as a slightly brighter
 * particle burst. Pooled; nothing is allocated after construction.
 */

import { AdditiveBlending, Color, Mesh, MeshBasicMaterial, Object3D, RingGeometry } from "three";

const GEO = new RingGeometry(0.72, 1.0, 64, 1);
GEO.rotateX(-Math.PI / 2);

type Ring = {
  mesh: Mesh<RingGeometry, MeshBasicMaterial>;
  life: number;
  life0: number;
  from: number;
  to: number;
  peak: number;
  tilt: number;
};

export class Rings {
  readonly group = new Object3D();
  private pool: Ring[] = [];
  private next = 0;
  private c = new Color();

  constructor(count = 5) {
    for (let i = 0; i < count; i++) {
      const mesh = new Mesh(
        GEO,
        new MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: false,
          fog: false,
          opacity: 0,
        }),
      );
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 6;
      this.group.add(mesh);
      this.pool.push({ mesh, life: 0, life0: 1, from: 0.3, to: 3, peak: 1, tilt: 0 });
    }
  }

  fire(
    x: number,
    y: number,
    z: number,
    color: number,
    from: number,
    to: number,
    life: number,
    peak: number,
    tilt = 0,
  ): void {
    const r = this.pool[this.next]!;
    this.next = (this.next + 1) % this.pool.length;
    r.mesh.position.set(x, y, z);
    r.mesh.rotation.set(tilt, 0, 0);
    this.c.setHex(color);
    r.mesh.material.color.copy(this.c);
    r.life = life;
    r.life0 = life;
    r.from = from;
    r.to = to;
    r.peak = peak;
    r.tilt = tilt;
    r.mesh.visible = true;
  }

  update(dt: number): void {
    for (const r of this.pool) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.mesh.visible = false;
        r.mesh.material.opacity = 0;
        continue;
      }
      const t = 1 - r.life / r.life0;
      // Fast out, slow settle — the ring should feel like it was PUNCHED out.
      const e = 1 - Math.pow(1 - t, 3.2);
      const s = r.from + (r.to - r.from) * e;
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = r.peak * (1 - t) * (1 - t);
    }
  }

  clear(): void {
    for (const r of this.pool) {
      r.life = 0;
      r.mesh.visible = false;
    }
  }

  dispose(): void {
    for (const r of this.pool) r.mesh.material.dispose();
    this.pool.length = 0;
    this.group.clear();
  }
}

export function disposeRingGeometry(): void {
  GEO.dispose();
}
