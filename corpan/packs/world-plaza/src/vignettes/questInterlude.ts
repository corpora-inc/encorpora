/**
 * questInterlude — the JUICY quest-completion celebration + next-quest picker.
 *
 *   "You finished the quest!" → a reward reveal + a little fanfare → "Where to
 *   next?" with 2–3 dignified cards (title · where to go · what to do).
 *
 * This is the payoff beat of the deterministic quest loop (A2). It fires when the
 * engine emits `complete` on the LAST step. It is a SELF-CONTAINED fullscreen
 * scene built on the SAME discipline as the Vignette host (mount INSIDE
 * `.wp-overlay`, NEVER body — the M0 lesson; compositor-only transitions;
 * reduced-motion aware; ≥44px touch targets; every string localized with an
 * inline English fallback). It deliberately does NOT register with the
 * `VignetteHost` (no `chosenQuestId` field on `VignetteResult`, no host edit):
 * it owns its own fullscreen root + Promise, so game.ts integrates it with one
 * `await createQuestInterlude(...).show()`.
 *
 * REWARD reveal reuses `showRewardReveal` (the economy smorgasbord). The reward
 * was already GRANTED by the engine on `complete`; here we just CELEBRATE it.
 *
 * FUTURE ASSET HOOK: `opts.animationMount` is an explicit, clearly-marked slot
 * where a dedicated completion VIDEO / animation can be dropped later — the
 * orchestrator (or a future asset slice) fills `<div class="wp-qi-stage">` and
 * the rest of the interlude composes around it. Until then the stage shows a
 * lightweight procedural burst.
 */

import { showRewardReveal } from "../economy/rewardReveal"
import type { Reward } from "../economy/inventory"
import type { IconRenderer } from "../contracts/runtime"

const LOG = "[wp/questInterlude]"

/** One next-quest option the picker renders (resolved from the quest catalog). */
export interface NextQuestOption {
  /** The quest id set as active when this card is picked. */
  id: string
  /** The quest title ("A Deal at the Market"). */
  title: string
  /** Where to go — the friendly name of the first step's anchor ("the market"). */
  whereToGo: string
  /** What to do — the first step's label ("Ask the price at the market"). */
  whatToDo: string
  /** icon motif hint for the procedural card icon ("market","fountain",…). */
  motif?: string
}

/**
 * Localized copy, each with an inline English fallback (the badgeStrings
 * convention — never a raw key on screen). `t` resolves a key in the UI locale;
 * when it returns the key unchanged (no LOCALE table), the fallback shows.
 */
export interface QuestInterludeStrings {
  /** Big celebratory header ("Quest complete!"). */
  title: string
  /** The just-finished quest's title is shown under the header. */
  subtitle: (questTitle: string) => string
  /** The picker prompt ("Where to next?"). */
  pickPrompt: string
  /** Per-card "Go to {where}" line prefix. */
  goTo: (where: string) => string
  /** The card's pick button label. */
  begin: string
  /** A dignified "Stay in the plaza for now" opt-out (resolves null). */
  notNow: string
}

const DEFAULT_STRINGS: QuestInterludeStrings = {
  title: "Quest complete!",
  subtitle: (q) => `You finished “${q}”.`,
  pickPrompt: "Where to next?",
  goTo: (where) => `Go to ${where}`,
  begin: "Begin",
  notNow: "Stay in the plaza for now",
}

export interface QuestInterludeOptions {
  /** Where the interlude mounts — the game's `.wp-overlay` (NEVER document.body). */
  overlay: HTMLElement
  /** The title of the quest the player just completed (for the celebratory line). */
  completedQuestTitle: string
  /** The reward the engine granted on completion — re-shown via the smorgasbord. */
  reward: Reward
  /** Which item ids were newly granted (from applyReward's return), for the reveal. */
  newItems?: string[]
  /** The 2–3 next-quest options (from `questCatalog.nextQuests`). */
  options: NextQuestOption[]
  /** Accent colour (scene palette) for the header + card tint. */
  accent?: string
  /** The shared procedural icon renderer (zero emoji). */
  iconRenderer?: IconRenderer
  /** UI locale for the reward reveal + `t`. */
  locale?: string
  /** The i18n seam (key → string; returns key unchanged when no LOCALE table). */
  t?: (key: string, params?: Record<string, string | number>) => string
  /** Localized copy overrides. */
  strings?: Partial<QuestInterludeStrings>
  /**
   * FUTURE ASSET HOOK. Fill the `<div class="wp-qi-stage">` with a dedicated
   * completion video/animation. Resolves when the asset is ready to be replaced
   * by the picker (or immediately). Absent ⇒ a lightweight procedural burst.
   */
  animationMount?: (stage: HTMLElement) => Promise<void>
}

