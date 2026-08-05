// The drawings themselves, as data.
//
// Every motif is a pure function from a seeded PRNG to a list of shapes on a
// 100 × 100 field. Nothing here touches the DOM, React or a colour: a shape
// names an *ink* ("line", "glow", "warm") and `catalog.css` decides what an ink
// is, which is what keeps the whole palette in `tokens.css` where it belongs
// and what makes every one of these testable under `node --test`.
//
// **They are of one family on purpose.** Monoline, luminous, sitting on the
// violet void — the brand's discipline, applied twenty-eight times. What
// varies is what is drawn and which of the arc's twelve hues it is drawn in,
// not the stroke weight, not the ground, not the lighting. Twenty-seven
// drawings that each looked like a different app would be a rainbow
// free-for-all; twenty-seven drawings that shared a silhouette would be the
// near-identical rosettes that were rejected before this.
//
// Each motif is a picture of what its game actually does. That is the only
// reason a table keyed by pack id is acceptable here (see `art.ts`): FORGE
// really is a smelting chain, THE SPLIT really does cut a factor tree open,
// and no procedure can infer either from an id.

/** What a shape is drawn with. `catalog.css` binds each to a colour. */
export type Ink = "line" | "thin" | "bold" | "glow" | "fill" | "veil" | "warm" | "pale"

export type Shape =
  | {
      readonly kind: "path"
      readonly d: string
      readonly ink: Ink
      readonly alpha?: number
      readonly dash?: string
    }
  | {
      readonly kind: "circle"
      readonly cx: number
      readonly cy: number
      readonly r: number
      readonly ink: Ink
      readonly alpha?: number
    }
  | {
      readonly kind: "rect"
      readonly x: number
      readonly y: number
      readonly width: number
      readonly height: number
      readonly ink: Ink
      readonly alpha?: number
      readonly radius?: number
    }

/** Two decimals. Enough for a 100-unit field, and it keeps the markup small. */
const n = (value: number): string => String(Math.round(value * 100) / 100)

const path = (d: string, ink: Ink = "line", alpha?: number, dash?: string): Shape => ({
  kind: "path",
  d,
  ink,
  ...(alpha === undefined ? {} : { alpha }),
  ...(dash === undefined ? {} : { dash }),
})

const line = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ink: Ink = "line",
  alpha?: number,
  dash?: string,
): Shape => path(`M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`, ink, alpha, dash)

const dot = (cx: number, cy: number, r: number, ink: Ink = "line", alpha?: number): Shape => ({
  kind: "circle",
  cx,
  cy,
  r,
  ink,
  ...(alpha === undefined ? {} : { alpha }),
})

const box = (
  x: number,
  y: number,
  width: number,
  height: number,
  ink: Ink = "line",
  alpha?: number,
  radius?: number,
): Shape => ({
  kind: "rect",
  x,
  y,
  width,
  height,
  ink,
  ...(alpha === undefined ? {} : { alpha }),
  ...(radius === undefined ? {} : { radius }),
})

/** A closed polygon from a flat list of coordinates. */
const poly = (points: readonly number[], ink: Ink = "line", alpha?: number): Shape => {
  let d = ""
  for (let i = 0; i < points.length; i += 2) {
    d += `${i === 0 ? "M" : "L"}${n(points[i] ?? 0)} ${n(points[i + 1] ?? 0)}`
  }
  return path(`${d}Z`, ink, alpha)
}

const rad = (degrees: number): number => (degrees * Math.PI) / 180
const px = (cx: number, r: number, degrees: number): number => cx + r * Math.cos(rad(degrees))
const py = (cy: number, r: number, degrees: number): number => cy + r * Math.sin(rad(degrees))

/** A ray outward from a centre, between two radii. */
const ray = (
  cx: number,
  cy: number,
  from: number,
  to: number,
  degrees: number,
  ink: Ink = "line",
  alpha?: number,
): Shape =>
  line(px(cx, from, degrees), py(cy, from, degrees), px(cx, to, degrees), py(cy, to, degrees), ink, alpha)

