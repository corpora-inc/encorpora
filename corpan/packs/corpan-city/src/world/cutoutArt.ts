/**
 * cutoutArt — premium procedural paper-cutout art for Corpan City.
 *
 * Drop-in upgrade for billboard.ts's drawCharacter/drawProp + placeholderDraw.
 * Same signatures: a DrawFn is (ctx, w, h) => void painting onto a cutout's
 * DynamicTexture; `cutoutDraw(id)` mirrors `placeholderDraw(url)` returning
 * { w, h, draw, shadow }. The orchestrator swaps billboard's placeholderDraw
 * for cutoutDraw with no other change.
 *
 * Look goal: layered cut paper in a cozy pop-up storybook. Every shape is a
 * paper piece — a soft contact drop-shadow under it, a thick cream "deckle"
 * (torn-paper) rim around it, then the colour fill, then small painted detail.
 * Tasteful and lovable (South-Park-simple silhouettes, but warm). Textures are
 * kept at 256–384px so they're phone-light.
 *
 * NOTE: this is a STAND-IN. When the Spark 2D sprite pipeline lands, these
 * functions are replaced wholesale by atlas blits (see docs/WORLD_DIRECTION.md).
 */

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

/* ----------------------------------------------------------------- helpers */

const path = {
  rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  },
}

/**
 * Trace a "torn paper" version of the current path's bounding region as a
 * wobbly rounded rect. Cheap deterministic jitter keyed by position so edges
 * look hand-cut rather than vector-perfect.
 */
function torn(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  amp = 2.2,
) {
  const rr = Math.min(r, w / 2, h / 2)
  const steps = 64
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    // unit point on a rounded-rect-ish superellipse
    const ux = Math.cos(t)
    const uy = Math.sin(t)
    const k = 1 - rr / Math.min(w, h)
    const sx = Math.sign(ux) * Math.pow(Math.abs(ux), 1 - k * 0.6)
    const sy = Math.sign(uy) * Math.pow(Math.abs(uy), 1 - k * 0.6)
    // deterministic wobble
    const jitter = Math.sin(t * 9.3 + cx * 0.7) * Math.cos(t * 5.1 + cy * 0.3) * amp
    const px = cx + sx * (w / 2 + jitter)
    const py = cy + sy * (h / 2 + jitter)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

/**
 * Paint one paper piece: contact shadow, torn cream deckle, fill, faint inner
 * shade for a hint of bend. `tornEdge` off → clean rounded (good for tidy props).
 */
function paper(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string | CanvasGradient,
  opts: { tornEdge?: boolean; deckle?: number; shadow?: number } = {},
) {
  const deckle = opts.deckle ?? 7
  const tornEdge = opts.tornEdge ?? true

  // soft contact drop-shadow (paper floating above paper)
  ctx.save()
  ctx.shadowColor = "rgba(28,20,12,0.30)"
  ctx.shadowBlur = opts.shadow ?? 9
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 6
  ctx.fillStyle = "rgba(255,250,240,1)"
  if (tornEdge) torn(ctx, x - deckle, y - deckle, w + deckle * 2, h + deckle * 2, r + deckle)
  else path.rounded(ctx, x - deckle, y - deckle, w + deckle * 2, h + deckle * 2, r + deckle)
  ctx.fill()
  ctx.restore()

  // cream deckle border (the torn paper rim) is the white shape just filled;
  // now lay the colour fill inset within it
  ctx.fillStyle = fill
  if (tornEdge) torn(ctx, x, y, w, h, r, 1.4)
  else path.rounded(ctx, x, y, w, h, r)
  ctx.fill()

  // faint top sheen + bottom shade so the piece feels gently curved
  ctx.save()
  if (tornEdge) torn(ctx, x, y, w, h, r, 1.4)
  else path.rounded(ctx, x, y, w, h, r)
  ctx.clip()
  const sh = ctx.createLinearGradient(0, y, 0, y + h)
  sh.addColorStop(0, "rgba(255,255,255,0.16)")
  sh.addColorStop(0.5, "rgba(255,255,255,0)")
  sh.addColorStop(1, "rgba(20,12,6,0.14)")
  ctx.fillStyle = sh
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4)
  ctx.restore()
}

