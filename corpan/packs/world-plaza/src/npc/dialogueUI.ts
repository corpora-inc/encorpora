/**
 * dialogueUI — the premium NPC chat panel mounted over the 3D canvas.
 *
 * A pure-view module: it owns the DOM + animations and exposes an imperative
 * handle the runtime drives (`beginNpcTurn` → `appendNpcToken` → `endNpcTurn`,
 * `addUserMessage`, `setChips`, `showToolCard`, …). It holds NO model/broker
 * logic. The keyboard is the input floor today; the mic button is a disabled
 * stub wired to the future `VoiceInput` seam.
 *
 * All CSS lives in `dialogue.css` scoped under `.wp-npc-`; we do not touch the
 * game's `src/styles.css`.
 */

import "./dialogue.css"

export type DialogueUIStrings = {
  /** aria/placeholder for the text field. */
  inputPlaceholder: string
  /** close button label. */
  close: string
  /** "Tap to hear" replay label. */
  replay: string
  /** mic-not-available tooltip. */
  voiceComingSoon: string
  /** small label shown on a fired tool card, e.g. "Mini-game". */
  challengeLabel: string
  /** the deterministic "Play a game" chip label (the reliable offer CTA). */
  playOffer: string
}

const DEFAULT_STRINGS: DialogueUIStrings = {
  inputPlaceholder: "Say something…",
  close: "Close",
  replay: "Hear again",
  voiceComingSoon: "Voice input coming soon — type for now",
  challengeLabel: "Challenge",
  playOffer: "🎮 Play",
}

export type DialogueUICallbacks = {
  /** User submitted text (Enter or send button, or tapped a suggested chip). */
  onSubmit: (text: string) => void
  /** User tapped the replay button on an NPC line. */
  onReplay: (text: string) => void
  /** Panel close requested (X, scrim tap, or Escape). */
  onClose: () => void
  /** User tapped the deterministic "Play a game" chip. Distinct from onSubmit:
   *  this launches a challenge directly, it does NOT send text to the model. */
  onPlay?: () => void
}

export type DialogueUIOptions = {
  npcName: string
  /** Sub-line under the name, e.g. the place/era or quest title. */
  subtitle?: string
  /** Optional palette overrides (from Scene.palette). */
  palette?: { accent?: string; paper?: string; ink?: string }
  strings?: Partial<DialogueUIStrings>
}

export interface DialogueUIHandle {
  /** Start a fresh NPC bubble; returns a token-appender bound to it. */
  beginNpcTurn(): { appendToken: (t: string) => void }
  /** Finalize the current NPC bubble (stops the streaming caret) + optional TTS replay control. */
  endNpcTurn(finalText: string): void
  /** Push a user message bubble (right-aligned). */
  addUserMessage(text: string): void
  /** Render a small centered system note (e.g. fallback notice). */
  addNote(text: string): void
  /** Render a "tool fired" card inline (e.g. a launched mini-game). */
  showToolCard(label: string): void
  /** Show/hide the soft three-dot thinking indicator. */
  setThinking(on: boolean): void
  /** Replace the suggested-reply chips (empty array clears them). */
  setChips(chips: string[]): void
  /** Show (or, with null, hide) the prominent deterministic "Play a game" chip.
   *  Tapping it fires `onPlay`. An optional label overrides the default. */
  setPlayOffer(show: boolean, label?: string): void
  /** Enable/disable the composer (e.g. while a turn streams). */
  setInputEnabled(on: boolean): void
  /** Focus the text field. */
  focusInput(): void
  /** Animate the panel in. */
  open(): void
  /** Animate out + remove from the DOM. */
  dispose(): void
}

const ICON_SEND =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.39 1.2L4 11l9 1-9 1-1.98 6.2a1 1 0 0 0 1.38 1.2z"/></svg>'
const ICON_MIC =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>'
const ICON_SPEAKER =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "·"
}

