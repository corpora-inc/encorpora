/**
 * ferry.ts — the HARBOR FERRY RIDE (pay the ferryman, actually get on the boat).
 *
 *   At the harbor you pay the ferry hand → walk the gangplank → and the boat
 *   PULLS AWAY: the deck rocks gently, gulls wheel past, the horn sounds, the
 *   city shrinks to a paper skyline off the stern → a short chat with the ferry
 *   hand mid-water → then the boat swings around and brings you home to the quay.
 *
 * A ROUND-TRIP sightseeing ride by design: it resolves with NO `travelTo`, it
 * NEVER consumes the `ferry-token` quest item, and it reuses (never replaces)
 * the boatman NPC — so the es-guadalajara-route / harbor-ferry-ride quest steps
 * that live at this anchor keep working untouched.
 *
 * Same perf-zero DOM/CSS seam as boarding/place/food/vacation; self-contained
 * scoped styles. Spoken copy = TARGET language (the boatman); chrome = `t` keys.
 */

import type {
  Vignette,
  VignetteContext,
  VignetteNpcHandle,
  VignetteResult,
  VignetteReward,
} from "./types"
import { NO_TRAVEL } from "./types"
import { registerRootHooks } from "./host"

export interface FerryOptions {
  /** fare in MINOR units of the default currency. */
  fare?: number
  /** Stable id + display name for the boatman (REUSE the harbor boatman's id so
   *  his voice stays sticky across the quay and the deck). */
  boatmanId?: string
  boatmanName?: string
  /** Optional quest step satisfied by completing a ride. */
  questStep?: string
}

const LOG = "[wp/vignette/ferry]"
const DEFAULT_FARE = 220

