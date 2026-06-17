/**
 * useGameLogic — the game-loop orchestrator for Juice Squeeze (Fire rebuild).
 *
 * Owns: phrase loading (with language-pair rotation + target-phrase TTS),
 * history navigation, win detection + the win/reward/color-cycle sequence,
 * give-up / ear / fruit-flip actions, and the synchronous `window.__jsf` debug
 * surface. The DndContext wiring (placement) lives in JuiceSqueezeApp; this hook
 * exposes `onSentenceChanged()` which the app calls after every placement to run
 * the win check.
 *
 * Parity notes vs shipped (../juice-squeeze/src/game.ts):
 *  - pickLanguagePair: VERBATIM (module rotation index), see util/languagePair.
 *  - win sequence: setWon -> incrementCompletedPhrases -> recordCompletedPhrase
 *    with visualLevel = allFruits[colorIndex].level and fruitGradient =
 *    allFruits[colorIndex].gradient. On bottle-complete, cycle colorIndex via
 *    (idx+1) % allFruits.length then setColorIndex; then maybe show LevelComplete.
 *  - win TTS: speak(blockLang, joinForTTS(correctWords)) after ~400ms.
 *  - NO auto-advance (parity with shipped): after a win the player stays on the
 *    completed phrase; they advance manually via next/swipe/give-up. If a level
 *    completes, the LevelComplete modal shows and its Continue loads the next.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import type { HostApi } from "../sdk/types"
import { useGameStore } from "../state/gameStore"
import { getAllFruits, type CEFRLevel, type FruitDef } from "../state/fruits"
import { loadUtterance, type Utterance } from "../util/phraseLoader"
import { pickLanguagePair } from "../util/languagePair"
import { flattenReadingOrder } from "../util/readingOrder"
import { isRTL } from "../util/rtl"
import { joinForTTS } from "../util/tokenizer"
import { useTTS } from "./useTTS"
import { useHistory, type HistoryEntry } from "./useHistory"
import { useSfx } from "./useSfx"
import { useHaptics } from "./useHaptics"
import { launchJarFly } from "../components/jarFly"
import type { LiquidController } from "../liquid/LiquidController"

// ---- Completion choreography timing (tunable) ----------------------------
// Per correct phrase the sequence is:
//   t=0      win chime (play "win") + ✓ flash + success haptic + scoring
//   t≈POUR_DELAY   the POUR: glug (play "fill") + visible level RISE over ~1s
//   t≈VOICE_DELAY  the voice reads the built sentence (after the pour lands)
//   then auto-advance, delay scaled to sentence length so long ones are heard.
// On the 10th phrase (bottle complete) the pour fills to 100%, a celebration
// beat plays, THEN the glass resets to 0% before advancing.
const POUR_DELAY = 450 // chime first, glug + visible pour at the pour beat
const VOICE_DELAY = 1700 // voice after the pour has visibly landed
const CELEBRATION_BEAT = 700 // hold the full glass before the reset-to-empty
// Auto-advance is VOICE_DELAY + (scaled time to hear the sentence) + buffer.
const ADVANCE_VOICE_PER_WORD = 320
const ADVANCE_VOICE_CAP = 3200
const ADVANCE_BUFFER = 600
function advanceDelayFor(wordCount: number): number {
  return VOICE_DELAY + Math.min(wordCount * ADVANCE_VOICE_PER_WORD, ADVANCE_VOICE_CAP) + ADVANCE_BUFFER
}

// Emoji set for fruit-flip mode (shipped game.ts ~1760).
export const FRUIT_EMOJIS = ["🍊", "🥭", "🍍", "🍋", "🍇", "🍎", "🍓", "🍑"]

const LEVEL_ORDER: CEFRLevel[] = ["A0", "A1", "A2", "B1", "B2", "C1"]

export type LevelCompleteInfo = {
  fruit: FruitDef
  bottlesCompleted: number
  nextLevel: CEFRLevel | null
}

export function useGameLogic(hostApi: HostApi) {
  const { speak, clear } = useTTS(hostApi)
  const history = useHistory()
  const sfx = useSfx()
  const haptics = useHaptics(hostApi)

  const allFruits = useRef<FruitDef[]>(getAllFruits()).current

  const [loading, setLoading] = useState(false)
  const [levelComplete, setLevelComplete] = useState<LevelCompleteInfo | null>(null)
  const [giveUpText, setGiveUpText] = useState<string | null>(null)
  // Quick "correct!" flash key — bumping it re-triggers the CSS pulse so the
  // player gets instant win feedback beyond the vessel (~500ms, see game.css).
  const [winFlash, setWinFlash] = useState(0)

  // The imperative liquid controller (set by HeroVessel once Pixi is ready).
  // React must NOT drive liquid frames; we only call its methods from the win
  // sequence. Held in a ref so updating it never re-renders.
  const liquidRef = useRef<LiquidController | null>(null)
  const setLiquidController = useCallback((c: LiquidController | null) => {
    liquidRef.current = c
  }, [])

  // Timers we must be able to cancel on unmount / next-load.
  const winTimers = useRef<number[]>([])
  const advanceTimer = useRef<number | null>(null)
  // Removes an in-flight jar-fly overlay if we unmount / advance mid-celebration.
  const jarFlyCleanup = useRef<(() => void) | null>(null)
  const mounted = useRef(true)

  const clearWinTimers = useCallback(() => {
    winTimers.current.forEach((t) => window.clearTimeout(t))
    winTimers.current = []
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
    if (jarFlyCleanup.current) {
      jarFlyCleanup.current()
      jarFlyCleanup.current = null
    }
  }, [])

  // Read color index live from store (persisted across sessions).
  const getColorIndex = useCallback(() => {
    const bp = useGameStore.getState().bottleProgress
    let i = bp?.currentColorIndex ?? 0
    if (i < 0 || i >= allFruits.length) i = 0
    return i
  }, [allFruits.length])

  // ---- Debug surface -------------------------------------------------------
  const updateDebug = useCallback((extra?: Partial<Window["__jsf"]>) => {
    const s = useGameStore.getState()
    const sentenceWords = s.sentenceRows
      .flat()
      .map((id) => s.blocks[id]?.word)
      .filter((w): w is string => typeof w === "string")
    const cfg = hostApi.getStackConfig()
    window.__jsf = {
      booted: true,
      version: "0.1.0",
      languages: cfg.languages ?? [],
      levels: cfg.levels ?? [],
      phraseId: s.phrase.id ?? undefined,
      blockLang: s.phrase.blockLang ?? undefined,
      targetLang: s.phrase.targetLang ?? undefined,
      bankCount: s.bankOrder.length,
      sentenceWords,
      hasWon: s.hasWon,
      ...(window.__jsf ?? {}),
      ...extra,
    }
  }, [hostApi])

  // ---- Load a phrase into the store ---------------------------------------
  const applyUtterance = useCallback(
    (u: Utterance, targetLang: string, blockLang: string) => {
      useGameStore.getState().loadPhrase({
        id: u.id,
        level: u.level,
        text: u.text,
        words: u.words,
        targetText: u.targetText,
        targetLang,
        blockLang,
        source: u.source,
      })
      console.log(
        "[juice-squeeze-fire] phrase loaded",
        { id: u.id, source: u.source, targetLang, blockLang, words: u.words }
      )
      updateDebug({ phraseId: u.id, blockLang, targetLang, hasWon: false })
      // Show the CURRENT bottle level instantly with NO pour — the glass just
      // SITS at where the previous phrases left it. The pour only happens on a
      // win (driven by runWin). After a bottle-complete reset this is 0 → fresh
      // empty glass that the next completion pours the first juice into.
      liquidRef.current?.setFill(
        useGameStore.getState().getBottleFillPercent() / 100,
        { animate: false }
      )
      // NO auto-play of the target phrase: the target speaks ONLY when tapped
      // (TargetPhrase → onSpeakTarget). This avoids overlapping TTS on fast
      // navigation. The built-sentence win TTS (blockLang) still fires on win.
    },
    [updateDebug]
  )

  // Load a brand-new phrase from the host DB.
  const loadNext = useCallback(async () => {
    clearWinTimers()
    clear()
    setGiveUpText(null)
    setLoading(true)
    const cfg = hostApi.getStackConfig()
    const [targetLang, blockLang] = pickLanguagePair(cfg.languages ?? [])
    try {
      const u = await loadUtterance(hostApi, 2, blockLang, targetLang)
      if (!mounted.current) return
      if (!u) {
        console.warn("[juice-squeeze-fire] no utterance loaded")
        updateDebug({ lastError: "no-utterance" })
        setLoading(false)
        return
      }
      history.push({ utterance: u, targetLang, blockLang })
      applyUtterance(u, targetLang, blockLang)
    } catch (err) {
      console.error("[juice-squeeze-fire] load error", err)
      updateDebug({ lastError: String(err) })
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [applyUtterance, clear, clearWinTimers, history, hostApi, updateDebug])

  // Re-display a phrase from history (same utterance + same langs).
  const loadFromHistory = useCallback(
    (entry: HistoryEntry) => {
      clearWinTimers()
      clear()
      setGiveUpText(null)
      applyUtterance(entry.utterance, entry.targetLang, entry.blockLang)
    },
    [applyUtterance, clear, clearWinTimers]
  )

  const goPrev = useCallback(() => {
    const e = history.goPrev()
    if (e) loadFromHistory(e)
  }, [history, loadFromHistory])

  const goNext = useCallback(() => {
    const e = history.goNext()
    if (e) {
      loadFromHistory(e)
    } else {
      void loadNext()
    }
  }, [history, loadFromHistory, loadNext])

  // ---- Win sequence --------------------------------------------------------
  const runWin = useCallback(() => {
    const store = useGameStore.getState()
    const { phrase, correctWords } = store

    // ---- Duck fix (pack-side, NO host change) ------------------------------
    // The host TTS audio session DUCKS in-webview SFX while a voice is active.
    // If a previous phrase's voice is still trailing, the win chime + glug come
    // out muddy. Clearing any lingering speech here (before the chime) keeps the
    // celebration audio clean. We do NOT touch the host audio session.
    hostApi.stopSpeech?.()

    // ---- t=0: instant feedback — chime + ✓ flash + haptic + scoring --------
    store.setWon(true)
    haptics.fire("success")
    // Instant on-screen win confirmation (CSS pulse, ~500ms) — independent of
    // the vessel so the player knows immediately they got it right.
    setWinFlash((n) => n + 1)
    sfx.play("win") // win chime FIRST, on its own — the glug comes at the pour

    const colorIndex = getColorIndex()
    const currentFruit = allFruits[colorIndex]
    const visualLevel = currentFruit.level
    const phraseId = phrase.id || `phrase-${Date.now()}`
    const wordCount = correctWords.length

    // Compute the pour target BEFORE the store reset (recordCompletedPhrase
    // resets phrasesInCurrentBottle to 0 on the 10th). The VISUAL fill is now
    // decoupled from the store, so we drive it explicitly from these values.
    const pbBefore = store.bottleProgress.phrasesInCurrentBottle
    const willComplete = pbBefore + 1 >= 10
    const pourTarget = willComplete ? 1.0 : (pbBefore + 1) / 10

    // Scoring / bottle bookkeeping — runs NOW so progress is never lost.
    store.incrementCompletedPhrases()
    store.recordCompletedPhrase(
      phraseId,
      wordCount,
      visualLevel,
      {
        targetText: phrase.targetText || "",
        blockText: phrase.blockText || "",
        targetLang: phrase.targetLang || "",
        blockLang: phrase.blockLang || "",
      },
      currentFruit.gradient
    )

    // ---- t≈POUR_DELAY: the POUR — glug + visible level rise (synced) -------
    const tPour = window.setTimeout(() => {
      if (!mounted.current) return
      const liquid = liquidRef.current
      sfx.play("fill") // glass-fill "glug" as the juice pours in
      if (willComplete) {
        liquid?.triggerBottleComplete()
        sfx.play("bottleComplete") // level-complete.wav on a full bottle
        sfx.play("ping") // soft accent layered under the level-complete chime
      } else {
        liquid?.triggerWin()
      }
      // The visible RISE — eased over ~1s in LiquidStage so it reads as a pour.
      liquid?.setFill(pourTarget, { animate: true })
    }, POUR_DELAY)
    winTimers.current.push(tPour)

    // ---- t≈VOICE_DELAY: the voice reads the built sentence -----------------
    const blockLang = phrase.blockLang || "en"
    const sentence = joinForTTS(correctWords)
    const tVoice = window.setTimeout(() => {
      if (mounted.current) speak(blockLang, sentence)
    }, VOICE_DELAY)
    winTimers.current.push(tVoice)

    updateDebug({ hasWon: true })

    // ---- Bottle-complete branch: color cycle + maybe level-complete modal --
    let levelCompleting = false
    if (willComplete) {
      const after = useGameStore.getState().bottleProgress
      console.log("[juice-squeeze-fire] bottle complete", {
        bottles: after.bottleCollection.length,
        level: after.currentLevel,
      })
      // ---- Jar-fly celebration (Ian's jar idea) --------------------------
      // After the fill-to-100% + the celebration beat and BEFORE the drain, a
      // small CAPPED jar (the just-completed bottle's fruit gradient) appears
      // center-screen and flies UP into the header BottleCollection. The
      // jar-close sound plays at the moment the lid caps (start of the fly),
      // and the screen drains as the jar flies. Same instant as the
      // drain/modal below so they read as one coordinated beat.
      const completedGradient = currentFruit.gradient
      const tJar = window.setTimeout(() => {
        if (!mounted.current) return
        sfx.play("jarClose") // lid caps → fly up
        jarFlyCleanup.current = launchJarFly(completedGradient)
      }, VOICE_DELAY + CELEBRATION_BEAT)
      winTimers.current.push(tJar)

      // Cycle the bottle color for variety + persist (shipped game.ts ~1515).
      const nextColor = (colorIndex + 1) % allFruits.length
      useGameStore.getState().setColorIndex(nextColor)

      // Level-complete check (shipped ~1527): bottlesNeeded for level, or 99 cap.
      const bp = useGameStore.getState().bottleProgress
      if (useGameStore.getState().isLevelComplete() || bp.bottlesCompletedThisLevel >= 99) {
        levelCompleting = true
        const fruit = allFruits[nextColor]
        console.log("[juice-squeeze-fire] level complete", {
          level: bp.currentLevel,
          bottles: bp.bottlesCompletedThisLevel,
        })
        // Show the modal after the voice + a celebration beat; its Continue
        // (dismissLevelComplete) resets the glass + loads the next phrase.
        const tLvl = window.setTimeout(() => {
          if (!mounted.current) return
          setLevelComplete({
            fruit,
            bottlesCompleted: bp.bottlesCompletedThisLevel,
            nextLevel: getNextLevelSuggestion(hostApi),
          })
        }, VOICE_DELAY + CELEBRATION_BEAT)
        winTimers.current.push(tLvl)
      }
    }

    // ---- Auto-advance ------------------------------------------------------
    // When a level completed, the modal's Continue drives the next load (and the
    // reset), so we don't auto-advance here.
    if (levelCompleting) return

    if (willComplete) {
      // Bottle full but no level modal: hold the full glass for a celebration
      // beat, RESET to empty, then advance to a fresh empty card.
      const tComplete = window.setTimeout(() => {
        if (!mounted.current) return
        liquidRef.current?.setFill(0, { animate: true }) // drain to empty
        advanceTimer.current = window.setTimeout(() => {
          advanceTimer.current = null
          if (mounted.current) void loadNext()
        }, ADVANCE_BUFFER)
      }, VOICE_DELAY + CELEBRATION_BEAT)
      winTimers.current.push(tComplete)
    } else {
      // Normal win: glass stays at pourTarget; advance after the voice (scaled
      // to sentence length). The next load re-sets the same level with
      // animate:false → no pour on the fresh card.
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null
        if (mounted.current) void loadNext()
      }, advanceDelayFor(wordCount))
    }
  }, [allFruits, getColorIndex, haptics, hostApi, loadNext, sfx, speak, updateDebug])

  // Called by the DnD layer after every placement/reorder that changes the
  // sentence. Recomputes reading order and checks the win condition.
  const onSentenceChanged = useCallback(() => {
    const store = useGameStore.getState()
    if (store.hasWon) {
      updateDebug()
      return
    }
    const blockLang = store.phrase.blockLang || "en"
    const words = flattenReadingOrder(store.sentenceRows, store.blocks, isRTL(blockLang))
    const won = store.checkWin(words)
    console.log("[juice-squeeze-fire] placement", {
      bank: store.bankOrder.length,
      placed: words.length,
      won,
    })
    if (won) {
      console.log("[juice-squeeze-fire] win detected")
      runWin()
    } else {
      updateDebug()
    }
  }, [runWin, updateDebug])

  // ---- Give-up / ear / fruit ----------------------------------------------
  const speakAnswer = useCallback(() => {
    const { phrase, correctWords } = useGameStore.getState()
    if (!correctWords.length || !phrase.blockLang) return
    speak(phrase.blockLang, joinForTTS(correctWords))
  }, [speak])

  // Eye = silent reveal: shows the answer overlay with NO sound. The headphone
  // (ear) button is the audio-only path (speakAnswer); the two are now distinct.
  const showGiveUp = useCallback(() => {
    const { correctWords } = useGameStore.getState()
    if (!correctWords.length) return
    setGiveUpText(joinForTTS(correctWords))
  }, [])

  const closeGiveUp = useCallback(
    (advance: boolean) => {
      setGiveUpText(null)
      if (advance) void loadNext()
    },
    [loadNext]
  )

  const toggleFruits = useCallback(() => {
    useGameStore.getState().toggleFruits()
  }, [])

  const dismissLevelComplete = useCallback(() => {
    setLevelComplete(null)
    // The bottle filled to full while the modal was up; drain it to empty
    // (animated) so the next card starts on a fresh empty glass. loadNext()'s
    // applyUtterance re-sets fill to the current (now 0) level with no pour.
    liquidRef.current?.setFill(0, { animate: true })
    // Resume the loop after the modal (shipped just hides it; user advances).
    void loadNext()
  }, [loadNext])

  // ---- Lifecycle -----------------------------------------------------------
  const startedRef = useRef(false)
  useEffect(() => {
    mounted.current = true
    if (!startedRef.current) {
      startedRef.current = true
      void loadNext()
    }
    return () => {
      mounted.current = false
      clearWinTimers()
      clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    loading,
    levelComplete,
    giveUpText,
    onSentenceChanged,
    goPrev,
    goNext,
    canPrev: history.canPrev,
    canNext: history.canNext,
    showGiveUp,
    closeGiveUp,
    speakAnswer,
    toggleFruits,
    dismissLevelComplete,
    updateDebug,
    winFlash,
    setLiquidController,
  }
}

// Stack-aware next-level suggestion (shipped game.ts ~1839).
function getNextLevelSuggestion(hostApi: HostApi): CEFRLevel | null {
  const stackLevels = hostApi.getStackConfig().levels ?? []
  if (stackLevels.length === 0) return null
  let highest = -1
  for (const lvl of stackLevels) {
    const idx = LEVEL_ORDER.indexOf(lvl as CEFRLevel)
    if (idx > highest) highest = idx
  }
  if (highest >= 0 && highest < LEVEL_ORDER.length - 1) {
    return LEVEL_ORDER[highest + 1]
  }
  return null
}
