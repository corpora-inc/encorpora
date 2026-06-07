/**
 * food.ts — the STREET-FOOD STAND vignette (eat something real, pay real coins).
 *
 *   You walk up to the food stand → the vendor greets you in the TARGET language
 *   (real Qwen3) → you pick from the menu (pizza, tacos, fresh juice, coffee) →
 *   you PAY for it from your wallet (the taxi's graceful waive when short) → a
 *   quick order-it-in-the-target-language challenge earns the meal → and then you
 *   SEE yourself enjoy it: the dish arcs up, bites shrink it (or the cup tilts and
 *   gulps drain it), crumbs pop, a munch/sip chime plays, and a big target-language
 *   "Delicious!" lands as the payoff — the word itself is the lesson.
 *
 * Same `Vignette` seam as place/taxi/boarding; DELIBERATELY perf-zero — a flat
 * layered DOM/CSS scene (awning + counter + vendor billboard), zero world geometry.
 * The player can keep ordering (a food court visit) and leaves via the standard
 * Exit affordance. Self-contained: its OWN scoped `<style data-wp-vig-food>`.
 *
 * Single-language rule: everything the vendor SAYS and the "Delicious!" payoff are
 * TARGET-language; chrome (menu labels, prices, buttons) localizes via `t` keys
 * with inline English fallbacks.
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
import type { ChallengeContext } from "@world-plaza/contracts"

/* ------------------------------------------------------------------ menu */

export interface FoodMenuItem {
  /** catalog item id (content/items/catalog.json consumable). */
  id: string
  /** i18n key + inline English fallback for the dish name (chrome label). */
  label: [string, string]
  /** price in MINOR units of the Track's default currency. */
  price: number
  /** drives the art + the consume animation (bite vs sip). */
  art: "pizza" | "taco" | "juice" | "coffee"
}

export interface FoodOptions {
  /** The dishes this stand sells (defaults to the plaza four). */
  menu?: FoodMenuItem[]
  /** Stable id + display name for the vendor NPC (sticky voice). */
  vendorId?: string
  vendorName?: string
  /** Optional quest step satisfied by the FIRST successful order. */
  questStep?: string
}

const DEFAULT_MENU: FoodMenuItem[] = [
  { id: "food-pizza", label: ["vignette.food.item.pizza", "Pizza slice"], price: 300, art: "pizza" },
  { id: "food-taco", label: ["vignette.food.item.taco", "Taco"], price: 260, art: "taco" },
  { id: "juice-fresh", label: ["vignette.food.item.juice", "Fresh juice"], price: 200, art: "juice" },
  { id: "coffee-latte", label: ["vignette.food.item.coffee", "Coffee"], price: 180, art: "coffee" },
]

/**
 * "Delicious!" in every ship language — the payoff word IS the lesson, spoken and
 * shown in the TARGET language (single-language rule: no native gloss needed; the
 * moment teaches it). Unknown targets fall back to English.
 */
const DELICIOUS: Record<string, string> = {
  en: "Delicious!", ar: "لذيذ!", bg: "Вкусно!", bn: "খুব মজা!", ca: "Boníssim!",
  cs: "Mňam!", da: "Lækkert!", de: "Lecker!", el: "Νόστιμο!", es: "¡Delicioso!",
  fa: "خوشمزه!", fi: "Herkullista!", fr: "Délicieux !", gu: "સ્વાદિષ્ટ!", he: "טעים!",
  hi: "स्वादिष्ट!", hr: "Ukusno!", hu: "Finom!", id: "Enak!", it: "Delizioso!",
  ja: "おいしい！", ko: "맛있어요!", lt: "Skanu!", mr: "स्वादिष्ट!", ms: "Sedap!",
  ne: "मीठो!", nl: "Heerlijk!", no: "Deilig!", pa: "ਸੁਆਦੀ!", pl: "Pyszne!",
  pt: "Delicioso!", ro: "Delicios!", ru: "Вкусно!", sk: "Mňam!", sl: "Slastno!",
  sr: "Ukusno!", sv: "Läckert!", sw: "Tamu sana!", ta: "சுவையானது!", te: "రుచిగా ఉంది!",
  th: "อร่อย!", tr: "Çok lezzetli!", uk: "Смачно!", ur: "مزیدار!", vi: "Ngon quá!",
  yue: "好食呀！", zh: "好吃！",
}

