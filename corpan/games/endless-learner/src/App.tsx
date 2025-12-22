import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { EntryOut, HostApi, StackConfig } from "./sdk/types"
import type { GameRuntime } from "./runtime"

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
  laneOffsetX: number
  laneOffsetY: number
}

type Feedback = {
  type: "correct" | "wrong" | "miss"
  message: string
}

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
  }
}

const ANSWER_TRAVEL_MS = 9000
const ANSWER_GAP_MS = 2400
const POST_CORRECT_PAUSE_MS = 3200
const SPEAK_REPEAT_MS = 7700
const NATIVE_REPEAT_MULT = 2
const FEEDBACK_CLEAR_MS = 1800
const IMPACT_HOLD_MS = 240
const HIT_ZONE = 0.97
const MAX_WRONG_BEFORE_CORRECT = 2
const CORRECT_CHANCE = 0.35
const SKIP_SCORE = 2
const DISTRACTOR_TARGET = 10

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const gridToPosition = (row: number, col: number, layout: Layout) => {
  return {
    x: col * (layout.cellWidth + layout.gapX) - layout.offsetX,
    y: row * (layout.cellHeight + layout.gapY) - layout.offsetY,
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
  const sway =
    Math.sin(progress * Math.PI * 1.15 + seed) * layout.cellWidth * 0.16
  const lift =
    Math.cos(progress * Math.PI * 0.9 + seed) * layout.cellHeight * 0.1
  return { x: sway, y: lift }
}

export function App({ hostApi, initialStack, runtime }: AppProps) {
  const [stack, setStack] = useState<StackConfig>(
    initialStack ?? hostApi.getStackConfig()
  )
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [round, setRound] = useState<Round>(emptyRound)
  const [activeAnswer, setActiveAnswer] = useState<IncomingAnswer | null>(null)
  const [playerPos, setPlayerPos] = useState<PlayerPos>({ row: 1, col: 1 })
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [layout, setLayout] = useState<Layout>(() =>
    computeLayout(
      typeof window !== "undefined" ? window.innerWidth : 1024,
      typeof window !== "undefined" ? window.innerHeight : 768
    )
  )

  const roundRef = useRef<Round>(round)
  const stackRef = useRef<StackConfig>(stack)
  const playerPosRef = useRef<PlayerPos>(playerPos)
  const activeAnswerRef = useRef<IncomingAnswer | null>(activeAnswer)
  const layoutRef = useRef<Layout>(layout)
  const roundIdRef = useRef(0)
  const solvedRef = useRef(false)
  const wrongSinceCorrectRef = useRef(0)
  const answerTimeoutRef = useRef<number | null>(null)
  const roundTimeoutRef = useRef<number | null>(null)
  const feedbackTimeoutRef = useRef<number | null>(null)
  const speakTimeoutRef = useRef<number | null>(null)
  const impactTimeoutRef = useRef<number | null>(null)
  const startedRef = useRef(false)
  const curveSeedRef = useRef(Math.random() * Math.PI * 2)
  const lastWrongTextRef = useRef<string | null>(null)

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
    if (impactTimeoutRef.current) {
      window.clearTimeout(impactTimeoutRef.current)
    }
  }, [])

  const buildRound = useCallback(async (): Promise<Round> => {
    if (!runtime.isActive()) {
      return emptyRound
    }
    if (!hostApi.getRandomEntry) {
      return emptyRound
    }

    const settings = stackRef.current
    const languages = settings.languages.length ? settings.languages : ["en"]
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
      return emptyRound
    }

    const promptText = pickText(lookup.textByCode, promptLang)
    const romanization = pickRom(lookup.romByCode, promptLang)
    const correct = pickText(lookup.textByCode, answerLang)

    const distractors: string[] = []
    for (let i = 0; i < maxAttempts && distractors.length < DISTRACTOR_TARGET; i += 1) {
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
  }, [hostApi, runtime])

  const scheduleNextAnswer = useCallback((delayMs: number) => {
    if (!runtime.isActive()) {
      return
    }
    if (answerTimeoutRef.current) {
      window.clearTimeout(answerTimeoutRef.current)
    }
    answerTimeoutRef.current = window.setTimeout(() => {
      if (!runtime.isActive()) {
        return
      }
      const liveLayout = layoutRef.current
      const current = roundRef.current
      if (!current || !current.prompt) {
        return
      }
      if (activeAnswerRef.current) {
        return
      }

      const forceCorrect =
        wrongSinceCorrectRef.current >= MAX_WRONG_BEFORE_CORRECT
      const useCorrect = forceCorrect || Math.random() < CORRECT_CHANCE
      let text = current.correctAnswer
      if (!useCorrect) {
        const lastWrong = lastWrongTextRef.current
        const options = lastWrong
          ? current.distractors.filter((choice) => choice && choice !== lastWrong)
          : current.distractors
        text = pickRandom(options.length ? options : current.distractors) ?? current.correctAnswer
      }

      const row = Math.floor(Math.random() * GRID_SIZE)
      const col = Math.floor(Math.random() * GRID_SIZE)
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

      setActiveAnswer({
        id: Date.now(),
        text,
        isCorrect: useCorrect,
        row,
        col,
        progress: 0,
        laneOffsetX,
        laneOffsetY,
      })
    }, delayMs)
  }, [runtime])

  const speakPrompt = useCallback(() => {
    if (!runtime.isActive()) {
      return
    }
    const current = roundRef.current
    if (!current?.prompt) {
      return
    }
    hostApi.speak(current.promptLang, current.prompt)
  }, [hostApi, runtime])

  const scheduleSpeakRepeat = useCallback(() => {
    if (!runtime.isActive()) {
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

  const startRound = useCallback(async () => {
    if (!runtime.isActive()) {
      return
    }
    clearTimers()
    solvedRef.current = false
    wrongSinceCorrectRef.current = 0
    if (startedRef.current) {
      hostApi.stopSpeech?.()
    }
    startedRef.current = true
    curveSeedRef.current = Math.random() * Math.PI * 2
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
  }, [buildRound, clearTimers, hostApi, runtime, scheduleNextAnswer, scheduleSpeakRepeat])

  useEffect(() => {
    void startRound()
    return () => {
      clearTimers()
      hostApi.stopSpeech?.()
    }
  }, [clearTimers, hostApi, runtime, startRound])

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
      }

      setStreak(0)
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedback(null)
      }, FEEDBACK_CLEAR_MS)
      scheduleNextAnswer(ANSWER_GAP_MS)
    },
    [hostApi, runtime, scheduleNextAnswer, startRound]
  )

  const resolveSkip = useCallback(
    (answer: IncomingAnswer) => {
      if (!runtime.isActive()) {
        return
      }
      setActiveAnswer(null)
      if (answer.isCorrect) {
        setFeedback({
          type: "miss",
          message: `That was correct: ${roundRef.current?.correctAnswer ?? ""}`,
        })
        setStreak(0)
      } else {
        setFeedback({
          type: "correct",
          message: "Nice skip",
        })
        setScore((prev) => prev + SKIP_SCORE)
        setStreak((prev) => prev + 1)
      }
      feedbackTimeoutRef.current = window.setTimeout(() => {
        setFeedback(null)
      }, FEEDBACK_CLEAR_MS)
      scheduleNextAnswer(ANSWER_GAP_MS)
    },
    [runtime, scheduleNextAnswer]
  )

  useEffect(() => {
    if (!activeAnswer) {
      return
    }
    if (!runtime.isActive()) {
      return
    }
    const answerId = activeAnswer.id
    const answerSnapshot = { ...activeAnswer }
    let animationFrame = 0
    const spawnedAt = performance.now()
    let resolved = false

    const tick = (time: number) => {
      if (!runtime.isActive()) {
        return
      }
      const progress = Math.min((time - spawnedAt) / ANSWER_TRAVEL_MS, 1)
      setActiveAnswer((prev) =>
        prev && prev.id === answerId ? { ...prev, progress } : prev
      )

      if (!resolved && progress >= 1) {
        resolved = true
        setActiveAnswer((prev) =>
          prev && prev.id === answerId ? { ...prev, progress: 1 } : prev
        )
        impactTimeoutRef.current = window.setTimeout(() => {
          if (!runtime.isActive()) {
            return
          }
          const pos = playerPosRef.current
          const inLane =
            pos.row === answerSnapshot.row && pos.col === answerSnapshot.col
          if (inLane) {
            resolveAnswer(
              answerSnapshot.isCorrect ? "correct" : "wrong",
              answerSnapshot
            )
          } else {
            resolveSkip(answerSnapshot)
          }
        }, IMPACT_HOLD_MS)
        return
      }

      animationFrame = requestAnimationFrame(tick)
    }

    animationFrame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animationFrame)
  }, [activeAnswer?.id, resolveAnswer, resolveSkip, runtime])

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
    if (!runtime.isActive()) {
      return
    }
    const pos = playerPosRef.current
    const inLane = pos.row === current.row && pos.col === current.col
    if (inLane) {
      resolveAnswer(current.isCorrect ? "correct" : "wrong", current)
    } else {
      resolveSkip(current)
    }
  }, [resolveAnswer, resolveSkip, runtime])

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
    const base = gridToPosition(activeAnswer.row, activeAnswer.col, layout)
    const curve = curveOffset(activeAnswer.progress, layout, curveSeedRef.current)
    const corner = {
      x: activeAnswer.laneOffsetX,
      y: activeAnswer.laneOffsetY,
    }
    const baseWidth = layout.cellWidth
    const baseHeight = layout.cellHeight
    const minSide = Math.min(baseWidth, baseHeight)
    const scale = 0.25 + activeAnswer.progress * 0.75
    const length = activeAnswer.text.length
    const lengthFactor = Math.min(
      1,
      Math.pow(20 / Math.max(10, length), 0.25)
    )
    const fontSize = Math.max(
      12,
      Math.min(28, minSide * 0.22 * lengthFactor)
    )
    const x = base.x + corner.x * (1 - activeAnswer.progress) + curve.x
    const y = base.y + corner.y * (1 - activeAnswer.progress) + curve.y
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
      opacity: 0.55 + activeAnswer.progress * 0.45,
    }
  }, [activeAnswer, layout])

  const playerStyle = useMemo(() => {
    const base = gridToPosition(playerPos.row, playerPos.col, layout)
    const curve = curveOffset(1, layout, curveSeedRef.current)
    const size = Math.max(
      24,
      Math.min(layout.cellWidth, layout.cellHeight) * 0.3
    )
    return {
      left: "50%",
      top: "50%",
      transform: `translate3d(${base.x + curve.x}px, ${base.y + curve.y}px, 0) translate(-50%, -50%)`,
      width: `${size}px`,
      height: `${size}px`,
    }
  }, [layout, playerPos])

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
        <div className="hud-center">
          <div className={`prompt size-${stack.textSize}`}>{round.prompt}</div>
          {stack.showRomanization && round.romanization ? (
            <div className="romanization">{round.romanization}</div>
          ) : null}
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
        <div className="hud-meta">
          <div className="hud-title">Endless Learner</div>
          <div className="hud-stack">
            {round.promptLang.toUpperCase()} → {round.answerLang.toUpperCase()}
          </div>
          <div className="mode">{round.mode}</div>
          <div className="hint">
            Move with WASD/arrow keys. Enter = zap. Space = replay.
          </div>
        </div>
      </div>
    </div>
  )
}
