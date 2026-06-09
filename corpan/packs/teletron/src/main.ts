import "./styles.css"
import { getStateCallbacks, type Room } from "colyseus.js"
import { createResilientRoom, type ConnStatus, type ResilientRoom } from "@shared/net/resilientRoom"
import { openTranscripts, type StoredMessage, type TranscriptStore } from "./transcripts"
import {
  ChatControlDeliver,
  InviteResult,
  InvitedMessage,
  MediatedChatInput,
  MP_MSG,
  SafeProfile,
  type LanguageCode,
  type PlayerId,
  type ProfilePublish,
  type StackReveal,
} from "@corpan-city/contracts"
import { wireDictation, dictationResolver } from "@shared/asr"
import { OUTPUT_LANGUAGE_PRIMES } from "@shared/moderation"
import { continentOf, detectCountry } from "../../corpan-city/src/multiplayer/geo"
import type { HostApi } from "../../corpan-city/src/npc/hostTypes"
import { createChatMediator } from "./mediator"
import { installDevConsoleForwarder } from "../../sdk/devConsole"
import { OrderedSpeechQueue, StreamingSentenceBuffer } from "../../tutomaton/src/streamingTts"
import { createStableSpeaker } from "./voice"
import { scrubForSpeech } from "../../tutomaton/src/textScrub"
import { t as i18n, type I18nKey } from "./i18n"

const PACK_ID = "teletron"
installDevConsoleForwarder()
const BASE_MODEL = {
  id: "llm-base-qwen3-4b-v1",
  url: "https://d38iwc9748jekz.cloudfront.net/corpan/llm-packs/llm-base-qwen3-4b-v1-0.1.0-full.zip",
  sizeMb: 2497,
}
const FREE_DAILY_LIMIT = 20
const MODEL_RETRY_DELAY_MS = 350
const CONTROL_INTERACTION_PREFIX = "teletron-control:"
const CONTROL_CHAT_ENDED_TEXT = "The chat has ended."
const TTS_CONTACT =
  /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@\w{2,}|\+?\d[\d\s().-]{6,}\d|(?:^|[^\p{L}\p{N}])@[a-z0-9_.-]{2,})/iu
const TTS_DIGIT_HEAVY = /(?:\D*\d){7,}/
const TTS_PROTOCOL_JUNK =
  /\b(as an ai|i can'?t assist|i cannot assist|policy|unsupported claim|fact[- ]?check|not appropriate)\b/i

type InitialState = {
  stackConfig?: { languages?: string[]; levels?: string[] }
  isPlus?: boolean
  entitlement?: EntitlementSnapshot
}

type EntitlementSnapshot = {
  plus?: boolean
  subscription?: {
    active?: boolean
    plan?: "monthly" | "annual" | null
    expiresAt?: string | null
    autoRenew?: boolean
  }
  checkedAt?: number | null
}

type WirePlayer = {
  playerId: string
  name: string
  target: string
  native: string
}

/** Where the messaging app currently is — orthogonal to per-conversation lifecycle. */
type TeletronView = "onboarding" | "inbox" | "waiting" | "thread"
/** A single conversation's standing. "ended" threads stay as read-only keepsakes. */
type Lifecycle = "active" | "dormant" | "ended"

type Conversation = {
  partnerId: string
  partnerName: string
  lifecycle: Lifecycle
  partnerOnline: boolean
  lastActivityAt: number
  unread: number
}

/** A living link stays reachable while both sides tend it within this window. */
const LINK_TTL_MS = 24 * 60 * 60 * 1000

type TeletronLanguages = {
  native: LanguageCode
  learning: LanguageCode[]
  hidden: string[]
}

type ContentPackModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: InitialState,
  ) => Promise<{ unmount: () => void }>
}

function readPackBaseUrl(): string {
  try {
    const el = document.querySelector<HTMLScriptElement>(
      'script[data-corp-game="true"][data-corp-game-id]',
    )
    return el?.dataset.corpGameBaseUrl ? new URL(el.dataset.corpGameBaseUrl).toString() : ""
  } catch {
    return ""
  }
}

function packAssetUrl(path: string): string {
  const base = readPackBaseUrl()
  if (!base) return path
  return new URL(path, base).toString()
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function icon(name: "back" | "send" | "mic" | "shield" | "users" | "chevron" | "speaker" | "speakerMuted" | "more"): string {
  const paths = {
    back: '<path d="m15 18-6-6 6-6"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    speaker: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    speakerMuted: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m17 9 4 4"/><path d="m21 9-4 4"/>',
    more: '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`
}

function anonymousName(forceNew = false): string {
  const key = "teletron.identity"
  const first = [
    "Bright", "Calm", "Candid", "Careful", "Cheerful", "Clever", "Curious", "Gentle",
    "Kind", "Lively", "Lucid", "Open", "Patient", "Quiet", "Ready", "Steady",
    "Sunny", "Thoughtful", "Warm", "Witty",
  ]
  const second = [
    "Beacon", "Comet", "Echo", "Harbor", "Lantern", "Meadow", "Melody", "Nova",
    "Orbit", "Pixel", "Prism", "River", "Signal", "Spark", "Star", "Story",
    "Summit", "Thread", "Wave", "Window",
  ]
  try {
    const saved = localStorage.getItem(key)
    if (saved && !forceNew) return saved
    let name = saved
    while (!name || name === saved) {
      name = `${first[Math.floor(Math.random() * first.length)]} ${second[Math.floor(Math.random() * second.length)]}`
    }
    localStorage.setItem(key, name)
    return name
  } catch {
    return "Quiet Signal"
  }
}

function playerId(): string {
  const key = "teletron.playerId"
  try {
    const saved = localStorage.getItem(key)
    if (saved) return saved
    const id = `teletron-${crypto.randomUUID()}`
    localStorage.setItem(key, id)
    return id
  } catch {
    return `teletron-${Date.now().toString(36)}`
  }
}

function serverUrl(): string {
  const injected = (globalThis as { __TELETRON_SERVER_URL?: string; __WP_SERVER_URL?: string })
  return (
    injected.__TELETRON_SERVER_URL ||
    injected.__WP_SERVER_URL ||
    new URLSearchParams(location.search).get("server") ||
    import.meta.env.VITE_TELETRON_SERVER_URL ||
    "wss://presence.3-142-26-37.sslip.io"
  )
}

const TELETRON_RELAY_LANGUAGES = new Set(Object.keys(OUTPUT_LANGUAGE_PRIMES))
const RELAY_LANGUAGE_ALIASES: Record<string, string> = {
  ko: "ko",
  "ko-KR": "ko",
  pt: "pt-BR",
  "pt-PT": "pt-PT",
  "pt-BR": "pt-BR",
  pa: "pa-Guru",
  "pa-IN": "pa-Guru",
  "pa-PK": "pa-Arab",
  zh: "zh-Hans",
  "zh-CN": "zh-Hans",
  "zh-TW": "zh-Hant",
  "zh-HK": "yue-Hant-HK",
  yue: "yue-Hant-HK",
}

function canonicalRelayLanguage(language: string): LanguageCode | null {
  const raw = language.trim()
  if (!raw) return null
  if (TELETRON_RELAY_LANGUAGES.has(raw)) return raw as LanguageCode
  const alias = RELAY_LANGUAGE_ALIASES[raw]
  if (alias && TELETRON_RELAY_LANGUAGES.has(alias)) return alias as LanguageCode
  const base = raw.split("-")[0] ?? raw
  if (TELETRON_RELAY_LANGUAGES.has(base)) return base as LanguageCode
  return null
}

function stackLanguages(initial?: InitialState): TeletronLanguages {
  const langs = [...new Set(initial?.stackConfig?.languages?.filter((x) => typeof x === "string") ?? [])]
  const native = canonicalRelayLanguage(langs[0] || "en") ?? ("en" as LanguageCode)
  const learning: LanguageCode[] = []
  const hidden: string[] = []
  for (const language of langs.slice(1)) {
    const canonical = canonicalRelayLanguage(language)
    if (!canonical) {
      hidden.push(language)
      continue
    }
    if (canonical !== native && !learning.includes(canonical)) learning.push(canonical)
  }
  return { native, learning: learning.length > 0 ? learning : [native], hidden }
}

function displayNameOf(type: "language" | "region" | "script", code: string, uiLocale: string): string | null {
  try {
    const dn = new Intl.DisplayNames([uiLocale, "en"], { type })
    return dn.of(code) ?? null
  } catch {
    return null
  }
}

function languageDisplayName(code: string, uiLocale: string): string {
  const baseCode =
    code === "ko-polite"
      ? "ko"
      : code.startsWith("pa-")
        ? "pa"
        : code.startsWith("pt-")
          ? "pt"
          : code.startsWith("zh-")
            ? "zh"
            : code.startsWith("yue-")
              ? "yue"
              : code.split("-")[0] || code
  const base =
    displayNameOf("language", baseCode, uiLocale) ??
    (baseCode === "yue" ? "Cantonese" : code.toUpperCase())
  const detail = (() => {
    if (code === "pt-BR") return displayNameOf("region", "BR", uiLocale) ?? "Brazil"
    if (code === "pt-PT") return displayNameOf("region", "PT", uiLocale) ?? "Portugal"
    if (code === "zh-Hans") return displayNameOf("script", "Hans", uiLocale) ?? "Simplified"
    if (code === "zh-Hant") return displayNameOf("script", "Hant", uiLocale) ?? "Traditional"
    if (code === "yue-Hant-HK") return displayNameOf("region", "HK", uiLocale) ?? "Hong Kong"
    if (code === "pa-Arab") return "Shahmukhi"
    if (code === "pa-Guru") return displayNameOf("script", "Guru", uiLocale) ?? "Gurmukhi"
    if (code === "ko-polite") return "polite"
    return ""
  })()
  return detail ? `${base} (${detail})` : base
}

function stackReveal(
  native: LanguageCode,
  learning: LanguageCode[],
  selected: LanguageCode,
): StackReveal {
  const alsoLearning = learning.filter((lang) => lang !== selected).slice(0, 6)
  return {
    native,
    target: selected,
    ...(alsoLearning.length > 0 ? { alsoLearning } : {}),
  }
}

function avatarInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?"
}

function countryFlag(country?: string): string {
  if (!country || !/^[A-Z]{2}$/.test(country)) return ""
  return country
    .split("")
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join("")
}

function formatContinent(continent: string): string {
  return continent
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ")
}

function placeLabel(place: SafeProfile["place"]): string | undefined {
  if (place.granularity === "country") {
    const flag = countryFlag(place.country)
    return `${flag ? `${flag} ` : ""}${place.country}`
  }
  if (place.granularity === "continent") return formatContinent(place.continent)
  return undefined
}

function isPlus(initial?: InitialState): boolean {
  const injected = globalThis as {
    __CORPAN_PLUS?: boolean
    __CORPAN_ENTITLEMENT?: EntitlementSnapshot
  }
  return Boolean(
    initial?.isPlus ||
      initial?.entitlement?.plus ||
      initial?.entitlement?.subscription?.active ||
      injected.__CORPAN_PLUS ||
      injected.__CORPAN_ENTITLEMENT?.plus ||
      injected.__CORPAN_ENTITLEMENT?.subscription?.active,
  )
}

function quotaRemaining(plus: boolean): number {
  if (plus) return Infinity
  const day = new Date().toISOString().slice(0, 10)
  try {
    const state = JSON.parse(localStorage.getItem("teletron.quota") || "{}") as {
      day?: string
      count?: number
    }
    return state.day === day ? Math.max(0, FREE_DAILY_LIMIT - (state.count ?? 0)) : FREE_DAILY_LIMIT
  } catch {
    return FREE_DAILY_LIMIT
  }
}

function consumeQuota(plus: boolean): void {
  if (plus) return
  const day = new Date().toISOString().slice(0, 10)
  const remaining = quotaRemaining(false)
  localStorage.setItem("teletron.quota", JSON.stringify({ day, count: FREE_DAILY_LIMIT - remaining + 1 }))
}

const BLOCK_KEY = "teletron.blocks"

/** The device-local, durable block list (the reliable layer; the server mirror is best-effort). */
function loadBlocks(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(BLOCK_KEY) || "[]")
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [])
  } catch {
    return new Set()
  }
}

