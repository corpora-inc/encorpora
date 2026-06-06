/**
 * The BOARDING-HALL vignette — the shared enterable sub-experience for the city's
 * three new transit heroes: the BUS terminal, the TRAIN station, and the AIRPORT.
 *
 *   You walk INTO a station landmark → you're at the boarding hall → a clerk
 *   (coach driver / conductor / gate agent) greets you in the TARGET language via
 *   the real Qwen3 NPC runtime → you pick a destination from the departures board
 *   → a quick challenge EARNS the trip (say the place name back) → the vehicle
 *   departs (a mode-flavoured animation) → the fare is paid from your wallet →
 *   you ARRIVE: the vignette resolves `{ travelTo }` so the city re-spawns you at
 *   the destination landmark. Leaving without boarding resolves with no travel —
 *   dignified, no dark pattern forcing the ride.
 *
 * It is the taxi's sibling on the SAME `Vignette` seam (taxi.ts is the bespoke
 * back-seat reference). One factory, three MODES (`bus` | `train` | `flight`) that
 * differ only in framing/persona/copy/motif/icon — so a station, a platform, and
 * a departure gate are three skins of one proven flow, not three code paths.
 *
 * HD-2D discipline: the clerk is a 2D paper-person billboard (an idle sway + a
 * drop shadow, never paper-thin); the hall is a flat layered backdrop (floor +
 * a departures board + a window with a mode-appropriate vehicle silhouette).
 * Self-contained: its own scoped `<style data-wp-vig-board>` (never the shared
 * sheet — other agents live there), all DOM/audio helpers inline.
 */

import type {
  Vignette,
  VignetteContext,
  VignetteNpcHandle,
  VignetteResult,
} from "./types"
import { NO_TRAVEL } from "./types"
import { registerRootHooks } from "./host"
import { drawDriverBillboard } from "./driverArt"
import type { ChallengeContext } from "@world-plaza/contracts"

/** The three transit modes this vignette skins. */
export type BoardingMode = "bus" | "train" | "flight"

/** One place a service can take you. Mirrors the taxi's `TaxiDestination`. */
export interface BoardingDestination {
  anchorId: string
  label: string
  /** fare in MINOR units of the Track's default currency. */
  fare: number
  /** icon motif hint for the procedural ticket icon. */
  motif?: string
}

/** What the orchestrator injects when registering a boarding vignette. */
export interface BoardingOptions {
  mode: BoardingMode
  /** Real topology destinations (anchor id → label/fare). Omit ⇒ a demo set. */
  destinations?: BoardingDestination[]
  /** Stable id + display name for the clerk NPC (drives the sticky voice). */
  clerkId?: string
  clerkName?: string
}

/** Per-mode framing copy + look. All STRINGS go through `t(key, fallback)` so they
 *  localize; this table only holds the per-mode KEY suffixes + visual motifs. */
interface ModeSkin {
  /** i18n key fragment + the inline English fallbacks. */
  hallTitle: [string, string]
  vehicle: [string, string] // the noun ("the coach", "the train", "the flight")
  board: [string, string] // departures-board heading
  clerkRole: [string, string] // NPC display fallback
  persona: { tone: string; quirks: string[] }
  /** accent silhouette drawn in the hall window (pure CSS/SVG shape id). */
  silhouette: "bus" | "train" | "plane"
  /** ticket icon motif. */
  ticketMotif: string
}

