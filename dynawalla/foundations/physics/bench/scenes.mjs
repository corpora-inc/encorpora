// Engine-agnostic scene definitions for the physics bake-off.
//
// Every scene is plain data so that four engines with four different APIs build
// the SAME world. If a scene were expressed in any engine's own vocabulary the
// bake-off would measure how well the other three imitate it.
//
// Units are metres/kilograms/seconds throughout, and every scene is sized so a
// 10-year-old's screen would be roughly 20 m wide. Pixel-space physics is the
// classic Box2D-family footgun: the solver's tolerances (linear slop 0.005,
// speculative contact margin, sleep thresholds) are absolute, so a world built
// at 1 unit = 1 pixel is a world where everything is 100x too big and the slop
// is invisible.
//
// Shapes:  { box: [halfWidth, halfHeight] } | { circle: radius }
// Bodies:  { kind, shape, pos, angle?, density?, friction?, restitution? }
//          A body may instead carry `shapes: [{ ...shape, at: [dx, dy] }]` for a
//          compound body (a pan with lips, a gear tooth ring, a bucket).
// Joints:  { type: "revolute" | "distance", a, b, anchor?, anchorA?, anchorB?, length? }
//          `a` / `b` are indices into `bodies`.

const FLOOR = (halfWidth = 14) => ({
  kind: "static",
  shape: { box: [halfWidth, 0.5] },
  pos: [0, -0.5],
  friction: 0.6,
})

/** Deterministic 32-bit PRNG. No Math.random() anywhere in a benchmark. */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    // xorshift32
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

/**
 * S1 — PYRAMID TOPPLE. 15 rows, 120 boxes, struck by a fast heavy ball.
 * The densest persistent-contact scene we ship: every box has 4-6 manifolds and
 * the whole pile is one island, so this is the solver's worst case per body.
 */
function pyramidTopple() {
  const bodies = [FLOOR()]
  const h = 0.25
  const rows = 15
  for (let row = 0; row < rows; row++) {
    const n = rows - row
    for (let i = 0; i < n; i++) {
      bodies.push({
        kind: "dynamic",
        shape: { box: [h, h] },
        // 0.001 gap: boxes that start exactly touching begin the sim already
        // penetrating by the linear slop and every engine resolves that
        // differently on frame 0, which is not what we are measuring.
        pos: [(i - (n - 1) / 2) * (h * 2 + 0.001), h + row * (h * 2 + 0.001)],
        density: 1,
        friction: 0.5,
      })
    }
  }
  // The wrecking ball, entering from the left at 18 m/s.
  bodies.push({
    kind: "dynamic",
    shape: { circle: 0.6 },
    pos: [-12, 3],
    density: 8,
    friction: 0.4,
    restitution: 0.1,
    velocity: [18, 2],
  })
  return { name: "pyramid-topple", gravity: [0, -10], bodies, joints: [], steps: 600 }
}

/**
 * S2 — DEBRIS FIELD. 500 mixed circles and boxes poured into a pen.
 * Broadphase + island management stress. This is "a lamp shatters and the
 * pieces land in a pile", which the Bazaar will do constantly.
 */
function debrisField() {
  const rand = rng(0xd1a9)
  const bodies = [
    FLOOR(10),
    { kind: "static", shape: { box: [0.5, 8] }, pos: [-10, 8], friction: 0.4 },
    { kind: "static", shape: { box: [0.5, 8] }, pos: [10, 8], friction: 0.4 },
  ]
  for (let i = 0; i < 500; i++) {
    const r = 0.12 + rand() * 0.14
    bodies.push({
      kind: "dynamic",
      shape: rand() < 0.5 ? { circle: r } : { box: [r, r * (0.6 + rand() * 0.8)] },
      pos: [(rand() - 0.5) * 18, 1 + rand() * 26],
      angle: rand() * 6.283,
      density: 1,
      friction: 0.35,
      restitution: 0.05,
    })
  }
  return { name: "debris-500", gravity: [0, -10], bodies, joints: [], steps: 600 }
}

/**
 * S3 — DOMINOES. 300 tall thin boxes, chain reaction from one nudge.
 * Thin boxes are the tunnelling case, and the interesting cost profile is that
 * an engine with sleeping does almost no work until the wave arrives — so the
 * MEAN is misleading here and only the worst frame matters.
 */
