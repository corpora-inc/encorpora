// The reference prototype.
//
// A vertical slice of a Dynawalla game built on the feel kit and nothing else:
// a question, three answer tiles, a lamp that fills. Every response in it comes
// from `feel.answer(...)` — one call — and the point of the demo is that a
// prototype author writes the maths and the tiles, and the feel is already
// correct.
//
// It is also the measurement rig: `window.__dwProbe` exposes frame-time
// sampling and a scripted drive so `bench/frames.mjs` can measure the real
// thing in a real browser at real quality tiers instead of guessing.
//
// Everything is procedural. No textures are fetched, no fonts are loaded, no
// models are downloaded — partly because this must run offline in a WebView,
// and partly because "no third-party assets we lack rights to ship" is a
// standing constraint and a foundation that quietly depends on a CDN is not a
// foundation.

import * as THREE from "three"
import { feel } from "../src/feel.ts"
import { TIERS, type TierName } from "../src/tiers.ts"
import { CH_UI } from "../src/tween.ts"
import { EASE } from "../src/ease.ts"

/* ------------------------------------------------------------------ scene */

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
  // `alpha: false` is not cosmetic: an opaque canvas lets the compositor skip
  // blending the whole surface every frame. On a mid-range tablet that is
  // measurable and it costs nothing to ask for.
  alpha: false,
})
renderer.setClearColor(0x07060d, 1)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x0a0714, 0.038)

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200)

// The rig owns the camera from here. Nothing else writes camera.position —
// see the header of `camera.ts` for the drift bug that rule prevents.
feel.rig.base.x = 0
feel.rig.base.y = 2.15
feel.rig.base.z = 8.4
feel.rig.aim.x = 0
feel.rig.aim.y = 1.5
feel.rig.aim.z = 0

/* ------------------------------------------------------------- procedural */

/** A radial-gradient sprite, drawn once. Used for every glow in the scene. */
function glowTexture(inner: string, outer: string): THREE.Texture {
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.35, outer)
  grad.addColorStop(1, "rgba(0,0,0,0)")
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * The floor: an eight-point girih star tiling drawn to a canvas.
 *
 * Anisotropy and mipmaps are set explicitly. The repo's playbook records a
 * shimmering-ground bug that cost real time and resolved to exactly this — a
 * tiled texture viewed at a grazing angle aliases violently without both.
 */
function floorTexture(): THREE.Texture {
  const S = 512
  const c = document.createElement("canvas")
  c.width = c.height = S
  const g = c.getContext("2d")!
  g.fillStyle = "#120d1c"
  g.fillRect(0, 0, S, S)

  const star = (cx: number, cy: number, r: number, rot: number) => {
    g.beginPath()
    for (let i = 0; i < 16; i++) {
      const rr = i % 2 === 0 ? r : r * 0.44
      const a = rot + (i * Math.PI) / 8
      const x = cx + Math.cos(a) * rr
      const y = cy + Math.sin(a) * rr
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.closePath()
    g.stroke()
  }

  g.strokeStyle = "#3a2c50"
  g.lineWidth = 2.5
  for (let y = 0; y <= 2; y++) {
    for (let x = 0; x <= 2; x++) {
      star((x * S) / 2, (y * S) / 2, S * 0.19, Math.PI / 8)
    }
  }
  g.strokeStyle = "#6b4a2e"
  g.lineWidth = 1.2
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      star((x * S) / 2 + S / 4, (y * S) / 2 + S / 4, S * 0.11, 0)
    }
  }

  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(9, 9)
  t.colorSpace = THREE.SRGBColorSpace
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy())
  return t
}

/** A number, drawn to a canvas. Kept in a cache so tiles never re-rasterise. */
const glyphCache = new Map<string, THREE.Texture>()
function glyphTexture(text: string): THREE.Texture {
  const hit = glyphCache.get(text)
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const g = c.getContext("2d")!
  g.clearRect(0, 0, 256, 256)
  g.font = "300 132px ui-serif, Georgia, serif"
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillStyle = "#ffe9c4"
  g.shadowColor = "#ffb35a"
  g.shadowBlur = 26
  g.fillText(text, 128, 134)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  glyphCache.set(text, t)
  return t
}

