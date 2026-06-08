import "./styles.css"
import { Client, getStateCallbacks, type Room } from "colyseus.js"
import {
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
import { scrubForSpeech } from "../../tutomaton/src/textScrub"

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
  stackConfig?: { languages?: string[] }
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

type ChatState = "idle" | "active" | "ended"

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

function icon(name: "back" | "send" | "mic" | "shield" | "users" | "chevron" | "speaker" | "speakerMuted"): string {
  const paths = {
    back: '<path d="m15 18-6-6 6-6"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    speaker: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    speakerMuted: '<path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m17 9 4 4"/><path d="m21 9-4 4"/>',
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
  let selectedLanguage = languages.learning[0]
  let plus = isPlus(initial)
  const disposers: Array<() => void> = []
  let ttsEnabled = localStorage.getItem("teletron.tts") !== "off"
  const speechQueue = new OrderedSpeechQueue(
    (locale, text) => hostApi.speak(locale, text),
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
  let partner: WirePlayer | null = null
  let chatState: ChatState = "idle"
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
  root.innerHTML = `
    <header class="tt-header">
      <button class="tt-icon tt-back" aria-label="Back">${icon("back")}</button>
      <div class="tt-brand"><span class="tt-brand-mark" aria-hidden="true"><img src="${teletronLogoUrl}" alt="" draggable="false"></span><span><strong>Teletron</strong><small>local AI relay</small></span></div>
      <div class="tt-status"><span></span><b>Connecting</b></div>
    </header>
    <main class="tt-main">
      <aside class="tt-lobby">
        <section class="tt-intro">
          <div class="tt-hero-mark" aria-hidden="true"><img src="${teletronLogoUrl}" alt="" draggable="false"></div>
          <div class="tt-kicker">${icon("shield")} Local AI on both sides</div>
          <h1>Choose what you want to share.</h1>
          <p>Your generated name is visible. Language stack and country are optional.</p>
        </section>
        <section class="tt-privacy">
          <label><span><b>Reveal language stack</b><small>Show what you speak and study</small></span><input data-toggle="stack" type="checkbox"></label>
          <label><span><b>Reveal country</b><small>Show your country flag in the waiting room</small></span><input data-toggle="country" type="checkbox"></label>
        </section>
        <div class="tt-list-head"><span>${icon("users")} Waiting room</span><b class="tt-count">0</b></div>
        <div class="tt-people"></div>
      </aside>
      <section class="tt-conversation">
        <div class="tt-empty">
          <div class="tt-mark">T</div>
          <h2>Choose someone to talk with</h2>
          <p>They will see an invitation first. No message is delivered until they accept.</p>
        </div>
        <div class="tt-thread" hidden>
          <div class="tt-thread-head"><div><span class="tt-avatar"></span><span><b class="tt-partner"></b><small class="tt-thread-status">AI-mediated connection</small></span></div><div class="tt-thread-actions"><button class="tt-voice" type="button" aria-pressed="true" aria-label="Mute voice">${icon("speaker")}</button><button class="tt-end" type="button">End</button></div></div>
          <div class="tt-messages"></div>
          <form class="tt-composer">
            <textarea rows="1" maxlength="600" placeholder="Write a message"></textarea>
            <button class="tt-mic" type="button" aria-label="Speak" disabled>${icon("mic")}</button>
            <button class="tt-send" type="submit" aria-label="Send">${icon("send")}</button>
          </form>
          <div class="tt-quota"></div>
        </div>
      </section>
    </main>
    <div class="tt-model"><div><span class="tt-model-icon">AI</span><span><b>Preparing private relay</b><small>Checking for Qwen3 4B on this device...</small></span></div><button hidden>Install model</button></div>
    <div class="tt-onboarding"><div>
      <div class="tt-onboarding-mark" aria-hidden="true"><img src="${teletronLogoUrl}" alt="" draggable="false"></div>
      <div class="tt-kicker">${icon("shield")} Private by default</div>
      <h2>Enter the waiting room</h2>
      <label><span>Your generated name</span><div class="tt-name-row"><b class="tt-own-name"></b><button type="button" data-reroll>Roll again</button></div></label>
      <label><span>Show chat messages in</span><div class="tt-select-wrap"><select class="tt-language"></select><span class="tt-select-chev">${icon("chevron")}</span></div></label>
      <p class="tt-language-note">Choose from the Teletron-ready languages in your learning stack. You can change this the next time you enter.</p>
      <button class="tt-enter" type="button">Enter waiting room</button>
    </div></div>
    <div class="tt-invite" hidden><div><span class="tt-avatar"></span><h3></h3><p>They want to start a locally moderated conversation.</p><footer><button data-decline>Not now</button><button data-accept>Accept chat</button></footer></div></div>
    <div class="tt-toast" hidden></div>
  `
  container.appendChild(root)

  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector)!
  const status = $(".tt-status")
  const people = $(".tt-people")
  const count = $(".tt-count")
  const empty = $(".tt-empty")
  const thread = $(".tt-thread")
  const messages = $(".tt-messages")
  const form = $<HTMLFormElement>(".tt-composer")
  const field = $<HTMLTextAreaElement>(".tt-composer textarea")
  const mic = $<HTMLButtonElement>(".tt-mic")
  const sendButton = $<HTMLButtonElement>(".tt-send")
  const voiceButton = $<HTMLButtonElement>(".tt-voice")
  const endButton = $<HTMLButtonElement>(".tt-end")
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
    languageNote.textContent =
      "Some stack languages are hidden in this first Teletron release while we test Qwen3 4B quality: " +
      `${languages.hidden.map((language) => languageDisplayName(language, languages.native)).join(", ")}.`
  }

  function showToast(text: string): void {
    toast.textContent = text
    toast.removeAttribute("hidden")
    setTimeout(() => toast.setAttribute("hidden", ""), 2600)
  }

  function setStatus(kind: "connecting" | "online" | "offline", text: string): void {
    status.className = `tt-status is-${kind}`
    status.querySelector("b")!.textContent = text
  }

  function updateQuota(): void {
    const left = quotaRemaining(plus)
    quota.textContent = plus ? "Corpan Plus · unlimited messages" : `${left} free messages left today`
    const active = Boolean(room && partner && chatState === "active")
    const enabled = active && modelReady && left > 0
    field.disabled = !enabled
    sendButton.disabled = !enabled
    mic.disabled = !enabled || !dictationAvailable
    form.classList.toggle("is-disabled", !enabled)
    form.classList.toggle("is-asr-unavailable", !dictationAvailable)
    if (!active) field.placeholder = chatState === "ended" ? "Chat ended" : "Choose someone to talk with"
    else if (!modelReady) field.placeholder = "Private relay is loading"
    else if (left <= 0) field.placeholder = "Daily messages used"
    else field.placeholder = "Write a message"
  }

  function updateVoiceButton(): void {
    voiceButton.classList.toggle("active", ttsEnabled)
    voiceButton.innerHTML = ttsEnabled ? icon("speaker") : icon("speakerMuted")
    voiceButton.setAttribute("aria-pressed", ttsEnabled ? "true" : "false")
    voiceButton.setAttribute("aria-label", ttsEnabled ? "Mute voice" : "Unmute voice")
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
    if (plus) showToast("Corpan Plus active. Messages are unlimited.")
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
    if (!profile) return "Private profile"
    const bits: string[] = []
    if (profile.stack.target !== "und") {
      const learning = [profile.stack.target, ...(profile.stack.alsoLearning ?? [])]
        .map((language) => languageDisplayName(language, languages.native))
        .join(", ")
      bits.push(`${languageDisplayName(profile.stack.native, languages.native)} → ${learning}`)
    }
    const place = placeLabel(profile.place)
    if (place) bits.push(place)
    return bits.join(" · ") || "Private profile"
  }

  function profileBadge(player: WirePlayer): { text: string; isFlag: boolean } {
    const profile = profiles.get(player.playerId)
    const flag = profile?.place.granularity === "country" ? countryFlag(profile.place.country) : ""
    return flag ? { text: flag, isFlag: true } : { text: avatarInitial(player.name), isFlag: false }
  }

  function renderPeople(): void {
    count.textContent = String(players.size)
    people.replaceChildren()
    if (!players.size) {
      const waiting = el("div", "tt-waiting", "Waiting for another signal...")
      people.appendChild(waiting)
      return
    }
    for (const p of players.values()) {
      const card = el("button", "tt-person")
      card.type = "button"
      const isPendingTarget = pendingInvite?.player.playerId === p.playerId
      const hasPendingInvite = pendingInvite !== null
      const isCurrentPartner = partner?.playerId === p.playerId
      const isActiveChat = chatState === "active" && partner !== null
      const isEndedPartner = chatState === "ended" && isCurrentPartner
      let actionLabel = "Invite"
      if (isActiveChat && isCurrentPartner) {
        card.disabled = true
        card.classList.add("is-chatting")
        actionLabel = "Chatting"
      } else if (isActiveChat) {
        card.disabled = true
        card.classList.add("is-paused")
        actionLabel = "Busy"
      } else if (isEndedPartner) {
        card.disabled = true
        card.classList.add("is-ended")
        actionLabel = "Ended"
      } else if (hasPendingInvite) {
        card.disabled = true
        card.classList.add(isPendingTarget ? "is-invited" : "is-paused")
        actionLabel = isPendingTarget ? "Invited" : "Wait"
      }
      const badge = profileBadge(p)
      const avatar = el("span", badge.isFlag ? "tt-avatar is-flag" : "tt-avatar", badge.text)
      const body = el("span")
      body.append(el("b", undefined, p.name), el("small", undefined, profileLine(p)))
      card.append(avatar, body, el("em", undefined, actionLabel))
      card.addEventListener("click", () => invite(p))
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

  function askInvite(name: string): Promise<boolean> {
    invitePrompt.querySelector(".tt-avatar")!.textContent = avatarInitial(name)
    invitePrompt.querySelector("h3")!.textContent = `${name} sent an invitation`
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

  function sendControl(kind: "ended", p = partner): void {
    if (!room || !p) return
    room.send(
      MP_MSG.chatSend,
      composeControlInput(me as PlayerId, p.playerId as PlayerId, kind, selectedLanguage),
    )
  }

  function openThread(p: WirePlayer): void {
    cancelSpeech()
    partner = p
    chatState = "active"
    root.classList.add("is-thread-open")
    empty.setAttribute("hidden", "")
    thread.removeAttribute("hidden")
    $(".tt-partner").textContent = p.name
    $(".tt-avatar").textContent = avatarInitial(p.name)
    threadStatus.textContent = "AI-mediated connection"
    endButton.textContent = "End"
    messages.replaceChildren()
    addMessage("system", `Connected with ${p.name}. Both devices independently moderate each turn.`)
    updateQuota()
    renderPeople()
    void refreshDictation()
    field.focus()
  }

  function markThreadEnded(text: string): void {
    const alreadyEnded = chatState === "ended"
    cancelSpeech()
    chatState = "ended"
    root.classList.add("is-thread-open")
    empty.setAttribute("hidden", "")
    thread.removeAttribute("hidden")
    if (partner) {
      $(".tt-partner").textContent = partner.name
      $(".tt-avatar").textContent = avatarInitial(partner.name)
    }
    threadStatus.textContent = "Chat ended"
    endButton.textContent = "Done"
    field.value = ""
    autosizeComposer()
    if (!alreadyEnded) addMessage("system", text)
    updateQuota()
    renderPeople()
  }

  function dismissThread(): void {
    cancelSpeech()
    chatState = "idle"
    partner = null
    root.classList.remove("is-thread-open")
    thread.setAttribute("hidden", "")
    empty.removeAttribute("hidden")
    messages.replaceChildren()
    updateQuota()
    renderPeople()
  }

  function endOrDismissThread(): void {
    if (chatState === "active" && partner) {
      sendControl("ended")
      markThreadEnded("You ended the chat.")
      return
    }
    dismissThread()
  }

  function invite(p: WirePlayer): void {
    if (!room) return showToast("Still connecting.")
    if (!modelReady) return showToast("Finish preparing the local AI first.")
    if (chatState === "active" && partner?.playerId === p.playerId) {
      return showToast(`You are already chatting with ${p.name}.`)
    }
    if (chatState === "active" && partner) {
      return showToast(`End your chat with ${partner.name} first.`)
    }
    if (pendingInvite) {
      const target = pendingInvite.player.playerId === p.playerId ? p.name : pendingInvite.player.name
      return showToast(`Waiting for ${target} to respond.`)
    }
    const inviteId = `tele-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    pendingInvite = { inviteId, player: p }
    room.send(MP_MSG.invite, { inviteId, to: p.playerId, offer: { kind: "chat" } })
    renderPeople()
    showToast(`Invitation sent to ${p.name}.`)
  }

  async function send(text: string): Promise<void> {
    const currentPartner = partner
    if (!room) return showToast("Still connecting.")
    if (!currentPartner || chatState !== "active") return showToast("Choose someone to talk with first.")
    if (!modelReady || quotaRemaining(plus) <= 0) return
    addMessage("self", text)
    field.value = ""
    autosizeComposer()
    const placeholder = el("div", "tt-message tt-system", "Cleaning locally...")
    messages.appendChild(placeholder)
    let input: MediatedChatInput
    try {
      input = await mediator.prepareOutbound({
        from: me as PlayerId,
        to: currentPartner.playerId as PlayerId,
        interactionId: `chat-${Date.now().toString(36)}`,
        text,
        sourceLanguage: selectedLanguage,
        targetLanguage: selectedLanguage,
        mode: "beginner",
      })
    } catch (error) {
      console.error("[teletron] prepareOutbound failed:", error)
      placeholder.remove()
      addMessage("system", "That message could not be prepared safely. Try again.")
      return
    }
    if (!room || chatState !== "active" || partner?.playerId !== currentPartner.playerId) {
      placeholder.remove()
      addMessage("system", "That message was not sent because the chat ended.")
      return
    }
    placeholder.remove()
    room.send(MP_MSG.chatSend, input)
    consumeQuota(plus)
    updateQuota()
  }

  async function receive(input: MediatedChatInput): Promise<void> {
    const control = controlKind(input)
    const p = players.get(input.from)
    const sender = p ?? {
      playerId: input.from,
      name: "Your chat partner",
      target: "",
      native: "",
    }
    if (control === "ended") {
      if (!partner || partner.playerId === sender.playerId) {
        if (!partner) partner = sender
        markThreadEnded(`${sender.name} ended the chat.`)
      }
      return
    }
    if (partner && chatState === "active" && partner.playerId !== sender.playerId) {
      showToast(`${sender.name} sent a message, but you are already chatting.`)
      return
    }
    if (!partner || partner.playerId !== sender.playerId) openThread(sender)
    const placeholder = el("div", "tt-message tt-system", "Interpreting locally...")
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
      )
    } catch (error) {
      console.error("[teletron] lessonify failed:", error)
      if (activeStream?.epoch === epoch) activeStream = null
      placeholder.remove()
      streamingMessage.remove()
      addMessage("system", "That message could not be opened safely.")
      return
    }
    if (chatState !== "active" || partner?.playerId !== sender.playerId) {
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
    modelButton.textContent = "Retry"
    if (!hostApi.llm) {
      modelText.textContent = "This version of Corpán does not expose on-device AI."
      modelBusy = false
      return
    }
    try {
      const installed = await hostApi.llm.isInstalled(BASE_MODEL.id).catch(() => false)
      if (!installed) {
        modelReady = false
        modelText.textContent = `Qwen3 4B is required once and shared with Tutomaton (${BASE_MODEL.sizeMb} MB).`
        modelButton.textContent = "Install model"
        modelButton.hidden = false
        return
      }

      modelText.textContent = "Loading Qwen3 4B on this device..."
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
        modelText.textContent = "The installed model could not be loaded. Close other packs or retry."
        modelButton.textContent = "Retry"
        modelButton.hidden = false
      }
    } catch (error) {
      console.error("[teletron] model load failed:", error)
      modelReady = false
      modelText.textContent = "The installed model could not be loaded. Close other packs or retry."
      modelButton.textContent = "Retry"
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
              ? `Downloading shared model · ${Math.round((p.progress / p.total) * 100)}%`
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
  endButton.addEventListener("click", endOrDismissThread)
  voiceButton.addEventListener("click", () => {
    ttsEnabled = !ttsEnabled
    localStorage.setItem("teletron.tts", ttsEnabled ? "on" : "off")
    updateVoiceButton()
    if (!ttsEnabled) cancelSpeech()
  })
  invitePrompt.querySelector("[data-accept]")!.addEventListener("click", () => settleInvite(true))
  invitePrompt.querySelector("[data-decline]")!.addEventListener("click", () => settleInvite(false))
  $(".tt-back").addEventListener("click", () =>
    window.dispatchEvent(new CustomEvent("corpan:exit", { detail: { packId: PACK_ID } })),
  )
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

  async function connect(): Promise<void> {
    setStatus("connecting", "Connecting")
    try {
      const client = new Client(serverUrl())
      room = await client.joinOrCreate("teletron", {
        playerId: me,
        name,
        avatar: { base: "teletron", layers: [] },
        sceneId: "teletron",
      })
      setStatus("online", "Online")
      publishProfile()
      const joined = room
      const callbacks = getStateCallbacks(joined) as unknown as (
        target: unknown,
      ) => { players: { onAdd: (cb: (p: WirePlayer, key: string) => void) => () => void; onRemove: (cb: (p: WirePlayer, key: string) => void) => () => void } }
      const pc = callbacks(joined.state).players
      disposers.push(
        pc.onAdd((p, key) => {
          if (key === joined.sessionId) return
          players.set(p.playerId || key, p)
          joined.send(MP_MSG.profileRequest, { target: p.playerId || key })
          renderPeople()
        }),
        pc.onRemove((p, key) => {
          const id = p.playerId || key
          players.delete(id)
          profiles.delete(id)
          if (pendingInvite?.player.playerId === id) {
            pendingInvite = null
            showToast(`${p.name || "That person"} left before responding.`)
          }
          if (partner?.playerId === id && chatState === "active") {
            markThreadEnded(`${partner.name} left Teletron.`)
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
          const p = players.get(parsed.data.from) ?? {
            playerId: parsed.data.from,
            name: parsed.data.fromName,
            target: "",
            native: "",
          }
          if (chatState === "active" || pendingInvite || inviteReply) {
            joined.send(MP_MSG.inviteRespond, {
              inviteId: parsed.data.inviteId,
              action: "decline",
            })
            showToast(`${p.name} invited you, but you are already busy.`)
            return
          }
          const accepted = await askInvite(p.name)
          joined.send(MP_MSG.inviteRespond, {
            inviteId: parsed.data.inviteId,
            action: accepted ? "accept" : "decline",
          })
          if (accepted) openThread(p)
        }),
        joined.onMessage(MP_MSG.inviteResult, (raw) => {
          const parsed = InviteResult.safeParse(raw)
          if (!parsed.success || !pendingInvite || parsed.data.inviteId !== pendingInvite.inviteId) return
          const invitedPlayer = pendingInvite.player
          pendingInvite = null
          renderPeople()
          if (parsed.data.outcome === "accepted") openThread(invitedPlayer)
          else showToast(`Invitation ${parsed.data.outcome}.`)
        }),
        joined.onMessage(MP_MSG.chatDeliver, (raw) => {
          const parsed = MediatedChatInput.safeParse(raw)
          if (parsed.success) enqueueReceive(parsed.data)
        }),
      )
      joined.onLeave(() => {
        setStatus("offline", "Offline")
        if (!mounted) return
        if (chatState === "active") markThreadEnded("Connection lost. Return to the waiting room to reconnect.")
      })
      joined.onError(() => {
        setStatus("offline", "Offline")
        if (chatState === "active") markThreadEnded("Connection lost. Return to the waiting room to reconnect.")
      })
    } catch (error) {
      console.error("[teletron] connection failed:", error)
      setStatus("offline", "Offline")
      showToast("Teletron could not reach the presence server.")
    }
  }

  updateQuota()
  updateVoiceButton()
  renderPeople()
  void probeModel()

  return {
    unmount: () => {
      mounted = false
      if (chatState === "active") sendControl("ended")
      for (const dispose of disposers.splice(0)) dispose()
      cancelSpeech()
      mediator.dispose()
      void room?.leave(true)
      room = null
      container.replaceChildren()
    },
  }
}

const module: ContentPackModule = { mount: mountTeletron }
const scope = globalThis as typeof globalThis & { CorpanGames?: Record<string, ContentPackModule> }
scope.CorpanGames = scope.CorpanGames || {}
scope.CorpanGames[PACK_ID] = module

const devRoot = document.getElementById("corpan-game-root")
if (devRoot) {
  const mockHost = {
    speak: async () => {},
  } as HostApi
  void mountTeletron(devRoot, mockHost, { stackConfig: { languages: ["en", "es"] } })
}
