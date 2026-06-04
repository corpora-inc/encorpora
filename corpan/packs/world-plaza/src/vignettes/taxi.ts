/**
 * The taxi back-seat vignette — the reference enterable sub-experience.
 *
 *   "I can't wait to be sitting in the back seat talking to the taxi driver."
 *
 * You ENTER from a taxi rank in the city and find yourself in the back seat: the
 * driver is a 2D paper-person billboard seen from behind/side (HD-2D discipline —
 * never paper-thin: an idle sway, a drop shadow), the city slides past the window
 * as two parallax skyline strips, a seatbelt crosses your POV and the dashboard
 * rises from the bottom. A meter ticks in the corner. You TALK to the driver in
 * the TARGET language via the real Qwen3 NPC runtime (small talk + "where to?").
 *
 * The purposeful beat: pick a destination. That fires a short challenge (say the
 * place name back / listen-choose) so you EARN the trip with the target language;
 * then the taxi pulls up, the fare is paid from your wallet with a coin-pop, and
 * the vignette resolves `{ travelTo: <anchor> , rewards }` so the city re-spawns
 * you at that landmark. If you just chat and leave (the door / Exit), it resolves
 * with no travel — dignified, no dark pattern forcing the ride.
 *
 * This is ALSO the v2 template: a self-contained scene built ONLY from the
 * injected `VignetteContext` services. Swap the framing + persona + destinations
 * and you have a bus, a café interior, a fantasy tavern — same seam.
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

const LOG = "[wp/vignette/taxi]"

/**
 * One place the taxi can take you. `anchorId` is the TOPOLOGY anchor the city
 * re-spawns the player at on arrival; `label` is the friendly target-language
 * name spoken/shown; `fare` is the cost in MINOR units of the Track's default
 * currency; `motif` tints the destination's icon. The orchestrator injects real
 * topology anchors; the standalone default uses generic landmarks.
 */
export interface TaxiDestination {
  anchorId: string
  label: string
  fare: number
  /** icon motif hint for the procedural icon ("castle","cathedral","market"…). */
  motif?: string
}

/** What the orchestrator may inject when registering the taxi. */
export interface TaxiOptions {
  /**
   * The destinations offered, resolved from the live topology + scene by the
   * orchestrator (anchor id → label/fare). Omit ⇒ a self-contained demo set so
   * the vignette is fully playable standalone.
   */
  destinations?: TaxiDestination[]
  /** A stable id + display name for the driver NPC (drives the sticky voice). */
  driverId?: string
  driverName?: string
}

/**
 * A small, self-contained set of destinations so the taxi runs standalone with
 * no orchestrator. The `anchorId`s are conventional landmark ids; at integration
 * the orchestrator overrides these with REAL topology anchors.
 */
const DEMO_DESTINATIONS: TaxiDestination[] = [
  { anchorId: "fountain", label: "the central fountain", fare: 120, motif: "fountain" },
  { anchorId: "market", label: "the market", fare: 180, motif: "market" },
  { anchorId: "cathedral", label: "the old cathedral", fare: 240, motif: "cathedral" },
]