/* -------------------------------------------------------------- the world */

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(70, 70),
  new THREE.MeshStandardMaterial({
    map: floorTexture(),
    roughness: 0.62,
    metalness: 0.28,
    color: 0x8a7fa0,
  }),
)
ground.rotation.x = -Math.PI / 2
scene.add(ground)

// Stall arcades down both sides. Extruded rounded arches, instanced-ish by
// cloning a single geometry — one geometry, many meshes, so the vertex data is
// uploaded once.
const archShape = new THREE.Shape()
archShape.moveTo(-0.55, 0)
archShape.lineTo(-0.55, 1.5)
archShape.quadraticCurveTo(-0.55, 2.35, 0, 2.35)
archShape.quadraticCurveTo(0.55, 2.35, 0.55, 1.5)
archShape.lineTo(0.55, 0)
archShape.lineTo(0.36, 0)
archShape.lineTo(0.36, 1.5)
archShape.quadraticCurveTo(0.36, 2.1, 0, 2.1)
archShape.quadraticCurveTo(-0.36, 2.1, -0.36, 1.5)
archShape.lineTo(-0.36, 0)
archShape.closePath()
const archGeo = new THREE.ExtrudeGeometry(archShape, {
  depth: 0.42,
  bevelEnabled: true,
  bevelThickness: 0.035,
  bevelSize: 0.035,
  bevelSegments: 2,
  curveSegments: 14,
})
archGeo.center()

const brass = new THREE.MeshStandardMaterial({
  color: 0x9d7239,
  roughness: 0.34,
  metalness: 0.92,
})
const stone = new THREE.MeshStandardMaterial({
  color: 0x2c2338,
  roughness: 0.9,
  metalness: 0.08,
})

const lampGlow = glowTexture("rgba(255,214,150,0.95)", "rgba(255,150,60,0.30)")
const lamps: THREE.Sprite[] = []
const lampLights: THREE.PointLight[] = []

for (let side = -1; side <= 1; side += 2) {
  for (let i = 0; i < 7; i++) {
    const z = 2 - i * 3.1
    // Facing the aisle, not edge-on. An arcade rotated 90° reads as a stack of
    // rings from the player's eye — correct geometry, wrong picture.
    const arch = new THREE.Mesh(archGeo, i % 2 === 0 ? stone : brass)
    arch.position.set(side * 4.3, 1.34, z)
    arch.rotation.y = side * -0.42
    scene.add(arch)

    // A hanging lamp: an emissive bead plus an additive sprite. The sprite is
    // what actually reads as light; the bead gives it a physical source.
    const bead = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd79a }),
    )
    bead.position.set(side * 4.0, 1.95, z)
    scene.add(bead)

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: lampGlow,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        opacity: 0.55,
      }),
    )
    sprite.scale.setScalar(1.5)
    sprite.position.copy(bead.position)
    scene.add(sprite)
    lamps.push(sprite)

    // Only the four nearest lamps are real lights. Beyond that the sprite
    // carries it — a scene with fourteen point lights costs a forward renderer
    // fourteen lighting iterations per fragment for no visible gain.
    if (i < 2) {
      const l = new THREE.PointLight(0xffb268, 5.5, 13, 2)
      l.position.copy(bead.position)
      scene.add(l)
      lampLights.push(l)
    }
  }
}

scene.add(new THREE.HemisphereLight(0x6d58a0, 0x181024, 0.85))
const key = new THREE.DirectionalLight(0xbfd0ff, 1.05)
key.position.set(-3, 7, 5)
scene.add(key)

// The lamp that fills as the child answers — the "construction never regresses"
// idea, rendered as a column of light that grows.
const beaconGeo = new THREE.CylinderGeometry(0.19, 0.24, 1, 18, 1, true)
const beaconMat = new THREE.MeshBasicMaterial({
  color: 0xffc078,
  transparent: true,
  opacity: 0.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
})
const beacon = new THREE.Mesh(beaconGeo, beaconMat)
beacon.position.set(0, 0.5, -7)
scene.add(beacon)

const beaconBase = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 10, 28), brass)
beaconBase.rotation.x = Math.PI / 2
beaconBase.position.set(0, 0.06, -7)
scene.add(beaconBase)

/* ------------------------------------------------------------ answer tiles */