export function deliciousIn(lang: string): string {
  return DELICIOUS[lang] ?? DELICIOUS[lang.split("-")[0]] ?? DELICIOUS.en
}

const LOG = "[wp/vignette/food]"

/* ------------------------------------------------------------------ vignette */

export function createFoodVignette(opts: FoodOptions = {}): Vignette {
  let disposed = false
  let npc: VignetteNpcHandle | null = null
  let cleanup: Array<() => void> = []

  function enter(ctx: VignetteContext): Promise<VignetteResult> {
    ensureFoodStyles()
    return new Promise<VignetteResult>((resolve) => {
      const { mountRoot, scene, learnerPair, reducedMotion } = ctx
      const t = (key: string, fallback: string, params?: Record<string, string | number>): string => {
        let s = ctx.t(key, params)
        if (s === key || s == null || s === "") s = fallback
        if (params) s = s.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? `{${k}}`))
        return s
      }
      const accent = scene.palette?.accent ?? "#e8b54a"
      const menu = opts.menu && opts.menu.length ? opts.menu : DEFAULT_MENU

      let settled = false
      let busy = false
      let orders = 0
      const earned: VignetteReward = { xp: 0 }
      const finish = (result: VignetteResult) => {
        if (settled) return
        settled = true
        npc?.dispose()
        npc = null
        resolve(result)
      }
      const leave = () => {
        if (orders > 0) {
          finish({ rewards: earned, ...(opts.questStep ? { questStep: opts.questStep } : {}) })
        } else {
          finish(NO_TRAVEL)
        }
      }

      registerRootHooks(mountRoot, {
        exit: leave,
        exitLabel: t("vignette.food.leave", "Step away"),
      })

      // ── the stand: awning + counter + vendor ────────────────────────────────
      const room = div("wp-vig-food")
      room.style.setProperty("--wp-food-accent", accent)
      mountRoot.appendChild(room)

      const awning = div("wp-vig-food-awning")
      for (let i = 0; i < 6; i++) awning.appendChild(div("wp-vig-food-awning__stripe"))
      room.appendChild(awning)

      const header = div("wp-vig-food-header")
      header.appendChild(textDiv("wp-vig-food-header__title", t("vignette.food.title", "Plaza Food Stand")))
      header.appendChild(textDiv("wp-vig-food-header__sub", t("vignette.food.sub", "Hot, fresh & made to order")))
      room.appendChild(header)

      const vendor = div("wp-vig-food-vendor")
      if (!reducedMotion) vendor.classList.add("wp-vig-food-vendor--sway")
      vendor.innerHTML = vendorBillboard(accent)
      room.appendChild(vendor)

      const counter = div("wp-vig-food-counter")
      room.appendChild(counter)

      // ── the menu ─────────────────────────────────────────────────────────────
      const menuBox = div("wp-vig-food-menu")
      menuBox.appendChild(textDiv("wp-vig-food-menu__title", t("vignette.food.menuTitle", "Menu")))
      const w = ctx.wallet()
      const currency = w.defaultCurrency()
      for (const item of menu) {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "wp-vig-food-item"
        const art = div("wp-vig-food-item__art")
        art.innerHTML = foodSvg(item.art)
        btn.appendChild(art)
        btn.appendChild(textDiv("wp-vig-food-item__name", t(item.label[0], item.label[1])))
        btn.appendChild(textDiv("wp-vig-food-item__price", formatPrice(item.price)))
        btn.addEventListener("click", () => void order(item, btn))
        menuBox.appendChild(btn)
      }
      room.appendChild(menuBox)

      // ── the vendor NPC (target language) ─────────────────────────────────────
      const tray = div("wp-vig-food-tray")
      room.appendChild(tray)
      npc = ctx.openNpc({
        container: tray,
        npcId: opts.vendorId ?? "food-vendor",
        npcName: opts.vendorName ?? t("vignette.food.vendor", "the street cook"),
        persona: {
          tone: "an energetic, proud street-food cook who loves feeding the neighborhood",
          quirks: [
            "recommends today's special with a flourish",
            "asks if you want it to eat here or to go",
            "beams when someone tries the local favorite",
          ],
        },
        scriptedFallback: [
          t("vignette.food.fallback.0", "Hungry? Everything's fresh off the grill!"),
          t("vignette.food.fallback.1", "One slice? Two? Say the word."),
          t("vignette.food.fallback.2", "Come back any time — the pan's always hot."),
        ],
        voiceCode: learnerPair.target,
        starterChips: [
          t("vignette.food.chip.0", "Hello!"),
          t("vignette.food.chip.1", "What's good today?"),
        ],
        onClose: () => {
          /* closing chat doesn't exit — the Exit affordance does. */
        },
      })

      async function order(item: FoodMenuItem, btn: HTMLButtonElement): Promise<void> {
        if (settled || busy) return
        busy = true
        btn.disabled = true
        try {
          // 1) PAY — the taxi's graceful-waive pattern: charge what they have,
          //    never a payment wall, the vendor covers the rest with a wink.
          const have = w.balance(currency)
          const charged = Math.min(item.price, have)
          const paid = charged > 0 ? w.debit(currency, charged) : true
          const waived = item.price - charged
          if (!paid) console.warn(`${LOG} debit declined unexpectedly`)

          // 2) EARN IT — a quick mic-free drill framed as placing the order.
          const chCtx: ChallengeContext = {
            language: learnerPair.target,
            nativeLanguage: learnerPair.native,
            mode: "solo",
          }
          let score = 1
          try {
            const res = await ctx.runChallenge({
              tool: "translate-fast",
              ctx: chCtx,
              container: mountRoot,
              npc: {
                name: opts.vendorName ?? t("vignette.food.vendor", "the street cook"),
                avatar: "",
                line: t("vignette.food.order.line", "Go on — order it!"),
              },
            })
            score = res.score
          } catch (e) {
            console.error(`${LOG} runChallenge failed:`, e)
          }
          if (settled) return

          // 3) ENJOY IT — the consume animation + the target-language payoff.
          const yum = deliciousIn(learnerPair.target)
          await playConsume(room, item, yum, waived > 0
            ? t("vignette.food.waived", "…the rest's on the house!")
            : "", reducedMotion)
          void ctx.speak(learnerPair.target, yum).catch(() => {})

          // 4) PAY OUT — xp scaled gently by the drill score (never zero — they
          //    paid, ordered, and ate; the learning happened in the drill).
          const xp = 6 + Math.round(score * 8)
          const reward: VignetteReward = { xp }
          try {
            ctx.grant(reward)
          } catch (e) {
            console.error(`${LOG} grant failed:`, e)
          }
          earned.xp = (earned.xp ?? 0) + xp
          orders++
        } finally {
          busy = false
          btn.disabled = false
        }
      }

      cleanup.push(() => room.remove())
      if (!reducedMotion) requestAnimationFrame(() => room.classList.add("wp-vig-food--in"))
      else room.classList.add("wp-vig-food--in")
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
 * The consume animation — the avatar visibly ENJOYS the food.
 * ------------------------------------------------------------------ */

/**
 * A fullscreen beat: your paper face appears, the dish arcs to your mouth, three
 * bites shrink it (crumbs pop + a munch chime each) — or a cup tilts and its
 * liquid drains in two gulps — then the big TARGET-language "Delicious!" lands.
 * Resolves when the beat ends (reduced-motion: a single quick card).
 */
function playConsume(
  room: HTMLElement,
  item: FoodMenuItem,
  yumWord: string,
  waivedNote: string,
  reducedMotion: boolean,
): Promise<void> {
  return new Promise((resolve) => {
    const layer = div("wp-vig-food-consume")
    const face = div("wp-vig-food-face")
    face.innerHTML = eaterBillboard()
    const dish = div("wp-vig-food-dish")
    dish.innerHTML = foodSvg(item.art)
    const yum = textDiv("wp-vig-food-yum", yumWord)
    layer.append(face, dish, yum)
    if (waivedNote) layer.appendChild(textDiv("wp-vig-food-waived", waivedNote))
    room.appendChild(layer)

    const done = (delay: number) => {
      window.setTimeout(() => {
        layer.classList.add("wp-vig-food-consume--out")
        window.setTimeout(() => {
          layer.remove()
          resolve()
        }, reducedMotion ? 0 : 280)
      }, delay)
    }

    if (reducedMotion) {
      layer.classList.add("wp-vig-food-consume--in")
      yum.classList.add("wp-vig-food-yum--in")
      done(900)
      return
    }

    requestAnimationFrame(() => layer.classList.add("wp-vig-food-consume--in"))
    const sip = item.art === "juice" || item.art === "coffee"
    const beats = sip ? 2 : 3
    const mouth = face.querySelector<SVGElement>("[data-mouth]")
    for (let i = 0; i < beats; i++) {
      window.setTimeout(() => {
        dish.classList.remove("wp-vig-food-dish--chomp")
        // reflow so the chomp animation retriggers per bite
        void dish.offsetWidth
        dish.classList.add("wp-vig-food-dish--chomp")
        dish.style.setProperty("--bite", String(1 - (i + 1) / (beats + (sip ? 0.5 : 0.2))))
        mouth?.setAttribute("d", i % 2 ? "M44 60 Q60 70 76 60" : "M46 58 Q60 78 74 58")
        spawnCrumbs(layer, sip)
        playMunch(sip)
      }, 520 + i * 560)
    }
    window.setTimeout(() => {
      mouth?.setAttribute("d", "M44 58 Q60 74 76 58")
      dish.classList.add("wp-vig-food-dish--gone")
      yum.classList.add("wp-vig-food-yum--in")
      playYumChime()
    }, 520 + beats * 560 + 180)
    done(520 + beats * 560 + 1500)
  })
}

function spawnCrumbs(layer: HTMLElement, sip: boolean): void {
  for (let i = 0; i < 5; i++) {
    const c = div(sip ? "wp-vig-food-crumb wp-vig-food-crumb--drop" : "wp-vig-food-crumb")
    c.style.setProperty("--dx", `${(Math.random() * 2 - 1) * 60}px`)
    c.style.setProperty("--dy", `${-(20 + Math.random() * 50)}px`)
    c.style.left = `calc(50% + ${(Math.random() * 2 - 1) * 30}px)`
    c.style.top = "46%"
    layer.appendChild(c)
    window.setTimeout(() => c.remove(), 700)
  }
}

/* ------------------------------------------------------------------ audio */

function audioCtx(): AudioContext | null {
  try {
    const AC =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    return AC ? new AC() : null
  } catch {
    return null
  }
}

/** A soft munch (filtered noise tap) or sip (descending glide). */
function playMunch(sip: boolean): void {
  const ac = audioCtx()
  if (!ac) return
  const now = ac.currentTime
  if (sip) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(420, now)
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.16)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
    osc.connect(gain).connect(ac.destination)
    osc.start(now)
    osc.stop(now + 0.24)
  } else {
    const len = Math.floor(ac.sampleRate * 0.09)
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ac.createBufferSource()
    src.buffer = buf
    const filter = ac.createBiquadFilter()
    filter.type = "lowpass"
    filter.frequency.value = 750
    const gain = ac.createGain()
    gain.gain.value = 0.16
    src.connect(filter).connect(gain).connect(ac.destination)
    src.start(now)
  }
  window.setTimeout(() => void ac.close().catch(() => {}), 420)
}