const SKINS: Record<BoardingMode, ModeSkin> = {
  bus: {
    hallTitle: ["vignette.board.bus.title", "Bus Terminal"],
    vehicle: ["vignette.board.bus.vehicle", "the coach"],
    board: ["vignette.board.bus.board", "Departures"],
    clerkRole: ["vignette.board.bus.clerk", "the coach driver"],
    persona: {
      tone: "a cheerful intercity coach driver who knows every stop on the line",
      quirks: [
        "greets every passenger warmly and asks where they're headed",
        "mentions how long the ride takes",
        "shares one friendly tip about the destination stop",
      ],
    },
    silhouette: "bus",
    ticketMotif: "bus",
  },
  train: {
    hallTitle: ["vignette.board.train.title", "Rail Station"],
    vehicle: ["vignette.board.train.vehicle", "the train"],
    board: ["vignette.board.train.board", "Departures"],
    clerkRole: ["vignette.board.train.clerk", "the conductor"],
    persona: {
      tone: "a proud railway conductor who loves the rhythm of the rails",
      quirks: [
        "welcomes you aboard and asks your destination",
        "calls out the platform number with a flourish",
        "shares a small detail about the line to your stop",
      ],
    },
    silhouette: "train",
    ticketMotif: "train",
  },
  flight: {
    hallTitle: ["vignette.board.flight.title", "Airport"],
    vehicle: ["vignette.board.flight.vehicle", "the flight"],
    board: ["vignette.board.flight.board", "Departures"],
    clerkRole: ["vignette.board.flight.clerk", "the gate agent"],
    persona: {
      tone: "a warm, efficient airport gate agent who's flown everywhere",
      quirks: [
        "checks you in with a friendly smile and asks your destination",
        "mentions the gate and a short, sunny weather note for arrival",
        "wishes you a pleasant journey",
      ],
    },
    silhouette: "plane",
    ticketMotif: "plane",
  },
}

/** Self-contained demo destinations so each mode runs standalone. */
const DEMO: BoardingDestination[] = [
  { anchorId: "market", label: "the market", fare: 200, motif: "market" },
  { anchorId: "harbor", label: "the harbor", fare: 320, motif: "harbor" },
  { anchorId: "fountain", label: "the central plaza", fare: 160, motif: "fountain" },
]

const LOG = "[wp/vignette/boarding]"

