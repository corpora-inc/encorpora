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
 *  - win TTS: speak(blockLang, joinForTTS(correctWords)) after ~VOICE_DELAY.
 *  - AUTO-ADVANCE is INTENTIONAL (a deliberate change from shipped, NOT a parity
 *    miss): after the win celebration (chime -> pour -> voice) the game advances
 *    to the next phrase, delay scaled to sentence length so long ones are heard.
 *    The shipped pack stays on the completed phrase; we advance instead because
 *    it keeps the fast-paced ASMR flow — the player can review a previous phrase
 *    via the prev/swipe history. On bottle-complete the LevelComplete modal shows
 *    first and its Continue loads the next.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import type { HostApi } from "../sdk/types"
import { useGameStore, BASKET_SIZE, type CompletedPhrase } from "../state/gameStore"
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
import { launchJarFly, JAR_FLY_MS } from "../components/jarFly"
import { launchBasketCarry, BASKET_CARRY_MS } from "../components/basketCarry"
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
  // The just-completed bottle's phrases, captured for the review BEFORE a basket
  // can clear the shelf (a level finishing on a 6-jar basket boundary would
  // otherwise leave the modal reading an emptied collection → "noPhrases").
  phrases: CompletedPhrase[]
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
  const basketCleanup = useRef<(() => void) | null>(null)
  const mounted = useRef(true)
  // Next bottle's color, stashed during a bottle-complete so the level modal's
  // Continue (dismissLevelComplete) can apply it AFTER the juice has drained.
  const pendingColorRef = useRef<number | null>(null)

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
    if (basketCleanup.current) {
      basketCleanup.current()
      basketCleanup.current = null
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
    // Next bottle's color — computed now but applied only AFTER the current juice
    // fills/caps/drains, so the full pour shows the CURRENT color, not the next.
    const nextColor = (colorIndex + 1) % allFruits.length

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

    // ---- NORMAL win: advance after the voice (scaled to sentence length) -----
    if (!willComplete) {
      advanceTimer.current = window.setTimeout(() => {
        advanceTimer.current = null
        if (mounted.current) void loadNext()
      }, advanceDelayFor(wordCount))
      return
    }

    // ---- BOTTLE COMPLETE -----------------------------------------------------
    // The pour above already targets 1.0, so the glass fills to the TOP in its
    // OWN color — the color is NOT changed yet (that was the bug: it switched at
    // t=0 so you watched the NEXT color fill). Sequence:
    //   t≈VOICE_DELAY+BEAT      cap → jar-fly → drain  (still current color)
    //   t≈…+JAR_FLY_MS          switch to next color (glass now empty) → advance
    const after = useGameStore.getState().bottleProgress
    console.log("[juice-squeeze-fire] bottle complete", {
      bottles: after.bottleCollection.length,
      level: after.currentLevel,
    })
    const completedGradient = currentFruit.gradient
    const bp = useGameStore.getState().bottleProgress
    const isLevelDone =
      useGameStore.getState().isLevelComplete() || bp.bottlesCompletedThisLevel >= 99

    // Cap + jar-fly + drain — all in the CURRENT color, at the celebration beat.
    const tCap = window.setTimeout(() => {
      if (!mounted.current) return
      // The jar pops up, the lid drops on, then it flies home. The jar-close
      // sound fires exactly when the lid SEATS (onLidSeat), so cap + clunk land
      // together instead of guessing at a delay.
      haptics.fire("heavy") // a satisfying THUMP as the bottle caps
      jarFlyCleanup.current = launchJarFly(completedGradient, {
        onLidSeat: () => sfx.play("jarClose"),
      })
      liquidRef.current?.setFill(0, { animate: true }) // drain the current juice
    }, VOICE_DELAY + CELEBRATION_BEAT)
    winTimers.current.push(tCap)

    // At the dock moment: if the shelf just hit a full basket, carry it off +
    // mint a coin FIRST (its own beat), then show the level modal / advance.
    const tDock = window.setTimeout(() => {
      if (!mounted.current) return
      const shelf = useGameStore.getState().bottleProgress.bottleCollection
      // Capture the just-completed bottle's phrases NOW, before a basket carry can
      // clear the shelf — the level-complete review renders from this snapshot.
      const completedPhrases: CompletedPhrase[] = shelf[shelf.length - 1]?.phrases ?? []
      let basketDelay = 0
      if (shelf.length >= BASKET_SIZE) {
        basketDelay = BASKET_CARRY_MS
        basketCleanup.current = launchBasketCarry({
          // Jars cloned → clear the real shelf so they don't double up.
          onStart: () => useGameStore.getState().removeBasketJars(BASKET_SIZE),
          // Coin lands in the header counter → mint it + a bright ding + buzz.
          onCoin: () => {
            useGameStore.getState().addCoins(1)
            sfx.play("ping")
            haptics.fire("success")
          },
        })
      }

      const finish = window.setTimeout(() => {
        if (!mounted.current) return
        if (isLevelDone) {
          // Stash next color so dismissLevelComplete applies it on Continue.
          pendingColorRef.current = nextColor
          setLevelComplete({
            fruit: currentFruit,
            bottlesCompleted: bp.bottlesCompletedThisLevel,
            nextLevel: getNextLevelSuggestion(hostApi),
            phrases: completedPhrases,
          })
        } else {
          // Switch the now-empty glass to the next bottle's color, then advance.
          useGameStore.getState().setColorIndex(nextColor)
          advanceTimer.current = window.setTimeout(() => {
            advanceTimer.current = null
            if (mounted.current) void loadNext()
          }, ADVANCE_BUFFER)
        }
      }, basketDelay)
      winTimers.current.push(finish)
    }, VOICE_DELAY + CELEBRATION_BEAT + JAR_FLY_MS)
    winTimers.current.push(tDock)
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
    // The glass already drained during the jar-fly (before this modal showed),
    // so just apply the NEXT bottle's color (deferred until now so the completed
    // juice showed in its OWN color) and load a fresh empty card.
    const next = pendingColorRef.current
    pendingColorRef.current = null
    if (next != null) useGameStore.getState().setColorIndex(next)
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
