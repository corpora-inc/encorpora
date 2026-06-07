/**
 * vacation.ts — the AIRPORT VACATION MONTAGE (a week abroad in forty seconds).
 *
 *   At the airport you choose VACATION instead of a local hop → pick a real city
 *   from the international board (Paris, London, Beirut, Singapore, Kinshasa,
 *   Mexico City, Tokyo, Nairobi) → pay the fare (the taxi's graceful waive) →
 *   tell the gate agent where you're flying (a quick target-language drill) →
 *   TAKEOFF → two postcard beats over the city's skyline, each speaking a
 *   target-language postcard phrase ("Greetings from Paris!" — the phrase IS the
 *   lesson) → "(one week later)" → the flight home → "Welcome back home to
 *   Corpan City", a souvenir in your bag, and a little XP.
 *
 * Round trip by design: resolves with NO `travelTo` — you end exactly where you
 * boarded. Pure DOM/CSS (paper-flat skyline postcards inline below), the same
 * perf-zero seam as boarding/place/food. Self-contained scoped styles.
 *
 * Single-language rule: spoken/learning copy (the postcard phrases) is TARGET
 * language; chrome ("one week later", buttons) localizes via `t` keys.
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

/* ------------------------------------------------------------ destinations */

export type VacationCity =
  | "paris" | "london" | "beirut" | "singapore"
  | "kinshasa" | "mexico-city" | "tokyo" | "nairobi"

export interface VacationDestination {
  id: VacationCity
  /** Display name — a proper noun, shown as-is on the board + postcards. */
  city: string
  /** fare in MINOR units of the default currency. */
  fare: number
  /** souvenir item id granted on return (content/items/catalog.json). */
  souvenir: string
}

export interface VacationOptions {
  destinations?: VacationDestination[]
  agentId?: string
  agentName?: string
  /** Optional quest step satisfied by completing a trip. */
  questStep?: string
}

export const VACATION_DESTINATIONS: VacationDestination[] = [
  { id: "paris", city: "Paris", fare: 520, souvenir: "souvenir-paris" },
  { id: "london", city: "London", fare: 520, souvenir: "souvenir-london" },
  { id: "beirut", city: "Beirut", fare: 480, souvenir: "souvenir-beirut" },
  { id: "singapore", city: "Singapore", fare: 560, souvenir: "souvenir-singapore" },
  { id: "kinshasa", city: "Kinshasa", fare: 540, souvenir: "souvenir-kinshasa" },
  { id: "mexico-city", city: "Mexico City", fare: 500, souvenir: "souvenir-mexico-city" },
  { id: "tokyo", city: "Tokyo", fare: 560, souvenir: "souvenir-tokyo" },
  { id: "nairobi", city: "Nairobi", fare: 520, souvenir: "souvenir-nairobi" },
]

/* --------------------------------------------------- target-language copy */

/**
 * "Greetings from {city}!" — the classic postcard line, in every ship language.
 * Spoken AND shown in the TARGET language: the phrase is the lesson the trip
 * teaches. `{city}` stays a proper noun.
 */
const GREETINGS: Record<string, string> = {
  en: "Greetings from {city}!", ar: "تحياتي من {city}!", bg: "Поздрави от {city}!",
  bn: "{city} থেকে শুভেচ্ছা!", ca: "Salutacions des de {city}!", cs: "Pozdrav z {city}!",
  da: "Hilsner fra {city}!", de: "Grüße aus {city}!", el: "Χαιρετίσματα από {city}!",
  es: "¡Saludos desde {city}!", fa: "درود از {city}!", fi: "Terveisiä {city}ista!",
  fr: "Salutations de {city} !", gu: "{city}થી શુભેચ્છાઓ!", he: "דרישת שלום מ{city}!",
  hi: "{city} से नमस्ते!", hr: "Pozdrav iz {city}!", hu: "Üdvözlet {city}ból!",
  id: "Salam dari {city}!", it: "Saluti da {city}!", ja: "{city}からこんにちは！",
  ko: "{city}에서 인사드려요!", lt: "Linkėjimai iš {city}!", mr: "{city}हून नमस्कार!",
  ms: "Salam dari {city}!", ne: "{city}बाट नमस्ते!", nl: "Groeten uit {city}!",
  no: "Hilsen fra {city}!", pa: "{city} ਤੋਂ ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ!", pl: "Pozdrowienia z {city}!",
  pt: "Saudações de {city}!", ro: "Salutări din {city}!", ru: "Привет из {city}!",
  sk: "Pozdrav z {city}!", sl: "Pozdrav iz {city}!", sr: "Pozdrav iz {city}!",
  sv: "Hälsningar från {city}!", sw: "Salamu kutoka {city}!", ta: "{city}யிலிருந்து வணக்கம்!",
  te: "{city} నుండి శుభాకాంక్షలు!", th: "สวัสดีจาก{city}!", tr: "{city}'den selamlar!",
  uk: "Вітання з {city}!", ur: "{city} سے سلام!", vi: "Lời chào từ {city}!",
  yue: "嚟自{city}嘅問候！", zh: "来自{city}的问候！",
}

