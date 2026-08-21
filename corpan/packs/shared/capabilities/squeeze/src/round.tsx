/**
 * <SqueezeRound> — the self-contained drag-to-rebuild round for ONE phrase
 * (capability-modules.md §4.2). Composes the moved components + round store +
 * routing helpers behind a single React component so React consumers (the
 * juice-squeeze pack, if it wants the whole round; the capability mount for
 * everything else) don't pay a nested createRoot.
 *
 * Owns: its own per-round store (no persist), DndContext + sensors, win
 * detection, the ear (speak answer) / eye (silent reveal) assists. Does NOT
 * own: celebration (host's job, §2.3.5), content selection (§2.2), scoring
 * (the mount maps events → ActivityResult).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  createRoundStore,
  RoundStoreProvider,
  type RoundStoreApi,
} from "./roundStore"
import { useStore } from "zustand"
import { TargetPhrase } from "./components/TargetPhrase"
import { SentenceArea } from "./components/SentenceArea"
import { WordBank } from "./components/WordBank"
import { BLOCK_PALETTE } from "./components/WordBlock"
import { useBlockSizing } from "./hooks/useBlockSizing"
import { flattenReadingOrder } from "./readingOrder"
import { routeDragEnd, routeTap } from "./dnd"
import { isRTL } from "./rtl"
import { tokenizeText, joinForTTS } from "./tokenizer"

export type SqueezeRoundEvent =
  | { type: "placement"; moves: number }
  | { type: "ear" }
  | { type: "reveal" }
  | {
      type: "win"
      detail: { moves: number; wordCount: number; revealUsed: boolean; earUsed: boolean }
    }

export type SqueezeRoundProps = {
  /** The sentence to rebuild, in the block language (already resolved). */
  text: string
  blockLang: string
  /** Prompt shown at top (usually the other language's rendering). */
  promptText?: string
  promptLang?: string
  /** Pre-tokenized words; when absent the round tokenizes (CJK-aware). */
  words?: string[]
  /** Allow the eye (silent reveal) affordance. Default true. */
  revealAllowed?: boolean
  /** Speak the completed sentence on win (pack behavior). Default true. */
  speakOnWin?: boolean
  /** Frozen: input disabled (startPaused / host pause). */
  paused?: boolean
  speak: (lang: string, text: string) => void
  onEvent?: (e: SqueezeRoundEvent) => void
}