export function createDialogueUI(
  container: HTMLElement,
  opts: DialogueUIOptions,
  cb: DialogueUICallbacks,
): DialogueUIHandle {
  const strings: DialogueUIStrings = { ...DEFAULT_STRINGS, ...(opts.strings ?? {}) }

  const root = document.createElement("div")
  root.className = "wp-npc-root"
  if (opts.palette?.accent) root.style.setProperty("--wp-npc-accent", opts.palette.accent)
  if (opts.palette?.paper) root.style.setProperty("--wp-npc-paper", opts.palette.paper)
  if (opts.palette?.ink) root.style.setProperty("--wp-npc-ink", opts.palette.ink)

  root.innerHTML = `
    <div class="wp-npc-scrim" aria-hidden="true"></div>
    <section class="wp-npc-panel" role="dialog" aria-modal="true" aria-label="${escapeAttr(opts.npcName)}">
      <header class="wp-npc-head">
        <div class="wp-npc-portrait" aria-hidden="true">${escapeHtml(initials(opts.npcName))}</div>
        <div class="wp-npc-titles">
          <div class="wp-npc-name">${escapeHtml(opts.npcName)}</div>
          ${opts.subtitle ? `<div class="wp-npc-sub">${escapeHtml(opts.subtitle)}</div>` : ""}
        </div>
        <button class="wp-npc-close" aria-label="${escapeAttr(strings.close)}" title="${escapeAttr(strings.close)}">✕</button>
      </header>
      <main class="wp-npc-log" role="log" aria-live="polite"></main>
      <div class="wp-npc-playrow" hidden></div>
      <div class="wp-npc-chips" hidden></div>
      <footer class="wp-npc-composer">
        <button class="wp-npc-mic" disabled aria-label="${escapeAttr(strings.voiceComingSoon)}" title="${escapeAttr(strings.voiceComingSoon)}">${ICON_MIC}</button>
        <div class="wp-npc-field">
          <textarea class="wp-npc-input" rows="1" dir="auto" placeholder="${escapeAttr(strings.inputPlaceholder)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="${escapeAttr(strings.inputPlaceholder)}"></textarea>
        </div>
        <button class="wp-npc-send" aria-label="Send" disabled>${ICON_SEND}</button>
      </footer>
    </section>
  `
  container.appendChild(root)

  const $panel = root.querySelector<HTMLElement>(".wp-npc-panel")!
  // Guarantee the panel's FIRST painted frame is off-screen + out of flow, even
  // if dialogue.css has not parsed yet (it ships in the same bundle, but we never
  // rely on stylesheet timing for the no-layout-shift contract). The class toggle
  // in open() then animates from this state on the next frame.
  $panel.style.transform = "translateY(105%)"

  const $scrim = root.querySelector<HTMLDivElement>(".wp-npc-scrim")!
  const $log = root.querySelector<HTMLElement>(".wp-npc-log")!
  const $chips = root.querySelector<HTMLDivElement>(".wp-npc-chips")!
  const $playrow = root.querySelector<HTMLDivElement>(".wp-npc-playrow")!
  const $input = root.querySelector<HTMLTextAreaElement>(".wp-npc-input")!
  const $send = root.querySelector<HTMLButtonElement>(".wp-npc-send")!
  const $close = root.querySelector<HTMLButtonElement>(".wp-npc-close")!

  let thinkingEl: HTMLElement | null = null
  let streamingBubble: HTMLElement | null = null
  let inputEnabled = true

  const scrollDown = () => {
    $log.scrollTop = $log.scrollHeight
  }

  const syncSend = () => {
    $send.disabled = !inputEnabled || $input.value.trim().length === 0
  }

  const autoGrow = () => {
    $input.style.height = "auto"
    $input.style.height = `${Math.min(96, $input.scrollHeight)}px`
  }

  const submit = () => {
    const text = $input.value.trim()
    if (!text || !inputEnabled) return
    $input.value = ""
    autoGrow()
    syncSend()
    cb.onSubmit(text)
  }

  $input.addEventListener("input", () => {
    autoGrow()
    syncSend()
  })
  $input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  })
  $send.addEventListener("click", submit)
  $close.addEventListener("click", () => cb.onClose())
  $scrim.addEventListener("click", () => cb.onClose())
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") cb.onClose()
  }
  document.addEventListener("keydown", onKey)

  function clearThinking() {
    if (thinkingEl) {
      thinkingEl.remove()
      thinkingEl = null
    }
  }

  function makeBubble(role: "npc" | "you", text = ""): HTMLDivElement {
    const el = document.createElement("div")
    el.className = `wp-npc-msg wp-npc-msg-${role}`
    el.dir = "auto"
    el.textContent = text
    $log.appendChild(el)
    scrollDown()
    return el
  }

  return {
    beginNpcTurn() {
      clearThinking()
      // finalize any orphaned streaming bubble first
      streamingBubble?.classList.remove("wp-npc-msg-streaming")
      const el = makeBubble("npc", "")
      el.classList.add("wp-npc-msg-streaming")
      streamingBubble = el
      return {
        appendToken: (tk: string) => {
          el.textContent = (el.textContent ?? "") + tk
          scrollDown()
        },
      }
    },

    endNpcTurn(finalText: string) {
      clearThinking()
      const el = streamingBubble ?? makeBubble("npc")
      el.classList.remove("wp-npc-msg-streaming")
      el.textContent = finalText
      streamingBubble = null
      // trailing replay (TTS) affordance
      const replay = document.createElement("button")
      replay.className = "wp-npc-replay"
      replay.innerHTML = `${ICON_SPEAKER}<span>${escapeHtml(strings.replay)}</span>`
      replay.addEventListener("click", () => cb.onReplay(finalText))
      $log.appendChild(replay)
      scrollDown()
    },

    addUserMessage(text: string) {
      makeBubble("you", text)
    },

    addNote(text: string) {
      const el = document.createElement("div")
      el.className = "wp-npc-msg wp-npc-msg-note"
      el.textContent = text
      $log.appendChild(el)
      scrollDown()
    },

    showToolCard(label: string) {
      const el = document.createElement("div")
      el.className = "wp-npc-toolcard"
      el.textContent = `▸ ${strings.challengeLabel}: ${label}`
      $log.appendChild(el)
      scrollDown()
    },

    setThinking(on: boolean) {
      if (on) {
        if (thinkingEl) return
        const el = document.createElement("div")
        el.className = "wp-npc-thinking"
        el.setAttribute("aria-label", "thinking")
        el.innerHTML = "<span></span><span></span><span></span>"
        $log.appendChild(el)
        thinkingEl = el
        scrollDown()
      } else {
        clearThinking()
      }
    },

    setChips(chips: string[]) {
      $chips.innerHTML = ""
      if (chips.length === 0) {
        $chips.hidden = true
        return
      }
      $chips.hidden = false
      for (const c of chips) {
        const btn = document.createElement("button")
        btn.className = "wp-npc-chip"
        btn.dir = "auto"
        btn.textContent = c
        btn.addEventListener("click", () => {
          if (!inputEnabled) return
          cb.onSubmit(c)
        })
        $chips.appendChild(btn)
      }
    },

    setPlayOffer(show: boolean, label?: string) {
      $playrow.innerHTML = ""
      if (!show) {
        $playrow.hidden = true
        return
      }
      $playrow.hidden = false
      const btn = document.createElement("button")
      btn.className = "wp-npc-chip wp-npc-chip-play"
      btn.dir = "auto"
      btn.textContent = label ?? strings.playOffer
      btn.addEventListener("click", () => {
        // The Play chip is intentionally NOT gated on inputEnabled: the model may
        // still be streaming a line, but the offer is deterministic and should
        // always fire. Hide it immediately so a double-tap can't double-launch.
        $playrow.innerHTML = ""
        $playrow.hidden = true
        cb.onPlay?.()
      })
      $playrow.appendChild(btn)
      scrollDown()
    },

    setInputEnabled(on: boolean) {
      inputEnabled = on
      $input.disabled = !on
      syncSend()
    },

    focusInput() {
      // Coarse pointer (touch): do NOT autofocus. Raising the soft keyboard on
      // open is exactly what makes WebKit scroll-jump; focus must be a deliberate
      // tap on the field. On a fine pointer (desktop/laptop) we focus, but always
      // with preventScroll so the focus call can never scroll the document.
      const coarse =
        typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches
      if (coarse) return
      try {
        $input.focus({ preventScroll: true })
      } catch {
        // Older engines without the options bag: still avoid a scroll jump by
        // pinning scroll around the focus call.
        const x = window.scrollX
        const y = window.scrollY
        $input.focus()
        window.scrollTo(x, y)
      }
    },

    open() {
      // Drop the inline opening transform so the .wp-npc-open class drives the
      // on-screen transform; do it next frame so the transition runs from the
      // off-screen state (compositor-only: transform + opacity, no layout).
      requestAnimationFrame(() => {
        $panel.style.transform = ""
        root.classList.add("wp-npc-open")
      })
    },

    dispose() {
      document.removeEventListener("keydown", onKey)
      root.classList.remove("wp-npc-open")
      // wait out the slide-down before removing
      window.setTimeout(() => root.remove(), 320)
    },
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  )
}
function escapeAttr(s: string): string {
  return escapeHtml(s)
}
