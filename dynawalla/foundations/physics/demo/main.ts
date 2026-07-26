// The runnable reference demo.
//
// Six scenes, each one a recipe from the kit rendered with the shared Bazaar
// look. It is also the perf harness: the HUD is live p99 step cost, awake body
// count and tier, and `?bench=<scene>` runs a fixed 600-frame measurement and
// prints JSON to the console, which is how bench/run-browser.mjs drives it.

import * as THREE from "three"
import { createWorld, FIXED_DT, type Bazaar } from "../src/index.ts"
import { InstancedLayer, SoftMesh, bazaarLighting, bazaarSky, bazaarEnvironment, frameCamera, standard, glow, PALETTE } from "../src/view/three.ts"

const canvas = document.createElement("canvas")
document.body.appendChild(canvas)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" })
renderer.shadowMap.enabled = true
// ACES + a lifted exposure. Three's default (NoToneMapping, exposure 1) is
// what makes an emissive-lit scene read as flat and muddy: highlights clip to
// the material colour instead of rolling off, so brass never looks like metal.
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.35
renderer.shadowMap.type = THREE.PCFSoftShadowMap
// Cap DPR at 2. A 3x phone renders 9x the pixels for a difference nobody can
// see at arm's length, and it is the single biggest free win on mobile.
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0x1e0d24, 26, 86)
bazaarLighting(scene)
bazaarSky(scene)
bazaarEnvironment(renderer, scene)

const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200)

// Backdrop: a few slabs standing in for the bazaar's minarets, far enough back
// to sit in the fog. Pure decoration, zero physics cost, and it is the
// difference between "a physics test" and "a place".
;(function backdrop() {
  // Minarets. Pushed back to z -26..-52 so they sit deep in the fog and read as
  // a skyline rather than as scenery the physics might touch, with emissive
  // window slits — the one cheap trick that turns a silhouette into a city.
  const g = new THREE.BoxGeometry(1, 1, 1)
  const towers = new THREE.InstancedMesh(g, standard(0x1b0f22, { roughness: 0.95, metalness: 0.05 }), 26)
  const windows = new THREE.InstancedMesh(g, glow(0xffb04a, 2.4), 130)
  const mat = new THREE.Matrix4()
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  let wi = 0
  for (let i = 0; i < 26; i++) {
    const h = 9 + rnd() * 26
    const x = -46 + i * 3.6 + rnd() * 1.8
    const z = -26 - rnd() * 26
    const wdt = 2.2 + rnd() * 3.2
    mat.compose(new THREE.Vector3(x, h / 2 - 1, z), new THREE.Quaternion(), new THREE.Vector3(wdt, h, 3))
    towers.setMatrixAt(i, mat)
    const rows = 2 + Math.floor(rnd() * 5)
    for (let r = 0; r < rows && wi < 130; r++, wi++) {
      mat.compose(
        new THREE.Vector3(x + (rnd() - 0.5) * wdt * 0.6, 1.5 + rnd() * (h - 3), z + 1.6),
        new THREE.Quaternion(),
        new THREE.Vector3(0.3, 0.75, 0.2),
      )
      windows.setMatrixAt(wi, mat)
    }
  }
  windows.count = wi
  towers.frustumCulled = false
  windows.frustumCulled = false
  scene.add(towers, windows)
})()

const floor = new THREE.Mesh(
  new THREE.BoxGeometry(120, 1, 16),
  standard(0x2d1a33, { roughness: 0.82, metalness: 0.18 }),
)
floor.position.set(0, -0.5, 0)
floor.receiveShadow = true
scene.add(floor)

// A warm strip along the front lip of the floor. Reads as bazaar lamplight and
// gives the ground plane an edge, which is what stops it looking infinite.
const lip = new THREE.Mesh(new THREE.BoxGeometry(120, 0.1, 0.3), glow(0xff8a3c, 2.2))
lip.position.set(0, 0.02, 7.9)
scene.add(lip)

// ---------------------------------------------------------------- scenes

interface Demo {
  label: string
  caption: string
  build(w: Bazaar, group: THREE.Group): (dt: number) => void
  /** The world-space rectangle this scene must always show, at any aspect. */
  frame: { cx: number; cy: number; halfW: number; halfH: number }
}

const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
CYL.rotateX(Math.PI / 2)