/** "How beautiful!" — the second postcard beat's sigh, in every ship language. */
const HOW_BEAUTIFUL: Record<string, string> = {
  en: "How beautiful!", ar: "ما أجمله!", bg: "Колко е красиво!", bn: "কী সুন্দর!",
  ca: "Que bonic!", cs: "To je krása!", da: "Hvor smukt!", de: "Wie schön!",
  el: "Τι όμορφα!", es: "¡Qué bonito!", fa: "چه زیبا!", fi: "Miten kaunista!",
  fr: "Que c'est beau !", gu: "કેટલું સુંદર!", he: "כמה יפה!", hi: "कितना सुंदर!",
  hr: "Kako lijepo!", hu: "Milyen gyönyörű!", id: "Indah sekali!", it: "Che bello!",
  ja: "なんてきれい！", ko: "정말 아름다워요!", lt: "Kaip gražu!", mr: "किती सुंदर!",
  ms: "Cantiknya!", ne: "कति राम्रो!", nl: "Wat mooi!", no: "Så vakkert!",
  pa: "ਕਿੰਨਾ ਸੋਹਣਾ!", pl: "Jak pięknie!", pt: "Que lindo!", ro: "Ce frumos!",
  ru: "Как красиво!", sk: "Aké krásne!", sl: "Kako lepo!", sr: "Kako lepo!",
  sv: "Så vackert!", sw: "Nzuri sana!", ta: "எவ்வளவு அழகு!", te: "ఎంత అందంగా ఉంది!",
  th: "สวยจังเลย!", tr: "Ne kadar güzel!", uk: "Як гарно!", ur: "کتنا خوبصورت!",
  vi: "Đẹp quá!", yue: "好靚呀！", zh: "真美啊！",
}

export function postcardGreeting(lang: string, city: string): string {
  const tpl = GREETINGS[lang] ?? GREETINGS[lang.split("-")[0]] ?? GREETINGS.en
  return tpl.replace("{city}", city)
}
export function postcardSigh(lang: string): string {
  return HOW_BEAUTIFUL[lang] ?? HOW_BEAUTIFUL[lang.split("-")[0]] ?? HOW_BEAUTIFUL.en
}

const LOG = "[wp/vignette/vacation]"

/* ----------------------------------------------------------------- vignette */

