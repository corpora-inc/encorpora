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
import { continentOf, detectCountry } from "../../corpan-city/src/multiplayer/geo"
import type { HostApi } from "../../corpan-city/src/npc/hostTypes"
import { createChatMediator } from "./mediator"

const PACK_ID = "teletron"
const BASE_MODEL = {
  id: "llm-base-qwen3-4b-v1",
  url: "https://d38iwc9748jekz.cloudfront.net/corpan/llm-packs/llm-base-qwen3-4b-v1-0.1.0-full.zip",
  sizeMb: 2497,
}
const FREE_DAILY_LIMIT = 20

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

type ContentPackModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: InitialState,
  ) => Promise<{ unmount: () => void }>
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

function icon(name: "back" | "send" | "mic" | "shield" | "users"): string {
  const paths = {
    back: '<path d="m15 18-6-6 6-6"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
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

function stackLanguages(initial?: InitialState): { native: LanguageCode; learning: LanguageCode[] } {
  const langs = [...new Set(initial?.stackConfig?.languages?.filter((x) => typeof x === "string") ?? [])]
  const native = (langs[0] || "en") as LanguageCode
  const learning = langs.slice(1).filter((lang) => lang !== native) as LanguageCode[]
  return { native, learning: learning.length > 0 ? learning : [native] }
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
  const mediator = createChatMediator(hostApi)
  const disposers: Array<() => void> = []
  const players = new Map<string, WirePlayer>()
  const profiles = new Map<string, SafeProfile>()
  let room: Room | null = null
  let partner: WirePlayer | null = null
  let modelReady = false
  let revealStack = false
  let revealCountry = false
  let pendingInvite: { inviteId: string; player: WirePlayer } | null = null

  const root = el("div", "tt-root")
  root.innerHTML = `
    <header class="tt-header">
      <button class="tt-icon tt-back" aria-label="Back">${icon("back")}</button>
      <div class="tt-brand"><span class="tt-pulse"></span><strong>Teletron</strong></div>
      <div class="tt-status"><span></span><b>Connecting</b></div>
    </header>
    <main class="tt-main">
      <aside class="tt-lobby">
        <section class="tt-intro">
          <div class="tt-kicker">${icon("shield")} Local AI on both sides</div>
          <h1>Someone new is here.</h1>
          <p>Raw messages stay on each device. Only locally cleaned intent crosses the line.</p>
        </section>
        <section class="tt-privacy">
          <label><span><b>Reveal language stack</b><small>Show what you speak and study</small></span><input data-toggle="stack" type="checkbox"></label>
          <label><span><b>Reveal coarse location</b><small>Only after the privacy threshold is met</small></span><input data-toggle="country" type="checkbox"></label>
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
          <div class="tt-thread-head"><div><span class="tt-avatar"></span><span><b class="tt-partner"></b><small>AI-mediated connection</small></span></div><button class="tt-end">End</button></div>
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
    <div class="tt-model"><div><span class="tt-model-icon">AI</span><span><b>Preparing private moderation</b><small>Checking for Qwen3 4B on this device...</small></span></div><button hidden>Install model</button></div>
    <div class="tt-onboarding"><div>
      <div class="tt-kicker">${icon("shield")} Private by default</div>
      <h2>Enter the waiting room</h2>
      <label><span>Your generated name</span><div><b class="tt-own-name"></b><button type="button" data-reroll>Roll again</button></div></label>
      <label><span>Show chat messages in</span><select class="tt-language"></select></label>
      <p>Choose from the languages in your learning stack. You can change this the next time you enter.</p>
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
  const quota = $(".tt-quota")
  const modelBar = $(".tt-model")
  const modelText = $(".tt-model small")
  const modelButton = $<HTMLButtonElement>(".tt-model button")
  const toast = $(".tt-toast")
  const invitePrompt = $(".tt-invite")
  const onboarding = $(".tt-onboarding")
  const ownName = $(".tt-own-name")
  const languageSelect = $<HTMLSelectElement>(".tt-language")
  let inviteReply: ((accepted: boolean) => void) | null = null

  ownName.textContent = name
  for (const language of languages.learning) {
    const option = document.createElement("option")
    option.value = language
    option.textContent = language
    languageSelect.appendChild(option)
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
    form.querySelector<HTMLButtonElement>(".tt-send")!.disabled = left <= 0 || !modelReady
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
      const learning = [profile.stack.target, ...(profile.stack.alsoLearning ?? [])].join(", ")
      bits.push(`${profile.stack.native} → ${learning}`)
    }
    if (profile.place.granularity === "country") bits.push(profile.place.country)
    else if (profile.place.granularity === "continent") bits.push(profile.place.continent)
    return bits.join(" · ") || "Private profile"
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
      card.innerHTML = `<span class="tt-avatar">${p.name.slice(0, 1)}</span><span><b>${p.name}</b><small>${profileLine(p)}</small></span><em>Invite</em>`
      card.addEventListener("click", () => invite(p))
      people.appendChild(card)
    }
  }

  function addMessage(side: "self" | "peer" | "system", text: string, detail?: string): void {
    const msg = el("div", `tt-message tt-${side}`)
    msg.appendChild(el("div", undefined, text))
    if (detail) msg.appendChild(el("small", undefined, detail))
    messages.appendChild(msg)
    messages.scrollTop = messages.scrollHeight
  }

  function askInvite(name: string): Promise<boolean> {
    invitePrompt.querySelector(".tt-avatar")!.textContent = name.slice(0, 1)
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

  function openThread(p: WirePlayer): void {
    partner = p
    empty.setAttribute("hidden", "")
    thread.removeAttribute("hidden")
    $(".tt-partner").textContent = p.name
    $(".tt-avatar").textContent = p.name.slice(0, 1)
    messages.replaceChildren()
    addMessage("system", `Connected with ${p.name}. Both devices independently moderate each turn.`)
    field.focus()
  }

  function closeThread(): void {
    partner = null
    thread.setAttribute("hidden", "")
    empty.removeAttribute("hidden")
  }

  function invite(p: WirePlayer): void {
    if (!room) return showToast("Still connecting.")
    if (!modelReady) return showToast("Finish preparing the local AI first.")
    const inviteId = `tele-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    pendingInvite = { inviteId, player: p }
    room.send(MP_MSG.invite, { inviteId, to: p.playerId, offer: { kind: "chat" } })
    showToast(`Invitation sent to ${p.name}.`)
  }

  async function send(text: string): Promise<void> {
    if (!room || !partner || !modelReady || quotaRemaining(plus) <= 0) return
    addMessage("self", text)
    field.value = ""
    const placeholder = el("div", "tt-message tt-system", "Cleaning locally...")
    messages.appendChild(placeholder)
    const input = await mediator.prepareOutbound({
      from: me as PlayerId,
      to: partner.playerId as PlayerId,
      interactionId: `chat-${Date.now().toString(36)}`,
      text,
      sourceLanguage: selectedLanguage,
      targetLanguage: selectedLanguage,
      mode: "beginner",
    })
    placeholder.remove()
    room.send(MP_MSG.chatSend, input)
    consumeQuota(plus)
    updateQuota()
  }

  async function receive(input: MediatedChatInput): Promise<void> {
    const p = players.get(input.from)
    if (p && (!partner || partner.playerId !== p.playerId)) openThread(p)
    const placeholder = el("div", "tt-message tt-system", "Interpreting locally...")
    messages.appendChild(placeholder)
    const artifact = await mediator.lessonify(
      input,
      { native: languages.native, target: selectedLanguage },
    )
    placeholder.remove()
    addMessage("peer", artifact.visibleText, artifact.naturalTranslation)
  }

  async function probeModel(): Promise<void> {
    if (!hostApi.llm) {
      modelText.textContent = "This version of Corpán does not expose on-device AI."
      return
    }
    const installed = await hostApi.llm.isInstalled(BASE_MODEL.id).catch(() => false)
    if (!installed) {
      modelText.textContent = `Qwen3 4B is required once and shared with Tutomaton (${BASE_MODEL.sizeMb} MB).`
      modelButton.hidden = false
      return
    }
    try {
      const status = await hostApi.llm.status()
      if (!status.loaded || status.modelId !== BASE_MODEL.id) {
        await hostApi.llm.load({ modelPackId: BASE_MODEL.id })
      }
      modelReady = true
      modelText.textContent = "Private moderation is ready."
    } catch (error) {
      console.error("[teletron] model load failed:", error)
      modelReady = false
      modelText.textContent = "The installed model could not be loaded."
    }
    modelBar.classList.toggle("is-ready", modelReady)
    updateQuota()
  }

  modelButton.addEventListener("click", async () => {
    if (!hostApi.llm?.install) return
    modelButton.disabled = true
    await hostApi.llm.install({ packId: BASE_MODEL.id, url: BASE_MODEL.url }, (p) => {
      modelText.textContent =
        p.stage === "downloading" && p.total
          ? `Downloading shared model · ${Math.round((p.progress / p.total) * 100)}%`
          : p.message || p.stage
    })
    modelButton.hidden = true
    await probeModel()
  })

  form.addEventListener("submit", (event) => {
    event.preventDefault()
    const text = field.value.trim()
    if (text) void send(text)
  })
  $(".tt-end").addEventListener("click", closeThread)
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
  })
  $(".tt-enter").addEventListener("click", () => {
    selectedLanguage = languageSelect.value as LanguageCode
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
    onLiveChange: (live: boolean) => form.classList.toggle("is-listening", live),
  })
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
          players.delete(p.playerId || key)
          profiles.delete(p.playerId || key)
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
          if (parsed.data.outcome === "accepted") openThread(pendingInvite.player)
          else showToast(`Invitation ${parsed.data.outcome}.`)
          pendingInvite = null
        }),
        joined.onMessage(MP_MSG.chatDeliver, (raw) => {
          const parsed = MediatedChatInput.safeParse(raw)
          if (parsed.success) void receive(parsed.data)
        }),
      )
      joined.onLeave(() => setStatus("offline", "Offline"))
      joined.onError(() => setStatus("offline", "Offline"))
    } catch (error) {
      console.error("[teletron] connection failed:", error)
      setStatus("offline", "Offline")
      showToast("Teletron could not reach the presence server.")
    }
  }

  updateQuota()
  renderPeople()
  void probeModel()

  return {
    unmount: () => {
      for (const dispose of disposers.splice(0)) dispose()
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