export function createFerryVignette(opts: FerryOptions = {}): Vignette {
  let disposed = false
  let npc: VignetteNpcHandle | null = null
  let cleanup: Array<() => void> = []
  let timers: number[] = []

  const later = (fn: () => void, ms: number): void => {
    timers.push(window.setTimeout(fn, ms))
  }

  function enter(ctx: VignetteContext): Promise<VignetteResult> {
    ensureFerryStyles()
    return new Promise<VignetteResult>((resolve) => {
      const { mountRoot, scene, learnerPair, reducedMotion } = ctx
      const t = (key: string, fallback: string, params?: Record<string, string | number>): string => {
        let s = ctx.t(key, params)
        if (s === key || s == null || s === "") s = fallback
        if (params) s = s.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? `{${k}}`))
        return s
      }
      const accent = scene.palette?.accent ?? "#e8b54a"
      const fare = opts.fare ?? DEFAULT_FARE

      let settled = false
      let sailing = false
      const finish = (result: VignetteResult) => {
        if (settled) return
        settled = true
        npc?.dispose()
        npc = null
        resolve(result)
      }

      registerRootHooks(mountRoot, {
        exit: () => finish(NO_TRAVEL),
        exitLabel: t("vignette.ferry.leave", "Back to the quay"),
      })

      // ── the quay: water, the moored ferry, the boatman ──────────────────────
      const stage = div("wp-vig-ferry")
      stage.style.setProperty("--wp-ferry-accent", accent)
      mountRoot.appendChild(stage)

      const sky = div("wp-vig-ferry-sky")
      const skyline = div("wp-vig-ferry-skyline")
      skyline.innerHTML = quaySkyline()
      sky.appendChild(skyline)
      stage.appendChild(sky)

      const water = div("wp-vig-ferry-water")
      if (!reducedMotion) {
        for (let i = 0; i < 3; i++) water.appendChild(div(`wp-vig-ferry-wave wp-vig-ferry-wave--${i}`))
      }
      stage.appendChild(water)

      const boat = div("wp-vig-ferry-boat")
      boat.innerHTML = ferrySvg(accent)
      if (!reducedMotion) boat.classList.add("wp-vig-ferry-boat--bob")
      stage.appendChild(boat)

      const header = div("wp-vig-ferry-header")
      header.appendChild(textDiv("wp-vig-ferry-header__title", t("vignette.ferry.title", "Harbor Ferry")))
      header.appendChild(textDiv("wp-vig-ferry-header__sub", t("vignette.ferry.sub", "A turn around the bay — salt air included")))
      stage.appendChild(header)

      // ── the ferry hand (the SAME boatman who keeps the quest token) ─────────
      const tray = div("wp-vig-ferry-tray")
      stage.appendChild(tray)
      npc = ctx.openNpc({
        container: tray,
        npcId: opts.boatmanId ?? "harbor-boatman",
        npcName: opts.boatmanName ?? t("vignette.ferry.boatman", "the ferry hand"),
        persona: {
          tone: "a weathered, kindly ferry hand who knows every mood of the bay",
          quirks: [
            "points out landmarks as the boat passes them",
            "swears the bay is prettiest at this exact hour, every hour",
            "tips an imaginary cap when you board",
          ],
        },
        scriptedFallback: [
          t("vignette.ferry.fallback.0", "Fine day for the water. Hop aboard!"),
          t("vignette.ferry.fallback.1", "Hold the rail — she rocks a little."),
          t("vignette.ferry.fallback.2", "Back to the quay, safe and sound."),
        ],
        voiceCode: learnerPair.target,
        starterChips: [
          t("vignette.ferry.chip.0", "Hello!"),
          t("vignette.ferry.chip.1", "How's the water today?"),
        ],
        onClose: () => {},
      })

      // ── the ride button ──────────────────────────────────────────────────────
      const actions = div("wp-vig-ferry-actions")
      const ride = document.createElement("button")
      ride.type = "button"
      ride.className = "wp-vig-ferry-btn"
      ride.textContent = `${t("vignette.ferry.ride", "Ride the ferry")} · ${formatPrice(fare)}`
      ride.addEventListener("click", () => void sail())
      actions.appendChild(ride)
      stage.appendChild(actions)

      async function sail(): Promise<void> {
        if (settled || sailing) return
        sailing = true
        ride.disabled = true
        try {
          // PAY — graceful waive (the ferryman shrugs kindly), NEVER the quest
          // token: that brass piece stays in the bag for the boatman's crossing.
          const w = ctx.wallet()
          const currency = w.defaultCurrency()
          const have = w.balance(currency)
          const charged = Math.min(fare, have)
          if (charged > 0) w.debit(currency, charged)

          playHorn()
          stage.classList.add("wp-vig-ferry--sailing")

          // out across the bay…
          await holdBeat(stage, t("vignette.ferry.depart", "Casting off…"), reducedMotion ? 900 : 2600, reducedMotion)
          if (settled) return
          spawnGulls(stage, reducedMotion)
          await holdBeat(stage, t("vignette.ferry.midwater", "Out on the bay — the city looks small from here."), reducedMotion ? 900 : 3000, reducedMotion)
          if (settled) return

          // …and home again.
          stage.classList.remove("wp-vig-ferry--sailing")
          stage.classList.add("wp-vig-ferry--returning")
          playHorn()
          await holdBeat(stage, t("vignette.ferry.return", "Coming about — home to the quay."), reducedMotion ? 900 : 2600, reducedMotion)
          if (settled) return

          const xp = 14
          const reward: VignetteReward = { xp }
          try {
            ctx.grant(reward)
          } catch (e) {
            console.error(`${LOG} grant failed:`, e)
          }
          finish({
            rewards: reward,
            ...(opts.questStep ? { questStep: opts.questStep } : {}),
          })
        } finally {
          sailing = false
          ride.disabled = false
        }
      }

      function holdBeat(host: HTMLElement, text: string, ms: number, reduced: boolean): Promise<void> {
        return new Promise((res) => {
          const card = textDiv("wp-vig-ferry-beat", text)
          host.appendChild(card)
          const show = () => card.classList.add("wp-vig-ferry-beat--in")
          if (reduced) show()
          else requestAnimationFrame(show)
          later(() => {
            card.classList.remove("wp-vig-ferry-beat--in")
            later(() => {
              card.remove()
              res()
            }, reduced ? 0 : 260)
          }, ms)
        })
      }

      cleanup.push(() => stage.remove())
      if (!reducedMotion) requestAnimationFrame(() => stage.classList.add("wp-vig-ferry--in"))
      else stage.classList.add("wp-vig-ferry--in")
    })
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    npc?.dispose()
    npc = null
    for (const id of timers) window.clearTimeout(id)
    timers = []
    for (const fn of cleanup) {
      try {
        fn()
      } catch (e) {
        console.error(`${LOG} cleanup threw:`, e)
      }
    }
    cleanup = []
  }

  return { enter, dispose }
}