export function createTaxiVignette(opts: TaxiOptions = {}): Vignette {
  let disposed = false
  let npc: VignetteNpcHandle | null = null
  let cleanup: Array<() => void> = []

  function enter(ctx: VignetteContext): Promise<VignetteResult> {
    return new Promise<VignetteResult>((resolve) => {
      const { mountRoot, scene, learnerPair, reducedMotion } = ctx
      // Localize with an INLINE English fallback (the badgeStrings convention,
      // self-contained): try the real resolver; if it returns the key unchanged
      // (no LOCALE row yet / standalone), use the `fallback`. Params interpolate
      // `{name}` placeholders either way, so production strings stay dignified and
      // standalone never shows a raw key.
      const t = (key: string, fallback: string, params?: Record<string, string | number>): string => {
        let s = ctx.t(key, params)
        if (s === key || s == null || s === "") s = fallback
        if (params) s = s.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? `{${k}}`))
        return s
      }
      const accent = scene.palette?.accent ?? "#e8b54a"
      const targetVoice = scene.npcSkins?.[opts.driverId ?? "taxi-driver"]?.voiceHint
      const destinations =
        opts.destinations && opts.destinations.length ? opts.destinations : DEMO_DESTINATIONS

      // The single resolve guard — door / Exit / arrival all settle exactly once.
      let settled = false
      const finish = (result: VignetteResult) => {
        if (settled) return
        settled = true
        npc?.dispose()
        npc = null
        resolve(result)
      }

      // Register the framework Exit/ESC hook: leaving without a ride = NO_TRAVEL.
      registerRootHooks(mountRoot, {
        exit: () => finish(NO_TRAVEL),
        exitLabel: t("vignette.taxi.leave", "Get out"),
      })

      // ── scene scaffold ──────────────────────────────────────────────────────
      const taxi = div("wp-vig-taxi")
      mountRoot.appendChild(taxi)

      // The window + parallax city (two skyline strips at different speeds).
      const win = div("wp-vig-taxi-window")
      win.appendChild(parallaxStrip("far", accent))
      win.appendChild(parallaxStrip("near", accent))
      taxi.appendChild(win)

      // Cabin framing: door pillar (::before), seatbelt, dashboard.
      const cabin = div("wp-vig-taxi-cabin")
      cabin.appendChild(div("wp-vig-taxi-belt"))
      cabin.appendChild(div("wp-vig-taxi-dash"))
      taxi.appendChild(cabin)

      // The driver: a procedural paper-person billboard, from behind.
      const driver = div("wp-vig-taxi-driver")
      if (!reducedMotion) driver.classList.add("wp-vig-taxi-driver--sway")
      driver.innerHTML = drawDriverBillboard(accent)
      taxi.appendChild(driver)

      // The meter HUD (fare placeholder until a destination is chosen).
      const meter = div("wp-vig-taxi-meter")
      meter.appendChild(textDiv("wp-vig-taxi-meter__label", t("vignette.taxi.meter", "Meter")))
      const meterFare = div("wp-vig-taxi-meter__fare")
      const meterCoin = ctx.iconRenderer.renderIcon(
        { family: "coin-round", palette: accent, finish: "metal", metal: "gold" },
        { size: 22 },
      )
      meterFare.append(meterCoin, span("—"))
      meter.appendChild(meterFare)
      const meterDest = textDiv("wp-vig-taxi-meter__dest", t("vignette.taxi.idle", "Where to?"))
      meter.appendChild(meterDest)
      taxi.appendChild(meter)

      // ── the conversation tray (the real Qwen3 driver) ──────────────────────
      const tray = div("wp-vig-taxi-tray")
      taxi.appendChild(tray)

      npc = ctx.openNpc({
        container: tray,
        npcId: opts.driverId ?? "taxi-driver",
        npcName: opts.driverName ?? t("vignette.taxi.driver", "the taxi driver"),
        persona: {
          tone: "a warm, talkative city taxi driver who loves their town",
          quirks: [
            "makes friendly small talk about the weather and the neighborhood",
            "asks where you're headed",
            "shares one tiny local tip about the destination",
          ],
        },
        scriptedFallback: [
          t("vignette.taxi.fallback.greet", "Welcome aboard! Where can I take you today?"),
          t("vignette.taxi.fallback.smalltalk", "Lovely day for a drive, isn't it?"),
          t("vignette.taxi.fallback.prompt", "Just tell me where, and we'll be off."),
        ],
        voiceCode: targetVoice,
        starterChips: [
          t("vignette.taxi.chip.where", "Where to?"),
          t("vignette.taxi.chip.weather", "Nice weather today."),
        ],
        // Closing the chat does NOT exit the vignette — the door/Exit does.
        onClose: () => {
          /* the player can re-open by tapping the driver; tray stays. */
        },
      })

      // ── the destination picker (the purposeful beat) ───────────────────────
      const dests = div("wp-vig-taxi-dests")
      taxi.appendChild(dests)
      for (const d of destinations) {
        const b = document.createElement("button")
        b.type = "button"
        b.className = "wp-vig-taxi-dest"
        const icon = ctx.iconRenderer.renderIcon(
          { family: "coin-round", palette: accent, finish: "metal", metal: "copper", motif: d.motif },
          { size: 20 },
        )
        const label = span(d.label)
        const fare = span(formatFare(d.fare), "wp-vig-taxi-dest__fare")
        b.append(icon, label, fare)
        b.addEventListener("click", () => void chooseDestination(d))
        dests.appendChild(b)
      }

      // Pre-render the destination-chosen flow.
      async function chooseDestination(dest: TaxiDestination): Promise<void> {
        if (settled) return
        dests.style.display = "none"
        meterDest.textContent = dest.label
        meterFare.replaceChildren(meterCoin.cloneNode(true), span(formatFare(dest.fare)))

        // The driver acknowledges in TARGET language (TTS), then a quick challenge
        // EARNS the trip: say the place name back. Bind it to the destination so
        // the drill teaches the exact words ("la catedral").
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
              name: opts.driverName ?? t("vignette.taxi.driver", "the taxi driver"),
              avatar: "🚕",
              line: t("vignette.taxi.challenge.line", "Say it: {dest} — and we're off!", {
                dest: dest.label,
              }),
            },
          })
          score = res.score
        } catch (e) {
          console.error(`${LOG} runChallenge failed:`, e)
        }
        if (settled) return
        await arrive(dest, score)
      }

      // ── arrival: pay the fare + reward + resolve travelTo ──────────────────
      async function arrive(dest: TaxiDestination, score: number): Promise<void> {
        // Pay the fare from the wallet (physical money). If the player can't
        // afford it, the driver waives the difference — dignified, never a wall.
        const w = ctx.wallet()
        const currency = w.defaultCurrency()
        const owed = dest.fare
        const have = w.balance(currency)
        const charged = Math.min(owed, have)
        const paid = charged > 0 ? w.debit(currency, charged) : true
        const waived = owed - charged

        // A reward for completing the trip (scaled by the challenge score) — the
        // SAME applyReward path a challenge win uses, so the HUD reveal/badges fire.
        const xp = 8 + Math.round(score * 12)
        const rewards = { xp }
        try {
          ctx.grant(rewards)
        } catch (e) {
          console.error(`${LOG} grant failed:`, e)
        }

        // The arrival card (the payoff). A ding + a fare-paid coin pop.
        const card = div("wp-vig-taxi-arrival")
        card.appendChild(
          textDiv("wp-vig-taxi-arrival__landmark", t("vignette.taxi.arrived", "We've arrived!")),
        )
        card.appendChild(textDiv("wp-vig-taxi-arrival__sub", dest.label))

        const fareRow = div("wp-vig-taxi-arrival__fare")
        const fareCoin = ctx.iconRenderer.renderIcon(
          { family: "coin-round", palette: accent, finish: "metal", metal: "gold" },
          { size: 26 },
        )
        fareRow.append(
          fareCoin,
          span(
            waived > 0
              ? t("vignette.taxi.fare.waived", "{paid} (rest on me!)", { paid: formatFare(charged) })
              : formatFare(owed),
          ),
        )
        card.appendChild(fareRow)

        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "wp-vig-taxi-arrival__btn"
        btn.textContent = t("vignette.taxi.step-out", "Step out")
        btn.addEventListener("click", () =>
          finish({ travelTo: dest.anchorId, rewards }),
        )
        card.appendChild(btn)
        mountRoot.appendChild(card)

        // ding + coin pop on the next frame (compositor-only; reduced-motion safe).
        playArrivalDing(reducedMotion)
        requestAnimationFrame(() => {
          card.classList.add("wp-vig-taxi-arrival--in")
          if (paid && charged > 0) fareRow.classList.add("wp-vig-taxi-arrival__fare--paid")
        })
        btn.focus({ preventScroll: true })
      }

      cleanup.push(() => taxi.remove())
    })
  }

  /** Format minor units as a fare ("1.20", "180"). Currency-agnostic + compact. */
  function formatFare(minor: number): string {
    // Most Track currencies are 2-decimal (real/dollar); a few are 0-decimal
    // (yen/won). We show 2 decimals only when there's a fractional part, so it
    // reads naturally either way without importing the currency table here.
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
 * Small DOM + audio helpers (self-contained — no shared-CSS dependency).
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

/** A scrolling skyline strip drawn as a repeating SVG silhouette data-URL. */
function parallaxStrip(layer: "far" | "near", accent: string): HTMLDivElement {
  const d = div(`wp-vig-taxi-parallax wp-vig-taxi-parallax--${layer}`)
  d.style.backgroundImage = `url("${skylineDataUrl(layer, accent)}")`
  d.style.backgroundSize = "auto 100%"
  return d
}

/** A tiny repeating skyline silhouette (buildings of varied heights), as a data-URL. */
function skylineDataUrl(layer: "far" | "near", accent: string): string {
  const h = 120
  const w = 360
  const base = layer === "far" ? "#2c3a4d" : "#15110d"
  // Deterministic block skyline — different rhythm per layer.
  const seed = layer === "far" ? 3 : 7
  let x = 0
  const rects: string[] = []
  let i = 0
  while (x < w) {
    const bw = 18 + ((seed * (i + 1) * 13) % 26)
    const bh = 30 + ((seed * (i + 2) * 17) % (h - 36))
    rects.push(`<rect x="${x}" y="${h - bh}" width="${bw - 3}" height="${bh}" fill="${base}"/>`)
    // a couple of lit windows for the near layer (warm dots)
    if (layer === "near" && i % 2 === 0) {
      rects.push(
        `<rect x="${x + 4}" y="${h - bh + 8}" width="3" height="3" fill="${accent}" opacity="0.8"/>`,
      )
    }
    x += bw
    i++
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${rects.join("")}</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/**
 * The arrival ding — a short, dignified two-note chime via WebAudio (no asset
 * dependency, no shared juice import). Skipped under reduced-motion (which also
 * tends to pair with reduced-audio preferences) and degrades silently if
 * WebAudio is unavailable or blocked.
 */
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
    tone(660, 0, 0.18) // E5
    tone(880, 0.12, 0.26) // A5 — a bright, friendly resolve
    window.setTimeout(() => void ac.close().catch(() => {}), 700)
  } catch (e) {
    console.error(`${LOG} arrival ding failed:`, e)
  }
}