export interface QuestInterludeHandle {
  /**
   * Run the celebration → picker. Resolves the CHOSEN next-quest id, or null if
   * the player opted to stay in the plaza (or the interlude was disposed). Settles
   * exactly once.
   */
  show(): Promise<{ chosenQuestId: string } | null>
  /** Force-dismiss (app background / teardown) — resolves a pending `show` null. */
  dispose(): void
}

export function createQuestInterlude(opts: QuestInterludeOptions): QuestInterludeHandle {
  ensureStyles()
  const reduced =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
  const strings: QuestInterludeStrings = { ...DEFAULT_STRINGS, ...(opts.strings ?? {}) }
  const accent = opts.accent ?? "#e8b54a"

  // Localize with an inline English fallback (never a raw key on screen).
  const tr = (
    key: string,
    fallback: string,
    params?: Record<string, string | number>,
  ): string => {
    let s = opts.t ? opts.t(key, params) : key
    if (s === key || s == null || s === "") s = fallback
    if (params) s = s.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? `{${k}}`))
    return s
  }

  let root: HTMLElement | null = null
  let rewardHandle: { close(): void } | null = null
  let settled = false
  let resolveShow: ((r: { chosenQuestId: string } | null) => void) | null = null
  let disposed = false

  function finish(result: { chosenQuestId: string } | null): void {
    if (settled) return
    settled = true
    rewardHandle?.close()
    const r = root
    // Transition out, then remove.
    if (r) {
      r.classList.remove("wp-qi--in")
      r.classList.add("wp-qi--out")
      window.setTimeout(() => {
        r.remove()
        if (root === r) root = null
      }, reduced ? 1 : 320)
    }
    resolveShow?.(result)
    resolveShow = null
  }

  async function show(): Promise<{ chosenQuestId: string } | null> {
    if (disposed) return null
    return new Promise<{ chosenQuestId: string } | null>((resolve) => {
      resolveShow = resolve

      const r = document.createElement("div")
      r.className = "wp-qi"
      r.setAttribute("role", "dialog")
      r.setAttribute("aria-modal", "true")
      r.style.setProperty("--wp-qi-accent", accent)
      root = r
      opts.overlay.appendChild(r)

      // ── celebration header ────────────────────────────────────────────────
      const header = el("div", "wp-qi-header")
      header.appendChild(el("div", "wp-qi-eyebrow", "★"))
      header.appendChild(el("div", "wp-qi-title", tr("quest.interlude.title", strings.title)))
      header.appendChild(
        el(
          "div",
          "wp-qi-subtitle",
          tr("quest.interlude.subtitle", strings.subtitle(opts.completedQuestTitle), {
            quest: opts.completedQuestTitle,
          }),
        ),
      )
      r.appendChild(header)

      // ── the asset STAGE (future video/animation hook) ─────────────────────
      const stage = el("div", "wp-qi-stage")
      // Lightweight procedural burst until a real asset fills the stage.
      if (!reduced) stage.appendChild(buildBurst(accent))
      r.appendChild(stage)

      // ── the reward reveal (smorgasbord) — already granted; just celebrate. ─
      // It mounts into our root (an .wp-overlay descendant), absolute at top 14%.
      try {
        rewardHandle = showRewardReveal(r, {
          reward: opts.reward,
          newItems: opts.newItems,
          locale: opts.locale,
          dismissMs: 0, // we control its lifetime
          t: opts.t ? (k, _lang, params) => opts.t!(k, params) : undefined,
        })
      } catch (e) {
        console.error(`${LOG} reward reveal failed:`, e)
      }

      // ── the next-quest picker ─────────────────────────────────────────────
      const picker = el("div", "wp-qi-picker")
      picker.appendChild(el("div", "wp-qi-prompt", tr("quest.interlude.prompt", strings.pickPrompt)))

      const cards = el("div", "wp-qi-cards")
      const options = opts.options.slice(0, 3)
      if (options.length === 0) {
        console.warn(`${LOG} no next-quest options — showing only the opt-out.`)
      }
      options.forEach((o, i) => {
        const card = document.createElement("button")
        card.type = "button"
        card.className = "wp-qi-card"
        card.style.setProperty("--wp-qi-i", String(i))

        // Card icon (procedural; falls back to a star glyph if no renderer).
        const iconWrap = el("div", "wp-qi-card-icon")
        if (opts.iconRenderer) {
          try {
            const canvas = opts.iconRenderer.renderIcon(
              { family: "coin-round", palette: accent, finish: "metal", metal: "gold", motif: o.motif },
              { size: 34 },
            )
            iconWrap.appendChild(canvas)
          } catch (e) {
            console.error(`${LOG} card icon failed:`, e)
            iconWrap.textContent = "★"
          }
        } else {
          iconWrap.textContent = "★"
        }

        const body = el("div", "wp-qi-card-body")
        body.appendChild(el("div", "wp-qi-card-title", o.title))
        body.appendChild(
          el("div", "wp-qi-card-where", tr("quest.interlude.goto", strings.goTo(o.whereToGo), {
            where: o.whereToGo,
          })),
        )
        body.appendChild(el("div", "wp-qi-card-what", o.whatToDo))

        const cta = el("span", "wp-qi-card-cta", tr("quest.interlude.begin", strings.begin))

        card.append(iconWrap, body, cta)
        card.addEventListener("click", () => finish({ chosenQuestId: o.id }))
        cards.appendChild(card)
      })
      picker.appendChild(cards)

      // A dignified opt-out — NEVER a forced choice (no dark pattern).
      const notNow = document.createElement("button")
      notNow.type = "button"
      notNow.className = "wp-qi-notnow"
      notNow.textContent = tr("quest.interlude.notnow", strings.notNow)
      notNow.addEventListener("click", () => finish(null))
      picker.appendChild(notNow)

      r.appendChild(picker)

      // ESC opts out (no window.confirm — project rule).
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          finish(null)
        }
      }
      r.addEventListener("keydown", onKey)
      r.tabIndex = -1

      // A short, dignified two-note fanfare (reduced-motion safe).
      playFanfare(reduced)

      // Transition in + reveal the picker after the reward beat.
      requestAnimationFrame(() => r.classList.add("wp-qi--in"))
      const revealPicker = () => {
        if (settled) return
        picker.classList.add("wp-qi-picker--in")
        // Focus the first card for keyboard users.
        const first = cards.querySelector<HTMLButtonElement>(".wp-qi-card")
        first?.focus({ preventScroll: true })
        rewardHandle?.close()
        rewardHandle = null
      }
      // Let the celebration breathe, then bring up the choice (or let a future
      // animation asset gate it). Reduced-motion shortens the dwell.
      if (opts.animationMount) {
        opts
          .animationMount(stage)
          .catch((e) => console.error(`${LOG} animationMount failed:`, e))
          .finally(revealPicker)
      } else {
        picker.classList.add("wp-qi-picker--pending")
        window.setTimeout(revealPicker, reduced ? 200 : 1700)
      }
    })
  }

  return {
    show,
    dispose(): void {
      if (disposed) return
      disposed = true
      finish(null)
    },
  }
}

