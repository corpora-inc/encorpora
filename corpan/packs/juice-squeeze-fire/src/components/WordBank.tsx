/**
 * WordBank — the pool of unplaced word blocks (droppable "bank").
 *
 * Dropping a block onto empty bank space appends it to the bank. Dropping onto
 * a specific block (slot) inserts before it — that logic lives in the DnD
 * handler; the bank container is the fallback "append" droppable.
 */
import { useDroppable } from "@dnd-kit/core"
import { WordBlock } from "./WordBlock"
import { useGameStore } from "../state/gameStore"
import { getNativeLanguageName } from "../util/languageNames"
import { isRTL } from "../util/rtl"
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
  const bankOrder = useGameStore((s) => s.bankOrder)
  const blocks = useGameStore((s) => s.blocks)
  const { setNodeRef, isOver } = useDroppable({ id: "bank", data: { type: "bank" } })
  const langRtl = isRTL(blockLang)

  return (
    <div
      ref={setNodeRef}
      className={`jsf-bank${isOver ? " jsf-bank--over" : ""}`}
      data-testid="word-bank"
    >
      {/* Build-language tag: the language you ASSEMBLE the sentence in, shown in
          its own native name (e.g. "español") so it's clear + correct in every
          language with no hardcoded English. */}
      <div className="jsf-bank__lang" dir={langRtl ? "rtl" : "ltr"}>
        {getNativeLanguageName(blockLang)}
      </div>
      {bankOrder.length === 0 ? (
        <div className="jsf-bank__empty" aria-hidden />
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
