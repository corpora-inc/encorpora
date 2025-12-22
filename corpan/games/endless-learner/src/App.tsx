import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { EntryOut, HostApi, StackConfig } from "./sdk/types"

type AppProps = {
  hostApi: HostApi
  initialStack?: StackConfig
}

type Round = {
  id: number
  prompt: string
  romanization?: string
  promptLang: string
  answerLang: string
  correctAnswer: string
  distractors: string[]
  mode: string
}

type PlayerPos = {
  row: number
  col: number
}

type IncomingAnswer = {
  id: number
  text: string
  isCorrect: boolean
  row: number
  col: number
  progress: number
}

type Feedback = {
  type: "correct" | "wrong" | "miss"
  message: string
}

const GRID_SIZE = 3
const GRID_CELL = 120
const GRID_GAP = 20
const GRID_DEPTH_SHIFT = 160

const ANSWER_TRAVEL_MS = 9000
const ANSWER_GAP_MS = 2200
const SPEAK_REPEAT_MS = 7000
const FEEDBACK_CLEAR_MS = 1800
const HIT_ZONE = 0.92
const MAX_WRONG_BEFORE_CORRECT = 2
const CORRECT_CHANCE = 0.35

const DEBUG = false

const MODE_LABELS = {
  nativeToLearning: "Native → Learning",
  learningToLearning: "Learning → Learning",
  learningToNative: "Learning → Native",
  learningToLearningAlt: "Learning → Learning+",
}