/* ---------------------------------------------------- small DOM + fx helpers */

function el(tag: string, cls: string, text?: string): HTMLElement {
  const n = document.createElement(tag)
  n.className = cls
  if (text != null) n.textContent = text
  return n
}

/** A procedural confetti-ray burst behind the header (compositor-only, pooled). */
function buildBurst(accent: string): HTMLElement {
  const wrap = el("div", "wp-qi-burst")
  const rays = 12
  for (let i = 0; i < rays; i++) {
    const ray = document.createElement("span")
    ray.className = "wp-qi-ray"
    ray.style.setProperty("--wp-qi-ray", String(i))
    ray.style.setProperty("--wp-qi-rot", `${(360 / rays) * i}deg`)
    ray.style.background = i % 2 === 0 ? accent : "#fff7e0"
    wrap.appendChild(ray)
  }
  return wrap
}

/**
 * A short, bright two-note fanfare via WebAudio (no asset dependency). Skipped
 * under reduced-motion; degrades silently when WebAudio is blocked.
 */
function playFanfare(reduced: boolean): void {
  if (reduced) return
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ac = new AudioCtx()
    const now = ac.currentTime
    const tone = (freq: number, at: number, dur: number, gainPk = 0.13) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = "triangle"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + at)
      gain.gain.exponentialRampToValueAtTime(gainPk, now + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur)
      osc.connect(gain).connect(ac.destination)
      osc.start(now + at)
      osc.stop(now + at + dur + 0.02)
    }
    tone(523.25, 0, 0.18) // C5
    tone(659.25, 0.12, 0.2) // E5
    tone(783.99, 0.24, 0.34) // G5 — a bright major resolve
    window.setTimeout(() => void ac.close().catch(() => {}), 900)
  } catch (e) {
    console.error(`${LOG} fanfare failed:`, e)
  }
}