function dominoes() {
  const bodies = [FLOOR(40)]
  const n = 300
  for (let i = 0; i < n; i++) {
    bodies.push({
      kind: "dynamic",
      shape: { box: [0.05, 0.5] },
      pos: [-38 + i * 0.26, 0.5],
      density: 1.2,
      friction: 0.45,
    })
  }
  bodies[1].angle = -0.22 // the nudge is geometric, not an impulse: replayable
  return { name: "dominoes-300", gravity: [0, -10], bodies, joints: [], steps: 900 }
}

/**
 * S4 — ROPE. 60 links plus a heavy bob, anchored at both ends of a span.
 * Joint-solver stress. Chains are where "looks like a rope" and "explodes" are
 * separated by the iteration count, and where the two engine families differ
 * most: Box2D-family sequential impulses stretch, Rapier's TGS-Soft does not.
 */
export const ROPE_LINKS = 60
const ROPE_HALF = 0.1 // half-length of one link
const ROPE_BOB_R = 0.35
const ROPE_ANCHOR = [-6, 12]

/**
 * Rope/chain builder, parameterised so the same geometry can be swept for the
 * mass-ratio cliff (see `bench/probe-rope.mjs`). Anchors line up EXACTLY: a
 * chain that starts with the joints already violated spends its first frames
 * snapping straight, and every engine does that differently.
 */
export function ropeScene({ linkDensity = 4, bobDensity = 30, links = ROPE_LINKS } = {}) {
  const [ax, ay] = ROPE_ANCHOR
  const bodies = [
    FLOOR(20),
    { kind: "static", shape: { box: [0.2, 0.2] }, pos: [ax, ay] },
  ]
  for (let i = 0; i < links; i++) {
    bodies.push({
      kind: "dynamic",
      shape: { box: [ROPE_HALF, 0.05] },
      pos: [ax + ROPE_HALF + i * ROPE_HALF * 2, ay],
      density: linkDensity,
      friction: 0.2,
    })
  }
  bodies.push({
    kind: "dynamic",
    shape: { circle: ROPE_BOB_R },
    pos: [ax + links * ROPE_HALF * 2 + ROPE_BOB_R, ay],
    density: bobDensity,
    friction: 0.4,
  })
  const joints = []
  // index 1 is the anchor; links start at 2.
  joints.push({ type: "revolute", a: 1, b: 2, anchorA: [0, 0], anchorB: [-ROPE_HALF, 0] })
  for (let i = 0; i < links - 1; i++) {
    joints.push({
      type: "revolute",
      a: 2 + i,
      b: 3 + i,
      anchorA: [ROPE_HALF, 0],
      anchorB: [-ROPE_HALF, 0],
    })
  }
  joints.push({
    type: "revolute",
    a: 1 + links,
    b: 2 + links,
    anchorA: [ROPE_HALF, 0],
    anchorB: [-ROPE_BOB_R, 0],
  })
  return { name: "rope-60", gravity: [0, -10], bodies, joints, steps: 600 }
}

/**
 * S4 — ROPE. 60 links plus a bucket-weight bob, anchored at one end and free to
 * swing. Joint-solver stress. Chains are where "looks like a rope" and
 * "explodes" are separated by the iteration count, and where the two engine
 * families differ most.
 *
 * The masses here are deliberately a REALISTIC chain-and-bucket (~144:1
 * bob:link). The pathological ratios that break every engine are swept
 * separately in `probe-rope.mjs` rather than smuggled into the headline table.
 */
function rope() {
  return ropeScene()
}

/** Rest length of the rope scene, for the stretch metric. */
export const ROPE_REST = (ROPE_LINKS - 1) * ROPE_HALF * 2 + ROPE_HALF + ROPE_BOB_R

/**
 * S5 — BALANCE SCALE. The equals sign, physically.
 * A beam on a revolute pivot, two pans hung from its ends by revolute joints,
 * and weights dropped into the pans. This is the scene the product needs most
 * and the one most likely to look bad: a scale that jitters at balance, or that
 * settles a hair off level with equal mass, reads to a child as "the equals
 * sign is unreliable".
 */
/**
 * Balance scale, parameterised. See `probe-scale.mjs`.
 *
 * `pivotRaise` is the distance the pivot sits ABOVE the beam's centre of mass.
 * At 0 the beam is pivoted through its own centroid, which is the obvious way
 * to build it and is **neutrally stable** — there is no restoring torque at
 * all, so where it settles is decided by solver noise. Every engine we tested
 * tips a different direction from the identical scene. Raising the pivot is
 * what turns "level" into an attractor. This is a real steelyard's design and
 * the kit bakes it in.
 */