/** A number in a range, from the motif's own generator. */
const between = (rng: () => number, low: number, high: number): number => low + rng() * (high - low)

type Motif = (rng: () => number) => Shape[]

// ── The twenty-seven, and the one that covers everything else ──────────────

/** ARENA — a radius law you see before you read it. */
const orbs: Motif = (rng) => {
  const out: Shape[] = []
  for (const r of [32, 23, 14]) out.push(dot(50, 52, r, "veil"))
  out.push(dot(50, 52, 11, "glow"), dot(50, 52, 11, "bold"), dot(50, 52, 4, "pale", 0.9))
  for (let i = 0; i < 7; i++) {
    const angle = i * 51 + between(rng, -12, 12)
    const dist = between(rng, 26, 42)
    out.push(dot(px(50, dist, angle), py(52, dist, angle), between(rng, 2.4, 7.5), "fill", 0.75))
  }
  return out
}

/** COUNTERPOISE — the scale physically is the equals sign. */
const balance: Motif = (rng) => {
  const tilt = between(rng, -3, 3)
  const left = 50 - tilt
  const right = 50 + tilt
  return [
    poly([50, 60, 41, 88, 59, 88], "line"),
    line(50, 60, 50, 44, "thin"),
    line(18, 44 + tilt, 82, 44 - tilt, "bold"),
    line(18, 44 + tilt, 18, 58 + tilt, "thin"),
    line(82, 44 - tilt, 82, 58 - tilt, "thin"),
    path(`M8 ${n(58 + tilt)}A10 7 0 0 0 28 ${n(58 + tilt)}`, "line"),
    path(`M72 ${n(58 - tilt)}A10 7 0 0 0 92 ${n(58 - tilt)}`, "line"),
    box(13, 50 + tilt, 5, 5, "fill", 0.8),
    box(79, 50 - tilt, 5, 5, "fill", 0.8),
    dot(left, 40, 2, "warm"),
    dot(right, 40, 2, "warm"),
    line(30, 44, 70, 44, "glow", 0.5),
  ]
}

/** THE TUNING HALL (pack id `dynawalla.beam`) — ride a beam, fire, hear the remainder. */
const beams: Motif = (rng) => {
  const out: Shape[] = []
  const rows = [24, 42, 60, 78]
  rows.forEach((y, index) => {
    out.push(line(10, y, 90, y, index === 1 ? "bold" : "veil"))
    for (let x = 14; x < 90; x += 9) out.push(line(x, y - 2.5, x, y + 2.5, "thin", 0.45))
  })
  out.push(
    poly([26, 36, 33, 42, 26, 42], "fill", 0.95),
    line(34, 42, 88, 42, "glow", 0.6),
    line(34, 42, 88, 42, "warm", 0.9, "6 4"),
  )
  for (let i = 0; i < 4; i++) {
    const y = rows[Math.floor(between(rng, 0, 3.99))] ?? 24
    out.push(dot(between(rng, 44, 84), y - 6, between(rng, 1.6, 3.2), "fill", 0.6))
  }
  return out
}

/** CLAIM — cut the plane and take exactly the part you were asked for. */
const region: Motif = (rng) => {
  const cut = between(rng, 40, 58)
  const out: Shape[] = [
    box(12, 12, 76, 76, "veil"),
    poly([12, 12, 88, 12, 88, 88, cut, 88, cut, 52, 12, 52], "fill", 0.16),
    poly([12, 12, 88, 12, 88, 88, cut, 88, cut, 52, 12, 52], "line"),
  ]
  for (let x = 16; x < 88; x += 8) out.push(line(x, 12, x - 8, 20, "thin", 0.3))
  out.push(dot(between(rng, cut + 8, 84), between(rng, 62, 80), 3.2, "warm"))
  out.push(dot(between(rng, 18, cut - 8), between(rng, 62, 80), 2.2, "pale", 0.7))
  return out
}