/* ------------------------------------------------------ scoped inline styles */

let stylesInjected = false
function ensureStyles(): void {
  if (stylesInjected) return
  if (typeof document === "undefined") return
  if (document.querySelector("style[data-wp-qi]")) {
    stylesInjected = true
    return
  }
  const style = document.createElement("style")
  style.setAttribute("data-wp-qi", "")
  style.textContent = QI_CSS
  document.head.appendChild(style)
  stylesInjected = true
}

const QI_CSS = `
.wp-qi {
  --wp-qi-accent: #e8b54a;
  position: absolute;
  inset: 0;
  z-index: var(--wp-z-interlude, 90);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 14px;
  padding: clamp(20px, 7vh, 60px) 20px max(24px, env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  text-align: center;
  color: #f4ead4;
  background:
    radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--wp-qi-accent) 26%, transparent), transparent 60%),
    linear-gradient(180deg, #1d1812 0%, #120e0a 100%);
  font-family: ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, sans-serif;
  opacity: 0;
  transition: opacity 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden auto;
}
.wp-qi--in { opacity: 1; }
.wp-qi--out { opacity: 0; }

.wp-qi-header { position: relative; z-index: 2; }
.wp-qi-eyebrow {
  font-size: 30px; line-height: 1; color: var(--wp-qi-accent);
  filter: drop-shadow(0 2px 8px color-mix(in srgb, var(--wp-qi-accent) 60%, transparent));
  animation: wp-qi-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.wp-qi-title {
  margin-top: 6px; font-size: clamp(26px, 6vw, 40px); font-weight: 800; letter-spacing: 0.01em;
  color: #fff; text-shadow: 0 2px 14px rgba(0,0,0,0.5);
}
.wp-qi-subtitle { margin-top: 6px; font-size: 14.5px; color: #cfc1a4; opacity: 0.92; }

@keyframes wp-qi-pop { from { transform: scale(0.4); opacity: 0; } to { transform: scale(1); opacity: 1; } }

/* The asset stage (future video/animation slot) + procedural burst behind it.
   The reward reveal (showRewardReveal mounts an absolute .wp-reward at top:14%)
   is re-pinned INSIDE this band so it celebrates UNDER the header, never over it. */
.wp-qi-stage {
  position: relative; z-index: 1;
  width: min(86vw, 360px); height: clamp(96px, 20vh, 170px);
  display: flex; align-items: center; justify-content: center;
}
.wp-qi .wp-reward {
  position: absolute;
  top: auto;
  /* sit it in the stage band: just under the header, above the picker. */
  inset: clamp(120px, 22vh, 200px) 0 auto 0;
  z-index: 4;
}
.wp-qi-burst { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.wp-qi-ray {
  position: absolute; width: 3px; height: 26px; border-radius: 2px; opacity: 0;
  transform: rotate(var(--wp-qi-rot)) translateY(-10px) scaleY(0.2);
  transform-origin: 50% 60px;
  animation: wp-qi-ray 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(var(--wp-qi-ray) * 0.025s + 0.1s);
}
@keyframes wp-qi-ray {
  0% { opacity: 0; transform: rotate(var(--wp-qi-rot)) translateY(-4px) scaleY(0.2); }
  40% { opacity: 0.9; }
  100% { opacity: 0; transform: rotate(var(--wp-qi-rot)) translateY(-30px) scaleY(1); }
}

/* The picker — fades up after the reward beat. */
.wp-qi-picker {
  position: relative; z-index: 3;
  width: min(92vw, 560px);
  opacity: 0; transform: translateY(10px);
  transition: opacity 0.34s cubic-bezier(0.22, 1, 0.36, 1), transform 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.wp-qi-picker--pending { pointer-events: none; }
.wp-qi-picker--in { opacity: 1; transform: translateY(0); pointer-events: auto; }
.wp-qi-prompt { font-size: 16px; font-weight: 700; color: #f4ead4; margin-bottom: 12px; }

.wp-qi-cards { display: flex; flex-direction: column; gap: 10px; }
@media (min-width: 680px) {
  /* Row of equal-width cards, each VERTICAL (icon · body · CTA) so titles never
     truncate and the where/what lines have full card width. */
  .wp-qi-cards { flex-direction: row; align-items: stretch; justify-content: center; gap: 12px; }
  .wp-qi-card { flex: 1 1 0; min-width: 0; flex-direction: column; align-items: stretch; text-align: center; }
  .wp-qi-card-icon { align-self: center; }
  .wp-qi-card-body { text-align: center; }
  .wp-qi-card-cta { align-self: center; margin-top: 4px; }
  .wp-qi-card-title { white-space: normal; }
}
.wp-qi-card {
  display: flex; align-items: center; gap: 12px;
  min-height: 64px; padding: 14px 16px; box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--wp-qi-accent) 30%, transparent);
  border-radius: 16px; cursor: pointer; text-align: left;
  background: rgba(247, 239, 224, 0.06);
  color: #f4ead4; font: inherit;
  transition: background 0.18s ease, transform 0.12s ease, border-color 0.18s ease;
}
.wp-qi-card:hover { background: rgba(247, 239, 224, 0.12); border-color: var(--wp-qi-accent); }
.wp-qi-card:active { transform: scale(0.985); }
.wp-qi-card:focus-visible { outline: 2px solid var(--wp-qi-accent); outline-offset: 2px; }
.wp-qi-card-icon {
  flex: 0 0 auto; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
  font-size: 22px; color: var(--wp-qi-accent);
}
.wp-qi-card-icon canvas { width: 34px; height: 34px; }
.wp-qi-card-body { flex: 1 1 auto; min-width: 0; }
.wp-qi-card-title { font-size: 14.5px; font-weight: 800; color: #fff; line-height: 1.25; }
.wp-qi-card-where { margin-top: 4px; font-size: 12px; font-weight: 700; color: var(--wp-qi-accent); }
.wp-qi-card-what { margin-top: 3px; font-size: 12px; line-height: 1.35; color: #d8ccb0; opacity: 0.92; }
.wp-qi-card-cta {
  flex: 0 0 auto; align-self: center; padding: 8px 16px; border-radius: 10px;
  background: var(--wp-qi-accent); color: #1d1812; font-size: 12.5px; font-weight: 800;
}

.wp-qi-notnow {
  display: block; margin: 16px auto 0; padding: 8px 14px;
  border: none; background: transparent; color: #b7a98c; cursor: pointer;
  font: 600 13px/1 inherit; text-decoration: underline; text-underline-offset: 3px;
}
.wp-qi-notnow:hover { color: #e6d8ba; }
.wp-qi-notnow:focus-visible { outline: 2px solid var(--wp-qi-accent); outline-offset: 2px; border-radius: 6px; }

@media (prefers-reduced-motion: reduce) {
  .wp-qi { transition: none; }
  .wp-qi-eyebrow { animation: none; }
  .wp-qi-ray { display: none; }
  .wp-qi-picker { transition: none; opacity: 1; transform: none; }
}
`