/* ------------------------------------------------------------------ DOM/art */

function div(cls: string): HTMLDivElement {
  const d = document.createElement("div")
  d.className = cls
  return d
}
function textDiv(cls: string, text: string): HTMLDivElement {
  const d = div(cls)
  d.textContent = text
  return d
}
function formatPrice(minor: number): string {
  const major = minor / 100
  return Number.isInteger(major) ? String(major) : major.toFixed(2)
}

function spawnGulls(stage: HTMLElement, reduced: boolean): void {
  if (reduced) return
  for (let i = 0; i < 3; i++) {
    const gull = div("wp-vig-ferry-gull")
    gull.textContent = "⌒"
    gull.style.top = `${12 + Math.random() * 18}%`
    gull.style.animationDelay = `${i * 0.7}s`
    stage.appendChild(gull)
    window.setTimeout(() => gull.remove(), 6500)
  }
}

/** The little paper ferry — hull, cabin, accent funnel, a curl of smoke. */
function ferrySvg(accent: string): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120" preserveAspectRatio="xMidYMax meet">
  <path d="M14 78 L206 78 L188 108 L32 108 Z" fill="#5b4636"/>
  <rect x="58" y="46" width="104" height="34" rx="6" fill="#f3ece0"/>
  <rect x="70" y="54" width="16" height="12" rx="3" fill="#9ecbe8"/>
  <rect x="96" y="54" width="16" height="12" rx="3" fill="#9ecbe8"/>
  <rect x="122" y="54" width="16" height="12" rx="3" fill="#9ecbe8"/>
  <rect x="138" y="26" width="18" height="26" rx="4" fill="${accent}"/>
  <path d="M150 18 Q158 10 154 2" stroke="#cdbfa8" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.8"/>
  <path d="M14 78 L206 78" stroke="rgba(0,0,0,0.18)" stroke-width="3"/>
</svg>`
}

/** The city shrinking off the stern — a paper skyline strip for the horizon. */
function quaySkyline(): string {
  const ink = "#3a4a5a"
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 60" preserveAspectRatio="xMidYMax slice">
  <path d="M0 60 L0 40 L18 40 L18 28 L30 28 L30 44 L52 44 L52 22 L66 22 L66 60 Z" fill="${ink}" opacity="0.85"/>
  <path d="M66 60 L66 36 L84 36 L84 46 L108 46 L108 30 L122 30 L122 60 Z" fill="${ink}" opacity="0.7"/>
  <path d="M122 60 L122 42 L146 42 L146 24 L158 24 L158 44 L188 44 L188 34 L204 34 L204 60 Z" fill="${ink}" opacity="0.85"/>
  <path d="M204 60 L204 40 L230 40 L230 48 L260 48 L260 32 L276 32 L276 60 Z" fill="${ink}" opacity="0.7"/>
  <circle cx="244" cy="14" r="8" fill="#ffd99a"/>
</svg>`
}

/* ------------------------------------------------------------------- audio */