/** THE COIL OF NINETY-SIX — a number written in place value, articulated. */
const coil: Motif = (rng) => {
  const out: Shape[] = []
  let r = 36
  let angle = between(rng, -20, 20)
  for (let i = 0; i < 11; i++) {
    const next = angle + 42
    out.push(
      path(
        `M${n(px(50, r, angle))} ${n(py(52, r, angle))}A${n(r)} ${n(r)} 0 0 1 ${n(px(50, r * 0.9, next))} ${n(py(52, r * 0.9, next))}`,
        i === 0 ? "bold" : "line",
        1 - i * 0.05,
      ),
      dot(px(50, r, angle), py(52, r, angle), 1.8, "fill", 0.85),
    )
    angle = next
    r *= 0.9
  }
  out.push(dot(50, 52, 3, "warm"), ray(50, 52, 38, 48, -20 + 0, "glow", 0.7))
  return out
}

/** COLOSSUS — strike wrong and the tower gets taller. */
const tower: Motif = (rng) => {
  const out: Shape[] = [box(30, 12, 40, 9, "warm", 0.9)]
  for (let i = 0; i < 6; i++) {
    const w = between(rng, 30, 46)
    out.push(box(50 - w / 2, 26 + i * 10, w, 8, i === 3 ? "fill" : "line", i === 3 ? 0.4 : 1))
  }
  out.push(
    poly([4, 52, 24, 46, 24, 62], "fill", 0.9),
    line(24, 54, 32, 54, "glow", 0.8),
    line(30, 12, 70, 12, "glow", 0.6),
  )
  return out
}

/** THE COUNTERWEIGHT — hold exactly one notch ahead, then seat the beam. */
const steelyard: Motif = (rng) => {
  const slide = between(rng, 60, 82)
  const out: Shape[] = [
    line(10, 46, 92, 46, "bold"),
    poly([32, 46, 25, 76, 39, 76], "line"),
    line(10, 46, 10, 58, "thin"),
    path("M2 58A8 6 0 0 0 18 58", "line"),
    box(6, 52, 5, 5, "fill", 0.8),
    box(slide - 4, 38, 8, 9, "fill", 0.95),
    line(slide, 47, slide, 54, "warm"),
  ]
  for (let x = 40; x < 90; x += 7) out.push(line(x, 42, x, 46, "thin", 0.5))
  out.push(line(28, 46, 92, 46, "glow", 0.4))
  return out
}

/** FORGE — every problem struck on the anvil pays sparks. */
const anvil: Motif = (rng) => {
  const out: Shape[] = [
    poly([26, 46, 74, 46, 78, 52, 70, 56, 30, 56, 22, 52], "line"),
    poly([42, 56, 58, 56, 62, 72, 38, 72], "line"),
    box(30, 72, 40, 6, "fill", 0.35),
  ]
  for (let i = 0; i < 9; i++) {
    const angle = -160 + i * 16 + between(rng, -5, 5)
    out.push(ray(50, 44, 8, between(rng, 16, 30), angle, i % 3 === 0 ? "warm" : "line", 0.85))
  }
  for (let i = 0; i < 4; i++) {
    out.push(box(14 + i * 20, 86, 10, 8, "veil"), dot(19 + i * 20, 90, 1.6, "fill", 0.7))
    if (i < 3) out.push(line(24 + i * 20, 90, 34 + i * 20, 90, "thin", 0.5))
  }
  out.push(dot(50, 44, 9, "glow", 0.7))
  return out
}

/** THE GRAPPLE FOUNDRY — two leverage plates, one exact total, three slaps. */
const ring: Motif = (rng) => {
  const out: Shape[] = [
    poly([16, 60, 84, 60, 96, 92, 4, 92], "fill", 0.14),
    poly([16, 60, 84, 60, 96, 92, 4, 92], "line"),
  ]
  for (let i = 0; i < 3; i++) {
    const y = 26 + i * 11
    out.push(line(10, y, 90, y, i === 1 ? "line" : "veil"))
  }
  out.push(line(12, 22, 12, 62, "thin"), line(88, 22, 88, 62, "thin"))
  const lift = between(rng, -4, 4)
  out.push(
    dot(32, 74 + lift, 9, "bold"),
    dot(68, 74 - lift, 9, "bold"),
    line(41, 74 + lift, 59, 74 - lift, "fill", 0.9),
    dot(32, 74 + lift, 3, "warm"),
  )
  return out
}