const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: string) => {
  ctx.beginPath()
  ctx.fillStyle = c
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** rosy cheeks + warm friendly face. cx,cy = head centre, r = head radius. */
function face(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  opts: { smile?: number; cheeks?: boolean; brow?: number } = {},
) {
  const smile = opts.smile ?? 0.07
  // cheeks
  if (opts.cheeks !== false) {
    ctx.save()
    ctx.globalAlpha = 0.5
    dot(ctx, cx - r * 0.5, cy + r * 0.18, r * 0.18, "#e9967a")
    dot(ctx, cx + r * 0.5, cy + r * 0.18, r * 0.18, "#e9967a")
    ctx.restore()
  }
  // eyes (warm dark, with a tiny highlight)
  const ex = r * 0.36
  const ey = cy - r * 0.05
  dot(ctx, cx - ex, ey, r * 0.12, "#2a2018")
  dot(ctx, cx + ex, ey, r * 0.12, "#2a2018")
  dot(ctx, cx - ex + r * 0.04, ey - r * 0.04, r * 0.04, "#fff")
  dot(ctx, cx + ex + r * 0.04, ey - r * 0.04, r * 0.04, "#fff")
  // brows (optional, gives character)
  if (opts.brow) {
    ctx.strokeStyle = "#3a2a1c"
    ctx.lineWidth = r * 0.06
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(cx - ex - r * 0.14, ey - r * 0.34)
    ctx.lineTo(cx - ex + r * 0.14, ey - r * 0.34 + r * opts.brow)
    ctx.moveTo(cx + ex - r * 0.14, ey - r * 0.34 + r * opts.brow)
    ctx.lineTo(cx + ex + r * 0.14, ey - r * 0.34)
    ctx.stroke()
  }
  // smile
  ctx.strokeStyle = "#7a3b28"
  ctx.lineWidth = r * 0.1
  ctx.lineCap = "round"
  ctx.beginPath()
  ctx.arc(cx, cy + r * 0.1, r * 0.45, (0.5 - smile) * Math.PI, (0.5 + smile + 0.5) * Math.PI)
  ctx.stroke()
}

/* ------------------------------------------------------------- characters */

interface CharStyle {
  body: string
  bodyAlt?: string
  skin?: string
  hat?: string
  hatBand?: string
  hair?: string
  apron?: string
  brow?: number
  prop?: "bread" | "needle" | "satchel" | "spark"
}

function drawCharacter(ctx: CanvasRenderingContext2D, w: number, h: number, s: CharStyle) {
  const cx = w / 2
  const skin = s.skin ?? "#f0c79a"

  // ---- legs (two small paper strips so they read as standing) ----
  const legW = w * 0.12
  const legY = h * 0.78
  const legH = h * 0.18
  paper(ctx, cx - w * 0.16, legY, legW, legH, legW * 0.45, "#5a4636", { deckle: 4 })
  paper(ctx, cx + w * 0.04, legY, legW, legH, legW * 0.45, "#5a4636", { deckle: 4 })

  // ---- body (a soft trapezoidal tunic) ----
  const bodyGrad = ctx.createLinearGradient(0, h * 0.44, 0, h * 0.82)
  const top = s.body
  const bot = s.bodyAlt ?? s.body
  bodyGrad.addColorStop(0, top)
  bodyGrad.addColorStop(1, bot)
  paper(ctx, cx - w * 0.26, h * 0.44, w * 0.52, h * 0.4, w * 0.16, bodyGrad)

  // arms
  paper(ctx, cx - w * 0.34, h * 0.46, w * 0.12, h * 0.26, w * 0.06, top, { deckle: 4 })
  paper(ctx, cx + w * 0.22, h * 0.46, w * 0.12, h * 0.26, w * 0.06, top, { deckle: 4 })

  // apron / vest accent over the tunic
  if (s.apron) {
    ctx.save()
    path.rounded(ctx, cx - w * 0.18, h * 0.52, w * 0.36, h * 0.3, w * 0.06)
    ctx.fillStyle = s.apron
    ctx.globalAlpha = 0.92
    ctx.fill()
    ctx.restore()
    // collar line
    ctx.strokeStyle = "rgba(255,255,255,0.5)"
    ctx.lineWidth = w * 0.012
    ctx.beginPath()
    ctx.moveTo(cx - w * 0.1, h * 0.52)
    ctx.lineTo(cx, h * 0.6)
    ctx.lineTo(cx + w * 0.1, h * 0.52)
    ctx.stroke()
  }

  // ---- head ----
  const hr = w * 0.2
  const hy = h * 0.3
  // hair behind the head (a paper blob), if any
  if (s.hair) {
    paper(ctx, cx - hr * 1.15, hy - hr * 1.1, hr * 2.3, hr * 1.7, hr * 0.9, s.hair, { deckle: 4 })
  }
  paper(ctx, cx - hr, hy - hr, hr * 2, hr * 2, hr, skin, { deckle: 5 })
  face(ctx, cx, hy, hr, { cheeks: true, brow: s.brow, smile: 0.08 })

  // ---- hat ----
  if (s.hat) {
    const band = s.hatBand ?? "rgba(0,0,0,0.18)"
    // brim
    paper(ctx, cx - hr * 1.5, hy - hr * 0.9, hr * 3, hr * 0.5, hr * 0.25, s.hat, { deckle: 4 })
    // crown
    paper(ctx, cx - hr * 0.95, hy - hr * 2.0, hr * 1.9, hr * 1.25, hr * 0.5, s.hat, { deckle: 4 })
    // band
    ctx.fillStyle = band
    path.rounded(ctx, cx - hr * 0.95, hy - hr * 1.0, hr * 1.9, hr * 0.22, hr * 0.1)
    ctx.fill()
  }

  // ---- a little held prop for personality ----
  if (s.prop === "bread") {
    paper(ctx, cx + w * 0.2, h * 0.58, w * 0.18, w * 0.1, w * 0.05, "#d9a25a", { deckle: 3 })
    ctx.strokeStyle = "rgba(120,70,30,0.5)"
    ctx.lineWidth = w * 0.01
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + w * 0.24 + i * w * 0.04, h * 0.585)
      ctx.lineTo(cx + w * 0.27 + i * w * 0.04, h * 0.62)
      ctx.stroke()
    }
  } else if (s.prop === "needle") {
    ctx.strokeStyle = "#d8d8d8"
    ctx.lineWidth = w * 0.012
    ctx.beginPath()
    ctx.moveTo(cx - w * 0.34, h * 0.5)
    ctx.lineTo(cx - w * 0.42, h * 0.66)
    ctx.stroke()
    dot(ctx, cx - w * 0.34, h * 0.5, w * 0.02, "#c0392b")
  } else if (s.prop === "satchel") {
    paper(ctx, cx + w * 0.18, h * 0.56, w * 0.18, h * 0.16, w * 0.04, "#9c6b3f", { deckle: 3 })
    ctx.strokeStyle = "rgba(60,40,20,0.5)"
    ctx.lineWidth = w * 0.02
    ctx.beginPath()
    ctx.moveTo(cx + w * 0.18, h * 0.56)
    ctx.quadraticCurveTo(cx + w * 0.1, h * 0.44, cx + w * 0.06, h * 0.5)
    ctx.stroke()
  }
}