export function createVacationVignette(opts: VacationOptions = {}): Vignette {
  let disposed = false
  let npc: VignetteNpcHandle | null = null
  let cleanup: Array<() => void> = []
  let timers: number[] = []

  const later = (fn: () => void, ms: number): void => {
    timers.push(window.setTimeout(fn, ms))
  }

  function enter(ctx: VignetteContext): Promise<VignetteResult> {
    ensureVacationStyles()
    return new Promise<VignetteResult>((resolve) => {
      const { mountRoot, scene, learnerPair, reducedMotion } = ctx
      const t = (key: string, fallback: string, params?: Record<string, string | number>): string => {
        let s = ctx.t(key, params)
        if (s === key || s == null || s === "") s = fallback
        if (params) s = s.replace(/\{(\w+)\}/g, (_m, k) => String(params[k] ?? `{${k}}`))
        return s
      }
      const accent = scene.palette?.accent ?? "#e8b54a"
      const destinations = opts.destinations && opts.destinations.length
        ? opts.destinations
        : VACATION_DESTINATIONS

      let settled = false
      let traveling = false
      const finish = (result: VignetteResult) => {
        if (settled) return
        settled = true
        npc?.dispose()
        npc = null
        resolve(result)
      }

      registerRootHooks(mountRoot, {
        exit: () => {
          // mid-montage the Exit still leaves cleanly (rewards already granted)
          finish(NO_TRAVEL)
        },
        exitLabel: t("vignette.vacation.leave", "Back to the terminal"),
      })

      // ── the international gate ───────────────────────────────────────────────
      const hall = div("wp-vig-vac")
      hall.style.setProperty("--wp-vac-accent", accent)
      mountRoot.appendChild(hall)

      const header = div("wp-vig-vac-header")
      header.appendChild(textDiv("wp-vig-vac-header__title", t("vignette.vacation.title", "International Departures")))
      header.appendChild(textDiv("wp-vig-vac-header__sub", t("vignette.vacation.sub", "Pick a city — a week away, back before you know it")))
      hall.appendChild(header)

      const board = div("wp-vig-vac-board")
      for (const dest of destinations) {
        const card = document.createElement("button")
        card.type = "button"
        card.className = "wp-vig-vac-card"
        const sky = div("wp-vig-vac-card__sky")
        sky.innerHTML = citySkyline(dest.id, "day")
        card.appendChild(sky)
        card.appendChild(textDiv("wp-vig-vac-card__name", dest.city))
        card.appendChild(textDiv("wp-vig-vac-card__fare", formatPrice(dest.fare)))
        card.addEventListener("click", () => void fly(dest, card))
        board.appendChild(card)
      }
      hall.appendChild(board)

      // the gate agent (target language)
      const tray = div("wp-vig-vac-tray")
      hall.appendChild(tray)
      npc = ctx.openNpc({
        container: tray,
        npcId: opts.agentId ?? "vacation-gate-agent",
        npcName: opts.agentName ?? t("vignette.vacation.agent", "the gate agent"),
        persona: {
          tone: "a calm, well-traveled airport gate agent who adores faraway cities",
          quirks: [
            "asks where you're dreaming of going",
            "shares one tiny travel tip about the city you pick",
            "wishes every traveler a wonderful trip",
          ],
        },
        scriptedFallback: [
          t("vignette.vacation.fallback.0", "Where to today? The whole world's on the board."),
          t("vignette.vacation.fallback.1", "Window seat or aisle?"),
          t("vignette.vacation.fallback.2", "Have a wonderful trip — send a postcard!"),
        ],
        voiceCode: learnerPair.target,
        starterChips: [
          t("vignette.vacation.chip.0", "Hello!"),
          t("vignette.vacation.chip.1", "Where should I go?"),
        ],
        onClose: () => {},
      })

      async function fly(dest: VacationDestination, card: HTMLButtonElement): Promise<void> {
        if (settled || traveling) return
        traveling = true
        card.disabled = true
        try {
          // 1) FARE — graceful waive, never a wall.
          const w = ctx.wallet()
          const currency = w.defaultCurrency()
          const have = w.balance(currency)
          const charged = Math.min(dest.fare, have)
          if (charged > 0) w.debit(currency, charged)

          // 2) TELL THE AGENT — a quick mic-free drill before boarding.
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
                name: opts.agentName ?? t("vignette.vacation.agent", "the gate agent"),
                avatar: "",
                line: t("vignette.vacation.gate.line", "Ready? Tell me about your trip."),
              },
            })
            score = res.score
          } catch (e) {
            console.error(`${LOG} runChallenge failed:`, e)
          }
          if (settled) return

          // 3) THE MONTAGE — takeoff → postcards → "(one week later)" → home.
          await runMontage(dest, score)
        } finally {
          traveling = false
          card.disabled = false
        }
      }

      function beat(build: (card: HTMLElement) => void, holdMs: number): Promise<void> {
        return new Promise((res) => {
          if (settled) {
            res()
            return
          }
          const card = div("wp-vig-vac-beat")
          build(card)
          hall.appendChild(card)
          const show = () => card.classList.add("wp-vig-vac-beat--in")
          if (reducedMotion) show()
          else requestAnimationFrame(show)
          let done = false
          const end = () => {
            if (done) return
            done = true
            card.classList.remove("wp-vig-vac-beat--in")
            later(() => {
              card.remove()
              res()
            }, reducedMotion ? 0 : 300)
          }
          card.addEventListener("click", end) // tap to skip ahead
          later(end, reducedMotion ? Math.min(holdMs, 1100) : holdMs)
        })
      }

      async function runMontage(dest: VacationDestination, score: number): Promise<void> {
        const target = learnerPair.target

        // TAKEOFF
        playWhoosh()
        await beat((card) => {
          card.classList.add("wp-vig-vac-beat--sky")
          const plane = div("wp-vig-vac-plane")
          plane.innerHTML = planeSvg()
          if (!reducedMotion) plane.classList.add("wp-vig-vac-plane--up")
          card.appendChild(plane)
          card.appendChild(textDiv("wp-vig-vac-beat__chrome", t("vignette.vacation.takeoff", "Boarding… and away!")))
        }, 2100)
        if (settled) return

        // POSTCARD 1 — the skyline + the greeting (target language: the lesson)
        const greeting = postcardGreeting(target, dest.city)
        void ctx.speak(target, greeting).catch(() => {})
        await beat((card) => {
          card.appendChild(postcard(dest, "day", greeting))
        }, 3000)
        if (settled) return

        // POSTCARD 2 — dusk + the sigh
        const sigh = postcardSigh(target)
        void ctx.speak(target, sigh).catch(() => {})
        await beat((card) => {
          card.appendChild(postcard(dest, "dusk", sigh))
        }, 2700)
        if (settled) return

        // (ONE WEEK LATER) — pure chrome
        await beat((card) => {
          card.classList.add("wp-vig-vac-beat--dark")
          card.appendChild(textDiv("wp-vig-vac-week", t("vignette.vacation.weekLater", "( one week later )")))
        }, 2000)
        if (settled) return

        // THE FLIGHT HOME
        playWhoosh()
        await beat((card) => {
          card.classList.add("wp-vig-vac-beat--sky")
          const plane = div("wp-vig-vac-plane")
          plane.innerHTML = planeSvg()
          if (!reducedMotion) plane.classList.add("wp-vig-vac-plane--down")
          card.appendChild(plane)
          card.appendChild(textDiv("wp-vig-vac-beat__chrome", t("vignette.vacation.flyHome", "Homeward bound…")))
        }, 2100)
        if (settled) return

        // WELCOME HOME + the payout
        const xp = 24 + Math.round(score * 16)
        const reward: VignetteReward = { xp, items: [dest.souvenir] }
        try {
          ctx.grant(reward)
        } catch (e) {
          console.error(`${LOG} grant failed:`, e)
        }
        playHomeChime()
        await beat((card) => {
          card.classList.add("wp-vig-vac-beat--home")
          card.appendChild(textDiv("wp-vig-vac-welcome", t("vignette.vacation.welcomeBack", "Welcome back home to Corpan City!")))
          card.appendChild(textDiv("wp-vig-vac-souvenir", t("vignette.vacation.souvenir", "A souvenir from {city} is in your bag.", { city: dest.city })))
        }, 3000)

        finish({
          rewards: reward,
          ...(opts.questStep ? { questStep: opts.questStep } : {}),
        })
      }

      cleanup.push(() => hall.remove())
      if (!reducedMotion) requestAnimationFrame(() => hall.classList.add("wp-vig-vac--in"))
      else hall.classList.add("wp-vig-vac--in")
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