/** GUILTY — four husks, three of them a mistake children actually make. */
const crosshair: Motif = (rng) => {
  const target = Math.floor(between(rng, 0, 3.99))
  const out: Shape[] = [line(14, 20, 86, 20, "veil", 0.8, "5 4")]
  for (let i = 0; i < 4; i++) {
    const x = 14 + i * 20
    out.push(box(x, 44, 16, 16, i === target ? "bold" : "line", i === target ? 1 : 0.6, 3))
  }
  const cx = 22 + target * 20
  out.push(
    dot(cx, 52, 13, "warm", 0.9),
    line(cx - 17, 52, cx - 10, 52, "warm"),
    line(cx + 10, 52, cx + 17, 52, "warm"),
    line(cx, 35, cx, 42, "warm"),
    line(cx, 62, cx, 69, "warm"),
    line(cx, 92, cx, 62, "glow", 0.8),
    poly([cx - 4, 92, cx + 4, 92, cx, 84], "fill", 0.95),
  )
  return out
}

/** DEEPSWARM — move; the swarm comes; the light wins. */
const swarm: Motif = (rng) => {
  const out: Shape[] = [dot(50, 52, 13, "glow", 0.8), dot(50, 52, 6, "fill", 0.9), dot(50, 52, 30, "veil")]
  for (let i = 0; i < 18; i++) {
    const angle = i * 20 + between(rng, -8, 8)
    const far = between(rng, 32, 48)
    out.push(ray(50, 52, far, far - between(rng, 5, 10), angle, "line", 0.7))
  }
  for (let i = 0; i < 5; i++) {
    const angle = between(rng, 0, 360)
    out.push(dot(px(50, 22, angle), py(52, 22, angle), 2, "warm", 0.85))
  }
  return out
}

/** THE LATTICE — shoot a composite and it splits along a factor pair. */
const springgrid: Motif = (rng) => {
  const out: Shape[] = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 18 + col * 16
      const y = 18 + row * 16
      out.push(dot(x, y, 1.8, "fill", 0.55))
      if (col < 4) out.push(path(`M${n(x)} ${n(y)}Q${n(x + 8)} ${n(y + between(rng, -3, 3))} ${n(x + 16)} ${n(y)}`, "veil"))
      if (row < 4) out.push(path(`M${n(x)} ${n(y)}Q${n(x + between(rng, -3, 3))} ${n(y + 8)} ${n(x)} ${n(y + 16)}`, "veil"))
    }
  }
  out.push(
    dot(50, 50, 9, "glow", 0.9),
    dot(42, 50, 6, "bold"),
    dot(58, 50, 6, "bold"),
    line(48, 50, 52, 50, "warm"),
    dot(82, 82, 3, "warm"),
  )
  return out
}

/** ABYSSAL BLOOM — two polyps with the same number shove into their sum. */
const reef: Motif = (rng) => {
  const out: Shape[] = [path("M6 88Q50 78 94 88", "veil")]
  for (let i = 0; i < 5; i++) {
    const x = 16 + i * 17
    const h = between(rng, 22, 44)
    const bend = between(rng, -8, 8)
    out.push(
      path(`M${n(x)} 86Q${n(x + bend)} ${n(86 - h / 2)} ${n(x + bend)} ${n(86 - h)}`, "line"),
      dot(x + bend, 86 - h, between(rng, 3, 6), "fill", 0.75),
    )
  }
  out.push(
    dot(42, 34, 8, "bold"),
    dot(56, 34, 8, "bold"),
    dot(49, 34, 4, "warm"),
    dot(49, 34, 12, "glow", 0.7),
  )
  return out
}

