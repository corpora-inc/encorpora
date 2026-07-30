// THE GRAPPLE FOUNDRY — the wiring.
//
// One verb: **stamp a plate**.
//
// You are on your back with a bar across your chest and a referee counting to
// three. Two pedals hang off the ring frame, one light and one heavy, each with
// a whole number stamped on it. The board above the ring carries a sum. Work
// out what that sum is, then build that exact number out of the two plates
// before the third slap lands, and the bar tips and you kick out.
//
//   * **Exact, or nothing.** One over the total and the bar comes down. That is
//     what stops the wrestling-game reflex — mashing loses instantly, so the
//     only way through is to know the number before you start tapping.
//   * **Out of moves is a real way to lose.** Seven, seven, seven on a target of
//     twenty-four leaves three, and nothing makes three out of fours and sevens.
//     The game says so at once instead of running the count out on a dead board.
//   * **A false finish is a mal-rule.** Land the bar on the exact value a broken
//     procedure produces and the hall comes up and the referee waves it off. It
//     costs count. It never costs the fall.
//
// This module owns the surface, the loop and the juice, and it decides nothing:
// every rule lives in `game/bout.ts` and every piece of arithmetic in
// `game/plates.ts`.

import {
  createInstructions,
  onInsetsChange,
  safeRect,
} from "../../../packs/shared/game-chrome/index.ts"
import type { Host } from "./contract.ts"
import { Audio } from "./audio.ts"
import { Feel } from "./core/feel.ts"
import { detectTier, TierGovernor } from "./core/tiers.ts"
import { Bout, type BoutEvent } from "./game/bout.ts"
import { SECTIONS, SUMMARY, TITLE } from "./manual.ts"
import { loadBelt, recordBelt } from "./game/save.ts"
import { REACTIONS } from "./game/reaction.ts"
import { Crowd } from "./render/crowd.ts"
import { Decals } from "./render/decals.ts"
import {
  drawBanner,
  drawBelt,
  drawBoard,
  drawCount,
  drawLoad,
  drawPedals,
  type Banner,
  type PedalState,
} from "./render/hud.ts"
import { computeLayout, type Layout } from "./render/layout.ts"
import { KIND_DUST, KIND_SHARD, KIND_SPARK, Particles } from "./render/particles.ts"
import { drawFrame, drawGrapple, drawMat, drawReferee } from "./render/ring.ts"
import {
  CHALK,
  HEAT_WHITE,
  KICKOUT,
  NIGHT,
  OXIDE,
  BRASS_HI,
  withAlpha,
} from "./render/palette.ts"