const fallbackRound: Round = {
  id: 0,
  prompt: "bonjour",
  promptLang: "fr",
  answerLang: "en",
  correctAnswer: "hello",
  distractors: ["goodbye", "bonjour"],
  mode: MODE_LABELS.learningToNative,
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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const gridSpan = GRID_CELL * GRID_SIZE + GRID_GAP * (GRID_SIZE - 1)
const gridOffset = gridSpan / 2 - GRID_CELL / 2

const gridToPosition = (row: number, col: number) => {
  return {
    x: col * (GRID_CELL + GRID_GAP) - gridOffset,
    y: row * (GRID_CELL + GRID_GAP) - gridOffset,
  }
}

export function App({ hostApi, initialStack }: AppProps) {
  const [stack, setStack] = useState<StackConfig>(
    initialStack ?? hostApi.getStackConfig()
  )
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [round, setRound] = useState<Round>(fallbackRound)
  const [activeAnswer, setActiveAnswer] = useState<IncomingAnswer | null>(null)
  const [playerPos, setPlayerPos] = useState<PlayerPos>({ row: 1, col: 1 })
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const roundRef = useRef<Round>(round)
  const stackRef = useRef<StackConfig>(stack)
  const playerPosRef = useRef<PlayerPos>(playerPos)
  const activeAnswerRef = useRef<IncomingAnswer | null>(activeAnswer)
  const roundIdRef = useRef(0)
  const solvedRef = useRef(false)
  const wrongSinceCorrectRef = useRef(0)
  const answerTimeoutRef = useRef<number | null>(null)
  const roundTimeoutRef = useRef<number | null>(null)
  const feedbackTimeoutRef = useRef<number | null>(null)
  const speakTimeoutRef = useRef<number | null>(null)
  const startedRef = useRef(false)

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
    activeAnswerRef.current = activeAnswer
  }, [activeAnswer])

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
  }, [])

  const buildRound = useCallback(async (): Promise<Round> => {
    if (!hostApi.getRandomEntry) {
      return fallbackRound
    }

    const settings = stackRef.current
    const languages = settings.languages.length ? settings.languages : ["en"]
    const nativeLang = languages[languages.length - 1] ?? languages[0]
    const learningLangs = languages.slice(0, -1)
    const modes = ["nativeToLearning", "learningToNative", "learningToLearning"]
    if (learningLangs.length > 1) {
      modes.push("learningToLearningAlt")
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
    } else if (mode === "learningToLearning") {
      promptLang = pickRandom(learningLangs.length ? learningLangs : [nativeLang])
      answerLang = promptLang
    } else {
      const first = pickRandom(learningLangs)
      const rest = learningLangs.filter((lang) => lang !== first)
      promptLang = first
      answerLang = pickRandom(rest.length ? rest : [nativeLang])
    }

    const maxAttempts = 8
    let entry: EntryOut | null = null
    let lookup:
      | { textByCode: Record<string, string>; romByCode: Record<string, string | undefined> }
      | null = null

    for (let i = 0; i < maxAttempts; i += 1) {
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
    }

    if (!entry || !lookup) {
      return fallbackRound
    }

    const promptText = pickText(lookup.textByCode, promptLang)
    const romanization = pickRom(lookup.romByCode, promptLang)
    const correct = pickText(lookup.textByCode, answerLang)

    const distractors: string[] = []
    for (let i = 0; i < maxAttempts && distractors.length < 5; i += 1) {
      const distractor = await hostApi.getRandomEntry()
      const distractLookup = buildLookup(distractor)
      const distractText = pickText(distractLookup.textByCode, answerLang)
      uniquePush(distractors, distractText)
    }

    return {
      id: roundIdRef.current + 1,
      prompt: promptText,
      romanization,
      promptLang,
      answerLang,
      correctAnswer: correct,
      distractors,
      mode: MODE_LABELS[mode as keyof typeof MODE_LABELS] ?? "Run",
    }
  }, [hostApi])

  const scheduleNextAnswer = useCallback((delayMs: number) => {
    if (answerTimeoutRef.current) {
      window.clearTimeout(answerTimeoutRef.current)
    }
    answerTimeoutRef.current = window.setTimeout(() => {
      const current = roundRef.current
      if (!current) {
        return
      }
      if (activeAnswerRef.current) {
        return
      }

      const forceCorrect =
        wrongSinceCorrectRef.current >= MAX_WRONG_BEFORE_CORRECT
      const useCorrect = forceCorrect || Math.random() < CORRECT_CHANCE
      const text = useCorrect
        ? current.correctAnswer
        : pickRandom(current.distractors) ?? current.correctAnswer

      const row = Math.floor(Math.random() * GRID_SIZE)
      const col = Math.floor(Math.random() * GRID_SIZE)

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

      setActiveAnswer({
        id: Date.now(),
        text,
        isCorrect: useCorrect,
        row,
        col,
        progress: 0,
      })
    }, delayMs)
  }, [])

  const startRound = useCallback(async () => {
    clearTimers()
    solvedRef.current = false
    wrongSinceCorrectRef.current = 0
    if (startedRef.current) {
      hostApi.stopSpeech?.()
    }
    startedRef.current = true
    const next = await buildRound()
    roundIdRef.current = next.id
    setRound(next)
    setActiveAnswer(null)
    setFeedback(null)
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.info("[endless-learner] round", next)
    }
    scheduleNextAnswer(ANSWER_GAP_MS)
    scheduleSpeakRepeat()
  }, [buildRound, clearTimers, scheduleNextAnswer])

  useEffect(() => {
    void startRound()
    return () => {
      clearTimers()
      hostApi.stopSpeech?.()
    }
  }, [])

  const speakPrompt = useCallback(() => {
    const current = roundRef.current
    if (!current?.prompt) {
      return
    }
    hostApi.speak(current.promptLang, current.prompt)
  }, [hostApi])

  const scheduleSpeakRepeat = useCallback(() => {
    if (speakTimeoutRef.current) {
      window.clearTimeout(speakTimeoutRef.current)
    }
    speakTimeoutRef.current = window.setTimeout(() => {
      if (!solvedRef.current) {
        speakPrompt()
        scheduleSpeakRepeat()
      }
    }, SPEAK_REPEAT_MS)
  }, [speakPrompt])

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
      setActiveAnswer(null)
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
        setScore((prev) => prev + 10)
        setStreak((prev) => prev + 1)
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
        }, ANSWER_GAP_MS)
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
      }

      setStreak(0)
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedback(null)
      }, FEEDBACK_CLEAR_MS)
      scheduleNextAnswer(ANSWER_GAP_MS)
    },
    [hostApi, scheduleNextAnswer, startRound]
  )

  useEffect(() => {
    if (!activeAnswer) {
      return
    }
    const answerId = activeAnswer.id
    const answerSnapshot = { ...activeAnswer }
    let animationFrame = 0
    const spawnedAt = performance.now()
    let resolved = false

    const tick = (time: number) => {
      const progress = Math.min((time - spawnedAt) / ANSWER_TRAVEL_MS, 1)
      setActiveAnswer((prev) =>
        prev && prev.id === answerId ? { ...prev, progress } : prev
      )

      if (!resolved && progress >= 1) {
        resolved = true
        resolveAnswer("miss", answerSnapshot)
        return
      }

      animationFrame = requestAnimationFrame(tick)
    }

    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [activeAnswer?.id, resolveAnswer])

  const movePlayer = useCallback((rowDelta: number, colDelta: number) => {
    setPlayerPos((prev) => ({
      row: clamp(prev.row + rowDelta, 0, GRID_SIZE - 1),
      col: clamp(prev.col + colDelta, 0, GRID_SIZE - 1),
    }))
  }, [])

  const selectActive = useCallback(() => {
    const current = activeAnswerRef.current
    if (!current) {
      return
    }
    const pos = playerPosRef.current
    const inLane = pos.row === current.row && pos.col === current.col
    resolveAnswer(
      inLane && current.isCorrect ? "correct" : "wrong",
      current
    )
  }, [resolveAnswer])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
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

  const activeStyle = useMemo(() => {
    if (!activeAnswer) {
      return null
    }
    const base = gridToPosition(activeAnswer.row, activeAnswer.col)
    const depth = (1 - activeAnswer.progress) * GRID_DEPTH_SHIFT
    const scale = 0.65 + activeAnswer.progress * 0.6
    return {
      transform: `translate3d(${base.x}px, ${base.y - depth}px, 0) scale(${scale})`,
      opacity: 0.2 + activeAnswer.progress * 0.8,
    }
  }, [activeAnswer])

  const playerStyle = useMemo(() => {
    const base = gridToPosition(playerPos.row, playerPos.col)
    return {
      transform: `translate3d(${base.x}px, ${base.y}px, 0)`,
    }
  }, [playerPos])

  return (
    <div className="game-shell">
      <div className="arena">
        <div className="grid" aria-hidden="true" />
        {activeAnswer ? (
          <div className="answer-token" style={activeStyle ?? undefined}>
            {activeAnswer.text}
          </div>
        ) : null}
        <div className="player-marker" style={playerStyle} />
      </div>
      <div className="hud">
        <div className="hud-top">
          <div className="hud-title">Endless Learner</div>
          <div className="hud-stack">
            {round.promptLang.toUpperCase()} → {round.answerLang.toUpperCase()}
          </div>
        </div>
        <div className="hud-center">
          <div className={`prompt size-${stack.textSize}`}>{round.prompt}</div>
          {stack.showRomanization && round.romanization ? (
            <div className="romanization">{round.romanization}</div>
          ) : null}
          <div className="mode">{round.mode}</div>
          <div className="hint">
            Move with WASD/arrow keys. Enter = zap. Space = replay.
          </div>
          {feedback ? (
            <div className={`feedback ${feedback.type}`}>{feedback.message}</div>
          ) : null}
        </div>
        <div className="hud-footer">
          <div className="stats">
            <span>Score {score}</span>
            <span>Streak {streak}</span>
          </div>
          <div className="controls">
            <button className="zap" onClick={selectActive}>
              Zap
            </button>
            <button className="speak" onClick={speakPrompt}>
              Replay
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