function postcard(dest: VacationDestination, mood: "day" | "dusk", caption: string): HTMLElement {
  const pc = div("wp-vig-vac-postcard")
  const sky = div(`wp-vig-vac-postcard__sky wp-vig-vac-postcard__sky--${mood}`)
  sky.innerHTML = citySkyline(dest.id, mood)
  pc.appendChild(sky)
  pc.appendChild(textDiv("wp-vig-vac-postcard__stamp", "✈"))
  pc.appendChild(textDiv("wp-vig-vac-postcard__caption", caption))
  pc.appendChild(textDiv("wp-vig-vac-postcard__city", dest.city))
  return pc
}

/** The little paper plane. */
function planeSvg(): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60">
  <path d="M6 34 L84 22 Q98 21 106 28 L96 34 Z" fill="#f3ece0"/>
  <path d="M48 26 L64 8 L74 9 L60 25 Z" fill="#e0d5c2"/>
  <path d="M44 33 L58 44 L66 43 L54 32 Z" fill="#e0d5c2"/>
  <path d="M96 34 L106 28 Q110 31 106 34 Z" fill="#c0455a"/>
  <circle cx="30" cy="30" r="2.4" fill="#9ecbe8"/>
  <circle cx="42" cy="29" r="2.4" fill="#9ecbe8"/>
  <circle cx="54" cy="28" r="2.4" fill="#9ecbe8"/>