function boxLayer(group: THREE.Group, n: number, color: number, extras = {}) {
  const l = new InstancedLayer({ capacity: n, geometry: BOX, material: standard(color, extras) })
  group.add(l.mesh)
  return l
}
function discLayer(group: THREE.Group, n: number, color: number, extras = {}) {
  const l = new InstancedLayer({ capacity: n, geometry: CYL, material: standard(color, extras) })
  group.add(l.mesh)
  return l
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

// Scale helpers, because the two unit geometries do NOT share a convention and
// getting it wrong is silent: BoxGeometry(1,1,1) spans -0.5..0.5, so a box
// scales by its FULL extents; CylinderGeometry(1,1,1) has RADIUS 1, so a disc
// scales by its radius, not its diameter. Scaling a disc by `r * 2` draws it at
// double size — which is exactly what put the camera inside the gear train.
const boxScale = (halfW: number, halfH: number, depth: number) => V(halfW * 2, halfH * 2, depth)
const discScale = (radius: number, depth: number) => V(radius, radius, depth)

/**
 * Place two lip instances per pan in the PAN'S rotated frame.
 *
 * A compound collider is one physics body with several shapes, but the renderer
 * only gets one transform for it — so any sub-shape has to be re-offset here,
 * rotated by the body's own angle. Forgetting the rotation is the tell: lips
 * that stay vertical while the pan tilts.
 */
function lipOffsets(layer: InstancedLayer, w: Bazaar, panIndices: number[]) {
  const t = w.transforms
  let slot = 0
  for (const idx of panIndices) {
    const b = idx * 4
    const cos = t[b + 2]!
    const sin = t[b + 3]!
    for (const dx of [-0.92, 0.92]) {
      const dy = 0.3
      layer.setOffset(slot++, dx * cos - dy * sin, dx * sin + dy * cos)
    }
  }
}

const DEMOS: Record<string, Demo> = {
  scale: {
    label: "Balance scale",
    caption:
      "Four against five. The beam is real physics; the ANSWER is integer arithmetic — compare() never reads the beam angle.",
    frame: { cx: 0, cy: 3.55, halfW: 5.6, halfH: 2.5 },
    build(w, group) {
      w.ground(24)
      const scale = w.balanceScale({ at: [0, 0] })
      const frame = boxLayer(group, 8, PALETTE.brass, { metalness: 0.85, roughness: 0.3 })
      frame.track(scale.beam.index, V(6.4, 0.24, 0.55))
      const cubesL = boxLayer(group, 40, PALETTE.jade)
      const cubesR = boxLayer(group, 40, PALETTE.rose)
      const pans = boxLayer(group, 4, PALETTE.copper, { metalness: 0.9 })
      pans.track(scale.leftPan.index, V(2.0, 0.16, 0.9))
      pans.track(scale.rightPan.index, V(2.0, 0.16, 0.9))
      // The pan lips and the stirrups are real bodies; if they are not drawn the
      // scale reads as two planks floating under a bar, and the thing that
      // actually holds the load is invisible.
      const lips = boxLayer(group, 8, PALETTE.copper, { metalness: 0.9 })
      for (const pan of [scale.leftPan, scale.rightPan]) {
        lips.track(pan.index, V(0.16, 0.6, 0.9))
        lips.track(pan.index, V(0.16, 0.6, 0.9))
      }
      const stirrups = boxLayer(group, 4, PALETTE.brass, { metalness: 0.95, roughness: 0.25 })
      for (const st of scale.stirrups) stirrups.track(st.index, V(0.09, 1.3, 0.09))

      const post = new THREE.Mesh(new THREE.BoxGeometry(0.62, 5.2, 0.62), standard(0x7a3b26, { metalness: 0.5, roughness: 0.55 }))
      post.position.set(0, 2.6, 0)
      post.castShadow = true
      post.receiveShadow = true
      group.add(post)
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 12), glow(PALETTE.brass, 0.9))
      cap.position.set(0, 5.35, 0)
      group.add(cap)

      let t = 0
      let phase = 0
      // Load both pans AT ONCE, settle, then add the ninth cube.
      //
      // Two earlier versions of this choreography were wrong in the same way:
      // they fed the scale one cube at a time. But a scale holding 1 against 0
      // is at a total imbalance and slams to its limit, and every later cube
      // lands on a pan that is now above head height. The physics was right
      // both times; the staging was not. The beat we want is "four equals four
      // — and one more tips it", so the equality has to exist before the first
      // step runs.
      const beats: { t: number; run: () => void }[] = [
        {
          t: 0.35,
          run: () => {
            for (const b of scale.put("left", 4)) cubesL.track(b.index, V(0.36, 0.36, 0.36))
            for (const b of scale.put("right", 4)) cubesR.track(b.index, V(0.36, 0.36, 0.36))
          },
        },
        {
          t: 3.6,
          run: () => {
            for (const b of scale.put("right", 1)) cubesR.track(b.index, V(0.36, 0.36, 0.36))
          },
        },
      ]
      return (dt) => {
        t += dt
        if (phase < beats.length && t > beats[phase]!.t) beats[phase++]!.run()
        frame.sync(w)
        cubesL.sync(w)
        cubesR.sync(w)
        pans.sync(w)
        stirrups.sync(w)
        // Lips ride the pans; offset them in the pan's own frame.
        lipOffsets(lips, w, [scale.leftPan.index, scale.rightPan.index])
      }
    },
  },

  dominoes: {
    label: "Chain reaction",
    caption:
      "120 dominoes. Friction 0.3 — Rapier, Box2D v3 and Planck agree within 2 of 300 and degrade smoothly with friction. Matter.js wedges dead above 0.3.",
    frame: { cx: 0, cy: 1.1, halfW: 12.4, halfH: 2.2 },
    build(w, group) {
      w.ground(30)
      const run = w.dominoes({ from: [-11, 0], to: [11, 0], count: 120, height: 0.9 })
      const layer = boxLayer(group, 128, PALETTE.bone, { metalness: 0.1, roughness: 0.7 })
      const hot = new THREE.Color(PALETTE.rose)
      const cold = new THREE.Color(PALETTE.bone)
      run.forEach((d, i) => {
        const slot = layer.track(d.index, V(0.09, 0.9, 0.55))
        layer.setColor(slot, cold.clone().lerp(hot, i / run.length))
      })
      return () => layer.sync(w)
    },
  },

  chain: {
    label: "Chain & swing",
    caption:
      "24 links carrying 100 link-masses. Measured stretch under load stays inside 12% — Planck stretches 64% at a ratio of ten to one.",
    frame: { cx: 0.5, cy: 7.0, halfW: 9.0, halfH: 6.0 },
    build(w, group) {
      w.ground(24)
      const c = w.chain({ from: [-5, 11], links: 24, load: 120 })
      const links = boxLayer(group, 32, PALETTE.brass, { metalness: 0.95, roughness: 0.25 })
      for (const l of c.links) links.track(l.index, V(0.2, 0.1, 0.16))
      const bob = discLayer(group, 2, PALETTE.copper, { metalness: 0.9 })
      if (c.bob) bob.track(c.bob.index, discScale(0.35, 0.55))
      const blocks = boxLayer(group, 40, PALETTE.jade)
      for (const b of w.stack({ at: [4.5, 0], rows: 6, size: 0.3 })) blocks.track(b.index, V(0.6, 0.6, 0.6))
      return () => {
        links.sync(w)
        bob.sync(w)
        blocks.sync(w)
      }
    },
  },

  gears: {
    label: "Gear train",
    caption:
      "Ratios exact to the last bit — kinematic, not solved. Real involute teeth as rigid bodies is dozens of tiny fast contacts per pair, the worst case for a tablet.",
    frame: { cx: 2.4, cy: 4.2, halfW: 6.4, halfH: 3.0 },
    build(w, group) {
      const train = w.gearTrain({ at: [-2.4, 4.2], teeth: [16, 32, 12, 24], module: 0.14, driveSpeed: 1.4 })
      const layer = discLayer(group, 8, PALETTE.brass, { metalness: 0.95, roughness: 0.22 })
      const tints = [PALETTE.brass, PALETTE.copper, PALETTE.jade, PALETTE.rose]
      train.gears.forEach((g, i) => {
        const slot = layer.track(g.body.index, discScale(g.radius, 0.5))
        layer.setColor(slot, new THREE.Color(tints[i % tints.length]!))
        // Teeth are geometry, not physics.
        for (let t = 0; t < g.teeth; t++) {
          const a = (t / g.teeth) * Math.PI * 2
          // 0.44 not 0.5: a tooth exactly as deep as the gear blank puts its
          // front and back faces COPLANAR with the disc's, and coplanar faces
          // z-fight — the stipple crawls around the rim and reads as a texture
          // bug. Inset the overlay rather than matching it.
          const tooth = new THREE.Mesh(
            new THREE.BoxGeometry(g.radius * 0.16, g.radius * 0.2, 0.44),
            standard(tints[i % tints.length]!, { metalness: 0.95, roughness: 0.22 }),
          )
          tooth.position.set(Math.cos(a) * g.radius, Math.sin(a) * g.radius, 0)
          tooth.rotation.z = a
          tooth.castShadow = true
          const hub = new THREE.Group()
          hub.add(tooth)
          hub.userData.gear = i
          group.add(hub)
          ;(group.userData.teeth ??= []).push({ hub, gear: i, base: a, r: g.radius, cx: g.body.position()[0], cy: g.body.position()[1] })
        }
      })
      return (dt) => {
        train.update(dt)
        layer.sync(w)
        for (const t of group.userData.teeth as { hub: THREE.Group; gear: number; base: number; r: number; cx: number; cy: number }[]) {
          const a = t.base + train.angleOf(t.gear)
          const m = t.hub.children[0] as THREE.Mesh
          m.position.set(t.cx + Math.cos(a) * t.r, t.cy + Math.sin(a) * t.r, 0)
          m.rotation.z = a
        }
      }
    },
  },

  pour: {
    label: "Pour & squash",
    caption:
      "Particle liquid plus pressurised-ring soft bodies. Not SPH — no pressure term, so it pours and splits convincingly but will not self-level.",
    frame: { cx: 0, cy: 5.0, halfW: 6.4, halfH: 6.0 },
    build(w, group) {
      w.ground(24)
      // A funnel and two vessels.
      for (const [x, y, hw, hh, rot] of [
        [-2.6, 6.2, 1.9, 0.12, -0.5],
        [2.6, 6.2, 1.9, 0.12, 0.5],
        [-3.2, 1.5, 0.14, 1.5, 0],
        [-1.2, 1.5, 0.14, 1.5, 0],
        [1.2, 1.5, 0.14, 1.5, 0],
        [3.2, 1.5, 0.14, 1.5, 0],
      ] as const) {
        const b = w.add("static", { box: [hw, hh] }, [x, y], { friction: 0.1 })
        b.rb.setRotation(rot, true)
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, hh * 2, 1.4), standard(PALETTE.ink, { roughness: 0.6 }))
        mesh.position.set(x, y, 0)
        mesh.rotation.z = rot
        mesh.castShadow = true
        mesh.receiveShadow = true
        group.add(mesh)
      }
      const drops = w.liquid({ at: [0, 12], count: 400, drop: 0.1, width: 1.6 })
      const dl = discLayer(group, drops.length, PALETTE.jade, { metalness: 0.2, roughness: 0.25 })
      for (const d of drops) dl.track(d.index, discScale(0.1, 0.2))

      const blobs = [
        w.softBlob({ at: [-2.2, 15], radius: 0.75, firmness: 0.35 }),
        w.softBlob({ at: [2.2, 17], radius: 0.75, firmness: 0.7 }),
      ]
      // Fill each blob from its outline rather than drawing the ring beads:
      // a pressurised ring drawn as beads reads as a donut, because the hole is
      // exactly what the ring is holding open.
      const skins = blobs.map((b, i) => {
        const m = new SoftMesh(b.ring.length, standard(i === 0 ? PALETTE.rose : PALETTE.brass, {
          roughness: 0.45,
          metalness: 0.1,
        }))
        group.add(m.mesh)
        return { blob: b, mesh: m, buf: new Float32Array(b.ring.length * 2) }
      })
      return () => {
        dl.sync(w)
        for (const s of skins) s.mesh.update(s.blob.outline(s.buf))
      }
    },
  },

  siege: {
    label: "Aim & topple",
    caption:
      "The dotted arc is not a parabola — it is the shot, simulated in a shadow world. Measured divergence over 150 steps including bounces: 0.000000 mm.",
    frame: { cx: -1.0, cy: 4.2, halfW: 12.6, halfH: 5.4 },
    build(w, group) {
      w.ground(30)
      const blocks = boxLayer(group, 140, PALETTE.bone, { metalness: 0.1, roughness: 0.7 })
      for (const b of w.stack({ at: [7, 0], rows: 9, size: 0.34 })) blocks.track(b.index, V(0.68, 0.68, 0.68))
      const gun = w.launcher({ at: [-11, 5], radius: 0.34, density: 6, restitution: 0.25 })
      const shots = discLayer(group, 24, PALETTE.copper, { metalness: 0.95, roughness: 0.2 })

      const dots = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshBasicMaterial({ color: PALETTE.brass }),
        60,
      )
      dots.frustumCulled = false
      group.add(dots)
      const dm = new THREE.Matrix4()

      let t = 0
      let next = 0.9
      let angle = 0.36
      return (dt) => {
        t += dt
        angle = 0.3 + Math.sin(t * 0.55) * 0.22
        const tr = gun.predict({ angle, speed: 17 }, 90)
        const end = tr.impactStep >= 0 ? tr.impactStep : tr.steps
        let n = 0
        for (let i = 0; i < end && n < 60; i += 2, n++) {
          dm.makeTranslation(tr.path[i * 2]!, tr.path[i * 2 + 1]!, 0)
          dm.scale(new THREE.Vector3(1, 1, 1).multiplyScalar(1 - n / 90))
          dots.setMatrixAt(n, dm)
        }
        dots.count = n
        dots.instanceMatrix.needsUpdate = true

        if (t > next) {
          next = t + 2.4
          const shot = gun.fire({ angle, speed: 17 })
          shots.track(shot.index, discScale(0.34, 0.6))
        }
        blocks.sync(w)
        shots.sync(w)
      }
    },
  },
}