/* ------------------------------------------------------------------ props */

function drawCafe(ctx: CanvasRenderingContext2D, w: number, h: number, awning: string) {
  const cx = w / 2
  // back wall / counter body
  const wall = ctx.createLinearGradient(0, h * 0.34, 0, h * 0.9)
  wall.addColorStop(0, "#e7d3ab")
  wall.addColorStop(1, "#cbb083")
  paper(ctx, cx - w * 0.36, h * 0.34, w * 0.72, h * 0.56, w * 0.05, wall)

  // shutters / window
  paper(ctx, cx - w * 0.26, h * 0.42, w * 0.22, h * 0.3, w * 0.03, "#88563a", { deckle: 3 })
  paper(ctx, cx + w * 0.04, h * 0.42, w * 0.22, h * 0.3, w * 0.03, "#88563a", { deckle: 3 })
  ctx.strokeStyle = "rgba(255,255,255,0.35)"
  ctx.lineWidth = w * 0.01
  for (const ox of [-0.15, 0.15]) {
    ctx.beginPath()
    ctx.moveTo(cx + w * ox, h * 0.42)
    ctx.lineTo(cx + w * ox, h * 0.72)
    ctx.stroke()
  }

  // striped awning (the signature pop of accent colour)
  const ay = h * 0.24
  const aw = w * 0.86
  const ah = h * 0.16
  paper(ctx, cx - aw / 2, ay, aw, ah, w * 0.03, awning, { deckle: 4, tornEdge: false })
  ctx.save()
  path.rounded(ctx, cx - aw / 2, ay, aw, ah, w * 0.03)
  ctx.clip()
  ctx.fillStyle = "rgba(255,255,255,0.85)"
  const stripes = 6
  for (let i = 0; i < stripes; i += 2) {
    ctx.fillRect(cx - aw / 2 + (aw / stripes) * i, ay, aw / stripes, ah)
  }
  // scalloped lower edge
  ctx.fillStyle = awning
  const scal = 7
  for (let i = 0; i < scal; i++) {
    ctx.beginPath()
    ctx.arc(cx - aw / 2 + (aw / scal) * (i + 0.5), ay + ah, aw / scal / 2, 0, Math.PI)
    ctx.fill()
  }
  ctx.restore()

  // a tiny potted plant for life
  paper(ctx, cx + w * 0.24, h * 0.72, w * 0.1, h * 0.12, w * 0.02, "#b5673f", { deckle: 2 })
  dot(ctx, cx + w * 0.29, h * 0.7, w * 0.06, "#6f9c54")
  dot(ctx, cx + w * 0.25, h * 0.73, w * 0.05, "#7faa5e")
  dot(ctx, cx + w * 0.33, h * 0.73, w * 0.05, "#5f8c49")
}

