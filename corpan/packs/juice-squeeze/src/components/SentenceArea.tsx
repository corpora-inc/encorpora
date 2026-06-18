/**
 * SentenceArea — the build zone where placed blocks form the sentence.
 *
 * RTL: when the block language is RTL the row lays out right-to-left
 * (flex-direction: row-reverse + dir="rtl"), matching the shipped pack's RTL
 * sentence layout. The reading-order flatten in readingOrder.ts reverses each
 * row for RTL so the win check compares the correct sequence.
 *
 * Each sentence row is a droppable ("append to row"); individual blocks are
 * droppables for precise insertion (see WordBlock). Currently the store models
 * a single primary row ([[...]]); we render every row it provides.
 */
import { useDroppable } from "@dnd-kit/core"
import { WordBlock } from "./WordBlock"
import { useGameStore } from "../state/gameStore"
import type { BlockSize } from "../hooks/useBlockSizing"

type Props = {
  blockLang: string
  fruitsEnabled: boolean
  rtl: boolean
  sizeFor: (word: string) => BlockSize
  pressedId: string | null
  onPressChange: (blockId: string | null) => void
  onTapSpeak: (word: string) => void
  onTap: (blockId: string) => void
}

function SentenceRow({
  rowIndex,
  ids,
  blockLang,
  fruitsEnabled,
  rtl,
  sizeFor,
  pressedId,
  onPressChange,
  onTapSpeak,
  onTap,
}: {
  rowIndex: number
  ids: string[]
} & Props) {
  const blocks = useGameStore((s) => s.blocks)
  const { setNodeRef, isOver } = useDroppable({
    id: `row-${rowIndex}`,
    data: { type: "row", row: rowIndex },
  })

  return (
    <div
      ref={setNodeRef}
      className={`jsf-row${isOver ? " jsf-row--over" : ""}${rtl ? " jsf-row--rtl" : ""}`}
      dir={rtl ? "rtl" : "ltr"}
    >
      {ids.length === 0 && <span className="jsf-row__placeholder" aria-hidden />}
      {ids.map((id) => {
        const b = blocks[id]
        if (!b) return null
        const sz = sizeFor(b.word)
        return (
          <WordBlock
            key={id}
            blockId={id}
            word={b.word}
            fruitIndex={b.originalIndex}
            blockLang={blockLang}
            fruitsEnabled={fruitsEnabled}
            rtl={rtl}
            fontSize={sz.fontSize}
            pressed={pressedId === id}
            onPressChange={onPressChange}
            onTapSpeak={onTapSpeak}
            onTap={onTap}
          />
        )
      })}
    </div>
  )
}

export function SentenceArea(props: Props) {
  const sentenceRows = useGameStore((s) => s.sentenceRows)
  const rows = sentenceRows.length > 0 ? sentenceRows : [[]]

  return (
    <div className="jsf-sentence" data-testid="sentence-area">
      {rows.map((ids, i) => (
        <SentenceRow key={i} rowIndex={i} ids={ids} {...props} />
      ))}
    </div>
  )
}
