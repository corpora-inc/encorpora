import type { EntryOut, HostApi, TranslationOut } from "./sdk/types"
// The round guts (tuning tables, model registry, text comparison, session
// ids, push-to-talk recorder, per-word result view) MOVED to the
// cap-pronounce capability (docs/journey/specs/capability-modules.md §4.1);
// this pack is their first consumer. Pack-specific chrome (deck/swipe,
// streak/quota, model-setup UI, multiplayer) stays here.
import {
  MODELS,
  modelById,
  defaultModel,
  visibleModels,
  visibleDefaultModel,
  setDeviceMemoryBudget,
  variantExceedsBudget,
} from "@shared/capabilities/pronounce/src/modelRegistry"
import {
  isWhisperSupported,
  stackHasScorableLang,
} from "@shared/capabilities/pronounce/src/whisperLangs"
import { whisperLang } from "@shared/capabilities/pronounce/src/session"
import {
  bindPushToTalk,
  createPushToTalkRecorder,
  ensureLoaded as ensureModelLoaded,
  prepareWithMemoryRetry,
  SwitchCancelledError,
  tryPrepareOnce,
  type PushToTalkRecorder,
} from "@shared/capabilities/pronounce/src/recorder"
import {
  clearResultSlots,
  renderPronounceResult,
  resultSlotsAboveHtml,
  resultSlotsBelowHtml,
} from "@shared/capabilities/pronounce/src/resultView"
import { stimulusBodyHtml } from "@shared/capabilities/pronounce/src/roundView"
import {
  formatErr,
  sttErrCode as errCode,
  type CapabilitySttApi as SttApi,
  type SttErrorCode,
  type SttTranscriptionResult,
} from "@shared/capabilities/core"
import { openTuner } from "./whisperTunerUI"

// Re-exports for pack files that historically imported these from game.ts
// (multiplayer/round.ts, silenceWatcher.ts). One implementation, in the
// capability — never copied.
export {
  charSimilarity,
  isRTL,
  mergeApostropheWords,
  normalizeForCompare,
  tokenizeForPills,
} from "@shared/capabilities/pronounce/src/text"
export type { SttWordTiming, SttAudioLevelEvent } from "@shared/capabilities/core"
import { paywallGate } from "./paywall"
import { t as i18n, type I18nKey } from "./i18n"
// Direct file import (not the @shared/ui barrel) so we don't pull in
// commandDrawer/drawerStore and their zustand dep. The offline notice is
// pure DOM + CSS — perfect for packs that don't otherwise need shared/ui.
import {
  createOfflineNotice,
  isOnline,
  onNetworkChange,
} from "../../shared/ui/offlineNotice"
// Silence auto-stop is wired in `silenceWatcher.ts` but currently
// not invoked from the recording flow — RMS-thresholding-with-fixed-
// numbers is too unreliable across mic gain / noise floor / accent
// variance to ship as an always-on feature. The native `audio_level`
// event stream and the watcher state machine are kept intact for
// future re-wiring (e.g., behind a real VAD model). See pack
// CHANGELOG 0.6.1 for the removal rationale.

// The STT API contract types + error helpers moved to
// @shared/capabilities/core (hostSlice.ts) — the fleet's one copy.

type UiState = "idle" | "recording" | "scoring"

type LoadedPhrase = {
  entry: EntryOut
  target: TranslationOut
  native: TranslationOut | null
  targetLang: string
}

const SWIPE_THRESHOLD_PX = 70
const SWIPE_VELOCITY_PX_PER_MS = 0.4
const STORAGE_KEY = "corpan-pronunciation-coach:v2"
const STORAGE_KEY_LEGACY = "corpan-pronunciation-coach:v1"
const HISTORY_CAP = 50

// NOTE: there is no localStorage cache for "is X installed". We
// deliberately avoid a hint cache because it caused a class of bugs
// where stale hints across iOS app-container UUID changes (every
// sideload can rotate the container, orphaning Documents) made the
// setup overlay show "Use this" on a model that wasn't actually
// installed in the new container. The user then tapped Use this,
// `prepare()` failed, and it looked like models were corrupting each
// other. The plugin (disk via marker + heuristic) is the single
// source of truth. The UI shows "Checking…" briefly while
// `validateModel` returns instead of guessing from cached data.

// `ModelMode` is the registry id (canonical identifier persisted in
// localStorage). The current set is in `modelRegistry.ts` (Small,
// Medium, Large Mobile, Large Turbo Mobile, Advanced as of 0.3.2).
// Adding a tier = one entry there. Removed ids ("standard" from the
// pre-0.3.2 lineup) become unrecognized; the boot path's
// `modelById(savedMode)` check filters them out and falls back to
// `defaultModel().id` so existing users who saved a now-removed id
// land at the new default.
type ModelMode = string

const folderForMode = (mode: ModelMode): string => {
  return modelById(mode)?.folder ?? mode
}
const labelForMode = (mode: ModelMode): string => {
  return modelById(mode)?.label ?? mode
}
// prepare() is local-only — never downloads. Bigger whisper.cpp ggml
// models can take a long time to map and initialize on-device, so they
// get a longer deadline; default 60 s for smaller variants.
const prepareTimeoutMs = (mode: ModelMode): number => {
  const m = modelById(mode)
  if (m && m.approxSizeMB >= 1000) return 180_000
  return 60_000
}
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms))

const postInstallSettleMs = (mode: ModelMode): number => {
  const size = modelById(mode)?.approxSizeMB ?? 0
  if (size >= 1200) return 5000
  if (size >= 800) return 4000
  if (size >= 500) return 2500
  if (size >= 250) return 1250
  return 400
}

type SavedPhrase = {
  entryId: number
  level: string
  domains: string[]
  targetLang: string
  targetText: string
  targetRoman: string
  nativeLang: string | null
  nativeText: string
  nativeRoman: string
}

type SavedState = {
  streak: number
  phrases: SavedPhrase[]
  idx: number
  mode?: ModelMode
}

const phraseToSaved = (p: LoadedPhrase): SavedPhrase => ({
  entryId: p.entry.entry_id,
  level: p.entry.level,
  domains: p.entry.domains ?? [],
  targetLang: p.targetLang,
  targetText: p.target.text,
  targetRoman: p.target.romanization ?? "",
  nativeLang: p.native?.language_code ?? null,
  nativeText: p.native?.text ?? "",
  nativeRoman: p.native?.romanization ?? "",
})

const savedToPhrase = (s: SavedPhrase): LoadedPhrase => ({
  entry: {
    entry_id: s.entryId,
    level: s.level,
    domains: s.domains,
    translations: [],
  },
  target: {
    language_code: s.targetLang,
    text: s.targetText,
    romanization: s.targetRoman,
  },
  native: s.nativeLang
    ? {
        language_code: s.nativeLang,
        text: s.nativeText,
        romanization: s.nativeRoman,
      }
    : null,
  targetLang: s.targetLang,
})

// Script-aware comparison + pill tokenization (isRTL, normalizeForCompare,
// tokenizeForPills, charSimilarity, mergeApostropheWords, the number-word
// maps and low-resource-language sets) moved to
// @shared/capabilities/pronounce/src/text.ts — re-exported above for the
// pack files that import them from here.

const safeStorage = (): Storage | null => {
  try {
    const s = window.localStorage
    const probe = "__pc_probe__"
    s.setItem(probe, "1")
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

const parseSavedState = (raw: string | null): SavedState | null => {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SavedState
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray(parsed.phrases) ||
      typeof parsed.idx !== "number" ||
      typeof parsed.streak !== "number"
    ) {
      return null
    }
    return parsed
  } catch (err) {
    console.error("[pronunciation-coach] localStorage parse failed:", err)
    return null
  }
}

/**
 * One-shot migration from the v1 schema. v1 → v2 drops `mode: "advanced"`
 * because pre-v2 builds shipped the older `openai_whisper-large-v3_turbo`
 * variant that hits a CoreML ANE compile bug (error -14) on M-series iPad.
 * v2 ships the smaller `openai_whisper-large-v3-v20240930_turbo` variant
 * with explicit CPU+GPU compute units. Users with `mode: "advanced"` in
 * v1 storage land on the setup overlay so they reinstall the working
 * variant. Standard mode is preserved.
 */
const loadSavedState = (storage: Storage | null): SavedState | null => {
  if (!storage) return null
  const v2 = parseSavedState(storage.getItem(STORAGE_KEY))
  if (v2) return v2

  const legacy = parseSavedState(storage.getItem(STORAGE_KEY_LEGACY))
  if (!legacy) return null

  const migrated: SavedState = {
    ...legacy,
    mode: legacy.mode === "standard" ? "standard" : undefined,
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(migrated))
    storage.removeItem(STORAGE_KEY_LEGACY)
    console.log(
      "[pronunciation-coach] migrated v1 → v2 storage, mode preserved:",
      migrated.mode ?? "(cleared)"
    )
  } catch (err) {
    console.error("[pronunciation-coach] storage migration failed:", err)
  }
  return migrated
}

// newSessionId + whisperLang moved to
// @shared/capabilities/pronounce/src/session.ts (whisperLang imported above).

