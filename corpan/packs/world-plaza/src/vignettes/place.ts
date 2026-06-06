/**
 * place.ts — the ENTERABLE PLACE-INTERIOR vignette (the walk-in-a-building seam).
 *
 *   You walk up to a placed building (the corner café), a door affordance rises,
 *   you ENTER → you're INSIDE a warm interior scene → a resident NPC (the barista)
 *   greets you in the target language via the real Qwen3 runtime → you do the thing
 *   the place is FOR (order a coffee → a quick challenge EARNS it) → you leave back
 *   to town.
 *
 * It is the taxi's / boarding hall's sibling on the SAME `Vignette` seam — but for
 * a static building you step INTO, not a vehicle. It is DELIBERATELY perf-zero:
 * the interior is a flat layered DOM/CSS backdrop (an overlay scene, like
 * boarding.ts), NOT a new always-rendered 3D room — so entering a building adds
 * ZERO persistent draw calls / world geometry and can never regress the 60 FPS
 * the world holds. (The "real building" is the city facade you walk up to; the
 * interior is the overlay you see once inside.)
 *
 * Distinct from the economy `shopVignette` (which is a COMMERCE surface — shelves +
 * a buy/sell overlay). This is the place-as-experience: the café is where the
 * café-order quest objective plays out. A place can optionally hand off to the
 * economy ("browse the shelves") via the injected `onShop` callback, so a shop
 * interior can be both a place AND a store without this module importing economy.
 *
 * HD-2D discipline: the keeper is a 2D paper-person billboard (idle sway + drop
 * shadow, never paper-thin); the room is a flat layered backdrop (wall + counter +
 * a warm window). Self-contained: its OWN scoped `<style data-wp-vig-place>`
 * (never the shared sheet — other agents live there), all DOM/audio inline.
 */

import type {
  Vignette,
  VignetteContext,
  VignetteNpcHandle,
  VignetteResult,
} from "./types"
import { NO_TRAVEL } from "./types"
import { registerRootHooks } from "./host"
import type { ChallengeContext } from "@world-plaza/contracts"

/** The place SKINS this vignette can dress. `cafe` is the shipped hero; the shop
 *  skins let a real shop building reuse the place framing + hand off to commerce. */
export type PlaceKind = "cafe" | "shop"

/** A purposeful ACTION the place offers as its primary button. */
export interface PlaceObjective {
  /** Localized button label key + inline English fallback (e.g. "Order a coffee"). */
  label: [string, string]
  /** The challenge tool the action runs (mic-free `translate-fast` by default so
   *  the core café beat is tappable on any device — the mic-gate lesson). */
  tool?: string
  /** Quest step id to resolve on a successful action (the city advances the quest). */
  questStep?: string
  /** Reward granted on success (xp + items). */
  reward?: { xp?: number; items?: string[] }
}

/** What the orchestrator injects when registering a place vignette. */
export interface PlaceOptions {
  kind: PlaceKind
  /** i18n key fragment that namespaces this place's copy (e.g. "cafe"). */
  copyKey: string
  /** Inline English fallbacks (used standalone / when a locale row is missing). */
  fallback: {
    sign: string
    title: string
    sub: string
    keeper: string
    greet: string[]
  }
  /** Stable id + display name for the resident NPC (drives the sticky voice). */
  keeperId?: string
  keeperName?: string
  /** The persona the orchestrator weaves into the NPC system prompt. */
  persona: { tone: string; quirks: string[] }
  /** The primary purposeful action (café → order). Omit ⇒ a pure look-around place. */
  objective?: PlaceObjective
  /** Optional commerce handoff — a shop interior calls this to open the store. */
  onShop?: (container: HTMLElement) => void
  /** Localized "browse the shop" button label key + fallback (when `onShop` set). */
  shopLabel?: [string, string]
}

const LOG = "[wp/vignette/place]"

