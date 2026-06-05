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

import type { Reward } from "../economy/inventory"
import { getItemDef } from "../economy/inventory"
import {
  getCurrency,
  topStacks,
  format,
  denominationIconSpec,
  iconRenderer as defaultIconRenderer,
  DEFAULT_CURRENCY_ID,
} from "../economy/currencies"
import type { Wallet } from "@world-plaza/contracts"
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
  /** Small celebratory eyebrow above the title ("Victory"). */
  eyebrow: string
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
  /** The "Skip" affordance for repeat players (skips ahead to the picker). */
  skip: string
}

const DEFAULT_STRINGS: QuestInterludeStrings = {
  eyebrow: "Victory",
  title: "Quest complete!",
  subtitle: (q) => `You finished “${q}”.`,
  pickPrompt: "Where to next?",
  goTo: (where) => `Go to ${where}`,
  begin: "Begin",
  notNow: "Stay in the plaza for now",
  skip: "Skip",
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
  let settled = false
  let resolveShow: ((r: { chosenQuestId: string } | null) => void) | null = null
  let disposed = false

  // ── the cinematic timeline ────────────────────────────────────────────────
  // The whole point of this surface: a SLOW, staged, rewarding celebration, not
  // a flash. We run a hand-authored timeline of `step`s on real-time timers and
  // expose `fastForward()` (the Skip affordance) which collapses every pending
  // step to fire NOW, in order, landing the player on the picker. Each timer is
  // tracked so dispose/finish can clear them. Under reduced-motion the timeline
  // collapses to a single dignified instant settle (no flashing, no count-up).
  const timers = new Set<number>()
  const after = (ms: number, fn: () => void): void => {
    if (settled) return
    const id = window.setTimeout(() => {
      timers.delete(id)
      if (!settled) fn()
    }, Math.max(0, ms))
    timers.add(id)
  }
  const clearTimers = (): void => {
    for (const id of timers) window.clearTimeout(id)
    timers.clear()
  }

  function finish(result: { chosenQuestId: string } | null): void {
    if (settled) return
    settled = true
    clearTimers()
    const r = root
    // Transition out, then remove.
    if (r) {
      r.classList.remove("wp-qi--in")
      r.classList.add("wp-qi--out")
      window.setTimeout(() => {
        r.remove()
        if (root === r) root = null
      }, reduced ? 1 : 380)
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

      // A soft cinematic scrim that DIMS the world first (the anticipation beat),
      // then a faint accent vignette blooms in as the reveal lands. It sits under
      // everything (z 0) so the celebration reads against a hushed backdrop.
      const scrim = el("div", "wp-qi-scrim")
      r.appendChild(scrim)

      // ── celebration header (staged: eyebrow → title → subtitle) ───────────
      const header = el("div", "wp-qi-header")
      const eyebrow = el("div", "wp-qi-eyebrow")
      eyebrow.appendChild(el("span", "wp-qi-eyebrow-star", "★"))
      eyebrow.appendChild(
        el("span", "wp-qi-eyebrow-text", tr("interlude.eyebrow", strings.eyebrow)),
      )
      const titleEl = el("div", "wp-qi-title", tr("interlude.title", strings.title))
      const subtitleEl = el(
        "div",
        "wp-qi-subtitle",
        tr("interlude.subtitle", strings.subtitle(opts.completedQuestTitle), {
          quest: opts.completedQuestTitle,
        }),
      )
      header.append(eyebrow, titleEl, subtitleEl)
      r.appendChild(header)

      // ── the asset STAGE (future video/animation hook) + procedural burst ──
      const stage = el("div", "wp-qi-stage")
      const burst = reduced ? null : buildBurst(accent)
      if (burst) stage.appendChild(burst)
      r.appendChild(stage)

      // ── the staged reward TALLY (counts up line-by-line) ──────────────────
      // Built bespoke (not showRewardReveal) so each line can LAND in sequence
      // with a count-up + a small sparkle. The reward was already granted by the
      // engine on `complete`; here we just celebrate it, slowly.
      const tally = buildRewardTally(opts, tr)
      r.appendChild(tally.root)

      // ── the next-quest picker ─────────────────────────────────────────────
      const picker = el("div", "wp-qi-picker wp-qi-picker--pending")
      picker.appendChild(el("div", "wp-qi-prompt", tr("interlude.pickPrompt", strings.pickPrompt)))

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
          el("div", "wp-qi-card-where", tr("interlude.goTo", strings.goTo(o.whereToGo), {
            where: o.whereToGo,
          })),
        )
        body.appendChild(el("div", "wp-qi-card-what", o.whatToDo))

        const cta = el("span", "wp-qi-card-cta", tr("interlude.begin", strings.begin))

        card.append(iconWrap, body, cta)
        card.addEventListener("click", () => finish({ chosenQuestId: o.id }))
        cards.appendChild(card)
      })
      picker.appendChild(cards)

      // A dignified opt-out — NEVER a forced choice (no dark pattern).
      const notNow = document.createElement("button")
      notNow.type = "button"
      notNow.className = "wp-qi-notnow"
      notNow.textContent = tr("interlude.notNow", strings.notNow)
      notNow.addEventListener("click", () => finish(null))
      picker.appendChild(notNow)

      r.appendChild(picker)

      // ── the Skip affordance (repeat players) ──────────────────────────────
      // DEFAULT is the full slow cinema; Skip fast-forwards to the picker. It
      // hides itself once the picker is up (nothing left to skip). Hidden under
      // reduced-motion (the sequence is already near-instant there).
      const skipBtn = document.createElement("button")
      skipBtn.type = "button"
      skipBtn.className = "wp-qi-skip"
      skipBtn.textContent = tr("interlude.skip", strings.skip)
      skipBtn.setAttribute("aria-label", tr("interlude.skip", strings.skip))
      if (reduced) skipBtn.style.display = "none"
      r.appendChild(skipBtn)

      // ESC opts out (no window.confirm — project rule).
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          finish(null)
        }
      }
      r.addEventListener("keydown", onKey)
      r.tabIndex = -1

      // Bring the picker up once the celebration has breathed. Idempotent.
      let pickerShown = false
      const revealPicker = (): void => {
        if (settled || pickerShown) return
        pickerShown = true
        picker.classList.remove("wp-qi-picker--pending")
        picker.classList.add("wp-qi-picker--in")
        skipBtn.classList.add("wp-qi-skip--gone")
        const first = cards.querySelector<HTMLButtonElement>(".wp-qi-card")
        first?.focus({ preventScroll: true })
      }

      // FAST-FORWARD: collapse the whole pending timeline NOW (Skip / future
      // animation finishing early). Snaps the header + tally to their landed
      // state, then reveals the picker — no flash, just sooner.
      const fastForward = (): void => {
        if (settled || pickerShown) return
        clearTimers()
        r.classList.add("wp-qi--ff") // CSS: collapse staged anims to landed state
        tally.settleAll()
        revealPicker()
      }
      skipBtn.addEventListener("click", fastForward)

      // ── run the timeline ──────────────────────────────────────────────────
      requestAnimationFrame(() => r.classList.add("wp-qi--in"))

      if (reduced) {
        // Dignified instant: everything lands at once, no count-up, no flashing.
        r.classList.add("wp-qi--ff")
        r.classList.add("wp-qi-stage1", "wp-qi-stage2", "wp-qi-stage3")
        tally.settleAll()
        after(200, revealPicker)
        return
      }

      // BEAT 1 — anticipation: the world dims, a breath of hush. (scrim fades in
      //          via .wp-qi--in; we just let it sit ~650ms before the reveal.)
      // BEAT 2 — the SLOW reveal: eyebrow blooms, then the big title scales up
      //          with a glow sweep, then the subtitle settles under it.
      after(650, () => {
        r.classList.add("wp-qi-stage1") // eyebrow in
        playChime(reduced, 0)
      })
      after(1150, () => {
        r.classList.add("wp-qi-stage2") // title reveal (scale + glow)
        if (burst) burst.classList.add("wp-qi-burst--go")
        playChime(reduced, 1)
      })
      after(1850, () => {
        r.classList.add("wp-qi-stage3") // subtitle settles
      })

      // BEAT 3 — the reward tally counts UP, each line landing in sequence.
      after(2450, () => {
        tally.play(after, () => playChime(reduced, 2))
      })

      // BEAT 4 — a dignified pause to ENJOY it, then…
      // BEAT 5 — the next-quest choices animate in. The dwell scales with how
      //          much tally there was so big rewards get their full moment.
      const tallyMs = tally.durationMs
      after(2450 + tallyMs + 900, revealPicker)
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
 * A single bright bell note via WebAudio, used as a staged "ding" at each beat
 * of the cinematic (eyebrow, title, reward) so the celebration RISES instead of
 * firing one fanfare and forgetting. `idx` selects an ascending major arpeggio
 * note (C5 → E5 → G5 → C6) so the sequence resolves upward. Skipped under
 * reduced-motion; degrades silently when WebAudio is blocked. WebAudio contexts
 * are cheap and self-close, so one-per-note keeps the staged code trivial.
 */