</svg>`
}

/**
 * Flat paper skylines — one iconic silhouette per city, drawn in the postcard's
 * warm two-tone language (a dark silhouette band over a glow). Dignified and
 * minimal: a recognizable shape, never a caricature of a place.
 */
export function citySkyline(city: VacationCity, mood: "day" | "dusk"): string {
  const ink = mood === "day" ? "#3a4a5a" : "#2a2438"
  const lit = mood === "day" ? "#ffd99a" : "#ff9a76"
  switch (city) {
    case "paris": // the Eiffel Tower over Haussmann rooftops
      return sky(lit, `
<path d="M0 78 L14 78 L14 64 L30 64 L30 78 L42 78 L42 70 L56 70 L56 78 L100 78 L100 86 L0 86 Z" fill="${ink}" opacity="0.7"/>
<path d="M62 16 L66 16 L72 52 L80 78 L74 78 Q64 60 64 52 Q64 60 54 78 L48 78 L56 52 Z" fill="${ink}"/>
<path d="M50 62 Q64 54 78 62" stroke="${ink}" stroke-width="2.5" fill="none"/>
<path d="M54 42 Q64 37 74 42" stroke="${ink}" stroke-width="2" fill="none"/>`)
    case "london": // Big Ben + the river skyline
      return sky(lit, `
<path d="M0 80 L20 80 L20 66 L34 66 L34 80 L88 80 L88 86 L0 86 Z" fill="${ink}" opacity="0.7"/>
<rect x="44" y="26" width="12" height="54" fill="${ink}"/>
<path d="M42 26 L50 12 L58 26 Z" fill="${ink}"/>
<rect x="46.5" y="34" width="7" height="7" rx="1" fill="${lit}"/>
<path d="M64 80 Q70 56 78 80 Z" fill="${ink}" opacity="0.85"/>`)
    case "beirut": // Pigeon Rocks in the bay + the corniche
      return sky(lit, `
<path d="M0 70 L36 70 L36 60 L48 60 L48 70 L62 70 L62 64 L72 64 L72 70 L100 70 L100 74 L0 74 Z" fill="${ink}" opacity="0.7"/>
<path d="M20 86 Q16 64 30 60 Q40 58 38 70 Q36 80 32 86 Z" fill="${ink}"/>
<path d="M44 86 Q42 72 50 68 Q56 66 54 76 Q53 82 50 86 Z" fill="${ink}" opacity="0.9"/>
<path d="M0 86 L100 86 L100 80 Q50 74 0 80 Z" fill="${ink}" opacity="0.45"/>`)
    case "singapore": // Marina Bay Sands + the garden domes
      return sky(lit, `
<path d="M0 80 L12 80 L12 60 L20 60 L20 80 L84 80 L84 86 L0 86 Z" fill="${ink}" opacity="0.7"/>
<rect x="34" y="44" width="9" height="36" fill="${ink}"/>
<rect x="48" y="44" width="9" height="36" fill="${ink}"/>
<rect x="62" y="44" width="9" height="36" fill="${ink}"/>
<path d="M28 44 Q52 30 78 44 L78 40 Q52 26 28 40 Z" fill="${ink}"/>
<path d="M84 80 Q88 68 94 80 Z" fill="${ink}" opacity="0.85"/>`)
    case "kinshasa": // the Congo River bend + the tower blocks
      return sky(lit, `
