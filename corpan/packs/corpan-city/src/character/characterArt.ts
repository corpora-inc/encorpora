import type { CharacterSpec, ClothingLayer, Expression } from "./characterSpec"

/**
 * characterArt — premium LAYERED paper-doll renderer.
 *
 * Paints a CharacterSpec onto a cutout's 2D texture as stacked torn-paper
 * pieces: legs → torso (top/bottom) → outer → apron → arms → head (hair/face) →
 * hat → held prop. Every piece has a soft contact drop-shadow + a cream deckle
 * (torn) rim, so the whole figure reads as cut paper in a pop-up storybook.
 *
 * Crisp at mobile DPR: textures are 256×384 (phone-light). The same draw fn
 * takes an optional `Pose` so `animator.ts` can repaint per-frame channels
 * (mouth open for talk, arm raised for wave, blink) without changing geometry —
 * the body's hop/bob lives on the 3D node (grounded), only expression/gesture
 * is redrawn here.
 *
 * Replaces cutoutArt's fixed CHARACTERS. Props/buildings still live in cutoutArt.
 */

export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void

/** Per-frame animation pose the renderer reflects (animator-driven). */
export interface Pose {
  /** 0 closed .. 1 wide — talk mouth. */
  mouth?: number
  /** -1..1 — raise the right arm (wave/gesture). */
  rightArm?: number
  /** -1..1 — raise the left arm. */
  leftArm?: number
  /** 0..1 — blink (1 = eyes shut). */
  blink?: number
  /** -0.3..0.3 — head tilt (radians-ish), for nod/turn flavour. */
  headTilt?: number
  /** legs stride phase -1..1 (subtle — most stride is the 3D bob). */
  stride?: number
  /**
   * TRANSIENT EMOTION CHANNEL — a momentary expression the runtime pushes over
   * the RESTING face (delighted / surprised / sleepy …), tied to the NPC's mood
   * beat. It modulates warmth/expression WITHOUT changing identity: the resting
   * `face.expression` is the baseline and this is blended on top by `emotionAmt`.
   * When `emotionAmt` eases back to 0 the face returns to its resting self.
   *
   * Cheap: it only changes the `ExprShape` channels the renderer already reads
   * (mouth curve/open/width, brow, lids, cheeks) — no new draw path — so it rides
   * the same dirty-checked repaint as talk/blink. Reduced-motion safe: a caller
   * may snap `emotionAmt` to 0/1 instead of easing, and the face still reads.
   */
  emotion?: Expression
  /** 0..1 blend of the transient `emotion` over the resting expression. default 0. */
  emotionAmt?: number
}

/**
 * MOOD → transient EMOTION map. The 8 `MOOD_BEATS` (npc/promptProgram.ts) are the
 * single source of moods; this maps each beat to a wholesome face emotion so an
 * NPC's face matches the mood the model is voicing. Keyed by a stable substring
 * so it never drifts if a beat's wording is lightly retuned. Unknown → `smile`
 * (warm default), never a sneer — the murderous-mob guardrail holds for moods too.
 */
const MOOD_EMOTION: ReadonlyArray<readonly [string, Expression]> = [
  ["delighted", "grin"],
  ["drowsy", "sleepy"],
  ["gossipy", "smirk"], // confiding — a *gentle* knowing look (clamped, see below)
  ["rushed", "surprised"],
  ["nostalgic", "content"],
  ["proud", "smile"],
  ["playful", "grin"],
  ["mischievous", "smirk"],
  ["unhurried", "content"],
  ["savoring", "content"],
]

/**
 * Resolve a mood-beat string (or a bare Expression) to the transient face
 * emotion. Wholesome by construction: the only path to an asymmetric look
 * (`smirk`) is the gossipy/mischievous beats, and even there the emotion channel
 * caps the skew so it reads as a warm, confiding half-smile — never a sneer.
 */
export function moodToEmotion(moodOrExpr: string): Expression {
  const lower = moodOrExpr.toLowerCase()
  for (const [needle, expr] of MOOD_EMOTION) {
    if (lower.includes(needle)) return expr
  }
  // a bare Expression passed straight through (still clamped at render time)
  return (moodOrExpr as Expression) || "smile"
}

/* ----------------------------------------------------------------- helpers */

