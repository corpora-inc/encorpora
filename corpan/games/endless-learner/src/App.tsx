import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { PointerEvent } from "react"
import type { EntryOut, HostApi, StackConfig } from "./sdk/types"
import type { GameRuntime } from "./runtime"
import { getSfx } from "./audio"
import lunaUrl from "./assets/sfx/luna.mp3"
import { DEFAULT_SETTINGS, type GameSettings, useGameStore } from "./store/gameStore"

type AppProps = {
  hostApi: HostApi
  initialStack?: StackConfig
  runtime: GameRuntime
}

type Round = {
  id: number
  prompt: string
  romanization?: string
  promptLang: string
  answerLang: string
  correctAnswer: string
  correctRomanization?: string
  distractors: Array<{ text: string; romanization?: string }>
  mode: string
}

type PlayerPos = {
  row: number
  col: number
}

type IncomingAnswer = {
  id: number
  text: string
  romanization?: string
  isCorrect: boolean
  row: number
  col: number
  progress: number
  laneOffsetX: number
  laneOffsetY: number
  spawnedAt: number
  travelMs: number
}

type Feedback = {
  type: "correct" | "wrong" | "miss"
  message: string
}

type BootState = "booting" | "ready" | "error"

const GRID_SIZE = 3
const GRID_SPAN_RATIO = 0.98

type Layout = {
  cellWidth: number
  cellHeight: number
  gapX: number
  gapY: number
  spanWidth: number
  spanHeight: number
  offsetX: number
  offsetY: number
  viewWidth: number
  viewHeight: number
}

const computeLayout = (width: number, height: number): Layout => {
  const spanWidth = width * GRID_SPAN_RATIO
  const spanHeight = height * GRID_SPAN_RATIO
  const gapX = Math.min(20, spanWidth * 0.02)
  const gapY = Math.min(22, spanHeight * 0.02)
  const cellWidth =
    (spanWidth - gapX * (GRID_SIZE - 1)) / GRID_SIZE
  const cellHeight =
    (spanHeight - gapY * (GRID_SIZE - 1)) / GRID_SIZE
  const spanWithGapX =
    cellWidth * GRID_SIZE + gapX * (GRID_SIZE - 1)
  const spanWithGapY =
    cellHeight * GRID_SIZE + gapY * (GRID_SIZE - 1)
  const offsetX = spanWithGapX / 2 - cellWidth / 2
  const offsetY = spanWithGapY / 2 - cellHeight / 2
  return {
    cellWidth,
    cellHeight,
    gapX,
    gapY,
    spanWidth: spanWithGapX,
    spanHeight: spanWithGapY,
    offsetX,
    offsetY,
    viewWidth: width,
    viewHeight: height,
  }
}

const ANSWER_TRAVEL_MS = 9000
const ANSWER_GAP_MS = 2400
const POST_CORRECT_PAUSE_MS = 3200
const SPEAK_REPEAT_MS = 7700
const NATIVE_REPEAT_MULT = 2
const FEEDBACK_CLEAR_MS = 1800
const IMPACT_HOLD_MS = 240
const MAX_WRONG_BEFORE_CORRECT = 2
const SKIP_SCORE = 2
const DISTRACTOR_TARGET = 10
const TOKEN_VIEW_MARGIN_MIN = 12
const TOKEN_VIEW_MARGIN_MAX = 48
const MIN_SPEED = 0.6
const MAX_SPEED = 2.2
const MIN_CANDIDATES = 1
const MAX_CANDIDATES = 9
const PREFETCH_TARGET = 6


const DEBUG = false

const MODE_LABELS = {
  nativeToLearning: "Native → Learning",
  learningToLearning: "Learning → Learning",
  learningToNative: "Learning → Native",
  learningToLearningAlt: "Learning → Learning+",
}

const emptyRound: Round = {
  id: 0,
  prompt: "",
  promptLang: "",
  answerLang: "",
  correctAnswer: "",
  correctRomanization: undefined,
  distractors: [],
  mode: "",
}

const baseLang = (code: string) => code.split("-")[0] ?? code

const buildLookup = (entry: EntryOut | null) => {
  const textByCode: Record<string, string> = {}
  const romByCode: Record<string, string | undefined> = {}
  if (!entry) {
    return { textByCode, romByCode }
  }
  entry.translations.forEach((tr) => {
    textByCode[tr.language_code] = tr.text
    romByCode[tr.language_code] = tr.romanization
  })
  return { textByCode, romByCode }
}

const pickText = (map: Record<string, string>, uiCode: string) => {
  const base = baseLang(uiCode)
  return map[uiCode] ?? map[base] ?? ""
}

const pickRom = (map: Record<string, string | undefined>, uiCode: string) => {
  const base = baseLang(uiCode)
  return map[uiCode] ?? map[base]
}

const pickRandom = <T,>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)]

const uniquePush = (arr: string[], value: string) => {
  if (!value || arr.includes(value)) {
    return false
  }
  arr.push(value)
  return true
}