export function createBoardingVignette(opts: BoardingOptions): Vignette {
  const skin = SKINS[opts.mode]
  let disposed = false
  let npc: VignetteNpcHandle | null = null
  let cleanup: Array<() => void> = []

  function enter(ctx: VignetteContext): Promise<VignetteResult> {
    ensureBoardingStyles()
    return new Promise<VignetteResult>((resolve) => {
      const { mountRoot, scene, learnerPair, reducedMotion } = ctx
      // Localize with an INLINE English fallback (the taxi convention): try the
      // resolver; if it returns the key unchanged (no LOCALE row / standalone), use
      // the fallback. Params interpolate `{name}` either way.
      const t = (key: string, fallback: string, params?: Record<string, string | number>): string => {
        let s = ctx.t(key, params)
        if (s === key || s == null || s === "") s = fallback
        if (params) s = s.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? `{${k}}`))
        return s
      }
      const accent = scene.palette?.accent ?? "#e8b54a"
      const vehicleNoun = t(skin.vehicle[0], skin.vehicle[1])
      const destinations =
        opts.destinations && opts.destinations.length ? opts.destinations : DEMO

      let settled = false
      const finish = (result: VignetteResult) => {
        if (settled) return
        settled = true
        npc?.dispose()
        npc = null
        resolve(result)
      }

      // Exit/ESC hook: leaving without boarding = NO_TRAVEL.
      registerRootHooks(mountRoot, {
        exit: () => finish(NO_TRAVEL),
        exitLabel: t("vignette.board.leave", "Leave"),
      })

      // ── scene scaffold ──────────────────────────────────────────────────────
      const hall = div(`wp-vig-board wp-vig-board--${opts.mode}`)
      mountRoot.appendChild(hall)

      // The hall window: a sky band + the mode vehicle silhouette parked at the gate.
      const win = div("wp-vig-board-window")
      win.appendChild(vehicleSilhouette(skin.silhouette, accent))
      hall.appendChild(win)

      // The concourse floor + a title plaque naming the place.
      const concourse = div("wp-vig-board-concourse")
      concourse.appendChild(textDiv("wp-vig-board-title", t(skin.hallTitle[0], skin.hallTitle[1])))
      hall.appendChild(concourse)

      // The clerk: a procedural paper-person billboard (reuse the driver art).
      const clerk = div("wp-vig-board-clerk")
      if (!reducedMotion) clerk.classList.add("wp-vig-board-clerk--sway")
      clerk.innerHTML = drawDriverBillboard(accent)
      hall.appendChild(clerk)

      // The conversation tray (the real Qwen3 clerk).
      const tray = div("wp-vig-board-tray")
      hall.appendChild(tray)

      npc = ctx.openNpc({
        container: tray,
        npcId: opts.clerkId ?? `${opts.mode}-clerk`,
        npcName: opts.clerkName ?? t(skin.clerkRole[0], skin.clerkRole[1]),
        persona: skin.persona,
        scriptedFallback: [
          t("vignette.board.fallback.greet", "Welcome! Where are you travelling today?"),
          t("vignette.board.fallback.help", "Just pick a destination and we'll get you there."),
          t("vignette.board.fallback.prompt", "Where can I send you?"),
        ],
        // The clerk speaks the TARGET language; the runtime picks a sticky voice.
        voiceCode: learnerPair.target,
        starterChips: [
          t("vignette.board.chip.where", "Where can I go?"),
          t("vignette.board.chip.ticket", "One ticket, please."),
        ],
        onClose: () => {
          /* closing chat doesn't exit — the Leave affordance does. */
        },
      })

      // ── the departures board (the purposeful beat) ─────────────────────────
      const boardWrap = div("wp-vig-board-departures")
      boardWrap.appendChild(textDiv("wp-vig-board-departures__head", t(skin.board[0], skin.board[1])))
      const list = div("wp-vig-board-departures__list")
      boardWrap.appendChild(list)
      hall.appendChild(boardWrap)
      for (const d of destinations) {
        const b = document.createElement("button")
        b.type = "button"
        b.className = "wp-vig-board-dest"
        const icon = ctx.iconRenderer.renderIcon(
          { family: "coin-round", palette: accent, finish: "metal", metal: "copper", motif: d.motif ?? skin.ticketMotif },
          { size: 20 },
        )
        const label = span(d.label, "wp-vig-board-dest__label")
        const fare = span(formatFare(d.fare), "wp-vig-board-dest__fare")
        b.append(icon, label, fare)
        b.addEventListener("click", () => void chooseDestination(d))
        list.appendChild(b)
      }

      async function chooseDestination(dest: BoardingDestination): Promise<void> {
        if (settled) return
        boardWrap.style.display = "none"

        // The clerk acknowledges in TARGET (TTS), then a quick challenge EARNS the
        // trip: say the place name back. Bind it to the destination so the drill
        // teaches the exact words.
        void ctx.speak(learnerPair.target, dest.label).catch((e) =>
          console.error(`${LOG} speak failed:`, e),
        )

        const chCtx: ChallengeContext = {
          language: learnerPair.target,
          nativeLanguage: learnerPair.native,
          mode: "solo",
        }
        let score = 1
        try {
          const res = await ctx.runChallenge({
            tool: "say-it-back",
            ctx: chCtx,
            container: mountRoot,
            npc: {
              name: opts.clerkName ?? t(skin.clerkRole[0], skin.clerkRole[1]),
              avatar: skin.silhouette === "plane" ? "✈" : skin.silhouette === "train" ? "🚆" : "🚌",
              line: t("vignette.board.challenge.line", "Say it: {dest} — and you're aboard!", {
                dest: dest.label,
              }),
            },
          })
          score = res.score
        } catch (e) {
          console.error(`${LOG} runChallenge failed:`, e)
        }
        if (settled) return
        await depart(dest, score)
      }

      // ── departure + arrival: pay the fare + reward + resolve travelTo ──────
      async function depart(dest: BoardingDestination, score: number): Promise<void> {
        // A brief "vehicle departs" beat (compositor-only; reduced-motion-safe → it
        // just resolves through). The window vehicle slides off + the hall dims.
        hall.classList.add("wp-vig-board--departing")

        // Pay the fare from the wallet; waive the shortfall (never a wall).
        const w = ctx.wallet()
        const currency = w.defaultCurrency()
        const owed = dest.fare
        const have = w.balance(currency)
        const charged = Math.min(owed, have)
        const paid = charged > 0 ? w.debit(currency, charged) : true
        const waived = owed - charged

        const xp = 8 + Math.round(score * 12)
        const rewards = { xp }
        try {
          ctx.grant(rewards)
        } catch (e) {
          console.error(`${LOG} grant failed:`, e)
        }

        // Let the departure beat play, then show the arrival card.
        const settleArrival = () => {
          if (settled) return
          const card = div("wp-vig-board-arrival")
          card.appendChild(
            textDiv(
              "wp-vig-board-arrival__head",
              t("vignette.board.arrived", "You've arrived!"),
            ),
          )
          card.appendChild(textDiv("wp-vig-board-arrival__sub", dest.label))

          const fareRow = div("wp-vig-board-arrival__fare")
          const fareCoin = ctx.iconRenderer.renderIcon(
            { family: "coin-round", palette: accent, finish: "metal", metal: "gold" },
            { size: 26 },
          )
          fareRow.append(
            fareCoin,
            span(
              waived > 0
                ? t("vignette.board.fare.waived", "{paid} (rest on us!)", { paid: formatFare(charged) })
                : formatFare(owed),
            ),
          )
          card.appendChild(fareRow)

          const btn = document.createElement("button")
          btn.type = "button"
          btn.className = "wp-vig-board-arrival__btn"
          btn.textContent = t("vignette.board.step-out", "Step out")
          btn.addEventListener("click", () => finish({ travelTo: dest.anchorId, rewards }))
          card.appendChild(btn)
          mountRoot.appendChild(card)

          playArrivalDing(reducedMotion)
          requestAnimationFrame(() => {
            card.classList.add("wp-vig-board-arrival--in")
            if (paid && charged > 0) fareRow.classList.add("wp-vig-board-arrival__fare--paid")
          })
          btn.focus({ preventScroll: true })
        }
        if (reducedMotion) settleArrival()
        else window.setTimeout(settleArrival, 900)
        void vehicleNoun // referenced for future TTS line; kept for clarity
      }

      cleanup.push(() => hall.remove())
    })
  }

  function formatFare(minor: number): string {
    return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2)
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    npc?.dispose()
    npc = null
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

