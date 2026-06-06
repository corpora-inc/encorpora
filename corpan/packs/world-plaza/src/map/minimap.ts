/**
 * minimap — the premium corner minimap (COHESION_ITERATION §4.2).
 *
 * A small rounded paper card in the bottom-right of `.wp-overlay` (Band A,
 * safe-area aware, away from the tracker top-left + coins top-right). It draws a
 * stylized schematic of the topology (walkable bounds + faint blockers + POIs)
 * with the live actors on top: the player (a heading wedge), remote travellers
 * (soft dots), and quest markers (a gentle pulse on the CURRENT objective only —
 * it directs without nagging; opt-out under reduced motion).
 *
 * PURE consumer of the `MapView` bundle (Seam 4): it reads `topology` once and
 * polls `getPlayerPos()` / `getRemotePositions()` / `getQuestMarkers()` each
 * `tick()`. The orchestrator calls `tick()` in the frame loop (cheap 2D draw)
 * and wires `onExpand` to open the full map.
 *
 * Mounts INSIDE `.wp-overlay` (never `document.body`) — the lesson M0 paid for.
 */

import type { MapView } from "../contracts/runtime"
import type { Translate } from "../contracts/runtime"
import {
  ensureMapStyles,
  centeredProjection,
  prepCanvas,
  createMapT,
  type MapT,
} from "./mapCore"

/** How far (world units) the minimap window shows around the player. A ~120u
 *  radius keeps you centred with your immediate neighbourhood + nearby landmarks
 *  in view, scrolling as you walk (so you never run off the edge of the map). */
const MINIMAP_HALF_SPAN = 120
import { drawBase, drawPois, drawQuestMarkers, drawRemotes, drawPlayer, drawWayfinding } from "./schematic"

const LOG = "[wp/minimap]"

export interface MinimapOptions {
  /** the `MapView` bundle (orchestrator-assembled; stub = solo schematic). */
  view: MapView
  /** accent colour (Scene.palette.accent) for the player + frame. */
  accent?: string
  /** localization seam (stub `(k)=>k` → bundled English fallback). */
  t?: Translate
  /** UI locale (the Track's native, via immersion.uiLocale()). */
  lang?: string
  /** tap/click the minimap → open the full map. */
  onExpand?: () => void
}

export interface MinimapHandle {
  /** the minimap element (a child of `.wp-overlay`). */
  el: HTMLElement
  /** redraw from the live `MapView` (orchestrator calls this each frame). */
  tick(): void
  dispose(): void
}

/**
 * Mount the minimap into `parent` (the `.wp-overlay` element). Returns a handle
 * with `tick()` (cheap per-frame redraw) and `dispose()`.
 */
export function mountMinimap(parent: HTMLElement, opts: MinimapOptions): MinimapHandle {
  ensureMapStyles()
  const accent = opts.accent ?? "#c46b4a"
  const mt: MapT = createMapT(opts.t, opts.lang ?? "en")
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

  const el = document.createElement("button")
  el.type = "button"
  el.className = "wp-minimap"
  el.style.setProperty("--wp-map-accent", accent)
  el.setAttribute("aria-label", mt("map.open"))
  el.title = mt("map.open")

  const canvas = document.createElement("canvas")
  canvas.className = "wp-minimap-canvas"
  el.appendChild(canvas)

  // A tiny "expand" glyph so the affordance reads as openable.
  const expand = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  expand.setAttribute("class", "wp-minimap-expand")
  expand.setAttribute("viewBox", "0 0 24 24")
  expand.innerHTML =
    '<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>'
  el.appendChild(expand)

  // CRITICAL (FAB_POLISH §2.4 / §8 P0.4): the minimap sits in the LOOK-stick half
  // (bottom-right). It lives inside `.wp-overlay`, whose dual-joystick input layer
  // captures EVERY pointerdown that bubbles to it — so a tap on the minimap would
  // ALSO fling the look camera (and could suppress the button's click). Swallow
  // the pointer gesture here so a press opens the map instead of spawning a stick,
  // exactly like the pack button does.
  const swallow = (e: Event) => e.stopPropagation()
  el.addEventListener("pointerdown", swallow)
  el.addEventListener("pointerup", swallow)

  if (opts.onExpand) {
    el.addEventListener("click", () => {
      try {
        opts.onExpand?.()
      } catch (err) {
        console.error(`${LOG} onExpand threw:`, err)
      }
    })
  } else {
    el.disabled = true
    el.style.cursor = "default"
  }

  parent.appendChild(el)

  let phase = 0
  let lastT = typeof performance !== "undefined" ? performance.now() : Date.now()

  function tick(): void {
    try {
      const cssW = el.clientWidth || 132
      const cssH = el.clientHeight || 132
      const ctx = prepCanvas(canvas, cssW, cssH)
      if (!ctx) return
      // FOLLOW the player: a centred window that scrolls with them, so they're
      // always at the middle of the minimap and never walk off it (the old
      // fit-to-content projection framed a fixed central region of the big city).
      let pp
      try {
        pp = opts.view.getPlayerPos()
      } catch {
        pp = { x: 0, z: 0, facing: 0 }
      }
      const proj = centeredProjection(pp.x, pp.z, MINIMAP_HALF_SPAN, cssW, cssH, 8)

      drawBase(ctx, opts.view.topology, proj, cssW, cssH, false, opts.view.getMapGeometry?.())
      drawPois(ctx, opts.view.topology, proj, false)

      // Advance the pulse phase on a real clock (frame-rate independent).
      if (!reduced) {
        const now = typeof performance !== "undefined" ? performance.now() : Date.now()
        const dt = Math.min(0.1, (now - lastT) / 1000)
        lastT = now
        phase = (phase + dt / 1.6) % 1 // ~1.6s loop
      }
      const qmarkers = drawQuestMarkers(ctx, opts.view, proj, false, {
        accent,
        detail: false,
        pulse: !reduced,
        pulsePhase: phase,
      })
      drawRemotes(ctx, opts.view, proj, false)
      const player = drawPlayer(ctx, opts.view, proj, false, accent)

      // #72 wayfinding: on the player-following minimap the objective is usually
      // OFF-screen, so an edge arrow toward it is the key "which way do I walk?".
      const obj = qmarkers.find((m) => m.kind === "objective")
      if (obj) drawWayfinding(ctx, player.sx, player.sy, obj.sx, obj.sy, cssW, cssH, false)
    } catch (err) {
      console.error(`${LOG} tick draw failed:`, err)
    }
  }

  tick()

  return {
    el,
    tick,
    dispose() {
      try {
        el.remove()
      } catch (err) {
        console.error(`${LOG} dispose failed:`, err)
      }
    },
  }
}