/** FUSE — chips that touch and make the key number fuse into one. */
const well: Motif = (rng) => {
  const out: Shape[] = [
    poly([18, 14, 82, 14, 66, 78, 34, 78], "veil"),
    line(30, 84, 70, 84, "bold"),
  ]
  for (let i = 0; i < 6; i++) {
    out.push(dot(between(rng, 34, 66), between(rng, 24, 70), between(rng, 3, 5.5), "line", 0.7))
  }
  out.push(
    dot(44, 52, 7, "bold"),
    dot(56, 52, 7, "bold"),
    dot(50, 52, 10, "glow", 0.9),
    line(47, 52, 53, 52, "warm"),
    line(50, 49, 50, 55, "warm"),
  )
  return out
}

/** MOSAIC — a stained-glass wall that is a times table. */
const tiles: Motif = (rng) => {
  const out: Shape[] = []
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      if (rng() < 0.18) continue
      out.push(box(11 + col * 13, 12 + row * 11, 11, 9, rng() < 0.25 ? "fill" : "line", 0.65))
    }
  }
  out.push(
    box(36, 84, 28, 5, "bold", 1, 2),
    dot(58, 74, 3.2, "warm"),
    path("M58 74Q44 62 30 58", "line", 0.6, "4 4"),
    line(36, 84, 64, 84, "glow", 0.7),
  )
  return out
}

/** POLARITY — the ship's sign is the arithmetic. */
const polarity: Motif = (rng) => {
  const out: Shape[] = [
    poly([50, 60, 60, 82, 50, 76, 40, 82], "fill", 0.95),
    poly([50, 60, 60, 82, 50, 76, 40, 82], "line"),
    dot(50, 72, 14, "glow", 0.5),
  ]
  for (let i = 0; i < 4; i++) {
    const x = 16 + i * 23
    const y = between(rng, 18, 38)
    const plus = rng() < 0.5
    out.push(dot(x, y, 7, plus ? "bold" : "veil"), line(x - 3.5, y, x + 3.5, y, plus ? "warm" : "line"))
    if (plus) out.push(line(x, y - 3.5, x, y + 3.5, "warm"))
    out.push(line(x, y + 8, 50, 58, "thin", 0.35, "3 4"))
  }
  return out
}

/** PULSE — the playfield is exactly one bar. */
const bar: Motif = (rng) => {
  const head = between(rng, 40, 74)
  const out: Shape[] = [box(8, 40, 84, 22, "veil"), line(8, 51, 92, 51, "thin", 0.4)]
  for (let i = 1; i < 4; i++) out.push(line(8 + i * 21, 36, 8 + i * 21, 66, "line", 0.7))
  for (let i = 0; i < 4; i++) {
    out.push(dot(8 + i * 21 + 10.5, 51, i === 1 ? 5.5 : 4, i === 1 ? "warm" : "fill", 0.9))
  }
  out.push(line(head, 30, head, 72, "bold"), line(head, 30, head, 72, "glow", 0.8), line(8, 74, 92, 74, "veil"))
  return out
}

/** SPLITBEAT — the bar of music is the fraction bar. */
const lanes: Motif = (rng) => {
  const out: Shape[] = [
    line(50, 14, 14, 88, "veil"),
    line(50, 14, 50, 88, "veil"),
    line(50, 14, 86, 88, "veil"),
  ]
  const depths = [36, 54, 76]
  depths.forEach((y, index) => {
    const spread = (y - 14) * 0.49
    const parts = 1 << index
    for (let i = 0; i < parts; i++) {
      const x1 = 50 - spread + (i * 2 * spread) / parts + 1
      const x2 = 50 - spread + ((i + 1) * 2 * spread) / parts - 1
      out.push(line(x1, y, x2, y, index === 2 ? "bold" : "line", 0.9))
    }
  })
  out.push(
    line(8, 88, 92, 88, "bold"),
    line(8, 88, 92, 88, "glow", 0.8),
    dot(between(rng, 26, 74), 88, 3, "warm"),
  )
  return out
}