/** A low, friendly two-blast ferry horn (synth — no asset). */
function playHorn(): void {
  try {
    const AC =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    const ac = new AC()
    const now = ac.currentTime
    const blast = (at: number, dur: number) => {
      const osc = ac.createOscillator()
      const osc2 = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = "sawtooth"
      osc.frequency.value = 110
      osc2.type = "sine"
      osc2.frequency.value = 165
      const filter = ac.createBiquadFilter()
      filter.type = "lowpass"
      filter.frequency.value = 420
      gain.gain.setValueAtTime(0.0001, now + at)
      gain.gain.exponentialRampToValueAtTime(0.07, now + at + 0.06)
      gain.gain.setValueAtTime(0.07, now + at + dur - 0.1)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur)
      osc.connect(filter)
      osc2.connect(filter)
      filter.connect(gain).connect(ac.destination)
      osc.start(now + at)
      osc2.start(now + at)
      osc.stop(now + at + dur + 0.02)
      osc2.stop(now + at + dur + 0.02)
    }
    blast(0, 0.5)
    blast(0.7, 0.7)
    window.setTimeout(() => void ac.close().catch(() => {}), 1800)
  } catch (e) {
    console.error(`${LOG} horn failed:`, e)
  }
}

/* ------------------------------------------------------------------ styles */

let ferryStylesInjected = false
function ensureFerryStyles(): void {
  if (ferryStylesInjected || typeof document === "undefined") return
  if (document.querySelector("style[data-wp-vig-ferry]")) {
    ferryStylesInjected = true
    return
  }
  ferryStylesInjected = true
  const style = document.createElement("style")
  style.setAttribute("data-wp-vig-ferry", "")
  style.textContent = FERRY_CSS
  document.head.appendChild(style)
}

