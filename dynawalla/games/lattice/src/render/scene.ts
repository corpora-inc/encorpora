// The shell's drawing. Canvas 2D, one pass, no allocation in the hot loop
// beyond what the browser does for a path.
//
// The arena's coordinate space *is* CSS pixel space — `mount.ts` resizes the
// arena to the element — so there is no camera and no transform to get wrong.
// The device pixel ratio is applied once, to the context, at resize.
//
// What is drawn, back to front: the sheet, the resonator, the bodies, the
// shots, the ship, the sparks, and then the chrome — the factor tile bar, which
// is the whole passive layer made legible and is never allowed to be covered by
// anything.
//
// The world uses the whole canvas. The chrome uses `hudLayout`, which keeps it
// inside the safe area and clear of the host's two corner controls — see
// `hud.ts` for why those are different rectangles.

import { safeRect } from "../../../../packs/shared/game-chrome/index.ts"
import type { Arena, Body, Resonator } from "../game/arena.ts"
import { HUSK_R, MOTE_R, RESONATOR_R, SHIP_R, SHOT_R } from "../game/arena.ts"
import { heldLeaves, type HintState, revealPaceMs } from "../game/hint.ts"
import type { PlacedNode } from "../game/tree.ts"
import type { Grid } from "../sim/grid.ts"
import { hudLayout, type HudLayout } from "./hud.ts"
import { Sparks } from "./particles.ts"
import {
  BRASS,
  BRASS_DIM,
  BRASS_LIGHT,
  CELESTIAL,
  CELESTIAL_DIM,
  CELESTIAL_INK,
  INK,
  INK_DIM,
  LAPIS,
  LAPIS_LIGHT,
  OXIDE,
  STONE,
  STONE_EDGE,
  STONE_INK,
  STRUT,
  STRUT_HOT,
  STRUT_TORN,
  VOID,
  VOID_HI,
  chromeFont,
  numeralFont,
} from "./palette.ts"

export type Banner = { text: string; tint: string; age: number }

const BANNER_MS = 1400

/** How long one node of the hint tree takes to fade and swell into place. */
const NODE_GROW_MS = 200

/** The scrim the tree is read against, so a numeral never fights a strut. */
const TREE_SCRIM = "rgba(5,8,16,0.72)"

export class Scene {
  private ctx: CanvasRenderingContext2D
  private dpr = 1
  cssWidth = 0
  cssHeight = 0
  readonly sparks: Sparks
  banner: Banner | null = null
  /** Screen shake, in pixels. Zero forever under reduced motion. */
  private shake = 0
  /**
   * Where the tile bar was last drawn. Tapping your own hold is how you let it
   * go, so the shell needs the rectangle and the bar is the only thing that
   * knows where it ended up.
   */
  private barRect = { x: 0, y: 0, w: 0, h: 0 }
  /**
   * Where the chrome may be drawn: inside the safe area and below the host's
   * two corner controls. Recomputed on every resize, because a rotation swaps
   * the insets over and Split View changes them without one.
   */
  private hud: HudLayout

  /**
   * The hint's own clock and memory.
   *
   * A stage is a *derived* value in the arena — there is no timer over there —
   * so the animation state lives here: when each node started to appear, when
   * each numeral did, and which leaves the child is already carrying. All of it
   * is thrown away when the resonator changes, keyed on the question id.
   */
  private clock = 0
  private treeKey = ""
  private nodeAt = new Map<number, number>()
  private numeralAt = new Map<number, number>()
  private filled = new Set<number>()
  /** Where the hint control was last drawn. It is a touch target. */
  private hintRect = { x: 0, y: 0, w: 0, h: 0 }

  private readonly canvas: HTMLCanvasElement
  private reduced: boolean

