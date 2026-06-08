import "./multiplayer.css"
import type {
  SafeProfile,
  InvitedMessage,
  MediatedChatArtifact,
  Continent,
} from "@corpan-city/contracts"
import { type BoundT, type I18nKey, applyDir } from "../i18n/strings"

/**
 * interactionUI.ts — the in-pack, localized, RTL-aware surfaces for player-to-
 * player interaction. NO `window.confirm/alert/prompt` (they no-op in the
 * WKWebView and look terrible) — every prompt is a real in-overlay modal. All
 * copy flows through the bound `t` so it renders in the learner's native
 * language; the panel root gets `applyDir` so RTL natives mirror cleanly.
 *
 * Everything mounts into the host-painted `.wp-overlay` (passed as `overlay`)
 * and competes only with its siblings on the shared z-band (see styles.css) —
 * never `document.body`, never a fixed-to-viewport modal.
 */

/** A friendly display name for a language code, falling back to the code. */
function langLabel(code: string): string {
  try {
    const dn = new Intl.DisplayNames([code, "en"], { type: "language" })
    return dn.of(code.split("-")[0]) ?? code
  } catch {
    return code
  }
}

const CONTINENT_KEY: Record<Continent, I18nKey> = {
  africa: "mp.continent.africa",
  antarctica: "mp.continent.antarctica",
  asia: "mp.continent.asia",
  europe: "mp.continent.europe",
  "north-america": "mp.continent.namerica",
  oceania: "mp.continent.oceania",
  "south-america": "mp.continent.samerica",
}

/** Country-code → flag emoji (two regional-indicator letters). Decorative. */
function flagOf(country: string): string {
  if (!/^[A-Z]{2}$/.test(country)) return ""
  const A = 0x1f1e6
  return String.fromCodePoint(A + country.charCodeAt(0) - 65, A + country.charCodeAt(1) - 65)
}

const INVITE_PROMPT_TIMEOUT_MS = 30_000

function placeLine(t: BoundT, place: SafeProfile["place"]): string {
  if (place.granularity === "country") {
    const name = (() => {
      try {
        return new Intl.DisplayNames(["en"], { type: "region" }).of(place.country) ?? place.country
      } catch {
        return place.country
      }
    })()
    return `${flagOf(place.country)} ${t("mp.profile.place.country", { country: name })}`.trim()
  }
  if (place.granularity === "continent") {
    return t("mp.profile.place.continent", { continent: t(CONTINENT_KEY[place.continent]) })
  }
  return t("mp.profile.place.hidden")
}

/* A modal scrim helper: returns { root, close }. Tapping the backdrop closes. */
function makeScrim(overlay: HTMLElement, cardLayer: boolean, native: string): {
  scrim: HTMLElement
  panel: HTMLElement
  close: () => void
} {
  const scrim = document.createElement("div")
  scrim.className = "wp-mp-scrim" + (cardLayer ? " wp-mp-card-layer" : "")
  applyDir(scrim, native)
  const panel = document.createElement("div")
  panel.className = "wp-mp-panel"
  scrim.appendChild(panel)
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    scrim.remove()
  }
  scrim.addEventListener("pointerdown", (e) => {
    if (e.target === scrim) close()
  })
  overlay.appendChild(scrim)
  return { scrim, panel, close }
}

export interface ProfileCardActions {
  onSayHi?: () => void
  onChallenge?: () => void
  onTrade?: () => void
}

