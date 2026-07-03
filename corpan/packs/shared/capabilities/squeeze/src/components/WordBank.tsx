/**
 * WordBank — the pool of unplaced word blocks (droppable "bank").
 *
 * Dropping a block onto empty bank space appends it to the bank. Dropping onto
 * a specific block (slot) inserts before it — that logic lives in the DnD
 * handler; the bank container is the fallback "append" droppable.
 *
 * MOVED from packs/juice-squeeze/src/components (capability-modules.md §4.2):
 * round state comes from the RoundStoreProvider; classes are capSqz-.
 */
import { useDroppable } from "@dnd-kit/core"
import { WordBlock } from "./WordBlock"
import { useRoundStore } from "../roundStore"
import { getNativeLanguageName } from "../languageNames"
import { isRTL } from "../rtl"
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

export function WordBank({
  blockLang,
  fruitsEnabled,
  rtl,
  sizeFor,
  pressedId,
  onPressChange,
  onTapSpeak,
  onTap,
}: Props) {
  const bankOrder = useRoundStore((s) => s.bankOrder)
  const blocks = useRoundStore((s) => s.blocks)
  // Total phrase word count (the worst case: all chips in the bank at the start).
  // Dense phrases pull the gap between chips in so more rows fit before we ever
  // need to shrink the chips themselves.
  const wordCount = useRoundStore((s) => s.correctWords.length)
  const dense = wordCount >= 16
  // As words are moved out into the completion zone the bank empties. An empty
  // bank must NOT reserve vertical space — it collapses to a thin drop strip so
  // the (growing) completion zone gets the room. The two trade space automatically.
  const empty = bankOrder.length === 0
  const { setNodeRef, isOver } = useDroppable({ id: "bank", data: { type: "bank" } })
  const langRtl = isRTL(blockLang)

  return (
    <div
      ref={setNodeRef}
      className={`capSqz-bank${isOver ? " capSqz-bank--over" : ""}${dense ? " capSqz-bank--dense" : ""}${empty ? " capSqz-bank--empty" : ""}`}
      data-testid="word-bank"
    >
      {/* Build-language tag: the language you ASSEMBLE the sentence in, shown in
          its own native name (e.g. "español") so it's clear + correct in every
          language with no hardcoded English. */}
      <div className="capSqz-bank__lang" dir={langRtl ? "rtl" : "ltr"}>
        {getNativeLanguageName(blockLang)}
      </div>
      {bankOrder.length === 0 ? (
        <div className="capSqz-bank__empty" aria-hidden />
      ) : (
        bankOrder.map((id) => {
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
        })
      )}
    </div>
  )
}