  constructor(canvas: HTMLCanvasElement, reduced: boolean) {
    this.canvas = canvas
    this.reduced = reduced
    const ctx = canvas.getContext("2d", { alpha: false })
    if (!ctx) throw new Error("lattice: no 2d context")
    this.ctx = ctx
    this.sparks = new Sparks(reduced)
    this.hud = hudLayout(320, { x: 0, y: 0, w: 320, h: 320 })
    this.resize()
  }

  setReduced(reduced: boolean): void {
    this.reduced = reduced
    this.sparks.setReduced(reduced)
    if (reduced) this.shake = 0
  }

  resize(): { width: number; height: number } {
    const rect = this.canvas.getBoundingClientRect()
    this.cssWidth = Math.max(320, Math.round(rect.width || 800))
    this.cssHeight = Math.max(320, Math.round(rect.height || 600))
    this.dpr = Math.min(2.5, globalThis.devicePixelRatio || 1)
    this.canvas.width = Math.round(this.cssWidth * this.dpr)
    this.canvas.height = Math.round(this.cssHeight * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    // The world gets the whole canvas; the chrome gets the safe rectangle.
    this.hud = hudLayout(this.cssWidth, safeRect(this.cssWidth, this.cssHeight))
    return { width: this.cssWidth, height: this.cssHeight }
  }

  /** A knock felt through the frame. Under reduced motion it is not felt. */
  knock(amount: number): void {
    if (this.reduced) return
    this.shake = Math.min(14, this.shake + amount)
  }

  say(text: string, tint: string): void {
    this.banner = { text, tint, age: 0 }
  }

  advance(dtMs: number): void {
    this.clock += dtMs
    this.sparks.step(dtMs)
    this.shake *= Math.exp(-0.009 * dtMs)
    if (this.shake < 0.15) this.shake = 0
    if (this.banner) {
      this.banner.age += dtMs
      if (this.banner.age > BANNER_MS) this.banner = null
    }
  }

  draw(
    arena: Arena,
    grid: Grid,
    state: {
      best: number
      paused: boolean
      stalled: boolean
      /**
       * The hint as the arena has it this frame, or `null` for none.
       *
       * REQUIRED, and the argument is `hud.ts`'s: made optional, a caller that
       * forgets it still compiles and quietly ships a game whose hint system is
       * never drawn, and the only way anybody finds out is by getting stuck.
       */
      hint: HintState | null
    },
  ): void {
    const ctx = this.ctx
    const w = this.cssWidth
    const h = this.cssHeight

    ctx.save()
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake)
    }

    // The void, with a cold wash where the resonator is listening.
    ctx.fillStyle = VOID
    ctx.fillRect(-20, -20, w + 40, h + 40)
    if (arena.resonator) {
      const g = ctx.createRadialGradient(
        arena.resonator.x,
        arena.resonator.y,
        0,
        arena.resonator.x,
        arena.resonator.y,
        Math.max(w, h) * 0.55,
      )
      g.addColorStop(0, VOID_HI)
      g.addColorStop(1, VOID)
      ctx.fillStyle = g
      ctx.fillRect(-20, -20, w + 40, h + 40)
    }

    this.drawGrid(grid)
    if (arena.resonator) this.drawResonator(arena.resonator, arena.ship)
    for (const body of arena.bodies) this.drawBody(body)

    ctx.fillStyle = BRASS_LIGHT
    for (const shot of arena.shots) {
      ctx.beginPath()
      ctx.arc(shot.x, shot.y, SHOT_R, 0, Math.PI * 2)
      ctx.fill()
    }

    this.drawShip(arena)
    this.sparks.draw(ctx)
    ctx.restore()