const CHIME_NOTES = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
function playChime(reduced: boolean, idx: number): void {
  if (reduced) return
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ac = new AudioCtx()
    const now = ac.currentTime
    const freq = CHIME_NOTES[Math.min(idx, CHIME_NOTES.length - 1)]
    // A bell: a fundamental triangle + a softer octave shimmer, gently decaying.
    const voice = (f: number, gainPk: number, dur: number) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = "triangle"
      osc.frequency.value = f
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(gainPk, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)
      osc.connect(gain).connect(ac.destination)
      osc.start(now)
      osc.stop(now + dur + 0.02)
    }
    voice(freq, 0.12, 0.5)
    voice(freq * 2, 0.04, 0.42) // octave shimmer
    window.setTimeout(() => void ac.close().catch(() => {}), 900)
  } catch (e) {
    console.error(`${LOG} chime failed:`, e)
  }
}

/* ----------------------------------------------------- the staged reward tally */

interface RewardTally {
  root: HTMLElement
  /** Total ms the count-up sequence takes to fully land (for pacing the picker). */
  durationMs: number
  /** Run the staged count-up; `after` schedules onto the timeline, `onLand` dings. */
  play(after: (ms: number, fn: () => void) => void, onLand: () => void): void
  /** Snap every line to its final value NOW (Skip / reduced-motion). */
  settleAll(): void
}