/** Show the safe profile card for a nearby real player. */
export function showProfileCard(
  overlay: HTMLElement,
  t: BoundT,
  native: string,
  card: SafeProfile,
  actions: ProfileCardActions,
): { close: () => void } {
  const { panel, close } = makeScrim(overlay, true, native)

  const head = document.createElement("div")
  head.className = "wp-mp-head"
  const ava = document.createElement("div")
  ava.className = "wp-mp-ava"
  ava.textContent = "🧑"
  const nameWrap = document.createElement("div")
  nameWrap.className = "wp-mp-name-wrap"
  const name = document.createElement("div")
  name.className = "wp-mp-name"
  name.textContent = card.name
  const sub = document.createElement("div")
  sub.className = "wp-mp-sub"
  sub.textContent = placeLine(t, card.place)
  nameWrap.append(name, sub)
  head.append(ava, nameWrap)

  const body = document.createElement("div")
  body.className = "wp-mp-body"
  const stack = document.createElement("div")
  stack.className = "wp-mp-stack"
  const isImmersion = card.stack.target === card.stack.native
  if (isImmersion) {
    const chip = document.createElement("span")
    chip.className = "wp-mp-chip"
    chip.textContent = t("mp.profile.immersion", { lang: langLabel(card.stack.target) })
    stack.appendChild(chip)
  } else {
    const learn = document.createElement("span")
    learn.className = "wp-mp-chip"
    learn.textContent = t("mp.profile.learning", { lang: langLabel(card.stack.target) })
    const speaks = document.createElement("span")
    speaks.className = "wp-mp-chip"
    speaks.textContent = t("mp.profile.speaks", { lang: langLabel(card.stack.native) })
    stack.append(learn, speaks)
  }
  body.appendChild(stack)

  const acts = document.createElement("div")
  acts.className = "wp-mp-actions"
  const addBtn = (label: string, primary: boolean, fn?: () => void) => {
    if (!fn) return
    const b = document.createElement("button")
    b.className = "wp-mp-btn" + (primary ? " wp-mp-btn-primary" : "")
    b.textContent = label
    b.addEventListener("click", () => {
      close()
      fn()
    })
    acts.appendChild(b)
  }
  addBtn(t("mp.profile.sayHi"), true, actions.onSayHi)
  addBtn(t("mp.profile.challenge"), false, actions.onChallenge)
  addBtn(t("mp.profile.trade"), false, actions.onTrade)
  const closeBtn = document.createElement("button")
  closeBtn.className = "wp-mp-btn wp-mp-btn-ghost"
  closeBtn.textContent = t("mp.profile.close")
  closeBtn.addEventListener("click", close)
  acts.appendChild(closeBtn)

  panel.append(head, body, acts)
  return { close }
}

/** Prompt the local player to accept/decline an inbound invite. */
export function showInvitePrompt(
  overlay: HTMLElement,
  t: BoundT,
  native: string,
  invite: InvitedMessage,
  onResult: (accepted: boolean) => void,
): { close: () => void } {
  const { scrim, panel, close: closePrompt } = makeScrim(overlay, true, native)
  let answered = false
  const timer = setTimeout(() => answer(false), INVITE_PROMPT_TIMEOUT_MS)
  const close = () => {
    clearTimeout(timer)
    closePrompt()
  }
  const answer = (accepted: boolean) => {
    if (answered) return
    answered = true
    close()
    onResult(accepted)
  }
  scrim.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target === scrim) answer(false)
    },
    { capture: true },
  )

  const titleKey: I18nKey =
    invite.offer.kind === "challenge"
      ? "mp.invite.challengeTitle"
      : invite.offer.kind === "trade"
        ? "mp.invite.tradeTitle"
        : "mp.invite.chatTitle"

  const head = document.createElement("div")
  head.className = "wp-mp-head"
  const ava = document.createElement("div")
  ava.className = "wp-mp-ava"
  ava.textContent = invite.offer.kind === "challenge" ? "⚔️" : invite.offer.kind === "trade" ? "🤝" : "💬"
  const name = document.createElement("div")
  name.className = "wp-mp-name"
  name.textContent = t(titleKey, { name: invite.fromName })
  head.append(ava, name)

  const acts = document.createElement("div")
  acts.className = "wp-mp-actions"
  const accept = document.createElement("button")
  accept.className = "wp-mp-btn wp-mp-btn-primary"
  accept.textContent = t("mp.invite.accept")
  accept.addEventListener("click", () => answer(true))
  const decline = document.createElement("button")
  decline.className = "wp-mp-btn wp-mp-btn-ghost"
  decline.textContent = t("mp.invite.decline")
  decline.addEventListener("click", () => answer(false))
  acts.append(accept, decline)

  panel.append(head, acts)
  return { close }
}