/* ------------------------------------------------------------------ *
 * DOM + audio helpers (self-contained).
 * ------------------------------------------------------------------ */

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
function span(text: string, cls?: string): HTMLSpanElement {
  const s = document.createElement("span")
  if (cls) s.className = cls
  s.textContent = text
  return s
}

/** A flat vehicle silhouette parked in the hall window — a tiny inline SVG per mode. */
function vehicleSilhouette(kind: "bus" | "train" | "plane", accent: string): HTMLDivElement {
  const d = div(`wp-vig-board-vehicle wp-vig-board-vehicle--${kind}`)
  const body = "#15110d"
  let shape = ""
  if (kind === "bus") {
    shape =
      `<rect x="14" y="40" width="172" height="46" rx="10" fill="${body}"/>` +
      `<rect x="24" y="48" width="30" height="22" rx="3" fill="${accent}" opacity="0.85"/>` +
      `<rect x="62" y="48" width="30" height="22" rx="3" fill="${accent}" opacity="0.85"/>` +
      `<rect x="100" y="48" width="30" height="22" rx="3" fill="${accent}" opacity="0.85"/>` +
      `<rect x="138" y="48" width="30" height="22" rx="3" fill="${accent}" opacity="0.85"/>` +
      `<circle cx="48" cy="90" r="11" fill="${body}"/><circle cx="156" cy="90" r="11" fill="${body}"/>`
  } else if (kind === "train") {
    shape =
      `<rect x="10" y="36" width="120" height="50" rx="12" fill="${body}"/>` +
      `<rect x="130" y="44" width="60" height="42" rx="6" fill="${body}"/>` +
      `<rect x="22" y="46" width="22" height="20" rx="3" fill="${accent}" opacity="0.85"/>` +
      `<rect x="54" y="46" width="22" height="20" rx="3" fill="${accent}" opacity="0.85"/>` +
      `<rect x="86" y="46" width="22" height="20" rx="3" fill="${accent}" opacity="0.85"/>` +
      `<circle cx="40" cy="90" r="9" fill="${body}"/><circle cx="100" cy="90" r="9" fill="${body}"/><circle cx="160" cy="90" r="9" fill="${body}"/>`
  } else {
    shape =
      `<path d="M20 70 L150 60 L186 50 L150 72 L150 84 Z" fill="${body}"/>` +
      `<path d="M70 64 L96 30 L108 30 L92 66 Z" fill="${body}"/>` +
      `<path d="M70 70 L92 96 L104 96 L88 72 Z" fill="${body}"/>` +
      `<circle cx="150" cy="62" r="4" fill="${accent}"/><circle cx="120" cy="65" r="4" fill="${accent}"/>`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="110" viewBox="0 0 200 110">${shape}</svg>`
  d.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
  return d
}

/** The arrival ding — a short dignified two-note chime (no asset). RM-skipped. */
function playArrivalDing(reduced: boolean): void {
  if (reduced) return
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ac = new AudioCtx()
    const now = ac.currentTime
    const tone = (freq: number, at: number, dur: number) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + at)
      gain.gain.exponentialRampToValueAtTime(0.14, now + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur)
      osc.connect(gain).connect(ac.destination)
      osc.start(now + at)
      osc.stop(now + at + dur + 0.02)
    }
    tone(587, 0, 0.18) // D5
    tone(880, 0.12, 0.28) // A5 — a bright, friendly resolve
    window.setTimeout(() => void ac.close().catch(() => {}), 700)
  } catch (e) {
    console.error(`${LOG} arrival ding failed:`, e)
  }
}

/* ------------------------------------------------------------------ *
 * Scoped stylesheet (its OWN <style data-wp-vig-board> — never the shared sheet).
 * ------------------------------------------------------------------ */

let boardingStylesInjected = false
function ensureBoardingStyles(): void {
  if (boardingStylesInjected || typeof document === "undefined") return
  if (document.querySelector("style[data-wp-vig-board]")) {
    boardingStylesInjected = true
    return
  }
  boardingStylesInjected = true
  const style = document.createElement("style")
  style.setAttribute("data-wp-vig-board", "")
  style.textContent = BOARDING_CSS
  document.head.appendChild(style)
}

const BOARDING_CSS = `
.wp-vig-board {
  position: absolute; inset: 0; overflow: hidden;
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #cfe6ea 0%, #cfe6ea 38%, #e8ddc7 38%, #d8c9aa 100%);
  font: 400 15px/1.4 ui-sans-serif, system-ui, sans-serif;
}
.wp-vig-board-window {
  position: absolute; top: 6%; left: 50%; transform: translateX(-50%);
  width: min(72%, 520px); height: 30%;
  border-radius: 14px; overflow: hidden;
  background: linear-gradient(180deg, #bfe0e8, #e8f1e6);
  box-shadow: inset 0 0 0 6px rgba(255,255,255,0.5), 0 10px 30px rgba(30,50,60,0.18);
}
.wp-vig-board-vehicle {
  position: absolute; bottom: 6%; left: 50%; transform: translateX(-50%);
  width: 80%; height: 70%;
  background-repeat: no-repeat; background-position: center bottom; background-size: contain;
  transition: transform 0.85s cubic-bezier(0.5, 0, 0.7, 1), opacity 0.85s ease;
}
.wp-vig-board--departing .wp-vig-board-vehicle { transform: translateX(160%); opacity: 0; }
.wp-vig-board--departing .wp-vig-board-window { filter: brightness(0.82); }
.wp-vig-board-concourse {
  position: absolute; bottom: 0; left: 0; right: 0; height: 56%;
}
.wp-vig-board-title {
  position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  font: 800 clamp(16px, 2.4vw, 24px)/1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.04em; color: #2a3a4d; text-transform: uppercase;
  background: rgba(255,255,255,0.92); padding: 8px 18px; border-radius: 10px;
  box-shadow: 0 6px 16px rgba(20,50,63,0.18);
}
.wp-vig-board-clerk {
  position: absolute; bottom: 30%; left: 14%;
  width: clamp(120px, 22vw, 200px); aspect-ratio: 3 / 5;
  filter: drop-shadow(0 12px 10px rgba(0,0,0,0.25));
}
.wp-vig-board-clerk svg { width: 100%; height: 100%; }
.wp-vig-board-clerk--sway { animation: wp-vig-board-sway 3.4s ease-in-out infinite alternate; transform-origin: 50% 100%; }
@keyframes wp-vig-board-sway { from { transform: rotate(-1.4deg); } to { transform: rotate(1.4deg); } }
.wp-vig-board-departures {
  position: absolute; right: 4%; bottom: 24%;
  width: min(46%, 360px);
  background: rgba(18, 24, 32, 0.92); color: #eaf2f6;
  border-radius: 14px; padding: 12px; box-shadow: 0 12px 30px rgba(0,0,0,0.35);
}
.wp-vig-board-departures__head {
  font: 800 13px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.14em;
  text-transform: uppercase; color: #ffd98a; margin-bottom: 8px; text-align: center;
}
.wp-vig-board-departures__list { display: flex; flex-direction: column; gap: 7px; }
.wp-vig-board-dest {
  display: flex; align-items: center; gap: 10px;
  min-height: 46px; padding: 8px 12px; border: none; border-radius: 10px;
  background: rgba(255,255,255,0.08); color: #eaf2f6;
  font: 600 15px/1.1 ui-sans-serif, system-ui, sans-serif; text-align: left;
  cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.wp-vig-board-dest:active { transform: scale(0.98); }
.wp-vig-board-dest__label { flex: 1; }
.wp-vig-board-dest__fare { opacity: 0.85; font-variant-numeric: tabular-nums; }
@media (hover: hover) and (pointer: fine) {
  .wp-vig-board-dest { transition: background 0.14s ease, transform 0.1s ease; }
  .wp-vig-board-dest:hover { background: rgba(255,255,255,0.16); }
}
.wp-vig-board-tray { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; }
.wp-vig-board-arrival {
  position: absolute; inset: 0; z-index: 20;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  background: rgba(12, 18, 24, 0.62); backdrop-filter: blur(2px);
  opacity: 0; transition: opacity 0.3s ease;
}
.wp-vig-board-arrival--in { opacity: 1; }
.wp-vig-board-arrival__head { font: 800 clamp(22px,4vw,34px)/1 ui-sans-serif, system-ui, sans-serif; color: #fff; }
.wp-vig-board-arrival__sub { font: 600 clamp(15px,2vw,18px)/1 ui-sans-serif, system-ui, sans-serif; color: #ffd98a; }
.wp-vig-board-arrival__fare {
  display: inline-flex; align-items: center; gap: 8px; color: #fff;
  font: 700 18px/1 ui-sans-serif, system-ui, sans-serif;
  opacity: 0.7; transition: transform 0.25s ease, opacity 0.25s ease;
}
.wp-vig-board-arrival__fare--paid { transform: scale(1.12); opacity: 1; }
.wp-vig-board-arrival__btn {
  min-height: 50px; padding: 13px 34px; border: none; border-radius: 999px;
  background: linear-gradient(180deg, #8fc6e6, #4f86b6); color: #0f2433;
  font: 700 17px/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer;
  box-shadow: 0 8px 22px rgba(30,80,120,0.45), inset 0 1px 0 rgba(255,255,255,0.6);
}
.wp-vig-board-arrival__btn:active { transform: scale(0.96); }
@media (prefers-reduced-motion: reduce) {
  .wp-vig-board-clerk--sway, .wp-vig-board-vehicle, .wp-vig-board-arrival { animation: none; transition: none; }
}
`