/** One renderable reward line (xp / a currency stack / an item grant). */
interface TallyLine {
  el: HTMLElement
  /** Numeric count-up target (xp, currency units). undefined ⇒ no count (items). */
  target?: number
  /** Render the line's amount at a given (possibly partial) value. */
  setValue?: (v: number) => void
}

/** Fold a reward's legacy scalar `coins` into the currency wallet. */
function rewardWallet(reward: Reward): Wallet {
  const w: Wallet = { ...(reward.currency ?? {}) }
  if (reward.coins) w[DEFAULT_CURRENCY_ID] = (w[DEFAULT_CURRENCY_ID] ?? 0) + reward.coins
  return w
}

/**
 * Build the staged reward tally: XP first (mastery), then the physical-currency
 * smorgasbord (decomposed denomination stacks — the moon coin stays dead), then
 * item grants. Each line counts UP and LANDS in sequence rather than all-at-once.
 */
function buildRewardTally(
  opts: QuestInterludeOptions,
  tr: (key: string, fallback: string, params?: Record<string, string | number>) => string,
): RewardTally {
  const root = el("div", "wp-qi-tally")
  root.append(el("div", "wp-qi-tally-title", tr("econ.reward.title", "You earned")))
  const list = el("div", "wp-qi-tally-list")
  root.append(list)

  const renderer = opts.iconRenderer ?? safeRenderer()
  const lines: TallyLine[] = []

  const makeLine = (cls = ""): HTMLElement => {
    const line = el("div", `wp-qi-line ${cls}`.trim())
    line.style.setProperty("--wp-qi-line", String(lines.length))
    list.append(line)
    return line
  }

  // XP — the mastery axis, counted up.
  if (opts.reward.xp && opts.reward.xp > 0) {
    const xp = opts.reward.xp
    const line = makeLine("wp-qi-line--xp")
    const badge = el("div", "wp-qi-line-badge wp-qi-line-badge--xp", "XP")
    const amt = el("div", "wp-qi-line-amt")
    const sparkle = el("div", "wp-qi-line-spark")
    line.append(badge, amt, sparkle)
    const setValue = (v: number) => {
      amt.textContent = `+${Math.round(v)}`
    }
    setValue(0)
    lines.push({ el: line, target: xp, setValue })
  }

  // Currency smorgasbord — physical denomination stacks, each total counted up.
  const wallet = rewardWallet(opts.reward)
  const entries = Object.entries(wallet)
    .filter(([, u]) => u > 0)
    .sort((a, b) => b[1] - a[1])
  for (const [id, units] of entries) {
    const c = getCurrency(id)
    if (!c) continue
    const line = makeLine("wp-qi-line--coin")
    const stacks = el("div", "wp-qi-line-stacks")
    for (const { denom, count } of topStacks(c, units, 3)) {
      const stack = el("div", "wp-qi-line-stack")
      const fan = count > 1 ? 3 : 1
      for (let i = fan - 1; i >= 0; i--) {
        try {
          const canvas = renderer.renderIcon(denominationIconSpec(c, denom), { size: 30 })
          canvas.className = "wp-qi-line-icon"
          canvas.style.setProperty("--wp-fan", String(i))
          stack.append(canvas)
        } catch (e) {
          console.error(`${LOG} denom icon failed:`, e)
        }
      }
      if (count > 1) stack.append(el("span", "wp-qi-line-count", `×${count}`))
      stacks.append(stack)
    }
    const amt = el("div", "wp-qi-line-amt")
    const sparkle = el("div", "wp-qi-line-spark")
    line.append(stacks, amt, sparkle)
    const setValue = (v: number) => {
      amt.textContent = format(c, Math.round(v), opts.locale)
    }
    setValue(0)
    lines.push({ el: line, target: units, setValue })
  }

  // Item grants — no count-up; they just LAND (a thing, not a number).
  for (const itemId of opts.newItems ?? opts.reward.items ?? []) {
    const def = getItemDef(itemId)
    if (!def) continue
    const line = makeLine("wp-qi-line--item")
    const name = el("div", "wp-qi-line-item-name", def.name)
    const sparkle = el("div", "wp-qi-line-spark")
    line.append(name, sparkle)
    lines.push({ el: line })
  }

  if (lines.length === 0) {
    const line = makeLine("wp-qi-line--empty")
    line.append(el("div", "wp-qi-line-amt", tr("econ.reward.empty", "Well done!")))
    lines.push({ el: line })
  }

  // Pacing: each line gets a beat to LAND (its own count-up + sparkle) before the
  // next begins — that's the "in sequence, not all at once" the owner asked for.
  const PER_LINE_MS = 760
  const COUNT_MS = 560
  const durationMs = lines.length * PER_LINE_MS

  const settleLine = (l: TallyLine): void => {
    l.el.classList.add("wp-qi-line--in", "wp-qi-line--landed")
    if (l.target != null && l.setValue) l.setValue(l.target)
  }

  let played = false
  const play = (after: (ms: number, fn: () => void) => void, onLand: () => void): void => {
    if (played) return
    played = true
    lines.forEach((l, i) => {
      const at = i * PER_LINE_MS
      after(at, () => {
        l.el.classList.add("wp-qi-line--in")
        onLand()
        if (l.target != null && l.setValue) {
          animateCount(l.setValue, l.target, COUNT_MS, () => {
            l.el.classList.add("wp-qi-line--landed")
          })
        } else {
          // Items just pop + sparkle.
          after(60, () => l.el.classList.add("wp-qi-line--landed"))
        }
      })
    })
  }

  return {
    root,
    durationMs,
    play,
    settleAll(): void {
      played = true
      for (const l of lines) settleLine(l)
    },
  }
}

