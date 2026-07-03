// The per-word feedback UI — MOVED from packs/pronunciation-coach/src/game.ts
// `renderResult` + `clearResultOnCard` (capability-modules.md §4.1),
// parameterized: the pack keeps its streak/confetti/persist reactions
// (driven by the returned verdict); the capability mount maps the verdict to
// ActivityResult. Classes renamed pc-result-* → capPron-* at move time.
import type { SttTranscriptionResult } from "@shared/capabilities/core"
import {
  charSimilarity,
  escapeHtml,
  isRTL,
  LOW_RESOURCE_LANGS,
  mergeApostropheWords,
  normalizeForCompare,
  tokenizeForPills,
} from "./text"
import { capPronounceT, type CapPronounceStringKey } from "../strings"

export type WordPill = {
  word: string
  heardProb: number | null
  freeSim: number | null
}

export type PronounceVerdict = {
  /** Clamped overall score 0..1 ("—" rendered when silent). */
  overall: number
  /** Whisper said the audio was effectively silent (no real attempt). */
  silent: boolean
  /** Verdict band: `top` ≥ 0.85 (celebration-worthy — the pack fires
   *  confetti + streak), `mid` ≥ 0.60 (keeps a streak alive), else `low`. */
  band: "top" | "mid" | "low"
  pills: WordPill[]
}

export type ResultSlots = {
  banner: HTMLElement | null
  transcriptUp: HTMLElement | null
  barsUp: HTMLElement | null
  detail: HTMLElement | null
}

/** Slot markup renderers — consumers compose these into their card layout
 *  (the pack's deck card puts *AboveHtml over the phrase and *BelowHtml
 *  under it; the capability round card does the same). */
export const resultSlotsAboveHtml = (): string => `
  <div class="capPron-banner" data-cappron-banner hidden></div>
  <div class="capPron-transcript-up" data-cappron-transcript-up hidden></div>
  <div class="capPron-bars-up" data-cappron-bars-up hidden></div>
`
export const resultSlotsBelowHtml = (): string => `
  <div class="capPron-detail" data-cappron-detail hidden></div>
`

export const getResultSlots = (card: HTMLElement): ResultSlots => ({
  banner: card.querySelector<HTMLElement>("[data-cappron-banner]"),
  transcriptUp: card.querySelector<HTMLElement>("[data-cappron-transcript-up]"),
  barsUp: card.querySelector<HTMLElement>("[data-cappron-bars-up]"),
  detail: card.querySelector<HTMLElement>("[data-cappron-detail]"),
})

/** Clear result decorations from a card's slots. Decorations animate out
 *  (leaving class triggers a 220ms fade) before the DOM nodes are emptied —
 *  re-recording on the same card shouldn't snap the colored pills off. */
export const clearResultSlots = (card: HTMLElement): void => {
  const { banner, transcriptUp, barsUp, detail } = getResultSlots(card)
  const finalize = () => {
    if (banner) {
      banner.innerHTML = ""
      banner.hidden = true
      banner.className = "capPron-banner"
    }
    if (transcriptUp) {
      transcriptUp.innerHTML = ""
      transcriptUp.hidden = true
      transcriptUp.className = "capPron-transcript-up"
    }
    if (barsUp) {
      barsUp.innerHTML = ""
      barsUp.hidden = true
      barsUp.className = "capPron-bars-up"
    }
    if (detail) {
      detail.innerHTML = ""
      detail.hidden = true
      detail.className = "capPron-detail"
    }
  }
  const wasShowing =
    (banner && !banner.hidden) ||
    (transcriptUp && !transcriptUp.hidden) ||
    (barsUp && !barsUp.hidden) ||
    (detail && !detail.hidden)
  if (!wasShowing) {
    finalize()
    return
  }
  if (banner && !banner.hidden) banner.classList.add("leaving")
  if (transcriptUp && !transcriptUp.hidden) transcriptUp.classList.add("leaving")
  if (barsUp && !barsUp.hidden) barsUp.classList.add("leaving")
  if (detail && !detail.hidden) detail.classList.add("leaving")
  // Match the 220ms capPron-banner-out / capPron-detail-out keyframes.
  window.setTimeout(finalize, 220)
}

export type RenderResultOptions = {
  /** The expected (displayed) phrase text. */
  expectedText: string
  /** Corpán code used for comparison + RTL + TTS voice. */
  compareLang: string
  /** UI (native) language for the verdict/chip strings. */
  uiLang: string
  /** Model folder, for the calibration telemetry line. */
  modelFolder?: string
  /** Speak text in the target voice (pill taps + "heard you say" row). */
  speak: (lang: string, text: string) => void
}

