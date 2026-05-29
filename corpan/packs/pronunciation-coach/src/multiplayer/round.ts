// Parlometron multiplayer — in-round screen.
//
// One phrase, N players (random order each round), up to 3 attempts
// each. Same visual language as solo practice mode: the `.pc-card`
// 3-row grid keeps the phrase pinned at a fixed vertical slot so
// scores/pills appearing above and below never push it around. The
// `.pc-mic` button lives in `.pc-stage` at the bottom and stays at
// the same screen position regardless of what's revealed in the
// card above.
//
// Multiplayer-specific chrome layered on top:
//   - 3-tries dots in `.pc-mic-wrap` so the current player can see
//     how many attempts remain.
//   - Pass-to-next chip in `.pc-stage` below the mic.
//   - Pass-the-device splash overlay between players.
//
// Reuses the same `stt.startSession` / `stopSession` plumbing as
// practice mode, including the per-language `whisperParams` profile
// from `whisperTuning.ts`. Round results come back via `onRoundDone`.

import type { EntryOut, HostApi, TranslationOut } from "../sdk/types"
import { mergeForLang } from "../whisperTuning"
import { mergeScoringForLangModel } from "../scoringTuning"
import { pmConfirm } from "./confirm"
// Silence auto-stop disabled in 0.6.1 — the native `audio_level`
// stream + `silenceWatcher.ts` state machine stay intact for a
// future re-wiring against a real VAD model, but RMS-thresholding
// was too unreliable across mic-gain / noise-floor / accent
// variance to ship as always-on. See pack CHANGELOG.
import {
  charSimilarity,
  isRTL,
  mergeApostropheWords,
  normalizeForCompare,
  tokenizeForPills,
  type SttWordTiming,
} from "../game"
import {
  advancePlayer,
  allPlayersFinishedRound,
  currentPlayer,
  finishRound,
  recordAttempt,
  save as saveState,
  startRound,
  MAX_ATTEMPTS_PER_PLAYER,
  type GameState,
  type RoundHistory,
} from "./state"

// Local STT contract (mirrors the solo pack's; kept inline so this
// module compiles without importing from game.ts beyond utilities).
type SttStartResult = { started: boolean; sessionId: string }
type SttTranscriptionResult = {
  sessionId: string
  text: string
  expectedText: string
  language: string
  whisperLanguage: string
  durationMs: number
  overallScore: number // 0..1
  transcriptScore: number
  likelihoodScore: number
  acousticScore: number
  freeText: string
  words: SttWordTiming[]
}
type SttApi = {
  startSession(opts: {
    sessionId: string
    language: string
    expectedText: string
    whisperParams?: import("../whisperTuning").WhisperParams
    scoringParams?: import("../scoringTuning").ScoringParams
  }): Promise<SttStartResult>
  stopSession(opts: { sessionId: string }): Promise<SttTranscriptionResult>
  cancelSession(opts: { sessionId: string }): Promise<void>
}

const TRANSCRIBE_TIMEOUT_MS = 90_000