/** VOLTA — the lane you are in when you cross is the answer you gave. */
const causeway: Motif = (rng) => {
  const out: Shape[] = [
    line(20, 96, 46, 22, "line"),
    line(80, 96, 54, 22, "line"),
    line(6, 22, 94, 22, "veil"),
  ]
  for (let i = 0; i < 5; i++) {
    const t = i / 5
    const y = 96 - t * 68
    out.push(line(50, y, 50, y - 6, "veil", 0.7))
  }
  for (let i = 0; i < 3; i++) {
    const x = 38 + i * 12
    out.push(path(`M${n(x - 5)} 54L${n(x - 5)} 46A5 5 0 0 1 ${n(x + 5)} 46L${n(x + 5)} 54`, i === 1 ? "warm" : "line", 0.9))
  }
  out.push(
    poly([50, 76, 56, 90, 50, 86, 44, 90], "fill", 0.95),
    line(50, 78, 50, 96, "glow", 0.7),
    dot(between(rng, 20, 80), between(rng, 10, 18), 1.8, "pale", 0.6),
  )
  return out
}

/** SERPENT — every orb is a claim, and the wrong one costs a length of tail. */
const serpent: Motif = (rng) => {
  const wave = between(rng, 16, 26)
  const spine = `M10 74Q${n(26)} ${n(74 - wave)} 34 58Q${n(42)} ${n(42)} 54 44Q${n(66)} ${n(46)} 68 32Q${n(70)} ${n(20)} 84 18`
  const out: Shape[] = [path(spine, "glow", 0.8), path(spine, "bold")]
  for (let i = 0; i < 7; i++) {
    const t = i / 6
    out.push(dot(10 + t * 60, 74 - t * 44 + Math.sin(t * 6) * 5, 2.2, "fill", 0.7 - t * 0.3))
  }
  out.push(dot(84, 18, 5.5, "bold"), dot(86, 16, 1.6, "warm"))
  for (let i = 0; i < 3; i++) {
    const x = between(rng, 20, 84)
    const y = between(rng, 74, 92)
    out.push(dot(x, y, 4.5, "veil"), dot(x, y, 1.8, "fill", 0.8))
  }
  return out
}

/** SIEGE — the anvil mints embers, and embers hold the line. */
const wall: Motif = (rng) => {
  const out: Shape[] = [box(20, 54, 60, 30, "line")]
  for (let i = 0; i < 5; i++) out.push(box(20 + i * 13, 46, 8, 8, "line"))
  out.push(path("M0 92Q26 84 52 92", "veil", 0.9, "5 4"))
  for (let i = 0; i < 8; i++) {
    out.push(
      dot(between(rng, 26, 74), between(rng, 14, 44), between(rng, 1.2, 3), i % 3 === 0 ? "warm" : "fill", between(rng, 0.4, 0.95)),
    )
  }
  out.push(box(38, 68, 24, 16, "fill", 0.25), line(20, 68, 80, 68, "glow", 0.6))
  return out
}

/** SKY LEDGER — the sky is the coordinate plane. */
const astrolabe: Motif = (rng) => {
  const out: Shape[] = []
  for (let i = 1; i < 5; i++) {
    out.push(line(i * 20, 6, i * 20, 94, "veil", 0.4), line(6, i * 20, 94, i * 20, "veil", 0.4))
  }
  const angle = between(rng, -70, -20)
  out.push(
    dot(50, 54, 27, "line"),
    dot(50, 54, 19, "veil"),
    dot(50, 54, 2.5, "fill"),
    ray(50, 54, -27, 27, angle, "bold"),
    dot(px(50, 27, angle), py(54, 27, angle), 3, "warm"),
  )
  for (let i = 0; i < 12; i++) out.push(ray(50, 54, 24, 27, i * 30, "thin", 0.7))
  const sx = between(rng, 10, 34)
  out.push(line(sx, 10, sx + 12, 26, "line", 0.8, "4 3"), dot(sx + 12, 26, 2.4, "pale"))
  return out
}

