import { useDroppable } from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { useGameStore } from "../store/gameState"
import { DraggableWordBlock } from "./WordBlock"
import { getTextDirection } from "../utils/rtl"
import { t } from "../utils/translations"

type PlacementAreaProps = {
  isDragOver: boolean
  onSpeakWord?: (word: string) => void
}

export function PlacementArea({ isDragOver, onSpeakWord }: PlacementAreaProps) {
  const blocks = useGameStore((s) => s.blocks)
  const placementOrder = useGameStore((s) => s.placementOrder)
  const phrase = useGameStore((s) => s.phrase)
  const moveBlockToChoices = useGameStore((s) => s.moveBlockToChoices)

  const { setNodeRef } = useDroppable({ id: "placement-area" })

  const placedBlocks = placementOrder
    .map((id) => blocks.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => b !== undefined)

  const blockLang = phrase.blockLang || "en"
  const dir = getTextDirection(blockLang)
  const isEmpty = placedBlocks.length === 0

  return (
    <>
      <div className="build-label">
        {t("buildWith", blockLang)} {blockLang.toUpperCase()}
      </div>
      <div
        ref={setNodeRef}
        className={`placement-area ${isDragOver ? "drag-over" : ""} ${isEmpty ? "empty" : ""}`}
        dir={dir}
      >
        {isEmpty ? (
          <span>Drag words here</span>
        ) : (
          <SortableContext items={placementOrder} strategy={horizontalListSortingStrategy}>
            {placedBlocks.map((block) => (
              <DraggableWordBlock
                key={block.id}
                block={block}
                onTap={() => moveBlockToChoices(block.id)}
                onSpeak={onSpeakWord}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </>
  )
}
