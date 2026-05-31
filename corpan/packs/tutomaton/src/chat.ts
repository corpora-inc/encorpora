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
 * All native access goes through `hostApi` (never `window.__TAURI__`). Voice
 * input is the keyboard's built-in dictation (on-device, ~50 languages, no model
 * to manage) typed straight into the text field — there is no custom STT mic.
 */

import "./chat.css"
import { LanguageManager, type HostApi, type LanguageRegistryEntry, type LanguageRuntime } from "./languageManager"
import { ModelManager, BASE_MODEL, type ModelPhase } from "./modelManager"
import { t as i18n, type I18nKey } from "./i18n"

// Minimal slice of @corpan/sdk's ContentPackModule that we actually use.
// The host passes initialState.stackConfig — the user's active stack, where
// languages[0] is their NATIVE language and languages[1..] are the ones they're
// learning. We use it to float the user's own languages to the top of the picker.
type MountInit = { stackConfig?: { languages?: string[] } }
type ContentPackModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: MountInit
  ) => Promise<{ unmount?: () => void } | void> | { unmount?: () => void } | void
}

const PACK_ID = "tutomaton-v1"

type Msg = { role: "user" | "assistant"; content: string }

type State = {
  messages: Msg[]
  ttsEnabled: boolean
  activeLanguage: LanguageRuntime | null
  currentStreamId: string | null
  cancelStream: (() => Promise<void>) | null
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

/** The real Corpán brand mark (ear on a stepped ziggurat) — the same
 *  `corpan-mark-trim.png` the host home screen uses, downscaled to ~80px and
 *  base64-inlined so the IIFE bundle stays self-contained (no asset fetch). */
const LOGO_DATA_URL = "data:image/png;base64,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"

// ============================================================
// Presentation helpers
// ============================================================

/** Small, tasteful flags for the language pills. Falls back to none. */
// Flag/glyph per language. Language ≠ nation, so a few deliberately use a SCRIPT
// glyph instead of a national flag to avoid taking a geopolitical side:
//   zh-Hant / yue → 繁 (Traditional/Cantonese written form is shared by TW + HK;
//     a national flag here is a Taiwan/PRC/HK statement we don't want to make)
//   pa-Arab (Shahmukhi) → ਪ-ish: no single clean nation, use a script mark
// Per product calls: en=🇺🇸, es=🇪🇸 (Spain as the generic Spanish marker),
// ru=🇷🇺, he=🇮🇱 (the only realistic national markers).
const LANG_FLAG: Record<string, string> = {
  en: "🇺🇸", es: "🇪🇸", it: "🇮🇹", fr: "🇫🇷", de: "🇩🇪",
  "pt-BR": "🇧🇷", "pt-PT": "🇵🇹", nl: "🇳🇱", ca: "🇪🇸", ro: "🇷🇴",
  ru: "🇷🇺", uk: "🇺🇦", bg: "🇧🇬", sr: "🇷🇸", pl: "🇵🇱",
  cs: "🇨🇿", sk: "🇸🇰", sl: "🇸🇮", hr: "🇭🇷", hu: "🇭🇺",
  fi: "🇫🇮", sv: "🇸🇪", da: "🇩🇰", no: "🇳🇴", lt: "🇱🇹",
  el: "🇬🇷", tr: "🇹🇷",
  zh: "🇨🇳", "zh-Hans": "🇨🇳", "zh-Hant": "繁", "yue-Hant-HK": "粵",
  ja: "🇯🇵", "ko-polite": "🇰🇷",
  vi: "🇻🇳", th: "🇹🇭", id: "🇮🇩", ms: "🇲🇾", sw: "🇰🇪",
  hi: "🇮🇳", bn: "🇧🇩", ta: "🇮🇳", te: "🇮🇳", gu: "🇮🇳",
  kn: "🇮🇳", mr: "🇮🇳", ne: "🇳🇵", "pa-Guru": "🇮🇳", "pa-Arab": " پ",
  ur: "🇵🇰", ar: "🇸🇦", fa: "🇮🇷", he: "🇮🇱",
}

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
  s = s.replace(/<\/?reference\b[^>]*>/gi, "")
  // Orphaned combining marks → the "dotted-circle" artifact. A combining mark
  // (Unicode M*) only renders correctly attached to a base letter; when the
  // model drops the base (common for small models in Indic/Tamil/Arabic/Thai),
  // the leftover vowel-sign/virama draws on a ◌ dotted circle. Strip any run of
  // combining marks that has no base before it — i.e. at the start of the text
  // or right after whitespace. Well-formed clusters (mark immediately follows
  // its base letter) are untouched. Verified: clean Tamil passes through byte-
  // identical; only orphan-leading sequences are cleaned.
  s = s.replace(/(^|\s)\p{M}+/gu, "$1")
  s = s.replace(/[ \t]+(?=\n)/g, "")
  s = s.replace(/[ \t]{2,}/g, " ")
  s = s.replace(/\n{3,}/g, "\n\n")
  return s.trim()
}

