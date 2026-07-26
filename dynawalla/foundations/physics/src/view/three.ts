// Three.js binding: 2D physics, 3D presentation.
//
// The solver runs in 2D because a marketplace of maths games is a side-on
// world and 2D is 5-10x cheaper per body — but nothing about that forces flat
// PRESENTATION. Bodies are extruded in Z, lit by a real key light, and shot
// with a perspective camera on a slight tilt. That is where the production
// value comes from, and it costs the physics budget exactly nothing.
//
// The whole binding is instanced. One InstancedMesh per shape class, one
// `setMatrixAt` per body per frame, one draw call each. The alternative — a
// Mesh per body — is what makes a physics demo drop to 30 fps at 300 bodies on
// a tablet, and it is drawn from the same `transforms` Float32Array the world
// already fills, so there is no intermediate object per body anywhere.

import * as THREE from "three"
import type { World } from "../world.ts"

export interface InstancedLayerOpts {
  /** How many instances to reserve. Growing an InstancedMesh means rebuilding it. */
  capacity: number
  geometry: THREE.BufferGeometry
  material: THREE.Material
  /** Extrusion depth. */
  depth?: number
}

/**
 * A pool of identical instanced bodies bound to physics indices.
 *
 * `sync` is deliberately index-based rather than handle-based: the world's
 * `transforms` array is already in body order, so a layer that owns a
 * contiguous slice of it can copy straight across with no lookup at all.
 */
export class InstancedLayer {
  readonly mesh: THREE.InstancedMesh
  private indices: number[] = []
  private m = new THREE.Matrix4()
  private q = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private s = new THREE.Vector3(1, 1, 1)
  private axis = new THREE.Vector3(0, 0, 1)

  constructor(o: InstancedLayerOpts) {
    this.mesh = new THREE.InstancedMesh(o.geometry, o.material, o.capacity)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.castShadow = true
    this.mesh.receiveShadow = true
    this.mesh.count = 0
    // A physics world has no idea where its bodies will fly, and a wrong
    // bounding sphere makes instances vanish at the screen edge — the single
    // most common instancing bug. Disabling culling for the layer is correct
    // here: it is one draw call either way.
    this.mesh.frustumCulled = false
  }

  /** Bind a physics body index to the next free instance. */
  track(bodyIndex: number, scale?: THREE.Vector3): number {
    this.indices.push(bodyIndex)
    const slot = this.indices.length - 1
    if (scale) this.mesh.setColorAt?.(slot, new THREE.Color(1, 1, 1))
    this.scales.push(scale ? scale.clone() : new THREE.Vector3(1, 1, 1))
    this.mesh.count = this.indices.length
    return slot
  }

  private scales: THREE.Vector3[] = []
  private offsets: Float32Array = new Float32Array(0)

  /**
   * Offset one instance from its body's origin, in WORLD axes.
   *
   * A compound collider is one body with several shapes, but the renderer gets
   * a single transform for it — so sub-shapes have to be re-placed here. The
   * caller supplies an already-rotated offset because only the caller knows
   * whether the offset is meant to ride the body's rotation (a pan lip) or not
   * (a screen-space label).
   */
  setOffset(slot: number, dx: number, dy: number) {
    if (this.offsets.length < this.indices.length * 2) {
      const n = new Float32Array(Math.max(this.indices.length * 2, 8))
      n.set(this.offsets)
      this.offsets = n
    }
    this.offsets[slot * 2] = dx
    this.offsets[slot * 2 + 1] = dy
  }