<path d="M8 80 L8 52 L18 52 L18 80 Z M24 80 L24 60 L32 60 L32 80 Z M38 80 L38 46 L50 46 L50 80 Z M56 80 L56 58 L64 58 L64 80 Z" fill="${ink}"/>
<path d="M70 80 Q78 62 88 80 Z" fill="${ink}" opacity="0.85"/>
<path d="M0 86 Q30 80 56 84 Q80 88 100 82 L100 92 L0 92 Z" fill="${ink}" opacity="0.5"/>
<circle cx="44" cy="40" r="3" fill="${lit}"/>`)
    case "mexico-city": // the Angel of Independence + the cathedral domes
      return sky(lit, `
<path d="M0 80 L26 80 L26 64 L40 64 L40 80 L96 80 L96 86 L0 86 Z" fill="${ink}" opacity="0.7"/>
<rect x="56" y="34" width="6" height="46" fill="${ink}"/>
<circle cx="59" cy="28" r="5" fill="${lit}" stroke="${ink}" stroke-width="1.6"/>
<path d="M74 80 Q80 62 88 80 Z M70 80 Q74 70 78 80 Z" fill="${ink}" opacity="0.9"/>
<path d="M18 64 Q26 52 34 64 Z" fill="${ink}" opacity="0.85"/>`)
    case "tokyo": // Tokyo Tower over the dense skyline
      return sky(lit, `
<path d="M0 80 L16 80 L16 62 L26 62 L26 80 L36 80 L36 70 L46 70 L46 80 L92 80 L92 86 L0 86 Z" fill="${ink}" opacity="0.7"/>
<path d="M64 18 L68 18 L76 80 L70 80 Q66 56 66 48 Q66 56 62 80 L56 80 Z" fill="${ink}"/>
<path d="M56 58 Q66 52 76 58" stroke="${ink}" stroke-width="2.4" fill="none"/>
<rect x="64" y="12" width="4" height="8" fill="${ink}"/>`)
    case "nairobi": // the KICC drum + an acacia on the savanna edge
      return sky(lit, `
<path d="M0 80 L18 80 L18 66 L28 66 L28 80 L72 80 L72 86 L0 86 Z" fill="${ink}" opacity="0.7"/>
<rect x="40" y="38" width="14" height="42" rx="7" fill="${ink}"/>
<path d="M38 38 L56 38 L47 28 Z" fill="${ink}"/>
<path d="M80 80 L80 64 M80 64 Q70 58 66 62 M80 64 Q92 56 96 62" stroke="${ink}" stroke-width="2.6" fill="none"/>
<path d="M64 60 Q80 50 98 60 L98 64 Q80 56 64 64 Z" fill="${ink}"/>`)
  }
}

/** Wrap silhouette markup in the shared postcard sky frame. */
function sky(glow: string, inner: string): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 92" preserveAspectRatio="xMidYMax slice">
  <circle cx="76" cy="22" r="10" fill="${glow}"/>
  ${inner}
</svg>`
}

/* ------------------------------------------------------------------- audio */

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

/** A soft filtered-noise whoosh for takeoff/landing. */
function playWhoosh(): void {
  const ac = audioCtx()
  if (!ac) return
  const now = ac.currentTime
  const len = Math.floor(ac.sampleRate * 0.7)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) {
    const env = Math.sin((i / len) * Math.PI)
    data[i] = (Math.random() * 2 - 1) * env * 0.7
  }
  const src = ac.createBufferSource()
  src.buffer = buf
  const filter = ac.createBiquadFilter()
  filter.type = "bandpass"
  filter.frequency.setValueAtTime(300, now)
  filter.frequency.exponentialRampToValueAtTime(1400, now + 0.7)
  filter.Q.value = 1.4
  const gain = ac.createGain()
  gain.gain.value = 0.1
  src.connect(filter).connect(gain).connect(ac.destination)
  src.start(now)
  window.setTimeout(() => void ac.close().catch(() => {}), 1000)
}

