import "./rewardReveal.css"
import type { Wallet } from "@corpan-city/contracts"
import type { Reward } from "./inventory"
import { getItemDef } from "./inventory"
import {
  getCurrency,
  topStacks,
  format,
  denominationIconSpec,
  iconRenderer,
  DEFAULT_CURRENCY_ID,
} from "./currencies"
import type { Translate } from "../contracts/runtime"

/**
 * rewardReveal — the SMORGASBORD moment (ECONOMY_CURRENCY §2.3, §5.1). The single
 * most-seen surface, and where the moon coin dies for good: instead of "+N🪙" we
 * render a row of PHYSICAL currency stacks (decomposed denominations: a banded
 * stack of bills, a few coins, a green-patina ingot) painted by the shared
 * `IconRenderer`, plus XP and any item drops.
 *
 * Mounts INSIDE the passed container (the caller passes `.wp-overlay`, NEVER
 * document.body — the M0 lesson). Compositor-only open/close; auto-dismisses;
 * respects reduced-motion (no slide, no stagger). Localized via `Translate`.
 */

export interface RewardRevealOptions {
  /** the rolled reward to celebrate. */
  reward: Reward
  /** which item ids were actually newly granted (from applyReward's return). */
  newItems?: string[]
  /** UI locale (the Track's native, or target under immersion). */
  locale?: string
  /** the i18n seam (stub `(k) => k` until loc lands). */
  t?: Translate
  /** auto-dismiss after this many ms (default 3200). 0 = manual only. */
  dismissMs?: number
  onClose?: () => void
}

export interface RewardRevealHandle {
  close(): void
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text != null) n.textContent = text
  return n
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  } catch {
    return false
  }
}

/** Build the wallet a reward grants, folding the legacy scalar `coins`. */
function rewardWallet(reward: Reward): Wallet {
  const w: Wallet = { ...(reward.currency ?? {}) }
  if (reward.coins) w[DEFAULT_CURRENCY_ID] = (w[DEFAULT_CURRENCY_ID] ?? 0) + reward.coins
  return w
}

/**
 * Render one currency's grant as a stack-of-physical-denominations chip: the
 * top 1–3 denomination icons (each with a ×count) + the grouped major total.
 */
function currencyChip(currencyId: string, units: number, locale?: string): HTMLElement | null {
  const c = getCurrency(currencyId)
  if (!c || units <= 0) return null
  const chip = el("div", "wp-reward-chip")
  const stacksWrap = el("div", "wp-reward-stacks")
  const stacks = topStacks(c, units, 3)
  const renderer = iconRenderer()
  for (const { denom, count } of stacks) {
    const stack = el("div", "wp-reward-stack")
    // a stack reads as a wad: fan 1-3 offset icon copies behind the front one.
    const fan = Math.min(3, Math.max(1, count > 1 ? 3 : 1))
    for (let i = fan - 1; i >= 0; i--) {
      const canvas = renderer.renderIcon(denominationIconSpec(c, denom), { size: 34 })
      canvas.className = "wp-reward-icon"
      canvas.style.setProperty("--wp-fan", String(i))
      stack.append(canvas)
    }
    if (count > 1) stack.append(el("span", "wp-reward-count", `×${count}`))
    stacksWrap.append(stack)
  }
  chip.append(stacksWrap)
  chip.append(el("div", "wp-reward-amt", format(c, units, locale)))
  return chip
}

export function showRewardReveal(container: HTMLElement, opts: RewardRevealOptions): RewardRevealHandle {
  const t: Translate = opts.t ?? ((k) => k)
  const interp = (s: string, params?: Record<string, string | number>): string =>
    params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m)) : s
  const tr = (key: string, fallback: string, params?: Record<string, string | number>): string => {
    const v = t(key, opts.locale ?? "en", params)
    return v && v !== key ? v : interp(fallback, params)
  }

  const root = el("div", "wp-reward")
  if (prefersReducedMotion()) root.classList.add("wp-reward--still")
  root.setAttribute("role", "status")
  root.setAttribute("aria-live", "polite")

  const card = el("div", "wp-reward-card")
  card.append(el("div", "wp-reward-title", tr("econ.reward.title", "You earned")))

  const row = el("div", "wp-reward-row")

  // XP first (mastery axis), then the currency smorgasbord, then item drops.
  if (opts.reward.xp && opts.reward.xp > 0) {
    const xpChip = el("div", "wp-reward-chip wp-reward-chip--xp")
    xpChip.append(el("div", "wp-reward-xp-badge", "XP"))
    xpChip.append(el("div", "wp-reward-amt", `+${opts.reward.xp}`))
    row.append(xpChip)
  }

  const wallet = rewardWallet(opts.reward)
  const entries = Object.entries(wallet)
    .filter(([, u]) => u > 0)
    .sort((a, b) => b[1] - a[1])
  for (const [id, units] of entries) {
    const chip = currencyChip(id, units, opts.locale)
    if (chip) row.append(chip)
  }

  for (const id of opts.newItems ?? opts.reward.items ?? []) {
    const def = getItemDef(id)
    if (!def) continue
    const itemChip = el("div", "wp-reward-chip wp-reward-chip--item")
    itemChip.append(el("div", "wp-reward-item-name", def.name))
    row.append(itemChip)
  }

  if (!row.childElementCount) row.append(el("div", "wp-reward-amt", tr("econ.reward.empty", "Well done!")))

  card.append(row)
  root.append(card)

  // staggered slide-in unless reduced-motion.
  if (!root.classList.contains("wp-reward--still")) {
    Array.from(row.children).forEach((c, i) => {
      ;(c as HTMLElement).style.setProperty("--wp-i", String(i))
    })
  }

  let closed = false
  let dismissTimer: number | undefined
  const close = () => {
    if (closed) return
    closed = true
    window.clearTimeout(dismissTimer)
    root.classList.remove("wp-reward--in")
    const done = () => {
      root.remove()
      opts.onClose?.()
    }
    root.addEventListener("transitionend", done, { once: true })
    window.setTimeout(done, 400)
  }
  root.addEventListener("click", close)

  container.append(root)
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("wp-reward--in")))
  const ms = opts.dismissMs ?? 3200
  if (ms > 0) dismissTimer = window.setTimeout(close, ms)

  return { close }
}