export function mountFoundry(el: HTMLElement, host: Host): { unmount(): void } {
  // ── surface ──────────────────────────────────────────────────────────────
  const root = document.createElement("div")
  root.style.cssText =
    "position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;" +
    "-webkit-user-select:none;user-select:none;background:#0b0a10;cursor:pointer;"
  const canvas = document.createElement("canvas")
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;"
  root.appendChild(canvas)
  el.appendChild(root)

  const ctx0 = canvas.getContext("2d", { alpha: false })
  if (!ctx0) throw new Error("foundry: could not acquire a 2D context")
  const g: CanvasRenderingContext2D = ctx0

  // ── systems ──────────────────────────────────────────────────────────────
  const reduced = host.prefersReducedMotion()
  const gov = new TierGovernor(detectTier())
  const feel = new Feel({ reducedMotion: reduced })
  const parts = new Particles()
  const decals = new Decals()
  const crowd = new Crowd()
  const audio = new Audio()
  // Read once so a returning session's record is carried forward, and written on
  // every cast. The value is not drawn: see the note in `draw()`.
  loadBelt()

  let layout: Layout = computeLayout(320, 568, safeRect(320, 568))
  const crowdSeed = 0x1b0c

  const bout = new Bout({ host, seed: 0x9a11ed, onEvent: handle })

  // ── presentation state ───────────────────────────────────────────────────
  const pedalA: PedalState = { value: bout.fall.plates.a, since: 99 }
  const pedalB: PedalState = { value: bout.fall.plates.b, since: 99 }
  let banner: Banner | null = null
  /** Seconds since the last slap landed; drives the referee's arm. */
  let slapAge = 99
  let boardShake = 0
  let loadPulse = 0
  let crowdFlare = 0
  let seam = 0
  let freshPlateMs = 1e6
  let rise = 0
  let riseTarget = 0
  let audioArmed = false
  let lastHeat = -1
  let paused = false
  let raf = 0
  let last = 0

  function setBanner(text: string, sub: string, color: string, seconds: number): void {
    // Never queued. A banner that arrived while another was up replaces it, so a
    // fast child is never reading a stale line about a fall they already left.
    banner = { text, sub, life: seconds, maxLife: seconds, color }
  }

  // ── the events the rules emit ────────────────────────────────────────────
  function handle(e: BoutEvent): void {
    switch (e.kind) {
      case "lockup": {
        pedalA.value = bout.fall.plates.a
        pedalB.value = bout.fall.plates.b
        riseTarget = 0
        rise = 0
        loadPulse = 0
        boardShake = 0
        slapAge = 99
        break
      }

      case "pin-begin": {
        feel.kick(0, 1, 5)
        parts.burst(
          KIND_DUST,
          layout.cx,
          layout.cy + layout.unit,
          Math.round(14 * gov.quality.burst),
          130,
          -Math.PI / 2,
          Math.PI * 1.5,
          layout.unit * 0.3,
        )
        break
      }

      case "slap": {
        slapAge = 0
        audio.slap(e.index)
        feel.addTrauma(0.1 + e.index * 0.05)
        feel.kick(0, 1, 3 + e.index * 2)
        decals.slap(
          layout.cx - layout.unit * (2.6 - e.index * 0.8),
          layout.cy + layout.unit * 1.1,
          layout.unit * 0.75,
          (e.index - 2) * 0.4,
          gov.quality.decals,
        )
        parts.burst(
          KIND_DUST,
          layout.cx - layout.unit * (2.6 - e.index * 0.8),
          layout.cy + layout.unit * 1.1,
          Math.round(10 * gov.quality.burst),
          90,
          -Math.PI / 2,
          Math.PI,
          layout.unit * 0.26,
        )
        break
      }

      case "load": {
        const p = e.side === "a" ? pedalA : pedalB
        p.since = 0
        loadPulse = 1
        seam = 1
        riseTarget = e.fraction * 0.22
        audio.plate(e.side === "b", e.fraction)
        feel.kick(0, -1, 2 + e.fraction * 3)
        const px = e.side === "a" ? layout.w * 0.25 : layout.w * 0.75
        parts.burst(
          KIND_SPARK,
          px,
          layout.padTop + 4,
          Math.round((6 + e.fraction * 10) * gov.quality.burst),
          260 + e.fraction * 220,
          -Math.PI / 2,
          1.1,
          layout.unit * 0.16,
        )
        break
      }

      case "false-finish": {
        audio.falseFinish()
        boardShake = 1
        crowdFlare = 0.55
        feel.addTrauma(0.16)
        decals.refusal(
          layout.cx + layout.unit * 1.6,
          layout.cy + layout.unit * 0.7,
          layout.unit * 0.9,
          gov.quality.decals,
        )
        setBanner("WAVED OFF", `${e.value} is not it`, OXIDE, 1.0)
        break
      }

      case "escape": {
        const r = REACTIONS[e.tier]
        const f = bout.fall
        audio.kickout(e.tier)
        crowdFlare = 1
        seam = 1
        riseTarget = 1
        feel.hitstop(e.tier >= 2 ? 90 : 55)
        feel.addTrauma(0.5 + e.tier * 0.12)
        feel.punch(0.03 + e.tier * 0.012)
        feel.kick(0, -1, 16)
        feel.requestFlash(0.16 + e.tier * 0.05, HEAT_WHITE)
        if (e.tier >= 2) feel.slowmo(0.45, 240)
        decals.scorch(layout.cx, layout.cy + layout.unit * 0.9, layout.unit * 1.5, gov.quality.decals)
        parts.burst(
          KIND_SPARK,
          layout.cx,
          layout.cy,
          Math.round(r.particles * 0.7 * gov.quality.burst),
          520 + e.tier * 130,
          -Math.PI / 2,
          Math.PI * 1.35,
          layout.unit * 0.2,
        )
        parts.burst(
          KIND_SHARD,
          layout.cx,
          layout.cy,
          Math.round(r.particles * 0.16 * gov.quality.burst),
          340,
          -Math.PI / 2,
          Math.PI * 1.1,
          layout.unit * 0.3,
        )
        // The sentence the fall just proved, in the child's own taps. True,
        // specific, and never a compliment.
        const parts_ = [
          f.tapsB > 0 ? `${f.tapsB}×${f.plates.b}` : "",
          f.tapsA > 0 ? `${f.tapsA}×${f.plates.a}` : "",
        ].filter(Boolean)
        setBanner(
          e.repaired ? "KICK OUT — REPAIRED" : "KICK OUT",
          `${parts_.join(" + ")} = ${f.target}`,
          KICKOUT,
          Math.max(1.1, r.budgetMs / 1000),
        )
        break
      }

      case "pinfall": {
        // Silence. No burst, no flash, no freeze frame — the world keeps
        // running and nothing happens in it. `energy(SLIP) < energy(SEAT)`.
        audio.pinfall()
        crowdFlare = 0
        riseTarget = 0
        feel.kick(0, 1, 7)
        const f = bout.fall
        // A bar that came to rest on a value with a name gets told which one.
        // "WAVED OFF" is the same word the non-fatal beat uses on purpose: the
        // referee refused the same number, it just arrived too late to survive.
        const text = e.diagnosed
          ? "WAVED OFF"
          : e.reason === "overshot"
            ? "TOO MUCH"
            : e.reason === "stuck"
              ? "NO WAY OUT"
              : "THREE"
        const sub =
          e.reason === "stuck"
            ? `${f.target - f.load} left, and ${f.plates.a} and ${f.plates.b} cannot make it`
            : f.load > 0
              ? `${f.load} — it needed ${f.target}`
              : `it needed ${f.target}`
        setBanner(text, sub, OXIDE, 1.25)
        if (e.diagnosed) {
          decals.refusal(
            layout.cx + layout.unit * 1.6,
            layout.cy + layout.unit * 0.7,
            layout.unit * 0.9,
            gov.quality.decals,
          )
        }
        break
      }

      case "cast": {
        freshPlateMs = 0
        recordBelt(e.beltPlates, bout.challengersBeaten)
        break
      }

      case "title": {
        audio.title()
        crowdFlare = 1
        feel.requestFlash(0.2, BRASS_HI)
        setBanner(`${e.challenger} IS DOWN`, `${bout.beltPlates} plates on the belt`, BRASS_HI, 1.8)
        parts.burst(
          KIND_SPARK,
          layout.cx,
          layout.beltY + layout.beltH,
          Math.round(60 * gov.quality.burst),
          420,
          Math.PI / 2,
          Math.PI * 1.2,
          layout.unit * 0.18,
        )
        break
      }
    }
  }

  // ── sizing ───────────────────────────────────────────────────────────────
  function resize(): void {
    const rect = root.getBoundingClientRect()
    const w = Math.max(240, Math.round(rect.width || 320))
    const h = Math.max(360, Math.round(rect.height || 568))
    const dpr = Math.min(globalThis.devicePixelRatio || 1, gov.quality.maxDpr)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    layout = computeLayout(w, h, safeRect(w, h))
    crowd.layout(w, layout.horizon, gov.quality.crowd, crowdSeed)
    parts.setLimit(gov.quality.particles)
  }

  // Rotation swaps the insets, and iPadOS changes them when the pack is resized
  // in Split View. A layout read once at mount is right until the first turn of
  // the tablet and wrong for the rest of the session.
  const stopInsets = onInsetsChange(() => {
    resize()
  })

  const ro =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          resize()
        })
      : null
  ro?.observe(root)
  resize()

  // ── input ────────────────────────────────────────────────────────────────
  // The whole screen is two pedals. A four-second escape must never be lost to
  // a thumb that landed 20px outside a button, so there is no outside.
  function armAudio(): void {
    if (audioArmed) return
    audioArmed = true
    void audio.start().then(() => {
      lastHeat = bout.heat
      audio.setHeat(bout.heat, 0.8)
    })
  }

  function onPointerDown(ev: PointerEvent): void {
    ev.preventDefault()
    armAudio()
    const rect = canvas.getBoundingClientRect()
    bout.tap(ev.clientX - rect.left < rect.width / 2 ? "a" : "b")
  }

  function onKeyDown(ev: KeyboardEvent): void {
    // This listener is on `globalThis` and the manual is a DOM scrim, which
    // stops the pointer and nothing else. Without this line a child reading the
    // Controls section and trying the keys it names would drop plates onto a
    // bar they cannot see — and in this game one over the target loses the fall
    // on the spot. The scrim was hiding the only feedback there is.
    if (ev.repeat || guide.isOpen) return
    const k = ev.key.toLowerCase()
    if (k === "arrowleft" || k === "a") {
      armAudio()
      bout.tap("a")
    } else if (k === "arrowright" || k === "d") {
      armAudio()
      bout.tap("b")
    } else if (k === "m") {
      audio.setEnabled(!audio.enabled)
    } else {
      return
    }
    ev.preventDefault()
  }

  function onVisibility(): void {
    // The count must not run while the tablet is in a pocket. A child who comes
    // back to a lost fall they never saw has been cheated by the app.
    paused = document.visibilityState === "hidden"
    if (paused) {
      audio.setHeat(0, 0.2)
      lastHeat = -1
    } else {
      last = 0
    }
  }

  canvas.addEventListener("pointerdown", onPointerDown, { passive: false })
  globalThis.addEventListener("keydown", onKeyDown)
  document.addEventListener("visibilitychange", onVisibility)

  // ── how to play ──────────────────────────────────────────────────────────
  //
  // The words are in `manual.ts`, with the reason they are written the way they
  // are. In short: this game invents a *fall*, a *pin*, a *kick out*, a *count*
  // and a *belt*, it used to use all of them without ever saying what they were,
  // and a child cannot play a game whose rules are in a language it has not been
  // taught.
  //
  // Opening the manual stops the count: a child who went to read the rules must
  // not come back to a fall they lost while reading them.
  const guide = createInstructions(root, {
    title: TITLE,
    summary: SUMMARY,
    sections: SECTIONS,
    onClose: (): void => {
      last = 0
    },
    reducedMotion: reduced,
  })

  // ── loop ─────────────────────────────────────────────────────────────────
  function frame(now: number): void {
    raf = requestAnimationFrame(frame)
    if (last === 0) last = now
    const rawMs = Math.min(64, now - last)
    last = now
    if (paused || guide.isOpen) return

    // A downgrade has to move the levers that actually cost fill rate. `maxDpr`
    // and the lantern count are only read in `resize()`, and a pack frame at a
    // fixed size never resizes again — so without this a device that dropped to
    // `low` would keep rendering at DPR 2 with a full crowd for the rest of the
    // session, which is exactly the work that was too slow.
    if (gov.sample(rawMs)) resize()
    const simMs = feel.advance(rawMs, now)
    const dt = simMs / 1000
    const realDt = rawMs / 1000

    bout.tick(dt)

    // Presentation decays run on real time so a hitstop does not freeze the
    // referee's arm halfway through a slap.
    slapAge += realDt
    pedalA.since += realDt
    pedalB.since += realDt
    boardShake = Math.max(0, boardShake - realDt * 3.2)
    loadPulse = Math.max(0, loadPulse - realDt * 3.6)
    crowdFlare = Math.max(0, crowdFlare - realDt * 1.15)
    seam = Math.max(0, seam - realDt * 1.5)
    freshPlateMs += rawMs
    rise += (riseTarget - rise) * Math.min(1, realDt * 9)

    parts.step(dt, layout.matBottom - layout.unit * 0.2)
    decals.step(dt)
    crowd.step(realDt)

    // The crowd bed is ramped, not stepped, so it is only re-scheduled when the
    // hall has actually changed. Cancelling and re-targeting a gain sixty times
    // a second is audible as a flutter and is pure work.
    const wantedHeat = Math.min(1, bout.heat + crowdFlare * 0.5)
    if (Math.abs(wantedHeat - lastHeat) > 0.02) {
      lastHeat = wantedHeat
      audio.setHeat(wantedHeat, 0.5)
    }

    if (banner) {
      banner.life -= realDt
      if (banner.life <= 0) banner = null
    }

    draw()
  }

  function draw(): void {
    const l = layout
    const q = gov.quality
    const f = bout.fall
    const live = bout.phase === "pin"

    g.save()
    if (!reduced && (feel.shakeX !== 0 || feel.shakeY !== 0 || feel.scale !== 1)) {
      g.translate(l.cx, l.cy)
      g.scale(feel.scale, feel.scale)
      g.translate(-l.cx + feel.shakeX, -l.cy + feel.shakeY)
    }

    g.fillStyle = NIGHT
    g.fillRect(0, 0, l.w, l.h)

    crowd.draw(g, bout.heat, reduced ? crowdFlare * 0.4 : crowdFlare, q.glow)

    drawFrame(g, l, q.ropeDetail, decals.warmth(), false)
    drawMat(g, l, decals, q.glow)

    const countFraction = bout.countFraction
    drawGrapple(
      g,
      l,
      {
        rise,
        press: live ? 0.4 + countFraction * 0.5 : 0.2,
        wobble: reduced ? 0 : performance.now() / 1000,
        count: countFraction,
      },
      f.target > 0 ? Math.min(1, f.load / f.target) : 0,
      seam,
    )

    if (bout.phase !== "kickout") {
      drawReferee(g, l, Math.min(1, slapAge / Math.max(0.35, f.slapPeriod * 0.55)), f.slaps)
    }

    drawFrame(g, l, q.ropeDetail, decals.warmth(), true)

    if (!reduced) parts.draw(g, q.glow)

    drawCount(g, l, countFraction, f.slaps, live)
    drawLoad(g, l, f.load, f.target > 0 ? f.load / f.target : 0, reduced ? 0 : loadPulse)
    drawBoard(g, l, f.prompt, reduced ? 0 : boardShake, countFraction)
    drawBelt(g, l, bout.beltPlates, bout.challengersBeaten, freshPlateMs)
    drawPedals(g, l, pedalA, pedalB, live)

    if (banner) drawBanner(g, l, banner)

    g.restore()

    if (feel.flashAlpha > 0.001) {
      g.fillStyle = withAlpha(feel.currentFlashColor, feel.flashAlpha)
      g.fillRect(0, 0, l.w, l.h)
    }

    // The one persistent line of chrome: who is across the ring and how many
    // falls they still owe. Bottom-left, out of the pedals' way.
    //
    // The session best is deliberately *not* here. Inside a pack frame the belt
    // record cannot be read back, and both numbers are monotone within a
    // session, so it would always print the number already sitting next to it —
    // a fifth numeral on a surface that has room for four.
    g.save()
    g.font = "700 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace"
    g.textAlign = "left"
    g.textBaseline = "alphabetic"
    g.fillStyle = withAlpha(CHALK, 0.34)
    g.fillText(`${bout.challenger} · ${bout.toBeat} TO GO`, l.safe.x + 10, l.padTop - 8)
    g.restore()
  }

  raf = requestAnimationFrame(frame)

  return {
    unmount(): void {
      cancelAnimationFrame(raf)
      guide.destroy()
      stopInsets()
      canvas.removeEventListener("pointerdown", onPointerDown)
      globalThis.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("visibilitychange", onVisibility)
      ro?.disconnect()
      audio.dispose()
      parts.clear()
      decals.clear()
      root.remove()
    },
  }
}