const tileShape = new THREE.Shape()
{
  const w = 0.62
  const h = 0.44
  const r = 0.1
  tileShape.moveTo(-w + r, -h)
  tileShape.lineTo(w - r, -h)
  tileShape.quadraticCurveTo(w, -h, w, -h + r)
  tileShape.lineTo(w, h - r)
  tileShape.quadraticCurveTo(w, h, w - r, h)
  tileShape.lineTo(-w + r, h)
  tileShape.quadraticCurveTo(-w, h, -w, h - r)
  tileShape.lineTo(-w, -h + r)
  tileShape.quadraticCurveTo(-w, -h, -w + r, -h)
}
const tileGeo = new THREE.ExtrudeGeometry(tileShape, {
  depth: 0.16,
  bevelEnabled: true,
  bevelThickness: 0.03,
  bevelSize: 0.03,
  bevelSegments: 2,
  curveSegments: 6,
})
tileGeo.center()

interface Tile {
  group: THREE.Group
  plate: THREE.Mesh
  glyph: THREE.Sprite
  value: number
  homeY: number
}

const tiles: Tile[] = []
for (let i = 0; i < 3; i++) {
  const group = new THREE.Group()
  group.position.set((i - 1) * 1.85, 1.15, 1.7)

  const plate = new THREE.Mesh(
    tileGeo,
    new THREE.MeshStandardMaterial({
      color: 0x35294a,
      roughness: 0.42,
      metalness: 0.55,
      emissive: 0x120a1c,
    }),
  )
  group.add(plate)

  const glyph = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glyphTexture("0"), transparent: true, depthWrite: false }),
  )
  glyph.scale.setScalar(0.9)
  glyph.position.z = 0.14
  group.add(glyph)

  scene.add(group)
  tiles.push({ group, plate, glyph, value: 0, homeY: group.position.y })
}

/* ------------------------------------------------------------- particles */

// One Points cloud, one buffer, written in place. A particle system that
// allocates per burst is the classic juice stutter.
const MAX_PARTICLES = 900
const pPos = new Float32Array(MAX_PARTICLES * 3)
const pVel = new Float32Array(MAX_PARTICLES * 3)
const pLife = new Float32Array(MAX_PARTICLES)
const pMax = new Float32Array(MAX_PARTICLES)
const pAlpha = new Float32Array(MAX_PARTICLES)
const pSize = new Float32Array(MAX_PARTICLES)
let pCursor = 0

const pGeo = new THREE.BufferGeometry()
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3))
pGeo.setAttribute("alpha", new THREE.BufferAttribute(pAlpha, 1))
pGeo.setAttribute("psize", new THREE.BufferAttribute(pSize, 1))
const pMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uTex: { value: glowTexture("rgba(255,236,200,1)", "rgba(255,168,80,0.6)") } },
  vertexShader: `
    attribute float alpha; attribute float psize; varying float vA;
    void main(){
      vA = alpha;
      vec4 mv = modelViewMatrix * vec4(position,1.0);
      // The divisor is a real calibration, not a magic number: gl_PointSize is
      // in DEVICE pixels, so at dpr 2 it is doubled again by nobody. A first
      // pass used 300.0 here and every particle rendered ~400 px across — the
      // burst was one white disc covering a third of the screen and it read as
      // a bug, not as juice. 70.0 puts a particle at 9–25 device px at this
      // camera distance, which is a spark.
      gl_PointSize = psize * (70.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform sampler2D uTex; varying float vA;
    void main(){
      vec4 t = texture2D(uTex, gl_PointCoord);
      gl_FragColor = vec4(t.rgb, t.a * vA);
      if (gl_FragColor.a < 0.01) discard;
    }`,
})
const points = new THREE.Points(pGeo, pMat)
points.frustumCulled = false
scene.add(points)