/** THE SPLIT — cut a composite open and its factors come out of the wound. */
const split: Motif = (rng) => {
  const lean = between(rng, -10, 10)
  return [
    line(8, 88, 92, 12, "glow", 0.8),
    line(8, 88, 92, 12, "bold"),
    dot(50 + lean, 24, 9, "line"),
    line(50 + lean, 24, 50 + lean, 26, "warm"),
    line(46 + lean, 33, 30, 56, "line", 0.8),
    line(54 + lean, 33, 70, 56, "line", 0.8),
    dot(30, 62, 7, "bold"),
    dot(70, 62, 7, "bold"),
    line(24, 68, 18, 82, "thin", 0.6),
    line(36, 68, 42, 82, "thin", 0.6),
    dot(18, 86, 3.5, "fill", 0.8),
    dot(42, 86, 3.5, "fill", 0.8),
    dot(70, 62, 2.5, "warm"),
  ]
}

/** MONUMENT — the drop has to be true twice. */
const slabs: Motif = (rng) => {
  const out: Shape[] = []
  let x = 24
  for (let i = 0; i < 6; i++) {
    x += between(rng, -5, 5)
    out.push(box(x, 82 - i * 11, 52, 9, i === 0 ? "fill" : "line", i === 0 ? 0.3 : 1))
  }
  const sweep = between(rng, 8, 30)
  out.push(
    box(sweep, 10, 52, 9, "bold"),
    line(sweep - 8, 14.5, sweep - 2, 14.5, "warm", 0.9),
    line(50, 6, 50, 94, "veil", 0.5, "3 5"),
    box(sweep, 10, 52, 9, "glow", 0.35),
  )
  return out
}

/** FOUNDRY STREET — a mob that splits is not a mob. */
const street: Motif = (rng) => {
  const out: Shape[] = [line(4, 94, 40, 26, "veil"), line(96, 94, 60, 26, "veil"), line(6, 26, 94, 26, "veil", 0.6)]
  for (let i = 0; i < 7; i++) {
    const x = 14 + i * 12
    const h = between(rng, 14, 22)
    out.push(
      path(`M${n(x)} ${n(74)}L${n(x)} ${n(74 - h)}`, i === 3 ? "veil" : "line"),
      dot(x, 74 - h - 3.5, 3.2, i === 3 ? "veil" : "fill", 0.85),
    )
  }
  out.push(
    path("M50 96L46 80L54 66L48 52L52 38", "glow", 0.9),
    path("M50 96L46 80L54 66L48 52L52 38", "warm"),
    dot(52, 38, 2.6, "warm"),
  )
  return out
}

/** TREBUCHET — the range dial is the answer. */
const trebuchet: Motif = (rng) => {
  const reach = between(rng, 62, 86)
  return [
    poly([14, 84, 30, 44, 46, 84], "line"),
    line(10, 84, 92, 84, "veil"),
    line(30, 44, 18, 62, "bold"),
    box(13, 62, 10, 9, "fill", 0.9),
    line(30, 44, 52, 30, "line"),
    path(`M52 30Q${n((52 + reach) / 2)} 2 ${n(reach)} 76`, "warm", 0.85, "5 4"),
    box(reach - 8, 66, 17, 18, "line"),
    box(reach - 8, 62, 4, 4, "line"),
    box(reach - 1, 62, 4, 4, "line"),
    box(reach + 6, 62, 4, 4, "line"),
    dot(reach, 76, 3, "glow", 0.9),
  ]
}

/** THE TRUE DRAW — draw if it is true, hold if it is false. */
const slate: Motif = (rng) => {
  const out: Shape[] = [
    box(16, 22, 68, 38, "fill", 0.16, 2),
    box(16, 22, 68, 38, "line", 1, 2),
    box(16, 22, 68, 38, "glow", 0.4, 2),
  ]
  for (let i = 0; i < 3; i++) {
    out.push(line(24, 32 + i * 10, 24 + between(rng, 26, 52), 32 + i * 10, i === 1 ? "warm" : "pale", i === 1 ? 0.9 : 0.55))
  }
  out.push(
    path("M28 76L36 84L50 68", "bold"),
    line(64, 68, 64, 84, "veil"),
    line(72, 68, 72, 84, "veil"),
  )
  for (let i = 0; i < 9; i++) out.push(dot(between(rng, 8, 92), between(rng, 88, 96), between(rng, 0.6, 1.4), "pale", 0.4))
  return out
}