// ---------------------------------------------------------------- shell

let world: Bazaar | null = null
let group = new THREE.Group()
let tick: ((dt: number) => void) | null = null
let current = ""
let currentFrame = { cx: 0, cy: 4, halfW: 8, halfH: 5 }

async function load(name: string) {
  const demo = DEMOS[name]!
  current = name
  world?.dispose()
  scene.remove(group)
  group.traverse((o: THREE.Object3D) => {
    const m = o as THREE.Mesh
    m.geometry?.dispose?.()
  })
  group = new THREE.Group()
  scene.add(group)

  const params = new URLSearchParams(location.search)
  const tier = params.get("tier") as "low" | "mid" | "high" | "ultra" | null
  world = await createWorld({ seed: 20260726, ...(tier ? { tier } : {}) })
  tick = demo.build(world, group)
  currentFrame = demo.frame
  frameCamera(camera, currentFrame, innerWidth / innerHeight)
  document.getElementById("cap-text")!.textContent = demo.caption
  document.querySelector("#caption b")!.textContent = demo.label
  for (const b of document.querySelectorAll<HTMLButtonElement>("#tabs button")) {
    b.setAttribute("aria-pressed", String(b.dataset.name === name))
  }
  ;(globalThis as Record<string, unknown>).__world = world
}