function emit(count: number, x: number, y: number, tier: { level: number }): void {
  const speed = 1.4 + tier.level * 0.75
  for (let i = 0; i < count && i < MAX_PARTICLES; i++) {
    const k = pCursor
    pCursor = (pCursor + 1) % MAX_PARTICLES
    const j = k * 3
    // Jitter the origin. Every particle leaving the exact same point makes a
    // perfect expanding sphere, which reads as geometry rather than as debris.
    pPos[j] = x * 3.2 + (Math.random() - 0.5) * 0.5
    pPos[j + 1] = y * 1.4 + 1.25 + (Math.random() - 0.5) * 0.5
    pPos[j + 2] = 1.7 + (Math.random() - 0.5) * 0.3
    const a = Math.random() * Math.PI * 2
    const b = Math.random() * Math.PI - Math.PI / 2
    const s = speed * (0.35 + Math.random() * 0.65)
    pVel[j] = Math.cos(a) * Math.cos(b) * s
    pVel[j + 1] = Math.sin(b) * s + 1.1
    pVel[j + 2] = Math.sin(a) * Math.cos(b) * s * 0.6
    pMax[k] = 620 + Math.random() * 700 + tier.level * 120
    pLife[k] = pMax[k]
    pSize[k] = 0.9 + Math.random() * 1.5 + tier.level * 0.22
  }
}
feel.onEmit(emit)

function stepParticles(dtMs: number): void {
  const dt = dtMs * 0.001
  let any = false
  for (let k = 0; k < MAX_PARTICLES; k++) {
    if (pLife[k]! <= 0) {
      if (pAlpha[k] !== 0) {
        pAlpha[k] = 0
        any = true
      }
      continue
    }
    any = true
    pLife[k]! -= dtMs
    const j = k * 3
    pVel[j + 1]! -= 3.6 * dt
    pPos[j]! += pVel[j]! * dt
    pPos[j + 1]! += pVel[j + 1]! * dt
    pPos[j + 2]! += pVel[j + 2]! * dt
    const t = Math.max(0, pLife[k]! / pMax[k]!)
    pAlpha[k] = t * t
  }
  if (any) {
    pGeo.attributes.position!.needsUpdate = true
    pGeo.attributes.alpha!.needsUpdate = true
    pGeo.attributes.psize!.needsUpdate = true
  }
}

/* ---------------------------------------------------------------- the game */

const qEl = document.getElementById("q")!
const hudEl = document.getElementById("hud")!

let answer = 0
let progress = 0
let solved = 0
let lastDifficulty = 0

function nextProblem(): void {
  // The generator is deliberately trivial — the point of the demo is the feel,
  // and a real curriculum is another foundation's problem.
  const hard = Math.random() < 0.35
  const a = hard ? 6 + Math.floor(Math.random() * 8) : 2 + Math.floor(Math.random() * 7)
  const b = hard ? 6 + Math.floor(Math.random() * 8) : 2 + Math.floor(Math.random() * 7)
  answer = a * b
  lastDifficulty = hard ? 0.8 : 0.25
  qEl.textContent = `${String(a)} × ${String(b)}`

  const slot = Math.floor(Math.random() * 3)
  const used = new Set([answer])
  for (let i = 0; i < 3; i++) {
    let v: number
    if (i === slot) v = answer
    else {
      do {
        v = Math.max(2, answer + Math.floor(Math.random() * 17) - 8)
      } while (used.has(v))
      used.add(v)
    }
    tiles[i]!.value = v
    tiles[i]!.glyph.material.map = glyphTexture(String(v))
    tiles[i]!.glyph.material.needsUpdate = true
    // Present on the UI channel: a freeze frame must never stall the next
    // question arriving. This is the whole reason the channel exists.
    tiles[i]!.group.position.y = tiles[i]!.homeY - 0.35
    feel.tweens.to2(
      tiles[i]!.group.position,
      "y",
      tiles[i]!.homeY - 0.35,
      tiles[i]!.homeY,
      260,
      "outBack",
      { channel: CH_UI, delayMs: i * 45 },
    )
  }
}