/** The warm two-note "that was good" resolve (the serve-ding family). */
function playYumChime(): void {
  const ac = audioCtx()
  if (!ac) return
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
  tone(523.25, 0, 0.18) // C5
  tone(783.99, 0.11, 0.3) // G5 — satisfied
  window.setTimeout(() => void ac.close().catch(() => {}), 700)
}

/* ------------------------------------------------------------------ art */

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

/** Format a minor-units price compactly ("3.00" → keep it simple: majors). */
function formatPrice(minor: number): string {
  const major = minor / 100
  return Number.isInteger(major) ? String(major) : major.toFixed(2)
}

/** The eater: a happy paper face (the player's stand-in for the beat). */
function eaterBillboard(): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet">
  <circle cx="60" cy="60" r="44" fill="#e9c08f"/>
  <path d="M20 56 Q24 26 60 26 Q96 26 100 56 Q86 42 60 42 Q34 42 20 56 Z" fill="#3a2a1c"/>
  <circle cx="46" cy="58" r="4" fill="#2b2117"/>
  <circle cx="74" cy="58" r="4" fill="#2b2117"/>
  <circle cx="38" cy="70" r="6" fill="#e3856a" opacity="0.5"/>
  <circle cx="82" cy="70" r="6" fill="#e3856a" opacity="0.5"/>
  <path data-mouth d="M44 70 Q60 80 76 70" stroke="#7a3b28" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>`
}

/** The vendor behind the counter — apron + bandana, accent on the band. */
function vendorBillboard(accent: string): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 170" preserveAspectRatio="xMidYMax meet">
  <path d="M22 170 L22 96 Q22 78 44 74 L76 74 Q98 78 98 96 L98 170 Z" fill="#5b4636"/>
  <path d="M44 96 L76 96 L82 170 L38 170 Z" fill="#efe6d4"/>
  <rect x="38" y="112" width="44" height="7" rx="3" fill="${accent}"/>
  <rect x="52" y="62" width="16" height="18" rx="6" fill="#a9805d"/>
  <circle cx="60" cy="46" r="22" fill="#c9a07a"/>
  <path d="M37 38 Q39 24 60 24 Q81 24 83 38 L83 44 Q70 36 60 36 Q50 36 37 44 Z" fill="${accent}"/>
  <circle cx="51" cy="48" r="2.6" fill="#2b2117"/>
  <circle cx="69" cy="48" r="2.6" fill="#2b2117"/>
  <path d="M51 57 Q60 64 69 57" stroke="#7a4a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
</svg>`
}