const newSessionId = (): string =>
  `pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// Use for values interpolated into double-quoted HTML attributes
// (e.g. `aria-label="…"`). `escapeHtml` alone does NOT escape `"`,
// which would let a value containing a quote break out of the
// attribute. Phrase strings come from our DB so the practical risk
// today is low — but cheap to do correctly.
const escapeAttr = (s: string): string =>
  escapeHtml(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;")

const whisperLang = (lang: string): string => {
  if (!lang) return "en"
  return lang.split("-")[0].toLowerCase()
}

const withTimeout = async <T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const pickTargetTranslation = (
  entry: EntryOut,
  languages: string[],
): { target: TranslationOut | null; native: TranslationOut | null } => {
  // Single-language stack: everyone practises the one language; no gloss.
  if (languages.length <= 1) {
    const only = languages[0]
    const target = only
      ? entry.translations.find((t) => t.language_code === only) ?? null
      : null
    return { target, native: null }
  }
  // languages[0] is native (gloss / anchor / UI); the rest are target
  // slots. For multiplayer the phrase has to be the same across all
  // players in the round, but the target *language* gets shuffled
  // every round so a 9-language stack doesn't get stuck on ES forever.
  const native =
    languages.length > 0
      ? entry.translations.find((t) => t.language_code === languages[0]) ??
        null
      : null
  const candidates: TranslationOut[] = []
  for (const lang of languages.slice(1)) {
    const t = entry.translations.find((tr) => tr.language_code === lang)
    if (t) candidates.push(t)
  }
  const target =
    candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : null
  return { target, native }
}

export type RoundOpts = {
  container: HTMLElement
  hostApi: HostApi
  game: GameState
  /** Called once `finishRound` has run — caller transitions to the
   *  results screen. */
  onRoundDone: (round: RoundHistory) => void
  /** Quit current game and return to mode picker. */
  onQuit: () => void
}

export type RoundHandle = { unmount: () => void }

type UiState =
  | "loading"
  | "passing" // splash between players: "Pass the device to {Name}"
  | "ready" // current player ready to record
  | "recording"
  | "scoring"
  | "result" // last attempt's score visible

export const mountRound = (opts: RoundOpts): RoundHandle => {
  const stt = (opts.hostApi as unknown as { stt?: SttApi }).stt
  if (!stt) {
    opts.container.innerHTML = `
      <div class="pc-pm-root pc-pm-error">
        <p>Whisper STT is not available on this device.</p>
        <button class="pc-pm-start" data-pm-quit>Back</button>
      </div>`
    opts.container
      .querySelector<HTMLButtonElement>("[data-pm-quit]")
      ?.addEventListener("click", opts.onQuit)
    return { unmount: () => (opts.container.innerHTML = "") }
  }

  let disposed = false
  let uiState: UiState = "loading"
  let activeSessionId: string | null = null
  let phraseTarget: TranslationOut | null = null
  let phraseNative: TranslationOut | null = null
  let lastResult: SttTranscriptionResult | null = null
  /** Transient one-line error to show in the banner slot when
   *  scoring fails. Read + cleared by `renderResultSlots`. The catch
   *  block in `stopRecording` used to set `banner.innerHTML`
   *  imperatively, but `refresh()`'s renderer wiped it because the
   *  `uiState !== "result"` branch clears the banner. Route the
   *  message through state instead. */
  let lastErrorMessage: string | null = null

  // Build the static shell once. State changes mutate the inner
  // pieces (mic class, label, dots, result slots) but the OUTER
  // layout — header / card / stage — never re-renders. That's the
  // key to "nothing pushes the mic around": the mic is in a fixed
  // slot of a layout that doesn't shift.
  const buildShell = () => {
    opts.container.innerHTML = `
      <div class="pc-pm-root pc-pm-round">
        <header class="pc-pm-head">
          <div class="pc-pm-head-eyebrow-row">
            <span class="pc-pm-eyebrow" data-pm-eyebrow></span>
          </div>
          <div class="pc-pm-head-action-row">
            <button class="pc-pm-back" data-pm-quit aria-label="Quit game">‹</button>
            <span class="pc-pm-headline" data-pm-headline></span>
            <div class="pc-pm-head-spacer pc-pm-turn-indicator" data-pm-turn></div>
          </div>
        </header>

        <div class="pc-pm-deck">
          <div class="pc-card pc-pm-card">
            <div class="pc-card-above">
              <div class="pc-result-banner" data-pm-banner hidden></div>
              <div class="pc-result-transcript-up" data-pm-transcript hidden></div>
            </div>
            <div class="pc-card-center">
              <h1 class="pc-target" data-pm-target>Loading…</h1>
              <p class="pc-romanization" data-pm-roman hidden></p>
              <p class="pc-native" data-pm-native hidden></p>
            </div>
            <div class="pc-card-below">
              <div class="pc-result-detail" data-pm-detail hidden></div>
            </div>
          </div>
        </div>

        <div class="pc-stage">
          <div class="pc-mic-wrap">
            <button class="pc-mic" data-pm-mic disabled>
              <span data-pm-mic-icon>●</span>
            </button>
            <div class="pc-mic-label" data-pm-mic-label>Loading…</div>
            <div class="pc-pm-tries-dots" data-pm-tries></div>
          </div>
          <button class="pc-pm-pass-chip is-invisible" data-pm-pass>Pass to next →</button>
        </div>

        <div class="pc-pm-splash" data-pm-splash hidden>
          <div class="pc-pm-splash-inner">
            <p class="pc-pm-splash-pre">Pass the device to</p>
            <p class="pc-pm-splash-name" data-pm-splash-name>—</p>
            <button class="pc-pm-splash-go" data-pm-splash-go>Ready</button>
          </div>
        </div>
      </div>`

    // Wire static handlers (mic, pass, quit, tap-to-hear, splash).
    opts.container
      .querySelector<HTMLButtonElement>("[data-pm-quit]")
      ?.addEventListener("click", async () => {
        const proceed = await pmConfirm({
          message: "Quit this game? Scores will be lost.",
          confirmLabel: "Quit",
          cancelLabel: "Keep playing",
          destructive: true,
        })
        if (!proceed) return
        if (activeSessionId) {
          stt
            .cancelSession({ sessionId: activeSessionId })
            .catch((err) =>
              console.error("[parlometron/round] cancel failed:", err),
            )
          activeSessionId = null
        }
        opts.onQuit()
      })
    opts.container
      .querySelector<HTMLButtonElement>("[data-pm-mic]")
      ?.addEventListener("click", onMicClick)
    opts.container
      .querySelector<HTMLButtonElement>("[data-pm-pass]")
      ?.addEventListener("click", commitAndAdvancePlayer)
    opts.container
      .querySelector<HTMLButtonElement>("[data-pm-splash-go]")
      ?.addEventListener("click", () => {
        uiState = "ready"
        refresh()
      })

    // Tap the phrase to hear it. Same affordance as solo practice
    // mode — important for multiplayer because every player should
    // be able to listen before their turn.
    const targetEl = opts.container.querySelector<HTMLElement>(
      "[data-pm-target]",
    )
    if (targetEl) {
      targetEl.addEventListener("click", () => {
        const text = phraseTarget?.text
        const lang = phraseTarget?.language_code
        if (!text || !lang) return
        try {
          const r = opts.hostApi.speak(lang, text)
          if (r && typeof (r as Promise<void>).catch === "function") {
            ;(r as Promise<void>).catch((err) =>
              console.error("[parlometron/round] phrase speak failed:", err),
            )
          }
        } catch (err) {
          console.error("[parlometron/round] phrase speak threw:", err)
        }
      })
    }
  }

  // Per-frame refresh — updates the dynamic slots in the shell.
  // Layout never shifts because every slot is reserved (hidden but
  // present) in the shell DOM.
  const refresh = () => {
    if (disposed) return
    const player = currentPlayer(opts.game)
    const attemptsLeft = player
      ? opts.game.attemptsLeft[player.id] ?? 0
      : 0
    const attemptsUsed = MAX_ATTEMPTS_PER_PLAYER - attemptsLeft
    const playerNum = player
      ? opts.game.currentRoundOrder.indexOf(player.id) + 1
      : opts.game.currentRoundOrder.length
    const ofPlayers = opts.game.currentRoundOrder.length

    const q = <T extends HTMLElement>(sel: string): T | null =>
      opts.container.querySelector<T>(sel)

    // Header
    const eyebrow = q<HTMLElement>("[data-pm-eyebrow]")
    if (eyebrow) {
      const langCode = phraseTarget?.language_code
        ? phraseTarget.language_code.split("-")[0].toUpperCase()
        : ""
      const langPart = langCode ? ` · ${langCode}` : ""
      eyebrow.textContent = `Round ${opts.game.currentRound}${langPart} · First to ${opts.game.winTarget}`
    }
    const headline = q<HTMLElement>("[data-pm-headline]")
    if (headline) {
      headline.textContent = `${player?.name ?? "—"}'s turn`
    }
    const turn = q<HTMLElement>("[data-pm-turn]")
    if (turn) {
      turn.textContent = `${playerNum} / ${ofPlayers}`
    }

    // Phrase card
    const targetEl = q<HTMLElement>("[data-pm-target]")
    if (targetEl) {
      targetEl.textContent = phraseTarget?.text ?? "Loading…"
    }
    const romanEl = q<HTMLElement>("[data-pm-roman]")
    if (romanEl) {
      const cfg = opts.hostApi.getStackConfig()
      const showRoman = !!cfg.showRomanization
      const roman = (phraseTarget?.romanization ?? "").trim()
      if (showRoman && roman) {
        romanEl.textContent = roman
        romanEl.hidden = false
      } else {
        romanEl.hidden = true
      }
    }
    const nativeEl = q<HTMLElement>("[data-pm-native]")
    if (nativeEl) {
      const t = (phraseNative?.text ?? "").trim()
      if (t) {
        nativeEl.textContent = t
        nativeEl.hidden = false
      } else {
        nativeEl.hidden = true
      }
    }

    // Result slots — populate from `lastResult` when present.
    renderResultSlots()

    // Mic + label + tries dots
    const mic = q<HTMLButtonElement>("[data-pm-mic]")
    const micLabel = q<HTMLElement>("[data-pm-mic-label]")
    const triesEl = q<HTMLElement>("[data-pm-tries]")
    if (mic) {
      mic.classList.remove("recording", "scoring")
      mic.disabled = uiState === "scoring" || uiState === "loading"
      if (uiState === "recording") mic.classList.add("recording")
      else if (uiState === "scoring") mic.classList.add("scoring")
    }
    if (micLabel) {
      micLabel.textContent =
        uiState === "loading"
          ? "Loading…"
          : uiState === "passing"
            ? `${player?.name ?? "—"}, get ready`
            : uiState === "recording"
              ? "Tap to stop"
              : uiState === "scoring"
                ? "Scoring…"
                : uiState === "result" && attemptsLeft > 0
                  ? "Tap to try again"
                  : uiState === "result"
                    ? "Tap mic or pass"
                    : "Tap to speak"
    }
    if (triesEl) {
      triesEl.innerHTML = Array.from({ length: MAX_ATTEMPTS_PER_PLAYER }, (_, i) => {
        const used = i < attemptsUsed
        return `<span class="pc-pm-try-dot ${used ? "used" : ""}"></span>`
      }).join("")
    }

    // Pass-to-next chip (visible only in result state). Toggle a
    // visibility-only class — `[hidden]` would collapse the chip's
    // box and shift the mic. With `.is-invisible`, the 36 px chip
    // slot stays in the flex layout at all times.
    const passChip = q<HTMLElement>("[data-pm-pass]")
    if (passChip) {
      passChip.classList.toggle("is-invisible", uiState !== "result")
    }

    // Pass-the-device splash
    const splash = q<HTMLElement>("[data-pm-splash]")
    const splashName = q<HTMLElement>("[data-pm-splash-name]")
    if (splash) {
      splash.hidden = uiState !== "passing"
    }
    if (splashName) {
      splashName.textContent = player?.name ?? "next player"
    }
  }

  const renderResultSlots = () => {
    const banner = opts.container.querySelector<HTMLElement>("[data-pm-banner]")
    const transcript = opts.container.querySelector<HTMLElement>(
      "[data-pm-transcript]",
    )
    const detail = opts.container.querySelector<HTMLElement>(
      "[data-pm-detail]",
    )
    if (!banner || !transcript || !detail) return

    // Transient error path: scoring failed (model not loaded, plugin
    // timeout, etc.). Show just the banner with the message; clear
    // transcript + detail. Survives even though uiState went back to
    // "ready" — that's the bug we're working around.
    if (lastErrorMessage && !lastResult) {
      banner.className = "pc-result-banner bad"
      banner.innerHTML = `<span class="pc-result-banner-text">${escapeHtml(
        lastErrorMessage,
      )}</span>`
      banner.hidden = false
      transcript.hidden = true
      detail.hidden = true
      transcript.innerHTML = ""
      detail.innerHTML = ""
      return
    }

    if (!lastResult || uiState !== "result") {
      banner.hidden = true
      transcript.hidden = true
      detail.hidden = true
      banner.innerHTML = ""
      transcript.innerHTML = ""
      detail.innerHTML = ""
      return
    }

    const r = lastResult
    const overall = Math.max(0, Math.min(1, r.overallScore))
    const pct = Math.round(overall * 100)
    const tier: "good" | "okay" | "bad" =
      overall >= 0.85 ? "good" : overall >= 0.6 ? "okay" : "bad"
    // "Way off" was presumptuous — these models can be wrong, and
    // telling someone they said it wrong when they didn't is worse
    // than showing nothing. Bad tier shows just the score; the user
    // can read the heard-vs-expected pills below if they want detail.
    const headlineText =
      tier === "good"
        ? "Nailed it"
        : tier === "okay"
          ? "Close — try again"
          : ""

    banner.className = `pc-result-banner ${tier}`
    banner.innerHTML = headlineText
      ? `
      <span class="pc-result-banner-score">${pct}%</span>
      <span class="pc-result-banner-sep">·</span>
      <span class="pc-result-banner-text">${escapeHtml(headlineText)}</span>`
      : `<span class="pc-result-banner-score">${pct}%</span>`
    banner.hidden = false

    // "Heard you say" — same shape as solo's free transcript row.
    const freeText = (r.freeText || r.text || "").trim()
    // RTL target langs flip pill order, play affordance to the right
    // side, and point glyphs leftward — see solo for the same logic.
    const rtl = isRTL(phraseTarget?.language_code ?? r.language ?? "")
    const lineCls = rtl ? "pc-transcript-line pc-transcript-line-rtl" : "pc-transcript-line"
    const playGlyph = rtl ? "◀" : "▶"
    if (freeText) {
      transcript.innerHTML = `
        <div class="pc-transcripts">
          <div class="pc-transcript-row heard" role="button" tabindex="0"
               data-pm-speak-heard
               aria-label="Play what Whisper heard">
            <span class="pc-transcript-label">Heard you say</span>
            <span class="${lineCls}">
              <span class="pc-transcript-play" aria-hidden="true">${playGlyph}</span>
              <span class="pc-transcript-text">${escapeHtml(freeText)}</span>
            </span>
          </div>
        </div>`
      transcript.hidden = false
      transcript
        .querySelector<HTMLElement>("[data-pm-speak-heard]")
        ?.addEventListener("click", () => {
          const lang = phraseTarget?.language_code
          if (!lang) return
          try {
            const p = opts.hostApi.speak(lang, freeText)
            if (p && typeof (p as Promise<void>).catch === "function") {
              ;(p as Promise<void>).catch((err) =>
                console.error("[parlometron/round] heard speak failed:", err),
              )
            }
          } catch (err) {
            console.error("[parlometron/round] heard speak threw:", err)
          }
        })
    } else {
      transcript.innerHTML = ""
      transcript.hidden = true
    }

    // Per-word pills — mirror solo's renderResult logic, simplified.
    const expectedText = (phraseTarget?.text ?? "").trim()
    const compareLang = phraseTarget?.language_code ?? r.language ?? ""
    const heardWords = mergeApostropheWords(r.words ?? [])
    const expectedTokens = tokenizeForPills(expectedText)
    const freeTokens = tokenizeForPills(freeText)
    const useHeardProbs =
      expectedTokens.length > 0 &&
      expectedTokens.length === heardWords.length
    const useFreePositional =
      expectedTokens.length > 0 &&
      expectedTokens.length === freeTokens.length
    const overallFreeSim =
      freeText.length && expectedText.length
        ? charSimilarity(
            normalizeForCompare(freeText, compareLang),
            normalizeForCompare(expectedText, compareLang),
          )
        : null

    type WordPill = {
      word: string
      heardProb: number | null
      freeSim: number | null
    }
    const pills: WordPill[] = expectedTokens.length
      ? expectedTokens.map((tok, i) => ({
          word: tok,
          heardProb: useHeardProbs ? heardWords[i].probability : null,
          freeSim: useFreePositional
            ? charSimilarity(
                normalizeForCompare(tok, compareLang),
                normalizeForCompare(freeTokens[i], compareLang),
              )
            : overallFreeSim,
        }))
      : expectedText
        ? [{ word: expectedText, heardProb: null, freeSim: overallFreeSim }]
        : []
    const heardTier = (p: number | null): "good" | "okay" | "bad" | null => {
      if (p === null) return null
      if (p >= 0.9) return "good"
      if (p >= 0.6) return "okay"
      return "bad"
    }
    const freeTier = (s: number | null): "good" | "okay" | "bad" | null => {
      if (s === null) return null
      if (s >= 0.85) return "good"
      if (s >= 0.6) return "okay"
      return "bad"
    }
    const tierRank: Record<"bad" | "okay" | "good", number> = {
      bad: 0,
      okay: 1,
      good: 2,
    }
    const pillClass = (w: WordPill): string => {
      const h = heardTier(w.heardProb)
      const f = freeTier(w.freeSim)
      if (h === null && f === null) return ""
      if (h === null) return f as string
      if (f === null) return h
      return tierRank[h] <= tierRank[f] ? h : f
    }
    const wordsHtml = pills
      .map(
        (w, idx) =>
          `<button class="pc-word ${pillClass(w)}" type="button"
                   data-pm-word-idx="${idx}"
                   aria-label="Speak ${escapeAttr(w.word)}">${escapeHtml(w.word)}</button>`,
      )
      .join("")
    const wordsCls = rtl ? "pc-words pc-words-rtl" : "pc-words"
    detail.innerHTML = wordsHtml
      ? `<div class="${wordsCls}">${wordsHtml}</div>`
      : ""
    detail.hidden = !wordsHtml

    // Tap a pill to hear that word in the target language.
    detail
      .querySelectorAll<HTMLButtonElement>("[data-pm-word-idx]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.getAttribute("data-pm-word-idx"))
          const word = pills[idx]?.word.trim()
          const lang = phraseTarget?.language_code
          if (!word || !lang) return
          try {
            const p = opts.hostApi.speak(lang, word)
            if (p && typeof (p as Promise<void>).catch === "function") {
              ;(p as Promise<void>).catch((err) =>
                console.error("[parlometron/round] word speak failed:", err),
              )
            }
          } catch (err) {
            console.error("[parlometron/round] word speak threw:", err)
          }
        })
      })
  }

  const onMicClick = () => {
    if (uiState === "ready") {
      startRecording()
    } else if (uiState === "recording") {
      stopRecording()
    } else if (uiState === "result" && playerHasAttemptsLeft()) {
      // Try again — clear the result slots and start a fresh recording.
      lastResult = null
      uiState = "ready"
      refresh()
      startRecording()
    } else if (uiState === "result") {
      // Out of tries: a tap on the mic also advances (same effect as
      // the Pass chip; the user might find the mic first).
      commitAndAdvancePlayer()
    }
  }

  const playerHasAttemptsLeft = (): boolean => {
    const player = currentPlayer(opts.game)
    if (!player) return false
    return (opts.game.attemptsLeft[player.id] ?? 0) > 0
  }

  const startRecording = async () => {
    if (disposed) return
    const player = currentPlayer(opts.game)
    if (!player) return
    const sessionId = newSessionId()
    activeSessionId = sessionId
    lastResult = null
    lastErrorMessage = null
    uiState = "recording"
    refresh()
    try {
      const lang = whisperLang(phraseTarget?.language_code ?? "en")
      const res = await stt.startSession({
        sessionId,
        language: lang,
        expectedText: phraseTarget?.text ?? "",
        whisperParams: mergeForLang(lang),
        // Multiplayer doesn't track the loaded model here today, so
        // the model-substring overlay tier is skipped. Language-level
        // scoring profile still applies.
        scoringParams: mergeScoringForLangModel(lang, undefined),
      })
      if (disposed) return
      if (!res.started) throw new Error("STT did not start")
    } catch (err) {
      console.error("[parlometron/round] startSession failed:", err)
      activeSessionId = null
      uiState = "ready"
      refresh()
    }
  }

  const stopRecording = async () => {
    if (disposed) return
    const sessionId = activeSessionId
    if (!sessionId) return
    activeSessionId = null
    uiState = "scoring"
    refresh()
    try {
      const result = await withTimeout(
        stt.stopSession({ sessionId }),
        TRANSCRIBE_TIMEOUT_MS,
        "Scoring",
      )
      if (disposed) return
      const pct = Math.round(
        Math.max(0, Math.min(1, result.overallScore)) * 100,
      )
      const heardText = result.text || result.freeText || ""
      recordAttempt(opts.game, pct, heardText)
      saveState(opts.game)
      lastResult = result
      uiState = "result"
      refresh()
    } catch (err) {
      const msg =
        (err as { message?: string } | undefined)?.message ?? String(err)
      const code = (err as { code?: string } | undefined)?.code
      console.error(
        `[parlometron/round] stopSession failed (code=${code ?? "—"}):`,
        msg,
      )
      if (disposed) return
      // Surface the failure to the player instead of silently dumping
      // them back to "ready". The common cause is "model not loaded"
      // when this is the user's first time in Multiplayer before
      // Practice has run the install flow. Route through state
      // (`lastErrorMessage`) so `renderResultSlots` actually keeps
      // the banner up — setting `banner.innerHTML` here directly
      // gets wiped because uiState goes back to "ready".
      lastErrorMessage =
        code === "NOT_PREPARED" || /not prepared/i.test(msg)
          ? "Speech model isn't loaded yet. Open Practice once to install it."
          : `Couldn't score this attempt: ${msg}`
      lastResult = null
      uiState = "ready"
      refresh()
    }
  }

  const commitAndAdvancePlayer = () => {
    if (disposed) return
    advancePlayer(opts.game)
    saveState(opts.game)
    if (allPlayersFinishedRound(opts.game)) {
      const { round } = finishRound(opts.game)
      saveState(opts.game)
      opts.onRoundDone(round)
      return
    }
    lastResult = null
    lastErrorMessage = null
    uiState = "passing"
    refresh()
  }

  const boot = async () => {
    buildShell()
    uiState = "loading"
    refresh()
    try {
      const cfg = opts.hostApi.getStackConfig()
      if (!cfg.languages || cfg.languages.length < 1) {
        opts.container.innerHTML = `
          <div class="pc-pm-root pc-pm-error">
            <p>Choose a language in your Corpán stack before starting Parlometron.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`
        opts.container
          .querySelector<HTMLButtonElement>("[data-pm-quit]")
          ?.addEventListener("click", opts.onQuit)
        return
      }
      const getRandomEntry = opts.hostApi.getRandomEntry
      if (!getRandomEntry) throw new Error("hostApi.getRandomEntry unavailable")
      const entry = await getRandomEntry()
      if (disposed) return
      const { target, native } = pickTargetTranslation(entry, cfg.languages)
      if (!target) {
        opts.container.innerHTML = `
          <div class="pc-pm-root pc-pm-error">
            <p>This phrase doesn't have a translation in your target language.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`
        opts.container
          .querySelector<HTMLButtonElement>("[data-pm-quit]")
          ?.addEventListener("click", opts.onQuit)
        return
      }
      phraseTarget = target
      phraseNative = native
      startRound(opts.game, target.text)
      saveState(opts.game)
      // First player gets a pass-splash too so whoever set up the
      // lobby doesn't accidentally fall straight into recording.
      uiState = "passing"
      refresh()
    } catch (err) {
      console.error("[parlometron/round] boot failed:", err)
      if (disposed) return
      opts.container.innerHTML = `
        <div class="pc-pm-root pc-pm-error">
          <p>Couldn't load a phrase. Try again later.</p>
          <button class="pc-pm-start" data-pm-quit>Back</button>
        </div>`
      opts.container
        .querySelector<HTMLButtonElement>("[data-pm-quit]")
        ?.addEventListener("click", opts.onQuit)
    }
  }

  boot()

  return {
    unmount: () => {
      disposed = true
      if (activeSessionId) {
        stt
          .cancelSession({ sessionId: activeSessionId })
          .catch((err) =>
            console.error("[parlometron/round] unmount cancel:", err),
          )
        activeSessionId = null
      }
      opts.container.innerHTML = ""
    },
  }
}