export const renderPronounceResult = (
  card: HTMLElement,
  result: SttTranscriptionResult,
  opts: RenderResultOptions,
): PronounceVerdict => {
  const tt = (key: CapPronounceStringKey, params?: Record<string, string>) =>
    capPronounceT(key, opts.uiLang, params)

  const overall = Math.max(0, Math.min(1, result.overallScore))
  const noSpeech = Math.max(0, Math.min(1, result.noSpeechProb ?? 0))
  const compression = result.compressionRatio ?? 0

  // Calibration telemetry. One concise line per attempt (pairs with the
  // native plugin's `Whisper |` os_log lines).
  console.info("[PRON:score]", {
    lang: result.whisperLanguage || result.language,
    model: opts.modelFolder ?? "",
    expected: opts.expectedText,
    heard: result.text,
    free: result.freeText,
    overall: result.overallScore,
    transcript: result.transcriptScore,
    acoustic: result.acousticScore,
    likelihood: result.likelihoodScore,
    noSpeechProb: result.noSpeechProb,
    compressionRatio: result.compressionRatio,
    avgLogprob: result.avgLogprob,
    minTokenLogprob: result.minTokenLogprob,
    tokenLogprobStdev: result.tokenLogprobStdev,
    temperature: result.temperature,
  })

  const freeVsConstrained = Math.max(
    0,
    Math.min(1, result.freeVsConstrainedSimilarity ?? 1)
  )
  const pct = (n: number) => `${Math.round(n * 100)}%`

  // Hard-gate UI: if Whisper's noSpeechProb says the audio was effectively
  // silent, render a specific message rather than a numeric score breakdown.
  const silent = noSpeech > 0.5
  // Verdict tiers — wider spectrum so the headline tracks the score.
  // Celebration (confetti/streak, pack-side) only counts above 0.85.
  let headlineClass = "bad"
  let headlineText = tt("resultTryAgain")
  if (silent) {
    headlineClass = "bad"
    headlineText = tt("resultCouldntHear")
  } else if (overall >= 0.95) {
    headlineClass = "good"
    headlineText = tt("resultPerfect")
  } else if (overall >= 0.85) {
    headlineClass = "good"
    headlineText = tt("resultNailedIt")
  } else if (overall >= 0.75) {
    headlineClass = "good"
    headlineText = tt("resultGreat")
  } else if (overall >= 0.60) {
    headlineClass = "okay"
    headlineText = tt("resultPrettyGood")
  } else if (overall >= 0.45) {
    headlineClass = "okay"
    headlineText = tt("resultCloseKeepGoing")
  } else if (overall >= 0.25) {
    headlineClass = "bad"
    headlineText = tt("resultKeepPracticing")
  }

  // Word pills represent the EXPECTED phrase (not what was heard).
  // Tapping speaks that word in the target language so the user can
  // study individual words.
  //
  // Pill color combines two signals:
  //   - heardProb: the constrained-decode per-word probability.
  //     Inflated by `prefixTokens` (the model is just confirming
  //     forced tokens), so on its own it gives green pills even
  //     when pronunciation was poor.
  //   - freeSim: character-level similarity between the expected
  //     word and the free-decode word at that position (or to the
  //     full free transcript when positional alignment isn't
  //     possible). The free decode is uncoerced, so this is the
  //     honest signal. Low freeSim = the model heard something
  //     different at that spot — a real pronunciation problem.
  // The pill takes the *worst* tier of the two so we never show a
  // green pill when the free decode disagrees.
  const heardWords = mergeApostropheWords(result.words || [])
  const expectedText = (opts.expectedText || "").trim()
  const expectedTokens = tokenizeForPills(expectedText)
  const freeText = (result.freeText || "").trim()
  const freeTokens = tokenizeForPills(freeText)
  const useHeardProbs =
    expectedTokens.length > 0 &&
    expectedTokens.length === heardWords.length
  const useFreePositional =
    expectedTokens.length > 0 &&
    expectedTokens.length === freeTokens.length
  // Fallback when free word count doesn't align: apply the global
  // free-vs-expected character similarity to every pill so the honest
  // signal still shows up. Empty free text with a real expected phrase is a
  // genuine failure — treat as 0 similarity at the pill level too.
  const freeDecodeFailed = expectedText.length > 0 && freeText.length === 0
  const compareLang = opts.compareLang || result.language || ""
  const overallFreeSim =
    freeText.length && expectedText.length
      ? charSimilarity(
          normalizeForCompare(freeText, compareLang),
          normalizeForCompare(expectedText, compareLang)
        )
      : freeDecodeFailed
        ? 0
        : null
  const pills: WordPill[] = expectedTokens.length
    ? expectedTokens.map((tok, i) => ({
        word: tok,
        heardProb: useHeardProbs ? heardWords[i].probability : null,
        freeSim: useFreePositional
          ? charSimilarity(
              normalizeForCompare(tok, compareLang),
              normalizeForCompare(freeTokens[i], compareLang)
            )
          : overallFreeSim,
      }))
    : expectedText
      ? [
          {
            word: expectedText,
            heardProb: null,
            freeSim: overallFreeSim,
          },
        ]
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
    .map((w, idx) => {
      const cls = pillClass(w)
      return `<button class="capPron-word ${cls}" type="button" data-cappron-word-idx="${idx}" aria-label="${escapeHtml(
        tt("ariaSpeakWord", { word: w.word })
      )}">${escapeHtml(w.word)}</button>`
    })
    .join("")

  // "Heard you say" — the FREE decode (honest signal, no prefix bias).
  // RTL target langs: flip play affordance to the right side and point the
  // glyph leftward (◀), since reading flows right→left.
  const rtl = isRTL(compareLang)
  const lineCls = rtl
    ? "capPron-transcript-line capPron-transcript-line-rtl"
    : "capPron-transcript-line"
  const playGlyph = rtl ? "◀" : "▶"
  const heardRow = freeText.length
    ? `<div class="capPron-transcript-row heard" role="button" tabindex="0"
           data-cappron-speak="heard" data-no-swipe
           aria-label="${escapeHtml(tt("ariaPlayHeard"))}">
         <span class="capPron-transcript-label">${escapeHtml(tt("heardYouSay"))}</span>
         <span class="${lineCls}">
           <span class="capPron-transcript-play" aria-hidden="true">${playGlyph}</span>
           <span class="capPron-transcript-text">${escapeHtml(freeText)}</span>
         </span>
       </div>`
    : freeDecodeFailed
      ? `<div class="capPron-transcript-row heard empty">
           <span class="capPron-transcript-label">${escapeHtml(tt("heardYouSay"))}</span>
           <span class="capPron-transcript-line">
             <span class="capPron-transcript-text empty">${escapeHtml(tt("couldntMakeOutWords"))}</span>
           </span>
         </div>`
      : ""
  const transcriptsHtml = heardRow
    ? `<div class="capPron-transcripts">${heardRow}</div>`
    : ""

  // Friendly diagnostic chips — surface only when something genuinely went
  // off, in plain language. Truly technical signals stay in the log line.
  const knownScriptMismatch: Record<string, string> = {
    "pa-arab": tt("chipDifferentScript"),
    "yue-hant-hk": tt("chipDifferentScript"),
    "zh-hans": tt("chipDifferentScript"),
    "zh-hant": tt("chipDifferentScript"),
  }
  const lcLang = (result.language ?? "").toLowerCase()
  const scriptMismatchNote = knownScriptMismatch[lcLang]
  const diagChips: string[] = []
  if (noSpeech > 0.2)
    diagChips.push(
      `<div class="capPron-chip capPron-chip-warn">${escapeHtml(tt("chipSoundedFaint"))}</div>`
    )
  // Compression ratio is calibrated for Latin-script languages. Indic /
  // Persian / Urdu BPE legitimately runs higher (2.5–3.5) even on clean
  // speech, so suppress the chip there (mirrors the per-lang threshold in
  // the plugin).
  const compareBaseLang = compareLang.toLowerCase().split("-")[0]
  const compressionThreshold = LOW_RESOURCE_LANGS.has(compareBaseLang)
    ? 3.5
    : 2.4
  if (compression > compressionThreshold)
    diagChips.push(
      `<div class="capPron-chip capPron-chip-warn">${escapeHtml(tt("chipSoundedGarbled"))}</div>`
    )
  if (freeDecodeFailed)
    diagChips.push(
      `<div class="capPron-chip capPron-chip-warn">${escapeHtml(tt("chipCouldntMakeOut"))}</div>`
    )
  else if (freeVsConstrained < 0.6)
    diagChips.push(
      `<div class="capPron-chip capPron-chip-warn">${escapeHtml(tt("chipWordsDidntMatch"))}</div>`
    )
  if (scriptMismatchNote)
    diagChips.push(
      `<div class="capPron-chip">${escapeHtml(scriptMismatchNote)}</div>`
    )
  const diagHtml = diagChips.length
    ? `<div class="capPron-chips capPron-diagnostics">${diagChips.join("")}</div>`
    : ""

  // Render banner + detail INTO the card's slots. The phrase stays where it
  // is (visual hero); the banner appears just above it as a compact pill,
  // the per-word pills + diagnostics below.
  const { banner: bannerEl, transcriptUp: transUpEl, barsUp: barsUpEl, detail: detailEl } =
    getResultSlots(card)
  if (!bannerEl || !detailEl) {
    console.error("[cap-pronounce] renderResult: card missing result slots")
    return {
      overall,
      silent,
      band: silent ? "low" : overall >= 0.85 ? "top" : overall >= 0.6 ? "mid" : "low",
      pills,
    }
  }
  if (silent) {
    // Quiet failure path — score is "—", show a friendly chip. Banner uses
    // the okay tint (warning, not failure).
    bannerEl.className = `capPron-banner ${headlineClass}`
    bannerEl.innerHTML = `
      <span class="capPron-banner-score">—</span>
      <span class="capPron-banner-sep">·</span>
      <span class="capPron-banner-text">${headlineText}</span>
    `
    bannerEl.hidden = false
    detailEl.innerHTML = `
      <div class="capPron-chips">
        <div class="capPron-chip">${escapeHtml(tt("hintMoveCloser"))}</div>
      </div>
    `
    detailEl.hidden = false
  } else {
    bannerEl.className = `capPron-banner ${headlineClass}`
    bannerEl.innerHTML = `
      <span class="capPron-banner-score">${pct(overall)}</span>
      <span class="capPron-banner-sep">·</span>
      <span class="capPron-banner-text">${headlineText}</span>
    `
    bannerEl.hidden = false
    // Composition above the phrase: banner (% + headline) → "Heard you
    // say". Composition below: per-word pills → diagnostics. The bars-up
    // slot is intentionally left empty — the headline number and per-word
    // pills together carry the score story without redundant bars.
    if (transUpEl) {
      transUpEl.innerHTML = transcriptsHtml
      transUpEl.hidden = !transcriptsHtml
    }
    if (barsUpEl) {
      barsUpEl.innerHTML = ""
      barsUpEl.hidden = true
    }
    const wordsCls = rtl ? "capPron-words capPron-words-rtl" : "capPron-words"
    detailEl.innerHTML = `
      ${wordsHtml ? `<div class="${wordsCls}">${wordsHtml}</div>` : ""}
      ${diagHtml}
    `
    detailEl.hidden = false
  }

  const speakInTarget = (text: string, label: string) => {
    const lang = opts.compareLang || result.language || "en"
    try {
      opts.speak(lang, text)
    } catch (err) {
      console.error(`[cap-pronounce] ${label} speak threw:`, err)
    }
  }

  // Per-word TTS: tap a pill to hear that word in the target language.
  const wordPills = detailEl.querySelectorAll<HTMLButtonElement>(
    "button.capPron-word[data-cappron-word-idx]"
  )
  wordPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const idxStr = pill.getAttribute("data-cappron-word-idx")
      if (idxStr === null) return
      const idx = Number(idxStr)
      const word = pills[idx]
      if (!word) return
      speakInTarget(word.word.trim(), "word")
    })
  })

  // Tap anywhere on the "Heard you say" row → speak the free transcript in
  // the target-language voice. The whole row is the tap target.
  const transcriptRows = card.querySelectorAll<HTMLElement>(
    ".capPron-transcript-row[data-cappron-speak]"
  )
  transcriptRows.forEach((row) => {
    const speakRow = () => {
      if (!freeText) return
      speakInTarget(freeText, "heard")
    }
    row.addEventListener("click", speakRow)
    row.addEventListener("keydown", (e: Event) => {
      const k = (e as KeyboardEvent).key
      if (k === "Enter" || k === " ") {
        e.preventDefault()
        speakRow()
      }
    })
  })

  return {
    overall,
    silent,
    band: silent ? "low" : overall >= 0.85 ? "top" : overall >= 0.6 ? "mid" : "low",
    pills,
  }
}
