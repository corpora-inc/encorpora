import { useState, useCallback, useRef, useEffect } from "react"
import type { HostApi } from "../sdk/types"
import { useGameStore } from "../store/gameState"
import { usePhraseLoader, type LoadedPhrase } from "./usePhraseLoader"
import { useWinDetection } from "./useWinDetection"
import { useTTS } from "./useTTS"
const successSoundUrl = "/sounds/success.mp3"

export function useGameLogic(hostApi: HostApi) {
  const { load: loadPhrase } = usePhraseLoader(hostApi)
  const { speak, speakWithDelay, stop: stopTTS } = useTTS(hostApi)

  const phrase = useGameStore((s) => s.phrase)
  const recordWin = useGameStore((s) => s.recordWin)
  const getCurrentFruit = useGameStore((s) => s.getCurrentFruit)
  const toggleFruits = useGameStore((s) => s.toggleFruits)
  const isLevelComplete = useGameStore((s) => s.isLevelComplete)

  // Phrase history for navigation
  const [phraseHistory, setPhraseHistory] = useState<LoadedPhrase[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Modal states
  const [showAnswerModal, setShowAnswerModal] = useState(false)
  const [showLevelComplete, setShowLevelComplete] = useState(false)

  // Sound effect
  const successSoundRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    successSoundRef.current = new Audio(successSoundUrl)
    successSoundRef.current.preload = "auto"
    successSoundRef.current.volume = 0.9
  }, [])

  const playSuccessSound = useCallback(() => {
    if (successSoundRef.current) {
      successSoundRef.current.currentTime = 0
      successSoundRef.current.play().catch(() => {})
    }
  }, [])

  // Win handler
  const handleWin = useCallback(() => {
    playSuccessSound()

    const wordCount = phrase.correctWords.length
    const fruit = getCurrentFruit()

    // Check bottle state before recording win
    const bottleProgress = useGameStore.getState().bottleProgress
    const wasLevelComplete = isLevelComplete()
    const phrasesBeforeWin = bottleProgress.phrasesInCurrentBottle

    recordWin(
      wordCount,
      phrase.targetText && phrase.blockText && phrase.targetLang && phrase.blockLang
        ? {
            targetText: phrase.targetText,
            blockText: phrase.blockText,
            targetLang: phrase.targetLang,
            blockLang: phrase.blockLang,
          }
        : undefined,
      fruit.gradient
    )

    // Speak the completed phrase
    if (phrase.blockLang && phrase.blockText) {
      speakWithDelay(phrase.blockLang, phrase.blockText, 800)
    }

    // Only show level complete modal when:
    // 1. A bottle was just completed (phrases went from 9 to 0)
    // 2. That bottle completion caused level to become complete (wasn't complete before)
    setTimeout(() => {
      const bottleJustCompleted = phrasesBeforeWin === 9
      const isNowLevelComplete = isLevelComplete()
      if (bottleJustCompleted && isNowLevelComplete && !wasLevelComplete) {
        setShowLevelComplete(true)
      }
    }, 100)
  }, [phrase, recordWin, getCurrentFruit, speakWithDelay, isLevelComplete, playSuccessSound])

  useWinDetection({ onWin: handleWin })

  // Load initial phrase
  const loadNextPhrase = useCallback(async () => {
    const loaded = await loadPhrase()
    if (loaded) {
      setPhraseHistory((prev) => [...prev, loaded])
      setHistoryIndex((prev) => prev + 1)

      // Speak target phrase after delay
      if (loaded.targetLang && loaded.targetText) {
        speakWithDelay(loaded.targetLang, loaded.targetText, 500)
      }
    }
  }, [loadPhrase, speakWithDelay])

  // Navigation
  const canGoPrev = historyIndex > 0
  const canGoNext = true // Can always go to next (loads new phrase)

  const goPrev = useCallback(() => {
    if (!canGoPrev) return
    const newIndex = historyIndex - 1
    const prevPhrase = phraseHistory[newIndex]
    if (prevPhrase) {
      setHistoryIndex(newIndex)
      useGameStore.getState().loadPhrase(
        {
          id: prevPhrase.id,
          targetText: prevPhrase.targetText,
          blockText: prevPhrase.blockText,
          targetLang: prevPhrase.targetLang,
          blockLang: prevPhrase.blockLang,
          correctWords: prevPhrase.correctWords,
        },
        prevPhrase.blocks.map((b) => ({ ...b, zone: "choices" }))
      )
    }
  }, [canGoPrev, historyIndex, phraseHistory])

  const goNext = useCallback(() => {
    if (historyIndex < phraseHistory.length - 1) {
      // Navigate forward in history
      const newIndex = historyIndex + 1
      const nextPhrase = phraseHistory[newIndex]
      if (nextPhrase) {
        setHistoryIndex(newIndex)
        useGameStore.getState().loadPhrase(
          {
            id: nextPhrase.id,
            targetText: nextPhrase.targetText,
            blockText: nextPhrase.blockText,
            targetLang: nextPhrase.targetLang,
            blockLang: nextPhrase.blockLang,
            correctWords: nextPhrase.correctWords,
          },
          nextPhrase.blocks.map((b) => ({ ...b, zone: "choices" }))
        )
      }
    } else {
      // Load new phrase
      loadNextPhrase()
    }
  }, [historyIndex, phraseHistory, loadNextPhrase])

  // TTS handlers
  const speakTarget = useCallback(() => {
    if (phrase.targetLang && phrase.targetText) {
      speak(phrase.targetLang, phrase.targetText)
    }
  }, [phrase, speak])

  const speakBlock = useCallback(() => {
    if (phrase.blockLang && phrase.blockText) {
      speak(phrase.blockLang, phrase.blockText)
    }
  }, [phrase, speak])

  // Show answer
  const handleShowAnswer = useCallback(() => {
    setShowAnswerModal(true)
    // Speak the complete phrase in the block language
    if (phrase.blockLang && phrase.blockText) {
      speak(phrase.blockLang, phrase.blockText)
    }
  }, [phrase.blockLang, phrase.blockText, speak])

  const handleCloseAnswer = useCallback(() => {
    setShowAnswerModal(false)
  }, [])

  // Level complete handlers
  const handleContinuePlaying = useCallback(() => {
    setShowLevelComplete(false)
    loadNextPhrase()
  }, [loadNextPhrase])

  const handleAdvanceLevel = useCallback(() => {
    setShowLevelComplete(false)
    // Level advancement is handled by store when bottles complete
    loadNextPhrase()
  }, [loadNextPhrase])

  return {
    phrase,
    loadNextPhrase,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
    speakTarget,
    speakBlock,
    toggleFruits,
    showAnswerModal,
    handleShowAnswer,
    handleCloseAnswer,
    showLevelComplete,
    handleContinuePlaying,
    handleAdvanceLevel,
    getCurrentFruit,
    stopTTS,
  }
}