export function createPlaceVignette(opts: PlaceOptions): Vignette {
  let disposed = false
  let npc: VignetteNpcHandle | null = null
  let cleanup: Array<() => void> = []

  function enter(ctx: VignetteContext): Promise<VignetteResult> {
    ensurePlaceStyles()
    return new Promise<VignetteResult>((resolve) => {
      const { mountRoot, scene, learnerPair, reducedMotion } = ctx
      // Inline-fallback localization (the taxi/shop convention).
      const t = (key: string, fallback: string, params?: Record<string, string | number>): string => {
        let s = ctx.t(key, params)
        if (s === key || s == null || s === "") s = fallback
        if (params) s = s.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? `{${k}}`))
        return s
      }
      const k = opts.copyKey
      const accent = scene.palette?.accent ?? "#e8b54a"

      let settled = false
      const finish = (result: VignetteResult) => {
        if (settled) return
        settled = true
        npc?.dispose()
        npc = null
        resolve(result)
      }

      // Leaving = step back outside (no travel). A satisfied objective resolves on
      // its own button, so Exit/ESC is always a clean "I just looked around" leave.
      registerRootHooks(mountRoot, {
        exit: () => finish(NO_TRAVEL),
        exitLabel: t(`vignette.place.${k}.leave`, "Step outside"),
      })

      // ── interior scaffold ─────────────────────────────────────────────────────
      const room = div(`wp-vig-place wp-vig-place--${opts.kind}`)
      room.style.setProperty("--wp-place-accent", accent)
      mountRoot.appendChild(room)

      // back wall: a warm window + (café) a chalkboard menu / (shop) a hanging sign.
      const wall = div("wp-vig-place-wall")
      wall.appendChild(div("wp-vig-place-window"))
      const board = div("wp-vig-place-board")
      board.appendChild(textDiv("wp-vig-place-board__title", t(`vignette.place.${k}.sign`, opts.fallback.sign)))
      // a few faux menu/price lines for warmth (purely decorative — no copy to localize)
      for (let i = 0; i < 3; i++) board.appendChild(div("wp-vig-place-board__line"))
      wall.appendChild(board)
      room.appendChild(wall)

      // the counter + a couple of steaming cups (café) for life; the keeper billboard.
      const counter = div("wp-vig-place-counter")
      if (opts.kind === "cafe") {
        for (let i = 0; i < 2; i++) {
          const cup = div("wp-vig-place-cup")
          if (!reducedMotion) cup.appendChild(div("wp-vig-place-steam"))
          counter.appendChild(cup)
        }
      }
      const keeper = div("wp-vig-place-keeper")
      if (!reducedMotion) keeper.classList.add("wp-vig-place-keeper--sway")
      keeper.innerHTML = keeperBillboard(accent, opts.kind)
      room.appendChild(keeper)
      room.appendChild(counter)

      // header card naming the place.
      const header = div("wp-vig-place-header")
      header.appendChild(textDiv("wp-vig-place-header__title", t(`vignette.place.${k}.title`, opts.fallback.title)))
      header.appendChild(textDiv("wp-vig-place-header__sub", t(`vignette.place.${k}.sub`, opts.fallback.sub)))
      room.appendChild(header)

      // ── the resident NPC (real Qwen3 — the café's barista is the objective NPC) ─
      const tray = div("wp-vig-place-tray")
      room.appendChild(tray)
      npc = ctx.openNpc({
        container: tray,
        npcId: opts.keeperId ?? `place-${opts.copyKey}`,
        npcName: opts.keeperName ?? t(`vignette.place.${k}.keeper`, opts.fallback.keeper),
        persona: opts.persona,
        scriptedFallback: opts.fallback.greet.map((g, i) =>
          t(`vignette.place.${k}.fallback.${i}`, g),
        ),
        // The keeper speaks the TARGET language; the runtime picks a sticky voice.
        voiceCode: learnerPair.target,
        starterChips: [
          t(`vignette.place.${k}.chip.0`, "Hello!"),
          t(`vignette.place.${k}.chip.1`, "What do you have?"),
        ],
        onClose: () => {
          /* closing chat doesn't exit — the Leave affordance does. */
        },
      })

      // ── action buttons ────────────────────────────────────────────────────────
      const actions = div("wp-vig-place-actions")

      // PRIMARY purposeful action (café → order a coffee). It runs a tappable,
      // mic-free challenge by default so the core café beat is winnable on ANY
      // device (the mic-gate lesson), then resolves `{ questStep }` so the city
      // advances the café-order quest — this is where that objective plays out.
      if (opts.objective) {
        const obj = opts.objective
        const order = btnEl("wp-vig-place-btn wp-vig-place-btn--primary", t(obj.label[0], obj.label[1]))
        order.addEventListener("click", () => void runObjective(obj, order))
        actions.appendChild(order)
      }

      // optional COMMERCE handoff (a shop interior → open the store overlay).
      if (opts.onShop && opts.shopLabel) {
        const browse = btnEl("wp-vig-place-btn wp-vig-place-btn--shop", t(opts.shopLabel[0], opts.shopLabel[1]))
        browse.addEventListener("click", () => {
          try {
            opts.onShop?.(mountRoot)
          } catch (e) {
            console.error(`${LOG} onShop threw:`, e)
          }
        })
        actions.appendChild(browse)
      }
      room.appendChild(actions)

      async function runObjective(obj: PlaceObjective, button: HTMLButtonElement): Promise<void> {
        if (settled) return
        button.disabled = true
        const chCtx: ChallengeContext = {
          language: learnerPair.target,
          nativeLanguage: learnerPair.native,
          mode: "solo",
        }
        let score = 1
        try {
          const res = await ctx.runChallenge({
            tool: obj.tool ?? "translate-fast",
            ctx: chCtx,
            container: mountRoot,
            npc: {
              name: opts.keeperName ?? t(`vignette.place.${k}.keeper`, opts.fallback.keeper),
              avatar: "",
              line: t(`vignette.place.${k}.order.line`, "Go on — place your order."),
            },
          })
          score = res.score
        } catch (e) {
          console.error(`${LOG} runChallenge failed:`, e)
        }
        if (settled) return
        // Pay out + resolve. A genuine attempt (any score) completes the visit; the
        // city toasts the reward + advances the quest step. (Dignified — no fail wall
        // on a café order; the learning happened in the drill.)
        const reward = obj.reward ?? { xp: 10 }
        try {
          ctx.grant(reward)
        } catch (e) {
          console.error(`${LOG} grant failed:`, e)
        }
        playServeDing(reducedMotion)
        finish({ rewards: reward, questStep: obj.questStep })
        void score
      }

      cleanup.push(() => room.remove())

      if (!reducedMotion) requestAnimationFrame(() => room.classList.add("wp-vig-place--in"))
      else room.classList.add("wp-vig-place--in")
    })
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
 * DOM + audio + art helpers (self-contained).
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
function btnEl(cls: string, text: string): HTMLButtonElement {
  const b = document.createElement("button")
  b.type = "button"
  b.className = cls
  b.textContent = text
  return b
}