function drawStall(ctx: CanvasRenderingContext2D, w: number, h: number, awning: string) {
  const cx = w / 2
  // posts
  paper(ctx, cx - w * 0.34, h * 0.3, w * 0.06, h * 0.58, w * 0.02, "#8a6a44", { deckle: 3 })
  paper(ctx, cx + w * 0.28, h * 0.3, w * 0.06, h * 0.58, w * 0.02, "#8a6a44", { deckle: 3 })
  // table
  const tbl = ctx.createLinearGradient(0, h * 0.6, 0, h * 0.78)
  tbl.addColorStop(0, "#caa472")
  tbl.addColorStop(1, "#a9804f")
  paper(ctx, cx - w * 0.38, h * 0.58, w * 0.76, h * 0.16, w * 0.03, tbl)
  // produce baskets
  const fruit = (fx: number, c1: string) => {
    paper(ctx, cx + fx, h * 0.5, w * 0.16, h * 0.12, w * 0.04, "#9c6b3f", { deckle: 2 })
    dot(ctx, cx + fx + w * 0.04, h * 0.5, w * 0.035, c1)
    dot(ctx, cx + fx + w * 0.1, h * 0.5, w * 0.035, c1)
    dot(ctx, cx + fx + w * 0.07, h * 0.46, w * 0.035, c1)
  }
  fruit(-w * 0.32, "#d24b3a")
  fruit(-w * 0.06, "#e2a33a")
  fruit(w * 0.2, "#7fae4a")
  // canopy
  const ay = h * 0.22
  const aw = w * 0.86
  paper(ctx, cx - aw / 2, ay, aw, h * 0.14, w * 0.03, awning, { deckle: 4, tornEdge: false })
  ctx.save()
  path.rounded(ctx, cx - aw / 2, ay, aw, h * 0.14, w * 0.03)
  ctx.clip()
  ctx.fillStyle = "rgba(255,255,255,0.8)"
  for (let i = 0; i < 6; i += 2) ctx.fillRect(cx - aw / 2 + (aw / 6) * i, ay, aw / 6, h * 0.14)
  ctx.restore()
}

function drawFountain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2
  // lower stone basin (wide ellipse-ish)
  const stone = ctx.createLinearGradient(0, h * 0.6, 0, h * 0.9)
  stone.addColorStop(0, "#cfd6d2")
  stone.addColorStop(1, "#9aa6a2")
  paper(ctx, cx - w * 0.38, h * 0.62, w * 0.76, h * 0.26, w * 0.13, stone)
  // water in basin
  ctx.save()
  path.rounded(ctx, cx - w * 0.32, h * 0.64, w * 0.64, h * 0.12, w * 0.06)
  ctx.fillStyle = "#a9dcea"
  ctx.fill()
  ctx.clip()
  ctx.strokeStyle = "rgba(255,255,255,0.6)"
  ctx.lineWidth = w * 0.008
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.ellipse(cx, h * 0.7, w * (0.1 + i * 0.08), h * 0.02, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
  // central pillar
  paper(ctx, cx - w * 0.08, h * 0.32, w * 0.16, h * 0.34, w * 0.05, stone, { deckle: 4 })
  // upper bowl
  paper(ctx, cx - w * 0.18, h * 0.3, w * 0.36, h * 0.1, w * 0.05, stone, { deckle: 4 })
  // water jet
  ctx.fillStyle = "rgba(180,225,238,0.85)"
  path.rounded(ctx, cx - w * 0.03, h * 0.14, w * 0.06, h * 0.2, w * 0.03)
  ctx.fill()
  // droplets arc
  for (let i = -2; i <= 2; i++) {
    dot(ctx, cx + i * w * 0.07, h * (0.2 + Math.abs(i) * 0.03), w * 0.018, "rgba(200,235,245,0.9)")
  }
}