const tabs = document.getElementById("tabs")!
for (const [name, d] of Object.entries(DEMOS)) {
  const b = document.createElement("button")
  b.textContent = d.label
  b.dataset.name = name
  b.onclick = () => void load(name)
  tabs.appendChild(b)
}

function resize() {
  const w = innerWidth
  const h = innerHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  // Re-fit rather than crop: on a phone in portrait the camera pulls BACK so
  // the whole mechanism stays on screen.
  frameCamera(camera, currentFrame, w / h)
}
addEventListener("resize", resize)
resize()

const fpsEl = document.getElementById("fps")!
const p99El = document.getElementById("p99")!
const awakeEl = document.getElementById("awake")!
const tierEl = document.getElementById("tier")!

let last = performance.now()
let frames = 0
let acc = 0
const frameTimes: number[] = []
const benchScene = new URLSearchParams(location.search).get("bench")
let benchFrames = 0

renderer.setAnimationLoop(() => {
  const now = performance.now()
  const dt = Math.min((now - last) / 1000, 0.25)
  last = now
  if (world && tick) {
    // Hand the scene SIMULATION time, not display time. On a 120 Hz display
    // `advance` runs a fixed step every OTHER frame, so a scene clock driven by
    // the display would run at double speed — which is exactly what made the
    // balance-scale choreography fire its beats twice as fast as intended and
    // look like a physics failure. It also keeps the gear train in lockstep
    // with the bodies it meshes against.
    const steps = world.advance(dt)
    tick(steps * FIXED_DT)
    frameTimes.push(dt * 1000)
    if (frameTimes.length > 240) frameTimes.shift()
  }
  renderer.render(scene, camera)

  frames++
  acc += dt
  if (acc >= 0.5 && world) {
    fpsEl.textContent = String(Math.round(frames / acc))
    p99El.textContent = world.p99StepMs().toFixed(2)
    awakeEl.textContent = String(world.awakeCount())
    tierEl.textContent = world.tier.name
    frames = 0
    acc = 0
  }

  if (benchScene && world) {
    benchFrames++
    if (benchFrames === 600) {
      const sorted = [...frameTimes].sort((a, b) => a - b)
      const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))]!
      ;(globalThis as Record<string, unknown>).__bench = {
        scene: current,
        tier: world.tier.name,
        bodies: world.count,
        awake: world.awakeCount(),
        stepP99Ms: world.p99StepMs(),
        frameP50Ms: pct(50),
        frameP95Ms: pct(95),
        frameP99Ms: pct(99),
        fpsFromP50: 1000 / pct(50),
      }
      console.log("BENCH " + JSON.stringify((globalThis as Record<string, unknown>).__bench))
    }
  }
})

await load(benchScene && DEMOS[benchScene] ? benchScene : "scale")