function roundedPath(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** torn-paper outline as a wobbly superellipse — deterministic per position. */
function tornPath(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, amp = 2.2,
) {
  const rr = Math.min(r, w / 2, h / 2)
  const steps = 56
  const cx = x + w / 2
  const cy = y + h / 2
  ctx.beginPath()
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const ux = Math.cos(t)
    const uy = Math.sin(t)
    const k = 1 - rr / Math.min(w, h)
    const sx = Math.sign(ux) * Math.pow(Math.abs(ux), 1 - k * 0.6)
    const sy = Math.sign(uy) * Math.pow(Math.abs(uy), 1 - k * 0.6)
    const jitter = Math.sin(t * 9.3 + cx * 0.7) * Math.cos(t * 5.1 + cy * 0.3) * amp
    const px = cx + sx * (w / 2 + jitter)
    const py = cy + sy * (h / 2 + jitter)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

interface PaperOpts {
  tornEdge?: boolean
  deckle?: number
  shadow?: number
  pattern?: ClothingLayer["pattern"]
  patternColor?: string
}

/** One paper piece: contact shadow → cream deckle → fill → curvature sheen. */
function paper(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  fill: string | CanvasGradient,
  opts: PaperOpts = {},
) {
  const deckle = opts.deckle ?? 7
  const tornEdge = opts.tornEdge ?? true

  ctx.save()
  ctx.shadowColor = "rgba(28,20,12,0.30)"
  ctx.shadowBlur = opts.shadow ?? 9
  ctx.shadowOffsetX = 2
  ctx.shadowOffsetY = 6
  ctx.fillStyle = "rgba(255,250,240,1)"
  if (tornEdge) tornPath(ctx, x - deckle, y - deckle, w + deckle * 2, h + deckle * 2, r + deckle)
  else roundedPath(ctx, x - deckle, y - deckle, w + deckle * 2, h + deckle * 2, r + deckle)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = fill
  if (tornEdge) tornPath(ctx, x, y, w, h, r, 1.4)
  else roundedPath(ctx, x, y, w, h, r)
  ctx.fill()

  // pattern (clipped to the fill)
  if (opts.pattern && opts.pattern !== "plain") {
    ctx.save()
    if (tornEdge) tornPath(ctx, x, y, w, h, r, 1.4)
    else roundedPath(ctx, x, y, w, h, r)
    ctx.clip()
    ctx.strokeStyle = opts.patternColor ?? "rgba(255,255,255,0.28)"
    ctx.lineWidth = Math.max(2, w * 0.05)
    if (opts.pattern === "stripe") {
      for (let sx = x - h; sx < x + w + h; sx += w * 0.22) {
        ctx.beginPath()
        ctx.moveTo(sx, y)
        ctx.lineTo(sx + h, y + h)
        ctx.stroke()
      }
    } else if (opts.pattern === "check") {
      for (let sx = x; sx < x + w; sx += w * 0.28) {
        ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx, y + h); ctx.stroke()
      }
      for (let sy = y; sy < y + h; sy += w * 0.28) {
        ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x + w, sy); ctx.stroke()
      }
    } else if (opts.pattern === "trim") {
      ctx.strokeRect(x + w * 0.08, y + h * 0.08, w * 0.84, h * 0.84)
    }
    ctx.restore()
  }

  // curvature sheen
  ctx.save()
  if (tornEdge) tornPath(ctx, x, y, w, h, r, 1.4)
  else roundedPath(ctx, x, y, w, h, r)
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
  ctx.beginPath(); ctx.fillStyle = c; ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

/* ----------------------------------------------------------------- face */

/**
 * EXPRESSION MODEL — wholesome + SYMMETRIC by default.
 *
 * Each resting expression resolves to a small bundle of channels that the face
 * renderer reads. The two asymmetric expressions (`smirk`,`sneer`) are the ONLY
 * ones with a non-zero `skew` and are reserved (by characterGen) for sly/villain
 * characters; everything else mirrors perfectly left↔right so a plaza reads as a
 * friendly mixed crowd, not a sneering mob.
 */
interface ExprShape {
  /** mouth corner curve: + = smile (up), - = frown (down). Symmetric. */
  curve: number
  /** mouth open amount 0..1 at rest (the round "oh" of surprise). */
  open: number
  /** widen the mouth (grin). 0..1. */
  width: number
  /** brow inner-raise (worry/shy/surprise lifts the inner ends up). */
  browInner: number
  /** brow overall vertical lift (+ up = surprised, - down = serious). */
  browLift: number
  /** eyelid droop 0..1 (sleepy/content half-lids). */
  lid: number
  /** ASYMMETRY — the ONLY source of one-sidedness. 0 = symmetric (wholesome). */
  skew: number
  /** a faint hint of teeth on the resting mouth (grin/surprised). */
  teeth: boolean
  /**
   * CHEEK RAISE 0..1 — the "Duchenne" tell of a genuine smile: the lower lids
   * lift + cheeks bunch. This is the single biggest warmth lever and is what
   * kept the old set from reading flat. Driven up by smile/grin/content.
   */
  cheekRaise: number
}

function exprShape(e: CharacterSpec["face"]["expression"]): ExprShape {
  const base: ExprShape = {
    curve: 0.08, open: 0, width: 0, browInner: 0, browLift: 0, lid: 0, skew: 0,
    teeth: false, cheekRaise: 0,
  }
  switch (e) {
    case "neutral":
      return { ...base, curve: 0.04, cheekRaise: 0.08 }
    case "smile":
    case "warm":
      return { ...base, curve: 0.16, cheekRaise: 0.45 }
    case "grin":
    case "cheery":
      return { ...base, curve: 0.26, width: 0.5, teeth: true, cheekRaise: 0.7 }
    case "content":
      return { ...base, curve: 0.12, lid: 0.28, cheekRaise: 0.5 }
    case "shy":
      return { ...base, curve: 0.13, width: -0.2, browInner: 0.5, cheekRaise: 0.4 }
    case "frown":
    case "stern":
      // gruff/serious — NOT mean. A soft cheek-raise keeps even a frown kindly.
      return { ...base, curve: -0.12, browLift: -0.14, browInner: -0.15, cheekRaise: 0.06 }
    case "surprised":
      return { ...base, curve: 0.02, open: 0.5, width: -0.3, browLift: 0.3, browInner: 0.3, cheekRaise: 0.2 }
    case "sleepy":
    case "tired":
      return { ...base, curve: 0.05, lid: 0.55, browLift: 0.04, cheekRaise: 0.15 }
    // ── RARE asymmetric (sly / villain) ──
    case "smirk":
    case "sly":
      // a knowing half-smile — still warm; the cheek-raise keeps it friendly
      return { ...base, curve: 0.06, skew: 1, lid: 0.12, cheekRaise: 0.3 }
    case "sneer":
      return { ...base, curve: -0.02, skew: 1.3, browLift: -0.06, lid: 0.18, cheekRaise: 0 }
    default:
      return base
  }
}

/**
 * Blend the resting ExprShape toward a transient EMOTION shape by `amt` (0..1).
 * Identity-preserving: at amt=0 the resting face is untouched; at amt=1 the
 * emotion dominates the mood-driven channels. The `skew` (asymmetry) is CAPPED
 * during emotion blends so a transient mood can never turn a wholesome face into
 * a sneer — the murderous-mob guardrail survives the emotion channel.
 */
function blendExpr(rest: ExprShape, emotion: ExprShape, amt: number): ExprShape {
  if (amt <= 0) return rest
  const a = Math.max(0, Math.min(1, amt))
  const mix = (x: number, y: number) => x + (y - x) * a
  // emotion skew is clamped to a gentle knowing look — never a full sneer skew.
  const targetSkew = Math.min(emotion.skew, 1)
  return {
    curve: mix(rest.curve, emotion.curve),
    open: mix(rest.open, emotion.open),
    width: mix(rest.width, emotion.width),
    browInner: mix(rest.browInner, emotion.browInner),
    browLift: mix(rest.browLift, emotion.browLift),
    lid: mix(rest.lid, emotion.lid),
    // never let a transient emotion ADD asymmetry to an otherwise-symmetric face
    skew: rest.skew > 0 ? mix(rest.skew, targetSkew) : 0,
    teeth: a > 0.5 ? emotion.teeth || rest.teeth : rest.teeth,
    cheekRaise: mix(rest.cheekRaise, emotion.cheekRaise),
  }
}

/* ----- per-face parametric defaults (back-compat for sparse FaceSpecs) ----- */

interface FaceParams {
  eyeShape: NonNullable<CharacterSpec["face"]["eyeShape"]>
  eyeSize: number
  eyeSpacing: number
  noseStyle: NonNullable<CharacterSpec["face"]["noseStyle"]>
  faceShape: NonNullable<CharacterSpec["face"]["faceShape"]>
  browShape: NonNullable<CharacterSpec["face"]["browShape"]>
  ageBand: NonNullable<CharacterSpec["face"]["ageBand"]>
  lipFullness: number
  freckles: boolean
  beautyMark: boolean
  dimples: boolean
  eyeColor: string
}

/** Fill a (possibly sparse) FaceSpec with anti-uncanny-clamped defaults. */
function faceParams(f: CharacterSpec["face"]): FaceParams {
  const clamp = (v: number | undefined, lo: number, hi: number, d: number) =>
    v == null ? d : Math.max(lo, Math.min(hi, v))
  return {
    eyeShape: f.eyeShape ?? "round",
    eyeSize: clamp(f.eyeSize, 0.82, 1.22, 1),
    eyeSpacing: clamp(f.eyeSpacing, 0.86, 1.14, 1),
    noseStyle: f.noseStyle ?? "soft",
    faceShape: f.faceShape ?? "round",
    browShape: f.browShape ?? "soft",
    ageBand: f.ageBand ?? "adult",
    lipFullness: clamp(f.lipFullness, 0.8, 1.3, 1),
    freckles: f.freckles ?? false,
    beautyMark: f.beautyMark ?? false,
    dimples: f.dimples ?? false,
    eyeColor: f.eyeColor ?? "#4a3322",
  }
}

/**
 * Draw the resting/talking MOUTH. Symmetric for every wholesome expression; the
 * `skew` channel (only smirk/sneer) lifts ONE corner. `mouthOpen` (0..1) comes
 * from the animator's talk cadence / real audio amplitude and overrides the
 * resting shape with an animated open/close.
 */
function drawMouth(
  ctx: CanvasRenderingContext2D,
  cx: number, my: number, r: number,
  sh: ExprShape, mouthOpen: number, lipFullness = 1,
) {
  const lip = "#9a4a34"
  const inside = "#6e2f22"
  // half-width of the mouth, widened by grin
  const hw = r * (0.26 + sh.width * 0.14) * (0.9 + lipFullness * 0.1)

  if (mouthOpen > 0.06 || sh.open > 0.06) {
    // OPEN mouth — talking, or a resting "oh" (surprised). An ellipse whose
    // vertical radius tracks the open amount → believable oscilloscope open/close.
    const amt = Math.max(mouthOpen, sh.open)
    const oh = r * (0.03 + amt * 0.26) // vertical opening
    const ow = hw * (1 - amt * 0.18) // closes slightly horizontally as it opens
    // the resting curve shifts the whole mouth vertically a touch (smile lifts)
    const myc = my - sh.curve * r * 0.12
    ctx.fillStyle = inside
    ctx.beginPath()
    ctx.ellipse(cx, myc, ow, oh, 0, 0, Math.PI * 2)
    ctx.fill()
    // upper teeth hint
    if (amt > 0.18 || sh.teeth) {
      ctx.save()
      ctx.beginPath(); ctx.ellipse(cx, myc, ow, oh, 0, 0, Math.PI * 2); ctx.clip()
      ctx.fillStyle = "#fff"
      ctx.beginPath()
      ctx.ellipse(cx, myc - oh * 0.66, ow * 0.92, oh * 0.42, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    // lip rim
    ctx.strokeStyle = lip; ctx.lineWidth = r * 0.05; ctx.lineCap = "round"
    ctx.beginPath(); ctx.ellipse(cx, myc, ow, oh, 0, 0, Math.PI * 2); ctx.stroke()
    return
  }

  // CLOSED mouth — a stroked arc. Symmetric unless skew lifts one corner.
  ctx.strokeStyle = lip; ctx.lineWidth = r * (0.07 + lipFullness * 0.03); ctx.lineCap = "round"
  const dip = sh.curve * r * 0.5 // how far the centre dips below the corners
  const lx = cx - hw
  const rx = cx + hw
  // corner heights: skew raises the RIGHT corner only (sly read)
  const ly = my - sh.skew * r * 0.0
  const ryy = my - sh.skew * r * 0.16
  ctx.beginPath()
  ctx.moveTo(lx, ly)
  // quadratic through a control point pulled down by `dip` (smile = corners up)
  ctx.quadraticCurveTo(cx, my + dip, rx, ryy)
  ctx.stroke()
  // grin/teeth: a thin bright line just inside an upturned wide mouth
  if (sh.teeth && sh.curve > 0.1) {
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = r * 0.05
    ctx.beginPath()
    ctx.moveTo(lx + hw * 0.18, ly + r * 0.02)
    ctx.quadraticCurveTo(cx, my + dip + r * 0.05, rx - hw * 0.18, ryy + r * 0.02)
    ctx.stroke()
  }
}

/**
 * Draw ONE eye (centered at ex,ey) shaped by the eye family. Symmetric by
 * construction: the caller draws left + right with the SAME shape, mirrored, so
 * a wholesome face can never go one-sided. `mirror` flips the upturn/downturn
 * tilt so the pair tilts outward together (still mirror-symmetric).
 */
function drawEye(
  ctx: CanvasRenderingContext2D,
  ex: number, ey: number, r: number,
  shape: NonNullable<CharacterSpec["face"]["eyeShape"]>,
  size: number, lid: number, cheekRaise: number, iris: string, mirror: number,
) {
  // base eye radius, grown by cheekRaise pinching the lower lid up a touch
  const er = r * 0.13 * size
  // family → width/height ratio + outer-corner tilt (mirrored by `mirror`)
  let wRatio = 1, hRatio = 1, tilt = 0
  switch (shape) {
    case "round": wRatio = 1; hRatio = 1; break
    case "almond": wRatio = 1.22; hRatio = 0.82; break
    case "wide": wRatio = 1.35; hRatio = 0.92; break
    case "soft": wRatio = 1.1; hRatio = 1.05; break
    case "upturned": wRatio = 1.2; hRatio = 0.86; tilt = 0.18; break
    case "downturned": wRatio = 1.18; hRatio = 0.9; tilt = -0.12; break
  }
  const ew = er * wRatio
  // genuine-smile squint: cheekRaise lifts the LOWER lid (reduces visible height)
  const eh = er * hRatio * (1 - lid * 0.5) * (1 - cheekRaise * 0.28)
  ctx.save()
  ctx.translate(ex, ey)
  ctx.rotate(tilt * mirror)
  // sclera-free paper look: a soft white bed under a dark iris (premium, cute)
  ctx.fillStyle = "rgba(255,255,255,0.92)"
  ctx.beginPath(); ctx.ellipse(0, 0, ew * 1.04, eh * 1.04, 0, 0, Math.PI * 2); ctx.fill()
  // iris + pupil
  const irisR = Math.min(ew, eh) * 0.92
  ctx.fillStyle = iris
  ctx.beginPath(); ctx.ellipse(0, eh * 0.06, irisR, irisR, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = "#241a12"
  ctx.beginPath(); ctx.ellipse(0, eh * 0.06, irisR * 0.55, irisR * 0.55, 0, 0, Math.PI * 2); ctx.fill()
  // catchlight — the warmth sparkle
  ctx.fillStyle = "rgba(255,255,255,0.95)"
  ctx.beginPath(); ctx.ellipse(-ew * 0.28, -eh * 0.3, er * 0.22, er * 0.22, 0, 0, Math.PI * 2); ctx.fill()
  // upper lash line — a soft arc framing the eye (never a harsh squint)
  ctx.strokeStyle = "rgba(42,32,24,0.85)"; ctx.lineWidth = r * 0.045; ctx.lineCap = "round"
  ctx.beginPath()
  ctx.moveTo(-ew, -eh * 0.2)
  ctx.quadraticCurveTo(0, -eh * 1.2, ew, -eh * 0.2)
  ctx.stroke()
  ctx.restore()
  // partial lid droop (sleepy/content) — a skin curtain over the top
  if (lid > 0.12 && lid <= 0.85) {
    ctx.save()
    ctx.fillStyle = "rgba(0,0,0,0)" // overwritten by caller's skin fill below
    ctx.restore()
  }
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  spec: CharacterSpec, pose: Pose,
) {
  const f = spec.face
  const p = faceParams(f)
  // resting shape, then blend the transient emotion over it (identity preserved).
  const rest = exprShape(f.expression)
  const emoAmt = pose.emotionAmt ?? 0
  const sh = emoAmt > 0 && pose.emotion
    ? blendExpr(rest, exprShape(pose.emotion), emoAmt)
    : rest

  // age-driven tuning: elders get heavier lids + a lower brow set + crinkles.
  const age = p.ageBand
  const ageLid = age === "elder" ? 0.18 : 0
  const ageBrowDrop = age === "elder" ? 0.04 : age === "child" ? -0.03 : 0

  // cheeks — rosy by toggle, AND lifted/brightened by a genuine smile (cheekRaise)
  const cheekY = cy + r * 0.2 - sh.cheekRaise * r * 0.04
  if (f.cheeks || sh.cheekRaise > 0.35) {
    ctx.save()
    ctx.globalAlpha = 0.32 + sh.cheekRaise * 0.28
    dot(ctx, cx - r * 0.52, cheekY, r * (0.16 + sh.cheekRaise * 0.04), "#e9967a")
    dot(ctx, cx + r * 0.52, cheekY, r * (0.16 + sh.cheekRaise * 0.04), "#e9967a")
    ctx.restore()
  }

  // EYES — symmetric by construction (same shape, mirrored L↔R).
  const ex = r * 0.36 * p.eyeSpacing
  const ey = cy - r * 0.05
  const blink = pose.blink ?? 0
  const lid = Math.max(sh.lid + ageLid, blink > 0.6 ? 1 : 0)
  if (lid > 0.85) {
    // closed eyes = gentle upturned happy arcs (sleeping/blink) — friendly
    ctx.strokeStyle = "#2a2018"; ctx.lineWidth = r * 0.07; ctx.lineCap = "round"
    const closedCurve = sh.curve > 0.1 ? r * 0.05 : r * 0.04 // smile→eyes arc up
    ctx.beginPath()
    ctx.moveTo(cx - ex - r * 0.13, ey + r * 0.01)
    ctx.quadraticCurveTo(cx - ex, ey - closedCurve, cx - ex + r * 0.13, ey + r * 0.01)
    ctx.moveTo(cx + ex - r * 0.13, ey + r * 0.01)
    ctx.quadraticCurveTo(cx + ex, ey - closedCurve, cx + ex + r * 0.13, ey + r * 0.01)
    ctx.stroke()
  } else {
    drawEye(ctx, cx - ex, ey, r, p.eyeShape, p.eyeSize, lid, sh.cheekRaise, p.eyeColor, -1)
    drawEye(ctx, cx + ex, ey, r, p.eyeShape, p.eyeSize, lid, sh.cheekRaise, p.eyeColor, 1)
    // partial droop: a skin curtain clipping the top of each eye
    if (lid > 0.12) {
      ctx.fillStyle = spec.skinTone
      ctx.fillRect(cx - ex - r * 0.2, ey - r * 0.2, r * 0.4, r * 0.18 * (1 + lid))
      ctx.fillRect(cx + ex - r * 0.2, ey - r * 0.2, r * 0.4, r * 0.18 * (1 + lid))
    }
  }

  // NOSE — a small mark between the eyes. Family sets its shape; never a caricature.
  const ny = cy + r * 0.12
  ctx.save()
  ctx.strokeStyle = "rgba(120,80,52,0.5)"
  ctx.fillStyle = "rgba(120,80,52,0.4)"
  ctx.lineWidth = r * 0.045; ctx.lineCap = "round"
  switch (p.noseStyle) {
    case "button":
      dot(ctx, cx, ny, r * 0.06, "rgba(150,100,66,0.4)")
      break
    case "straight":
      ctx.beginPath(); ctx.moveTo(cx, ny - r * 0.14); ctx.lineTo(cx, ny + r * 0.04)
      ctx.lineTo(cx + r * 0.07, ny + r * 0.06); ctx.stroke()
      break
    case "broad":
      ctx.beginPath(); ctx.ellipse(cx, ny, r * 0.1, r * 0.07, 0, 0, Math.PI * 2); ctx.fill()
      break
    case "petite":
      ctx.beginPath(); ctx.moveTo(cx - r * 0.04, ny); ctx.lineTo(cx + r * 0.04, ny); ctx.stroke()
      break
    default: // "soft"
      ctx.beginPath()
      ctx.moveTo(cx - r * 0.05, ny - r * 0.04)
      ctx.quadraticCurveTo(cx, ny + r * 0.06, cx + r * 0.05, ny - r * 0.04)
      ctx.stroke()
  }
  ctx.restore()

  // FRECKLES — a warm dusting across the nose/cheeks (rare garnish).
  if (p.freckles) {
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = "#a06a3c"
    const fpts = [[-0.5, 0.16], [-0.4, 0.24], [-0.6, 0.24], [0.5, 0.16], [0.4, 0.24], [0.6, 0.24],
      [-0.12, 0.1], [0.12, 0.1]] as const
    for (const [fx, fy] of fpts) dot(ctx, cx + r * fx, cy + r * fy, r * 0.022, "#a06a3c")
    ctx.restore()
  }

  // BROWS — symmetric for every wholesome expression. browShape sets the arc;
  // inner ends raise for shy/worried/surprised; only smirk/sneer (skew) lifts ONE.
  const brow = f.brow
  const baseY = ey - r * (0.34 + (p.eyeSize - 1) * 0.06) + (sh.browLift + ageBrowDrop) * r
  const innerDY = -sh.browInner * r * 0.18
  // browShape → the mid control-point lift (arch) and inner/outer tilt.
  let arch = 0, outerDrop = 0
  switch (p.browShape) {
    case "straight": arch = 0; outerDrop = 0; break
    case "arched": arch = r * 0.1; outerDrop = r * 0.02; break
    case "rounded": arch = r * 0.07; outerDrop = -r * 0.01; break
    default: arch = r * 0.04; outerDrop = 0 // "soft"
  }
  ctx.strokeStyle = "#3a2a1c"; ctx.lineWidth = r * (0.05 + brow * 0.3); ctx.lineCap = "round"
  ctx.lineJoin = "round"
  const bhw = r * 0.16
  // left brow (curved): outer → arched mid → inner
  ctx.beginPath()
  ctx.moveTo(cx - ex - bhw, baseY + outerDrop)
  ctx.quadraticCurveTo(cx - ex, baseY - arch, cx - ex + bhw, baseY + innerDY)
  // right brow mirrored; skew lifts the inner end extra (sly read only)
  ctx.moveTo(cx + ex + bhw, baseY + outerDrop)
  ctx.quadraticCurveTo(cx + ex, baseY - arch - sh.skew * r * 0.08,
    cx + ex - bhw, baseY + innerDY - sh.skew * r * 0.14)
  ctx.stroke()

  // MOUTH — talk amplitude (pose.mouth) drives open/close; else resting shape.
  const my = cy + r * 0.36
  drawMouth(ctx, cx, my, r, sh, pose.mouth ?? 0, p.lipFullness)

  // DIMPLES — soft commas flanking an upturned mouth (warm garnish).
  if (p.dimples && sh.curve > 0.08) {
    ctx.save(); ctx.globalAlpha = 0.35
    ctx.strokeStyle = "rgba(120,80,52,0.6)"; ctx.lineWidth = r * 0.035; ctx.lineCap = "round"
    const dw = r * (0.26 + sh.width * 0.14) + r * 0.08
    ctx.beginPath()
    ctx.moveTo(cx - dw, my - r * 0.06); ctx.quadraticCurveTo(cx - dw - r * 0.03, my, cx - dw, my + r * 0.06)
    ctx.moveTo(cx + dw, my - r * 0.06); ctx.quadraticCurveTo(cx + dw + r * 0.03, my, cx + dw, my + r * 0.06)
    ctx.stroke(); ctx.restore()
  }

  // BEAUTY MARK — a single small dot (rare garnish), upper cheek.
  if (p.beautyMark) dot(ctx, cx + r * 0.34, my - r * 0.18, r * 0.028, "#5a3b24")

  // AGE crinkles — elders get gentle smile-lines + soft eye creases (never harsh).
  if (age === "elder") {
    ctx.save(); ctx.globalAlpha = 0.22
    ctx.strokeStyle = "rgba(90,60,40,0.7)"; ctx.lineWidth = r * 0.025; ctx.lineCap = "round"
    // nasolabial smile lines
    ctx.beginPath()
    ctx.moveTo(cx - r * 0.22, ny + r * 0.02); ctx.quadraticCurveTo(cx - r * 0.3, my - r * 0.04, cx - r * 0.2, my + r * 0.04)
    ctx.moveTo(cx + r * 0.22, ny + r * 0.02); ctx.quadraticCurveTo(cx + r * 0.3, my - r * 0.04, cx + r * 0.2, my + r * 0.04)
    // outer eye crinkles (crow's feet) — the warmth of a long-smiling face
    ctx.moveTo(cx - ex - r * 0.2, ey); ctx.lineTo(cx - ex - r * 0.32, ey - r * 0.04)
    ctx.moveTo(cx + ex + r * 0.2, ey); ctx.lineTo(cx + ex + r * 0.32, ey - r * 0.04)
    ctx.stroke(); ctx.restore()
  }

  // facial hair
  if (f.beard && f.beard !== "none") {
    ctx.fillStyle = "rgba(40,28,18,0.85)"
    if (f.beard === "mustache") {
      roundedPath(ctx, cx - r * 0.28, my - r * 0.18, r * 0.56, r * 0.12, r * 0.06); ctx.fill()
    } else if (f.beard === "stubble") {
      ctx.save(); ctx.globalAlpha = 0.3
      roundedPath(ctx, cx - r * 0.5, cy + r * 0.1, r, r * 0.6, r * 0.3); ctx.fill(); ctx.restore()
    } else {
      roundedPath(ctx, cx - r * 0.5, cy + r * 0.05, r, r * 0.7, r * 0.35); ctx.fill()
    }
  }
}

/* ----------------------------------------------------------- garment shapes */

/** Build-dependent torso width factor. */
function buildWidth(spec: CharacterSpec): number {
  switch (spec.build) {
    case "slim": return 0.86
    case "stocky": return 1.18
    case "tall": return 0.92
    case "child": return 0.78
    default: return 1
  }
}
function buildHeight(spec: CharacterSpec): number {
  return spec.build === "child" ? 0.82 : spec.build === "tall" ? 1.08 : 1
}

function drawHat(
  ctx: CanvasRenderingContext2D, cx: number, hy: number, hr: number, hat: ClothingLayer,
) {
  const c = hat.color
  const band = hat.accent ?? "rgba(0,0,0,0.2)"
  switch (hat.item) {
    case "straw":
      paper(ctx, cx - hr * 1.6, hy - hr * 0.7, hr * 3.2, hr * 0.45, hr * 0.22, c, { deckle: 4 })
      paper(ctx, cx - hr * 0.85, hy - hr * 1.7, hr * 1.7, hr * 1.05, hr * 0.5, c, { deckle: 4 })
      break
    case "tricorn":
      paper(ctx, cx - hr * 1.5, hy - hr * 1.0, hr * 3, hr * 0.5, hr * 0.25, c, { deckle: 4 })
      paper(ctx, cx - hr * 0.95, hy - hr * 1.9, hr * 1.9, hr * 1.2, hr * 0.5, c, { deckle: 4 })
      // turned-up corners
      ctx.fillStyle = c
      ctx.beginPath(); ctx.moveTo(cx - hr * 1.4, hy - hr * 0.85); ctx.lineTo(cx - hr * 0.7, hy - hr * 1.6); ctx.lineTo(cx - hr * 0.5, hy - hr * 0.85); ctx.fill()
      break
    case "kerchief":
    case "coif":
      paper(ctx, cx - hr * 1.1, hy - hr * 1.25, hr * 2.2, hr * 1.1, hr * 0.7, c, { deckle: 4 })
      break
    default:
      paper(ctx, cx - hr * 1.2, hy - hr * 0.85, hr * 2.4, hr * 0.45, hr * 0.2, c, { deckle: 4 })
      paper(ctx, cx - hr * 0.9, hy - hr * 1.7, hr * 1.8, hr * 1.0, hr * 0.4, c, { deckle: 4 })
  }
  // band
  ctx.fillStyle = band
  roundedPath(ctx, cx - hr * 0.9, hy - hr * 1.0, hr * 1.8, hr * 0.2, hr * 0.08)
  ctx.fill()
}

function drawProp(ctx: CanvasRenderingContext2D, w: number, h: number, spec: CharacterSpec) {
  const cx = w / 2
  switch (spec.prop) {
    case "bread":
      paper(ctx, cx + w * 0.2, h * 0.58, w * 0.18, w * 0.1, w * 0.05, "#d9a25a", { deckle: 3 })
      break
    case "needle":
      ctx.strokeStyle = "#d8d8d8"; ctx.lineWidth = w * 0.012
      ctx.beginPath(); ctx.moveTo(cx - w * 0.34, h * 0.5); ctx.lineTo(cx - w * 0.42, h * 0.66); ctx.stroke()
      dot(ctx, cx - w * 0.34, h * 0.5, w * 0.02, "#c0392b")
      break
    case "satchel":
      paper(ctx, cx + w * 0.18, h * 0.56, w * 0.18, h * 0.16, w * 0.04, "#9c6b3f", { deckle: 3 })
      ctx.strokeStyle = "rgba(60,40,20,0.5)"; ctx.lineWidth = w * 0.02
      ctx.beginPath(); ctx.moveTo(cx + w * 0.18, h * 0.56); ctx.quadraticCurveTo(cx + w * 0.1, h * 0.44, cx + w * 0.06, h * 0.5); ctx.stroke()
      break
    case "basket":
      paper(ctx, cx + w * 0.16, h * 0.56, w * 0.22, h * 0.14, w * 0.05, "#b07a44", { deckle: 3 })
      dot(ctx, cx + w * 0.22, h * 0.55, w * 0.04, "#d24b3a")
      dot(ctx, cx + w * 0.3, h * 0.55, w * 0.04, "#7fae4a")
      break
    case "scroll":
      paper(ctx, cx + w * 0.22, h * 0.5, w * 0.07, h * 0.2, w * 0.03, "#efe3c4", { deckle: 2 })
      break
    case "lantern":
      paper(ctx, cx + w * 0.24, h * 0.5, w * 0.12, h * 0.16, w * 0.04, "#d9b24a", { deckle: 2 })
      dot(ctx, cx + w * 0.3, h * 0.58, w * 0.04, "#fff2b0")
      break
    case "broom":
      ctx.strokeStyle = "#8a6a44"; ctx.lineWidth = w * 0.025
      ctx.beginPath(); ctx.moveTo(cx + w * 0.32, h * 0.4); ctx.lineTo(cx + w * 0.26, h * 0.82); ctx.stroke()
      paper(ctx, cx + w * 0.18, h * 0.78, w * 0.18, h * 0.1, w * 0.02, "#c9a25a", { deckle: 2 })
      break
    case "fan":
      ctx.fillStyle = "#e8d8b8"
      ctx.beginPath(); ctx.moveTo(cx + w * 0.3, h * 0.6); ctx.arc(cx + w * 0.3, h * 0.6, w * 0.14, -Math.PI * 0.8, -Math.PI * 0.2); ctx.closePath(); ctx.fill()
      break
    case "book":
      paper(ctx, cx + w * 0.2, h * 0.54, w * 0.16, h * 0.12, w * 0.02, "#7a3b48", { deckle: 2 })
      break
  }
}

/* ----------------------------------------------------------- main renderer */

function drawCharacter(
  ctx: CanvasRenderingContext2D, w: number, h: number, spec: CharacterSpec, pose: Pose,
) {
  const cx = w / 2
  const bw = buildWidth(spec)
  const bh = buildHeight(spec)
  const skin = spec.skinTone

  // ---- legs (subtle stride) ----
  const stride = (pose.stride ?? 0) * w * 0.03
  const legW = w * 0.12 * bw
  const legY = h * 0.78
  const legH = h * 0.18 * bh
  const botColor = spec.clothing.bottom?.color ?? "#5a4636"
  paper(ctx, cx - w * 0.16 * bw - stride, legY, legW, legH, legW * 0.45, botColor, { deckle: 4 })
  paper(ctx, cx + w * 0.04 * bw + stride, legY, legW, legH, legW * 0.45, botColor, { deckle: 4 })

  // ---- torso (top) ----
  const topL = spec.clothing.top
  const bodyTop = topL?.color ?? "#cbb083"
  const bodyBot = topL?.accent ?? bodyTop
  const grad = ctx.createLinearGradient(0, h * 0.44, 0, h * 0.82)
  grad.addColorStop(0, bodyTop)
  grad.addColorStop(1, bodyBot)
  paper(ctx, cx - w * 0.26 * bw, h * 0.44, w * 0.52 * bw, h * 0.4 * bh, w * 0.16, grad, {
    pattern: topL?.pattern, patternColor: topL?.accent,
  })

  // ---- outer (coat/shawl/vest over torso) ----
  if (spec.clothing.outer) {
    const o = spec.clothing.outer
    ctx.save()
    ctx.globalAlpha = o.item === "shawl" || o.item === "rebozo" ? 0.92 : 1
    if (o.item === "vest") {
      paper(ctx, cx - w * 0.2 * bw, h * 0.46, w * 0.16 * bw, h * 0.34 * bh, w * 0.04, o.color, { deckle: 3 })
      paper(ctx, cx + w * 0.04 * bw, h * 0.46, w * 0.16 * bw, h * 0.34 * bh, w * 0.04, o.color, { deckle: 3 })
    } else {
      // coat/shawl drapes the shoulders
      paper(ctx, cx - w * 0.3 * bw, h * 0.42, w * 0.6 * bw, h * 0.22 * bh, w * 0.1, o.color, { deckle: 4 })
    }
    ctx.restore()
  }

  // ---- apron over the torso ----
  if (spec.apron) {
    ctx.save()
    roundedPath(ctx, cx - w * 0.18 * bw, h * 0.52, w * 0.36 * bw, h * 0.3 * bh, w * 0.06)
    ctx.fillStyle = spec.apron.color; ctx.globalAlpha = 0.92; ctx.fill()
    ctx.restore()
    ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = w * 0.012
    ctx.beginPath()
    ctx.moveTo(cx - w * 0.1, h * 0.52); ctx.lineTo(cx, h * 0.6); ctx.lineTo(cx + w * 0.1, h * 0.52); ctx.stroke()
  }

  // ---- arms (raise with pose) ----
  const armC = topL?.color ?? bodyTop
  const lLift = (pose.leftArm ?? 0) * h * 0.22
  const rLift = (pose.rightArm ?? 0) * h * 0.22
  paper(ctx, cx - w * 0.34 * bw, h * 0.46 - lLift, w * 0.12 * bw, h * 0.26 * bh, w * 0.06, armC, { deckle: 4 })
  paper(ctx, cx + w * 0.22 * bw, h * 0.46 - rLift, w * 0.12 * bw, h * 0.26 * bh, w * 0.06, armC, { deckle: 4 })
  // hands
  dot(ctx, cx - w * 0.28 * bw, h * 0.72 - lLift, w * 0.05, skin)
  dot(ctx, cx + w * 0.28 * bw, h * 0.72 - rLift, w * 0.05, skin)

  // ---- accessory (scarf/sash) under head ----
  if (spec.clothing.accessory) {
    const a = spec.clothing.accessory
    if (a.item === "scarf" || a.item === "sash") {
      ctx.fillStyle = a.color
      roundedPath(ctx, cx - w * 0.18, h * 0.43, w * 0.36, h * 0.06, w * 0.03); ctx.fill()
    } else if (a.item === "necklace") {
      ctx.strokeStyle = a.color; ctx.lineWidth = w * 0.02
      ctx.beginPath(); ctx.arc(cx, h * 0.46, w * 0.1, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke()
    }
  }

  // ---- head ----
  // child face-shape skew: children read with a slightly bigger, rounder head.
  const childAge = spec.face.ageBand === "child" || spec.build === "child"
  const hr = w * 0.2 * (childAge ? 1.08 : 1)
  const tilt = pose.headTilt ?? 0
  const hy = h * 0.3
  // faceShape → head silhouette (width/height/corner-roundness), clamped cute.
  let hwf = 1, hhf = 1, hcf = 1 // width / height / corner factors
  switch (spec.face.faceShape) {
    case "oval": hwf = 0.92; hhf = 1.08; hcf = 0.95; break
    case "soft-square": hwf = 1.04; hhf = 0.98; hcf = 0.6; break
    case "heart": hwf = 1.02; hhf = 1.02; hcf = 0.85; break // wider brow, soft chin
    case "long": hwf = 0.9; hhf = 1.12; hcf = 0.9; break
    default: hwf = 1; hhf = 1; hcf = 1 // "round"
  }
  if (childAge) { hwf *= 1.04; hhf *= 0.98; hcf = Math.min(1, hcf * 1.1) }
  const hpw = hr * hwf // head paper half-width
  const hph = hr * hhf // head paper half-height
  ctx.save()
  ctx.translate(cx, hy)
  ctx.rotate(tilt)
  ctx.translate(-cx, -hy)
  // hair behind
  if (spec.hair.style !== "bald" && spec.hair.style !== "none") {
    const hairBack =
      spec.hair.style === "long" || spec.hair.style === "braid" ? hph * 1.95 : hph * 1.7
    paper(ctx, cx - hpw * 1.15, hy - hph * 1.1, hpw * 2.3, hairBack, hr * 0.9, spec.hair.color, { deckle: 4 })
  }
  paper(ctx, cx - hpw, hy - hph, hpw * 2, hph * 2, hr * hcf, skin, { deckle: 5 })
  // heart-shape: a slightly narrowed soft chin (paper notch in skin tone is hard;
  // instead the chin reads via the narrower lower face from hcf + features).
  drawFace(ctx, cx, hy, hr, spec, pose)
  // hair front fringe
  if (spec.hair.style === "curly" || spec.hair.style === "short") {
    ctx.fillStyle = spec.hair.color
    roundedPath(ctx, cx - hr * 0.95, hy - hr * 1.05, hr * 1.9, hr * 0.5, hr * 0.25); ctx.fill()
  }
  if (spec.hair.style === "bun") {
    paper(ctx, cx - hr * 0.35, hy - hr * 1.5, hr * 0.7, hr * 0.7, hr * 0.35, spec.hair.color, { deckle: 3 })
  }
  // hat on top
  if (spec.clothing.hat) drawHat(ctx, cx, hy, hr, spec.clothing.hat)
  ctx.restore()

  // ---- held prop ----
  drawProp(ctx, w, h, spec)
}

/* ----------------------------------------------------------------- public */

export const CHAR_TEX = { w: 256, h: 384 } as const

/** A draw fn that paints the spec at a given pose (default rest). */
export function characterDraw(spec: CharacterSpec, pose: Pose = {}): DrawFn {
  return (ctx, w, h) => drawCharacter(ctx, w, h, spec, pose)
}