const uniquePushText = (
  arr: Array<{ text: string; romanization?: string }>,
  value: { text: string; romanization?: string }
) => {
  if (!value.text || arr.some((entry) => entry.text === value.text)) {
    return false
  }
  arr.push(value)
  return true
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const gridToPosition = (row: number, col: number, layout: Layout) => {
  return {
    x: col * (layout.cellWidth + layout.gapX) - layout.offsetX,
    y: row * (layout.cellHeight + layout.gapY) - layout.offsetY,
  }
}

const positionToGrid = (
  x: number,
  y: number,
  layout: Layout
): PlayerPos => {
  const stepX = layout.cellWidth + layout.gapX
  const stepY = layout.cellHeight + layout.gapY
  const col = Math.round((x + layout.offsetX) / stepX)
  const row = Math.round((y + layout.offsetY) / stepY)
  return {
    row: clamp(row, 0, GRID_SIZE - 1),
    col: clamp(col, 0, GRID_SIZE - 1),
  }
}

const laneCornerOffset = (row: number, col: number, layout: Layout) => {
  const rowFactor = row - 1
  const colFactor = col - 1
  const cornerX = layout.cellWidth * 0.38
  const cornerY = layout.cellHeight * 0.38
  return {
    x: colFactor * cornerX,
    y: rowFactor * cornerY,
  }
}

const curveOffset = (progress: number, layout: Layout, seed: number) => {
  const fade = 1 - progress
  const sway =
    Math.sin(progress * Math.PI * 1.15 + seed) *
    layout.cellWidth *
    0.16 *
    fade
  const lift =
    Math.cos(progress * Math.PI * 0.9 + seed) *
    layout.cellHeight *
    0.1 *
    fade
  return { x: sway, y: lift }
}

export function App({ hostApi, initialStack, runtime }: AppProps) {
  const [stack, setStack] = useState<StackConfig>(
    initialStack ?? hostApi.getStackConfig()
  )
  const settings = useGameStore((state) => state.settings)
  const score = useGameStore((state) => state.stats.score)
  const streak = useGameStore((state) => state.stats.streak)
  const setSettings = useGameStore((state) => state.setSettings)
  const incrementScore = useGameStore((state) => state.incrementScore)
  const incrementStreak = useGameStore((state) => state.incrementStreak)
  const resetStreak = useGameStore((state) => state.resetStreak)
  const [round, setRound] = useState<Round>(emptyRound)
  const [activeAnswers, setActiveAnswers] = useState<IncomingAnswer[]>([])
  const [playerPos, setPlayerPos] = useState<PlayerPos>({ row: 1, col: 1 })
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [draftSettings, setDraftSettings] =
    useState<GameSettings>(settings)
  const [bootState, setBootState] = useState<BootState>("booting")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [layout, setLayout] = useState<Layout>(() =>
    computeLayout(
      typeof window !== "undefined" ? window.innerWidth : 1024,
      typeof window !== "undefined" ? window.innerHeight : 768
    )
  )
  const sfx = useMemo(() => getSfx(), [])
  const bgmRef = useRef<HTMLAudioElement | null>(null)
  const arenaRef = useRef<HTMLDivElement | null>(null)
  const cleanupActionsRef = useRef<Set<() => void>>(new Set())

  const roundRef = useRef<Round>(round)
  const stackRef = useRef<StackConfig>(stack)
  const playerPosRef = useRef<PlayerPos>(playerPos)
  const activeAnswersRef = useRef<IncomingAnswer[]>(activeAnswers)
  const layoutRef = useRef<Layout>(layout)
  const roundIdRef = useRef(0)
  const solvedRef = useRef(false)
  const wrongSinceCorrectRef = useRef(0)
  const answerTimeoutRef = useRef<number | null>(null)
  const roundTimeoutRef = useRef<number | null>(null)
  const feedbackTimeoutRef = useRef<number | null>(null)
  const speakTimeoutRef = useRef<number | null>(null)
  const impactTimeoutsRef = useRef<Map<number, number>>(new Map())
  const startedRef = useRef(false)
  const curveSeedRef = useRef(Math.random() * Math.PI * 2)
  const lastWrongTextRef = useRef<string | null>(null)
  const sfxUnlockedRef = useRef(false)
  const bgmUnlockedRef = useRef(false)
  const streakRef = useRef(0)
  const isPausedRef = useRef(false)
  const pauseStartedRef = useRef<number | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const isDisposedRef = useRef(false)
  const roundQueueRef = useRef<Round[]>([])
  const prefetchingRef = useRef(false)
  const prefetchTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const audio = new Audio(lunaUrl)
    audio.loop = true
    audio.preload = "auto"
    audio.volume = settings.musicVolume
    bgmRef.current = audio
    return () => {
      audio.pause()
      audio.src = ""
      bgmRef.current = null
    }
  }, [])

  useEffect(() => {
    sfx.setVolume(settings.sfxVolume)
  }, [sfx, settings.sfxVolume])

  useEffect(() => {
    const bgm = bgmRef.current
    if (bgm) {
      bgm.volume = settings.musicVolume
    }
  }, [settings.musicVolume])

  useEffect(() => {
    setIsPaused(settingsOpen)
    if (settingsOpen) {
      setDraftSettings(settings)
    } else {
      setSettings(draftSettings)
    }
  }, [settings, settingsOpen])

  useEffect(() => {
    roundRef.current = round
  }, [round])

  useEffect(() => {
    stackRef.current = stack
  }, [stack])

  useEffect(() => {
    playerPosRef.current = playerPos
  }, [playerPos])

  useEffect(() => {
    activeAnswersRef.current = activeAnswers
  }, [activeAnswers])

  useEffect(() => {
    streakRef.current = streak
  }, [streak])

  useEffect(() => {
    isPausedRef.current = isPaused
  }, [isPaused])

  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const onResize = () => {
      setLayout(computeLayout(window.innerWidth, window.innerHeight))
    }
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }
    const unlock = () => {
      if (!sfxUnlockedRef.current) {
        sfx.unlock()
        sfxUnlockedRef.current = true
      }
      const bgm = bgmRef.current
      if (!bgm || bgmUnlockedRef.current) {
        return
      }
      void bgm.play().catch(() => { })
      bgmUnlockedRef.current = true
    }
    window.addEventListener("pointerdown", unlock, { passive: true })
    window.addEventListener("keydown", unlock)
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [sfx])

  useEffect(() => {
    const unsubscribe = hostApi.onStackConfigChange?.((next) => {
      setStack(next)
    })
    return () => {
      unsubscribe?.()
    }
  }, [hostApi])

  const clearTimers = useCallback(() => {
    if (answerTimeoutRef.current) {
      window.clearTimeout(answerTimeoutRef.current)
    }
    if (roundTimeoutRef.current) {
      window.clearTimeout(roundTimeoutRef.current)
    }
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current)
    }
    if (speakTimeoutRef.current) {
      window.clearTimeout(speakTimeoutRef.current)
    }
    impactTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId)
    })
    impactTimeoutsRef.current.clear()
  }, [])

  const clearImpactTimer = useCallback((answerId: number) => {
    const timeoutId = impactTimeoutsRef.current.get(answerId)
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      impactTimeoutsRef.current.delete(answerId)
    }
  }, [])

  const clearAllAnswers = useCallback(() => {
    impactTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId)
    })
    impactTimeoutsRef.current.clear()
    setActiveAnswers([])
  }, [])

  const stopBgm = useCallback(() => {
    const bgm = bgmRef.current
    if (!bgm) {
      return
    }
    bgm.pause()
    bgm.currentTime = 0
    bgm.src = ""
    bgm.load()
  }, [])

  const ensureBgmStart = useCallback(() => {
    const bgm = bgmRef.current
    if (!bgm || bgmUnlockedRef.current) {
      return
    }
    void bgm.play()
      .then(() => {
        bgmUnlockedRef.current = true
      })
      .catch(() => {})
  }, [])

  const runCleanup = useCallback(() => {
    cleanupActionsRef.current.forEach((cleanup) => {
      try {
        cleanup()
      } catch {
        // Best-effort cleanup.
      }
    })
    cleanupActionsRef.current.clear()
  }, [])

  const clearRoundQueue = useCallback(() => {
    roundQueueRef.current = []
  }, [])

  const removeAnswer = useCallback(
    (answerId: number) => {
      clearImpactTimer(answerId)
      setActiveAnswers((prev) => prev.filter((answer) => answer.id !== answerId))
    },
    [clearImpactTimer]
  )

  useEffect(() => {
    cleanupActionsRef.current.clear()
    cleanupActionsRef.current.add(() => {
      clearTimers()
    })
    cleanupActionsRef.current.add(() => {
      clearAllAnswers()
    })
    cleanupActionsRef.current.add(() => {
      hostApi.stopSpeech?.()
    })
    cleanupActionsRef.current.add(() => {
      sfx.dispose()
    })
    cleanupActionsRef.current.add(() => {
      stopBgm()
    })
    cleanupActionsRef.current.add(() => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    })
    cleanupActionsRef.current.add(() => {
      if (prefetchTimerRef.current) {
        window.clearTimeout(prefetchTimerRef.current)
        prefetchTimerRef.current = null
      }
      prefetchingRef.current = false
      clearRoundQueue()
    })
    return () => {
      isDisposedRef.current = true
      runCleanup()
    }
  }, [clearAllAnswers, clearRoundQueue, clearTimers, hostApi, runCleanup, sfx, stopBgm])

  const handleVisibility = useCallback(() => {
    if (document.visibilityState === "hidden") {
      stopBgm()
    }
  }, [stopBgm])

  useEffect(() => {
    let intervalId: number | null = null
    intervalId = window.setInterval(() => {
      if (!runtime.isActive() && !isDisposedRef.current) {
        isDisposedRef.current = true
        runCleanup()
      }
    }, 500)
    return () => {
      if (intervalId) {
        window.clearInterval(intervalId)
      }
    }
  }, [runCleanup, runtime])

  useEffect(() => {
    window.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("pagehide", handleVisibility)
    window.addEventListener("blur", handleVisibility)
    return () => {
      window.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("pagehide", handleVisibility)
      window.removeEventListener("blur", handleVisibility)
    }
  }, [handleVisibility])

  useEffect(() => {
    if (activeAnswersRef.current.length <= settings.maxCandidates) {
      return
    }
    setActiveAnswers((prev) => {
      if (prev.length <= settings.maxCandidates) {
        return prev
      }
      const trimmed = prev.slice(-settings.maxCandidates)
      const keepIds = new Set(trimmed.map((answer) => answer.id))
      prev.forEach((answer) => {
        if (!keepIds.has(answer.id)) {
          clearImpactTimer(answer.id)
        }
      })
      return trimmed
    })
  }, [clearImpactTimer, settings.maxCandidates])

  useEffect(() => {
    clearRoundQueue()
    schedulePrefetch()
  }, [clearRoundQueue, schedulePrefetch, settings.maxCandidates, stack])

  const buildRound = useCallback(async (): Promise<Round> => {
    if (!runtime.isActive()) {
      return emptyRound
    }
    if (!hostApi.getRandomEntry) {
      return emptyRound
    }

    const stackSettings = stackRef.current
    const languages = stackSettings.languages.length
      ? stackSettings.languages
      : ["en"]
    const nativeLang = languages[0] ?? "en"
    const learningLangs = languages.slice(1)
    const modes = ["learningToNative"]
    if (learningLangs.length > 0) {
      modes.push("nativeToLearning")
    }

    const mode = pickRandom(modes)
    let promptLang = nativeLang
    let answerLang = nativeLang

    if (mode === "nativeToLearning") {
      promptLang = nativeLang
      answerLang = pickRandom(learningLangs.length ? learningLangs : [nativeLang])
    } else if (mode === "learningToNative") {
      promptLang = pickRandom(learningLangs.length ? learningLangs : [nativeLang])
      answerLang = nativeLang
    } else {
      promptLang = pickRandom(learningLangs.length ? learningLangs : [nativeLang])
      answerLang = nativeLang
    }

    const maxAttempts = 8
    let entry: EntryOut | null = null
    let lookup:
      | { textByCode: Record<string, string>; romByCode: Record<string, string | undefined> }
      | null = null

    for (let i = 0; i < maxAttempts; i += 1) {
      try {
        const candidate = await hostApi.getRandomEntry()
        const candidateLookup = buildLookup(candidate)
        if (
          pickText(candidateLookup.textByCode, promptLang) &&
          pickText(candidateLookup.textByCode, answerLang)
        ) {
          entry = candidate
          lookup = candidateLookup
          break
        }
      } catch {
        // Retry when the host data isn't ready yet.
      }
    }

    if (!entry || !lookup) {
      return emptyRound
    }

    const promptText = pickText(lookup.textByCode, promptLang)
    const romanization = pickRom(lookup.romByCode, promptLang)
    const correct = pickText(lookup.textByCode, answerLang)
    const correctRomanization = pickRom(lookup.romByCode, answerLang)

    const distractorTarget = Math.max(
      DISTRACTOR_TARGET,
      settings.maxCandidates * 3
    )
    const distractors: Array<{ text: string; romanization?: string }> = []
    for (let i = 0; i < maxAttempts && distractors.length < distractorTarget; i += 1) {
      try {
        const distractor = await hostApi.getRandomEntry()
        const distractLookup = buildLookup(distractor)
        const distractText = pickText(distractLookup.textByCode, answerLang)
        if (distractText && distractText !== correct) {
          const distractRom = pickRom(distractLookup.romByCode, answerLang)
          uniquePushText(distractors, {
            text: distractText,
            romanization: distractRom,
          })
        }
      } catch {
        // Retry when the host data isn't ready yet.
      }
    }

    return {
      id: roundIdRef.current + 1,
      prompt: promptText,
      romanization,
      promptLang,
      answerLang,
      correctAnswer: correct,
      correctRomanization,
      distractors,
      mode: MODE_LABELS[mode as keyof typeof MODE_LABELS] ?? "Run",
    }
  }, [hostApi, runtime, settings.maxCandidates])

  const fillRoundQueue = useCallback(async () => {
    if (prefetchingRef.current) {
      return
    }
    prefetchingRef.current = true
    try {
      while (
        runtime.isActive() &&
        !isDisposedRef.current &&
        roundQueueRef.current.length < PREFETCH_TARGET
      ) {
        const next = await buildRound()
        if (next.prompt) {
          roundQueueRef.current.push(next)
        }
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      }
    } finally {
      prefetchingRef.current = false
    }
  }, [buildRound, runtime])

  const schedulePrefetch = useCallback(() => {
    if (prefetchTimerRef.current || prefetchingRef.current) {
      return
    }
    const idle = window.requestIdleCallback
    if (idle) {
      const id = idle(() => {
        prefetchTimerRef.current = null
        void fillRoundQueue()
      })
      prefetchTimerRef.current = id as unknown as number
      return
    }
    prefetchTimerRef.current = window.setTimeout(() => {
      prefetchTimerRef.current = null
      void fillRoundQueue()
    }, 16)
  }, [fillRoundQueue])

  const getSpeedMultiplier = useCallback(() => {
    const base = settings.baseSpeed
    if (!settings.adaptiveSpeed) {
      return clamp(base, MIN_SPEED, MAX_SPEED)
    }
    const streakBoost = streakRef.current * 0.04
    const wrongPenalty = wrongSinceCorrectRef.current * 0.12
    return clamp(base * (1 + streakBoost - wrongPenalty), MIN_SPEED, MAX_SPEED)
  }, [settings.adaptiveSpeed, settings.baseSpeed])

  const getTravelMs = useCallback(
    () => Math.round(ANSWER_TRAVEL_MS / getSpeedMultiplier()),
    [getSpeedMultiplier]
  )

  const getGapMs = useCallback(
    () => Math.round(ANSWER_GAP_MS / getSpeedMultiplier()),
    [getSpeedMultiplier]
  )

  const scheduleNextAnswer = useCallback(
    (delayMs?: number) => {
      if (
        !runtime.isActive() ||
        isPausedRef.current ||
        isDisposedRef.current
      ) {
        return
      }
      if (answerTimeoutRef.current) {
        window.clearTimeout(answerTimeoutRef.current)
      }
      const waitMs = delayMs ?? getGapMs()
      answerTimeoutRef.current = window.setTimeout(() => {
        if (!runtime.isActive() || isPausedRef.current) {
          return
        }
        if (isDisposedRef.current) {
          return
        }
        const liveLayout = layoutRef.current
        const current = roundRef.current
        if (!current || !current.prompt) {
          return
        }
        if (activeAnswersRef.current.length >= settings.maxCandidates) {
          scheduleNextAnswer(320)
          return
        }

        const activeTexts = new Set(
          activeAnswersRef.current.map((answer) => answer.text)
        )
        const forceCorrect =
          wrongSinceCorrectRef.current >= MAX_WRONG_BEFORE_CORRECT
        let useCorrect = forceCorrect || Math.random() < settings.correctChance
        if (useCorrect && activeTexts.has(current.correctAnswer)) {
          useCorrect = false
        }
        let text = current.correctAnswer
        let romanization = current.correctRomanization
        if (!useCorrect) {
          const lastWrong = lastWrongTextRef.current
          const options = lastWrong
            ? current.distractors.filter(
                (choice) =>
                  choice.text &&
                  choice.text !== lastWrong &&
                  !activeTexts.has(choice.text)
              )
            : current.distractors.filter(
                (choice) => choice.text && !activeTexts.has(choice.text)
              )
          const picks = options.length ? options : current.distractors
          const picked = pickRandom(picks)
          if (picked?.text) {
            text = picked.text
            romanization = picked.romanization
          } else {
            if (activeTexts.has(current.correctAnswer)) {
              scheduleNextAnswer(240)
              return
            }
            useCorrect = true
            text = current.correctAnswer
            romanization = current.correctRomanization
          }
        }

        const occupied = new Set(
          activeAnswersRef.current.map((answer) => `${answer.row},${answer.col}`)
        )
        const available: Array<{ row: number; col: number }> = []
        for (let r = 0; r < GRID_SIZE; r += 1) {
          for (let c = 0; c < GRID_SIZE; c += 1) {
            if (!occupied.has(`${r},${c}`)) {
              available.push({ row: r, col: c })
            }
          }
        }
        if (!available.length) {
          scheduleNextAnswer(240)
          return
        }
        const pick = pickRandom(available)
        const row = pick.row
        const col = pick.col
        const corner = laneCornerOffset(row, col, liveLayout)
        const jitterX = liveLayout.cellWidth * 0.05
        const jitterY = liveLayout.cellHeight * 0.05
        const laneOffsetX = corner.x + (Math.random() - 0.5) * jitterX
        const laneOffsetY = corner.y + (Math.random() - 0.5) * jitterY

        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.info("[endless-learner] spawn", {
            text,
            isCorrect: useCorrect,
            row,
            col,
          })
        }

        wrongSinceCorrectRef.current = useCorrect
          ? 0
          : wrongSinceCorrectRef.current + 1
        if (useCorrect) {
          lastWrongTextRef.current = null
        } else {
          lastWrongTextRef.current = text
        }

        const spawnedAt = performance.now()
        const travelMs = getTravelMs()
        setActiveAnswers((prev) => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            text,
            romanization,
            isCorrect: useCorrect,
            row,
            col,
            progress: 0,
            laneOffsetX,
            laneOffsetY,
            spawnedAt,
            travelMs,
          },
        ])
        scheduleNextAnswer()
      }, waitMs)
    },
    [getGapMs, getTravelMs, runtime, settings.correctChance, settings.maxCandidates]
  )

  const speakPrompt = useCallback(() => {
    if (
      !runtime.isActive() ||
      isPausedRef.current ||
      isDisposedRef.current
    ) {
      return
    }
    const current = roundRef.current
    if (!current?.prompt) {
      return
    }
    hostApi.speak(current.promptLang, current.prompt)
  }, [hostApi, runtime])

  const scheduleSpeakRepeat = useCallback(() => {
    if (
      !runtime.isActive() ||
      isPausedRef.current ||
      isDisposedRef.current
    ) {
      return
    }
    const settings = stackRef.current
    const nativeLang = settings.languages[0]
    const current = roundRef.current
    const isNativePrompt = current?.promptLang === nativeLang
    const repeatMs = Math.round(
      SPEAK_REPEAT_MS * (isNativePrompt ? NATIVE_REPEAT_MULT : 1)
    )
    if (speakTimeoutRef.current) {
      window.clearTimeout(speakTimeoutRef.current)
    }
    speakTimeoutRef.current = window.setTimeout(() => {
      if (!runtime.isActive()) {
        return
      }
      if (!solvedRef.current) {
        speakPrompt()
        scheduleSpeakRepeat()
      }
    }, repeatMs)
  }, [runtime, speakPrompt])

  const prepareRound = useCallback(async (): Promise<Round | null> => {
    const maxTries = 8
    for (let i = 0; i < maxTries; i += 1) {
      if (!runtime.isActive() || isDisposedRef.current) {
        return null
      }
      try {
        const queued = roundQueueRef.current.shift()
        const next = queued ?? (await buildRound())
        if (next.prompt) {
          schedulePrefetch()
          return next
        }
      } catch {
        // Retry when host data isn't ready yet.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 300))
    }
    return null
  }, [buildRound, runtime, schedulePrefetch])

  const beginRound = useCallback(
    (next: Round) => {
      clearTimers()
      solvedRef.current = false
      wrongSinceCorrectRef.current = 0
      if (startedRef.current) {
        hostApi.stopSpeech?.()
      }
      startedRef.current = true
      curveSeedRef.current = Math.random() * Math.PI * 2
      roundIdRef.current = next.id
      setRound(next)
      clearAllAnswers()
      setFeedback(null)
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.info("[endless-learner] round", next)
      }
      scheduleNextAnswer()
      scheduleSpeakRepeat()
    },
    [clearAllAnswers, clearTimers, hostApi, scheduleNextAnswer, scheduleSpeakRepeat]
  )

  const startRound = useCallback(async () => {
    if (!runtime.isActive() || isDisposedRef.current) {
      return
    }
    const next = await prepareRound()
    if (!next) {
      setBootState("error")
      return
    }
    beginRound(next)
    setBootState("ready")
  }, [beginRound, prepareRound, runtime])

  const retryBoot = useCallback(() => {
    if (bootState !== "error") {
      return
    }
    clearTimers()
    clearAllAnswers()
    ensureBgmStart()
    setBootState("booting")
    void startRound()
  }, [bootState, clearAllAnswers, clearTimers, ensureBgmStart, startRound])

  useEffect(() => {
    if (isPaused) {
      pauseStartedRef.current = performance.now()
      clearTimers()
      hostApi.stopSpeech?.()
      return
    }
    const pausedAt = pauseStartedRef.current
    if (pausedAt != null) {
      const delta = performance.now() - pausedAt
      if (delta > 0) {
        setActiveAnswers((prev) =>
          prev.map((answer) => ({
            ...answer,
            spawnedAt: answer.spawnedAt + delta,
          }))
        )
      }
      pauseStartedRef.current = null
    }
    if (runtime.isActive() && bootState === "ready") {
      scheduleNextAnswer(240)
      scheduleSpeakRepeat()
    }
  }, [
    bootState,
    clearTimers,
    hostApi,
    isPaused,
    runtime,
    scheduleNextAnswer,
    scheduleSpeakRepeat,
  ])

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      setBootState("booting")
      clearTimers()
      clearAllAnswers()
      ensureBgmStart()
      clearRoundQueue()
      schedulePrefetch()
      const next = await prepareRound()
      if (cancelled) {
        return
      }
      if (!next) {
        setBootState("error")
        return
      }
      beginRound(next)
      setBootState("ready")
    }
    void boot()
    return () => {
      cancelled = true
      clearTimers()
      hostApi.stopSpeech?.()
    }
  }, [
    beginRound,
    clearAllAnswers,
    clearRoundQueue,
    clearTimers,
    ensureBgmStart,
    hostApi,
    prepareRound,
    schedulePrefetch,
  ])

  useEffect(() => {
    speakPrompt()
    scheduleSpeakRepeat()
    return () => {
      if (speakTimeoutRef.current) {
        window.clearTimeout(speakTimeoutRef.current)
      }
    }
  }, [round.id, scheduleSpeakRepeat, speakPrompt])

  const resolveAnswer = useCallback(
    (result: "correct" | "wrong" | "miss", answer: IncomingAnswer) => {
      if (!runtime.isActive()) {
        return
      }
      removeAnswer(answer.id)
      const current = roundRef.current
      if (!current) {
        return
      }

      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.info("[endless-learner] resolve", {
          result,
          answer,
          prompt: current.prompt,
          correct: current.correctAnswer,
        })
      }

      if (result === "correct") {
        solvedRef.current = true
        clearTimers()
        incrementScore(10)
        incrementStreak()
        sfx.playSuccess()
        clearAllAnswers()
        setFeedback({
          type: "correct",
          message: `Correct: ${current.correctAnswer}`,
        })
        feedbackTimeoutRef.current = window.setTimeout(() => {
          setFeedback(null)
        }, FEEDBACK_CLEAR_MS)
        hostApi.stopSpeech?.()
        hostApi.speak(current.answerLang, current.correctAnswer)
        roundTimeoutRef.current = window.setTimeout(() => {
          void startRound()
        }, POST_CORRECT_PAUSE_MS)
        return
      }

      if (result === "miss" && answer.isCorrect) {
        setFeedback({
          type: "miss",
          message: `That was correct: ${current.correctAnswer}`,
        })
        hostApi.stopSpeech?.()
        hostApi.speak(current.answerLang, current.correctAnswer)
      } else if (result === "wrong") {
        setFeedback({
          type: "wrong",
          message: `Not quite. Try again.`,
        })
        sfx.playFail()
      }

      resetStreak()
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedback(null)
      }, FEEDBACK_CLEAR_MS)
      scheduleNextAnswer()
    },
    [
      clearAllAnswers,
      clearTimers,
      hostApi,
      incrementScore,
      incrementStreak,
      removeAnswer,
      resetStreak,
      runtime,
      scheduleNextAnswer,
      startRound,
    ]
  )

  const resolveSkip = useCallback(
    (answer: IncomingAnswer) => {
      if (!runtime.isActive()) {
        return
      }
      removeAnswer(answer.id)
      if (answer.isCorrect) {
        setFeedback({
          type: "miss",
          message: `That was correct: ${roundRef.current?.correctAnswer ?? ""}`,
        })
        resetStreak()
        sfx.playFail()
      } else {
        setFeedback({
          type: "correct",
          message: "Nice skip",
        })
        incrementScore(SKIP_SCORE)
        incrementStreak()
        sfx.playSuccess()
      }
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedback(null)
      }, FEEDBACK_CLEAR_MS)
      scheduleNextAnswer()
    },
    [incrementScore, incrementStreak, removeAnswer, resetStreak, runtime, scheduleNextAnswer]
  )

  useEffect(() => {
    if (!runtime.isActive()) {
      return
    }
    let animationFrame = 0

    const tick = (time: number) => {
      if (!runtime.isActive() || isDisposedRef.current) {
        return
      }
      if (isPausedRef.current) {
        animationFrame = requestAnimationFrame(tick)
        rafIdRef.current = animationFrame
        return
      }
      const current = activeAnswersRef.current
      if (current.length) {
        let didChange = false
        const updated = current.map((answer) => {
          const progress = Math.min(
            (time - answer.spawnedAt) / answer.travelMs,
            1
          )
          if (progress !== answer.progress) {
            didChange = true
            return { ...answer, progress }
          }
          return answer
        })
        if (didChange) {
          setActiveAnswers(updated)
        }
        updated.forEach((answer) => {
          if (
            answer.progress < 1 ||
            impactTimeoutsRef.current.has(answer.id)
          ) {
            return
          }
          const timeoutId = window.setTimeout(() => {
            if (!runtime.isActive()) {
              return
            }
            const pos = playerPosRef.current
            const inLane =
              pos.row === answer.row && pos.col === answer.col
            if (inLane) {
              resolveAnswer(
                answer.isCorrect ? "correct" : "wrong",
                answer
              )
            } else {
              resolveSkip(answer)
            }
          }, IMPACT_HOLD_MS)
          impactTimeoutsRef.current.set(answer.id, timeoutId)
        })
      }

      animationFrame = requestAnimationFrame(tick)
      rafIdRef.current = animationFrame
    }

    animationFrame = requestAnimationFrame(tick)
    rafIdRef.current = animationFrame
    return () => cancelAnimationFrame(animationFrame)
  }, [resolveAnswer, resolveSkip, runtime])

  const movePlayer = useCallback((rowDelta: number, colDelta: number) => {
    setPlayerPos((prev) => ({
      row: clamp(prev.row + rowDelta, 0, GRID_SIZE - 1),
      col: clamp(prev.col + colDelta, 0, GRID_SIZE - 1),
    }))
  }, [])

  const selectActive = useCallback(() => {
    const currentAnswers = activeAnswersRef.current
    if (!currentAnswers.length) {
      return
    }
    if (!runtime.isActive() || isPausedRef.current) {
      return
    }
    const pos = playerPosRef.current
    const target =
      currentAnswers
        .filter((answer) => answer.row === pos.row && answer.col === pos.col)
        .sort((a, b) => b.progress - a.progress)[0] ??
      currentAnswers
        .slice()
        .sort((a, b) => b.progress - a.progress)[0]
    if (!target) {
      return
    }
    const inLane = pos.row === target.row && pos.col === target.col
    if (inLane) {
      resolveAnswer(target.isCorrect ? "correct" : "wrong", target)
    } else {
      resolveSkip(target)
    }
  }, [resolveAnswer, resolveSkip, runtime])

  const handleArenaPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (
        !runtime.isActive() ||
        isPausedRef.current ||
        isDisposedRef.current
      ) {
        return
      }
      const rect = arenaRef.current?.getBoundingClientRect()
      if (!rect) {
        return
      }
      const localX = event.clientX - rect.left - rect.width / 2
      const localY = event.clientY - rect.top - rect.height / 2
      const nextPos = positionToGrid(localX, localY, layoutRef.current)
      setPlayerPos(nextPos)

      const currentAnswers = activeAnswersRef.current
      if (!currentAnswers.length) {
        return
      }
      const target = currentAnswers
        .filter(
          (answer) =>
            answer.row === nextPos.row && answer.col === nextPos.col
        )
        .sort((a, b) => b.progress - a.progress)[0]
      if (!target) {
        return
      }
      resolveAnswer(target.isCorrect ? "correct" : "wrong", target)
    },
    [resolveAnswer, runtime]
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isDisposedRef.current) {
        return
      }
      if (isPausedRef.current) {
        return
      }
      if (event.key === "ArrowUp" || event.key === "w") {
        movePlayer(-1, 0)
      }
      if (event.key === "ArrowDown" || event.key === "s") {
        movePlayer(1, 0)
      }
      if (event.key === "ArrowLeft" || event.key === "a") {
        movePlayer(0, -1)
      }
      if (event.key === "ArrowRight" || event.key === "d") {
        movePlayer(0, 1)
      }
      if (event.key === " ") {
        speakPrompt()
      }
      if (event.key === "Enter") {
        selectActive()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [movePlayer, selectActive, speakPrompt])

  const buildAnswerStyle = useCallback(
    (answer: IncomingAnswer) => {
      const base = gridToPosition(answer.row, answer.col, layout)
      const curve = curveOffset(answer.progress, layout, curveSeedRef.current)
      const corner = {
        x: answer.laneOffsetX,
        y: answer.laneOffsetY,
      }
      const baseWidth = layout.cellWidth
      const baseHeight = layout.cellHeight
      const minSide = Math.min(baseWidth, baseHeight)
      const scale = 0.25 + answer.progress * 0.75
      const length = answer.text.length
      const lengthFactor = Math.min(
        1,
        Math.pow(20 / Math.max(10, length), 0.25)
      )
      const fontSize = Math.max(
        12,
        Math.min(28, minSide * 0.22 * lengthFactor)
      )
      const driftX = corner.x * (1 - answer.progress) + curve.x
      const driftY = corner.y * (1 - answer.progress) + curve.y
      const viewMargin = clamp(
        minSide * 0.16,
        TOKEN_VIEW_MARGIN_MIN,
        TOKEN_VIEW_MARGIN_MAX
      )
      const halfW = (baseWidth * scale) / 2
      const halfH = (baseHeight * scale) / 2
      const limitX = Math.max(
        Math.abs(base.x),
        layout.viewWidth / 2 - viewMargin - halfW
      )
      const limitY = Math.max(
        Math.abs(base.y),
        layout.viewHeight / 2 - viewMargin - halfH
      )
      const minOffsetX = -limitX - base.x
      const maxOffsetX = limitX - base.x
      const minOffsetY = -limitY - base.y
      const maxOffsetY = limitY - base.y
      const offsetX = clamp(driftX, minOffsetX, maxOffsetX)
      const offsetY = clamp(driftY, minOffsetY, maxOffsetY)
      const x = base.x + offsetX
      const y = base.y + offsetY
      return {
        left: "50%",
        top: "50%",
        width: `${baseWidth}px`,
        height: `${baseHeight}px`,
        fontSize: `${fontSize}px`,
        padding: `${Math.max(4, minSide * 0.08)}px`,
        borderRadius: `${Math.max(10, minSide * 0.22)}px`,
        lineHeight: 1.1,
        transform: `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`,
        opacity: 0.68 + answer.progress * 0.32,
      }
    },
    [layout]
  )

  const answerStyles = useMemo(
    () =>
      activeAnswers.map((answer) => ({
        id: answer.id,
        text: answer.text,
        romanization: answer.romanization,
        style: buildAnswerStyle(answer),
      })),
    [activeAnswers, buildAnswerStyle]
  )

  const playerStyle = useMemo(() => {
    const base = gridToPosition(playerPos.row, playerPos.col, layout)
    const size = Math.max(
      24,
      Math.min(layout.cellWidth, layout.cellHeight) * 0.3
    )
    return {
      left: "50%",
      top: "50%",
      transform: `translate3d(${base.x}px, ${base.y}px, 0) translate(-50%, -50%)`,
      width: `${size}px`,
      height: `${size}px`,
    }
  }, [layout, playerPos])

  const updateDraftSetting = useCallback(
    <K extends keyof GameSettings,>(key: K, value: GameSettings[K]) => {
      setDraftSettings((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const resetDraftSettings = useCallback(() => {
    setDraftSettings(DEFAULT_SETTINGS)
    setSettings(DEFAULT_SETTINGS)
  }, [setSettings])

  return (
    <div className="game-shell">
      {bootState !== "ready" ? (
        <div
          className={`boot-overlay ${bootState}`}
          onPointerDown={retryBoot}
        >
          <div className="boot-card">
            <div className="boot-title">
              {bootState === "error" ? "Loading failed" : "Loading"}
            </div>
            <div className="boot-subtitle">
              {bootState === "error"
                ? "Tap to retry."
                : "Preparing your run..."}
            </div>
          </div>
        </div>
      ) : null}
      <div
        className="arena"
        ref={arenaRef}
        onPointerDown={handleArenaPointer}
      >
        <div className="grid" aria-hidden="true" />
        {answerStyles.map((answer) => (
          <div
            key={answer.id}
            className="answer-token"
            style={answer.style}
          >
            <div className="answer-text">{answer.text}</div>
            {settings.showRomanization && answer.romanization ? (
              <div className="answer-rom">{answer.romanization}</div>
            ) : null}
          </div>
        ))}
        <div className="player-marker" style={playerStyle} />
      </div>
      <div className="hud">
        <div className="hud-left">
          {settings.showPrompt ? (
            <div className={`prompt size-${stack.textSize}`}>{round.prompt}</div>
          ) : null}
          {settings.showRomanization &&
          stack.showRomanization &&
          round.romanization ? (
            <div className="romanization">{round.romanization}</div>
          ) : null}
          {settings.showFeedback && feedback ? (
            <div className={`feedback ${feedback.type}`}>{feedback.message}</div>
          ) : null}
        </div>
        <div className="hud-right">
          <div className="hud-title">Endless Learner</div>
          <div className="hud-stack">
            {round.promptLang.toUpperCase()} → {round.answerLang.toUpperCase()}
          </div>
          <div className="mode">{round.mode}</div>
        </div>
        <div className="hud-bottom">
          <div className="stats">
            <span>Score {score}</span>
            <span>Streak {streak}</span>
          </div>
          {settings.showHints ? (
            <div className="hint">
              Tap/click a lane to zap. Space = replay.
            </div>
          ) : null}
        </div>
      </div>
      <button
        className={`settings-fab ${settingsOpen ? "open" : ""}`}
        onClick={() => setSettingsOpen((prev) => !prev)}
        aria-label="Toggle settings"
      >
        {settingsOpen ? "Close" : "Settings"}
      </button>
      {settingsOpen ? (
        <button
          className="settings-backdrop"
          onClick={() => setSettingsOpen(false)}
          aria-label="Close settings"
        />
      ) : null}
      <aside className={`settings-panel ${settingsOpen ? "open" : ""}`}>
        <div className="settings-title">Game Settings</div>
        <button
          className="settings-reset"
          onClick={resetDraftSettings}
          type="button"
        >
          Restore Defaults
        </button>
        <div className="settings-group">
          <label>
            <span className="setting-label">Music Volume</span>
            <span className="setting-value">
              {Math.round(draftSettings.musicVolume * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={draftSettings.musicVolume}
              onChange={(event) =>
                updateDraftSetting("musicVolume", Number(event.target.value))
              }
            />
          </label>
          <label>
            <span className="setting-label">SFX Volume</span>
            <span className="setting-value">
              {Math.round(draftSettings.sfxVolume * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={draftSettings.sfxVolume}
              onChange={(event) =>
                updateDraftSetting("sfxVolume", Number(event.target.value))
              }
            />
          </label>
        </div>
        <div className="settings-group">
          <label>
            <span className="setting-label">Base Speed</span>
            <span className="setting-value">
              {draftSettings.baseSpeed.toFixed(2)}x
            </span>
            <input
              type="range"
              min={0.6}
              max={2.2}
              step={0.05}
              value={draftSettings.baseSpeed}
              onChange={(event) =>
                updateDraftSetting("baseSpeed", Number(event.target.value))
              }
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={draftSettings.adaptiveSpeed}
              onChange={(event) =>
                updateDraftSetting("adaptiveSpeed", event.target.checked)
              }
            />
            Adaptive Speed
          </label>
          <label>
            <span className="setting-label">Correct Chance</span>
            <span className="setting-value">
              {Math.round(draftSettings.correctChance * 100)}%
            </span>
            <input
              type="range"
              min={0.15}
              max={0.8}
              step={0.05}
              value={draftSettings.correctChance}
              onChange={(event) =>
                updateDraftSetting("correctChance", Number(event.target.value))
              }
            />
          </label>
          <label>
            <span className="setting-label">Candidates On Screen</span>
            <span className="setting-value">
              {draftSettings.maxCandidates}
            </span>
            <input
              type="range"
              min={MIN_CANDIDATES}
              max={MAX_CANDIDATES}
              step={1}
              value={draftSettings.maxCandidates}
              onChange={(event) =>
                updateDraftSetting("maxCandidates", Number(event.target.value))
              }
            />
          </label>
        </div>
        <div className="settings-group">
          <label className="toggle">
            <input
              type="checkbox"
              checked={draftSettings.showPrompt}
              onChange={(event) =>
                updateDraftSetting("showPrompt", event.target.checked)
              }
            />
            Show Prompt
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={draftSettings.showRomanization}
              onChange={(event) =>
                updateDraftSetting("showRomanization", event.target.checked)
              }
            />
            Show Romanization
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={draftSettings.showFeedback}
              onChange={(event) =>
                updateDraftSetting("showFeedback", event.target.checked)
              }
            />
            Show Feedback
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={draftSettings.showHints}
              onChange={(event) =>
                updateDraftSetting("showHints", event.target.checked)
              }
            />
            Show Hints
          </label>
        </div>
      </aside>
    </div>
  )
}
