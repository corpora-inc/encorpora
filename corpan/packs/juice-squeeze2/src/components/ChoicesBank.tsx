import { useDroppable } from "@dnd-kit/core"
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable"
import { useGameStore } from "../store/gameState"
import { DraggableWordBlock } from "./WordBlock"

type ChoicesBankProps = {
  onSpeakWord?: (word: string) => void
}

export function ChoicesBank({ onSpeakWord }: ChoicesBankProps) {
  const blocks = useGameStore((s) => s.blocks)
  const moveBlockToPlacement = useGameStore((s) => s.moveBlockToPlacement)

  const { setNodeRef } = useDroppable({ id: "choices-bank" })

  const choiceBlocks = blocks.filter((b) => b.zone === "choices")
  const choiceIds = choiceBlocks.map((b) => b.id)

  return (
    <div ref={setNodeRef} className="choices-bank">
      <SortableContext items={choiceIds} strategy={rectSortingStrategy}>
        {choiceBlocks.map((block) => (
          <DraggableWordBlock
            key={block.id}
            block={block}
            onTap={() => moveBlockToPlacement(block.id)}
            onSpeak={onSpeakWord}
          />
        ))}
      </SortableContext>
    </div>
  )
}