  setColor(slot: number, color: THREE.Color) {
    this.mesh.setColorAt(slot, color)
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  /** Copy this frame's interpolated transforms in. One pass, no allocation. */
  sync(world: World, z = 0) {
    const t = world.transforms
    for (let i = 0; i < this.indices.length; i++) {
      const b = this.indices[i]! * 4
      const cos = t[b + 2]!
      const sin = t[b + 3]!
      const ox = this.offsets.length > i * 2 ? this.offsets[i * 2]! : 0
      const oy = this.offsets.length > i * 2 ? this.offsets[i * 2 + 1]! : 0
      this.v.set(t[b]! + ox, t[b + 1]! + oy, z)
      // cos/sin straight to a quaternion about Z: half-angle from the double
      // angle, no atan2 in the hot loop.
      const c2 = Math.sqrt(Math.max(0, (1 + cos) * 0.5))
      const s2 = sin >= 0 ? Math.sqrt(Math.max(0, (1 - cos) * 0.5)) : -Math.sqrt(Math.max(0, (1 - cos) * 0.5))
      this.q.set(0, 0, s2, c2)
      this.s.copy(this.scales[i]!)
      this.m.compose(this.v, this.q, this.s)
      this.mesh.setMatrixAt(i, this.m)
    }
    this.mesh.instanceMatrix.needsUpdate = true
    void this.axis
  }
}

/**
 * The look. One place, so every prototype in the Bazaar inherits the same
 * lighting and nobody ships a scene lit with the Three.js defaults.
 *
 * Warm key from high left, cool rim from behind right, and a dim warm ambient
 * so shadowed faces read as brass rather than as black. Shadow map is 1024 and
 * tightly bounded — a default 512 shadow over a 40 m world is a staircase, and
 * a 2048 map is a real cost on a tablet for a difference nobody sees.
 */
export function bazaarLighting(scene: THREE.Scene, span = 22) {
  const key = new THREE.DirectionalLight(0xffd9a0, 3.4)
  key.position.set(-9, 16, 12)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  const c = key.shadow.camera as THREE.OrthographicCamera
  c.left = -span
  c.right = span
  c.top = span
  c.bottom = -span * 0.35
  c.near = 1
  c.far = 70
  // Without a bias, self-shadowing on the flat faces of extruded boxes shows
  // up as moire banding that looks like a texture bug.
  key.shadow.bias = -0.0015
  key.shadow.normalBias = 0.03
  scene.add(key)

  // Cool rim from behind: this is what separates a silhouette from the
  // backdrop and is most of the reason the scene reads as three-dimensional.
  const rim = new THREE.DirectionalLight(0x7fd4ff, 2.2)
  rim.position.set(11, 6, -10)
  scene.add(rim)

  // Warm bounce from below-front, standing in for light off the bazaar floor.
  const bounce = new THREE.DirectionalLight(0xff9a5c, 0.9)
  bounce.position.set(4, -6, 9)
  scene.add(bounce)

  scene.add(new THREE.HemisphereLight(0xffc98a, 0x2a1630, 1.1))
  return { key, rim, bounce }
}

/**
 * A gradient sky on a big inverted sphere, shaded in three lines of GLSL.
 *
 * A flat `setClearColor` is the single loudest tell that a WebGL scene is a
 * tech demo: real places have a horizon. This costs one draw call, no texture,
 * and no postprocessing pass — which matters because postprocessing is where
 * a tablet's fill rate actually dies.
 */
export function bazaarSky(scene: THREE.Scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x0d0713) },
      mid: { value: new THREE.Color(0x281030) },
      low: { value: new THREE.Color(0x5c2620) },
    },
    vertexShader: `varying vec3 vp;
      void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vp; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){
        float h = clamp(vp.y / 60.0 + 0.28, 0.0, 1.0);
        vec3 c = mix(low, mid, smoothstep(0.0, 0.42, h));
        c = mix(c, top, smoothstep(0.38, 1.0, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 16), mat)
  sky.frustumCulled = false
  scene.add(sky)
  return sky
}

/**
 * Fit a world-space rectangle to the viewport, whatever the aspect ratio.
 *
 * Hand-picked camera positions are how a demo ends up beautiful on the
 * developer's monitor and cropped in half on a tablet in portrait. Given the
 * box a scene must show, this solves for the distance that shows ALL of it on
 * BOTH axes and adds a margin — so a phone pulls back rather than cropping.
 */
export function frameCamera(
  camera: THREE.PerspectiveCamera,
  box: { cx: number; cy: number; halfW: number; halfH: number },
  aspect: number,
  margin = 1.12,
) {
  const vFov = (camera.fov * Math.PI) / 180
  const distForH = (box.halfH * margin) / Math.tan(vFov / 2)
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
  const distForW = (box.halfW * margin) / Math.tan(hFov / 2)
  const dist = Math.max(distForH, distForW)
  camera.position.set(box.cx, box.cy + box.halfH * 0.12, dist)
  camera.lookAt(box.cx, box.cy, 0)
  camera.updateProjectionMatrix()
  return dist
}

export const PALETTE = {
  night: 0x140d18,
  brass: 0xd9a441,
  copper: 0xc4693a,
  jade: 0x3fb59a,
  rose: 0xe0567a,
  bone: 0xefe3cf,
  ink: 0x2a1b2e,
} as const

export function standard(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.55,
    ...opts,
  })
}

/** Self-lit accent material — lamps, hot dominoes, the aiming arc. */
export function glow(color: number, strength = 1.6) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: strength,
    roughness: 0.35,
    metalness: 0.1,
  })
}