export function balanceScaleScene({
  pivotRaise = 0,
  extraLeft = 0,
  extraRight = 0,
  loose = true,
} = {}) {
  const armLen = 3.2
  const hang = 1.3 // stirrup length
  const pivotY = 5.2 // world height of the pivot: fixed, so the column never moves
  // A pan with LIPS, as a compound body. Without them the load simply slides
  // off a swinging pan and the imbalance the scale is meant to show disappears
  // — which is how the first version of this probe fooled itself into
  // reporting that Rapier "settles level" under a 25% overload.
  const PAN = [
    { box: [1.0, 0.08], at: [0, 0] },
    { box: [0.08, 0.3], at: [-0.92, 0.3] },
    { box: [0.08, 0.3], at: [0.92, 0.3] },
  ]
  const beamY = pivotY - pivotRaise // the beam's OWN centre of mass
  const bodies = [
    FLOOR(8),
    { kind: "static", shape: { box: [0.3, 2.6] }, pos: [0, 2.6] }, // 1 column
    { kind: "dynamic", shape: { box: [armLen, 0.12] }, pos: [0, beamY], density: 2.5, friction: 0.5 }, // 2 beam
    // Stirrups and pans. Hanging a pan by a REVOLUTE-jointed link rather than a
    // distance/rope joint keeps this scene expressible identically in all four
    // engines — revolute is the one joint whose semantics they agree on. It is
    // also what a real balance scale is.
    //
    // Everything below the beam is positioned relative to `beamY`, not to the
    // pivot. Getting this wrong — leaving the stirrups at the old height while
    // the beam moves down — starts every joint already violated, and the whole
    // assembly snaps on frame 0. It looks exactly like solver instability and
    // it is not.
    { kind: "dynamic", shape: { box: [0.04, hang / 2] }, pos: [-armLen, beamY - hang / 2], density: 0.8 }, // 3
    { kind: "dynamic", shapes: PAN, pos: [-armLen, beamY - hang], density: 1.2, friction: 0.9 }, // 4 left pan
    { kind: "dynamic", shape: { box: [0.04, hang / 2] }, pos: [armLen, beamY - hang / 2], density: 0.8 }, // 5
    { kind: "dynamic", shapes: PAN, pos: [armLen, beamY - hang], density: 1.2, friction: 0.9 }, // 6 right pan
  ]
  const joints = [
    // Pivot: on the column at world `pivotY`, on the beam `pivotRaise` above
    // its own centre of mass.
    { type: "revolute", a: 1, b: 2, anchorA: [0, pivotY - 2.6], anchorB: [0, pivotRaise] },
    { type: "revolute", a: 2, b: 3, anchorA: [-armLen, 0], anchorB: [0, hang / 2] },
    { type: "revolute", a: 3, b: 4, anchorA: [0, -hang / 2], anchorB: [0, 0] },
    { type: "revolute", a: 2, b: 5, anchorA: [armLen, 0], anchorB: [0, hang / 2] },
    { type: "revolute", a: 5, b: 6, anchorA: [0, -hang / 2], anchorB: [0, 0] },
  ]
  // Four unit cubes left, four right: a true equality that must LOOK level.
  const perSide = [4 + extraLeft, 4 + extraRight]
  if (loose) {
    ;[-1, 1].forEach((side, s) => {
      for (let i = 0; i < perSide[s]; i++) {
        bodies.push({
          kind: "dynamic",
          shape: { box: [0.18, 0.18] },
          pos: [side * armLen + ((i % 4) - 1.5) * 0.4, beamY - hang + 0.5 + i * 0.5],
          density: 1,
          friction: 0.7,
        })
      }
    })
  } else {
    // One settled slab per pan whose density encodes the count. Loose cubes on
    // a lipless pan slide off the moment the beam tilts, which silently removes
    // the very imbalance the probe is trying to measure — so the *scale* is
    // measured with a load that cannot escape, and the loose version is kept
    // for the demo where sliding cubes are the point.
    ;[-1, 1].forEach((side, s) => {
      bodies.push({
        kind: "dynamic",
        shape: { box: [0.7, 0.2] },
        pos: [side * armLen, beamY - hang + 0.08 + 0.2],
        density: (perSide[s] * 0.18 * 0.18 * 4) / (0.7 * 0.2 * 4),
        friction: 0.9,
      })
    })
  }
  return { name: "balance-scale", gravity: [0, -10], bodies, joints, steps: 900 }
}

function balanceScale() {
  return balanceScaleScene()
}

export const SCENES = {
  "pyramid-topple": pyramidTopple,
  "debris-500": debrisField,
  "dominoes-300": dominoes,
  "rope-60": rope,
  "balance-scale": balanceScale,
}

export const SCENE_ORDER = Object.keys(SCENES)