/**
 * The fallback, and the reason a twenty-eighth game needs no code change here.
 *
 * A seeded star polygon inside two rings: the point count, the skip and the
 * ray pattern all come out of the id, so two unknown packs get two visibly
 * different sigils rather than the same grey placeholder twice. It is the one
 * motif that is genuinely procedural, and it is deliberately the *most*
 * ornamental of the set — an unrecognised game should look like it was made
 * for this app, not like a hole in it.
 */
const sigil: Motif = (rng) => {
  const points = 7 + Math.floor(rng() * 6)
  const skip = 2 + Math.floor(rng() * Math.max(1, Math.floor(points / 2) - 1))
  const radius = between(rng, 28, 34)
  const spin = between(rng, 0, 90)

  let d = ""
  for (let i = 0; i <= points; i++) {
    const angle = spin + ((i * skip) % points) * (360 / points)
    d += `${i === 0 ? "M" : "L"}${n(px(50, radius, angle))} ${n(py(52, radius, angle))}`
  }

  const out: Shape[] = [path(`${d}Z`, "glow", 0.6), path(`${d}Z`, "line"), dot(50, 52, radius + 5, "veil")]
  for (let i = 0; i < points; i++) {
    const angle = spin + i * (360 / points)
    out.push(ray(50, 52, radius + 5, radius + 11, angle, "thin", 0.6))
    out.push(dot(px(50, radius, angle), py(52, radius, angle), 1.6, "fill", 0.8))
  }
  out.push(dot(50, 52, between(rng, 4, 8), "warm", 0.9), dot(50, 52, 14, "veil"))
  return out
}


/**
 * THE GAVEL — three bids in the room, and the hammer one coin over the highest.
 *
 * The middle tablet is the highest and is the one lit; the dashed line above the room
 * is the broker's offer, which is what stops the answer being "bid as much as you
 * like". The hammer is coming down one coin over the lit tablet.
 */
const auction: Motif = (rng) => {
  const heights = [between(rng, 16, 26), between(rng, 34, 44), between(rng, 20, 30)]
  const out: Shape[] = [line(6, 88, 94, 88, "veil")]
  for (let i = 0; i < 3; i++) {
    const h = heights[i] ?? 20
    const x = 14 + i * 26
    const top = 88 - h
    out.push(
      box(x, top, 20, h, i === 1 ? "fill" : "line", i === 1 ? 0.26 : 1, 1),
      box(x, top, 20, h, i === 1 ? "warm" : "pale", i === 1 ? 1 : 0.7, 1),
      line(x + 4, top + 7, x + 16, top + 7, "pale", 0.55),
    )
  }
  const crown = 88 - (heights[1] ?? 38)
  out.push(
    line(8, 20, 92, 20, "veil", 0.6, "4 4"),
    box(40, 20, 20, 5, "veil", 0.35, 1),
    line(58, 30, 78, 12, "bold"),
    box(72, 6, 16, 9, "fill", 0.9, 1),
    box(72, 6, 16, 9, "glow", 0.5, 1),
    dot(50, crown - 5, 2.8, "glow", 0.9),
    dot(50, crown - 5, 1.4, "warm"),
  )
  return out
}

const MOTIFS = {
  orbs,
  balance,
  beams,
  region,
  coil,
  tower,
  steelyard,
  anvil,
  ring,
  crosshair,
  swarm,
  springgrid,
  reef,
  well,
  tiles,
  polarity,
  bar,
  lanes,
  causeway,
  serpent,
  wall,
  astrolabe,
  split,
  slabs,
  street,
  trebuchet,
  slate,
  auction,
  sigil,
} as const satisfies Record<string, Motif>

export type MotifKey = keyof typeof MOTIFS

export const MOTIF_KEYS = Object.keys(MOTIFS) as readonly MotifKey[]

/** Draw one. Total over `MotifKey`, so an unknown key is a type error here. */
export function shapesOf(motif: MotifKey, rng: () => number): readonly Shape[] {
  return MOTIFS[motif](rng)
}