function drawBench(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2
  const wood = ctx.createLinearGradient(0, h * 0.4, 0, h * 0.7)
  wood.addColorStop(0, "#c08a4e")
  wood.addColorStop(1, "#9a6a36")
  // backrest slats
  paper(ctx, cx - w * 0.36, h * 0.34, w * 0.72, h * 0.1, w * 0.04, wood, { deckle: 4 })
  paper(ctx, cx - w * 0.36, h * 0.46, w * 0.72, h * 0.1, w * 0.04, wood, { deckle: 4 })
  // seat
  paper(ctx, cx - w * 0.38, h * 0.58, w * 0.76, h * 0.1, w * 0.04, wood)
  // legs
  paper(ctx, cx - w * 0.32, h * 0.66, w * 0.07, h * 0.2, w * 0.02, "#6f4a24", { deckle: 3 })
  paper(ctx, cx + w * 0.25, h * 0.66, w * 0.07, h * 0.2, w * 0.02, "#6f4a24", { deckle: 3 })
}

/* ------------------------------------------------------------- registry */

const CHARACTERS: Record<string, CharStyle> = {
  "npc-baker": {
    body: "#d98f57", bodyAlt: "#c4763f", apron: "#f3ead2", hat: "#f2e8d0",
    hatBand: "#c46b4a", skin: "#f0c79a", hair: "#5a3b24", brow: 0.18, prop: "bread",
  },
  "npc-tailor": {
    body: "#5a7d9a", bodyAlt: "#46647e", apron: "#2f3e4a", skin: "#e8b98a",
    hair: "#2e2620", brow: 0.1, prop: "needle",
  },
  "npc-traveler": {
    body: "#6f9c54", bodyAlt: "#577f40", hat: "#b5854a", hatBand: "#7a5a30",
    skin: "#d9a26f", hair: "#3a2a1c", brow: 0.22, prop: "satchel",
  },
  player: {
    body: "#3f7fae", bodyAlt: "#336b96", hat: "#e0c060", hatBand: "#c79a2e",
    skin: "#f0c79a", hair: "#43301d", brow: 0.12,
  },
}

type PropKind = "cafe" | "stall" | "fountain" | "bench"

function drawProp(ctx: CanvasRenderingContext2D, w: number, h: number, kind: PropKind, accent: string) {
  if (kind === "cafe") return drawCafe(ctx, w, h, accent)
  if (kind === "stall") return drawStall(ctx, w, h, "#4a8cc4")
  if (kind === "fountain") return drawFountain(ctx, w, h)
  return drawBench(ctx, w, h)
}

export interface CutoutSpec {
  w: number
  h: number
  draw: DrawFn
  shadow: number
}

/**
 * Resolve a cutout id (the placeholder:* tail, e.g. "npc-baker", "cafe") to a
 * draw function + plane dims + blob-shadow radius. Mirrors billboard.ts's
 * placeholderDraw so it can be swapped in directly.
 */
export function cutoutDraw(id: string, accent = "#c46b4a"): CutoutSpec {
  const kind = id.replace(/^placeholder:/, "")

  if (kind in CHARACTERS) {
    const style = CHARACTERS[kind]
    return { w: 256, h: 384, shadow: 0.72, draw: (c, w, h) => drawCharacter(c, w, h, style) }
  }

  const propKind: PropKind =
    kind === "cafe" ? "cafe" : kind === "bench" ? "bench" : kind === "fountain" ? "fountain" : "stall"
  const dim = propKind === "fountain" || propKind === "bench" ? { w: 320, h: 256 } : { w: 320, h: 320 }
  const shadow = propKind === "bench" ? 1.0 : propKind === "fountain" ? 1.3 : 1.25
  return { ...dim, shadow, draw: (c, w, h) => drawProp(c, w, h, propKind, accent) }
}