export function SqueezeRound(props: SqueezeRoundProps) {
  const storeRef = useRef<RoundStoreApi | null>(null)
  if (!storeRef.current) storeRef.current = createRoundStore()
  const store = storeRef.current

  const words = useMemo(
    () => (props.words && props.words.length > 0 ? props.words : tokenizeText(props.text)),
    [props.words, props.text],
  )

  // (Re)load the phrase whenever the content changes.
  useEffect(() => {
    store.getState().loadPhrase({
      id: `cap-squeeze-${props.blockLang}`,
      level: "",
      text: props.text,
      words,
      targetText: props.promptText,
      targetLang: props.promptLang,
      blockLang: props.blockLang,
    })
    movesRef.current = 0
    revealRef.current = false
    earRef.current = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.text, props.blockLang, words])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [pressedId, setPressedId] = useState<string | null>(null)
  const [revealText, setRevealText] = useState<string | null>(null)
  const movesRef = useRef(0)
  const revealRef = useRef(false)
  const earRef = useRef(0)

  const blocks = useStore(store, (s) => s.blocks)
  const hasWon = useStore(store, (s) => s.hasWon)
  const correctWords = useStore(store, (s) => s.correctWords)
  const { containerRef, sizeFor } = useBlockSizing(correctWords)

  const rtl = isRTL(props.blockLang)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 8 } }),
  )

  const checkAfterPlacement = useCallback(() => {
    const s = store.getState()
    if (s.hasWon) return
    movesRef.current += 1
    props.onEvent?.({ type: "placement", moves: movesRef.current })
    const flat = flattenReadingOrder(s.sentenceRows, s.blocks, rtl)
    if (s.checkWin(flat)) {
      s.setWon(true)
      if (props.speakOnWin !== false) {
        props.speak(props.blockLang, joinForTTS(s.correctWords))
      }
      props.onEvent?.({
        type: "win",
        detail: {
          moves: movesRef.current,
          wordCount: s.correctWords.length,
          revealUsed: revealRef.current,
          earUsed: earRef.current > 0,
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rtl, props.blockLang, props.speakOnWin])

  const onDragStart = (e: DragStartEvent) => {
    if (props.paused) return
    setActiveId(String(e.active.id))
    setPressedId(null)
  }

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    if (props.paused) return
    // Routing helper is the moved JuiceSqueezeApp logic (dnd.ts).
    if (routeDragEnd(store, e)) checkAfterPlacement()
  }

  const onTap = (blockId: string) => {
    if (props.paused) return
    if (routeTap(store, blockId)) checkAfterPlacement()
  }

  const onTapSpeak = (word: string) => {
    if (props.paused) return
    // Skip the per-word voice on the tap that places the LAST bank word — the
    // win TTS reads the whole sentence a moment later (shipped parity).
    if (store.getState().bankOrder.length <= 1) return
    props.speak(props.blockLang, word)
  }

  const speakAnswer = () => {
    if (props.paused) return
    earRef.current += 1
    props.onEvent?.({ type: "ear" })
    props.speak(props.blockLang, joinForTTS(store.getState().correctWords))
  }

  const showReveal = () => {
    if (props.paused) return
    revealRef.current = true
    props.onEvent?.({ type: "reveal" })
    setRevealText(joinForTTS(store.getState().correctWords))
  }

  const activeBlock = activeId ? blocks[activeId] : null

  return (
    <RoundStoreProvider value={store}>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div
          ref={containerRef}
          className={`capSqz-round${props.paused ? " capSqz-round--paused" : ""}${hasWon ? " capSqz-round--won" : ""}`}
          data-capsqz-fit-scope
        >
          <TargetPhrase
            onSpeakTarget={(lang, text) => {
              if (!props.paused) props.speak(lang, text)
            }}
          />
          <SentenceArea
            blockLang={props.blockLang}
            fruitsEnabled={false}
            rtl={rtl}
            sizeFor={sizeFor}
            pressedId={pressedId}
            onPressChange={setPressedId}
            onTapSpeak={onTapSpeak}
            onTap={onTap}
          />
          <WordBank
            blockLang={props.blockLang}
            fruitsEnabled={false}
            rtl={rtl}
            sizeFor={sizeFor}
            pressedId={pressedId}
            onPressChange={setPressedId}
            onTapSpeak={onTapSpeak}
            onTap={onTap}
          />
          <div className="capSqz-assists">
            <button
              type="button"
              className="capSqz-assist"
              aria-label="Hear the answer"
              onClick={speakAnswer}
            >
              🎧
            </button>
            {props.revealAllowed !== false && (
              <button
                type="button"
                className="capSqz-assist"
                aria-label="Show the answer"
                onClick={showReveal}
              >
                👁
              </button>
            )}
          </div>
          {revealText !== null && (
            <div className="capSqz-reveal" onClick={() => setRevealText(null)}>
              <div className="capSqz-reveal__text" dir={rtl ? "rtl" : "ltr"}>
                {revealText}
              </div>
            </div>
          )}
          {hasWon && (
            <div className="capSqz-verdict" aria-hidden="true">
              ✓
            </div>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeBlock ? (
            <div
              className="capSqz-block capSqz-block--ghost"
              style={{
                ["--capSqz-blk" as string]:
                  BLOCK_PALETTE[activeBlock.originalIndex % BLOCK_PALETTE.length],
              }}
            >
              {activeBlock.word}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </RoundStoreProvider>
  )
}