/* ----------------------------------------------------------------- chat panel */

export interface ChatPanelHandle {
  /** Append a message we sent (already shown optimistically). */
  appendSelf: (text: string) => void
  /** Show the partner's lessonified artifact, with tappable replies. */
  appendPeer: (artifact: MediatedChatArtifact, onReply: (label: string) => void) => void
  /** Append a local lifecycle note, never user-authored text. */
  appendSystem: (text: string) => void
  /** Show or clear the chat status strip. */
  setStatus: (text: string | null) => void
  /** Enable/disable the composer without closing the panel. */
  setCanSend: (canSend: boolean) => void
  /** Mark one outbound message as being cleaned/sent; drafting can continue. */
  setBusy: (busy: boolean) => void
  /** A transient "bridging languages…" placeholder while the LLM works. */
  showBridging: () => () => void
  close: () => void
}

/** Open the cross-language chat panel with a partner. */
export function openChatPanel(
  overlay: HTMLElement,
  t: BoundT,
  native: string,
  partnerName: string,
  onSend: (text: string) => void,
  onClose: () => void,
): ChatPanelHandle {
  const { panel, close: closeScrim } = makeScrim(overlay, false, native)
  panel.classList.add("wp-mp-chat-panel")

  const head = document.createElement("div")
  head.className = "wp-mp-head"
  const name = document.createElement("div")
  name.className = "wp-mp-name"
  name.textContent = t("mp.chat.title", { name: partnerName })
  const x = document.createElement("button")
  x.className = "wp-mp-x"
  x.setAttribute("aria-label", t("mp.chat.close"))
  x.textContent = "×"
  head.append(name, x)

  const status = document.createElement("div")
  status.className = "wp-mp-chat-status"
  status.hidden = true

  const log = document.createElement("div")
  log.className = "wp-mp-log"

  const replies = document.createElement("div")
  replies.className = "wp-mp-replies"

  const compose = document.createElement("div")
  compose.className = "wp-mp-compose"
  const input = document.createElement("textarea")
  input.className = "wp-mp-input"
  input.placeholder = t("mp.chat.placeholder")
  input.maxLength = 240
  input.rows = 1
  input.setAttribute("enterkeyhint", "send")
  input.setAttribute("autocomplete", "off")
  input.setAttribute("autocapitalize", "sentences")
  input.setAttribute("spellcheck", "true")
  const send = document.createElement("button")
  send.className = "wp-mp-send"
  send.type = "button"
  send.setAttribute("aria-label", t("mp.chat.send"))
  send.textContent = "↑"
  compose.append(input, send)

  panel.append(head, status, log, replies, compose)

  const scrollDown = () => {
    log.scrollTop = log.scrollHeight
  }
  let canSend = true
  let busy = false
  const resizeInput = () => {
    input.style.blockSize = "auto"
    input.style.blockSize = `${Math.min(input.scrollHeight, 116)}px`
  }
  const updateSendState = () => {
    send.disabled = !canSend || busy || !input.value.trim()
    compose.classList.toggle("wp-mp-compose-disabled", !canSend)
    compose.classList.toggle("wp-mp-compose-busy", busy)
  }
  const doSend = () => {
    if (!canSend || busy) return
    const text = input.value.trim()
    if (!text) return
    input.value = ""
    resizeInput()
    updateSendState()
    onSend(text)
  }
  send.addEventListener("click", doSend)
  input.addEventListener("input", () => {
    resizeInput()
    updateSendState()
  })
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      doSend()
    }
  })
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    closeScrim()
    onClose()
  }
  x.addEventListener("click", close)

  // Best-effort focus (mobile keyboards may ignore until a tap).
  setTimeout(() => input.focus(), 60)
  resizeInput()
  updateSendState()

  return {
    appendSelf(text) {
      const m = document.createElement("div")
      m.className = "wp-mp-msg wp-mp-msg-self"
      m.textContent = text
      log.appendChild(m)
      scrollDown()
    },
    appendPeer(artifact, onReply) {
      replies.replaceChildren()
      const m = document.createElement("div")
      m.className = "wp-mp-msg wp-mp-msg-peer"
      const main = document.createElement("div")
      main.textContent = artifact.visibleText
      m.appendChild(main)
      if (artifact.transliteration) {
        const translit = document.createElement("div")
        translit.className = "wp-mp-msg-orig"
        translit.textContent = artifact.transliteration
        m.appendChild(translit)
      }
      if (
        artifact.naturalTranslation &&
        artifact.naturalTranslation !== artifact.visibleText
      ) {
        const meaning = document.createElement("div")
        meaning.className = "wp-mp-msg-orig"
        meaning.textContent = artifact.naturalTranslation
        m.appendChild(meaning)
      }
      const note = artifact.lessonNotes[0]
      if (note) {
        const tip = document.createElement("div")
        tip.className = "wp-mp-msg-tip"
        tip.textContent = `${t("mp.chat.tip")}: ${note.text}`
        m.appendChild(tip)
      }
      log.appendChild(m)
      scrollDown()
      // Tappable suggested replies (in the partner's language → replying = practice).
      for (const r of artifact.suggestedReplies) {
        const b = document.createElement("button")
        b.className = "wp-mp-reply"
        b.textContent = r.label
        b.addEventListener("click", () => {
          replies.replaceChildren()
          onReply(r.label)
        })
        replies.appendChild(b)
      }
    },
    appendSystem(text) {
      const m = document.createElement("div")
      m.className = "wp-mp-msg wp-mp-msg-system"
      m.textContent = text
      log.appendChild(m)
      scrollDown()
    },
    setStatus(text) {
      status.textContent = text ?? ""
      status.hidden = !text
    },
    setCanSend(nextCanSend) {
      canSend = Boolean(nextCanSend)
      input.disabled = !canSend
      updateSendState()
    },
    setBusy(nextBusy) {
      busy = Boolean(nextBusy)
      updateSendState()
    },
    showBridging() {
      const m = document.createElement("div")
      m.className = "wp-mp-msg wp-mp-msg-bridging"
      m.textContent = t("mp.chat.bridging")
      log.appendChild(m)
      scrollDown()
      return () => m.remove()
    },
    close,
  }
}

/* ------------------------------------------------------------------- pip + toast */

/** A tiny "{n} nearby" online pip; `set(n)` updates, `dispose()` removes. */
export function createNearbyPip(overlay: HTMLElement): {
  set: (n: number) => void
  dispose: () => void
} {
  const pip = document.createElement("div")
  pip.className = "wp-mp-pip"
  const dot = document.createElement("span")
  dot.className = "wp-mp-pip-dot"
  const label = document.createElement("span")
  pip.append(dot, label)
  let mounted = false
  return {
    set(n) {
      if (n <= 0) {
        if (mounted) {
          pip.remove()
          mounted = false
        }
        return
      }
      label.textContent = String(n)
      if (!mounted) {
        overlay.appendChild(pip)
        mounted = true
      }
    },
    dispose() {
      pip.remove()
      mounted = false
    },
  }
}

/** A transient bottom toast (invite results, etc.). Auto-dismisses. */
export function showToast(overlay: HTMLElement, native: string, text: string, ms = 2600): void {
  const toast = document.createElement("div")
  toast.className = "wp-mp-toast"
  applyDir(toast, native)
  toast.textContent = text
  overlay.appendChild(toast)
  setTimeout(() => toast.remove(), ms)
}