    this.drawHint(arena, state.hint)
    this.drawTileBar(arena)
    this.drawStatus(arena, state)
    if (state.paused) this.drawSheet()
  }

  // ── the sheet ────────────────────────────────────────────────────────────

  private drawGrid(grid: Grid): void {
    const ctx = this.ctx
    ctx.lineWidth = 1
    // Two passes so the torn struts sit on top of the intact ones and read as
    // a seam rather than as noise mixed through the weave.
    ctx.strokeStyle = STRUT
    ctx.beginPath()
    for (let s = 0; s < grid.struts; s++) {
      if ((grid.strutTorn[s] as number) > 0) continue
      const a = grid.strutA[s] as number
      const b = grid.strutB[s] as number
      const ax = grid.x[a] as number
      const ay = grid.y[a] as number
      const bx = grid.x[b] as number
      const by = grid.y[b] as number
      const stretch = Math.abs(
        (Math.hypot(bx - ax, by - ay) - (grid.strutRest[s] as number)) /
          (grid.strutRest[s] as number),
      )
      if (stretch > 0.12) continue
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
    }
    ctx.stroke()

    // Struts under load light up: this is where the sheet is carrying the news.
    ctx.strokeStyle = STRUT_HOT
    ctx.beginPath()
    for (let s = 0; s < grid.struts; s++) {
      if ((grid.strutTorn[s] as number) > 0) continue
      const a = grid.strutA[s] as number
      const b = grid.strutB[s] as number
      const ax = grid.x[a] as number
      const ay = grid.y[a] as number
      const bx = grid.x[b] as number
      const by = grid.y[b] as number
      const stretch = Math.abs(
        (Math.hypot(bx - ax, by - ay) - (grid.strutRest[s] as number)) /
          (grid.strutRest[s] as number),
      )
      if (stretch <= 0.12) continue
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
    }
    ctx.stroke()

    // The tear. Two stubs with nothing between them — the sheet is open here.
    ctx.strokeStyle = STRUT_TORN
    ctx.lineWidth = 1.6
    ctx.beginPath()
    for (let s = 0; s < grid.struts; s++) {
      const torn = grid.strutTorn[s] as number
      if (torn <= 0) continue
      const a = grid.strutA[s] as number
      const b = grid.strutB[s] as number
      const ax = grid.x[a] as number
      const ay = grid.y[a] as number
      const bx = grid.x[b] as number
      const by = grid.y[b] as number
      ctx.moveTo(ax, ay)
      ctx.lineTo(ax + (bx - ax) * 0.3, ay + (by - ay) * 0.3)
      ctx.moveTo(bx, by)
      ctx.lineTo(bx + (ax - bx) * 0.3, by + (ay - by) * 0.3)
    }
    ctx.stroke()
    ctx.lineWidth = 1
  }

  // ── the bodies ───────────────────────────────────────────────────────────

  private drawBody(body: Body): void {
    const ctx = this.ctx
    const pop = Math.min(1, body.age / 160)
    const r = (body.prime ? MOTE_R : HUSK_R) * (0.6 + 0.4 * pop)

    if (body.prime) {
      // A prime is the only thing in the arena that is its own light source.
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2
        const x = body.x + Math.cos(a) * r
        const y = body.y + Math.sin(a) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fillStyle = CELESTIAL
      ctx.fill()
      ctx.strokeStyle = CELESTIAL_DIM
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = CELESTIAL_INK
      ctx.font = numeralFont(r * 1.05)
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(String(body.value), body.x, body.y + 1)
      return
    }

    // A composite is carved stone: inert, and waiting to be opened.
    ctx.save()
    ctx.translate(body.x, body.y)
    ctx.beginPath()
    const k = r * 0.82
    ctx.rect(-k, -k, k * 2, k * 2)
    ctx.fillStyle = STONE
    ctx.fill()
    ctx.strokeStyle = STONE_EDGE
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = STONE_INK
    const digits = String(body.value).length
    ctx.font = numeralFont((k * 1.5) / Math.max(1, digits * 0.62))
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(body.value), 0, 1)
    ctx.restore()
  }

  private drawShip(arena: Arena): void {
    const ctx = this.ctx
    // The hull, not the guns. `facing` eases toward `aiming` over about 55ms, so
    // a thumb sliding round the right stick turns the ship rather than flicking
    // it — a large part of what read as "moves around too wildly". The shots
    // still leave along `aiming`, because a shooter whose bullets lag its stick
    // lies about where it is pointed.
    const aim = arena.facing
    const a = Math.atan2(aim.y, aim.x)
    ctx.save()
    ctx.translate(arena.ship.x, arena.ship.y)
    ctx.rotate(a)
    ctx.beginPath()
    ctx.moveTo(SHIP_R * 1.35, 0)
    ctx.lineTo(-SHIP_R * 0.85, SHIP_R * 0.85)
    ctx.lineTo(-SHIP_R * 0.35, 0)
    ctx.lineTo(-SHIP_R * 0.85, -SHIP_R * 0.85)
    ctx.closePath()
    ctx.fillStyle = BRASS
    ctx.fill()
    ctx.strokeStyle = BRASS_LIGHT
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }

  private drawResonator(res: Resonator, ship: { x: number; y: number }): void {
    const ctx = this.ctx
    const listening = res.cooldown <= 0
    const pulse = this.reduced ? 0 : Math.sin(res.age / 420) * 2.6
    const r = RESONATOR_R + pulse

    ctx.save()
    ctx.translate(res.x, res.y)

    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = listening ? LAPIS : "#241f1a"
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = listening ? BRASS : OXIDE
    ctx.stroke()

    // A second ring that closes as the *ship* nears, not as the hold nears.
    //
    // This started out as a proximity ring on the value — it filled as the
    // hold's product approached the target and went gold when it matched. That
    // is the comparison the child is here to make. A ring that makes it for
    // them turns "work out 47 + 25, then work out which primes reach 72" into
    // "sweep until the light goes gold", and the whole reasoning layer is gone
    // with nothing failing anywhere. So the only instrument for comparing is
    // the child's own tile bar against the answer they worked out, and this
    // ring says nothing about arithmetic at all.
    if (listening) {
      const near = Math.max(0, Math.min(1, 1 - Math.hypot(ship.x - res.x, ship.y - res.y) / 380))
      if (near > 0.01) {
        ctx.beginPath()
        ctx.arc(0, 0, r + 9, -Math.PI / 2, -Math.PI / 2 + near * Math.PI * 2)
        ctx.strokeStyle = LAPIS_LIGHT
        ctx.lineWidth = 3
        ctx.stroke()
      }
    }

    ctx.fillStyle = listening ? INK : INK_DIM
    ctx.font = numeralFont(Math.min(26, (r * 1.7) / Math.max(3, res.prompt.length * 0.5)))
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(res.prompt, 0, 0)
    ctx.restore()
  }

  // ── the chrome ───────────────────────────────────────────────────────────

  /**
   * THE HINT — the factor tree, and the control that unfolds it.
   *
   * Drawn in the same materials as the field, which is the whole idea: a lit
   * leaf is the same celestial hexagon as the mote drifting out there, and an
   * unopened node is the same carved stone as the husk holding it. A child does
   * not have to be told the tree is a map of the arena; it is drawn out of the
   * arena's own pieces.
   *
   * A leaf whose prime is already in the hold gets a brass collar, and the frame
   * it earns one it throws a spark. That is the maths moment — `2·2·2·2·7`
   * assembling itself one piece at a time — and it is the only thing in the
   * game that celebrates a factorisation rather than a resonator.
   */
  private drawHint(arena: Arena, hint: HintState | null): void {
    const res = arena.resonator
    if (!res) {
      this.hintRect = { x: 0, y: 0, w: 0, h: 0 }
      return
    }
    this.drawHintControl(hint)
    if (!hint) {
      // A new question wipes the animation state, so the next tree grows rather
      // than snapping in half-finished with the last one's timings.
      if (this.treeKey !== "") this.forgetTree("")
      return
    }
    if (this.treeKey !== res.questionId) this.forgetTree(res.questionId)

    const { placed, shown } = hint
    const box = this.hud.tree
    const cols = placed.columns
    const rows = placed.rows
    const r = Math.max(
      9,
      Math.min(22, Math.min(box.w / Math.max(1, cols * 2.4), box.h / Math.max(1, rows * 2.6))),
    )
    // Both clamped at zero, and this is **unreachable defence** rather than a
    // live guard — said plainly, because an unfalsifiable comment is worse than
    // no comment.
    //
    // `r` floors at 9, so a box under 18px tall makes the row numerator negative
    // and `top + depth * rowStep` draws the root at the bottom with the leaves
    // climbing above it, upside down. Two things stop that arriving here:
    // `resize` above floors the canvas at 320×320 whatever the element measures,
    // and `hud.ts` floors the box inside that. Reaching this clamp needs a
    // `hudLayout` called with a safe area under about 130px tall, which only a
    // test does. It stays because it costs two `Math.max` calls and the thing it
    // prevents is silent and total.
    const colStep = cols > 1 ? Math.max(0, Math.min(box.w / cols, r * 3.2)) : 0
    const rowStep = rows > 1 ? Math.max(0, Math.min((box.h - r * 2) / (rows - 1), r * 3)) : 0
    const usedW = colStep * (cols - 1) + r * 2
    const usedH = rowStep * (rows - 1) + r * 2
    const cx = box.x + box.w / 2
    // Bottom-anchored: the leaves hang closest to the tile bar they are about
    // to fill, and a shallow tree does not float in the middle of the arena.
    const top = box.y + box.h - usedH + r
    const at = (node: PlacedNode): { x: number; y: number } => ({
      x: cx + (node.u - (cols - 1) / 2) * colStep,
      y: top + node.depth * rowStep,
    })

    const pace = this.reduced ? 0 : revealPaceMs(arena.chain)
    this.schedule(hint, pace)

    const ctx = this.ctx
    const pad = 12
    ctx.save()
    ctx.fillStyle = TREE_SCRIM
    roundRect(ctx, cx - usedW / 2 - pad, top - r - pad, usedW + pad * 2, usedH + pad * 2, 10)
    ctx.fill()
    ctx.strokeStyle = BRASS_DIM
    ctx.lineWidth = 1
    roundRect(ctx, cx - usedW / 2 - pad, top - r - pad, usedW + pad * 2, usedH + pad * 2, 10)
    ctx.stroke()

    // The branches first, so every node sits on top of its own lines.
    ctx.strokeStyle = BRASS_DIM
    ctx.lineWidth = 1.6
    ctx.beginPath()
    for (let i = 0; i < placed.nodes.length; i++) {
      const node = placed.nodes[i] as PlacedNode
      if (node.parent < 0) continue
      if (this.growth(i) <= 0) continue
      const a = at(placed.nodes[node.parent] as PlacedNode)
      const b = at(node)
      ctx.moveTo(a.x, a.y + r * 0.7)
      ctx.lineTo(b.x, b.y - r * 0.7)
    }
    ctx.stroke()

    const holding = heldLeaves(placed, shown, arena.bank.tiles)
    for (let i = 0; i < placed.nodes.length; i++) {
      const node = placed.nodes[i] as PlacedNode
      const grow = this.growth(i)
      if (grow <= 0) continue
      const p = at(node)
      this.drawTreeNode(node, p.x, p.y, r * grow, shown.has(i) && this.numeralIn(i), holding.has(i))
    }
    ctx.restore()

    // The click. A leaf that has just been satisfied throws a spark, and the
    // last one throws a bigger one — the factorisation is complete in the hold.
    for (const index of holding) {
      if (this.filled.has(index)) continue
      const p = at(placed.nodes[index] as PlacedNode)
      const last = holding.size === placed.leaves.length
      this.sparks.burst(p.x, p.y, last ? 14 : 5, last ? 260 : 150, BRASS_LIGHT, last ? 2.4 : 1.5)
    }
    this.filled = holding
  }

  /** The branch glyph that asks for one more piece. No word, in any language. */
  private drawHintControl(hint: HintState | null): void {
    const ctx = this.ctx
    const { cx, cy, r } = this.hud.hint
    // A 44px minimum target, per the touch-target rule, whatever `r` came out as.
    const half = Math.max(22, r)
    this.hintRect = { x: cx - half, y: cy - half, w: half * 2, h: half * 2 }

    const more = hint === null || hint.stage < hint.stages
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(5,8,16,0.72)"
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = more ? BRASS : BRASS_DIM
    ctx.stroke()

    // A three-node factor tree, drawn small: one above, two below.
    const s = r * 0.46
    ctx.strokeStyle = more ? BRASS_LIGHT : BRASS_DIM
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(cx, cy - s * 0.35)
    ctx.lineTo(cx - s, cy + s * 0.7)
    ctx.moveTo(cx, cy - s * 0.35)
    ctx.lineTo(cx + s, cy + s * 0.7)
    ctx.stroke()
    ctx.fillStyle = more ? BRASS_LIGHT : BRASS_DIM
    for (const [dx, dy] of [
      [0, -s * 0.7],
      [-s, s * 0.9],
      [s, s * 0.9],
    ] as Array<[number, number]>) {
      ctx.beginPath()
      ctx.arc(cx + dx, cy + dy, r * 0.15, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawTreeNode(
    node: PlacedNode,
    x: number,
    y: number,
    r: number,
    numeral: boolean,
    held: boolean,
  ): void {
    const ctx = this.ctx
    if (!numeral) {
      // Blank. A ring and a question mark, in the same brass the arena's own
      // frame is made of — never a warning colour, never a gap.
      ctx.beginPath()
      ctx.arc(x, y, r * 0.86, 0, Math.PI * 2)
      ctx.fillStyle = "rgba(20,26,40,0.9)"
      ctx.fill()
      ctx.strokeStyle = BRASS_DIM
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.fillStyle = INK_DIM
      ctx.font = numeralFont(r * 0.95)
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("?", x, y + 1)
      return
    }

    if (node.prime) {
      // The same hexagon as a mote, because it *is* a mote — one drifting out
      // there with this number on it, and the child's job is to go and get it.
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2
        const px = x + Math.cos(a) * r
        const py = y + Math.sin(a) * r
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = CELESTIAL
      ctx.fill()
      ctx.strokeStyle = held ? BRASS_LIGHT : CELESTIAL_DIM
      ctx.lineWidth = held ? 3 : 2
      ctx.stroke()
      ctx.fillStyle = CELESTIAL_INK
      ctx.font = numeralFont(r * 1)
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(String(node.value), x, y + 1)
      return
    }

    // The same carved stone as a husk, for the same reason.
    const k = r * 0.82
    ctx.beginPath()
    ctx.rect(x - k, y - k, k * 2, k * 2)
    ctx.fillStyle = STONE
    ctx.fill()
    ctx.strokeStyle = STONE_EDGE
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = STONE_INK
    const digits = String(node.value).length
    ctx.font = numeralFont((k * 1.5) / Math.max(1, digits * 0.62))
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(String(node.value), x, y + 1)
  }

  /** Wipe the tree's animation memory. A new question grows from nothing. */
  private forgetTree(key: string): void {
    this.treeKey = key
    this.nodeAt.clear()
    this.numeralAt.clear()
    this.filled = new Set<number>()
  }

  /**
   * Give every node and every newly lit numeral a moment to arrive at.
   *
   * The stagger is `pace`, which comes from the chain: long and calm for a child
   * who is finding it hard, near-instant for one on a run. Nothing here decides
   * *what* is revealed — the arena did that — only the order it lands in.
   */
  private schedule(hint: HintState, pace: number): void {
    const { placed, shown } = hint
    if (this.nodeAt.size === 0) {
      // The silhouette, growing downward from the root.
      for (let i = 0; i < placed.nodes.length; i++) {
        this.nodeAt.set(i, this.clock + (placed.nodes[i] as PlacedNode).depth * pace)
      }
    }
    let k = 0
    for (const index of shown) {
      if (this.numeralAt.has(index)) continue
      this.numeralAt.set(index, this.clock + k * pace)
      k += 1
    }
  }

  /** 0 before a node has begun to appear, 1 once it is fully there. */
  private growth(index: number): number {
    const at = this.nodeAt.get(index)
    if (at === undefined) return 0
    if (this.clock < at) return 0
    return Math.min(1, Math.max(0.2, (this.clock - at) / NODE_GROW_MS))
  }

  private numeralIn(index: number): boolean {
    const at = this.numeralAt.get(index)
    return at !== undefined && this.clock >= at
  }

  /** Did a press land on the hint control? That gesture asks for one more piece. */
  hitsHint(x: number, y: number): boolean {
    const r = this.hintRect
    return r.w > 0 && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
  }

  /**
   * The factor tile bar. This is the passive layer and it is the reason the
   * game teaches anything at all when nobody is trying: `2·2·3` sitting under a
   * running 12, changing the instant a mote is swept.
   */
  private drawTileBar(arena: Arena): void {
    const ctx = this.ctx
    const tiles = arena.bank.tiles
    const { size, gap, dotW, y, cx } = this.hud.bar

    const total = tiles.length * size + Math.max(0, tiles.length - 1) * dotW
    const valueText = tiles.length === 0 ? "" : `= ${arena.bank.value}`
    ctx.font = chromeFont(size * 0.8, 600)
    const valueW = valueText === "" ? 0 : ctx.measureText(valueText).width + gap * 2
    const left = cx - (total + valueW) / 2
    let x = left
    // A 44px minimum hit zone around the bar, per the touch-target rule — the
    // bar is small type and the tap that drops a hold must not be fiddly.
    this.barRect =
      tiles.length === 0
        ? { x: 0, y: 0, w: 0, h: 0 }
        : {
            x: left - 12,
            y: y - Math.max(22, size),
            w: total + valueW + 24,
            h: Math.max(44, size * 2),
          }

    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    for (let i = 0; i < tiles.length; i++) {
      const value = tiles[i] as number
      ctx.beginPath()
      ctx.rect(x, y - size / 2, size, size)
      ctx.fillStyle = CELESTIAL
      ctx.fill()
      ctx.strokeStyle = CELESTIAL_DIM
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = CELESTIAL_INK
      ctx.font = numeralFont(size * 0.62)
      ctx.fillText(String(value), x + size / 2, y + 1)
      x += size
      if (i < tiles.length - 1) {
        ctx.fillStyle = INK_DIM
        ctx.font = chromeFont(size * 0.7, 700)
        ctx.fillText("·", x + dotW / 2, y)
        x += dotW
      }
    }
    if (valueText !== "") {
      ctx.fillStyle = BRASS_LIGHT
      ctx.font = chromeFont(size * 0.8, 600)
      ctx.textAlign = "left"
      ctx.fillText(valueText, x + gap, y)
    } else {
      // Shown only until the first resonator has been opened. After that the
      // child knows, and a line of standing instructions on every empty hold
      // for the rest of the session is copy nobody reads and everybody pays to
      // translate.
      if (arena.opened === 0) {
        ctx.fillStyle = INK_DIM
        ctx.font = chromeFont(size * 0.52, 500)
        ctx.textAlign = "center"
        ctx.fillText("SWEEP THE LIT ONES", cx, y)
      }
    }
  }

  private drawStatus(
    arena: Arena,
    state: { best: number; paused: boolean; stalled: boolean },
  ): void {
    const ctx = this.ctx
    const { size, top, lineH, left, right, cx } = this.hud.status
    ctx.font = chromeFont(size, 600)
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.fillStyle = INK_DIM
    ctx.fillText(`OPENED ${arena.opened}`, left, top)
    ctx.fillStyle = arena.chain > 0 ? BRASS_LIGHT : INK_DIM
    ctx.fillText(`CHAIN ${arena.chain}`, left, top + lineH)
    ctx.textAlign = "right"
    ctx.fillStyle = INK_DIM
    ctx.fillText(`BEST ${state.best}`, right, top)

    if (state.stalled) {
      // On its own row. Centred at the counters' height it would be shouldered
      // by BEST on a phone, and one row lower it would sit on CHAIN.
      ctx.textAlign = "center"
      ctx.fillStyle = OXIDE
      ctx.fillText("NO RESONATOR — SWEEP ON", cx, top + lineH * 2)
    }

    if (this.banner) {
      const t = Math.min(1, this.banner.age / 180)
      ctx.globalAlpha = Math.min(1, (BANNER_MS - this.banner.age) / 360) * t
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = this.banner.tint
      ctx.font = chromeFont(Math.max(20, Math.min(38, this.cssWidth / 20)), 700)
      ctx.fillText(this.banner.text, this.hud.banner.cx, this.hud.banner.cy)
      ctx.globalAlpha = 1
    }
  }

  /** What the pack looks like under the host's sheet: still, and honest. */
  private drawSheet(): void {
    const ctx = this.ctx
    ctx.fillStyle = "rgba(5,8,16,0.55)"
    ctx.fillRect(0, 0, this.cssWidth, this.cssHeight)
    ctx.fillStyle = INK_DIM
    ctx.font = chromeFont(Math.max(14, Math.min(20, this.cssWidth / 40)), 600)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText("PAUSED", this.hud.sheet.cx, this.hud.sheet.cy)
  }

  /** Did a press land on the tile bar? That gesture drops the hold. */
  hitsTileBar(x: number, y: number): boolean {
    const r = this.barRect
    return r.w > 0 && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h
  }

  /** Ceremony for a resonator opening. Colour and light, never confetti. */
  celebrate(x: number, y: number, tiles: readonly number[]): void {
    this.sparks.burst(x, y, 14 + tiles.length * 5, 420, BRASS_LIGHT, 3)
    this.sparks.burst(x, y, 10 + tiles.length * 3, 260, CELESTIAL, 2)
    this.knock(6)
    this.say("RESONANCE", BRASS_LIGHT)
  }

  refusal(x: number, y: number): void {
    this.sparks.burst(x, y, 8, 160, OXIDE, 2)
  }

  split(x: number, y: number): void {
    this.sparks.burst(x, y, 12, 300, STONE_INK, 2.2)
    this.knock(1.6)
  }

  wall(x: number, y: number): void {
    this.sparks.burst(x, y, 5, 130, CELESTIAL, 1.8)
  }

  sweep(x: number, y: number): void {
    this.sparks.burst(x, y, 6, 180, CELESTIAL, 1.6)
  }

  jostle(x: number, y: number): void {
    this.sparks.burst(x, y, 9, 220, OXIDE, 2)
    this.knock(3)
  }

  dispose(): void {
    this.canvas.remove()
  }
}

/**
 * A rounded rectangle path, drawn by hand.
 *
 * `CanvasRenderingContext2D.roundRect` is not in every WebView this pack runs
 * in — an older Android System WebView is a real device in the fleet — and a
 * missing method here would throw inside the draw loop and take the whole frame
 * with it.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const k = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + k, y)
  ctx.lineTo(x + w - k, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + k)
  ctx.lineTo(x + w, y + h - k)
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h)
  ctx.lineTo(x + k, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - k)
  ctx.lineTo(x, y + k)
  ctx.quadraticCurveTo(x, y, x + k, y)
  ctx.closePath()
}
