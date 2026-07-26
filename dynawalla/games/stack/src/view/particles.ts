/**
 * Two pooled systems, both allocation-free after construction:
 *
 *   Sparks  — additive point sprites. Impact dust, perfect-strike sparks, and
 *             the ambient motes that give each stratum its weather.
 *   Fallers — real boxes with angular velocity, for the sheared overhang and
 *             the chunks a cracked slab throws. PERMANENCE: they survive the
 *             moment that made them and tumble past the camera into the dark.
 *
 * Live particles are kept dense at the head of the buffers with a swap-remove,
 * so the draw range is exactly the live count and the GPU never sees a dead one.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import { glowTexture } from "./textures.ts";

const SPARK_VERT = /* glsl */ `
precision highp float;
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
uniform float uScale;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uScale / max(0.15, -mv.z), 1.0, 190.0);
  gl_Position = projectionMatrix * mv;
}
`;

const SPARK_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
uniform sampler2D uTex;
void main() {
  float a = texture2D(uTex, gl_PointCoord).a * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`;

export type SparkOpts = {
  count: number;
  color: number;
  color2?: number;
  speed: number;
  speedJitter?: number;
  /** 0 = flat ring, 1 = full sphere. */
  dome?: number;
  size: number;
  sizeJitter?: number;
  life: number;
  lifeJitter?: number;
  gravity: number;
  drag: number;
  /** Extra outward radius at birth. */
  radius?: number;
  /** Persistent weather rather than a burst. */
  ambient?: boolean;
};

export class Sparks {
  readonly points: Points;
  private geo: BufferGeometry;
  private mat: ShaderMaterial;
  private cap: number;
  private n = 0;

  private pos: Float32Array;
  private col: Float32Array;
  private siz: Float32Array;
  private alp: Float32Array;

  private vel: Float32Array;
  private life: Float32Array;
  private life0: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private size0: Float32Array;
  private flags: Uint8Array; // 1 = ambient (wraps instead of dying)

  private tmpC = new Color();

  constructor(cap: number) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.siz = new Float32Array(cap);
    this.alp = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.life0 = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    this.size0 = new Float32Array(cap);
    this.flags = new Uint8Array(cap);

    this.geo = new BufferGeometry();
    const pa = new BufferAttribute(this.pos, 3);
    const ca = new BufferAttribute(this.col, 3);
    const sa = new BufferAttribute(this.siz, 1);
    const aa = new BufferAttribute(this.alp, 1);
    pa.setUsage(DynamicDrawUsage);
    ca.setUsage(DynamicDrawUsage);
    sa.setUsage(DynamicDrawUsage);
    aa.setUsage(DynamicDrawUsage);
    this.geo.setAttribute("position", pa);
    this.geo.setAttribute("aColor", ca);
    this.geo.setAttribute("aSize", sa);
    this.geo.setAttribute("aAlpha", aa);
    this.geo.setDrawRange(0, 0);
    this.geo.boundingSphere = null;

    this.mat = new ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      uniforms: { uTex: { value: glowTexture() }, uScale: { value: 340 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
  }

  setScale(px: number): void {
    this.mat.uniforms.uScale!.value = px;
  }

  get live(): number {
    return this.n;
  }

  clearAmbient(): void {
    for (let i = this.n - 1; i >= 0; i--) if (this.flags[i]) this.kill(i);
  }

  private kill(i: number): void {
    const last = --this.n;
    if (i !== last) this.copy(last, i);
  }

  private copy(from: number, to: number): void {
    this.pos[to * 3] = this.pos[from * 3]!;
    this.pos[to * 3 + 1] = this.pos[from * 3 + 1]!;
    this.pos[to * 3 + 2] = this.pos[from * 3 + 2]!;
    this.col[to * 3] = this.col[from * 3]!;
    this.col[to * 3 + 1] = this.col[from * 3 + 1]!;
    this.col[to * 3 + 2] = this.col[from * 3 + 2]!;
    this.vel[to * 3] = this.vel[from * 3]!;
    this.vel[to * 3 + 1] = this.vel[from * 3 + 1]!;
    this.vel[to * 3 + 2] = this.vel[from * 3 + 2]!;
    this.siz[to] = this.siz[from]!;
    this.alp[to] = this.alp[from]!;
    this.life[to] = this.life[from]!;
    this.life0[to] = this.life0[from]!;
    this.grav[to] = this.grav[from]!;
    this.drag[to] = this.drag[from]!;
    this.size0[to] = this.size0[from]!;
    this.flags[to] = this.flags[from]!;
  }

  emit(x: number, y: number, z: number, o: SparkOpts): void {
    const dome = o.dome ?? 0;
    const rad = o.radius ?? 0;
    for (let k = 0; k < o.count; k++) {
      if (this.n >= this.cap) {
        // Recycle the oldest burst particle rather than dropping the event —
        // a capped system must still show SOMETHING at the moment of impact.
        let oldest = 0;
        let bestT = 1e9;
        for (let i = 0; i < this.n; i += 7) {
          if (!this.flags[i] && this.life[i]! < bestT) {
            bestT = this.life[i]!;
            oldest = i;
          }
        }
        this.kill(oldest);
      }
      const i = this.n++;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * dome;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const horiz = 1 - up * 0.85;
      this.pos[i * 3] = x + ca * rad * Math.random();
      this.pos[i * 3 + 1] = y + (Math.random() - 0.3) * rad * 0.4;
      this.pos[i * 3 + 2] = z + sa * rad * Math.random();
      const sp = o.speed * (1 + (Math.random() - 0.5) * (o.speedJitter ?? 0.7));
      this.vel[i * 3] = ca * sp * horiz;
      this.vel[i * 3 + 1] = up * sp * 1.6 + (Math.random() - 0.35) * sp * 0.3;
      this.vel[i * 3 + 2] = sa * sp * horiz;
      this.tmpC.setHex(o.color2 !== undefined && Math.random() < 0.4 ? o.color2 : o.color);
      this.col[i * 3] = this.tmpC.r;
      this.col[i * 3 + 1] = this.tmpC.g;
      this.col[i * 3 + 2] = this.tmpC.b;
      const s = o.size * (1 + (Math.random() - 0.5) * (o.sizeJitter ?? 0.6));
      this.size0[i] = s;
      this.siz[i] = s;
      this.alp[i] = 1;
      const l = o.life * (1 + (Math.random() - 0.5) * (o.lifeJitter ?? 0.5));
      this.life[i] = l;
      this.life0[i] = l;
      this.grav[i] = o.gravity;
      this.drag[i] = o.drag;
      this.flags[i] = o.ambient ? 1 : 0;
    }
  }

  /** Ambient weather for a stratum: a slab of drifting motes around the camera. */
  seedMotes(camY: number, count: number, color: number, rise: number, drift: number, size: number): void {
    this.clearAmbient();
    for (let k = 0; k < count; k++) {
      if (this.n >= this.cap) break;
      const i = this.n++;
      this.pos[i * 3] = (Math.random() - 0.5) * 16;
      this.pos[i * 3 + 1] = camY + (Math.random() - 0.5) * 14;
      this.pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
      this.vel[i * 3] = (Math.random() - 0.5) * drift;
      this.vel[i * 3 + 1] = rise * (0.5 + Math.random());
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * drift;
      this.tmpC.setHex(color);
      this.col[i * 3] = this.tmpC.r;
      this.col[i * 3 + 1] = this.tmpC.g;
      this.col[i * 3 + 2] = this.tmpC.b;
      const s = size * (0.6 + Math.random() * 0.8);
      this.size0[i] = s;
      this.siz[i] = s;
      this.alp[i] = 0.15 + Math.random() * 0.6;
      this.life[i] = 1;
      this.life0[i] = 1;
      this.grav[i] = 0;
      this.drag[i] = 0.05;
      this.flags[i] = 1;
    }
  }

  update(dt: number, camY: number): void {
    for (let i = this.n - 1; i >= 0; i--) {
      const p = i * 3;
      if (this.flags[i]) {
        // Ambient: drift forever, wrapping around the camera's slab of air.
        this.pos[p] += this.vel[p]! * dt;
        this.pos[p + 1] += this.vel[p + 1]! * dt;
        this.pos[p + 2] += this.vel[p + 2]! * dt;
        const dy = this.pos[p + 1]! - camY;
        if (dy > 8) this.pos[p + 1] = camY - 8;
        else if (dy < -8) this.pos[p + 1] = camY + 8;
        if (this.pos[p]! > 9) this.pos[p] = -9;
        else if (this.pos[p]! < -9) this.pos[p] = 9;
        if (this.pos[p + 2]! > 9) this.pos[p + 2] = -9;
        else if (this.pos[p + 2]! < -9) this.pos[p + 2] = 9;
        continue;
      }
      const l = (this.life[i]! -= dt);
      if (l <= 0) {
        this.kill(i);
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i]! * dt);
      this.vel[p] = this.vel[p]! * d;
      this.vel[p + 1] = this.vel[p + 1]! * d - this.grav[i]! * dt;
      this.vel[p + 2] = this.vel[p + 2]! * d;
      this.pos[p] += this.vel[p]! * dt;
      this.pos[p + 1] += this.vel[p + 1]! * dt;
      this.pos[p + 2] += this.vel[p + 2]! * dt;
      const t = l / this.life0[i]!;
      this.alp[i] = t * t;
      this.siz[i] = this.size0[i]! * (0.35 + 0.65 * t);
    }
    this.geo.setDrawRange(0, this.n);
    (this.geo.getAttribute("position") as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("aColor") as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("aSize") as BufferAttribute).needsUpdate = true;
    (this.geo.getAttribute("aAlpha") as BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/* ── tumbling solids ──────────────────────────────────────────────────────── */

const M = new Matrix4();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3();
const E = new Vector3();

export class Fallers {
  readonly mesh: InstancedMesh;
  readonly material: MeshStandardMaterial;
  private cap: number;
  private n = 0;
  private p: Float32Array;
  private v: Float32Array;
  private s: Float32Array;
  private rot: Float32Array; // euler xyz
  private av: Float32Array;
  private life: Float32Array;
  private life0: Float32Array;
  private col = new Color();

  constructor(cap: number) {
    this.cap = cap;
    this.p = new Float32Array(cap * 3);
    this.v = new Float32Array(cap * 3);
    this.s = new Float32Array(cap * 3);
    this.rot = new Float32Array(cap * 3);
    this.av = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.life0 = new Float32Array(cap);
    this.material = new MeshStandardMaterial({ roughness: 0.66, metalness: 0.02 });
    this.mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), this.material, cap);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
  }

  setColor(hex: number): void {
    this.col.setHex(hex);
    this.material.color.copy(this.col);
  }

  launch(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    vx: number,
    vy: number,
    vz: number,
    spin: number,
    life: number,
  ): void {
    const i = this.n >= this.cap ? this.oldest() : this.n++;
    const q = i * 3;
    this.p[q] = x;
    this.p[q + 1] = y;
    this.p[q + 2] = z;
    this.v[q] = vx;
    this.v[q + 1] = vy;
    this.v[q + 2] = vz;
    this.s[q] = sx;
    this.s[q + 1] = sy;
    this.s[q + 2] = sz;
    this.rot[q] = 0;
    this.rot[q + 1] = 0;
    this.rot[q + 2] = 0;
    this.av[q] = (Math.random() - 0.5) * spin;
    this.av[q + 1] = (Math.random() - 0.5) * spin * 0.6;
    this.av[q + 2] = (Math.random() - 0.5) * spin;
    this.life[i] = life;
    this.life0[i] = life;
  }

  private oldest(): number {
    let best = 0;
    let t = 1e9;
    for (let i = 0; i < this.n; i++) if (this.life[i]! < t) ((t = this.life[i]!), (best = i));
    return best;
  }

  update(dt: number, gravity: number): void {
    for (let i = this.n - 1; i >= 0; i--) {
      const l = (this.life[i]! -= dt);
      if (l <= 0) {
        const last = --this.n;
        if (i !== last) {
          for (let k = 0; k < 3; k++) {
            this.p[i * 3 + k] = this.p[last * 3 + k]!;
            this.v[i * 3 + k] = this.v[last * 3 + k]!;
            this.s[i * 3 + k] = this.s[last * 3 + k]!;
            this.rot[i * 3 + k] = this.rot[last * 3 + k]!;
            this.av[i * 3 + k] = this.av[last * 3 + k]!;
          }
          this.life[i] = this.life[last]!;
          this.life0[i] = this.life0[last]!;
        }
        continue;
      }
      const q = i * 3;
      this.v[q + 1] -= gravity * dt;
      this.p[q] += this.v[q]! * dt;
      this.p[q + 1] += this.v[q + 1]! * dt;
      this.p[q + 2] += this.v[q + 2]! * dt;
      this.rot[q] += this.av[q]! * dt;
      this.rot[q + 1] += this.av[q + 1]! * dt;
      this.rot[q + 2] += this.av[q + 2]! * dt;

      const t = Math.min(1, l / Math.min(0.4, this.life0[i]!));
      E.set(this.rot[q]!, this.rot[q + 1]!, this.rot[q + 2]!);
      Q.setFromEuler(EULER.set(E.x, E.y, E.z));
      V.set(this.p[q]!, this.p[q + 1]!, this.p[q + 2]!);
      S.set(this.s[q]! * t, this.s[q + 1]! * t, this.s[q + 2]! * t);
      M.compose(V, Q, S);
      this.mesh.setMatrixAt(i, M);
    }
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    this.n = 0;
    this.mesh.count = 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}

import { Euler } from "three";
const EULER = new Euler();
