/**
 * Tutomaton — multilingual on-device language tutor (pack entry point).
 *
 * The SHELL. Per-language content (sqlite, prompts, retriever) lives in
 * `languages/<code>/` as a module managed by LanguageManager. The shared base
 * model (Qwen3-4B GGUF) is downloaded/loaded once via ModelManager and reused by
 * every LLM pack on the device.
 *
 *   user message
 *     → LanguageManager.current().retrieve(message)
 *     → if kind === "theme": render the canonical list directly (no LLM call)
 *     → else: hostApi.llm.chat(systemPrompt + grounding + reference, messages)
 *           → stream tokens into the message bubble
 *     → if TTS on: hostApi.speak(activeLang.voiceLanguageCode, finalText)
 *
 * All native access goes through `hostApi` (never `window.__TAURI__`). Voice mode
 * is parlometron push-to-talk; on unmount `hostApi.stt.releaseAudio()` is
 * non-negotiable for the iOS mic indicator.
 */

import "./chat.css"
import { LanguageManager, type HostApi, type LanguageRegistryEntry, type LanguageRuntime } from "./languageManager"
import { ModelManager, BASE_MODEL, type ModelPhase } from "./modelManager"

// Minimal slice of @corpan/sdk's ContentPackModule that we actually use.
type ContentPackModule = {
  mount: (container: HTMLElement, hostApi: HostApi) => Promise<{ unmount?: () => void } | void> | { unmount?: () => void } | void
}

const PACK_ID = "tutomaton-v1"

type Msg = { role: "user" | "assistant"; content: string }

type State = {
  messages: Msg[]
  ttsEnabled: boolean
  activeLanguage: LanguageRuntime | null
  currentStreamId: string | null
  cancelStream: (() => Promise<void>) | null
  recording: boolean
  sttSession: string | null
  sttPrepared: boolean
}

// ============================================================
// Pack asset resolution (base URL injected on our <script> tag)
// ============================================================

function readPackBaseUrl(): string {
  try {
    const el = document.querySelector<HTMLScriptElement>(
      'script[data-corp-game="true"][data-corp-game-id]'
    )
    return el?.dataset.corpGameBaseUrl ? new URL(el.dataset.corpGameBaseUrl).toString() : ""
  } catch {
    return ""
  }
}

function joinUrl(base: string, rel: string): string {
  if (!base) return rel
  const b = base.endsWith("/") ? base.slice(0, -1) : base
  const r = rel.startsWith("/") ? rel.slice(1) : rel
  return `${b}/${r}`
}

/** In dev the WebView is on the host origin while the pack is served
 *  cross-origin; route those through the host's `/game-proxy` passthrough. */
function proxied(absUrl: string): string {
  try {
    const u = new URL(absUrl, window.location.href)
    if (u.protocol !== "http:" && u.protocol !== "https:") return u.toString()
    if (u.origin === window.location.origin) return u.toString()
    return `/game-proxy?url=${encodeURIComponent(u.toString())}`
  } catch {
    return absUrl
  }
}

// ============================================================
// LLM streaming — via hostApi.llm (never window.__TAURI__)
// ============================================================

type StreamHandle = { sessionId: string; cancel: () => Promise<void> }

async function llmChat(
  hostApi: HostApi,
  systemPrompt: string,
  messages: Msg[],
  onToken: (token: string) => void,
  onDone: (full: string) => void,
  onError: (err: string) => void
): Promise<StreamHandle> {
  if (!hostApi.llm) throw new Error("On-device AI isn't available in this version.")
  return hostApi.llm.chat(
    {
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      options: { temperature: 0.55, topP: 0.9, repeatPenalty: 1.2, maxTokens: 1500 },
    },
    { onToken, onDone: (full) => onDone(full), onError: (err) => onError(err) }
  )
}

// ============================================================
// Inline SVG icon set (lucide-style line icons — no dependency).
// Stroke icons inherit currentColor; sized by the caller's CSS.
// ============================================================