// ============================================================
// Mount
// ============================================================

const PackModule: ContentPackModule = {
  async mount(container: HTMLElement, hostApi: HostApi, initialState?: MountInit) {
    // The user's stack: languages[0] = their native language, [1..] = learning.
    // We surface ALL of these (native included — we never hide it; they can chat
    // with the tutor in any supported language) at the top of the picker.
    const stackLangs: string[] = Array.isArray(initialState?.stackConfig?.languages)
      ? initialState!.stackConfig!.languages!.filter((c) => typeof c === "string")
      : []
    // Chrome is localized into the user's NATIVE language (stack languages[0]),
    // falling back to the device locale, then English. `t()` localizes a key.
    const uiLang = stackLangs[0] || (navigator.language || "en").split("-")[0]
    const t = (key: I18nKey, params?: Record<string, string>) => i18n(key, uiLang, params)
    const state: State = {
      messages: [],
      // Speaker (TTS) defaults ON — the tutor speaks its replies; the control
      // acts as a MUTE toggle. See $ttsBtn wiring + maybeSpeak().
      ttsEnabled: true,
      activeLanguage: null,
      currentStreamId: null,
      cancelStream: null,
    }

    const baseUrl = readPackBaseUrl()
    const packFetch = (rel: string) => fetch(proxied(joinUrl(baseUrl, rel)), { cache: "no-store" })

    const manifest = (await packFetch("manifest.json").then((r) => r.json())) as {
      languages: LanguageRegistryEntry[]
      databases?: Record<string, string>
      universalSources?: import("./languageManager").SourceManifestEntry[]
    }
    // Languages hidden from the picker for this launch. kn (Kannada): Qwen3-4B
    // confuses Kannada with Devanagari script (greets in नमस्ते, not ನಮಸ್ತೆ) —
    // hide until a stronger base model or verified fix. Revisit per the language
    // quality report.
    const HIDDEN_LANGS = new Set<string>(["kn"])
    const registry = manifest.languages.filter((l) => !HIDDEN_LANGS.has(l.code))
    // The full manifest (incl. `databases` map) is written to disk by the host
    // on first language install, so `queryPackDb` can resolve per-language sqlite.
    const manifestJson = JSON.stringify(manifest)

    // On-disk sqlite path for a language, from the manifest `databases` map
    // (e.g. "languages/es/data/spanish.sqlite3"). queryPackDb uses dbName
    // `tutomaton-<code>`; the host resolves it against this map.
    // A language has a downloadable RAG corpus IFF the manifest's `databases`
    // map names a sqlite for it. Prompt-only tutors (0 RAG sources) have no
    // entry → nothing to download. This is the discriminator that keeps the
    // install flow from fetching a non-existent CDN zip (→ 403) for the ~50
    // prompt-only languages. Prompts/module.json still load over LAN/bundle.
    const hasCorpus = (code: string): boolean =>
      typeof manifest.databases?.[`tutomaton-${code}`] === "string"
    const dbRelPath = (code: string): string =>
      manifest.databases?.[`tutomaton-${code}`] ?? `languages/${code}/data/${code}.sqlite3`
    // The language module ZIP is rooted at the module dir (its top-level entries
    // are `data/`, `module.json`, `prompts/`, `retrieval/`). Extract it AT the
    // module dir `languages/<code>` so the DB lands exactly at dbRelPath
    // (`languages/<code>/data/<db>.sqlite3`). Using the DB's parent dir here
    // would double the `data/` segment → queryPackDb "Database file not found".
    const moduleSubDir = (code: string): string => `languages/${code}`

    // Persist the last selected tutor so exiting and re-entering the pack lands
    // back on the same language. Validated against the live registry on read
    // (a hidden/removed code is ignored → falls through to the default pick).
    const LAST_LANG_KEY = "tutomaton.lastLanguage"
    function saveLastLang(code: string): void {
      try {
        localStorage.setItem(LAST_LANG_KEY, code)
      } catch {
        /* storage full/unavailable — non-fatal, just won't restore next time */
      }
    }
    function loadLastLang(): string | null {
      try {
        const code = localStorage.getItem(LAST_LANG_KEY)
        return code && registry.some((r) => r.code === code) ? code : null
      } catch {
        return null
      }
    }

    // ---------- LanguageManager ----------
    const langMgr = new LanguageManager({
      hostApi,
      packId: PACK_ID,
      registry,
      // Installed == the language's sqlite is ON DISK (retrieval is native/file-
      // based). The shell's module.json/prompts/retriever come over LAN in dev or
      // are bundled in prod; only the DB needs downloading.
      isInstalled: async (code) => {
        // 0 RAG sources → nothing to install; the tutor is prompt-only.
        if (!hasCorpus(code)) return true
        if (!hostApi.packFileExists) return false
        return hostApi.packFileExists(PACK_ID, dbRelPath(code))
      },
      install: async (entry, onProgress) => {
        // Prompt-only language (no corpus in the manifest) → skip the download
        // entirely. Trying to fetch its placeholder CDN zip is what 403'd.
        if (!hasCorpus(entry.code)) return
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
      // Universal sources (§7) — bundled in this pack ZIP, apply to every
      // target language. Currently: the phrase-pack bridge. Each one receives
      // pattern-A `helpers` carrying phrasePacks + queryPackDb at retrieve time.
      universalSources: manifest.universalSources ?? [],
    })

    // ---------- shell ----------
    container.innerHTML = `
      <div class="lt-root" data-pack="${PACK_ID}">
        <!-- TOP BAR. Left→right: orange pyramid mark, "Tutomaton" wordmark, an
             elegant language switcher (compact trigger → searchable sheet),
             then a small controls cluster (speaker mute, new conversation).

             TOP BAR, left→right: a back chevron (exit to home), the real Corpán
             brand mark, the "Tutomaton" wordmark, then the language switcher
             right-aligned. The host injects NO chrome over content packs, so the
             pack owns its own exit; tapping back fires the corpan:exit event the
             host App.tsx listens for. Speaker-mute + new-conversation live in the
             bottom-right FAB cluster, out of the bar. -->
        <header class="lt-header">
          <button class="lt-back" aria-label="${t("home")}" title="${t("home")}">${ICON.back}</button>
          <span class="lt-brand-mark" aria-hidden="true"><img src="${LOGO_DATA_URL}" alt="" draggable="false" /></span>
          <span class="lt-brand-name">Tutomaton</span>
          <button class="lt-lang-trigger" aria-haspopup="dialog" aria-expanded="false" aria-label="${t("switchLanguage")}">
            <span class="lt-lt-flag" aria-hidden="true"></span>
            <span class="lt-lt-name"></span>
            <span class="lt-lt-chev" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
            </span>
          </button>
        </header>

        <div class="lt-langsheet" hidden role="dialog" aria-modal="true" aria-label="${t("chooseTutor")}">
          <div class="lt-langsheet-scrim"></div>
          <div class="lt-langsheet-panel" role="document">
            <div class="lt-langsheet-grip-zone" aria-hidden="true"><div class="lt-langsheet-grip"></div></div>
            <header class="lt-langsheet-head">
              <h2 class="lt-langsheet-title">${t("chooseTutor")}</h2>
              <button class="lt-langsheet-close" aria-label="${t("close")}">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M18.3 5.71L12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.3 19.71 2.88 18.3 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.3-6.3z"/></svg>
              </button>
            </header>
            <div class="lt-langsheet-search">
              <span class="lt-langsheet-search-icon" aria-hidden="true">${ICON.search}</span>
              <input class="lt-langsheet-input" type="text" inputmode="search" autocomplete="off"
                     placeholder="${t("searchLanguages")}" aria-label="${t("searchLanguages")}" />
            </div>
            <div class="lt-langsheet-list" role="listbox" aria-label="${t("languages")}"></div>
          </div>
        </div>

        <main class="lt-log" role="log" aria-live="polite"></main>

        <!-- Floating action cluster: translucent, out of the way, easy to reach.
             Mute toggle (TTS, defaults on) + new-conversation. -->
        <div class="lt-fabs">
          <button class="lt-fab lt-tts active" aria-label="${t("muteVoice")}" aria-pressed="true" title="${t("voiceReplies")}">${ICON.speaker}</button>
          <button class="lt-fab lt-clear" aria-label="${t("newConversation")}" title="${t("newConversation")}">${ICON.refresh}</button>
        </div>

        <footer class="lt-input">
          <!-- Voice input is the keyboard's built-in dictation mic (on-device,
               ~50 languages, no model to manage). The text field accepts it
               directly; we don't ship a custom STT mic. -->
          <div class="lt-field">
            <textarea class="lt-text" rows="1" dir="auto" placeholder="${t("askAnything")}" autocomplete="off"></textarea>
          </div>
          <button class="lt-send" aria-label="${t("send")}" disabled>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a1 1 0 0 0-1.39 1.2L4 11l9 1-9 1-1.98 6.2a1 1 0 0 0 1.38 1.2z"/></svg>
          </button>
        </footer>

        <div class="lt-setup" hidden>
          <div class="lt-setup-card">
            <div class="lt-setup-glyph" aria-hidden="true"><img src="${LOGO_DATA_URL}" alt="" draggable="false" /></div>
            <h2 class="lt-setup-title">${t("setUpTutor")}</h2>
            <p class="lt-setup-body"></p>
            <div class="lt-setup-progress" hidden>
              <div class="lt-setup-bar"><div class="lt-setup-fill"></div></div>
              <div class="lt-setup-pct"></div>
            </div>
            <button class="lt-setup-action"></button>
            <p class="lt-setup-note">${t("runsOnDevice")}</p>
          </div>
        </div>
      </div>
    `

    const $log = container.querySelector<HTMLElement>(".lt-log")!
    const $text = container.querySelector<HTMLTextAreaElement>(".lt-text")!
    const $send = container.querySelector<HTMLButtonElement>(".lt-send")!
    const $clear = container.querySelector<HTMLButtonElement>(".lt-clear")!
    const $ttsBtn = container.querySelector<HTMLButtonElement>(".lt-tts")!
    const $back = container.querySelector<HTMLButtonElement>(".lt-back")!
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

    // Localize the CSS pseudo-element labels (copy affordance) — pseudo-elements
    // can't call t(), so feed them via CSS custom properties (quoted strings).
    const $root = container.querySelector<HTMLElement>(".lt-root")!
    $root.style.setProperty("--lt-hold-label", JSON.stringify(t("releaseToCopy")))
    $root.style.setProperty("--lt-copied-label", JSON.stringify(t("copied")))

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
          $setupBody.textContent = t("checkingDevice")
          break
        case "needs-install": {
          const gb = (phase.sizeMb / 1024).toFixed(1)
          $setupBody.textContent = t("needsInstall", { model: BASE_MODEL.displayName, size: gb })
          $setupAction.textContent = t("downloadTutor", { size: gb })
          break
        }
        case "downloading":
          $setupBody.textContent = t("downloadingTutor")
          $setupFill.style.width = `${phase.pct}%`
          $setupPct.textContent = `${phase.downloadedMb} / ${phase.totalMb} MB · ${phase.pct}%`
          break
        case "installing":
          $setupBody.textContent = phase.message
          break
        case "loading":
          $setupBody.textContent = t("wakingTutor")
          break
        case "error":
          $setupBody.textContent = phase.message
          $setupAction.hidden = !phase.canRetry
          $setupAction.disabled = false
          $setupAction.textContent = t("tryAgain")
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

    /** Installed (sqlite-on-disk) codes, refreshed on switch. */
    let installedSet = new Set<string>()

    /** "Your languages" = the user's stack (native + learning), floated to the
     *  top of the picker. The host gives bare codes (es, zh, pt); map them to our
     *  manifest codes (which may be regional: pt-BR, zh-Hans, ko-polite, …). A
     *  bare code matches any manifest entry that starts with it. */
    const yourSet = new Set<string>()
    for (const want of stackLangs) {
      for (const e of registry) {
        if (e.code === want || e.code.split("-")[0] === want) yourSet.add(e.code)
      }
    }
    const isYours = (code: string): boolean => yourSet.has(code)

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
        empty.textContent = t("noLanguagesMatch")
        $langSheetList.appendChild(empty)
        return
      }

      // "Your languages" = the user's stack (native + learning); fall back to
      // installed-on-disk when the host gave us no stack (e.g. standalone dev).
      const inYours = (e: LanguageRegistryEntry) =>
        yourSet.size > 0 ? isYours(e.code) : installedSet.has(e.code)
      const yours = matched.filter(inYours)
      const others = matched.filter((e) => !inYours(e))

      // Only show grouping headers when there's something installed AND we're
      // not actively narrowing with a query (keeps a clean flat list while
      // searching, and avoids "empty section" awkwardness with few languages).
      const showGroups = !q && yours.length > 0 && others.length > 0
      if (showGroups) {
        $langSheetList.appendChild(sectionHeader(t("yourLanguages")))
        for (const e of yours) $langSheetList.appendChild(makeLangCard(e, active))
        $langSheetList.appendChild(sectionHeader(t("allLanguagesSection")))
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
        <div class="lt-welcome-mark" aria-hidden="true"><img src="${LOGO_DATA_URL}" alt="" draggable="false" /></div>
        <h2 class="lt-welcome-title" dir="auto">${langName ? t("practice", { lang: nativeName(langName) }) : t("yourPrivateTutor")}</h2>
        <p class="lt-welcome-sub">${t("welcomeSub")}</p>
        <div class="lt-welcome-langs" aria-label="${t("yourLanguages")}"></div>
        <div class="lt-chips"></div>
      `

      // ---- intro language picker: "your languages" stacked prominently, with
      // an expand-to-all affordance (full list lives in the sheet → scales to ~50)
      const langRow = wrap.querySelector<HTMLDivElement>(".lt-welcome-langs")!
      // Feature the user's stack (native + learning); else installed; else first few.
      const yours = registry.filter((e) =>
        yourSet.size > 0 ? isYours(e.code) : installedSet.has(e.code)
      )
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
        `<span class="lt-langpill-name">${registry.length > featured.length ? t("allLanguages") : t("browseLanguages")}</span>` +
        `<span class="lt-langpill-chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg></span>`
      more.addEventListener("click", openLangSheet)
      langRow.appendChild(more)

      const chipsRow = wrap.querySelector<HTMLDivElement>(".lt-chips")!
      // Generic starter prompts, localized into the user's native UI language
      // (the tutor reads any language and replies in the target). Keeping them
      // generic avoids a target×UI translation matrix while still showing the
      // chips in the learner's own language.
      const chips = [t("suggestHello"), t("suggestFood"), t("suggestIntroduce"), t("suggestGrammar")]
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
      // dir="auto" makes each bubble pick LTR/RTL from its own content's first
      // strong character — Arabic/Hebrew/Persian/Urdu replies right-align
      // idiomatically, English left-aligns, mixed content per-message. No
      // per-language flag needed and the chrome stays LTR.
      body.dir = "auto"
      body.textContent = text
      // Assistant replies: SHORT press = hear it again (always speaks, even when
      // muted — good for drilling); LONG press = copy to clipboard (e.g. to paste
      // into a translator). Pointer-based so it works on touch + desktop.
      if (role === "assistant") {
        wrap.classList.add("lt-speakable")
        body.title = t("tapToHearHoldToCopy")
        const LONG_MS = 450
        let timer: number | null = null
        let longReady = false
        const clear = () => {
          if (timer !== null) { window.clearTimeout(timer); timer = null }
          body.classList.remove("lt-holding")
        }
        body.addEventListener("pointerdown", (e) => {
          if (e.button !== undefined && e.button !== 0) return
          longReady = false
          clear()
          // The timer only MARKS the press as long + shows the "release to copy"
          // hint. The actual copy must run in the pointerup handler so it stays
          // inside a real user-gesture context (WKWebView blocks clipboard from
          // timer callbacks).
          timer = window.setTimeout(() => {
            longReady = true
            body.classList.add("lt-holding")
          }, LONG_MS)
        })
        body.addEventListener("pointerup", () => {
          const wasLong = longReady
          clear()
          const t = body.textContent?.trim()
          if (!t) return
          if (wasLong) copyReply(t, body)   // sync, inside the gesture
          else speakText(t)
        })
        body.addEventListener("pointercancel", clear)
        body.addEventListener("pointerleave", clear)
        // a real finger long-press fires the iOS callout/context menu — suppress it
        body.addEventListener("contextmenu", (e) => e.preventDefault())
      }
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
        <h2 class="lt-welcome-title">${t("adding", { lang: name })}</h2>
        <p class="lt-welcome-sub lt-dl-msg">${t("downloadingLessons")}</p>
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
      // Show a download card only for a language that HAS a corpus and whose
      // sqlite isn't on disk yet. Prompt-only tutors (0 RAG sources) never
      // download, so they go straight to chat with no card.
      const needsDownload =
        hasCorpus(code) && !((await hostApi.packFileExists?.(PACK_ID, dbRelPath(code))) ?? false)
      let dl: ReturnType<typeof renderLangDownloading> | null = null
      if (needsDownload) dl = renderLangDownloading(name)
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
        saveLastLang(code)
        renderLangs()
        renderWelcome()
      } catch (e) {
        systemNote(t("couldntLoad", { lang: name, error: e instanceof Error ? e.message : String(e) }))
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

    /** Speak text in the active language's voice. Always plays (used by an
     *  explicit tap-to-replay on a bubble), independent of the mute toggle. */
    function speakText(text: string) {
      if (text && state.activeLanguage) {
        hostApi.speak(state.activeLanguage.voiceLanguageCode, text).catch((e) => console.error("[tts]", e))
      }
    }

    /** Speak only if the speaker isn't muted — for auto-speaking new replies. */
    function maybeSpeak(text: string) {
      if (state.ttsEnabled) speakText(text)
    }

    /** Long-press a reply → copy to clipboard (e.g. to paste into a translator).
     *  Runs SYNCHRONOUSLY inside the pointerup gesture. The WKWebView blocks the
     *  async clipboard API, so we use the legacy execCommand("copy") path (which
     *  works inside a real user gesture) and fall back to navigator.clipboard.
     *  Flashes a brief "Copied" state; noisy on failure. */
    function copyReply(text: string, body: HTMLElement) {
      const flash = () => {
        body.classList.add("lt-copied")
        window.setTimeout(() => body.classList.remove("lt-copied"), 900)
      }
      // 1) Native clipboard via the host (tauri-plugin-clipboard-manager) — the
      //    reliable path; the web clipboard API is blocked in the WKWebView.
      if (hostApi.copyText) {
        hostApi.copyText(text).then(flash).catch((e) => {
          console.error("[tutomaton] hostApi.copyText failed:", e)
          systemNote(t("couldntCopy"))
        })
        return
      }
      // 2) Fallbacks for standalone/browser dev: execCommand, then the async API.
      try {
        const ta = document.createElement("textarea")
        ta.value = text
        ta.setAttribute("readonly", "")
        ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none"
        container.appendChild(ta)
        ta.focus()
        ta.select()
        ta.setSelectionRange(0, text.length)
        const ok = document.execCommand("copy")
        ta.remove()
        if (ok) { flash(); return }
      } catch (e) {
        console.error("[tutomaton] execCommand copy failed:", e)
      }
      navigator.clipboard?.writeText(text).then(flash).catch((e) => {
        console.error("[tutomaton] clipboard write failed:", e)
        systemNote(t("couldntCopy"))
      })
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
      $ttsBtn.setAttribute("aria-label", state.ttsEnabled ? t("muteVoice") : t("unmuteVoice"))
    }
    syncTtsBtn()
    $ttsBtn.addEventListener("click", () => {
      state.ttsEnabled = !state.ttsEnabled
      syncTtsBtn()
      if (!state.ttsEnabled) hostApi.stopSpeech?.()
    })

    // ---------- exit to home ----------
    // The host injects no chrome over content packs, so the pack owns its exit.
    // App.tsx closes the overlay on the `corpan:exit` window event (the canonical
    // event every reader uses); the hostApi exposes no close method.
    function exitToHome() {
      try {
        window.dispatchEvent(new CustomEvent("corpan:exit", { detail: { packId: PACK_ID } }))
      } catch (e) {
        console.error("[tutomaton] exitToHome failed:", e)
      }
    }
    $back.addEventListener("click", exitToHome)

    // Voice input intentionally relies on the keyboard's built-in dictation
    // (on-device, ~50 languages, zero model to manage). No custom STT here.

    // ---------- bootstrap ----------
    const installedCodes = await langMgr.installed()
    installedSet = new Set(installedCodes)
    renderLangs()
    // Restore the last tutor first; else first installed; else first in registry.
    const initialCode = loadLastLang() || installedCodes[0] || registry[0]?.code
    if (initialCode) await switchLanguage(initialCode)
    void modelMgr.check()
    syncSendEnabled()

    return {
      unmount: () => {
        if (state.cancelStream) void state.cancelStream().catch(() => {})
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