/** Flat paper-style dish art (no emoji — the procedural-icon discipline). */
export function foodSvg(art: FoodMenuItem["art"]): string {
  switch (art) {
    case "pizza":
      return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M50 92 L12 18 Q50 4 88 18 Z" fill="#f0c350"/>
  <path d="M50 92 L17 22 Q50 10 83 22 Z" fill="#e8893a"/>
  <path d="M12 18 Q50 4 88 18 L84 27 Q50 14 16 27 Z" fill="#c96f2e"/>
  <circle cx="44" cy="36" r="6.5" fill="#b3402e"/>
  <circle cx="62" cy="48" r="6" fill="#b3402e"/>
  <circle cx="48" cy="62" r="5.5" fill="#b3402e"/>
</svg>`
    case "taco":
      return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M8 64 Q50 -8 92 64 L92 70 Q50 88 8 70 Z" fill="#e8b54a"/>
  <path d="M14 62 Q50 2 86 62 Q50 76 14 62 Z" fill="#d99a36"/>
  <path d="M20 58 Q34 40 48 50 Q62 38 80 56 Q60 64 50 60 Q36 66 20 58 Z" fill="#7da348"/>
  <circle cx="40" cy="52" r="4" fill="#b3402e"/>
  <circle cx="58" cy="50" r="4" fill="#b3402e"/>
</svg>`
    case "juice":
      return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M30 18 L70 18 L65 88 L35 88 Z" fill="#f3ece0" opacity="0.55"/>
  <path data-liquid d="M33 34 L67 34 L63.5 84 L36.5 84 Z" fill="#e8893a"/>
  <rect x="56" y="2" width="5" height="30" rx="2.5" fill="#c0455a" transform="rotate(12 58 17)"/>
  <circle cx="44" cy="50" r="3" fill="#f0c350" opacity="0.8"/>
  <circle cx="54" cy="62" r="2.5" fill="#f0c350" opacity="0.8"/>
</svg>`
    case "coffee":
      return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M24 34 L76 34 L70 88 L30 88 Z" fill="#f3ece0"/>
  <path data-liquid d="M28 40 L72 40 L68 60 L32 60 Z" fill="#6e4a2f"/>
  <path d="M76 40 Q92 44 84 58 Q80 64 70 62" fill="none" stroke="#f3ece0" stroke-width="6"/>
  <path d="M40 26 Q42 18 40 12 M52 26 Q54 18 52 12 M64 26 Q66 18 64 12"
        stroke="#cdbfa8" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>
</svg>`
  }
}