function commit(tile: Tile): void {
  // One line at the top of every input handler. Interrupts whatever is playing
  // and reports whether the surface is live.
  if (!feel.press(tile.value)) return

  const correct = tile.value === answer
  // The tile itself takes the light. A reaction that happens only in the camera
  // and the air, and not on the thing the child touched, reads as weather.
  const mat = tile.plate.material as THREE.MeshStandardMaterial
  mat.emissive.setHex(correct ? 0xffb45c : 0x8a3d1e)
  feel.tweens.to2(mat.emissive, "r", correct ? 1 : 0.54, 0.07, correct ? 520 : 300, "outExpo", {
    channel: 1,
  })
  feel.tweens.to2(mat.emissive, "g", correct ? 0.7 : 0.24, 0.04, correct ? 520 : 300, "outExpo", {
    channel: 1,
  })
  feel.tweens.to2(mat.emissive, "b", correct ? 0.36 : 0.12, 0.11, correct ? 520 : 300, "outExpo", {
    channel: 1,
  })

  if (correct) {
    solved++
    progress = Math.min(1, progress + 0.12)
  }

  const milestone = correct && progress >= 1 ? "minor" : null
  if (milestone) progress = 0

  // THE ONE CALL. Everything the child feels comes from here.
  feel.answer(
    {
      correct,
      difficulty: lastDifficulty,
      repaired: correct && solved % 7 === 3,
      milestone,
    },
    {
      subject: tile.group,
      at: [tile.group.position.x / 3.2, 0.1],
      dir: correct ? [0, -1, 0.25] : [tile.group.position.x > 0 ? 1 : -1, -0.3, 0],
    },
  )

  if (correct) nextProblem()
}

/* ------------------------------------------------------------------ input */

const ray = new THREE.Raycaster()
const ndc = new THREE.Vector2()

renderer.domElement.addEventListener(
  "pointerdown",
  (e) => {
    ndc.x = (e.clientX / window.innerWidth) * 2 - 1
    ndc.y = -(e.clientY / window.innerHeight) * 2 + 1
    ray.setFromCamera(ndc, camera)
    // Hit slop, in 3D: widen the ray's threshold rather than the geometry, so
    // adjacent tiles cannot both claim a tap. Nearest hit wins, which is the
    // same rule `nearestTarget` applies in 2D.
    const hits = ray.intersectObjects(
      tiles.map((t) => t.plate),
      false,
    )
    if (hits.length > 0) {
      const plate = hits[0]!.object
      const tile = tiles.find((t) => t.plate === plate)
      if (tile) commit(tile)
    }
  },
  { passive: true },
)

/* -------------------------------------------------------------- tier bench */

const tierBar = document.getElementById("tiers")!
for (const name of Object.keys(TIERS) as TierName[]) {
  const b = document.createElement("button")
  b.textContent = name
  b.addEventListener("pointerdown", (e) => {
    e.stopPropagation()
    feel.interrupt()
    feel.react(name, { subject: tiles[1]!.group, at: [0, 0.1] })
  })
  tierBar.appendChild(b)
}

/* --------------------------------------------------------------- the loop */

feel.attach({ camera, parent: document.body })
feel.start()
nextProblem()

let hudAcc = 0
let lastWorkMs = 0
feel.onFrame((t) => {
  const w0 = performance.now()
  stepParticles(t.dtWorld)

  // Beacon fill runs on the UI channel's time so it keeps rising through a
  // freeze frame — the world stops, the thing you are building does not.
  const target = 0.35 + progress * 3.2
  beacon.scale.y += (target - beacon.scale.y) * Math.min(1, t.dtUi * 0.006)
  beacon.position.y = beacon.scale.y * 0.5
  beaconMat.opacity = 0.1 + progress * 0.55

  const pulse = 0.5 + 0.5 * Math.sin(t.tReal * 0.0016)
  for (let i = 0; i < lamps.length; i++) {
    lamps[i]!.material.opacity = 0.42 + 0.16 * Math.sin(t.tReal * 0.0021 + i)
  }
  for (const l of lampLights) l.intensity = 5.0 + pulse * 1.2

  renderer.render(scene, camera)
  // CPU time actually spent producing this frame — particles, feel systems,
  // scene graph, draw-call submission. This is the number that responds to CPU
  // throttling and the number a budget can be written against. The rAF delta
  // is *not*: in headless Chrome it is a fixed virtual cadence and reports the
  // same 8.30 ms whether the page is idle or under a 40-reaction storm. That
  // cost a measurement round to discover; see README trap T-09.
  lastWorkMs = performance.now() - w0

  hudAcc += t.dtReal
  if (hudAcc > 250) {
    hudAcc = 0
    const s = feel.clock.frameStats()
    const q = feel.quality
    hudEl.innerHTML =
      `<b>${q.tier.toUpperCase()}</b> · dpr ${String(renderer.getPixelRatio().toFixed(2))} · ` +
      `frame work <b>${lastWorkMs.toFixed(2)}</b>ms · rAF p50 ${s.p50.toFixed(1)}ms p95 ${s.p95.toFixed(1)}ms<br>` +
      `tweens ${String(feel.tweens.liveCount)}/${String(feel.tweens.capacity)} · ` +
      `trauma ${feel.rig.shake.trauma.toFixed(2)} · scale ${feel.clock.timeScale.toFixed(2)} · ` +
      `hitstop ${feel.clock.hitstopMs.toFixed(0)}ms<br>` +
      `reactions ${String(feel.stats.reactions)} · interrupts ${String(feel.stats.interrupts)} · ` +
      `last interrupt <b>${feel.stats.lastInterruptMs.toFixed(3)}</b>ms · solved ${String(solved)}` +
      (feel.tweens.overflows > 0
        ? `<br><span class="warn">tween pool overflowed ${String(feel.tweens.overflows)}×</span>`
        : "")
  }
})