const ICON = {
  /** Orange brand mark: a clean pyramid/triangle with a subtle gradient. The
   *  ONLY orange in the chrome (brand-reserved). Rendered inline so the pack
   *  never depends on an external asset. */
  pyramid: `<svg viewBox="0 0 28 24" width="24" height="22" aria-hidden="true">
      <defs><linearGradient id="lt-pyr" x1="0" y1="0" x2="1" y2="0.6">
        <stop offset="0" stop-color="#fcd34d"/><stop offset="1" stop-color="#f59e0b"/>
      </linearGradient></defs>
      <!-- wide-base 3D pyramid (lit right face + shaded left face + ground line)
           so it reads as a monument, not a warning triangle -->
      <path d="M14 4 25 19H14z" fill="url(#lt-pyr)"/>
      <path d="M14 4 3 19h11z" fill="#c2740b"/>
      <line x1="2" y1="20.4" x2="26" y2="20.4" stroke="#f59e0b" stroke-width="1.6" stroke-linecap="round" stroke-opacity="0.55"/>
    </svg>`,
  speaker: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>`,
  speakerMuted: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>`,
  back: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`,
  search: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
} as const

// ============================================================
// Presentation helpers
// ============================================================

/** Small, tasteful flags for the language pills. Falls back to none. */
const LANG_FLAG: Record<string, string> = { es: "🇪🇸", zh: "🇨🇳", fr: "🇫🇷", de: "🇩🇪", ja: "🇯🇵", it: "🇮🇹", pt: "🇵🇹", ko: "🇰🇷" }

/** Per-language starter prompts shown in the welcome state. */
const SUGGESTIONS: Record<string, string[]> = {
  es: [
    "How do you say “good morning”?",
    "Teach me food vocabulary",
    "Conjugate “hablar”",
    "When do I use the subjunctive?",
  ],
  zh: [
    "How do I use 了?",
    "Teach me food vocabulary",
    "Explain the four tones",
    "Difference between 不 and 没",
  ],
}
const SUGGESTIONS_FALLBACK = ["Teach me some greetings", "How do you say “thank you”?", "Give me food vocabulary"]

function nativeName(entry: LanguageRegistryEntry): string {
  return entry.displayName[entry.code] || entry.displayName.en || entry.code
}

function scrubOutput(s: string): string {
  s = s.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F0FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/gu,
    ""
  )
  s = s.replace(/^#{1,6}\s+/gm, "")
  s = s.replace(/\*\*([^*]+?)\*\*/g, "$1")
  s = s.replace(/\*\*/g, "")
  s = s.replace(/<\/?reference>/gi, "")
  s = s.replace(/[ \t]+(?=\n)/g, "")
  s = s.replace(/\n{3,}/g, "\n\n")
  return s.trim()
}

// ============================================================
// Mount
// ============================================================

const PackModule: ContentPackModule = {
  async mount(container: HTMLElement, hostApi: HostApi) {
    const state: State = {
      messages: [],
      // Speaker (TTS) defaults ON — the tutor speaks its replies; the control
      // acts as a MUTE toggle. See $ttsBtn wiring + maybeSpeak().
      ttsEnabled: true,
      activeLanguage: null,
      currentStreamId: null,
      cancelStream: null,
      recording: false,
      sttSession: null,
      // STT engine is prepared lazily on the first mic press (and only once).
      sttPrepared: false,
    }

    const baseUrl = readPackBaseUrl()
    const packFetch = (rel: string) => fetch(proxied(joinUrl(baseUrl, rel)), { cache: "no-store" })

    const manifest = (await packFetch("manifest.json").then((r) => r.json())) as {
      languages: LanguageRegistryEntry[]
      databases?: Record<string, string>
    }
    const registry = manifest.languages
    // The full manifest (incl. `databases` map) is written to disk by the host
    // on first language install, so `queryPackDb` can resolve per-language sqlite.
    const manifestJson = JSON.stringify(manifest)

    // On-disk sqlite path for a language, from the manifest `databases` map
    // (e.g. "languages/es/data/spanish.sqlite3"). queryPackDb uses dbName
    // `tutomaton-<code>`; the host resolves it against this map.
    const dbRelPath = (code: string): string =>
      manifest.databases?.[`tutomaton-${code}`] ?? `languages/${code}/data/${code}.sqlite3`
    // The language module ZIP is rooted at the module dir (its top-level entries
    // are `data/`, `module.json`, `prompts/`, `retrieval/`). Extract it AT the
    // module dir `languages/<code>` so the DB lands exactly at dbRelPath
    // (`languages/<code>/data/<db>.sqlite3`). Using the DB's parent dir here
    // would double the `data/` segment → queryPackDb "Database file not found".
    const moduleSubDir = (code: string): string => `languages/${code}`

    // ---------- LanguageManager ----------
    const langMgr = new LanguageManager({
      hostApi,
      packId: PACK_ID,
      registry,
      // Installed == the language's sqlite is ON DISK (retrieval is native/file-
      // based). The shell's module.json/prompts/retriever come over LAN in dev or
      // are bundled in prod; only the DB needs downloading.
      isInstalled: async (code) => {
        if (!hostApi.packFileExists) return false
        return hostApi.packFileExists(PACK_ID, dbRelPath(code))
      },
      install: async (entry, onProgress) => {
        if (!hostApi.installModuleZip) {
          throw new Error("This version of the app can't download language data.")
        }
        await hostApi.installModuleZip(
          {
            packId: PACK_ID,
            subPath: moduleSubDir(entry.code),
            url: entry.moduleUrl,
            sha256: entry.sha256,
            packManifest: manifestJson,
          },
          onProgress
        )
      },
      loadModuleFile: async (code, rel) => packFetch(`languages/${code}/${rel}`).then((r) => r.text()),
    })

    // ---------- shell ----------
    container.innerHTML = `
      <div class="lt-root" data-pack="${PACK_ID}">
        <!-- TOP BAR. Left→right: orange pyramid mark, "Tutomaton" wordmark, an
             elegant language switcher (compact trigger → searchable sheet),
             then a small controls cluster (speaker mute, new conversation).

             HOST-X COLLISION FIX (approach b): the host GameModal floats its own
             close "X" at top-right (z-50, absolute, right:12px, top:safe+12px)
             OVER this pack. We therefore (1) keep the pack's top-right corner
             clear — the controls cluster gets generous right padding so it never
             sits under the host X — and (2) add the pack's OWN explicit "Home"
             back affordance on the far LEFT (the pyramid+wordmark is a button
             that exits to home), so there is an obvious, non-overlapping way
             back regardless of the host chrome. -->
        <header class="lt-header">
          <button class="lt-home" aria-label="Back to home" title="Home">
            <span class="lt-brand-mark" aria-hidden="true">${ICON.pyramid}</span>
            <span class="lt-brand-name">Tutomaton</span>
            <span class="lt-home-hint" aria-hidden="true">${ICON.back}</span>
          </button>
          <button class="lt-lang-trigger" aria-haspopup="dialog" aria-expanded="false" aria-label="Switch language">
            <span class="lt-lt-flag" aria-hidden="true"></span>
            <span class="lt-lt-name"></span>
            <span class="lt-lt-chev" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
            </span>
          </button>
          <div class="lt-controls">
            <button class="lt-icon lt-tts active" aria-label="Mute voice replies" aria-pressed="true" title="Voice replies">${ICON.speaker}</button>
            <button class="lt-icon lt-clear" aria-label="New conversation" title="New conversation">${ICON.refresh}</button>
          </div>
        </header>

        <div class="lt-langsheet" hidden role="dialog" aria-modal="true" aria-label="Choose a language">
          <div class="lt-langsheet-scrim"></div>
          <div class="lt-langsheet-panel" role="document">
            <div class="lt-langsheet-grip-zone" aria-hidden="true"><div class="lt-langsheet-grip"></div></div>
            <header class="lt-langsheet-head">
              <h2 class="lt-langsheet-title">Choose a tutor</h2>
              <button class="lt-langsheet-close" aria-label="Close">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.3 19.71 2.88 18.3 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.3-6.3z"/></svg>
              </button>
            </header>
            <div class="lt-langsheet-search">
              <span class="lt-langsheet-search-icon" aria-hidden="true">${ICON.search}</span>
              <input class="lt-langsheet-input" type="text" inputmode="search" autocomplete="off"
                     placeholder="Search languages…" aria-label="Search languages" />
            </div>
            <div class="lt-langsheet-list" role="listbox" aria-label="Languages"></div>
          </div>
        </div>

        <main class="lt-log" role="log" aria-live="polite"></main>

        <footer class="lt-input">
          <!-- The mic lives INSIDE the input row (always present). The send
               arrow appears once there's text; otherwise the hold-to-talk mic
               is the primary action. Push-to-talk logic is unchanged. -->
          <div class="lt-field">
            <textarea class="lt-text" rows="1" placeholder="Ask your tutor anything…" autocomplete="off"></textarea>
            <button class="lt-mic" aria-label="Hold to speak, release to send" title="Hold to speak">${ICON.mic}</button>
          </div>
          <button class="lt-send" aria-label="Send" disabled>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.39 1.2L4 11l9 1-9 1-1.98 6.2a1 1 0 0 0 1.38 1.2z"/></svg>
          </button>
        </footer>

        <div class="lt-setup" hidden>
          <div class="lt-setup-card">
            <div class="lt-setup-glyph" aria-hidden="true">${ICON.pyramid}</div>
            <h2 class="lt-setup-title">Set up your tutor</h2>
            <p class="lt-setup-body"></p>
            <div class="lt-setup-progress" hidden>
              <div class="lt-setup-bar"><div class="lt-setup-fill"></div></div>
              <div class="lt-setup-pct"></div>
            </div>
            <button class="lt-setup-action"></button>
            <p class="lt-setup-note">Runs entirely on your device. No account, nothing sent to the cloud.</p>
          </div>
        </div>
      </div>
    `

    const $log = container.querySelector<HTMLElement>(".lt-log")!
    const $text = container.querySelector<HTMLTextAreaElement>(".lt-text")!
    const $send = container.querySelector<HTMLButtonElement>(".lt-send")!
    const $clear = container.querySelector<HTMLButtonElement>(".lt-clear")!
    const $ttsBtn = container.querySelector<HTMLButtonElement>(".lt-tts")!
    const $home = container.querySelector<HTMLButtonElement>(".lt-home")!
    const $mic = container.querySelector<HTMLButtonElement>(".lt-mic")!
    const $langTrigger = container.querySelector<HTMLButtonElement>(".lt-lang-trigger")!
    const $langSheet = container.querySelector<HTMLDivElement>(".lt-langsheet")!
    const $langSheetList = container.querySelector<HTMLDivElement>(".lt-langsheet-list")!
    const $langSheetScrim = container.querySelector<HTMLDivElement>(".lt-langsheet-scrim")!
    const $langSheetClose = container.querySelector<HTMLButtonElement>(".lt-langsheet-close")!
    const $langSheetInput = container.querySelector<HTMLInputElement>(".lt-langsheet-input")!
    const $setup = container.querySelector<HTMLDivElement>(".lt-setup")!
    const $setupBody = container.querySelector<HTMLParagraphElement>(".lt-setup-body")!
    const $setupProgress = container.querySelector<HTMLDivElement>(".lt-setup-progress")!
    const $setupFill = container.querySelector<HTMLDivElement>(".lt-setup-fill")!
    const $setupPct = container.querySelector<HTMLDivElement>(".lt-setup-pct")!
    const $setupAction = container.querySelector<HTMLButtonElement>(".lt-setup-action")!

    // ---------- model setup gate ----------
    let modelReady = false
    function renderModelPhase(phase: ModelPhase) {
      modelReady = phase.kind === "ready"
      $setup.hidden = modelReady
      syncSendEnabled()
      if (modelReady) return

      const showProgress = phase.kind === "downloading"
      $setupProgress.hidden = !showProgress
      const busy =
        phase.kind === "checking" || phase.kind === "downloading" ||
        phase.kind === "installing" || phase.kind === "loading"
      $setupAction.hidden = busy
      $setupAction.disabled = busy

      switch (phase.kind) {
        case "checking":
          $setupBody.textContent = "Checking your device…"
          break
        case "needs-install":
          $setupBody.textContent =
            `Tutomaton runs a private AI tutor (${BASE_MODEL.displayName}, ~${(phase.sizeMb / 1024).toFixed(1)} GB) entirely on your device. Download it once — then learn anytime, even offline.`
          $setupAction.textContent = `Download tutor · ${(phase.sizeMb / 1024).toFixed(1)} GB`
          break
        case "downloading":
          $setupBody.textContent = "Downloading your tutor…"
          $setupFill.style.width = `${phase.pct}%`
          $setupPct.textContent = `${phase.downloadedMb} / ${phase.totalMb} MB · ${phase.pct}%`
          break
        case "installing":
          $setupBody.textContent = phase.message
          break
        case "loading":
          $setupBody.textContent = "Waking up your tutor…"
          break
        case "error":
          $setupBody.textContent = phase.message
          $setupAction.hidden = !phase.canRetry
          $setupAction.disabled = false
          $setupAction.textContent = "Try again"
          break
      }
    }
    const modelMgr = new ModelManager(hostApi, renderModelPhase)
    $setupAction.addEventListener("click", () => void modelMgr.installAndLoad())

    // ---------- language pills ----------
    const uiLocale = (navigator.language || "en").split("-")[0]
    // ---------- language sheet (compact trigger + glorious sheet) ----------
    function openLangSheet() {
      $langSheet.hidden = false
      // start from a clean, unfiltered list every open
      langQuery = ""
      $langSheetInput.value = ""
      renderLangCards()
      // next frame so the open transition runs from the hidden state
      requestAnimationFrame(() => $langSheet.classList.add("open"))
      $langTrigger.setAttribute("aria-expanded", "true")
    }
    function closeLangSheet() {
      $langSheet.classList.remove("open")
      $langTrigger.setAttribute("aria-expanded", "false")
      // wait out the transition before hiding (keeps the slide-down visible)
      window.setTimeout(() => {
        if (!$langSheet.classList.contains("open")) $langSheet.hidden = true
      }, 220)
    }

    $langTrigger.addEventListener("click", openLangSheet)
    $langSheetScrim.addEventListener("click", closeLangSheet)
    $langSheetClose.addEventListener("click", closeLangSheet)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$langSheet.hidden) closeLangSheet()
    })
    // Live-filter the sheet as you type. Scales gracefully to ~50 languages.
    let langQuery = ""
    $langSheetInput.addEventListener("input", () => {
      langQuery = $langSheetInput.value.trim().toLowerCase()
      renderLangCards()
    })

    /** Installed ("your languages") codes, refreshed on switch. Drives grouping. */
    let installedSet = new Set<string>()

    function entryMatches(entry: LanguageRegistryEntry, q: string): boolean {
      if (!q) return true
      const hay = [
        entry.code,
        nativeName(entry),
        ...Object.values(entry.displayName ?? {}),
      ].join(" ").toLowerCase()
      return hay.includes(q)
    }

    function makeLangCard(entry: LanguageRegistryEntry, active: string | undefined): HTMLButtonElement {
      const card = document.createElement("button")
      card.className = "lt-langcard"
      card.dataset.code = entry.code
      card.setAttribute("role", "option")
      const isActive = entry.code === active
      card.classList.toggle("active", isActive)
      card.setAttribute("aria-selected", isActive ? "true" : "false")
      const flag = LANG_FLAG[entry.code] || "✦"
      const sub = entry.displayName[uiLocale] && entry.displayName[uiLocale] !== nativeName(entry)
        ? `<span class="lt-langcard-sub">${entry.displayName[uiLocale]}</span>`
        : ""
      card.innerHTML = `
        <span class="lt-langcard-flag" aria-hidden="true">${flag}</span>
        <span class="lt-langcard-text">
          <span class="lt-langcard-name">${nativeName(entry)}</span>
          ${sub}
        </span>
        <span class="lt-langcard-check" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </span>`
      card.addEventListener("click", () => {
        if (entry.code === state.activeLanguage?.code) {
          closeLangSheet()
          return
        }
        closeLangSheet()
        void switchLanguage(entry.code)
      })
      return card
    }

    function sectionHeader(label: string): HTMLDivElement {
      const h = document.createElement("div")
      h.className = "lt-langsheet-section"
      h.textContent = label
      return h
    }

    /** (Re)render only the sheet's card list — applies the current search query
     *  and the "Your languages" / "All languages" grouping. */
    function renderLangCards() {
      const active = state.activeLanguage?.code
      $langSheetList.innerHTML = ""
      const q = langQuery
      const matched = registry.filter((e) => entryMatches(e, q))

      if (matched.length === 0) {
        const empty = document.createElement("div")
        empty.className = "lt-langsheet-empty"
        empty.textContent = "No languages match your search."
        $langSheetList.appendChild(empty)
        return
      }

      const yours = matched.filter((e) => installedSet.has(e.code))
      const others = matched.filter((e) => !installedSet.has(e.code))

      // Only show grouping headers when there's something installed AND we're
      // not actively narrowing with a query (keeps a clean flat list while
      // searching, and avoids "empty section" awkwardness with few languages).
      const showGroups = !q && yours.length > 0 && others.length > 0
      if (showGroups) {
        $langSheetList.appendChild(sectionHeader("Your languages"))
        for (const e of yours) $langSheetList.appendChild(makeLangCard(e, active))
        $langSheetList.appendChild(sectionHeader("All languages"))
        for (const e of others) $langSheetList.appendChild(makeLangCard(e, active))
      } else {
        // Installed first so the active tutor sits at the top.
        for (const e of [...yours, ...others]) $langSheetList.appendChild(makeLangCard(e, active))
      }
    }

    function renderLangs() {
      const active = state.activeLanguage?.code
      // the compact header trigger reflects the active tutor
      const activeEntry = registry.find((r) => r.code === active) ?? registry[0]
      const tFlag = $langTrigger.querySelector<HTMLSpanElement>(".lt-lt-flag")!
      const tName = $langTrigger.querySelector<HTMLSpanElement>(".lt-lt-name")!
      tFlag.textContent = (activeEntry && LANG_FLAG[activeEntry.code]) || "✦"
      tName.textContent = activeEntry ? nativeName(activeEntry) : "Language"
      renderLangCards()
    }

    // ---------- message rendering ----------
    function clearLog() {
      $log.innerHTML = ""
    }

    function renderWelcome() {
      clearLog()
      const code = state.activeLanguage?.code
      const langName = registry.find((r) => r.code === code)
      const wrap = document.createElement("div")
      wrap.className = "lt-welcome"
      wrap.innerHTML = `
        <div class="lt-welcome-mark" aria-hidden="true">${ICON.pyramid}</div>
        <h2 class="lt-welcome-title">${langName ? `Practice ${nativeName(langName)}` : "Your private tutor"}</h2>
        <p class="lt-welcome-sub">Ask anything — translations, grammar, vocab, or just chat. It all runs on your device.</p>
        <div class="lt-welcome-langs" aria-label="Your languages"></div>
        <div class="lt-chips"></div>
      `

      // ---- intro language picker: "your languages" stacked prominently, with
      // an expand-to-all affordance (full list lives in the sheet → scales to ~50)
      const langRow = wrap.querySelector<HTMLDivElement>(".lt-welcome-langs")!
      const yours = registry.filter((e) => installedSet.has(e.code))
      const featured = (yours.length > 0 ? yours : registry).slice(0, 6)
      for (const entry of featured) {
        const pill = document.createElement("button")
        pill.className = "lt-langpill"
        pill.classList.toggle("active", entry.code === code)
        pill.setAttribute("aria-pressed", entry.code === code ? "true" : "false")
        pill.innerHTML =
          `<span class="lt-langpill-flag" aria-hidden="true">${LANG_FLAG[entry.code] || "✦"}</span>` +
          `<span class="lt-langpill-name">${nativeName(entry)}</span>`
        pill.addEventListener("click", () => {
          if (entry.code === state.activeLanguage?.code) return
          void switchLanguage(entry.code)
        })
        langRow.appendChild(pill)
      }
      // "All languages" expander → opens the searchable sheet (the scalable path)
      const more = document.createElement("button")
      more.className = "lt-langpill lt-langpill-more"
      more.innerHTML =
        `<span class="lt-langpill-name">${registry.length > featured.length ? "All languages" : "Browse languages"}</span>` +
        `<span class="lt-langpill-chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg></span>`
      more.addEventListener("click", openLangSheet)
      langRow.appendChild(more)

      const chipsRow = wrap.querySelector<HTMLDivElement>(".lt-chips")!
      const chips = (code && SUGGESTIONS[code]) || SUGGESTIONS_FALLBACK
      for (const c of chips) {
        const chip = document.createElement("button")
        chip.className = "lt-chip"
        chip.textContent = c
        chip.addEventListener("click", () => {
          if (!modelReady) return
          void send(c)
        })
        chipsRow.appendChild(chip)
      }
      $log.appendChild(wrap)
    }

    function scrollDown() {
      $log.scrollTop = $log.scrollHeight
    }

    function bubble(role: "user" | "assistant", text = ""): HTMLDivElement {
      // First real message clears the welcome state.
      if ($log.querySelector(".lt-welcome")) clearLog()
      const wrap = document.createElement("div")
      wrap.className = `lt-msg lt-msg-${role}`
      const body = document.createElement("div")
      body.className = "lt-msg-body"
      body.textContent = text
      wrap.appendChild(body)
      $log.appendChild(wrap)
      scrollDown()
      return body
    }

    function systemNote(text: string) {
      const wrap = document.createElement("div")
      wrap.className = "lt-msg lt-msg-system"
      wrap.textContent = text
      $log.appendChild(wrap)
      scrollDown()
    }

    // ---------- language data download UX ----------
    /** First time a language is picked, its lesson DB downloads. Render a calm
     *  inline card with a live progress bar (reuses the setup-card styles). */
    function renderLangDownloading(name: string): {
      update: (pct: number, mb: number, totalMb: number, stage: string) => void
    } {
      clearLog()
      const wrap = document.createElement("div")
      wrap.className = "lt-welcome"
      wrap.innerHTML = `
        <div class="lt-welcome-mark" aria-hidden="true">📚</div>
        <h2 class="lt-welcome-title">Adding ${name}</h2>
        <p class="lt-welcome-sub lt-dl-msg">Downloading lessons, vocabulary & grammar…</p>
        <div class="lt-setup-progress" style="max-width:360px">
          <div class="lt-setup-bar"><div class="lt-setup-fill lt-dl-fill"></div></div>
          <div class="lt-setup-pct lt-dl-pct"></div>
        </div>
      `
      $log.appendChild(wrap)
      const $fill = wrap.querySelector<HTMLDivElement>(".lt-dl-fill")!
      const $pct = wrap.querySelector<HTMLDivElement>(".lt-dl-pct")!
      const $msg = wrap.querySelector<HTMLParagraphElement>(".lt-dl-msg")!
      return {
        update: (pct, mb, totalMb, stage) => {
          if (stage === "downloading" && totalMb > 0) {
            $fill.style.width = `${pct}%`
            $pct.textContent = `${mb} / ${totalMb} MB · ${pct}%`
          } else {
            $msg.textContent =
              stage === "extracting" ? "Unpacking lessons…" : stage === "verifying" ? "Verifying…" : "Finishing…"
          }
        },
      }
    }

    // ---------- language switching ----------
    async function switchLanguage(code: string) {
      const entry = registry.find((r) => r.code === code)
      const name = entry ? nativeName(entry) : code
      // Show a download card only if the data isn't already on disk.
      const installed = (await hostApi.packFileExists?.(PACK_ID, dbRelPath(code))) ?? false
      let dl: ReturnType<typeof renderLangDownloading> | null = null
      if (!installed) dl = renderLangDownloading(name)
      try {
        state.activeLanguage = await langMgr.activate(code, (p) => {
          dl?.update(
            p.total > 0 ? Math.min(100, Math.round((p.progress / p.total) * 100)) : 0,
            Math.round(p.progress / 1_048_576),
            Math.round(p.total / 1_048_576),
            p.stage
          )
        })
        state.messages = []
        installedSet.add(code)
        renderLangs()
        renderWelcome()
      } catch (e) {
        systemNote(`Couldn't load ${name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // ---------- send a turn ----------
    const $inputBar = container.querySelector<HTMLElement>(".lt-input")!
    function syncSendEnabled() {
      const hasText = $text.value.trim().length > 0
      $send.disabled = !modelReady || !hasText || !!state.currentStreamId
      // iMessage-style: text present → show the send arrow; empty → show the
      // hold-to-talk mic. CSS swaps which control is visible off this class.
      $inputBar.classList.toggle("has-text", hasText)
    }

    async function send(text: string) {
      if (!text.trim() || state.currentStreamId || !state.activeLanguage || !modelReady) return
      const userText = text.trim()
      const lang = state.activeLanguage
      state.messages.push({ role: "user", content: userText })
      bubble("user", userText)
      $text.value = ""
      autosize()
      syncSendEnabled()

      const dest = bubble("assistant")
      const caret = document.createElement("span")
      caret.className = "lt-caret"
      dest.parentElement!.classList.add("lt-streaming")
      dest.appendChild(caret)

      const finish = () => {
        dest.parentElement!.classList.remove("lt-streaming")
        caret.remove()
        state.currentStreamId = null
        state.cancelStream = null
        syncSendEnabled()
      }

      try {
        // RAG grounding is best-effort: never let a DB miss kill the turn.
        let rag: Awaited<ReturnType<typeof lang.retrieve>>
        try {
          rag = await lang.retrieve(userText)
        } catch (ragErr) {
          console.error("[tutomaton] retrieve failed; answering ungrounded:", ragErr)
          rag = { kind: "none", reference: null, log: [] }
        }

        // THEME BYPASS — deliver the canonical list directly, no LLM call.
        if (rag.kind === "theme" && rag.reference) {
          const full = `${pickThemeIntro(lang.code)}\n\n${stripThemeHeader(rag.reference)}`
          dest.textContent = full
          state.messages.push({ role: "assistant", content: full })
          maybeSpeak(full)
          finish()
          scrollDown()
          return
        }

        const systemFull = rag.reference
          ? `${lang.systemPrompt}\n\n${lang.groundingInstruction}${rag.reference}`
          : lang.systemPrompt
        let buf = ""
        const handle = await llmChat(
          hostApi,
          systemFull,
          state.messages,
          (tok) => {
            buf += tok
            caret.remove()
            dest.textContent = scrubOutput(buf)
            dest.appendChild(caret)
            scrollDown()
          },
          (full) => {
            const cleaned = scrubOutput(full)
            dest.textContent = cleaned
            state.messages.push({ role: "assistant", content: cleaned })
            maybeSpeak(cleaned)
            finish()
            scrollDown()
          },
          (err) => {
            dest.textContent = ""
            dest.parentElement!.classList.add("lt-error")
            dest.textContent = err.replace(/^[A-Z_]+:\s*/, "")
            finish()
          }
        )
        state.currentStreamId = handle.sessionId
        state.cancelStream = handle.cancel
      } catch (e) {
        dest.parentElement!.classList.add("lt-error")
        dest.textContent = e instanceof Error ? e.message : String(e)
        finish()
      }
    }

    function maybeSpeak(text: string) {
      if (state.ttsEnabled && text && state.activeLanguage) {
        hostApi.speak(state.activeLanguage.voiceLanguageCode, text).catch((e) => console.error("[tts]", e))
      }
    }

    // ---------- input UX ----------
    function autosize() {
      $text.style.height = "auto"
      $text.style.height = `${Math.min(140, $text.scrollHeight)}px`
    }
    $text.addEventListener("input", () => {
      autosize()
      syncSendEnabled()
    })
    $text.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        void send($text.value)
      }
    })
    $send.addEventListener("click", () => void send($text.value))

    $clear.addEventListener("click", async () => {
      if (state.cancelStream) await state.cancelStream().catch(() => {})
      state.messages = []
      renderWelcome()
    })

    // Speaker control = MUTE toggle (defaults ON). Swaps the speaker/ muted icon.
    function syncTtsBtn() {
      $ttsBtn.classList.toggle("active", state.ttsEnabled)
      $ttsBtn.innerHTML = state.ttsEnabled ? ICON.speaker : ICON.speakerMuted
      $ttsBtn.setAttribute("aria-pressed", state.ttsEnabled ? "true" : "false")
      $ttsBtn.setAttribute("aria-label", state.ttsEnabled ? "Mute voice replies" : "Unmute voice replies")
    }
    syncTtsBtn()
    $ttsBtn.addEventListener("click", () => {
      state.ttsEnabled = !state.ttsEnabled
      syncTtsBtn()
      if (!state.ttsEnabled) hostApi.stopSpeech?.()
    })

    // ---------- exit to home ----------
    // The host owns the floating top-right "X" (guaranteed exit). This is the
    // pack's OWN explicit left-side affordance (the orange pyramid + wordmark IS
    // the home button). The host shell (App.tsx) closes the pack overlay by
    // calling its games-store `closeContentPack()`, which it wires to a set of
    // window events — we dispatch those (the hostApi exposes no close method).
    // Multiple names cover host versions; all funnel to the same handler.
    function exitToHome() {
      try {
        for (const name of ["corpan:exit-pack", "corpan:close-pack", "corp-close-game"]) {
          window.dispatchEvent(new CustomEvent(name, { detail: { packId: PACK_ID } }))
        }
      } catch (e) {
        console.error("[tutomaton] exitToHome failed:", e)
      }
    }
    $home.addEventListener("click", exitToHome)

    // ---------- push-to-talk: hold the mic, release to capture+send ----------
    // A tap-to-start / tap-to-stop toggle was unreliable (a missed second tap
    // left it recording forever). Press-and-hold is unambiguous: down = record,
    // up = stop+transcribe+send. We use Pointer Events + setPointerCapture so the
    // release always lands on the button even if the finger slides off.
    const MIN_HOLD_MS = 250
    let pressActive = false
    let pressStart = 0

    async function micStart(pointerId?: number) {
      if (pressActive || !state.activeLanguage || !modelReady) return
      if (state.recording) return
      pressActive = true
      pressStart = performance.now()
      const sessionId = crypto.randomUUID()
      state.sttSession = sessionId
      state.recording = true
      $mic.classList.add("recording")
      if (pointerId !== undefined) {
        try { $mic.setPointerCapture(pointerId) } catch { /* capture is best-effort */ }
      }
      try {
        // Lazily prepare the STT engine on first use (was previously behind the
        // removed voice-mode toggle). prepare() is idempotent on the host side.
        if (!state.sttPrepared) {
          await hostApi.stt?.prepare?.({ model: "ggml-medium.bin" })
          state.sttPrepared = true
        }
        await hostApi.stt?.startSession?.({
          sessionId,
          language: state.activeLanguage.voiceLanguageCode,
          expectedText: "",
        })
      } catch (e) {
        console.error("[tutomaton] startSession failed:", e)
        state.recording = false
        pressActive = false
        $mic.classList.remove("recording")
        systemNote(`Couldn't start recording: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    async function micStop(canceled = false) {
      if (!pressActive) return
      pressActive = false
      const sessionId = state.sttSession ?? ""
      const heldMs = performance.now() - pressStart
      state.recording = false
      $mic.classList.remove("recording")
      // Too brief to be real speech, or an explicit cancel → drop it, don't send.
      if (canceled || heldMs < MIN_HOLD_MS) {
        try {
          if (hostApi.stt?.cancelSession) await hostApi.stt.cancelSession({ sessionId })
          else await hostApi.stt?.stopSession?.({ sessionId })
        } catch (e) {
          console.error("[tutomaton] cancel recording failed:", e)
        }
        return
      }
      try {
        $mic.classList.add("transcribing")
        const result = await hostApi.stt?.stopSession?.({ sessionId })
        const text = result?.text?.trim()
        if (text) void send(text)
      } catch (e) {
        console.error("[tutomaton] stopSession failed:", e)
        systemNote(`Couldn't transcribe: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        $mic.classList.remove("transcribing")
      }
    }

    $mic.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      void micStart(e.pointerId)
    })
    $mic.addEventListener("pointerup", (e) => {
      e.preventDefault()
      void micStop(false)
    })
    // Pointer left the element WITHOUT capture (or capture released) → treat as
    // stop, not cancel: the user almost certainly finished talking.
    $mic.addEventListener("pointercancel", () => void micStop(true))
    $mic.addEventListener("lostpointercapture", () => void micStop(false))

    // ---------- bootstrap ----------
    const installedCodes = await langMgr.installed()
    installedSet = new Set(installedCodes)
    renderLangs()
    const initialCode = installedCodes[0] || registry[0]?.code
    if (initialCode) await switchLanguage(initialCode)
    void modelMgr.check()
    syncSendEnabled()

    return {
      unmount: () => {
        if (state.cancelStream) void state.cancelStream().catch(() => {})
        // CRITICAL for iOS — release the audio engine so the mic indicator clears.
        hostApi.stt?.releaseAudio?.().catch((e) => console.error("[tutomaton] releaseAudio failed:", e))
        if (state.ttsEnabled) hostApi.stopSpeech?.()
      },
    }
  },
}

// ============================================================
// Per-language theme intros (for the no-LLM theme bypass)
// ============================================================

const THEME_INTROS: Record<string, string[]> = {
  es: ["Aquí tienes el vocabulario:", "Aquí va la lista:", "Te dejo el vocabulario completo:", "Aquí lo tienes:"],
  zh: ["这是词汇表:", "给你列表:", "下面是完整的词汇:", "请看:"],
  en: ["Here's the vocabulary:", "Here's the list:", "Here you go:"],
}

function pickThemeIntro(code: string): string {
  const arr = THEME_INTROS[code] || THEME_INTROS.en
  return arr[Math.floor(Math.random() * arr.length)]
}

function stripThemeHeader(s: string): string {
  const lines = s.split("\n")
  if (lines[0]?.startsWith("# ")) {
    lines.shift()
    while (lines.length && !lines[0].trim()) lines.shift()
  }
  return lines.join("\n")
}

// ============================================================
// Registration — the host looks up globalThis.CorpanGames[manifest.id]
// ============================================================

const scope = globalThis as typeof globalThis & {
  CorpanGames?: Record<string, ContentPackModule>
}
scope.CorpanGames = scope.CorpanGames || {}
scope.CorpanGames[PACK_ID] = PackModule

export default PackModule