/* ------------------------------------------------------------------ styles */

let foodStylesInjected = false
function ensureFoodStyles(): void {
  if (foodStylesInjected || typeof document === "undefined") return
  if (document.querySelector("style[data-wp-vig-food]")) {
    foodStylesInjected = true
    return
  }
  foodStylesInjected = true
  const style = document.createElement("style")
  style.setAttribute("data-wp-vig-food", "")
  style.textContent = FOOD_CSS
  document.head.appendChild(style)
}

const FOOD_CSS = `
.wp-vig-food {
  position: absolute; inset: 0; overflow: hidden;
  font: 400 15px/1.4 ui-sans-serif, system-ui, sans-serif;
  opacity: 0; transition: opacity 0.34s ease;
  background: linear-gradient(180deg, #7a5a8c 0%, #b56a5a 38%, #5a3c25 38%, #43301e 100%);
}
.wp-vig-food--in { opacity: 1; }
.wp-vig-food-awning {
  position: absolute; top: 0; left: 6%; right: 6%; height: 16%;
  display: flex; border-radius: 0 0 18px 18px; overflow: hidden;
  box-shadow: 0 10px 24px rgba(0,0,0,0.3);
}
.wp-vig-food-awning__stripe { flex: 1; background: #f3ece0; }
.wp-vig-food-awning__stripe:nth-child(even) { background: var(--wp-food-accent, #e8b54a); }
.wp-vig-food-header {
  position: absolute; top: calc(env(safe-area-inset-top, 0px) + 12px); left: 50%; transform: translateX(-50%);
  text-align: center; z-index: 3;
  background: rgba(20,14,9,0.78); color: #f3ece0;
  padding: 8px 22px; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.3);
}
.wp-vig-food-header__title { font: 800 clamp(16px, 2.6vw, 24px)/1.1 ui-sans-serif, system-ui, sans-serif; }
.wp-vig-food-header__sub {
  font: 500 clamp(12px, 1.6vw, 15px)/1.2 ui-sans-serif, system-ui, sans-serif;
  color: var(--wp-food-accent, #e8b54a); margin-top: 3px;
}
.wp-vig-food-vendor {
  position: absolute; bottom: 34%; left: 24%; transform: translateX(-50%);
  width: clamp(120px, 20vw, 190px); aspect-ratio: 12 / 17;
  filter: drop-shadow(0 12px 10px rgba(0,0,0,0.32)); z-index: 2;
}
.wp-vig-food-vendor svg { width: 100%; height: 100%; }
.wp-vig-food-vendor--sway { animation: wp-vig-food-sway 3.6s ease-in-out infinite alternate; transform-origin: 50% 100%; }
@keyframes wp-vig-food-sway { from { transform: translateX(-50%) rotate(-1.2deg); } to { transform: translateX(-50%) rotate(1.2deg); } }
.wp-vig-food-counter {
  position: absolute; left: 0; right: 0; bottom: 30%; height: 12%;
  background: linear-gradient(180deg, #7a5230, #5e3f24);
  box-shadow: 0 -3px 0 rgba(255,255,255,0.08), 0 8px 18px rgba(0,0,0,0.3);
}
.wp-vig-food-menu {
  position: absolute; right: 6%; top: 22%; width: clamp(220px, 38vw, 340px);
  background: #20170f; border-radius: 12px; padding: 14px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.35), inset 0 0 0 5px #34261a;
  z-index: 4;
}
.wp-vig-food-menu__title {
  font: 800 clamp(14px, 2vw, 19px)/1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--wp-food-accent, #e8b54a); margin-bottom: 10px;
}
.wp-vig-food-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  margin: 6px 0; padding: 8px 10px; min-height: 50px;
  border: none; border-radius: 10px; cursor: pointer;
  background: rgba(240,227,200,0.1); color: #f0e3c8; text-align: start;
  font: 600 clamp(14px, 1.8vw, 17px)/1.2 ui-sans-serif, system-ui, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
.wp-vig-food-item:active { transform: scale(0.97); }
.wp-vig-food-item:disabled { opacity: 0.55; pointer-events: none; }
.wp-vig-food-item__art { width: 38px; height: 38px; flex: none; }
.wp-vig-food-item__art svg { width: 100%; height: 100%; }
.wp-vig-food-item__name { flex: 1; }
.wp-vig-food-item__price {
  font-weight: 800; color: var(--wp-food-accent, #e8b54a);
  background: rgba(0,0,0,0.35); border-radius: 999px; padding: 4px 10px;
}
.wp-vig-food-tray { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; }
@media (hover: hover) and (pointer: fine) {
  .wp-vig-food-item { transition: background 0.16s ease, transform 0.1s ease; }
  .wp-vig-food-item:hover { background: rgba(240,227,200,0.18); }
}

/* ── the consume beat ── */
.wp-vig-food-consume {
  position: absolute; inset: 0; z-index: 8;
  background: rgba(18,12,8,0.82);
  opacity: 0; transition: opacity 0.26s ease;
}
.wp-vig-food-consume--in { opacity: 1; }
.wp-vig-food-consume--out { opacity: 0; }
.wp-vig-food-face {
  position: absolute; top: 26%; left: 50%; transform: translateX(-50%);
  width: clamp(120px, 22vw, 180px); aspect-ratio: 1;
  filter: drop-shadow(0 10px 12px rgba(0,0,0,0.4));
}
.wp-vig-food-face svg { width: 100%; height: 100%; }
.wp-vig-food-dish {
  position: absolute; top: 46%; left: 50%;
  width: clamp(70px, 13vw, 110px); aspect-ratio: 1;
  transform: translate(-50%, 0) scale(var(--bite, 1));
  transition: transform 0.3s ease;
  filter: drop-shadow(0 8px 10px rgba(0,0,0,0.4));
}
.wp-vig-food-dish svg { width: 100%; height: 100%; }
.wp-vig-food-dish--chomp { animation: wp-vig-food-chomp 0.34s ease; }
@keyframes wp-vig-food-chomp {
  0% { transform: translate(-50%, 0) scale(var(--bite, 1)) rotate(0deg); }
  35% { transform: translate(-50%, -16px) scale(var(--bite, 1)) rotate(-7deg); }
  100% { transform: translate(-50%, 0) scale(var(--bite, 1)) rotate(0deg); }
}
.wp-vig-food-dish--gone { transform: translate(-50%, 0) scale(0); opacity: 0; transition: transform 0.3s ease, opacity 0.3s ease; }
.wp-vig-food-crumb {
  position: absolute; width: 7px; height: 7px; border-radius: 50%;
  background: #e8b54a; pointer-events: none;
  animation: wp-vig-food-crumb 0.65s ease-out forwards;
}
.wp-vig-food-crumb--drop { background: #9ecbe8; }
@keyframes wp-vig-food-crumb {
  from { opacity: 1; transform: translate(0, 0) scale(1); }
  to { opacity: 0; transform: translate(var(--dx, 20px), var(--dy, -40px)) scale(0.4); }
}
.wp-vig-food-yum {
  position: absolute; top: 64%; left: 50%; transform: translate(-50%, 8px) scale(0.9);
  font: 900 clamp(28px, 6vw, 52px)/1.1 ui-sans-serif, system-ui, sans-serif;
  color: var(--wp-food-accent, #e8b54a); text-align: center;
  text-shadow: 0 4px 14px rgba(0,0,0,0.5);
  opacity: 0; transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.wp-vig-food-yum--in { opacity: 1; transform: translate(-50%, 0) scale(1); }
.wp-vig-food-waived {
  position: absolute; top: 78%; left: 50%; transform: translateX(-50%);
  font: 600 clamp(13px, 2vw, 17px)/1.3 ui-sans-serif, system-ui, sans-serif;
  color: #f0e3c8; opacity: 0.9; text-align: center;
}
@media (prefers-reduced-motion: reduce) {
  .wp-vig-food, .wp-vig-food-vendor--sway, .wp-vig-food-dish--chomp, .wp-vig-food-crumb { animation: none; transition: none; }
}
`