/* ----------------------------------------------------------------- resize */

function resize(): void {
  const w = window.innerWidth
  const h = window.innerHeight
  // The single biggest GPU lever. An uncapped DPR of 3 on a modern phone is
  // 9× the fragment work of DPR 1 for a difference nobody can see at arm's
  // length on a 60 px glyph.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, feel.quality.maxPixelRatio))
  // `updateStyle` must be true, or set the CSS size yourself. With `false` the
  // canvas keeps its intrinsic size — width × dpr CSS pixels — so at dpr 2 the
  // canvas lays out at twice the viewport and the page shows the top-left
  // quadrant of the render. It looks like a broken camera, and the first
  // screenshot pass of this demo lost time to exactly that. Trap T-10.
  renderer.setSize(w, h, true)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
window.addEventListener("resize", resize)
resize()

/* ------------------------------------------------------------------ probe */

// The measurement surface `bench/frames.mjs` drives. Kept in the demo rather
// than in the bench so the thing being measured is the thing that ships.
interface Probe {
  samples: number[]
  work: number[]
  recording: boolean
  record(ms: number): Promise<number[]>
  fire(tier: TierName): void
  storm(n: number): void
  setQuality(t: "low" | "medium" | "high" | "ultra"): void
  stats(): Stats
  workStats(): Stats
}
interface Stats {
  p50: number
  p95: number
  p99: number
  worst: number
  n: number
  over16: number
}
function percentiles(raw: number[]): Stats {
  const s = [...raw].sort((a, b) => a - b)
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(s.length * q))] ?? 0
  return {
    p50: at(0.5),
    p95: at(0.95),
    p99: at(0.99),
    worst: s[s.length - 1] ?? 0,
    n: s.length,
    over16: s.filter((v) => v > 16.7).length,
  }
}

const probe: Probe = {
  samples: [],
  work: [],
  recording: false,
  record(ms) {
    this.samples = []
    this.work = []
    this.recording = true
    return new Promise((res) => {
      setTimeout(() => {
        this.recording = false
        res(this.samples)
      }, ms)
    })
  },
  fire(tier) {
    feel.interrupt()
    feel.react(tier, { subject: tiles[1]!.group, at: [0, 0.1] })
  },
  storm(n) {
    for (let i = 0; i < n; i++) {
      feel.react(i % 5 === 0 ? "bloom" : i % 3 === 0 ? "pop" : "snap", {
        subject: tiles[i % 3]!.group,
        at: [(i % 3) - 1, 0.1],
      })
    }
  },
  setQuality(t) {
    feel.governor.force(t)
    resize()
  },
  stats() {
    return percentiles(this.samples)
  },
  workStats() {
    return percentiles(this.work)
  },
}
feel.onFrame((t) => {
  if (probe.recording) {
    probe.samples.push(t.dtReal)
    probe.work.push(lastWorkMs)
  }
})
;(window as unknown as { __dwProbe: Probe }).__dwProbe = probe
;(window as unknown as { __dwFeelReady: boolean }).__dwFeelReady = true

// Ease is re-exported into the demo so a prototype author can see it exists.
void EASE