/** A front-facing 2D paper-person keeper (barista / shopkeeper) — an apron + a
 *  warm face, the accent on the apron band. Returns an SVG string (innerHTML). */
function keeperBillboard(accent: string, kind: PlaceKind): string {
  const skin = "#c9a07a"
  const skinShade = "#a9805d"
  const shirt = kind === "cafe" ? "#5b4636" : "#3b4a5a"
  const apron = kind === "cafe" ? "#efe6d4" : "#cdd6df"
  const hair = "#2b2117"
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 170" preserveAspectRatio="xMidYMax meet">
  <defs>
    <radialGradient id="vigPlaceRim" cx="0.6" cy="0.2" r="0.9">
      <stop offset="0" stop-color="#ffe7b8" stop-opacity="0.5"/>
      <stop offset="0.55" stop-color="#ffe7b8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <!-- shoulders / torso -->
  <path d="M22 170 L22 96 Q22 78 44 74 L76 74 Q98 78 98 96 L98 170 Z" fill="${shirt}"/>
  <!-- apron -->
  <path d="M44 96 L76 96 L82 170 L38 170 Z" fill="${apron}"/>
  <rect x="38" y="112" width="44" height="7" rx="3" fill="${accent}"/>
  <!-- neck -->
  <rect x="52" y="62" width="16" height="18" rx="6" fill="${skinShade}"/>
  <!-- head -->
  <circle cx="60" cy="46" r="22" fill="${skin}"/>
  <path d="M38 44 Q40 22 60 22 Q80 22 82 44 Q74 34 60 34 Q46 34 38 44 Z" fill="${hair}"/>
  <!-- friendly eyes + a small smile -->
  <circle cx="51" cy="46" r="2.6" fill="#2b2117"/>
  <circle cx="69" cy="46" r="2.6" fill="#2b2117"/>
  <path d="M52 55 Q60 61 68 55" stroke="#7a4a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="60" cy="40" rx="60" ry="44" fill="url(#vigPlaceRim)"/>
</svg>`
}

/** A short, dignified "served!" two-note chime (no asset). RM-skipped. */
function playServeDing(reduced: boolean): void {
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
      gain.gain.exponentialRampToValueAtTime(0.12, now + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur)
      osc.connect(gain).connect(ac.destination)
      osc.start(now + at)
      osc.stop(now + at + dur + 0.02)
    }
    tone(659, 0, 0.16) // E5
    tone(988, 0.1, 0.26) // B5 — a warm, friendly resolve
    window.setTimeout(() => void ac.close().catch(() => {}), 650)
  } catch (e) {
    console.error(`${LOG} serve ding failed:`, e)
  }
}

/* ------------------------------------------------------------------ *
 * Scoped stylesheet (its OWN <style data-wp-vig-place> — never the shared sheet).
 * ------------------------------------------------------------------ */

let placeStylesInjected = false
function ensurePlaceStyles(): void {
  if (placeStylesInjected || typeof document === "undefined") return
  if (document.querySelector("style[data-wp-vig-place]")) {
    placeStylesInjected = true
    return
  }
  placeStylesInjected = true
  const style = document.createElement("style")
  style.setAttribute("data-wp-vig-place", "")
  style.textContent = PLACE_CSS
  document.head.appendChild(style)
}

const PLACE_CSS = `
.wp-vig-place {
  position: absolute; inset: 0; overflow: hidden;
  display: block;
  font: 400 15px/1.4 ui-sans-serif, system-ui, sans-serif;
  opacity: 0; transition: opacity 0.34s ease;
  /* a warm café interior: amber walls fading to a wood floor. */
  background: linear-gradient(180deg, #6e4a2f 0%, #835a39 44%, #5a3c25 44%, #43301e 100%);
}
.wp-vig-place--shop {
  background: linear-gradient(180deg, #46505c 0%, #58636f 44%, #3c4530 44%, #2e3526 100%);
}
.wp-vig-place--in { opacity: 1; }
.wp-vig-place-wall {
  position: absolute; top: 0; left: 0; right: 0; height: 44%;
}
.wp-vig-place-window {
  position: absolute; top: 12%; left: 8%; width: 30%; height: 56%;
  border-radius: 10px;
  background: linear-gradient(180deg, #ffd99a, #ffbf6e);
  box-shadow: inset 0 0 0 6px rgba(70,46,28,0.6), 0 10px 26px rgba(0,0,0,0.28);
}
.wp-vig-place-board {
  position: absolute; top: 12%; right: 8%; width: 40%; height: 60%;
  border-radius: 8px; padding: 12px 16px;
  background: #20170f; box-shadow: 0 8px 20px rgba(0,0,0,0.35), inset 0 0 0 5px #34261a;
  color: #f0e3c8;
}
.wp-vig-place-board__title {
  font: 800 clamp(15px, 2.2vw, 22px)/1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.06em; color: var(--wp-place-accent, #e8b54a); text-transform: uppercase;
  margin-bottom: 12px;
}
.wp-vig-place-board__line {
  height: 8px; margin: 10px 0; border-radius: 4px;
  background: rgba(240,227,200,0.32);
}
.wp-vig-place-board__line:nth-child(2) { width: 82%; }
.wp-vig-place-board__line:nth-child(3) { width: 64%; }
.wp-vig-place-board__line:nth-child(4) { width: 73%; }
.wp-vig-place-counter {
  position: absolute; left: 0; right: 0; bottom: 24%; height: 14%;
  background: linear-gradient(180deg, #7a5230, #5e3f24);
  box-shadow: 0 -3px 0 rgba(255,255,255,0.08), 0 8px 18px rgba(0,0,0,0.3);
}
.wp-vig-place--shop .wp-vig-place-counter { background: linear-gradient(180deg, #5a6470, #444d57); }
.wp-vig-place-cup {
  position: absolute; bottom: 70%; width: 22px; height: 18px; border-radius: 3px 3px 6px 6px;
  background: #f3ece0; box-shadow: 0 2px 3px rgba(0,0,0,0.3);
}
.wp-vig-place-cup:nth-of-type(1) { right: 22%; }
.wp-vig-place-cup:nth-of-type(2) { right: 30%; }
.wp-vig-place-steam {
  position: absolute; left: 50%; bottom: 100%; width: 5px; height: 22px;
  transform: translateX(-50%);
  background: linear-gradient(0deg, rgba(255,255,255,0.5), rgba(255,255,255,0));
  border-radius: 4px; filter: blur(1px);
  animation: wp-vig-place-steam 2.4s ease-in-out infinite;
}
@keyframes wp-vig-place-steam {
  0% { opacity: 0; transform: translateX(-50%) translateY(4px) scaleX(0.8); }
  40% { opacity: 0.7; }
  100% { opacity: 0; transform: translateX(-50%) translateY(-8px) scaleX(1.3); }
}
.wp-vig-place-keeper {
  position: absolute; bottom: 28%; left: 50%; transform: translateX(-50%);
  width: clamp(130px, 24vw, 210px); aspect-ratio: 12 / 17;
  filter: drop-shadow(0 12px 10px rgba(0,0,0,0.32));
  z-index: 2;
}
.wp-vig-place-keeper svg { width: 100%; height: 100%; }
.wp-vig-place-keeper--sway { animation: wp-vig-place-sway 3.6s ease-in-out infinite alternate; transform-origin: 50% 100%; }
@keyframes wp-vig-place-sway { from { transform: translateX(-50%) rotate(-1.2deg); } to { transform: translateX(-50%) rotate(1.2deg); } }
.wp-vig-place-header {
  position: absolute; top: calc(env(safe-area-inset-top, 0px) + 12px); left: 50%; transform: translateX(-50%);
  text-align: center; z-index: 3;
  background: rgba(20,14,9,0.78); color: #f3ece0;
  padding: 8px 22px; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.3);
}
.wp-vig-place-header__title {
  font: 800 clamp(16px, 2.6vw, 24px)/1.1 ui-sans-serif, system-ui, sans-serif; letter-spacing: 0.02em;
}
.wp-vig-place-header__sub {
  font: 500 clamp(12px, 1.6vw, 15px)/1.2 ui-sans-serif, system-ui, sans-serif;
  color: var(--wp-place-accent, #e8b54a); margin-top: 3px;
}
.wp-vig-place-tray { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; }
.wp-vig-place-actions {
  position: absolute; left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom, 0px) + 96px); z-index: 6;
  display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
}
.wp-vig-place-btn {
  min-height: 50px; padding: 13px clamp(22px, 3vw, 34px);
  border: none; border-radius: 999px; cursor: pointer;
  font: 700 clamp(15px, 0.6vw + 13px, 18px)/1 ui-sans-serif, system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 8px 22px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.5);
}
.wp-vig-place-btn:active { transform: scale(0.96); }
.wp-vig-place-btn:disabled { opacity: 0.6; pointer-events: none; }
.wp-vig-place-btn--primary {
  background: linear-gradient(180deg, var(--wp-place-accent, #e8b54a), #c4922f); color: #1f1505;
}
.wp-vig-place-btn--shop {
  background: linear-gradient(180deg, #e8e0d2, #c7bca6); color: #2a2114;
}
@media (hover: hover) and (pointer: fine) {
  .wp-vig-place-btn { transition: filter 0.16s ease, transform 0.1s ease; }
  .wp-vig-place-btn:hover { filter: brightness(1.05); }
}
@media (prefers-reduced-motion: reduce) {
  .wp-vig-place, .wp-vig-place-keeper--sway, .wp-vig-place-steam { animation: none; transition: none; }
}
`