/** The warm three-note "home again" resolve. */
function playHomeChime(): void {
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
  tone(523.25, 0, 0.2) // C5
  tone(659.25, 0.12, 0.2) // E5
  tone(783.99, 0.24, 0.34) // G5 — home
  window.setTimeout(() => void ac.close().catch(() => {}), 900)
}

/* ------------------------------------------------------------------ styles */

let vacationStylesInjected = false
function ensureVacationStyles(): void {
  if (vacationStylesInjected || typeof document === "undefined") return
  if (document.querySelector("style[data-wp-vig-vacation]")) {
    vacationStylesInjected = true
    return
  }
  vacationStylesInjected = true
  const style = document.createElement("style")
  style.setAttribute("data-wp-vig-vacation", "")
  style.textContent = VACATION_CSS
  document.head.appendChild(style)
}

const VACATION_CSS = `
.wp-vig-vac {
  position: absolute; inset: 0; overflow: hidden;
  font: 400 15px/1.4 ui-sans-serif, system-ui, sans-serif;
  opacity: 0; transition: opacity 0.34s ease;
  background: linear-gradient(180deg, #2a3a52 0%, #46647e 52%, #2e3a46 52%, #222c36 100%);
}
.wp-vig-vac--in { opacity: 1; }
.wp-vig-vac-header {
  position: absolute; top: calc(env(safe-area-inset-top, 0px) + 12px); left: 50%; transform: translateX(-50%);
  text-align: center; z-index: 3; white-space: nowrap;
  background: rgba(12,16,22,0.8); color: #f3ece0;
  padding: 8px 22px; border-radius: 12px; box-shadow: 0 6px 16px rgba(0,0,0,0.3);
}
.wp-vig-vac-header__title {
  font: 800 clamp(16px, 2.6vw, 24px)/1.1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.04em;
}
.wp-vig-vac-header__sub {
  font: 500 clamp(12px, 1.6vw, 15px)/1.2 ui-sans-serif, system-ui, sans-serif;
  color: var(--wp-vac-accent, #e8b54a); margin-top: 3px; white-space: normal;
}
.wp-vig-vac-board {
  position: absolute; top: 18%; left: 50%; transform: translateX(-50%);
  width: min(92%, 760px); max-height: 56%;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px; overflow-y: auto; padding: 6px; z-index: 2;
}
.wp-vig-vac-card {
  border: none; border-radius: 12px; overflow: hidden; cursor: pointer;
  background: #f3ece0; color: #2a2114; text-align: center; padding: 0 0 10px;
  box-shadow: 0 8px 18px rgba(0,0,0,0.35);
  -webkit-tap-highlight-color: transparent;
}
.wp-vig-vac-card:active { transform: scale(0.97); }
.wp-vig-vac-card:disabled { opacity: 0.6; pointer-events: none; }
.wp-vig-vac-card__sky { height: 84px; background: linear-gradient(180deg, #bfe0e8, #ffd99a); }
.wp-vig-vac-card__sky svg { width: 100%; height: 100%; display: block; }
.wp-vig-vac-card__name { font: 800 clamp(14px, 1.9vw, 17px)/1.2 ui-sans-serif, system-ui, sans-serif; margin-top: 8px; }
.wp-vig-vac-card__fare {
  display: inline-block; margin-top: 4px;
  font: 700 12px/1 ui-sans-serif, system-ui, sans-serif;
  color: #1f1505; background: var(--wp-vac-accent, #e8b54a);
  border-radius: 999px; padding: 4px 10px;
}
.wp-vig-vac-tray { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; }
@media (hover: hover) and (pointer: fine) {
  .wp-vig-vac-card { transition: transform 0.12s ease, box-shadow 0.16s ease; }
  .wp-vig-vac-card:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(0,0,0,0.4); }
}

/* ── montage beats ── */
.wp-vig-vac-beat {
  position: absolute; inset: 0; z-index: 8;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
  background: linear-gradient(180deg, #28384e, #1d2733);
  opacity: 0; transition: opacity 0.3s ease;
}
.wp-vig-vac-beat--in { opacity: 1; }
.wp-vig-vac-beat--sky { background: linear-gradient(180deg, #7db4d8 0%, #bfe0e8 70%, #e8d5b0 100%); }
.wp-vig-vac-beat--dark { background: #14181e; }
.wp-vig-vac-beat--home { background: linear-gradient(180deg, #46647e, #835a39); }
.wp-vig-vac-beat__chrome {
  font: 700 clamp(15px, 2.4vw, 20px)/1.2 ui-sans-serif, system-ui, sans-serif;
  color: #20303e; background: rgba(255,255,255,0.7); border-radius: 999px; padding: 8px 20px;
}
.wp-vig-vac-plane { width: clamp(140px, 26vw, 240px); }
.wp-vig-vac-plane svg { width: 100%; height: auto; }
.wp-vig-vac-plane--up { animation: wp-vig-vac-up 2s ease-in forwards; }
.wp-vig-vac-plane--down { animation: wp-vig-vac-down 2s ease-out forwards; }
@keyframes wp-vig-vac-up {
  from { transform: translate(-30vw, 16vh) rotate(0deg); }
  to { transform: translate(34vw, -20vh) rotate(-10deg); }
}
@keyframes wp-vig-vac-down {
  from { transform: translate(-34vw, -18vh) rotate(8deg); }
  to { transform: translate(28vw, 14vh) rotate(2deg); }
}
.wp-vig-vac-postcard {
  position: relative; width: min(84%, 460px);
  background: #f3ece0; border-radius: 10px; padding: 12px 12px 16px;
  box-shadow: 0 18px 40px rgba(0,0,0,0.45);
  transform: rotate(-1.6deg);
}
.wp-vig-vac-postcard__sky {
  height: clamp(140px, 26vh, 220px); border-radius: 6px; overflow: hidden;
  background: linear-gradient(180deg, #bfe0e8, #ffd99a);
}
.wp-vig-vac-postcard__sky--dusk { background: linear-gradient(180deg, #5a4a7a, #ff9a76); }
.wp-vig-vac-postcard__sky svg { width: 100%; height: 100%; display: block; }
.wp-vig-vac-postcard__stamp {
  position: absolute; top: 18px; right: 20px; width: 34px; height: 40px;
  display: grid; place-items: center;
  background: #fff; color: #46647e; font-size: 18px;
  border: 2px dashed #c4b89e; border-radius: 3px; transform: rotate(4deg);
}
.wp-vig-vac-postcard__caption {
  margin-top: 12px; text-align: center;
  font: 800 clamp(18px, 3.4vw, 28px)/1.2 ui-sans-serif, system-ui, sans-serif;
  color: #2a2114;
}
.wp-vig-vac-postcard__city {
  text-align: center; margin-top: 2px;
  font: 600 clamp(12px, 1.8vw, 15px)/1.2 ui-sans-serif, system-ui, sans-serif;
  color: #8a7a5c; letter-spacing: 0.12em; text-transform: uppercase;
}
.wp-vig-vac-week {
  font: 600 clamp(18px, 3.4vw, 30px)/1.2 ui-serif, Georgia, serif;
  font-style: italic; color: #cdbfa8; letter-spacing: 0.08em;
}
.wp-vig-vac-welcome {
  font: 900 clamp(22px, 4.6vw, 40px)/1.2 ui-sans-serif, system-ui, sans-serif;
  color: #f3ece0; text-align: center; padding: 0 6%;
  text-shadow: 0 4px 14px rgba(0,0,0,0.4);
}
.wp-vig-vac-souvenir {
  font: 600 clamp(13px, 2vw, 17px)/1.3 ui-sans-serif, system-ui, sans-serif;
  color: var(--wp-vac-accent, #e8b54a); text-align: center; padding: 0 8%;
}
@media (prefers-reduced-motion: reduce) {
  .wp-vig-vac, .wp-vig-vac-beat, .wp-vig-vac-plane--up, .wp-vig-vac-plane--down { animation: none; transition: none; }
}
`