/** rAF count-up with an ease-out so the number decelerates as it lands. */
function animateCount(
  set: (v: number) => void,
  target: number,
  ms: number,
  onDone: () => void,
): void {
  const t0 =
    typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
  const now = () =>
    typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
  const tick = () => {
    const p = Math.min(1, (now() - t0) / ms)
    const eased = 1 - Math.pow(1 - p, 3) // cubic ease-out
    set(eased * target)
    if (p < 1) requestAnimationFrame(tick)
    else {
      set(target)
      onDone()
    }
  }
  requestAnimationFrame(tick)
}

/** The shared icon renderer, guarded so a broken renderer never throws here. */
function safeRenderer(): IconRenderer {
  try {
    return defaultIconRenderer()
  } catch (e) {
    console.error(`${LOG} icon renderer unavailable:`, e)
    return {
      renderIcon: () => {
        const c = document.createElement("canvas")
        c.width = c.height = 30
        return c
      },
    } as unknown as IconRenderer
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
  /* a slow, cinematic curtain-up (not a snap) */
  transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  overflow: hidden auto;
}
.wp-qi--in { opacity: 1; }
.wp-qi--out { opacity: 0; transition: opacity 0.38s ease; }

/* BEAT 1 — the anticipation scrim: a dark hush dims the world, then a soft
   accent vignette blooms in (under everything) as the title lands. */
.wp-qi-scrim {
  position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(130% 100% at 50% 18%, transparent 38%, rgba(8, 6, 4, 0.55) 100%);
  opacity: 0;
  transition: opacity 0.8s ease;
}
.wp-qi--in .wp-qi-scrim { opacity: 1; }
.wp-qi-scrim::after {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(70% 50% at 50% 24%, color-mix(in srgb, var(--wp-qi-accent) 22%, transparent), transparent 70%);
  opacity: 0; transition: opacity 1s ease 0.4s;
}
.wp-qi.wp-qi-stage2 .wp-qi-scrim::after { opacity: 1; }

.wp-qi-header { position: relative; z-index: 2; }

/* BEAT 2 — the staged reveal. Eyebrow blooms first, then the big title scales
   up with a glow sweep, then the subtitle settles under it. Each gated on a
   stage class the timeline adds in sequence. */
.wp-qi-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--wp-qi-accent);
  filter: drop-shadow(0 1px 6px color-mix(in srgb, var(--wp-qi-accent) 55%, transparent));
  opacity: 0; transform: translateY(8px);
  transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.wp-qi-eyebrow-star {
  font-size: 18px; line-height: 1;
  transform: scale(0.4) rotate(-30deg);
  transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.wp-qi.wp-qi-stage1 .wp-qi-eyebrow { opacity: 1; transform: translateY(0); }
.wp-qi.wp-qi-stage1 .wp-qi-eyebrow-star { transform: scale(1) rotate(0); }

.wp-qi-title {
  margin-top: 8px; font-size: clamp(28px, 6.6vw, 46px); font-weight: 800; letter-spacing: 0.01em;
  color: #fff; text-shadow: 0 2px 18px rgba(0,0,0,0.55);
  opacity: 0; transform: scale(0.86); transform-origin: 50% 60%;
  transition: opacity 0.6s ease, transform 0.7s cubic-bezier(0.2, 1.1, 0.3, 1);
  position: relative;
}
.wp-qi.wp-qi-stage2 .wp-qi-title { opacity: 1; transform: scale(1); }
/* a one-shot glow sweep across the title as it lands */
.wp-qi-title::after {
  content: ""; position: absolute; inset: -8% -4%;
  background: linear-gradient(105deg, transparent 30%, color-mix(in srgb, var(--wp-qi-accent) 70%, #fff) 50%, transparent 70%);
  mix-blend-mode: screen; opacity: 0; transform: translateX(-120%);
  pointer-events: none;
}
.wp-qi.wp-qi-stage2 .wp-qi-title::after { animation: wp-qi-sweep 0.9s ease 0.15s 1; }
@keyframes wp-qi-sweep {
  0% { opacity: 0; transform: translateX(-120%); }
  35% { opacity: 0.85; }
  100% { opacity: 0; transform: translateX(120%); }
}

.wp-qi-subtitle {
  margin-top: 8px; font-size: 14.5px; color: #cfc1a4;
  opacity: 0; transform: translateY(6px);
  transition: opacity 0.55s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}
.wp-qi.wp-qi-stage3 .wp-qi-subtitle { opacity: 0.92; transform: translateY(0); }

/* FAST-FORWARD (Skip / reduced-motion): collapse every staged transition so the
   header/title/subtitle land INSTANTLY in their final state, no flashing. */
.wp-qi.wp-qi--ff .wp-qi-eyebrow,
.wp-qi.wp-qi--ff .wp-qi-eyebrow-star,
.wp-qi.wp-qi--ff .wp-qi-title,
.wp-qi.wp-qi--ff .wp-qi-subtitle { transition: none !important; }
.wp-qi.wp-qi--ff .wp-qi-title::after { animation: none !important; }

/* The asset stage (future video/animation slot) + procedural ray burst behind
   the header. Rays fire once when the title lands (the --go class), not on load. */
.wp-qi-stage {
  position: relative; z-index: 1;
  width: min(86vw, 360px); height: clamp(60px, 12vh, 110px);
  display: flex; align-items: center; justify-content: center;
}
.wp-qi-burst { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.wp-qi-ray {
  position: absolute; width: 3px; height: 28px; border-radius: 2px; opacity: 0;
  transform: rotate(var(--wp-qi-rot)) translateY(-10px) scaleY(0.2);
  transform-origin: 50% 70px;
}
.wp-qi-burst--go .wp-qi-ray {
  animation: wp-qi-ray 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(var(--wp-qi-ray) * 0.03s);
}
@keyframes wp-qi-ray {
  0% { opacity: 0; transform: rotate(var(--wp-qi-rot)) translateY(-4px) scaleY(0.2); }
  40% { opacity: 0.9; }
  100% { opacity: 0; transform: rotate(var(--wp-qi-rot)) translateY(-34px) scaleY(1); }
}

/* BEAT 3 — the staged reward tally: each line slides in + counts up + sparkles,
   one after another (the timeline gates them; CSS just makes each land sweet). */
.wp-qi-tally {
  position: relative; z-index: 2;
  width: min(92vw, 460px);
  margin-top: 2px;
}
.wp-qi-tally-title {
  font-size: 11.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
  color: color-mix(in srgb, var(--wp-qi-accent) 75%, #cfc1a4); margin-bottom: 12px;
}
.wp-qi-tally-list { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.wp-qi-line {
  position: relative;
  display: flex; align-items: center; gap: 12px;
  min-height: 44px; padding: 8px 16px; box-sizing: border-box;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255,247,234,0.10), rgba(255,247,234,0.04));
  border: 1px solid color-mix(in srgb, var(--wp-qi-accent) 22%, transparent);
  opacity: 0; transform: translateY(14px) scale(0.94);
  transition: opacity 0.5s ease, transform 0.55s cubic-bezier(0.2, 1.1, 0.3, 1);
}
.wp-qi-line--in { opacity: 1; transform: translateY(0) scale(1); }
/* the "landed" pulse — a soft accent glow + tiny pop when the count finishes */
.wp-qi-line--landed { animation: wp-qi-land 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
@keyframes wp-qi-land {
  0% { box-shadow: 0 0 0 0 transparent; }
  35% { transform: translateY(0) scale(1.04); box-shadow: 0 0 22px 2px color-mix(in srgb, var(--wp-qi-accent) 45%, transparent); }
  100% { transform: translateY(0) scale(1); box-shadow: 0 0 0 0 transparent; }
}
.wp-qi-line-amt { font-size: 17px; font-weight: 800; color: #fff; white-space: nowrap; }
.wp-qi-line-badge--xp {
  width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
  font-size: 11px; font-weight: 900; color: #fff;
  background: radial-gradient(circle at 35% 30%, #7ec8ff, #3a86c8);
  box-shadow: 0 2px 4px rgba(20,50,80,0.4), inset 0 1px 0 rgba(255,255,255,0.5);
}
.wp-qi-line-stacks { display: flex; gap: 8px; align-items: flex-end; }
.wp-qi-line-stack { position: relative; display: inline-flex; align-items: flex-end; }
.wp-qi-line-icon { display: block; width: 30px; height: 30px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.45)); }
.wp-qi-line-stack .wp-qi-line-icon:not(:last-of-type) {
  position: absolute; left: calc(var(--wp-fan, 0) * 3px); bottom: calc(var(--wp-fan, 0) * 3px); opacity: 0.85;
}
.wp-qi-line-count {
  position: absolute; right: -6px; bottom: -4px; font-size: 10px; font-weight: 800; color: #fff;
  background: #8a5a2a; border-radius: 8px; padding: 0 5px;
}
.wp-qi-line-item-name {
  font-size: 13px; font-weight: 700; color: #f4ead4;
  background: rgba(160,120,70,0.22); border-radius: 10px; padding: 6px 12px;
}
/* a small sparkle burst that fires as a line lands */
.wp-qi-line-spark { position: absolute; right: 14px; top: 50%; width: 0; height: 0; pointer-events: none; }
.wp-qi-line--landed .wp-qi-line-spark::before,
.wp-qi-line--landed .wp-qi-line-spark::after {
  content: ""; position: absolute; left: 0; top: 0; width: 5px; height: 5px; border-radius: 50%;
  background: color-mix(in srgb, var(--wp-qi-accent) 80%, #fff);
  box-shadow: 0 0 8px 2px color-mix(in srgb, var(--wp-qi-accent) 60%, transparent);
  animation: wp-qi-spark 0.6s ease-out forwards;
}
.wp-qi-line--landed .wp-qi-line-spark::after { animation-delay: 0.08s; }
@keyframes wp-qi-spark {
  0% { opacity: 0.9; transform: translate(0,0) scale(1); }
  100% { opacity: 0; transform: translate(14px, -16px) scale(0.3); }
}
.wp-qi.wp-qi--ff .wp-qi-line { transition: none !important; }
.wp-qi.wp-qi--ff .wp-qi-line--landed { animation: none !important; }

/* BEAT 5 — the picker fades up after the celebration has breathed. */
.wp-qi-picker {
  position: relative; z-index: 3;
  width: min(92vw, 560px);
  margin-top: 6px;
  opacity: 0; transform: translateY(12px);
  transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1), transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.wp-qi-picker--pending { pointer-events: none; height: 0; overflow: hidden; margin-top: 0; }
.wp-qi-picker--in { opacity: 1; transform: translateY(0); pointer-events: auto; height: auto; }
.wp-qi-prompt { font-size: 16px; font-weight: 700; color: #f4ead4; margin-bottom: 12px; }

/* The Skip affordance — present during the cinema, gone once the picker lands. */
.wp-qi-skip {
  position: absolute; z-index: 5;
  top: max(14px, env(safe-area-inset-top, 0px)); inset-inline-end: 16px;
  min-height: 36px; padding: 8px 16px; border-radius: 999px;
  border: 1px solid rgba(247, 239, 224, 0.22);
  background: rgba(20, 16, 12, 0.45); color: #cfc1a4;
  font: 700 12.5px/1 inherit; letter-spacing: 0.04em; cursor: pointer;
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  opacity: 0; transition: opacity 0.5s ease 0.6s, color 0.18s ease, border-color 0.18s ease;
}
.wp-qi--in .wp-qi-skip { opacity: 0.85; }
.wp-qi-skip:hover { color: #fff; border-color: var(--wp-qi-accent); }
.wp-qi-skip:focus-visible { outline: 2px solid var(--wp-qi-accent); outline-offset: 2px; }
.wp-qi-skip--gone { opacity: 0 !important; pointer-events: none; transition: opacity 0.3s ease; }

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
  /* Dignified, instant — everything is shown in its landed state, no motion,
     no count-up, no flashing rays/sparkles. (The timeline also short-circuits.) */
  .wp-qi, .wp-qi-scrim, .wp-qi-scrim::after,
  .wp-qi-eyebrow, .wp-qi-eyebrow-star, .wp-qi-title, .wp-qi-subtitle,
  .wp-qi-line, .wp-qi-picker, .wp-qi-skip { transition: none !important; }
  .wp-qi-title::after, .wp-qi-line--landed, .wp-qi-ray { animation: none !important; }
  .wp-qi-eyebrow, .wp-qi-title, .wp-qi-line--in, .wp-qi-picker { opacity: 1; transform: none; }
  .wp-qi-subtitle { opacity: 0.92; transform: none; }
  .wp-qi-eyebrow-star { transform: scale(1) rotate(0); }
  .wp-qi-burst, .wp-qi-line-spark { display: none; }
}
`