const shuffle = <T>(items: T[]): T[] => {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const pickTranslations = (
  entry: EntryOut,
  languages: string[]
): { target: TranslationOut | null; native: TranslationOut | null } => {
  // Single-language stack (immersion / native practice): practice the one
  // language directly, with no native gloss. Every pack must work with a
  // one-language stack — there is no requirement to add a target language.
  // If that one language isn't whisper-scorable, serve nothing so the caller
  // falls through to the calm "not available yet" state instead of recording
  // into a hard error.
  if (languages.length <= 1) {
    const only = languages[0]
    const target =
      only && isWhisperSupported(only)
        ? entry.translations.find((t) => t.language_code === only) ?? null
        : null
    return { target, native: null }
  }

  // Convention: languages[0] is the native (king) language; the rest are
  // target slots the learner is studying.
  const native =
    languages.length > 0
      ? entry.translations.find((t) => t.language_code === languages[0]) ?? null
      : null

  // Randomly mix across target slots, so a stack of FR/ES/DE/EN (with EN
  // as king) cycles through FR, ES, DE on every phrase. Falls through to
  // the next shuffled slot if a given language has no translation for
  // this entry. Only whisper-scorable languages are eligible — an
  // unscorable target (e.g. Cantonese) is silently skipped so the user
  // never records a phrase that can't be scored.
  let target: TranslationOut | null = null
  const targetSlots = shuffle(languages.slice(1).filter(isWhisperSupported))
  for (const lang of targetSlots) {
    const t = entry.translations.find((tr) => tr.language_code === lang)
    if (t) {
      target = t
      break
    }
  }

  // Last-resort fallback: any non-native, whisper-scorable translation on
  // the entry.
  if (!target) {
    target =
      entry.translations.find(
        (t) =>
          isWhisperSupported(t.language_code) &&
          (!native || t.language_code !== native.language_code)
      ) ?? null
  }
  return { target, native }
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const dispatchExit = () => {
  try {
    window.dispatchEvent(new CustomEvent("corpan:exit"))
  } catch (err) {
    console.error("[pronunciation-coach] dispatch exit failed:", err)
  }
}

const launchConfetti = (root: HTMLElement) => {
  const layer = document.createElement("div")
  layer.className = "pc-confetti"
  const colors = ["#7c3aed", "#16a34a", "#facc15", "#ec4899", "#06b6d4"]
  const count = 32
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span")
    piece.style.left = `${Math.random() * 100}%`
    piece.style.background = colors[i % colors.length]
    piece.style.animationDelay = `${Math.random() * 200}ms`
    piece.style.animationDuration = `${900 + Math.random() * 600}ms`
    piece.style.transform = `rotate(${Math.random() * 360}deg)`
    layer.appendChild(piece)
  }
  root.appendChild(layer)
  window.setTimeout(() => layer.remove(), 1800)
}

export type GameHandle = {
  unmount: () => void
}

/** Optional mount-time configuration for the practice mode. */
export type MountGameOpts = {
  /** Override the back/close button behavior. By default the
   *  header's `‹` button fires `corpan:exit` and exits the pack.
   *  Parlometron passes a function that returns to the mode picker
   *  instead (so practice → ‹ → picker → × → fully exits). */
  onClose?: () => void
}

/**
 * Practice mode mount — the original single-player flow. Exported
 * under two names: `mountGame` keeps existing callers (e.g.
 * `main.ts`-era imports) working; `mountPractice` is the
 * Parlometron-era name used by `parlometron.ts`'s mode router.
 * Same function, same return contract.
 */
export const mountGame = (
  container: HTMLElement,
  hostApi: HostApi,
  opts?: MountGameOpts
): GameHandle => {
  const stt = (hostApi as unknown as { stt?: SttApi }).stt

  // Chrome is localized into the user's NATIVE language (stack languages[0]),
  // falling back to the device locale, then English. `tt()` localizes a key.
  const uiLang =
    hostApi.getStackConfig().languages[0] ||
    (navigator.language || "en").split("-")[0]
  const tt = (key: I18nKey, params?: Record<string, string>) =>
    i18n(key, uiLang, params)

  let disposed = false

  // ---- Zoom block — disable pinch-zoom for the duration of the
  // pack's mount via viewport-meta override. The host's viewport
  // meta allows user-scalable, which lets a pinch gesture on the
  // models page leave the WebView zoomed-in. We override on mount
  // and restore on unmount. iOS WebKit honors `maximum-scale=1,
  // user-scalable=no` natively — no JS event listeners required.
  // (An earlier draft also installed `gesturestart`/`gesturechange`/
  // `gestureend` non-passive document-level listeners as belt-and-
  // suspenders. Removed: non-passive document-level gesture
  // listeners can make iOS WebKit pessimistic about touch
  // optimization globally and degrade swipe/scroll perf even when
  // the listeners are dormant.)
  const viewportMeta = document.querySelector<HTMLMetaElement>(
    'meta[name="viewport"]'
  )
  const priorViewportContent = viewportMeta?.getAttribute("content") ?? null
  if (viewportMeta) {
    viewportMeta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    )
  }
  const teardownZoomBlock = () => {
    if (viewportMeta && priorViewportContent !== null) {
      viewportMeta.setAttribute("content", priorViewportContent)
    }
  }

  const renderUnavailable = (
    title = "Speech recognition isn't available on this device",
    body = "Parlometron needs the on-device Whisper plugin and didn't find a working one here. Try updating the app, or this platform may not be supported yet."
  ) => {
    container.innerHTML = `
      <div class="pc-root">
        <div class="pc-header">
          <div class="pc-header-left"></div>
          <div class="pc-header-right">
            <button class="pc-close" id="pc-close" type="button" aria-label="${escapeHtml(tt("ariaClose"))}">×</button>
          </div>
        </div>
        <div class="pc-unavailable">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(body)}</p>
        </div>
      </div>
    `
    container
      .querySelector<HTMLButtonElement>("#pc-close")
      ?.addEventListener("click", dispatchExit)
  }

  if (!stt) {
    renderUnavailable()
    return {
      unmount: () => {
        teardownZoomBlock()
        container.innerHTML = ""
      },
    }
  }

  // ---- Build base layout. The first <div> is a viewport-filling backdrop
  // that lives INSIDE the host's pack container, so it shares the host
  // overlay's z=1100 stacking context. It covers the full visual viewport
  // even when iOS leaves a strip below the host's outer wrapper. ----
  container.innerHTML = `
    <div class="pc-backdrop" id="pc-backdrop"></div>

    <div class="pc-root" id="pc-root">
      <div class="pc-header">
        <div class="pc-header-left">
          <button class="pc-back" id="pc-close" type="button"
                  aria-label="Back to Parlometron picker">‹</button>
        </div>
        <button class="pc-lang-badge" id="pc-lang-badge"
                type="button"
                data-pc-lang-badge
                data-pc-lang=""
                aria-label="Target language (long-press to tune Whisper)"
                hidden>—</button>
        <div class="pc-header-right">
          <span class="pc-streak" id="pc-streak" hidden>🔥 <span id="pc-streak-n">0</span></span>
          <button class="pc-mode" id="pc-mode" type="button"
                  aria-pressed="false"
                  aria-label="Switch speech model"
                  title="Speech model">
            <span class="pc-mode-glyph" aria-hidden="true">✦</span>
          </button>
        </div>
      </div>

      <div class="pc-swipe-area" id="pc-swipe-area">
        <div class="pc-deck" id="pc-deck">
          <div class="pc-card" id="pc-card">
            <div class="pc-card-above">${resultSlotsAboveHtml()}</div>
            <div class="pc-card-center">
              <h1 class="capPron-target" id="pc-target">${escapeHtml(tt("bootLoading"))}</h1>
              <p class="capPron-romanization" id="pc-romanization" hidden></p>
              <p class="capPron-native" id="pc-native"></p>
            </div>
            <div class="pc-card-below">${resultSlotsBelowHtml()}</div>
          </div>
        </div>
      </div>

      <div class="pc-stage">
        <div class="pc-mic-wrap">
          <button class="capPron-mic" id="pc-mic" type="button" disabled>
            <span id="pc-mic-icon">●</span>
          </button>
          <div class="capPron-mic-label" id="pc-mic-label">Loading model…</div>
          <div class="pc-swipe-hint">${escapeHtml(tt("swipeHint"))}</div>
        </div>
        <div class="pc-error" id="pc-error" hidden></div>
      </div>

      <div class="pc-footer">
        Powered by whisper.cpp · <span id="pc-footer-model">Standard</span> · on-device
      </div>

      <!-- Subtle, transparent quota readout pinned lower-right: new rounds
           left today (free tier). Hidden for subscribers (remaining = ∞). -->
      <div class="pc-quota" id="pc-quota" hidden></div>
    </div>
  `

  const closeBtn = container.querySelector<HTMLButtonElement>("#pc-close")!
  const quotaEl = container.querySelector<HTMLDivElement>("#pc-quota")!
  const streakEl = container.querySelector<HTMLSpanElement>("#pc-streak")!
  const streakN = container.querySelector<HTMLSpanElement>("#pc-streak-n")!
  const modeBtn = container.querySelector<HTMLButtonElement>("#pc-mode")!
  const swipeAreaEl = container.querySelector<HTMLDivElement>("#pc-swipe-area")!
  const deckEl = container.querySelector<HTMLDivElement>("#pc-deck")!
  let cardEl = container.querySelector<HTMLDivElement>("#pc-card")!
  const micBtn = container.querySelector<HTMLButtonElement>("#pc-mic")!
  const micIcon = container.querySelector<HTMLSpanElement>("#pc-mic-icon")!
  const micLabel = container.querySelector<HTMLDivElement>("#pc-mic-label")!
  // Result decorations live INSIDE the card; the slot markup + queries +
  // clear animation moved to cap-pronounce's resultView (renderers target
  // the LIVE card, never a stale one, via data-cappron-* attributes).
  const errorEl = container.querySelector<HTMLDivElement>("#pc-error")!

  // ---- Loading overlay ----
  let overlay: HTMLDivElement | null = null
  type OverlayOpts = {
    /** When present, render a Cancel button under the message with
     *  this label. Tapping invokes `onCancel`. Use for waits where
     *  the user should retain an escape hatch — e.g., the
     *  INSUFFICIENT_MEMORY retry loop, where we want to absorb the
     *  error and wait for the kernel to reclaim freelist pages
     *  without trapping the user. */
    cancelLabel?: string
    onCancel?: () => void
  }
  const showOverlay = (message: string, opts?: OverlayOpts) => {
    if (!overlay) {
      overlay = document.createElement("div")
      overlay.className = "pc-overlay"
      overlay.innerHTML = `
        <div class="capPron-spinner"></div>
        <div id="pc-overlay-msg"></div>
        <button id="pc-overlay-cancel" type="button" hidden></button>`
      document.body.appendChild(overlay)
    }
    const msg = overlay.querySelector("#pc-overlay-msg")
    if (msg) msg.textContent = message
    const cancelBtn = overlay.querySelector<HTMLButtonElement>(
      "#pc-overlay-cancel"
    )
    if (cancelBtn) {
      if (opts?.cancelLabel && opts.onCancel) {
        cancelBtn.textContent = opts.cancelLabel
        cancelBtn.hidden = false
        // Replace any prior handler — every showOverlay call binds
        // a fresh closure.
        cancelBtn.onclick = opts.onCancel
      } else {
        cancelBtn.hidden = true
        cancelBtn.onclick = null
      }
    }
  }
  const hideOverlay = () => {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay)
    }
    overlay = null
  }

  const showError = (message: string) => {
    errorEl.textContent = message
    errorEl.hidden = false
    console.error("[pronunciation-coach]", message)
  }
  const clearError = () => {
    errorEl.textContent = ""
    errorEl.hidden = true
  }

  // ---- State ----
  let uiState: UiState = "idle"
  let modelReady = false
  let currentPhrase: LoadedPhrase | null = null
  const history: LoadedPhrase[] = []
  let historyIdx = -1 // index of currentPhrase inside history
  let prefetched: LoadedPhrase | null = null
  let streak = 0
  let modelMode: ModelMode = defaultModel().id
  let modelSwitching = false

  const storage = safeStorage()
  const persist = () => {
    if (!storage) return
    try {
      // Trim history to a moving window centered on the current index so
      // it stays bounded even on long sessions.
      const start = Math.max(0, history.length - HISTORY_CAP)
      const trimmedPhrases = history.slice(start).map(phraseToSaved)
      const trimmedIdx = historyIdx - start
      const state: SavedState = {
        streak,
        phrases: trimmedPhrases,
        idx: trimmedIdx,
        mode: modelMode,
      }
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (err) {
      console.error("[pronunciation-coach] persist failed:", err)
    }
  }

  const renderModeButton = () => {
    const m = modelById(modelMode)
    // Icon-only mode chip. Standard = outlined / neutral; Advanced
    // = filled-accent with the ✦ glyph. The label is communicated
    // entirely through visual state — no text, just a sexy little
    // pill. Tooltip + aria-label still expose the readable name
    // for accessibility / power users.
    modeBtn.setAttribute(
      "aria-pressed",
      modelMode === "advanced" ? "true" : "false"
    )
    modeBtn.classList.toggle("advanced", modelMode === "advanced")
    modeBtn.disabled = modelSwitching
    const tip = m
      ? `${m.label} model (~${m.approxSizeMB} MB) · tap to switch`
      : `${labelForMode(modelMode)} model · tap to switch`
    modeBtn.title = tip
    modeBtn.setAttribute("aria-label", `Speech model: ${labelForMode(modelMode)}`)
    const footerModel = container.querySelector<HTMLSpanElement>("#pc-footer-model")
    if (footerModel) footerModel.textContent = labelForMode(modelMode)
  }

  const updateStreak = () => {
    if (streak <= 0) {
      streakEl.hidden = true
    } else {
      streakN.textContent = String(streak)
      streakEl.hidden = false
    }
  }

  // Lower-right quota readout — new rounds left today in the free tier. The
  // gate returns Infinity for subscribers and null for an unmetered surface;
  // both hide the badge entirely (no chrome for people who paid). Goes faint-
  // urgent in the last few so it reads as "nearly done", never a red warning.
  const updateQuotaBadge = () => {
    const left = paywallGate.remaining()
    if (left === null || !isFinite(left)) {
      quotaEl.hidden = true
      return
    }
    quotaEl.hidden = false
    quotaEl.textContent = String(left)
    quotaEl.setAttribute("aria-label", `${left} left today`)
    quotaEl.classList.toggle("pc-quota-low", left <= 3)
  }

  const setUiState = (next: UiState) => {
    uiState = next
    updateQuotaBadge()
    micBtn.classList.remove("recording", "scoring")
    micBtn.disabled = false
    if (next === "idle") {
      micIcon.innerHTML = "●"
      // The mic is never gated — re-practicing any phrase already in history is
      // free. The cap only blocks reaching for a NEW phrase (goNext), so the mic
      // stays live whether or not the user is capped for the day.
      micLabel.textContent = modelReady
        ? tt("holdToSpeak")
        : tt("loadingModel")
      micBtn.disabled = !modelReady || !currentPhrase
    } else if (next === "recording") {
      micBtn.classList.add("recording")
      micIcon.innerHTML = "■"
      micLabel.textContent = tt("listeningReleaseToStop")
    } else if (next === "scoring") {
      micBtn.classList.add("scoring")
      micIcon.innerHTML = `<div class="capPron-spinner"></div>`
      micLabel.textContent = tt("scoring")
      micBtn.disabled = true
    }
  }

  // ---- Phrase rendering ----
  // Each card uses a 3-row grid so the phrase sits at a fixed
  // vertical slot. The banner above and detail below are added by
  // renderResult INTO the same card (rather than into a separate
  // overlay), so the slide animation takes the card and its
  // decorations off as one unit on swipe.
  // Each card uses a 3-row grid so the phrase sits at a fixed vertical
  // slot. Result slots above/below come from the capability's resultView;
  // the stimulus body comes from its roundView — the deck chrome stays here.
  const cardSkeleton = (centerHtml: string): string => `
    <div class="pc-card-above">${resultSlotsAboveHtml()}</div>
    <div class="pc-card-center">${centerHtml}</div>
    <div class="pc-card-below">${resultSlotsBelowHtml()}</div>
  `

  // The target-language badge lives in the header (`#pc-lang-badge`),
  // not inside the card. One persistent element across phrase swaps,
  // updated by `updateLangBadge` whenever currentPhrase changes.
  // Long-press is wired via delegation on the container (see below).
  const langBadgeEl = container.querySelector<HTMLButtonElement>("#pc-lang-badge")!
  const updateLangBadge = (lang: string | null) => {
    if (!lang) {
      langBadgeEl.hidden = true
      langBadgeEl.textContent = "—"
      langBadgeEl.setAttribute("data-pc-lang", "")
      return
    }
    const base = whisperLang(lang)
    langBadgeEl.hidden = false
    langBadgeEl.textContent = base.toUpperCase()
    langBadgeEl.setAttribute("data-pc-lang", base)
    langBadgeEl.setAttribute(
      "aria-label",
      `Target language ${base.toUpperCase()} — long-press to tune Whisper`
    )
  }

  const fillCard = (card: HTMLDivElement, phrase: LoadedPhrase) => {
    const cfg = hostApi.getStackConfig()
    card.innerHTML = cardSkeleton(
      stimulusBodyHtml({
        targetText: phrase.target.text || "—",
        romanization: phrase.target.romanization || "",
        nativeText: phrase.native?.text || undefined,
        showRomanization: !!cfg.showRomanization,
      })
    )
    updateLangBadge(phrase.targetLang)
  }

  const renderEmptyCard = (
    card: HTMLDivElement,
    headline: string,
    sub?: string
  ) => {
    card.innerHTML = cardSkeleton(
      stimulusBodyHtml({ targetText: headline, nativeText: sub })
    )
    updateLangBadge(null)
  }

  // Calm dead-end state: no phrase to record. Clears the current phrase,
  // shows a designed message, and disables the mic so the user can't reach
  // the red scoring error. Used for both "nothing selected" and "selected
  // language(s) aren't whisper-scorable yet".
  const renderUnavailableCard = (headline: string, sub: string) => {
    currentPhrase = null
    renderEmptyCard(cardEl, headline, sub)
    micBtn.disabled = true
    micLabel.textContent = "—"
  }

  const renderCurrentPhrase = () => {
    if (!currentPhrase) return
    fillCard(cardEl, currentPhrase)
  }

  // Slide animation: move out, then swap, then slide in.
  const slideTo = async (
    direction: "left" | "right",
    populate: (newCard: HTMLDivElement) => void
  ): Promise<void> => {
    const width = deckEl.clientWidth || window.innerWidth
    const dir = direction === "left" ? -1 : 1
    // Animate current card off-screen.
    cardEl.style.transition =
      "transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms ease"
    cardEl.style.transform = `translateX(${dir * width}px)`
    cardEl.style.opacity = "0"
    await new Promise((r) => window.setTimeout(r, 220))

    const newCard = document.createElement("div")
    newCard.className = "pc-card entering"
    newCard.id = "pc-card"
    newCard.style.transition = "none"
    newCard.style.transform = `translateX(${-dir * width}px)`
    newCard.style.opacity = "0"
    populate(newCard)
    deckEl.replaceChild(newCard, cardEl)
    cardEl = newCard

    // Force reflow so the next transition runs.
    void cardEl.offsetWidth
    cardEl.style.transition =
      "transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 240ms ease"
    cardEl.style.transform = "translateX(0)"
    cardEl.style.opacity = "1"
    cardEl.classList.remove("entering")
    cardEl.classList.add("entered")
  }

  const fetchOneEntry = async (): Promise<LoadedPhrase | null> => {
    const cfg = hostApi.getStackConfig()
    if (!cfg.languages || cfg.languages.length < 1) return null
    if (!hostApi.getRandomEntry) return null
    const entry = await hostApi.getRandomEntry()
    const { target, native } = pickTranslations(entry, cfg.languages)
    if (!target) return null
    return { entry, target, native, targetLang: target.language_code }
  }

  const prefetchInBackground = () => {
    if (prefetched || disposed) return
    fetchOneEntry()
      .then((p) => {
        if (!disposed && p) prefetched = p
      })
      .catch((err) => {
        console.error("[pronunciation-coach] prefetch failed:", err)
      })
  }

  // ---- Navigation ----
  const goNext = async () => {
    if (uiState === "scoring") return
    cancelActiveSession()
    clearError()
    // Do NOT clearResult() here. The result decorations live inside
    // the card; the slide animation takes them off-screen as one
    // unit with the phrase. Calling clearResult before the slide
    // would visually snap the decorations off, briefly show the
    // bare phrase, THEN run the slide — three motions where the
    // user should observe one. The new card is rendered fresh by
    // fillCard via cardSkeleton, with empty (hidden) result slots.

    const cfg = hostApi.getStackConfig()
    if (!cfg.languages || cfg.languages.length < 1) {
      renderUnavailableCard(
        tt("noLanguageSelected"),
        tt("chooseLanguageToStudy")
      )
      return
    }
    if (!stackHasScorableLang(cfg.languages)) {
      renderUnavailableCard(
        tt("scoringUnavailableTitle"),
        tt("scoringUnavailableSub")
      )
      return
    }

    // Forward through history if we previously went back — always FREE. Moving
    // back and forth through phrases already seen never touches the daily gate.
    if (historyIdx >= 0 && historyIdx < history.length - 1) {
      const next = history[historyIdx + 1]
      historyIdx += 1
      await slideTo("left", (c) => fillCard(c, next))
      currentPhrase = next
      setUiState("idle")
      persist()
      return
    }

    // Past the end of history → acquiring a NEW phrase. THIS is the metered
    // action (phrase-flip model). At the daily cap, re-show the accomplishment
    // lock and stay on the current phrase — the user keeps full free access to
    // everything they've already seen. Subscribers never block.
    if (paywallGate.isBlocked()) {
      paywallGate.requestDailyLock()
      return
    }

    let next: LoadedPhrase | null = prefetched
    prefetched = null
    if (!next) {
      try {
        next = await fetchOneEntry()
      } catch (err) {
        console.error("[pronunciation-coach] fetch next failed:", err)
        showError(
          tt("errLoadPhrase", { error: formatErr(err) })
        )
        return
      }
    }
    if (!next) {
      showError(tt("noPhrasesAvailable"))
      return
    }

    history.push(next)
    historyIdx = history.length - 1
    // A brand-new phrase was acquired — meter it (the ONE metered seam). Fires
    // the daily accomplishment-lock internally when this tips over the cap; no
    // soft nag (softNagEvery 0); no-op for subscribers.
    paywallGate.note()
    await slideTo("left", (c) => fillCard(c, next!))
    currentPhrase = next
    setUiState("idle")
    persist()
    prefetchInBackground()
  }

  const goPrev = async () => {
    if (uiState === "scoring") return
    if (historyIdx <= 0) return // nothing before
    cancelActiveSession()
    clearError()
    // See goNext: do not clearResult before the slide.

    const prev = history[historyIdx - 1]
    historyIdx -= 1
    await slideTo("right", (c) => fillCard(c, prev))
    currentPhrase = prev
    setUiState("idle")
    persist()
  }

  // ---- Result rendering ----
  // The per-word feedback UI (renderResult) and the clear-with-fade logic
  // moved to cap-pronounce's resultView. Navigation paths don't clear —
  // they slide the whole card off, decorations included, as one motion.
  const clearResult = () => clearResultSlots(cardEl)

  const handleScore = (result: SttTranscriptionResult) => {
    const verdict = renderPronounceResult(cardEl, result, {
      expectedText: currentPhrase?.target.text || "",
      compareLang: currentPhrase?.targetLang || result.language || "",
      uiLang,
      modelFolder: folderForMode(modelMode),
      speak: (lang, text) => {
        try {
          const r = hostApi.speak(lang, text)
          if (r && typeof (r as Promise<void>).catch === "function") {
            ;(r as Promise<void>).catch((err) => {
              console.error("[pronunciation-coach] speak failed:", err)
            })
          }
        } catch (err) {
          console.error("[pronunciation-coach] speak threw:", err)
        }
      },
    })
    // Streak + confetti are PACK reactions to the verdict (celebration is
    // the host's job — capability-modules.md §2.3.5). Bands mirror the
    // shipped tiers: top ≥ 0.85 celebrates, mid ≥ 0.60 keeps the streak
    // alive, low resets; a silent mic never breaks the streak (the user
    // didn't actually attempt the phrase).
    if (verdict.silent) {
      // no-op
    } else if (verdict.band === "top") {
      streak += 1
      launchConfetti(document.body)
    } else if (verdict.band === "mid") {
      // keeps the streak alive, no confetti
    } else {
      streak = 0
    }
    updateStreak()
    persist()
  }

  // ---- Mic flow ----
  // The push-to-talk state machine moved to cap-pronounce's recorder; the
  // pack keeps its UI state + error ROUTING here (LOAD_FAILED → setup,
  // NETWORK → calm banner, UNSUPPORTED_LANGUAGE → dead-end card).
  const recorder: PushToTalkRecorder = createPushToTalkRecorder(stt, {
    model: () => folderForMode(modelMode),
    onState: (s) => {
      if (!disposed) setUiState(s)
    },
    onResult: (result) => {
      if (disposed) return
      handleScore(result)
      // Scoring is free + unlimited (metering moved to NEW-phrase
      // acquisition in goNext). Re-recording never touches the daily gate.
    },
    onError: (err, code, phase) => {
      if (disposed) return
      const msg = formatErr(err)
      if (phase === "start") {
        showError(tt("errStartRecording", { error: msg }))
        return
      }
      if (code === "LOAD_FAILED") {
        // The on-disk model bytes failed at runtime. We do NOT wipe —
        // the user decides via the setup overlay whether to reinstall.
        modelReady = false
        micBtn.disabled = true
        micLabel.textContent = "Model needs reinstall"
        showError(
          `${labelForMode(modelMode)} model failed to load — opening setup so you can reinstall.`
        )
        openModelSetup().catch((err2) => {
          console.error(
            "[pronunciation-coach] openModelSetup after LOAD_FAILED:",
            err2
          )
        })
        return
      }
      if (code === "NETWORK") {
        showError(tt("errNetworkBlip"))
        return
      }
      // Backstop: the native guard rejected the language. We gate unscorable
      // targets before recording, so this should be unreachable — but if it
      // fires, show the calm dead-end card instead of a raw red error.
      if (code === "UNSUPPORTED_LANGUAGE" || /support language/i.test(msg)) {
        renderUnavailableCard(
          tt("scoringUnavailableTitle"),
          tt("scoringUnavailableSub")
        )
        return
      }
      showError(tt("errScoringFailed", { error: msg }))
    },
  })

  const cancelActiveSession = () => recorder.cancel()

  const startRecording = async () => {
    if (!currentPhrase || !modelReady) return
    // Recording/scoring is ALWAYS free — like phrase-flip, only acquiring a
    // NEW phrase is metered (see goNext / loadFirstPhrase).
    clearError()
    clearResult()
    await recorder.start({
      text: currentPhrase.target.text,
      lang: currentPhrase.targetLang,
    })
  }

  const stopRecording = () => recorder.stop()

  // Hold-to-speak binding moved to the capability (pointer capture +
  // pointercancel discipline lives there, once).
  const unbindMicHold = bindPushToTalk(micBtn, {
    canStart: () => uiState === "idle" && modelReady && !!currentPhrase,
    onStart: () => {
      startRecording().catch((err) => {
        console.error("[pronunciation-coach] hold-start threw:", err)
      })
    },
    onStop: () => {
      if (uiState === "recording") {
        stopRecording().catch((err) => {
          console.error("[pronunciation-coach] hold-stop threw:", err)
        })
      }
    },
  })
  // (No cap guard on the mic — re-practicing any phrase already in history is
  // free even when capped. The cap is enforced only at NEW-phrase acquisition
  // in goNext, which re-pops the shared green-check lock.)

  // Skip button removed from the header — swipe ←/→ already covers
  // skip-to-next, and removing the redundant button cleans up the
  // top of the screen significantly (especially on phones where
  // every chiclet competes for the safe-area-top strip).

  closeBtn.addEventListener("click", () => {
    cancelActiveSession()
    // Caller (parlometron.ts) overrides the default exit so the
    // header's `‹` returns to the mode picker instead of leaving
    // the pack entirely. When mounted standalone (no opts), still
    // fires the legacy `corpan:exit` event the host expects.
    if (opts?.onClose) opts.onClose()
    else dispatchExit()
  })

  // Re-prepare the saved-mode native context if it isn't currently loaded
  // — the flow logic moved to the capability recorder (ensureModelLoaded).
  const ensureLoaded = (mode: ModelMode): Promise<boolean> =>
    ensureModelLoaded(stt, folderForMode(mode))

  // Mode button reopens the setup screen so the user explicitly picks a
  // model and watches the install — no more silent inline downloads.
  const openModelSetup = async () => {
    if (modelSwitching) return
    modelSwitching = true
    cancelActiveSession()
    setUiState("idle")
    const previous: ModelMode = modelMode
    // Treat modelMode as active if either (a) it's currently loaded,
    // OR (b) its install hint says it's installed. The latter
    // guards the failed-switch case where a load attempt for the
    // currentActive only counts the in-memory kit (true session
    // state, not a cache). If modelReady is false the overlay will
    // render every card as "Checking…" until validateModel returns,
    // and only then will buttons appear. No risk of stale buttons
    // on a model that isn't actually installed in this container.
    const activeForOverlay: ModelMode | null = modelReady ? modelMode : null
    console.log(
      `[pronunciation-coach] openModelSetup: modelMode=${modelMode} modelReady=${modelReady} activeForOverlay=${activeForOverlay ?? "null"}`
    )
    let outcome: SetupOutcome
    try {
      outcome = await runSetup({
        currentActive: activeForOverlay,
        headline: "Parlometron · Models",
        sub: "These are large, experimental, cutting-edge AI speech models running entirely on your device — no servers, no internet, no privacy compromises. They are also, frankly, not as reliable as you might hope. The bigger ones might crash your phone. The smaller ones might transcribe 'good morning' as 'goldfish moon'. Any of them might surprise you in either direction. Welcome to on-device AI in 2026. Don't take the scoring too seriously. 🤷",
      })
    } finally {
      modelSwitching = false
      renderModeButton()
    }
    if (disposed) return
    if (outcome.kind === "exit") {
      // The plugin's install path may have dropped our previously
      // loaded kit before failing or being cancelled. Re-prepare the
      // saved mode so we don't leave the user with a nil kit.
      if (!modelReady && previous && (await ensureLoaded(previous))) {
        modelReady = true
      }
      return
    }
    if (outcome.kind === "cancelled") {
      setUiState("idle")
      // Same as above: install may have dropped the previous kit
      // before being cancelled. Restore.
      if (!modelReady && previous && (await ensureLoaded(previous))) {
        modelReady = true
      }
      return
    }
    if (outcome.mode === previous && modelReady) {
      setUiState("idle")
      return
    }
    // Capture target locally; do NOT mutate modelMode or persist yet.
    // Persisting before a successful prepare() poisons localStorage:
    // if install reported success but prepare then fails (e.g.,
    // partial download where MelSpectrogram never landed), the saved
    // mode points at a broken install and every subsequent boot
    // re-enters this failure loop. Only persist after prepare wins.
    const targetMode: ModelMode = outcome.mode
    const targetLabel = labelForMode(targetMode)

    // Pre-flight memory check. Native has the authoritative gate
    // inside prepare() (after the previous model is actually
    // unloaded and pages reclaimed), but doing a fast JS-side check
    // FIRST lets us refuse obviously-impossible switches without
    // unloading the currently-working model. If we unloaded then
    // discovered insufficient memory, the user would be stuck with
    // no working model until restart — bad UX. By checking BEFORE
    // unload, the worst case is "we kept your working model and
    // showed a clear message."
    //
    // Heuristic: current available memory (with old model still
    // loaded) should be ≥ targetSize × 0.5. The 0.5× anticipates
    // the old model's bytes being reclaimed when we unload, plus
    // some working memory. The native gate uses 1.3× measured
    // AFTER unload — that's the precise check; this is the fast
    // refuse-the-obvious-no-go path.
    const targetVariant = modelById(targetMode)
    const targetSizeMB = targetVariant?.approxSizeMB ?? 0
    if (targetSizeMB > 0 && stt?.getStatus) {
      try {
        const status = await stt.getStatus()
        const availMB = status.availableMemoryMB ?? null
        if (availMB !== null && availMB < targetSizeMB * 0.5) {
          console.warn(
            `[pronunciation-coach] pre-flight refused switch to ${targetMode}: avail=${availMB}MB target=${targetSizeMB}MB`
          )
          setUiState("idle")
          showError(
            `Not enough memory to switch to ${targetLabel} right now (${availMB} MB free, need ~${Math.round(targetSizeMB * 1.3)} MB). ` +
              `Close other apps and restart Corpán, then try again. Your current model is still loaded.`
          )
          return
        }
      } catch (err) {
        console.warn(
          "[pronunciation-coach] pre-flight status check failed; deferring to native gate:",
          err
        )
      }
    }

    modelReady = false
    micBtn.disabled = true
    // Defense in depth: explicitly unload the previously-loaded model
    // before asking for the new one. The Swift plugin already chains
    // prepare() calls so two loads can't run concurrently, but
    // dropping the previous kit on the JS side first means the user
    // sees a clear "Unloading… → Loading…" progression instead of an
    // opaque pause, AND if any future Swift change reintroduces a
    // race, the old model is already evicted before the request.
    if (
      stt?.unload &&
      previous &&
      previous !== targetMode
    ) {
      micLabel.textContent = `Unloading ${labelForMode(previous)}…`
      showOverlay(
        `Unloading ${labelForMode(previous)} model to free memory…`
      )
      try {
        await stt.unload()
      } catch (err) {
        // Non-fatal: the Swift side will drop the previous kit
        // anyway when prepare() runs. Log and continue.
        console.warn(
          "[pronunciation-coach] explicit unload before switch failed:",
          err
        )
      }
    }
    micLabel.textContent = `Loading ${targetLabel} model…`
    showOverlay(
      `Loading ${targetLabel} model…\nThis can take 10–30s on first launch.`
    )
    try {
      // Use the memory-aware retry wrapper so an INSUFFICIENT_MEMORY
      // from the native gate gets absorbed into a wait+retry loop
      // with cancel, instead of immediately surfacing as a scary
      // "restart Corpán" error. iOS empirically takes ~5-10 s to
      // reclaim freelist pages after a Large-model unload; waiting
      // for that is almost always faster (and lower-friction) than
      // forcing a process relaunch.
      const r = await prepareWithMemoryRetry(stt, folderForMode(targetMode), {
        timeoutMs: prepareTimeoutMs(targetMode),
        label: `Loading ${targetLabel} model`,
        onWait: (_attempt, _remaining, cancel) => {
          showOverlay(
            `Freeing memory for ${targetLabel}…\nThis usually takes a few seconds.`,
            { cancelLabel: "Cancel", onCancel: cancel }
          )
        },
      })
      modelReady = true
      // Prepare succeeded — NOW commit the choice to persistent state.
      modelMode = targetMode
      persist()
      renderModeButton()
      console.log(
        `[pronunciation-coach] Whisper prepared: ${r.model} (${targetLabel})`
      )
      hideOverlay()
      micBtn.disabled = false
      setUiState("idle")
    } catch (err) {
      const msg = formatErr(err)
      const code = errCode(err)
      const isCancel = err instanceof SwitchCancelledError
      console.error(
        `[pronunciation-coach] post-setup load ${isCancel ? "cancelled" : "failed"} (code=${code ?? "—"}):`,
        isCancel ? "user cancel" : msg
      )
      // Don't persist targetMode (we already gated persist behind
      // success). Plugin's validateModel will clear its own stale
      // marker on next call; no JS-side cache to invalidate.
      // Try to restore the previous model rather than leaving the
      // user with a broken "Model unavailable" state. Standard was
      // working fine before the user attempted to switch; we should
      // get them back to that working state automatically rather
      // than dumping them into setup with destructive buttons next
      // to a model they didn't ask to remove.
      if (previous && previous !== targetMode) {
        try {
          const r = await tryPrepareOnce(stt, folderForMode(previous), {
            timeoutMs: prepareTimeoutMs(previous),
            label: `Loading ${labelForMode(previous)} model`,
          })
          modelReady = true
          modelMode = previous
          renderModeButton()
          hideOverlay()
          micBtn.disabled = false
          setUiState("idle")
          if (isCancel) {
            showError(
              `Switch to ${targetLabel} cancelled. Staying on ${labelForMode(previous)}.`
            )
          } else if (code === "MODEL_NOT_INSTALLED") {
            showError(
              `${targetLabel} isn't installed yet. Staying on ${labelForMode(previous)}.`
            )
          } else if (code === "NETWORK") {
            showError(
              `${targetLabel} needs internet to finish setting up. Reconnect and try again — staying on ${labelForMode(previous)} for now.`
            )
          } else if (code === "INSUFFICIENT_MEMORY") {
            // Retry loop exhausted — device really is out of headroom.
            showError(
              `Not enough memory to load ${targetLabel}. Close other apps and restart Corpán, then try the switch again. ` +
                `Reverted to ${labelForMode(previous)}.`
            )
          } else {
            showError(
              `Couldn't switch to ${targetLabel}: ${msg}. Staying on ${labelForMode(previous)}.`
            )
          }
          console.log(
            `[pronunciation-coach] reverted to ${r.model} (${labelForMode(previous)}) after switch failure`
          )
          return
        } catch (revertErr) {
          console.error(
            "[pronunciation-coach] revert to previous model also failed:",
            revertErr
          )
          // fall through to the unavailable state below
        }
      }
      hideOverlay()
      if (isCancel) {
        showError(`Switch to ${targetLabel} cancelled.`)
      } else if (code === "STT_UNAVAILABLE") {
        // Native speech-recognition lib didn't load on this device
        // (commonly x86_64 Chromebook via ARC where libhoudini can't
        // translate whisper.cpp's armv8.2-a SIMD intrinsics). No
        // model would ever load here — surface the device-class
        // limitation honestly and stop offering downloads.
        showError(
          `Parlometron needs on-device speech recognition that isn't available on this device. ` +
            `It works on iPhone, iPad, and most Android phones — Chromebooks running Android in ARC ` +
            `aren't supported yet.`
        )
      } else if (code === "MODEL_NOT_INSTALLED") {
        showError(
          `${targetLabel} model isn't fully installed (likely a partial download). Tap the model badge to reinstall.`
        )
      } else if (code === "NETWORK") {
        showError(
          `${targetLabel} needs internet to finish setting up. Reconnect and try again.`
        )
      } else if (code === "INSUFFICIENT_MEMORY") {
        showError(
          `Not enough memory to load ${targetLabel}. Close other apps and restart Corpán, then try again.`
        )
      } else {
        showError(`Could not load ${targetLabel} model: ${msg}`)
      }
      micLabel.textContent = "Model unavailable"
    }
  }

  modeBtn.addEventListener("click", () => {
    openModelSetup().catch((err) => {
      console.error("[pronunciation-coach] openModelSetup threw:", err)
    })
  })

  // ---- Swipe gestures (bound once to the swipe area, follows the live
  // cardEl reference so it survives card-replacement during slideTo). ----
  let pointerActive = false
  let pointerStartX = 0
  let pointerStartY = 0
  let pointerStartT = 0
  let pointerCurX = 0
  let pointerCurY = 0
  let pointerLockedHorizontal = false
  let pointerLockedVertical = false
  let capturedPointerId: number | null = null
  // Set true when a swipe is committed so the synthesized click that
  // follows pointerup doesn't accidentally trigger "tap to hear".
  let suppressClick = false

  const speakCurrentPhrase = () => {
    if (!currentPhrase) return
    try {
      const r = hostApi.speak(
        currentPhrase.targetLang,
        currentPhrase.target.text
      )
      if (r && typeof (r as Promise<void>).catch === "function") {
        ;(r as Promise<void>).catch((err) => {
          console.error("[pronunciation-coach] speak phrase failed:", err)
        })
      }
    } catch (err) {
      console.error("[pronunciation-coach] speak phrase threw:", err)
    }
  }

  const isInteractiveTarget = (el: EventTarget | null): boolean => {
    if (!el || !(el instanceof Element)) return false
    return !!el.closest("button, input, textarea, select, a, [data-no-swipe]")
  }

  const swipeTarget = swipeAreaEl
  swipeTarget.addEventListener(
    "pointerdown",
    (e: PointerEvent) => {
      if (uiState === "scoring") return
      if (isInteractiveTarget(e.target)) return
      if (e.pointerType === "mouse" && e.button !== 0) return
      pointerActive = true
      pointerStartX = e.clientX
      pointerStartY = e.clientY
      pointerCurX = e.clientX
      pointerCurY = e.clientY
      pointerStartT = performance.now()
      pointerLockedHorizontal = false
      pointerLockedVertical = false
      capturedPointerId = null
      cardEl.classList.add("dragging")
    },
    { passive: true }
  )

  swipeTarget.addEventListener(
    "pointermove",
    (e: PointerEvent) => {
      if (!pointerActive) return
      pointerCurX = e.clientX
      pointerCurY = e.clientY
      const dx = pointerCurX - pointerStartX
      const dy = pointerCurY - pointerStartY
      if (!pointerLockedHorizontal && !pointerLockedVertical) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          pointerLockedHorizontal = true
          try {
            swipeTarget.setPointerCapture(e.pointerId)
            capturedPointerId = e.pointerId
          } catch {
            // ignore
          }
        } else if (Math.abs(dy) > 12) {
          pointerLockedVertical = true
        }
      }
      if (pointerLockedHorizontal) {
        const damped = dx * 0.9
        cardEl.style.transition = "none"
        cardEl.style.transform = `translateX(${damped}px) rotate(${
          damped * 0.01
        }deg)`
        cardEl.style.opacity = String(Math.max(0.4, 1 - Math.abs(dx) / 400))
      }
    },
    { passive: true }
  )

  const finishPointer = () => {
    if (!pointerActive) return
    pointerActive = false
    cardEl.classList.remove("dragging")

    if (capturedPointerId !== null) {
      try {
        swipeTarget.releasePointerCapture(capturedPointerId)
      } catch {
        // ignore
      }
      capturedPointerId = null
    }

    if (!pointerLockedHorizontal) {
      cardEl.style.transition = "transform 200ms ease, opacity 200ms ease"
      cardEl.style.transform = ""
      cardEl.style.opacity = ""
      return
    }

    const dx = pointerCurX - pointerStartX
    const dt = Math.max(1, performance.now() - pointerStartT)
    const v = Math.abs(dx) / dt
    const passDistance = Math.abs(dx) >= SWIPE_THRESHOLD_PX
    const passVelocity = v >= SWIPE_VELOCITY_PX_PER_MS
    if (passDistance || passVelocity) {
      suppressClick = true
      // Failsafe: clear after a delay in case no synthetic click fires.
      window.setTimeout(() => {
        suppressClick = false
      }, 500)
      if (dx < 0) {
        goNext().catch((err) =>
          console.error("[pronunciation-coach] swipe-next failed:", err)
        )
      } else if (historyIdx > 0) {
        goPrev().catch((err) =>
          console.error("[pronunciation-coach] swipe-prev failed:", err)
        )
      } else {
        cardEl.style.transition = "transform 220ms ease, opacity 220ms ease"
        cardEl.style.transform = ""
        cardEl.style.opacity = ""
      }
    } else {
      cardEl.style.transition = "transform 220ms ease, opacity 220ms ease"
      cardEl.style.transform = ""
      cardEl.style.opacity = ""
    }
  }

  swipeTarget.addEventListener("pointerup", finishPointer, { passive: true })
  swipeTarget.addEventListener("pointercancel", finishPointer, {
    passive: true,
  })

  // ---- Tap the target phrase (or its romanization) to hear it via TTS.
  // Uses event delegation on the deck so it survives card replacement
  // during slide animations. Suppressed for the click that browsers
  // synthesize after a real swipe gesture. ---- */
  deckEl.addEventListener("click", (e) => {
    if (suppressClick) {
      suppressClick = false
      return
    }
    const t = e.target as HTMLElement | null
    if (!t) return
    if (t.closest("button, input, a")) return
    if (!t.closest(".pc-target, .pc-romanization")) return
    speakCurrentPhrase()
  })

  // ---- Keyboard nav (arrow keys / Esc) for desktop & external keyboards ----
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      goPrev().catch((err) =>
        console.error("[pronunciation-coach] arrow-left failed:", err)
      )
    } else if (e.key === "ArrowRight") {
      goNext().catch((err) =>
        console.error("[pronunciation-coach] arrow-right failed:", err)
      )
    } else if (e.key === "Escape") {
      dispatchExit()
    } else if (e.key === " " || e.code === "Space") {
      // Hold-to-speak parity for desktop: spacebar DOWN starts, UP stops.
      // Ignore keydown auto-repeat so we only start once while held.
      e.preventDefault()
      if (e.repeat) return
      if (uiState === "idle" && modelReady && currentPhrase) {
        startRecording().catch((err) =>
          console.error("[pronunciation-coach] space-start failed:", err)
        )
      }
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " " || e.code === "Space") {
      e.preventDefault()
      if (uiState === "recording") {
        stopRecording().catch((err) =>
          console.error("[pronunciation-coach] space-stop failed:", err)
        )
      }
    }
  }
  window.addEventListener("keydown", onKeyDown)
  window.addEventListener("keyup", onKeyUp)

  // ---- Long-press on the language badge → Whisper tuner ----
  // The badge is a small uppercase base-language code rendered inside
  // the card by `langBadgeHtmlFor()`. Long-press (700 ms, no drag)
  // opens the per-language whisper-param tuner. Delegated on the pack
  // container so it survives card swaps; cleaned up when unmount wipes
  // container.innerHTML.
  const LONG_PRESS_MS = 700
  const LONG_PRESS_MOVE_PX = 8
  let lpTimer: number | null = null
  let lpStart: { x: number; y: number } | null = null
  let lpTargetLang: string | null = null
  const cancelLongPress = () => {
    if (lpTimer !== null) {
      window.clearTimeout(lpTimer)
      lpTimer = null
    }
    lpStart = null
    lpTargetLang = null
  }
  // Named handlers (not inline) so unmount can remove them. Clearing
  // `container.innerHTML` strips children but not listeners on the
  // container itself; without explicit removal, remounting Practice
  // would accumulate duplicate handlers and fire openTuner twice for
  // one long-press.
  const onLpPointerDown = (e: PointerEvent) => {
    const t = (e.target as HTMLElement | null)?.closest?.(
      "[data-pc-lang-badge]"
    ) as HTMLElement | null
    if (!t) return
    const lang = t.getAttribute("data-pc-lang") || ""
    if (!lang) return
    lpStart = { x: e.clientX, y: e.clientY }
    lpTargetLang = lang
    lpTimer = window.setTimeout(() => {
      lpTimer = null
      if (lpTargetLang && !disposed) {
        openTuner(lpTargetLang)
      }
      lpTargetLang = null
      lpStart = null
    }, LONG_PRESS_MS)
  }
  const onLpPointerMove = (e: PointerEvent) => {
    if (!lpStart) return
    const dx = e.clientX - lpStart.x
    const dy = e.clientY - lpStart.y
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_PX) cancelLongPress()
  }
  container.addEventListener("pointerdown", onLpPointerDown)
  container.addEventListener("pointermove", onLpPointerMove)
  container.addEventListener("pointerup", cancelLongPress)
  container.addEventListener("pointercancel", cancelLongPress)

  // ---- Restore from localStorage if available ----
  const restoreFromStorage = (): boolean => {
    const saved = loadSavedState(storage)
    if (!saved) return false
    // NOTE: do NOT mutate `modelMode` here. `boot()` already loaded the
    // saved mode via `savedEarly` at the top of the boot pipeline and
    // may have replaced it with the user's just-completed setup choice
    // (e.g. "advanced" → "standard" after the user installs a different
    // model in the setup overlay). Re-reading saved.mode here races with
    // the in-flight `prepareWithRecovery(modelMode)` from boot's
    // `Promise.all`, and clobbers the live mode with a stale persisted
    // value — which then makes the boot catch handler wipe the WRONG
    // model and re-prepare the WRONG model.
    if (!saved.phrases || saved.phrases.length === 0) return false
    streak = Math.max(0, Math.floor(saved.streak))
    history.length = 0
    for (const sp of saved.phrases) {
      history.push(savedToPhrase(sp))
    }
    const idx = Math.max(0, Math.min(history.length - 1, saved.idx))
    historyIdx = idx
    currentPhrase = history[idx]
    if (currentPhrase) renderCurrentPhrase()
    updateStreak()
    return true
  }

  // ---- Boot ----
  const loadFirstPhrase = async () => {
    const cfg = hostApi.getStackConfig()
    if (!cfg.languages || cfg.languages.length < 1) {
      renderUnavailableCard(
        tt("noLanguageSelected"),
        tt("chooseLanguageToStudy")
      )
      return
    }
    if (!stackHasScorableLang(cfg.languages)) {
      renderUnavailableCard(
        tt("scoringUnavailableTitle"),
        tt("scoringUnavailableSub")
      )
      return
    }

    // If we restored a session from storage, just kick off a prefetch and
    // skip fetching a fresh first phrase.
    if (restoreFromStorage()) {
      console.log(
        `[pronunciation-coach] restored ${history.length} phrase(s) from storage; idx=${historyIdx}, streak=${streak}`
      )
      prefetchInBackground()
      return
    }

    try {
      const phrase = await fetchOneEntry()
      if (disposed) return
      if (!phrase) {
        showError(tt("noPhrasesAvailable"))
        return
      }
      history.push(phrase)
      historyIdx = 0
      currentPhrase = phrase
      // The first phrase of a fresh session (no restorable history) is itself a
      // new acquisition — meter it so the boot phrase counts toward the daily
      // cap, same as any Next. Returning users restore history above and never
      // reach here, so reopening doesn't re-spend.
      paywallGate.note()
      renderCurrentPhrase()
      persist()
      prefetchInBackground()
    } catch (err) {
      console.error("[pronunciation-coach] loadFirstPhrase failed:", err)
      currentPhrase = null
      showError(
        tt("errLoadPhrase", { error: formatErr(err) })
      )
      micBtn.disabled = true
      micLabel.textContent = "—"
    }
  }

  // ---------------------------------------------------------------------
  // Setup / onboarding flow
  //
  // The recording UI never downloads a model. If the chosen model isn't
  // installed-and-verified on disk, we replace the recording shell with
  // a setup screen where the user explicitly picks Standard or Advanced
  // and watches it install. Only after verification do we restore the
  // recording shell and call prepare() (load-only).
  // ---------------------------------------------------------------------
  type SetupOutcome =
    | { kind: "selected"; mode: ModelMode } // user picked or installed a model
    | { kind: "cancelled" } // user closed setup with no change (an active model still exists)
    | { kind: "exit" } // user closed setup with no model installed (kicks back to host)

  /**
   * Setup / settings overlay. Doubles as:
   *   - first-time onboarding (no `currentActive`) — close exits the pack.
   *   - ongoing settings (with `currentActive`) — close dismisses back.
   * Each model card shows live state: Active, Installed, Not installed.
   * Buttons differ per state: Install / Use this / Reinstall / Remove.
   */
  const runSetup = (opts: {
    currentActive: ModelMode | null
    headline: string
    sub: string
  }): Promise<SetupOutcome> =>
    new Promise((resolve) => {
      let { currentActive } = opts
      const setupRoot = document.createElement("div")
      setupRoot.className = "pc-setup-root"
      setupRoot.innerHTML = `
        <div class="pc-backdrop"></div>
        <div class="pc-setup">
          <div class="pc-setup-header">
            <div class="pc-subtitle">Speech Models</div>
            <button class="pc-close" id="pc-setup-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="pc-setup-body">
            <h1 class="pc-setup-headline">${escapeHtml(opts.headline)}</h1>
            <p class="pc-setup-sub">${escapeHtml(opts.sub)}</p>

            ${visibleModels().map((m) => {
              // visibleModels() filters out variants flagged
              // `requiresLargeMemory: true` on devices that don't
              // pass `hasLargeMemoryBudget()` — iPhone-class iOS,
              // sub-flagship Android, etc. Hard data: 626 / 632 /
              // 1600 MB Whisper variants OOM-kill the app during
              // transcribe on iPhone Pro Max (~5 GB per-app jetsam
              // ceiling) even though each model loads cleanly.
              // Hiding the card means the user can't pick a model
              // that will crash their device. iPad Pro and ≥8 GB
              // Android phones see the full lineup.
              //
              // Format size label: under 1000 MB → "~NNN MB"; 1000+ →
              // "~N.N GB" so the lineup reads cleanly across two
              // orders of magnitude.
              const sizeLabel =
                m.approxSizeMB >= 1000
                  ? `~${(m.approxSizeMB / 1000).toFixed(1)} GB`
                  : `~${m.approxSizeMB} MB`
              return `
            <div class="pc-setup-card" data-mode="${m.id}">
              <div class="pc-setup-card-head">
                <div>
                  <div class="pc-setup-card-name">${escapeHtml(m.label)} <span class="pc-setup-card-status" data-status="${m.id}"></span></div>
                  <div class="pc-setup-card-meta">${sizeLabel}</div>
                </div>
                <div class="pc-setup-card-actions" data-actions="${m.id}"></div>
              </div>
              <div class="pc-setup-card-desc">${escapeHtml(m.shortDesc)}</div>
              <div class="pc-setup-card-procon">
                <ul class="pc-setup-card-pros">
                  ${m.pros.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}
                </ul>
                <ul class="pc-setup-card-cons">
                  ${m.cons.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
                </ul>
              </div>
              <div class="pc-setup-card-techid" title="Underlying model file (whisper.cpp ggml format)">${escapeHtml(m.folder)}</div>
              <div class="pc-setup-progress" data-progress="${m.id}" hidden>
                <div class="pc-setup-progress-bar"><div class="pc-setup-progress-fill"></div></div>
                <div class="pc-setup-progress-label">Preparing…</div>
              </div>
            </div>`
            }).join("")}

            <div class="pc-setup-error" id="pc-setup-error" hidden></div>
            <div class="pc-setup-note">
              Models live on your device under the app's data folder. They never leave your device. You can switch or remove them anytime from this screen.
            </div>
          </div>
        </div>
      `
      container.appendChild(setupRoot)

      // Model downloads need internet. Mount an inline offline notice
      // between the headline and the model cards so the user understands
      // why install buttons may not respond. The notice swaps in/out live
      // as airplane mode toggles.
      const setupBody = setupRoot.querySelector<HTMLDivElement>(".pc-setup-body")
      const firstCard = setupRoot.querySelector<HTMLElement>(".pc-setup-card")
      let offlineNoticeEl: HTMLElement | null = null
      const renderOfflineNotice = () => {
        if (isOnline()) {
          if (offlineNoticeEl) {
            offlineNoticeEl.remove()
            offlineNoticeEl = null
          }
          return
        }
        if (offlineNoticeEl || !setupBody) return
        const notice = createOfflineNotice({
          title: "Model downloads need internet",
          subtitle:
            "Already-installed models still work. Reconnect to install or reinstall a model.",
        })
        offlineNoticeEl = notice.element
        offlineNoticeEl.style.marginBottom = "12px"
        if (firstCard && firstCard.parentNode === setupBody) {
          setupBody.insertBefore(offlineNoticeEl, firstCard)
        } else {
          setupBody.appendChild(offlineNoticeEl)
        }
      }
      renderOfflineNotice()
      // The network listener that re-renders both the offline notice and
      // the action buttons gets registered below, after `renderActions`
      // is defined.
      let offNetworkChange: () => void = () => { }

      const errorEl = setupRoot.querySelector<HTMLDivElement>("#pc-setup-error")!
      // Two-tier install state. Source-of-truth precedence:
      //   1. Active model in this session: true (kit is in memory —
      //      live truth, not a cache).
      //   2. Otherwise null = unknown → "Checking…" skeleton until
      //      refreshInstallState() resolves it via plugin validateModel.
      // We deliberately do NOT seed from a localStorage hint cache.
      // A wrong hint led to phantom "Use this" buttons that bypassed
      // the install path entirely.
      const installed: Record<string, boolean | null> = Object.fromEntries(
        visibleModels().map((m) => [m.id, m.id === currentActive ? true : null])
      )
      let installing: ModelMode | null = null

      const setProgressVisible = (mode: ModelMode, visible: boolean) => {
        const wrap = setupRoot.querySelector<HTMLDivElement>(
          `[data-progress="${mode}"]`
        )
        if (wrap) wrap.hidden = !visible
      }
      const setProgress = (
        mode: ModelMode,
        fraction: number,
        label: string
      ) => {
        const wrap = setupRoot.querySelector<HTMLDivElement>(
          `[data-progress="${mode}"]`
        )
        if (!wrap) return
        const fill = wrap.querySelector<HTMLDivElement>(".pc-setup-progress-fill")
        if (fill) {
          fill.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`
        }
        const labelEl = wrap.querySelector<HTMLDivElement>(
          ".pc-setup-progress-label"
        )
        if (labelEl) labelEl.textContent = label
      }

      const cleanup = () => {
        offNetworkChange()
        if (setupRoot.parentNode) setupRoot.parentNode.removeChild(setupRoot)
      }

      const renderActions = () => {
        for (const m of MODELS) {
          const mode = m.id
          const status = setupRoot.querySelector<HTMLSpanElement>(
            `[data-status="${mode}"]`
          )
          const actions = setupRoot.querySelector<HTMLDivElement>(
            `[data-actions="${mode}"]`
          )
          if (!status || !actions) continue
          const isActive = currentActive === mode
          const isInstalling = installing === mode
          // Active model is installed by definition (WhisperKit has it
          // loaded). Trust that over any disk-probe answer, including
          // a `null` initial state — the active card never renders as
          // "Checking…" or "Install".
          const isInstalled = isActive ? true : installed[mode]
          const isUnknown = isInstalled === null && !isActive && !isInstalling

          status.textContent = isInstalling
            ? "Installing…"
            : isActive
              ? "Active"
              : isUnknown
                ? "Checking…"
                : isInstalled
                  ? "Installed"
                  : "Not installed"
          status.dataset.state = isInstalling
            ? "installing"
            : isActive
              ? "active"
              : isUnknown
                ? "checking"
                : isInstalled
                  ? "installed"
                  : "absent"

          actions.innerHTML = ""
          if (isInstalling) continue
          // Don't render any action buttons until validateModel has
          // returned — that's the source of the "flash of Install"
          // bug. Skeleton state shows "Checking…" with no buttons.
          if (isUnknown) continue

          const mkBtn = (
            label: string,
            kind: "primary" | "ghost" | "danger",
            onClick: () => void,
            opts: { disabled?: boolean } = {}
          ) => {
            const b = document.createElement("button")
            b.type = "button"
            b.className = `pc-setup-btn pc-setup-btn-${kind}`
            b.textContent = label
            if (opts.disabled) b.disabled = true
            b.addEventListener("click", onClick)
            actions.appendChild(b)
          }

          // Install / Reinstall need internet. Disable them offline so
          // taps don't kick off doomed downloads — the offline notice
          // already explains why. Remove/Use-this work fine offline.
          const networkBlocked = !isOnline()

          if (!isInstalled) {
            mkBtn(
              "Install",
              "primary",
              () => {
                console.log(`[pronunciation-coach] CLICK Install mode=${mode}`)
                startInstall(mode)
              },
              { disabled: networkBlocked }
            )
          } else if (isActive) {
            // Active and installed — no buttons. The model is loaded;
            // there's nothing for the user to do here.
          } else {
            mkBtn("Use this", "primary", () => {
              console.log(`[pronunciation-coach] CLICK Use-this mode=${mode}`)
              useInstalled(mode)
            })
            mkBtn(
              "Reinstall",
              "ghost",
              () => {
                console.log(`[pronunciation-coach] CLICK Reinstall mode=${mode}`)
                startInstall(mode, true)
              },
              { disabled: networkBlocked }
            )
            mkBtn("Remove", "danger", () => {
              console.log(`[pronunciation-coach] CLICK Remove mode=${mode}`)
              removeModel(mode)
            })
          }
        }
      }

      // Hook up the network listener now that renderActions exists.
      // Airplane-mode toggles swap the offline notice in/out and re-disable
      // the Install/Reinstall buttons in real time.
      offNetworkChange = onNetworkChange(() => {
        renderOfflineNotice()
        renderActions()
      })

      const refreshInstallState = async () => {
        // We deliberately do NOT use listInstalled here. validateModel
        // is reliable on every shipped host bridge; listInstalled may
        // not be wired and an older host binary can fail-open with
        // synthetic "all invalid" responses that hide working
        // installs (the bug that surfaced in 0.1.0 dev where Standard
        // was loaded and active but the overlay showed an "Install"
        // button). Two validateModel calls is cheap; truth wins over
        // round-trip count.
        if (!stt?.validateModel) return
        for (const m of MODELS) {
          // The currently-active model is installed by definition:
          // the native context has it loaded. Skip validateModel for it; the
          // heuristic has been observed reporting "<model dir missing>"
          // for models that prepare() then loads successfully (the
          // fundamental bug that motivated this whole rebuild). We trust
          // the in-session ground truth ("currentActive") over a disk
          // probe that may use a different path resolution than
          // WhisperKit itself does.
          if (currentActive === m.id) {
            installed[m.id] = true
            continue
          }
          try {
            const v = await stt.validateModel({ model: m.folder })
            installed[m.id] = v.valid
          } catch (err) {
            console.error(
              `[pronunciation-coach] validate ${m.id} failed:`,
              err
            )
            installed[m.id] = false
          }
        }
        renderActions()
      }

      const useInstalled = (mode: ModelMode) => {
        cleanup()
        resolve({ kind: "selected", mode })
      }

      const removeModel = async (mode: ModelMode) => {
        if (installing || !stt?.wipeModel) return
        console.log(
          `[pronunciation-coach] removeModel: mode=${mode} folder=${folderForMode(mode)} currentActive=${currentActive ?? "null"} installed[${mode}]=${installed[mode]}`
        )
        const before = installed[mode]
        installing = mode
        renderActions()
        errorEl.hidden = true
        try {
          await stt.wipeModel({ model: folderForMode(mode) })
          installed[mode] = false
          if (currentActive === mode) currentActive = null
        } catch (err) {
          installed[mode] = before
          const msg = formatErr(err)
          errorEl.textContent = `Remove failed: ${msg}`
          errorEl.hidden = false
        } finally {
          installing = null
          renderActions()
        }
      }

      const startInstall = async (mode: ModelMode, isReinstall = false) => {
        if (installing || disposed || !stt?.installModel) return
        installing = mode
        errorEl.hidden = true
        errorEl.textContent = ""
        renderActions()
        setProgressVisible(mode, true)

        // Reinstall = explicit wipe + fresh download. Without the
        // wipe, the plugin's `installModel` short-circuits at its
        // validateModel check ("already installed (validateModel
        // ok)") because validateModel only inspects file presence +
        // size > 1 KB, not actual on-disk integrity — so a corrupt
        // `.mlmodelc/weights/weight.bin` that mmap-fails at runtime
        // would still pass validation and Reinstall would do
        // nothing. Wiping first guarantees fresh bytes from the
        // network, which is what the user clicked Reinstall for.
        // First-time installs (`isReinstall` false) skip the wipe
        // since there's nothing to wipe.
        if (isReinstall && stt?.wipeModel) {
          setProgress(mode, 0, "Wiping previous install…")
          try {
            await stt.wipeModel({ model: folderForMode(mode) })
          } catch (err) {
            console.warn(
              `[pronunciation-coach] pre-reinstall wipe failed (continuing):`,
              err
            )
          }
        }
        setProgress(mode, 0, "Starting…")

        try {
          const installResult = await stt.installModel(
            {
              model: folderForMode(mode),
              downloadUrl: modelById(mode)?.downloadUrl,
            },
            (event) => {
              if (event.model !== folderForMode(mode)) return
              if (event.phase === "downloading") {
                const pct = Math.round((event.fraction ?? 0) * 100)
                let label = `Downloading ${pct}%`
                // whisper.cpp era: single-file ggml-*.bin downloads
                // via URLSession, so `completed` / `total` are bytes.
                // Show MB; raw byte counts are unreadable (a Medium
                // download is ~1.5 billion bytes).
                if (event.completed != null && event.total && event.total > 0) {
                  const mb = (n: number) => (n / (1024 * 1024)).toFixed(0)
                  label += ` · ${mb(event.completed)} / ${mb(event.total)} MB`
                }
                setProgress(mode, event.fraction ?? 0, label)
              } else if (event.phase === "verifying") {
                setProgress(mode, 1, "Verifying download…")
              } else if (event.phase === "verified") {
                setProgress(mode, 1, "Verified ✓")
              } else if (event.phase === "failed") {
                setProgress(mode, 0, `Failed: ${event.error ?? "unknown"}`)
              }
            }
          )
          if (disposed) return
          installed[mode] = true
          installing = null
          const settleMs =
            installResult.alreadyInstalled ? 0 : postInstallSettleMs(mode)
          if (settleMs > 0) {
            setProgress(mode, 1, "Finalizing…")
            await delay(settleMs)
            if (disposed) return
          }
          setProgress(mode, 1, "Verified")
          await delay(300)
          if (disposed) return
          cleanup()
          resolve({ kind: "selected", mode })
        } catch (err) {
          installing = null
          setProgressVisible(mode, false)
          const msg = formatErr(err)
          const code = errCode(err)
          console.error(
            `[pronunciation-coach] install ${mode} failed (code=${code ?? "—"}):`,
            msg
          )
          // STT_UNAVAILABLE means there's no .so for this device's
          // ABI — no model would ever load. Give the user the
          // device-class explanation directly rather than the raw
          // "DOWNLOAD_FAILED: …" string they'd otherwise see.
          if (code === "STT_UNAVAILABLE") {
            errorEl.textContent =
              "Parlometron needs on-device speech recognition that isn't available on this device. " +
              "Try Parlometron on iPhone, iPad, or an Android phone."
          } else {
            errorEl.textContent = `Install failed: ${msg}`
          }
          errorEl.hidden = false
          // Critical: install can drop the previously loaded native
          // context while replacing files. If install fails here, the
          // previously-active model may be nil'd in memory even though
          // its files and marker are intact on disk. Re-prepare it so
          // the user can keep using it.
          if (currentActive && currentActive !== mode && stt?.prepare) {
            try {
              const r = await stt.prepare({
                model: folderForMode(currentActive),
              })
              if (r.ready) {
                console.log(
                  `[pronunciation-coach] restored ${currentActive} model after ${mode} install failed`
                )
              }
            } catch (restoreErr) {
              console.error(
                `[pronunciation-coach] kit restore after ${mode} install failure threw:`,
                restoreErr
              )
            }
          }
          renderActions()
        }
      }

      const closeBtnLocal = setupRoot.querySelector<HTMLButtonElement>(
        "#pc-setup-close"
      )
      closeBtnLocal?.addEventListener("click", () => {
        if (installing) return // can't close mid-install
        cleanup()
        if (currentActive && installed[currentActive]) {
          resolve({ kind: "cancelled" })
        } else {
          // No usable model installed. Setup must complete; back out to host.
          dispatchExit()
          resolve({ kind: "exit" })
        }
      })

      // Pre-select visually + populate state.
      if (currentActive) {
        const card = setupRoot.querySelector(`[data-mode="${currentActive}"]`)
        card?.classList.add("pc-setup-card-suggested")
      }
      renderActions()
      refreshInstallState().catch((err) => {
        console.error(
          "[pronunciation-coach] refreshInstallState threw:",
          err
        )
      })
    })

  const boot = async () => {
    showOverlay("Checking models…")
    let available: boolean
    try {
      available = await stt.isAvailable()
    } catch (err) {
      // The bridge call itself failed — this is qualitatively different
      // from "the plugin says no". Show the user the real error so the
      // failure mode isn't a flat "unavailable" screen with no clue.
      console.error("[pronunciation-coach] stt.isAvailable bridge call threw:", err)
      if (disposed) return
      hideOverlay()
      renderUnavailable(
        "Speech recognition bridge failed",
        `The native speech-recognition plugin returned an error: ${String(err)}`
      )
      return
    }
    if (disposed) return
    if (!available) {
      hideOverlay()
      renderUnavailable()
      return
    }

    // Read this device's per-app memory budget BEFORE anything else
    // touches modelMode or the setup overlay. The budget gates which
    // model variants are safe to offer — Large / Advanced get hidden
    // on iPhone-class budgets (~5 GB) where their first-transcribe
    // spike OOM-kills the app. `navigator.userAgent` reports "iPad"
    // on devices that can't actually run those models (Stage Manager
    // iPads, older iPads), so we use the actual jetsam budget from
    // `os_proc_available_memory()` exposed via `stt.getStatus()`.
    try {
      const status = await stt.getStatus()
      setDeviceMemoryBudget(
        status.availableMemoryMB ?? null,
        status.physicalMemoryMB ?? null,
      )
      console.log(
        `[pronunciation-coach] device memory budget: available=${status.availableMemoryMB ?? "?"}MB physical=${status.physicalMemoryMB ?? "?"}MB raw=${JSON.stringify(status)}`
      )
    } catch (err) {
      console.warn(
        "[pronunciation-coach] getStatus failed; using conservative budget (Large variants hidden):",
        err
      )
    }

    // Pick the saved mode if any. localStorage holds preference; disk
    // truth is decided by whether prepare() can load the model. We do
    // NOT pre-check via validateModel — it's a heuristic on a
    // directory layout we don't fully control, and we've seen it
    // report "missing" on models that prepare() then loads
    // successfully. The only definition of "installed" that matters
    // is "the native runtime can load it right now".
    const savedEarly = loadSavedState(storage)
    if (savedEarly?.mode && modelById(savedEarly.mode)) {
      modelMode = savedEarly.mode
    }
    // Boot-time demotion: if the user's saved mode is a
    // large-memory-only variant (Large / Large Turbo / etc.) and
    // we're running on a device that doesn't pass the memory gate,
    // replace it with the visible default (Small) before anything
    // else touches modelMode. Without this, the boot path would
    // prepare a memory-gated model on a too-small device and
    // OOM-kill the app on first transcribe — exactly the failure
    // mode the requiresLargeMemory gate is designed to prevent.
    // The card was
    // already hidden from the setup overlay, but a stale
    // localStorage entry from a previous install (or a user who
    // upgraded from a build that allowed iPhone to pick those
    // models) would otherwise sneak through. Only triggers on
    // actual mismatch — iPad users keep their saved mode.
    const savedModelEntry = modelById(modelMode)
    if (savedModelEntry && variantExceedsBudget(savedModelEntry)) {
      const safe = visibleDefaultModel().id
      console.warn(
        `[pronunciation-coach] saved model "${modelMode}" exceeds this device's memory budget; demoting to "${safe}"`
      )
      modelMode = safe
    }

    renderModeButton()
    // Paint the lower-right quota readout immediately at boot, before the
    // model finishes loading (setUiState refreshes it on every transition
    // thereafter). No-op for subscribers.
    updateQuotaBadge()
    // Larger models can spend real time on first native initialization.
    // Surface the wait honestly so users don't think the app froze.
    // Threshold (~300 MB) chosen so Standard / Small skip the warning
    // but Medium / Large / Advanced get it.
    const bootModelLabel = labelForMode(modelMode)
    const bootIsLargeModel = (modelById(modelMode)?.approxSizeMB ?? 0) >= 300
    showOverlay(
      bootIsLargeModel
        ? `Loading ${bootModelLabel} model… first load can take ~1 minute for large models. Subsequent launches are faster.`
        : `Loading ${bootModelLabel} model…`
    )
    micLabel.textContent = bootIsLargeModel
      ? `Loading ${bootModelLabel} model… (first time can take ~1 minute)`
      : `Loading ${bootModelLabel} model…`

    const bootTargetMode: ModelMode = modelMode

    // Try the saved model directly. prepare() is the source of truth:
    //   ready=true                          → loaded; we're done.
    //   code=MODEL_NOT_INSTALLED            → genuinely not on disk; open setup.
    //   code=NETWORK                        → tokenizer fetch failed; the
    //                                         model bytes are fine, surface
    //                                         a banner and let the user
    //                                         retry without losing files.
    //   code=LOAD_FAILED / other            → bytes failed to load; open
    //                                         setup so user can reinstall.
    let prepareErr: unknown = null
    let prepareCode: SttErrorCode | undefined
    try {
      await Promise.all([
        tryPrepareOnce(stt, folderForMode(bootTargetMode), {
          timeoutMs: prepareTimeoutMs(bootTargetMode),
          label: `Loading ${labelForMode(bootTargetMode)} model`,
        }).then((r) => {
          modelReady = true
          console.log(
            `[pronunciation-coach] Whisper prepared: ${r.model} (${labelForMode(bootTargetMode)})`
          )
        }),
        loadFirstPhrase(),
      ])
    } catch (err) {
      prepareErr = err
      prepareCode = errCode(err)
      console.error(
        `[pronunciation-coach] boot prepare failed (code=${prepareCode ?? "—"}):`,
        formatErr(err)
      )
      // Stale-plugin detection: the new plugin always emits a structured
      // `code` on prepare failures. If we got a failure with no code AND
      // the message looks like the heuristic-validateModel false-negative
      // pattern, the iOS app is running an old plugin binary that lies
      // about disk state and destroys installs on every Install click.
      // Surface a loud, actionable warning so it doesn't get lost in the
      // log noise — this is the difference between "rebuild needed" and
      // "real bug".
      const msg = formatErr(err)
      if (!prepareCode && /<model dir missing>|Run install first/i.test(msg)) {
        console.warn(
          "%c[pronunciation-coach] STALE PLUGIN DETECTED",
          "background:#9333ea;color:#fff;padding:2px 6px;border-radius:4px;font-weight:600",
          "\nThe host app is running an old tauri-plugin-stt binary (no `code` field on errors, no marker file).",
          "\nValidateModel false-negatives in that build trigger destructive wipes on every Install click.",
          "\nFix: rebuild and reinstall the host app (cargo tauri ios dev / android dev) to pick up the marker-file fix.",
        )
      }
    }

    if (disposed) return

    if (modelReady && !prepareErr) {
      hideOverlay()
      setUiState("idle")
      return
    }

    // Prepare failed. Route on structured code; never auto-wipe.
    hideOverlay()
    const targetLabel = labelForMode(bootTargetMode)
    if (prepareCode === "STT_UNAVAILABLE") {
      // Native lib unavailable for this device's ABI — there's
      // literally no path to working speech recognition here.
      // Stop trying to load anything; show a clear "not for this
      // device" state so the user understands and goes back rather
      // than tapping things that can't work.
      showError(
        `Parlometron needs on-device speech recognition that isn't available on this device. ` +
          `Try Parlometron on iPhone, iPad, or an Android phone.`
      )
      micBtn.disabled = true
      micLabel.textContent = "Not supported on this device"
      return
    }
    if (prepareCode === "NETWORK") {
      showError(
        `${targetLabel} needs internet to finish setting up. Reconnect and tap the model badge to retry — your downloaded files are intact.`
      )
      micBtn.disabled = true
      micLabel.textContent = "Reconnect to load"
      return
    }
    if (prepareCode && prepareCode !== "MODEL_NOT_INSTALLED" && prepareCode !== "LOAD_FAILED") {
      showError(`Model failed to load: ${formatErr(prepareErr)}`)
      micBtn.disabled = true
      micLabel.textContent = "Model unavailable"
      return
    }
    // MODEL_NOT_INSTALLED → open setup silently. LOAD_FAILED → also
    // route to setup with a banner so the user can pick Reinstall.
    if (prepareCode === "LOAD_FAILED") {
      showError(
        `${targetLabel} model failed to load. Use Reinstall in setup if it keeps happening.`
      )
    }
    // Open the setup overlay; on selection it triggers a fresh prepare.
    micBtn.disabled = true
    micLabel.textContent = `Loading ${targetLabel} model…`
    openModelSetup().catch((e) => {
      console.error(
        "[pronunciation-coach] openModelSetup after boot prepare failure threw:",
        e
      )
    })
  }

  boot().catch((err) => {
    console.error("[pronunciation-coach] boot threw:", err)
  })

  return {
    unmount: () => {
      disposed = true
      unbindMicHold()
      // Cancels any active session AND releases the audio engine when a
      // session was ever opened (iOS mic-indicator rule, hostApi contract).
      recorder.dispose()
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      container.removeEventListener("pointerdown", onLpPointerDown)
      container.removeEventListener("pointermove", onLpPointerMove)
      container.removeEventListener("pointerup", cancelLongPress)
      container.removeEventListener("pointercancel", cancelLongPress)
      cancelLongPress()
      hideOverlay()
      teardownZoomBlock()
      container.innerHTML = ""
    },
  }
}

// Parlometron-era alias for the practice mount. Both names point at
// the same function — `mountGame` for legacy callers, `mountPractice`
// for the new mode router in `parlometron.ts`.
export { mountGame as mountPractice }