function persistBlocks(blocks: Set<string>): void {
  try {
    localStorage.setItem(BLOCK_KEY, JSON.stringify([...blocks]))
  } catch (error) {
    console.error("[teletron] persist block list failed:", error)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function safeForStreamingSpeech(text: string): boolean {
  return !TTS_CONTACT.test(text) && !TTS_DIGIT_HEAVY.test(text) && !TTS_PROTOCOL_JUNK.test(text)
}

function composeControlInput(
  from: PlayerId,
  to: PlayerId,
  kind: "ended",
  targetLanguage: LanguageCode,
): MediatedChatInput {
  return {
    from,
    to,
    interactionId: `${CONTROL_INTERACTION_PREFIX}${kind}:${Date.now().toString(36)}`,
    source: { kind: "text", text: CONTROL_CHAT_ENDED_TEXT },
    sourceLanguage: "en" as LanguageCode,
    targetLanguage,
    mode: "beginner",
  }
}

function controlKind(input: MediatedChatInput): "ended" | null {
  if (!input.interactionId.startsWith(CONTROL_INTERACTION_PREFIX)) return null
  if (input.source.kind !== "text") return null
  return input.source.text === CONTROL_CHAT_ENDED_TEXT ? "ended" : null
}

async function mountTeletron(
  container: HTMLElement,
  hostApi: HostApi,
  initial?: InitialState,
): Promise<{ unmount: () => void }> {
  container.replaceChildren()
  const me = playerId()
  let name = anonymousName()
  const languages = stackLanguages(initial)
  // Chrome localizes into the user's NATIVE language; learning languages stay the
  // content axis. t() falls back to clean English per key when a locale is absent.
  const uiLang = languages.native
  const t = (key: I18nKey, params?: Record<string, string>): string => i18n(key, uiLang, params)
  let selectedLanguage = languages.learning[0]
  // Recipient's reach in their stack drives translation register (A2→simple, B2→natural, C2→erudite).
  const recipientLevel = [...(initial?.stackConfig?.levels ?? [])].filter((x) => typeof x === "string").sort().pop()
  let plus = isPlus(initial)
  const disposers: Array<() => void> = []
  let ttsEnabled = localStorage.getItem("teletron.tts") !== "off"
  // Pin one stable voice per locale so a conversation never jumps voices between
  // sentences (the host's plain speak() picks a default voice per utterance).
  const stableSpeak = createStableSpeaker(hostApi)
  const speechQueue = new OrderedSpeechQueue(
    (locale, text) => stableSpeak(locale, text),
    hostApi.stopSpeech,
    (error) => console.error("[teletron/tts]", error),
  )
  let speechEpoch = 0
  let activeStream:
    | {
        epoch: number
        locale: string
        buffer: StreamingSentenceBuffer | null
        placeholder: HTMLElement
        message: HTMLElement
        body: HTMLElement
        visibleText: string
        revealed: boolean
      }
    | null = null

  function cancelSpeech(): void {
    speechEpoch += 1
    if (activeStream) activeStream.buffer = null
    speechQueue.cancel()
  }

  function queueSpeech(locale: string, parts: string[], epoch: number): void {
    if (!ttsEnabled || epoch !== speechEpoch) return
    for (const part of parts) {
      const clean = scrubForSpeech(part, locale)
      if (clean && safeForStreamingSpeech(clean)) speechQueue.enqueue(locale, clean)
    }
  }

  function speakNow(locale: string, text: string): void {
    const clean = scrubForSpeech(text, locale)
    if (!clean || !safeForStreamingSpeech(clean)) return
    cancelSpeech()
    speechQueue.enqueue(locale, clean)
  }

  function scrollMessagesToEnd(): void {
    messages.scrollTop = messages.scrollHeight
  }

  function revealActiveStream(stream: NonNullable<typeof activeStream>): void {
    if (stream.revealed) return
    stream.placeholder.remove()
    stream.message.removeAttribute("hidden")
    stream.revealed = true
    scrollMessagesToEnd()
  }

  function appendTargetToken(stream: NonNullable<typeof activeStream>, token: string): void {
    if (!token) return
    revealActiveStream(stream)
    stream.visibleText += token
    stream.body.textContent = stream.visibleText
    scrollMessagesToEnd()
    if (stream.buffer) queueSpeech(stream.locale, stream.buffer.push(token), stream.epoch)
  }

  function finishTargetStream(stream: NonNullable<typeof activeStream>, fullText = ""): void {
    const full = fullText.trim()
    if (full) {
      if (!stream.visibleText.trim()) {
        appendTargetToken(stream, full)
      } else if (full.startsWith(stream.visibleText)) {
        appendTargetToken(stream, full.slice(stream.visibleText.length))
      } else {
        revealActiveStream(stream)
        stream.visibleText = full
        stream.body.textContent = full
        scrollMessagesToEnd()
      }
    }
    if (stream.buffer) queueSpeech(stream.locale, stream.buffer.finish(), stream.epoch)
  }

  const mediator = createChatMediator(hostApi, {
    onToken(label, token) {
      const stream = activeStream
      if (!stream || label !== `relay.translate-target.${stream.locale}`) return
      appendTargetToken(stream, token)
    },
    onDone(label, fullText) {
      const stream = activeStream
      if (!stream || label !== `relay.translate-target.${stream.locale}`) return
      finishTargetStream(stream, fullText)
    },
  })
  const players = new Map<string, WirePlayer>()
  const profiles = new Map<string, SafeProfile>()
  let room: Room | null = null
  let conn: ResilientRoom | null = null
  let connStatus: ConnStatus = "offline"
  // handlers bound to the CURRENT room; cleared each time the room is lost.
  let roomDisposers: Array<() => void> = []
  // Every conversation this device knows about, keyed by partner playerId. The
  // server supports many simultaneous penpals; this map is the client mirror.
  const conversations = new Map<string, Conversation>()
  // ── Accepted-pair recovery ──────────────────────────────────────────────
  // The server's accepted pair (its routing/auth record) is in-memory and
  // VOLATILE: a server restart, the 24h TTL lapse, or a fresh-join after the
  // reconnect window all forget it. On-device transcripts are the durable truth.
  // These three structures let the client transparently re-establish a forgotten
  // pair (via the existing invite handshake) instead of sending into a void.
  //   • partnerIds whose accepted pair is CONFIRMED live this session.
  const confirmedPairs = new Set<string>()
  //   • outbound messages typed before the pair is confirmed, flushed on confirm.
  const pendingOutbound = new Map<string, MediatedChatInput[]>()
  //   • re-establish invites in flight: inviteId → partnerId (separate from the
  //     human-facing single-slot `pendingInvite`, so resume never clobbers it).
  const reestablishing = new Map<string, string>()
  // The partner whose thread is currently open (null in inbox/waiting/onboarding).
  let openPartnerId: string | null = null
  // The top-level view. Inbox is home; waiting is "find a penpal".
  let view: TeletronView = "onboarding"
  const FREE_LINK_CAP = 1
  const PLUS_LINK_CAP = 100
  let restoredConversation = false
  const blocked = loadBlocks()
  const isBlocked = (id: string): boolean => blocked.has(id)
  const transcripts: TranscriptStore = await openTranscripts()

  // --- conversation accessors ------------------------------------------------
  /** The currently-open conversation, or null. */
  const currentConvo = (): Conversation | null =>
    openPartnerId ? conversations.get(openPartnerId) ?? null : null
  /** True when there is an OPEN, still-active conversation with this partner. */
  const isActiveWith = (id: string): boolean => {
    const c = conversations.get(id)
    return openPartnerId === id && !!c && c.lifecycle === "active"
  }
  /** How many living (non-ended) conversations exist — what the link cap gates on. */
  const livingCount = (): number => {
    let n = 0
    for (const c of conversations.values()) if (c.lifecycle !== "ended") n += 1
    return n
  }
  /** Max simultaneous living links for this tier. */
  const linkCap = (): number => (plus ? PLUS_LINK_CAP : FREE_LINK_CAP)
  /** Create or patch a conversation; returns the (now-current) entry. */
  function upsertConvo(id: string, partnerName: string, patch?: Partial<Conversation>): Conversation {
    const existing = conversations.get(id)
    const next: Conversation = existing
      ? { ...existing, partnerName: partnerName || existing.partnerName, ...patch }
      : {
          partnerId: id,
          partnerName: partnerName || t("someonePlaceholder"),
          lifecycle: "active",
          partnerOnline: false,
          lastActivityAt: Date.now(),
          unread: 0,
          ...patch,
        }
    conversations.set(id, next)
    return next
  }
  /** A minimal WirePlayer for the open convo — used for control sends. */
  function openPartnerWire(): WirePlayer | null {
    const c = currentConvo()
    if (!c) return null
    return { playerId: c.partnerId, name: c.partnerName, target: "", native: "" }
  }
  /** A minimal WirePlayer for any known convo id. */
  function convoWire(id: string): WirePlayer | null {
    const c = conversations.get(id)
    if (!c) return null
    return { playerId: c.partnerId, name: c.partnerName, target: "", native: "" }
  }
  let modelReady = false
  let modelBusy = false
  let mounted = true
  let dictationAvailable = false
  let refreshDictation: () => Promise<boolean> = async () => false
  let revealStack = false
  let revealCountry = false
  let pendingInvite: { inviteId: string; player: WirePlayer } | null = null
  let receiveTail: Promise<void> = Promise.resolve()
  const teletronLogoUrl = packAssetUrl("teletron-avatar.png")

  const root = el("div", "tt-root")
  root.dataset.view = "onboarding"
  root.innerHTML = `
    <header class="tt-header">
      <button class="tt-icon tt-back" aria-label="${t("exitToCorpan")}">${icon("back")}</button>
      <div class="tt-brand"><span class="tt-brand-mark" aria-hidden="true"><img src="${teletronLogoUrl}" alt="" draggable="false"></span><span><strong>Teletron</strong><small>${t("brandTagline")}</small></span></div>
      <div class="tt-status"><span></span><b>${t("statusConnecting")}</b></div>
    </header>
    <main class="tt-main">
      <aside class="tt-lobby">
        <section class="tt-intro">
          <button class="tt-lobby-back" type="button" aria-label="${t("backToConversations")}">${icon("back")} ${t("conversations")}</button>
          <div class="tt-kicker">${icon("shield")} ${t("lobbyKicker")}</div>
          <h1>${t("lobbyHeading")}</h1>
          <p>${t("lobbySub")}</p>
        </section>
        <section class="tt-privacy">
          <label><span><b>${t("revealStackTitle")}</b><small>${t("revealStackHint")}</small></span><input data-toggle="stack" type="checkbox"></label>
          <label><span><b>${t("revealCountryTitle")}</b><small>${t("revealCountryHint")}</small></span><input data-toggle="country" type="checkbox"></label>
          <p class="tt-privacy-note">${t("privacyDisclosure")}</p>
        </section>
        <div class="tt-list-head"><span>${icon("users")} ${t("waitingRoom")}</span><b class="tt-count">0</b></div>
        <div class="tt-people"></div>
      </aside>
      <section class="tt-conversation">
        <div class="tt-inbox">
          <div class="tt-inbox-head"><b>${t("conversations")}</b><button class="tt-find" type="button">${icon("users")} ${t("findAPenpal")}</button></div>
          <div class="tt-inbox-list"></div>
        </div>
        <div class="tt-thread" hidden>
          <div class="tt-thread-head"><div><button class="tt-thread-back" type="button" aria-label="${t("backToConversations")}">${icon("back")}</button><span class="tt-avatar"></span><span><b class="tt-partner"></b><small class="tt-thread-status">${t("penpalConnected")}</small></span></div><div class="tt-thread-actions"><button class="tt-voice" type="button" aria-pressed="true" aria-label="${t("muteVoice")}">${icon("speaker")}</button><button class="tt-overflow" type="button" aria-label="${t("more")}" aria-haspopup="menu" aria-expanded="false">${icon("more")}</button><div class="tt-thread-menu" role="menu" hidden><button type="button" role="menuitem" class="tt-menu-end is-danger">${t("endConversation")}</button><button type="button" role="menuitem" class="tt-menu-block">${t("blockOrReport")}</button><button type="button" role="menuitem" class="tt-menu-exit">${t("exitToCorpan")}</button></div></div></div>
          <div class="tt-messages"></div>
          <form class="tt-composer">
            <textarea rows="1" maxlength="600" placeholder="${t("writeAMessage")}"></textarea>
            <button class="tt-mic" type="button" aria-label="${t("speak")}" disabled>${icon("mic")}</button>
            <button class="tt-send" type="submit" aria-label="${t("send")}">${icon("send")}</button>
          </form>
          <div class="tt-quota"></div>
        </div>
      </section>
    </main>
    <div class="tt-model"><div><span class="tt-model-icon">AI</span><span><b>${t("preparingPrivateRelay")}</b><small>${t("checkingForModel")}</small></span></div><button hidden>${t("installModel")}</button></div>
    <div class="tt-onboarding"><div>
      <div class="tt-onboarding-mark" aria-hidden="true"><img src="${teletronLogoUrl}" alt="" draggable="false"></div>
      <div class="tt-kicker">${icon("shield")} ${t("onboardingKicker")}</div>
      <h2>${t("onboardingHeading")}</h2>
      <label><span>${t("yourGeneratedName")}</span><div class="tt-name-row"><b class="tt-own-name"></b><button type="button" data-reroll>${t("rollAgain")}</button></div></label>
      <label><span>${t("showMessagesIn")}</span><div class="tt-select-wrap"><select class="tt-language"></select><span class="tt-select-chev">${icon("chevron")}</span></div></label>
      <p class="tt-language-note">${t("languageNote")}</p>
      <button class="tt-enter" type="button">${t("enterWaitingRoom")}</button>
    </div></div>
    <div class="tt-invite" hidden><div><span class="tt-avatar"></span><h3></h3><p>${t("inviteBody", { name: "" })}</p><footer><button data-decline>${t("notNow")}</button><button data-accept>${t("acceptChat")}</button></footer></div></div>
    <div class="tt-safety" hidden><div><span class="tt-avatar"></span><h3></h3><p>${t("safetyBody")}</p><footer><button data-safety-cancel>${t("cancel")}</button><button data-safety-block>${t("block")}</button><button data-safety-report>${t("reportAndBlock")}</button></footer></div></div>
    <div class="tt-cap-choice" hidden><div><h3>${t("capTitle")}</h3><p>${t("capBody")}</p><footer><button data-cap-keep>${t("capKeepCurrent")}</button><button data-cap-swap>${t("capSwap")}</button><button data-cap-plus>${t("capGetPlus")}</button></footer></div></div>
    <div class="tt-toast" hidden></div>
  `
  container.appendChild(root)

  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector)!
  const status = $(".tt-status")
  const people = $(".tt-people")
  const count = $(".tt-count")
  const inboxList = $(".tt-inbox-list")
  const thread = $(".tt-thread")
  const messages = $(".tt-messages")
  const form = $<HTMLFormElement>(".tt-composer")
  const field = $<HTMLTextAreaElement>(".tt-composer textarea")
  const mic = $<HTMLButtonElement>(".tt-mic")
  const sendButton = $<HTMLButtonElement>(".tt-send")
  const voiceButton = $<HTMLButtonElement>(".tt-voice")
  const overflowButton = $<HTMLButtonElement>(".tt-overflow")
  const threadMenu = $(".tt-thread-menu")
  const safetySheet = $(".tt-safety")
  const capChoiceSheet = $(".tt-cap-choice")
  // The thread-head avatar — SCOPED, because inbox rows also use `.tt-avatar` and
  // a bare first-match `$(".tt-avatar")` would resolve to an inbox row.
  const threadAvatar = $(".tt-thread-head .tt-avatar")
  const threadStatus = $(".tt-thread-status")
  const quota = $(".tt-quota")
  const modelBar = $(".tt-model")
  const modelText = $(".tt-model small")
  const modelButton = $<HTMLButtonElement>(".tt-model button")
  const toast = $(".tt-toast")
  const invitePrompt = $(".tt-invite")
  const onboarding = $(".tt-onboarding")
  const ownName = $(".tt-own-name")
  const languageSelect = $<HTMLSelectElement>(".tt-language")
  const languageNote = $(".tt-language-note")
  let inviteReply: ((accepted: boolean) => void) | null = null

  function autosizeComposer(): void {
    field.style.height = "0px"
    const max = window.matchMedia("(max-width: 720px)").matches ? 108 : 130
    const next = Math.min(Math.max(field.scrollHeight, 42), max)
    field.style.height = `${next}px`
    field.style.overflowY = field.scrollHeight > max ? "auto" : "hidden"
  }

  ownName.textContent = name
  for (const language of languages.learning) {
    const option = document.createElement("option")
    option.value = language
    option.textContent = languageDisplayName(language, languages.native)
    languageSelect.appendChild(option)
  }
  if (languages.hidden.length > 0) {
    languageNote.textContent = t("languageNoteHidden", {
      languages: languages.hidden.map((language) => languageDisplayName(language, languages.native)).join(", "),
    })
  }

  function showToast(text: string): void {
    toast.textContent = text
    toast.removeAttribute("hidden")
    setTimeout(() => toast.setAttribute("hidden", ""), 2600)
  }

  const STATUS_TEXT: Record<ConnStatus, string> = {
    offline: t("statusOffline"),
    connecting: t("statusConnecting"),
    online: t("statusOnline"),
    reconnecting: t("statusReconnecting"),
  }

  function setStatus(kind: ConnStatus, text = STATUS_TEXT[kind]): void {
    status.className = `tt-status is-${kind}`
    status.querySelector("b")!.textContent = text
  }

  /** Reflect the live connection in the open thread header + composer. */
  function updateThreadConnState(): void {
    const convo = currentConvo()
    if (convo && convo.lifecycle === "active") {
      // Our own connection comes first: while reconnecting, don't blame the peer.
      threadStatus.textContent =
        connStatus !== "online"
          ? t("reconnectingEllipsis")
          : !convo.partnerOnline
            ? t("partnerOfflineHead", { name: convo.partnerName })
            : t("penpalConnected")
    }
    updateQuota()
  }

  function updateQuota(): void {
    const convo = currentConvo()
    const left = quotaRemaining(plus)
    quota.textContent = plus ? t("quotaPlus") : t("quotaFree", { count: String(left) })
    // "live" = OUR connection is up. A partner being offline no longer disables
    // the composer — messages to them are buffered server-side (async penpal).
    const live = Boolean(room && connStatus === "online")
    const active = Boolean(convo && convo.lifecycle === "active")
    const enabled = active && live && modelReady && left > 0
    field.disabled = !enabled
    sendButton.disabled = !enabled
    mic.disabled = !enabled || !dictationAvailable
    form.classList.toggle("is-disabled", !enabled)
    form.classList.toggle("is-asr-unavailable", !dictationAvailable)
    if (convo?.lifecycle === "dormant") field.placeholder = t("composerDrifted")
    else if (convo?.lifecycle === "ended") field.placeholder = t("composerEnded")
    else if (!active) field.placeholder = t("composerChooseSomeone")
    else if (!modelReady) field.placeholder = t("composerRelayLoading")
    else if (connStatus !== "online") field.placeholder = t("composerReconnecting")
    else if (left <= 0) field.placeholder = t("composerDailyUsed")
    else field.placeholder = convo?.partnerOnline
      ? t("writeAMessage")
      : t("composerWillSee", { name: convo?.partnerName ?? t("someonePlaceholder") })
  }

  function updateVoiceButton(): void {
    voiceButton.classList.toggle("active", ttsEnabled)
    voiceButton.innerHTML = ttsEnabled ? icon("speaker") : icon("speakerMuted")
    voiceButton.setAttribute("aria-pressed", ttsEnabled ? "true" : "false")
    voiceButton.setAttribute("aria-label", ttsEnabled ? t("muteVoice") : t("unmuteVoice"))
  }

  function onEntitlementChanged(event: Event): void {
    const detail = (event as CustomEvent<EntitlementSnapshot>).detail
    const nextPlus = Boolean(
      detail?.plus ||
        detail?.subscription?.active ||
        (globalThis as { __CORPAN_PLUS?: boolean }).__CORPAN_PLUS,
    )
    if (nextPlus === plus) return
    plus = nextPlus
    updateQuota()
    if (plus) showToast(t("plusActive"))
  }
  window.addEventListener("corpan:entitlement-changed", onEntitlementChanged)
  disposers.push(() => window.removeEventListener("corpan:entitlement-changed", onEntitlementChanged))

  function publishProfile(): void {
    if (!room) return
    const country = revealCountry ? detectCountry() : undefined
    const profile: ProfilePublish = {
      stack: stackReveal(languages.native, languages.learning, selectedLanguage),
      revealStack,
      country,
      continent: country ? continentOf(country) : undefined,
    }
    room.send(MP_MSG.profilePublish, profile)
  }

  function requestProfiles(): void {
    if (!room) return
    for (const p of players.values()) room.send(MP_MSG.profileRequest, { target: p.playerId })
  }

  function profileLine(player: WirePlayer): string {
    const profile = profiles.get(player.playerId)
    if (!profile) return t("privateProfile")
    const bits: string[] = []
    if (profile.stack.target !== "und") {
      const learning = [profile.stack.target, ...(profile.stack.alsoLearning ?? [])]
        .map((language) => languageDisplayName(language, languages.native))
        .join(", ")
      bits.push(`${languageDisplayName(profile.stack.native, languages.native)} → ${learning}`)
    }
    const place = placeLabel(profile.place)
    if (place) bits.push(place)
    return bits.join(" · ") || t("privateProfile")
  }

  function profileBadge(player: WirePlayer): { text: string; isFlag: boolean } {
    const profile = profiles.get(player.playerId)
    const flag = profile?.place.granularity === "country" ? countryFlag(profile.place.country) : ""
    return flag ? { text: flag, isFlag: true } : { text: avatarInitial(player.name), isFlag: false }
  }

  function renderPeople(): void {
    const visible = [...players.values()].filter((p) => !isBlocked(p.playerId))
    count.textContent = String(visible.length)
    people.replaceChildren()
    if (!visible.length) {
      const waiting = el("div", "tt-waiting", t("waitingForSignal"))
      people.appendChild(waiting)
      return
    }
    for (const p of visible) {
      const card = el("button", "tt-person")
      card.type = "button"
      const isPendingTarget = pendingInvite?.player.playerId === p.playerId
      const hasPendingInvite = pendingInvite !== null
      const convo = conversations.get(p.playerId)
      const atCap = livingCount() >= linkCap()
      let actionLabel = t("actionInvite")
      if (convo && convo.lifecycle === "active") {
        // Already a living conversation with this person → open it, don't re-invite.
        card.classList.add("is-chatting")
        actionLabel = t("actionOpen")
      } else if (convo && convo.lifecycle === "ended") {
        card.disabled = true
        card.classList.add("is-ended")
        actionLabel = t("actionEnded")
      } else if (hasPendingInvite) {
        card.disabled = true
        card.classList.add(isPendingTarget ? "is-invited" : "is-paused")
        actionLabel = isPendingTarget ? t("actionInvited") : t("actionWait")
      } else if (atCap && !plus) {
        // Free tier at its one-link cap — invite still works, but offers a choice.
        card.classList.add("is-paused")
        actionLabel = t("actionInvite")
      }
      const badge = profileBadge(p)
      const avatar = el("span", badge.isFlag ? "tt-avatar is-flag" : "tt-avatar", badge.text)
      const body = el("span")
      body.append(el("b", undefined, p.name), el("small", undefined, profileLine(p)))
      card.append(avatar, body, el("em", undefined, actionLabel))
      const existing = conversations.get(p.playerId)
      card.addEventListener("click", () => {
        // Re-open a living conversation rather than re-inviting.
        if (existing && existing.lifecycle === "active") openThread(p)
        else invite(p)
      })
      people.appendChild(card)
    }
  }

  function addMessage(side: "self" | "peer" | "system", text: string, detail?: string): HTMLElement {
    const msg = el("div", `tt-message tt-${side}`)
    msg.appendChild(el("div", undefined, text))
    if (detail) msg.appendChild(el("small", undefined, detail))
    messages.appendChild(msg)
    scrollMessagesToEnd()
    return msg
  }

  /** Build a static (already-stored) message bubble for hydration. */
  function buildBubble(m: StoredMessage): HTMLElement {
    const node = el("div", `tt-message tt-${m.side}`)
    node.appendChild(el("div", undefined, m.text))
    if (m.detail) node.appendChild(el("small", undefined, m.detail))
    if (m.side === "peer") {
      node.classList.add("is-speakable")
      node.addEventListener("click", () => speakNow(selectedLanguage, m.text))
    }
    return node
  }

  /** Persist a turn to the on-device transcript and refresh the link's activity. */
  function persistMessage(partnerId: string, partnerName: string, m: StoredMessage): void {
    void transcripts
      .append(partnerId, m)
      .then(() =>
        transcripts.setMeta({ partnerId, partnerName, lastActivityAt: m.ts }),
      )
      .catch((error) => console.error("[teletron] transcript persist failed:", error))
  }

  /**
   * True when `partnerId` is someone we've already corresponded with — a durable
   * on-device transcript link OR a live conversation entry. This is the consent
   * signal that lets us AUTO-ACCEPT a re-invite when the server forgot the pair:
   * a genuine stranger has neither, so they always require a human accept.
   */
  async function isEstablishedPenpal(partnerId: string): Promise<boolean> {
    if (conversations.has(partnerId)) return true
    try {
      return (await transcripts.meta(partnerId)) !== null
    } catch (error) {
      console.error("[teletron] penpal lookup failed:", error)
      return false
    }
  }

  /**
   * Restore an opened thread from on-device history. Stored bubbles are
   * prepended (they predate anything live), so this is race-safe with live
   * messages that may arrive while IndexedDB resolves.
   */
  async function hydrateThread(partnerId: string, fresh: boolean): Promise<void> {
    let stored: StoredMessage[] = []
    try {
      stored = await transcripts.thread(partnerId)
    } catch (error) {
      console.error("[teletron] transcript hydrate failed:", error)
    }
    if (openPartnerId !== partnerId) return // thread changed while loading
    if (stored.length) {
      const frag = document.createDocumentFragment()
      for (const m of stored) frag.appendChild(buildBubble(m))
      messages.insertBefore(frag, messages.firstChild)
    } else if (fresh) {
      const convo = conversations.get(partnerId)
      const intro = el(
        "div",
        "tt-message tt-system",
        t("penpalIntro", { name: convo?.partnerName ?? t("someonePlaceholder") }),
      )
      messages.insertBefore(intro, messages.firstChild)
    }
    scrollMessagesToEnd()
  }

  function askInvite(name: string): Promise<boolean> {
    invitePrompt.querySelector(".tt-avatar")!.textContent = avatarInitial(name)
    invitePrompt.querySelector("h3")!.textContent = t("inviteSentTitle", { name })
    invitePrompt.querySelector("p")!.textContent = t("inviteBody", { name })
    invitePrompt.removeAttribute("hidden")
    return new Promise((resolve) => {
      inviteReply = resolve
    })
  }

  function settleInvite(accepted: boolean): void {
    invitePrompt.setAttribute("hidden", "")
    inviteReply?.(accepted)
    inviteReply = null
  }

  function sendControl(kind: "ended", p: WirePlayer | null = openPartnerWire()): void {
    if (!room || !p) return
    room.send(
      MP_MSG.chatSend,
      composeControlInput(me as PlayerId, p.playerId as PlayerId, kind, selectedLanguage),
    )
  }

  /** Switch the top-level view and render the surface it lands on. */
  function setView(next: TeletronView): void {
    view = next
    root.dataset.view = next
    root.classList.toggle("is-thread-open", next === "thread")
    if (next === "inbox") renderInbox()
    else if (next === "waiting") renderPeople()
  }

  /** Human-readable status line for an inbox row. */
  function convoStatusLine(c: Conversation): string {
    if (c.lifecycle === "ended") return t("convoEnded")
    if (c.lifecycle === "dormant") return t("convoDrifted")
    return c.partnerOnline ? t("convoOnline") : t("convoAway")
  }

  /** (Re)draw the inbox conversation list. Inbox is home. */
  function renderInbox(): void {
    inboxList.replaceChildren()
    const items = [...conversations.values()].sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    if (!items.length) {
      const empty = el("div", "tt-inbox-empty")
      empty.append(
        el("p", undefined, t("noConversationsYet")),
        (() => {
          const cta = el("button", "tt-inbox-cta")
          cta.type = "button"
          cta.textContent = t("findAPenpal")
          cta.addEventListener("click", () => setView("waiting"))
          return cta
        })(),
      )
      inboxList.appendChild(empty)
      return
    }
    for (const c of items) {
      const row = el("button", "tt-inbox-row")
      row.type = "button"
      if (c.lifecycle === "ended") row.classList.add("is-ended")
      else if (!c.partnerOnline) row.classList.add("is-away")
      row.setAttribute(
        "aria-label",
        c.unread
          ? t("unreadAria", { name: c.partnerName, status: convoStatusLine(c), count: String(c.unread) })
          : t("rowAria", { name: c.partnerName, status: convoStatusLine(c) }),
      )
      const avatar = el("span", "tt-avatar", avatarInitial(c.partnerName))
      if (c.lifecycle === "active" && c.partnerOnline) avatar.classList.add("is-online")
      const body = el("span")
      body.append(el("b", undefined, c.partnerName), el("small", undefined, convoStatusLine(c)))
      row.append(avatar, body)
      if (c.unread > 0) row.appendChild(el("span", "tt-unread", String(c.unread)))
      row.addEventListener("click", () =>
        openThread({ playerId: c.partnerId, name: c.partnerName, target: "", native: "" }),
      )
      inboxList.appendChild(row)
    }
  }

  function openThread(p: WirePlayer, opts?: { dormant?: boolean; online?: boolean }): void {
    cancelSpeech()
    closeThreadMenu()
    const dormant = opts?.dormant ?? false
    const convo = upsertConvo(p.playerId, p.name, {
      lifecycle: dormant ? "dormant" : "active",
      partnerOnline: dormant ? false : opts?.online ?? true,
      unread: 0,
    })
    openPartnerId = p.playerId
    view = "thread"
    root.dataset.view = "thread"
    root.classList.add("is-thread-open")
    thread.removeAttribute("hidden")
    $(".tt-partner").textContent = convo.partnerName
    threadAvatar.textContent = avatarInitial(convo.partnerName)
    threadStatus.textContent = dormant ? t("threadDriftedHead") : t("penpalConnected")
    messages.replaceChildren()
    // Fresh, live chats get the moderation intro; restored/dormant ones hydrate
    // from disk (and a dormant restore shows a warm closure note if empty).
    void hydrateThread(p.playerId, !dormant)
    if (dormant) {
      addMessage("system", t("partnerDriftedSystem", { name: convo.partnerName }))
    }
    updateThreadConnState()
    renderInbox()
    renderPeople()
    // Don't auto-focus the field — that pops the keyboard, and many people will
    // reach for the mic. Ready dictation; let the user choose to type or speak.
    if (!dormant) void refreshDictation()
  }

  /**
   * Mark a specific conversation ended. Only mutates the visible thread when it's
   * the one open; otherwise it just badges the inbox row.
   */
  function markThreadEnded(partnerId: string, text: string): void {
    const convo = conversations.get(partnerId)
    const alreadyEnded = convo?.lifecycle === "ended"
    // An ended conversation has no live pair to resume against.
    confirmedPairs.delete(partnerId)
    pendingOutbound.delete(partnerId)
    for (const [inviteId, partner] of reestablishing) {
      if (partner === partnerId) reestablishing.delete(inviteId)
    }
    upsertConvo(partnerId, convo?.partnerName ?? t("someonePlaceholder"), {
      lifecycle: "ended",
      partnerOnline: false,
    })
    void transcripts
      .setMeta({
        partnerId,
        partnerName: convo?.partnerName ?? t("someonePlaceholder"),
        lastActivityAt: convo?.lastActivityAt ?? Date.now(),
        lapsedAt: Date.now(),
      })
      .catch((error) => console.error("[teletron] lapse transcript meta failed:", error))
    if (openPartnerId === partnerId) {
      cancelSpeech()
      threadStatus.textContent = t("chatEnded")
      field.value = ""
      autosizeComposer()
      if (!alreadyEnded) addMessage("system", text)
    }
    updateQuota()
    renderInbox()
    renderPeople()
  }

  /** Back chevron / Exit-to-Corpan inbox return — non-destructive. */
  function closeThreadToInbox(): void {
    cancelSpeech()
    closeThreadMenu()
    openPartnerId = null
    messages.replaceChildren()
    thread.setAttribute("hidden", "")
    setView("inbox")
    updateQuota()
  }

  /** The overflow "End conversation" — sends ended, keeps the keepsake, to inbox. */
  function endConversation(): void {
    closeThreadMenu()
    const convo = currentConvo()
    if (!convo) return closeThreadToInbox()
    if (convo.lifecycle === "active") {
      sendControl("ended", openPartnerWire())
    }
    markThreadEnded(convo.partnerId, t("youEndedChat"))
    closeThreadToInbox()
  }

  /**
   * Block (and optionally report) a partner. Adds them to the durable device
   * block list, mirrors it to the server (suppresses their invites/messages +
   * tears down the link), removes the transcript from this device, and closes
   * the thread. Required All-Ages UGC safety affordance.
   */
  function blockPartner(p: WirePlayer, opts: { report: boolean }): void {
    if (opts.report) room?.send(MP_MSG.report, { target: p.playerId })
    room?.send(MP_MSG.block, { target: p.playerId, action: "block" })
    if (isActiveWith(p.playerId)) sendControl("ended", p)
    blocked.add(p.playerId)
    persistBlocks(blocked)
    players.delete(p.playerId)
    profiles.delete(p.playerId)
    conversations.delete(p.playerId)
    // Drop all recovery state for a blocked partner (no resume, no queued sends).
    confirmedPairs.delete(p.playerId)
    pendingOutbound.delete(p.playerId)
    for (const [inviteId, partner] of reestablishing) {
      if (partner === p.playerId) reestablishing.delete(inviteId)
    }
    void transcripts
      .remove(p.playerId)
      .catch((error) => console.error("[teletron] remove transcript on block failed:", error))
    closeThreadToInbox()
    showToast(opts.report ? t("reportedAndBlocked", { name: p.name }) : t("blockedName", { name: p.name }))
  }

  function openSafetySheet(): void {
    const convo = currentConvo()
    if (!convo) return
    safetySheet.querySelector(".tt-avatar")!.textContent = avatarInitial(convo.partnerName)
    safetySheet.querySelector("h3")!.textContent = t("blockTitle", { name: convo.partnerName })
    safetySheet.removeAttribute("hidden")
  }

  function closeSafetySheet(): void {
    safetySheet.setAttribute("hidden", "")
  }

  /** Overflow popover (End / Block / Exit). */
  let overflowOutside: ((e: MouseEvent) => void) | null = null
  let overflowEsc: ((e: KeyboardEvent) => void) | null = null
  function openThreadMenu(): void {
    if (!threadMenu.hasAttribute("hidden")) return
    threadMenu.removeAttribute("hidden")
    overflowButton.setAttribute("aria-expanded", "true")
    const first = threadMenu.querySelector<HTMLButtonElement>("button")
    first?.focus()
    overflowOutside = (e: MouseEvent) => {
      if (!threadMenu.contains(e.target as Node) && e.target !== overflowButton) closeThreadMenu()
    }
    overflowEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        closeThreadMenu()
      }
    }
    document.addEventListener("mousedown", overflowOutside)
    document.addEventListener("keydown", overflowEsc)
  }
  function closeThreadMenu(): void {
    if (threadMenu.hasAttribute("hidden")) return
    threadMenu.setAttribute("hidden", "")
    overflowButton.setAttribute("aria-expanded", "false")
    if (overflowOutside) document.removeEventListener("mousedown", overflowOutside)
    if (overflowEsc) document.removeEventListener("keydown", overflowEsc)
    overflowOutside = null
    overflowEsc = null
    // Return focus to the trigger for keyboard users — but only while the thread
    // is still on screen (some closes immediately route away to the inbox).
    if (view === "thread") overflowButton.focus()
  }

  /** Cap-choice sheet (free tier already at its one-link limit). */
  let capChoiceTarget: WirePlayer | null = null
  function openCapChoice(p: WirePlayer): void {
    capChoiceTarget = p
    capChoiceSheet.removeAttribute("hidden")
  }
  function closeCapChoice(): void {
    capChoiceSheet.setAttribute("hidden", "")
    capChoiceTarget = null
  }

  function invite(p: WirePlayer): void {
    if (!room) return showToast(t("stillConnecting"))
    if (!modelReady) return showToast(t("prepareAiFirst"))
    if (isActiveWith(p.playerId)) {
      return showToast(t("alreadyChatting", { name: p.name }))
    }
    if (pendingInvite) {
      const target = pendingInvite.player.playerId === p.playerId ? p.name : pendingInvite.player.name
      return showToast(t("waitingForRespond", { name: target }))
    }
    // Capacity gate (not "already active"): at cap, free tier gets a choice sheet,
    // Plus has plenty of room. No silent end.
    if (livingCount() >= linkCap()) {
      if (plus) return showToast(t("conversationLimit"))
      return openCapChoice(p)
    }
    sendInvite(p)
  }

  /** Actually fire an invite to a player (post-gate). */
  function sendInvite(p: WirePlayer): void {
    if (!room) return showToast(t("stillConnecting"))
    const inviteId = `tele-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    pendingInvite = { inviteId, player: p }
    room.send(MP_MSG.invite, { inviteId, to: p.playerId, offer: { kind: "chat" } })
    renderPeople()
    showToast(t("invitationSent", { name: p.name }))
  }

  /**
   * Transparently re-establish a forgotten server-side accepted pair for an
   * EXISTING penpal. Reuses the normal invite handshake, but tracked separately
   * from the human-facing `pendingInvite` slot so resuming one conversation never
   * clobbers a fresh invite the user is making. The recipient auto-accepts when
   * we are an established penpal (see the `invited` handler), so this is silent.
   */
  function reestablishLink(partnerId: string): void {
    if (!room || connStatus !== "online") return
    // One in-flight re-establish per partner is enough.
    for (const id of reestablishing.values()) if (id === partnerId) return
    const convo = conversations.get(partnerId)
    if (!convo) return
    const inviteId = `tele-resume-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    reestablishing.set(inviteId, partnerId)
    room.send(MP_MSG.invite, { inviteId, to: partnerId, offer: { kind: "chat" } })
  }

  /** Flush any messages queued while a pair was being (re)established. */
  function flushPendingOutbound(partnerId: string): void {
    if (!room || !confirmedPairs.has(partnerId)) return
    const queue = pendingOutbound.get(partnerId)
    if (!queue || !queue.length) return
    pendingOutbound.delete(partnerId)
    for (const input of queue) room.send(MP_MSG.chatSend, input)
  }

  /**
   * Route a prepared outbound message. If the accepted pair is confirmed this
   * session, send immediately. Otherwise QUEUE it and re-establish the link —
   * the message flushes the moment the pair is (re)confirmed. This is what makes
   * a resumed conversation actually deliver after a server restart / TTL lapse,
   * and what stops the silent message loss the server used to produce.
   */
  function dispatchOutbound(partnerId: string, input: MediatedChatInput): void {
    if (!room) return
    if (confirmedPairs.has(partnerId)) {
      room.send(MP_MSG.chatSend, input)
      return
    }
    const queue = pendingOutbound.get(partnerId) ?? []
    queue.push(input)
    pendingOutbound.set(partnerId, queue)
    reestablishLink(partnerId)
  }

  /** Mark a partner's accepted pair confirmed live and flush anything queued. */
  function confirmPair(partnerId: string): void {
    confirmedPairs.add(partnerId)
    flushPendingOutbound(partnerId)
  }

  async function send(text: string): Promise<void> {
    const convo = currentConvo()
    if (!room || connStatus !== "online") return showToast(t("reconnectingTryAgain"))
    if (!convo || convo.lifecycle !== "active") return showToast(t("chooseToTalkFirst"))
    const currentPartnerId = convo.partnerId
    // An offline partner is fine: the server buffers the message and delivers it
    // when they return (within the 24h living-link window). Sending only requires
    // OUR socket to be up.
    if (!modelReady || quotaRemaining(plus) <= 0) return
    const interactionId = `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    addMessage("self", text)
    persistMessage(convo.partnerId, convo.partnerName, {
      id: interactionId,
      side: "self",
      text,
      ts: Date.now(),
    })
    upsertConvo(convo.partnerId, convo.partnerName, { lastActivityAt: Date.now() })
    field.value = ""
    autosizeComposer()
    const placeholder = el("div", "tt-message tt-system", t("cleaningLocally"))
    messages.appendChild(placeholder)
    let input: MediatedChatInput
    try {
      input = await mediator.prepareOutbound({
        from: me as PlayerId,
        to: currentPartnerId as PlayerId,
        interactionId,
        text,
        sourceLanguage: selectedLanguage,
        targetLanguage: selectedLanguage,
        mode: "beginner",
      })
    } catch (error) {
      console.error("[teletron] prepareOutbound failed:", error)
      placeholder.remove()
      addMessage("system", t("couldNotPrepare"))
      return
    }
    if (!room || !isActiveWith(currentPartnerId)) {
      placeholder.remove()
      addMessage("system", t("notSentChatEnded"))
      return
    }
    placeholder.remove()
    // Route through the pair-aware dispatcher: sends now if the accepted pair is
    // confirmed, otherwise queues + re-establishes the link (server restart / TTL
    // lapse) and flushes on confirm — no more sending into a void.
    dispatchOutbound(currentPartnerId, input)
    consumeQuota(plus)
    updateQuota()
  }

  /**
   * A background inbound message — for a conversation that is NOT the open
   * thread. It must never touch the `activeStream` singleton (that belongs to
   * the open thread) nor render into the visible `messages` DOM; it lessonifies
   * off-screen, appends to that convo's transcript, bumps unread, and re-renders
   * the inbox + toasts.
   */
  async function receiveBackground(
    input: MediatedChatInput,
    sender: WirePlayer,
  ): Promise<void> {
    const locale = selectedLanguage
    let artifact
    try {
      artifact = await mediator.lessonify(
        input,
        { native: languages.native, target: locale },
        { level: recipientLevel },
      )
    } catch (error) {
      console.error("[teletron] background lessonify failed:", error)
      return
    }
    const convo = conversations.get(sender.playerId)
    // If, while lessonifying, the user opened THIS thread, fall through to the
    // open-thread persist+render path instead of double-handling.
    persistMessage(sender.playerId, sender.name, {
      id: input.interactionId,
      side: "peer",
      text: artifact.visibleText,
      detail: artifact.naturalTranslation,
      ts: Date.now(),
    })
    if (openPartnerId === sender.playerId) {
      // The thread is open now — render it inline (no unread bump).
      const msg = addMessage("peer", artifact.visibleText, artifact.naturalTranslation)
      msg.classList.add("is-speakable")
      msg.addEventListener("click", () => speakNow(locale, artifact.visibleText))
      return
    }
    upsertConvo(sender.playerId, sender.name, {
      lifecycle: convo?.lifecycle === "ended" ? "active" : convo?.lifecycle ?? "active",
      partnerOnline: true,
      lastActivityAt: Date.now(),
      unread: (convo?.unread ?? 0) + 1,
    })
    renderInbox()
    renderPeople()
    showToast(t("sentYouAMessage", { name: sender.name }))
  }

  async function receive(input: MediatedChatInput): Promise<void> {
    const control = controlKind(input)
    const p = players.get(input.from)
    const known = conversations.get(input.from)
    const sender = p ?? {
      playerId: input.from,
      name: known?.partnerName ?? t("someonePlaceholder"),
      target: "",
      native: "",
    }
    if (control === "ended") {
      markThreadEnded(sender.playerId, t("partnerEndedChat", { name: sender.name }))
      return
    }
    // A message for a thread that isn't open must never jerk the user into the
    // room. Surface it as an unread on the Conversations screen (+ a toast) and
    // let them choose to open it.
    if (!isActiveWith(sender.playerId)) {
      await receiveBackground(input, sender)
      return
    }
    upsertConvo(sender.playerId, sender.name, { partnerOnline: true, lastActivityAt: Date.now() })
    updateThreadConnState()
    const placeholder = el("div", "tt-message tt-system", t("interpretingLocally"))
    messages.appendChild(placeholder)
    const streamingMessage = addMessage("peer", "")
    streamingMessage.classList.add("is-streaming")
    streamingMessage.setAttribute("hidden", "")
    const streamingBody = streamingMessage.querySelector<HTMLElement>("div")!
    const epoch = speechEpoch
    const locale = selectedLanguage
    activeStream = {
      epoch,
      locale,
      buffer: ttsEnabled ? new StreamingSentenceBuffer(locale) : null,
      placeholder,
      message: streamingMessage,
      body: streamingBody,
      visibleText: "",
      revealed: false,
    }
    let artifact
    try {
      artifact = await mediator.lessonify(
        input,
        { native: languages.native, target: locale },
        { level: recipientLevel },
      )
    } catch (error) {
      console.error("[teletron] lessonify failed:", error)
      if (activeStream?.epoch === epoch) activeStream = null
      placeholder.remove()
      streamingMessage.remove()
      addMessage("system", t("couldNotOpen"))
      return
    }
    if (openPartnerId !== sender.playerId) {
      if (activeStream?.epoch === epoch) activeStream = null
      placeholder.remove()
      streamingMessage.remove()
      return
    }
    const stream = activeStream?.epoch === epoch ? activeStream : null
    if (stream) {
      finishTargetStream(stream, artifact.visibleText)
      placeholder.remove()
      revealActiveStream(stream)
      stream.message.classList.remove("is-streaming")
      stream.body.textContent = artifact.visibleText
      if (artifact.naturalTranslation) stream.message.appendChild(el("small", undefined, artifact.naturalTranslation))
      stream.message.classList.add("is-speakable")
      stream.message.addEventListener("click", () => speakNow(locale, artifact.visibleText))
      activeStream = null
      scrollMessagesToEnd()
    } else {
      placeholder.remove()
      const msg = addMessage("peer", artifact.visibleText, artifact.naturalTranslation)
      msg.classList.add("is-speakable")
      msg.addEventListener("click", () => speakNow(locale, artifact.visibleText))
    }
    upsertConvo(sender.playerId, sender.name, { lastActivityAt: Date.now() })
    persistMessage(sender.playerId, sender.name, {
      id: input.interactionId,
      side: "peer",
      text: artifact.visibleText,
      detail: artifact.naturalTranslation,
      ts: Date.now(),
    })
  }

  function enqueueReceive(input: MediatedChatInput): void {
    receiveTail = receiveTail
      .catch((error) => console.error("[teletron] receive queue recovered:", error))
      .then(async () => {
        if (!mounted) return
        await receive(input)
      })
  }

  async function probeModel(): Promise<void> {
    if (modelBusy) return
    modelBusy = true
    modelBar.removeAttribute("hidden")
    modelButton.disabled = true
    modelButton.hidden = true
    modelButton.textContent = t("retry")
    if (!hostApi.llm) {
      modelText.textContent = t("noOnDeviceAi")
      modelBusy = false
      return
    }
    try {
      const installed = await hostApi.llm.isInstalled(BASE_MODEL.id).catch(() => false)
      if (!installed) {
        modelReady = false
        modelText.textContent = t("modelRequired", { size: String(BASE_MODEL.sizeMb) })
        modelButton.textContent = t("installModel")
        modelButton.hidden = false
        return
      }

      modelText.textContent = t("loadingModel")
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const status = await hostApi.llm.status().catch(() => null)
          if (status?.loaded && status.modelId === BASE_MODEL.id) {
            modelReady = true
            break
          }
          if (attempt > 0 || status?.loaded) {
            await hostApi.llm.unload().catch((error) => {
              console.warn("[teletron] model unload before retry failed:", error)
            })
            await sleep(MODEL_RETRY_DELAY_MS)
          }
          await hostApi.llm.load({ modelPackId: BASE_MODEL.id })
          const after = await hostApi.llm.status().catch(() => null)
          if (after?.loaded && after.modelId === BASE_MODEL.id) {
            modelReady = true
            break
          }
          throw new Error(`loaded=${String(after?.loaded)} modelId=${after?.modelId ?? "unknown"}`)
        } catch (error) {
          console.error(`[teletron] model load attempt ${attempt + 1} failed:`, error)
          modelReady = false
          await hostApi.llm.unload().catch(() => {})
          await sleep(MODEL_RETRY_DELAY_MS)
        }
      }

      if (!modelReady) {
        modelText.textContent = t("modelCouldNotLoad")
        modelButton.textContent = t("retry")
        modelButton.hidden = false
      }
    } catch (error) {
      console.error("[teletron] model load failed:", error)
      modelReady = false
      modelText.textContent = t("modelCouldNotLoad")
      modelButton.textContent = t("retry")
      modelButton.hidden = false
    } finally {
      modelBusy = false
      modelButton.disabled = false
      modelBar.classList.toggle("is-ready", modelReady)
      modelBar.toggleAttribute("hidden", modelReady)
      updateQuota()
    }
  }

  modelButton.addEventListener("click", async () => {
    if (!hostApi.llm) return
    modelButton.disabled = true
    try {
      const installed = await hostApi.llm.isInstalled(BASE_MODEL.id).catch(() => false)
      if (!installed) {
        if (!hostApi.llm.install) return
        await hostApi.llm.install({ packId: BASE_MODEL.id, url: BASE_MODEL.url }, (p) => {
          modelText.textContent =
            p.stage === "downloading" && p.total
              ? t("downloadingSharedModel", { percent: String(Math.round((p.progress / p.total) * 100)) })
              : p.message || p.stage
        })
      }
      modelButton.hidden = true
      await probeModel()
    } finally {
      modelButton.disabled = false
    }
  })

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    const text = field.value.trim()
    if (text) void send(text)
  })
  field.addEventListener("input", autosizeComposer)
  window.addEventListener("resize", autosizeComposer)
  disposers.push(() => window.removeEventListener("resize", autosizeComposer))
  autosizeComposer()

  /** The PRIMARY phone leave — dispatch corpan:exit ONLY. Non-destructive: never
   * disposes the socket, never ends a chat. */
  function exitToCorpan(): void {
    closeThreadMenu()
    window.dispatchEvent(new CustomEvent("corpan:exit", { detail: { packId: PACK_ID } }))
  }

  // Thread Back chevron → inbox (non-destructive).
  $(".tt-thread-back").addEventListener("click", closeThreadToInbox)
  // Inbox "Find a penpal" → waiting room.
  $(".tt-find").addEventListener("click", () => setView("waiting"))
  // Waiting room → back to inbox.
  $(".tt-lobby-back").addEventListener("click", () => setView("inbox"))
  // Overflow menu trigger + items.
  overflowButton.addEventListener("click", () => {
    if (threadMenu.hasAttribute("hidden")) openThreadMenu()
    else closeThreadMenu()
  })
  threadMenu.querySelector(".tt-menu-end")!.addEventListener("click", endConversation)
  threadMenu.querySelector(".tt-menu-block")!.addEventListener("click", () => {
    closeThreadMenu()
    openSafetySheet()
  })
  threadMenu.querySelector(".tt-menu-exit")!.addEventListener("click", exitToCorpan)
  safetySheet.querySelector("[data-safety-cancel]")!.addEventListener("click", closeSafetySheet)
  safetySheet.querySelector("[data-safety-block]")!.addEventListener("click", () => {
    closeSafetySheet()
    const wire = openPartnerWire()
    if (wire) blockPartner(wire, { report: false })
  })
  safetySheet.querySelector("[data-safety-report]")!.addEventListener("click", () => {
    closeSafetySheet()
    const wire = openPartnerWire()
    if (wire) blockPartner(wire, { report: true })
  })
  // Cap-choice sheet actions.
  capChoiceSheet.querySelector("[data-cap-keep]")!.addEventListener("click", closeCapChoice)
  capChoiceSheet.querySelector("[data-cap-swap]")!.addEventListener("click", () => {
    const target = capChoiceTarget
    closeCapChoice()
    if (!target) return
    // End the current living conversation, then invite the new partner.
    const current = [...conversations.values()].find((c) => c.lifecycle !== "ended")
    if (current) {
      if (current.lifecycle === "active") {
        sendControl("ended", { playerId: current.partnerId, name: current.partnerName, target: "", native: "" })
      }
      markThreadEnded(current.partnerId, t("youEndedChat"))
    }
    sendInvite(target)
  })
  capChoiceSheet.querySelector("[data-cap-plus]")!.addEventListener("click", () => {
    closeCapChoice()
    window.dispatchEvent(new CustomEvent("corpan:request-unlock", { detail: { packId: PACK_ID } }))
  })
  voiceButton.addEventListener("click", () => {
    ttsEnabled = !ttsEnabled
    localStorage.setItem("teletron.tts", ttsEnabled ? "on" : "off")
    updateVoiceButton()
    if (!ttsEnabled) cancelSpeech()
  })
  invitePrompt.querySelector("[data-accept]")!.addEventListener("click", () => settleInvite(true))
  invitePrompt.querySelector("[data-decline]")!.addEventListener("click", () => settleInvite(false))
  $(".tt-back").addEventListener("click", exitToCorpan)
  onboarding.querySelector("[data-reroll]")!.addEventListener("click", () => {
    name = anonymousName(true)
    ownName.textContent = name
  })
  languageSelect.addEventListener("change", () => {
    selectedLanguage = languageSelect.value as LanguageCode
    void refreshDictation()
  })
  $(".tt-enter").addEventListener("click", () => {
    selectedLanguage = languageSelect.value as LanguageCode
    void refreshDictation()
    onboarding.setAttribute("hidden", "")
    // Land on the inbox (home). hydrateInbox() refines this after the first join.
    setView("inbox")
    void connect()
  })
  for (const toggle of root.querySelectorAll<HTMLInputElement>("[data-toggle]")) {
    toggle.addEventListener("change", () => {
      if (toggle.dataset.toggle === "stack") revealStack = toggle.checked
      if (toggle.dataset.toggle === "country") revealCountry = toggle.checked
      publishProfile()
      requestProfiles()
    })
  }

  const stopDictation = wireDictation({
    button: mic,
    field,
    resolveProvider: dictationResolver(hostApi.asr as never),
    lang: () => selectedLanguage,
    hideWhenUnavailable: false,
    onAvailabilityChange: (available: boolean) => {
      dictationAvailable = available
      updateQuota()
    },
    onLiveChange: (live: boolean) => form.classList.toggle("is-listening", live),
  })
  refreshDictation = stopDictation.refresh
  disposers.push(stopDictation)

  /** Bind handlers to a freshly (re)joined room. Called on every reconnect. */
  function bindRoom(joined: Room): void {
    room = joined
    // Fresh room state: drop stale presence and let onAdd repopulate.
    players.clear()
    profiles.clear()
    renderPeople()
    // Bind room message handlers BEFORE publishProfile(). The server's
    // profilePublish handler synchronously drains the outbox and `client.send`s
    // each buffered chatDeliver — the comment at PlazaRoom.ts profilePublish
    // explicitly relies on "the client publishes its profile right after
    // binding its message handlers." Publishing first leaves a window where
    // the round-trip is the only thing protecting freshly-buffered messages
    // from arriving before chatDeliver is registered; on a hot reconnect the
    // server response can land in the same microtask and the message is
    // dropped on the floor.
    const callbacks = getStateCallbacks(joined) as unknown as (
      target: unknown,
    ) => { players: { onAdd: (cb: (p: WirePlayer, key: string) => void) => () => void; onRemove: (cb: (p: WirePlayer, key: string) => void) => () => void } }
    const pc = callbacks(joined.state).players
    roomDisposers.push(
      pc.onAdd((p, key) => {
        if (key === joined.sessionId) return
        const id = p.playerId || key
        players.set(id, p)
        joined.send(MP_MSG.profileRequest, { target: id })
        // A penpal of ANY living conversation returned to the room → mark online.
        const convo = conversations.get(id)
        if (convo && convo.lifecycle !== "ended" && !convo.partnerOnline) {
          upsertConvo(id, convo.partnerName, { partnerOnline: true })
          if (openPartnerId === id) updateThreadConnState()
          renderInbox()
        }
        // If we have messages queued for a partner whose pair is not yet
        // confirmed (server forgot it while they were offline), their return is
        // the moment to re-establish the link and flush the queue.
        if (
          convo &&
          convo.lifecycle !== "ended" &&
          !confirmedPairs.has(id) &&
          pendingOutbound.get(id)?.length
        ) {
          reestablishLink(id)
        }
        renderPeople()
      }),
      pc.onRemove((p, key) => {
        const id = p.playerId || key
        players.delete(id)
        profiles.delete(id)
        if (pendingInvite?.player.playerId === id) {
          pendingInvite = null
          showToast(t("leftBeforeResponding", { name: p.name || t("someonePlaceholder") }))
        }
        // A penpal stepped away — keep the thread alive (resilient), just pause it.
        const convo = conversations.get(id)
        if (convo && convo.lifecycle !== "ended" && convo.partnerOnline) {
          upsertConvo(id, convo.partnerName, { partnerOnline: false })
          if (openPartnerId === id) {
            updateThreadConnState()
            showToast(t("wentOffline", { name: convo.partnerName }))
          }
          renderInbox()
        }
        renderPeople()
      }),
      joined.onMessage(MP_MSG.profileCard, (raw) => {
        const parsed = SafeProfile.safeParse(raw)
        if (!parsed.success) return
        profiles.set(parsed.data.playerId, parsed.data)
        renderPeople()
      }),
      joined.onMessage(MP_MSG.invited, async (raw) => {
        const parsed = InvitedMessage.safeParse(raw)
        if (!parsed.success || parsed.data.offer.kind !== "chat") return
        if (isBlocked(parsed.data.from)) {
          joined.send(MP_MSG.inviteRespond, { inviteId: parsed.data.inviteId, action: "decline" })
          return
        }
        const p = players.get(parsed.data.from) ?? {
          playerId: parsed.data.from,
          name: parsed.data.fromName,
          target: "",
          native: "",
        }
        // An ESTABLISHED penpal (one we hold a durable transcript link for) is
        // re-establishing a link the server forgot (restart / TTL lapse). Auto-
        // accept WITHOUT a prompt — we already consented to this person, and the
        // safety model still holds: a genuine stranger has no on-device link, so
        // they always fall through to the human accept/decline prompt below.
        const known = await isEstablishedPenpal(parsed.data.from)
        if (known) {
          joined.send(MP_MSG.inviteRespond, { inviteId: parsed.data.inviteId, action: "accept" })
          const convo = conversations.get(p.playerId)
          upsertConvo(p.playerId, convo?.partnerName || p.name, {
            lifecycle: convo?.lifecycle === "ended" ? "ended" : "active",
            partnerOnline: true,
          })
          // The pair is now live on the server → flush anything we had queued.
          confirmPair(p.playerId)
          renderInbox()
          renderPeople()
          return
        }
        // Already mid-invite-flow, OR no room for a new living link → decline.
        const atCap = livingCount() >= linkCap() && !isActiveWith(parsed.data.from)
        if (pendingInvite || inviteReply || atCap) {
          joined.send(MP_MSG.inviteRespond, {
            inviteId: parsed.data.inviteId,
            action: "decline",
          })
          showToast(t("invitedButBusy", { name: p.name }))
          return
        }
        const accepted = await askInvite(p.name)
        joined.send(MP_MSG.inviteRespond, {
          inviteId: parsed.data.inviteId,
          action: accepted ? "accept" : "decline",
        })
        if (accepted) {
          upsertConvo(p.playerId, p.name, { lifecycle: "active", partnerOnline: true })
          confirmPair(p.playerId)
          openThread(p)
        }
      }),
      joined.onMessage(MP_MSG.inviteResult, (raw) => {
        const parsed = InviteResult.safeParse(raw)
        if (!parsed.success) return
        // (a) Silent re-establish handshake (resuming a forgotten pair).
        const reestablishPartner = reestablishing.get(parsed.data.inviteId)
        if (reestablishPartner) {
          reestablishing.delete(parsed.data.inviteId)
          if (parsed.data.outcome === "accepted") {
            // Pair is live again → flush the queued message(s).
            confirmPair(reestablishPartner)
          } else {
            // Couldn't re-establish now (partner offline → the server can't form
            // a pair without a live partner). KEEP the queued message; it flushes
            // when the partner returns (presence onAdd retries reestablishLink).
            const convo = conversations.get(reestablishPartner)
            if (convo && openPartnerId === reestablishPartner) {
              addMessage("system", t("wentOffline", { name: convo.partnerName }))
            }
          }
          return
        }
        // (b) The human-facing invite the user just sent.
        if (!pendingInvite || parsed.data.inviteId !== pendingInvite.inviteId) return
        const invitedPlayer = pendingInvite.player
        pendingInvite = null
        renderPeople()
        if (parsed.data.outcome === "accepted") {
          upsertConvo(invitedPlayer.playerId, invitedPlayer.name, {
            lifecycle: "active",
            partnerOnline: true,
          })
          confirmPair(invitedPlayer.playerId)
          openThread(invitedPlayer)
        } else showToast(t("invitationOutcome", { outcome: parsed.data.outcome }))
      }),
      joined.onMessage(MP_MSG.chatDeliver, (raw) => {
        const parsed = MediatedChatInput.safeParse(raw)
        if (parsed.success && !isBlocked(parsed.data.from)) enqueueReceive(parsed.data)
      }),
      joined.onMessage(MP_MSG.chatControl, (raw) => {
        const parsed = ChatControlDeliver.safeParse(raw)
        if (!parsed.success) return
        const partnerId = parsed.data.from
        if (isBlocked(partnerId)) return
        if (parsed.data.action === "link-stale") {
          // We tried to send but the server holds no accepted pair (restart / TTL
          // lapse). Don't lose the message: re-establish the link. Anything we
          // queued for this partner flushes once the pair is confirmed. Only do
          // this for a living conversation we still care about.
          const convo = conversations.get(partnerId)
          if (convo && convo.lifecycle !== "ended") {
            confirmedPairs.delete(partnerId)
            reestablishLink(partnerId)
          }
          return
        }
        // partner-returned implies the server's pair is live again → confirm it
        // so a queued message flushes immediately on the partner's return.
        if (parsed.data.action === "partner-returned") {
          confirmPair(partnerId)
        }
        // partner-left / ended are already covered by presence onRemove + the
        // magic-interactionId "ended" chat-send path; nothing extra needed here.
      }),
    )
    // All handlers (especially chatDeliver) are bound — now signal readiness so
    // the server flushes anything the outbox was holding for us.
    publishProfile()
    // After the first successful join, build the inbox from on-device history.
    if (!restoredConversation) {
      restoredConversation = true
      void hydrateInbox()
    }
  }

  /** The current room dropped — detach handlers; all penpals are now offline. */
  function loseRoom(): void {
    room = null
    // The accepted pair lives in the (possibly different) room we'll rejoin; a
    // fresh join must re-confirm it. Keep any queued outbound — it flushes once
    // the pair is re-established on the new room. Drop in-flight re-establish
    // invites (their inviteIds belong to the dead room).
    confirmedPairs.clear()
    reestablishing.clear()
    for (const c of conversations.values()) {
      if (c.lifecycle !== "ended" && c.partnerOnline) {
        upsertConvo(c.partnerId, c.partnerName, { partnerOnline: false })
      }
    }
    for (const dispose of roomDisposers.splice(0)) {
      try {
        dispose()
      } catch (error) {
        console.warn("[teletron] room handler dispose failed:", error)
      }
    }
    players.clear()
    profiles.clear()
    renderInbox()
    renderPeople()
    updateThreadConnState()
  }

  /**
   * On cold start, build the inbox from ALL on-device links: living links become
   * dormant conversations (reachable keepsakes that re-activate on the next
   * message), lapsed/expired links become read-only "ended" keepsakes. We land
   * on the INBOX — and only deep-link straight into a thread when there's exactly
   * one living conversation that has unread (nothing ambiguous to choose from).
   * Best-effort; never throws.
   */
  async function hydrateInbox(): Promise<void> {
    let links
    try {
      links = await transcripts.links()
    } catch (error) {
      console.error("[teletron] hydrate inbox failed:", error)
      setView("inbox")
      return
    }
    const now = Date.now()
    for (const l of links) {
      if (isBlocked(l.partnerId)) continue
      const living = !l.lapsedAt && now - l.lastActivityAt < LINK_TTL_MS
      // Don't clobber a conversation that already came alive (live message landed
      // during hydration).
      if (conversations.has(l.partnerId)) continue
      upsertConvo(l.partnerId, l.partnerName, {
        lifecycle: living ? "dormant" : "ended",
        partnerOnline: living ? players.has(l.partnerId) : false,
        lastActivityAt: l.lastActivityAt,
        unread: 0,
      })
    }
    if (view === "thread") {
      // A live message already opened a thread during hydration — leave it.
      renderInbox()
      return
    }
    setView("inbox")
  }

  function connect(): void {
    if (conn) {
      conn.wake()
      return
    }
    setStatus("connecting")
    conn = createResilientRoom({
      url: serverUrl(),
      roomName: "teletron",
      joinOptions: { playerId: me, name, avatar: { base: "teletron", layers: [] }, sceneId: "teletron" },
      onRoom: bindRoom,
      onRoomLost: loseRoom,
      onStatus: (s) => {
        connStatus = s
        setStatus(s)
        updateThreadConnState()
      },
    })
  }

  updateQuota()
  updateVoiceButton()
  renderPeople()
  void probeModel()

  return {
    unmount: () => {
      mounted = false
      // Unmount fires when the user steps away (Back arrow → corpan:exit, pack
      // switch, app background that tears the pack down) — NOT a deliberate
      // end-of-chat. Sending `ended` here would forget the accepted pair on the
      // server, which also drops every still-buffered envelope between this
      // pair (forgetAcceptedPair → outbox.removeForPair) and rejects any future
      // chat-send from the partner because the pair guard fails. That defeats
      // the whole 24h living-link / async outbox design. Only the explicit End
      // button and Block actions tear the link down.
      for (const dispose of roomDisposers.splice(0)) {
        try {
          dispose()
        } catch (error) {
          console.warn("[teletron] room handler dispose failed:", error)
        }
      }
      for (const dispose of disposers.splice(0)) dispose()
      closeThreadMenu()
      cancelSpeech()
      mediator.dispose()
      conn?.dispose()
      conn = null
      room = null
      conversations.clear()
      openPartnerId = null
      transcripts.close()
      container.replaceChildren()
    },
  }
}

// Exactly one live Teletron instance at a time. Teletron opens a presence
// connection keyed by a persisted per-install playerId. Two live instances —
// a React StrictMode double-invoke, or a dev hot-reload / re-mount that doesn't
// unmount the previous one — would each connect with the SAME playerId, and the
// server replaces the older session ("replaced by newer session", code 4000).
// The replaced instance then reconnects with a now-invalid token ("reconnection
// token invalid or expired"), fresh-joins, and replaces the other; the two
// ping-pong reconnects forever. Tearing down any prior instance before mounting
// the next guarantees a single connection and kills that war at the source.
// Guard state lives on globalThis (not module scope) so a dev hot-reload — which
// re-executes this script in a fresh module scope — still sees, and tears down,
// the connection from the previous load instead of racing a zombie.
type TeletronMountState = { active: { unmount: () => void } | null; generation: number }
const scope = globalThis as typeof globalThis & {
  CorpanGames?: Record<string, ContentPackModule>
  __teletronMount?: TeletronMountState
}
const mountState: TeletronMountState = (scope.__teletronMount ??= { active: null, generation: 0 })

async function mountTeletronOnce(
  container: HTMLElement,
  hostApi: HostApi,
  initial?: InitialState,
): Promise<{ unmount: () => void }> {
  if (mountState.active) {
    try {
      mountState.active.unmount()
    } catch (error) {
      console.warn("[teletron] tearing down previous mount failed:", error)
    }
    mountState.active = null
  }
  const generation = ++mountState.generation
  const instance = await mountTeletron(container, hostApi, initial)
  if (generation !== mountState.generation) {
    // A newer mount superseded us while we were initializing — stand down.
    try {
      instance.unmount()
    } catch {
      /* best effort */
    }
    return { unmount: () => {} }
  }
  const handle = {
    unmount: () => {
      if (mountState.active === handle) mountState.active = null
      try {
        instance.unmount()
      } catch (error) {
        console.warn("[teletron] unmount failed:", error)
      }
    },
  }
  mountState.active = handle
  return handle
}

const module: ContentPackModule = { mount: mountTeletronOnce }
scope.CorpanGames = scope.CorpanGames || {}
scope.CorpanGames[PACK_ID] = module

const devRoot = document.getElementById("corpan-game-root")
if (devRoot) {
  const mockHost = {
    speak: async () => {},
  } as HostApi
  void mountTeletronOnce(devRoot, mockHost, { stackConfig: { languages: ["en", "es"] } })
}
