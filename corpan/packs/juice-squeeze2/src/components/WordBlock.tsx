import { useRef } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { type WordBlock as WordBlockType } from "../store/gameState"

type WordBlockProps = {
  block: WordBlockType
  isDragOverlay?: boolean
  onTap?: () => void
  onSpeak?: (word: string) => void
}

export function WordBlock({ block, isDragOverlay, onTap, onSpeak }: WordBlockProps) {
  const dragStarted = useRef(false)
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1000 : undefined,
    opacity: isDragging && !isDragOverlay ? 0.5 : 1,
  }

  // Track if this is a tap vs drag
  const handlePointerDown = (e: React.PointerEvent) => {
    dragStarted.current = false
    pointerStartPos.current = { x: e.clientX, y: e.clientY }
    // Speak the word immediately on touch/click
    onSpeak?.(block.word)
    // Call original listener
    listeners?.onPointerDown?.(e as unknown as PointerEvent)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerStartPos.current) {
      const dx = Math.abs(e.clientX - pointerStartPos.current.x)
      const dy = Math.abs(e.clientY - pointerStartPos.current.y)
      // If moved more than 5px, consider it a drag
      if (dx > 5 || dy > 5) {
        dragStarted.current = true
      }
    }
  }

  const handlePointerUp = () => {
    // If we didn't drag, treat as tap
    if (!dragStarted.current && onTap) {
      onTap()
    }
    pointerStartPos.current = null
    dragStarted.current = false
  }

  // Merge our handlers with dnd-kit listeners
  const mergedListeners = {
    ...listeners,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`word-block ${isDragging ? "dragging" : ""} ${block.zone === "placement" ? "in-placement" : ""} ${isDragOverlay ? "drag-overlay" : ""}`}
      {...attributes}
      {...mergedListeners}
    >
      {block.word}
    </div>
  )
}

type DraggableWordBlockProps = {
  block: WordBlockType
  onTap?: () => void
  onSpeak?: (word: string) => void
}

export function DraggableWordBlock({ block, onTap, onSpeak }: DraggableWordBlockProps) {
  return <WordBlock block={block} onTap={onTap} onSpeak={onSpeak} />
}

export function WordBlockOverlay({ block }: { block: WordBlockType }) {
  return <WordBlock block={block} isDragOverlay />
}