const FERRY_CSS = `
.wp-vig-ferry {
  position: absolute; inset: 0; overflow: hidden;
  font: 400 15px/1.4 ui-sans-serif, system-ui, sans-serif;
  opacity: 0; transition: opacity 0.34s ease;
  background: linear-gradient(180deg, #7db4d8 0%, #bfe0e8 46%, #3e6c8a 46%, #2c4d63 100%);
}
.wp-vig-ferry--in { opacity: 1; }
.wp-vig-ferry-sky { position: absolute; top: 0; left: 0; right: 0; height: 46%; }
.wp-vig-ferry-skyline {
  position: absolute; bottom: 0; left: 0; right: 0; height: 42%;
  transition: transform 2.4s ease, opacity 2.4s ease;
}
.wp-vig-ferry-skyline svg { width: 100%; height: 100%; display: block; }
.wp-vig-ferry--sailing .wp-vig-ferry-skyline { transform: scale(0.62) translateY(12%); opacity: 0.55; }
.wp-vig-ferry--returning .wp-vig-ferry-skyline { transform: none; opacity: 1; }
.wp-vig-ferry-water { position: absolute; top: 46%; left: 0; right: 0; bottom: 0; }
.wp-vig-ferry-wave {
  position: absolute; left: -12%; right: -12%; height: 16px; border-radius: 50%;
  background: rgba(255,255,255,0.16);
  animation: wp-vig-ferry-wave 4.4s ease-in-out infinite alternate;
}
.wp-vig-ferry-wave--0 { top: 12%; animation-delay: 0s; }
.wp-vig-ferry-wave--1 { top: 36%; animation-delay: 0.9s; }
.wp-vig-ferry-wave--2 { top: 62%; animation-delay: 1.7s; }
@keyframes wp-vig-ferry-wave { from { transform: translateX(-14px); } to { transform: translateX(14px); } }
.wp-vig-ferry-boat {
  position: absolute; left: 50%; bottom: 24%; transform: translateX(-50%);
  width: clamp(220px, 42vw, 380px);
  filter: drop-shadow(0 14px 12px rgba(0,0,0,0.3));
  transition: transform 2.4s ease;
  z-index: 2;
}
.wp-vig-ferry-boat svg { width: 100%; height: auto; }
.wp-vig-ferry-boat--bob { animation: wp-vig-ferry-bob 3.8s ease-in-out infinite alternate; }
@keyframes wp-vig-ferry-bob {
  from { transform: translateX(-50%) rotate(-1.4deg) translateY(0); }
  to { transform: translateX(-50%) rotate(1.2deg) translateY(-7px); }
}
.wp-vig-ferry--sailing .wp-vig-ferry-boat { transform: translateX(-50%) scale(0.92); }
.wp-vig-ferry-gull {
  position: absolute; left: -8%;
  font: 700 26px/1 ui-sans-serif, system-ui, sans-serif; color: #f3ece0;
  text-shadow: 0 2px 5px rgba(0,0,0,0.25);
  animation: wp-vig-ferry-gull 6s linear forwards;
  z-index: 3; pointer-events: none;
}
@keyframes wp-vig-ferry-gull {
  from { transform: translateX(-6vw) translateY(0); }
  50% { transform: translateX(50vw) translateY(-3vh); }
  to { transform: translateX(110vw) translateY(1vh); }
}
.wp-vig-ferry-header {
  position: absolute; top: calc(env(safe-area-inset-top, 0px) + 12px); left: 50%; transform: translateX(-50%);
  text-align: center; z-index: 3;
  background: rgba(12,22,30,0.78); color: #f3ece0;
  padding: 8px 22px; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.3);
}
.wp-vig-ferry-header__title { font: 800 clamp(16px, 2.6vw, 24px)/1.1 ui-sans-serif, system-ui, sans-serif; }
.wp-vig-ferry-header__sub {
  font: 500 clamp(12px, 1.6vw, 15px)/1.2 ui-sans-serif, system-ui, sans-serif;
  color: var(--wp-ferry-accent, #e8b54a); margin-top: 3px;
}
.wp-vig-ferry-tray { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; }
.wp-vig-ferry-actions {
  position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + 96px); z-index: 6;
}
.wp-vig-ferry-btn {
  min-height: 50px; padding: 13px clamp(22px, 3vw, 34px);
  border: none; border-radius: 999px; cursor: pointer;
  font: 700 clamp(15px, 0.6vw + 13px, 18px)/1 ui-sans-serif, system-ui, sans-serif;
  background: linear-gradient(180deg, var(--wp-ferry-accent, #e8b54a), #c4922f); color: #1f1505;
  box-shadow: 0 8px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.5);
  -webkit-tap-highlight-color: transparent;
}
.wp-vig-ferry-btn:active { transform: scale(0.96); }
.wp-vig-ferry-btn:disabled { opacity: 0.6; pointer-events: none; }
.wp-vig-ferry-beat {
  position: absolute; top: 58%; left: 50%; transform: translate(-50%, 8px);
  max-width: 80%;
  font: 700 clamp(15px, 2.4vw, 20px)/1.3 ui-sans-serif, system-ui, sans-serif;
  color: #f3ece0; background: rgba(12,22,30,0.78);
  padding: 10px 22px; border-radius: 12px; text-align: center;
  box-shadow: 0 6px 16px rgba(0,0,0,0.3);
  opacity: 0; transition: opacity 0.26s ease, transform 0.26s ease;
  z-index: 7;
}
.wp-vig-ferry-beat--in { opacity: 1; transform: translate(-50%, 0); }
@media (hover: hover) and (pointer: fine) {
  .wp-vig-ferry-btn { transition: filter 0.16s ease, transform 0.1s ease; }
  .wp-vig-ferry-btn:hover { filter: brightness(1.05); }
}
@media (prefers-reduced-motion: reduce) {
  .wp-vig-ferry, .wp-vig-ferry-boat--bob, .wp-vig-ferry-wave, .wp-vig-ferry-gull,
  .wp-vig-ferry-skyline, .wp-vig-ferry-boat { animation: none; transition: none; }
}
`
