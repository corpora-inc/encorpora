/**
 * WordBlock — a single draggable word tile.
 *
 * Tap vs drag (shipped parity, game.ts ~2498-2737):
 *  - On pointer-DOWN: immediately speak the word in blockLang (INSTANT audio on
 *    touch, not on release), UNLESS the word is only punctuation.
 *  - On a TAP (pointer up with no drag started, movement under the tap
 *    tolerance): fire onTap(blockId) — the app places a bank block at the end of
 *    the sentence, or returns a sentence block to the bank, then re-checks win.
 *  - A drag (>= sensor activation distance) moves/reorders the block via the
 *    DndContext routing in JuiceSqueezeApp.
 * The DndContext sensors use distance activation, so a tap never starts a drag.
 * We confirm "no drag happened" via dnd-kit's `isDragging` plus a pointer
 * down/up position delta.
 *
 * Per-block color: each block gets a fruit color from the palette via the
 * `--blk` CSS custom property; game.css renders the glossy pill from it.
 *
 * Fruit-flip (settings.fruitsEnabled): show the level's fruit emoji instead of
 * the word text. Purely visual — the underlying word/order is unchanged.
 *
 * Also acts as a drop target ("insert before this block") via useDroppable so
 * blocks can be reordered precisely within a row or the bank.
 */
import { useEffect, useRef } from "react"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { isOnlyPunctuation } from "../util/tokenizer"
import { FRUIT_EMOJIS } from "../hooks/useGameLogic"

// Vibrant fruit palette (shipped game.ts ~1000), assigned per block by index.
export const BLOCK_PALETTE = [
  "#FF6B35",
  "#FF4D6D",
  "#FFCE00",
  "#7CB518",
  "#9B5DE5",
  "#00BBF9",
]

type Props = {
  blockId: string
  word: string
  /** Stable index used to pick a fruit emoji + color in fruit-flip mode. */
  fruitIndex: number
  blockLang: string
  fruitsEnabled: boolean
  rtl: boolean
  /** Shared, readable font size (px) for this block (giant words shrink only). */
  fontSize?: number
  /** True when this is the single "pressed" block (grow-on-touch feedback). */
  pressed?: boolean
  /** Mark/clear this block as the pressed one (single active at a time). */
  onPressChange?: (blockId: string | null) => void
  /** Speak the word (called on pointer-down for instant audio). */
  onTapSpeak: (word: string) => void
  /** Place/remove the block on a tap (no drag), then re-check win. */
  onTap: (blockId: string) => void
}

const TAP_MOVE_TOLERANCE = 6

export function WordBlock({
  blockId,
  word,
  fruitIndex,
  fruitsEnabled,
  rtl,
  fontSize,
  pressed,
  onPressChange,
  onTapSpeak,
  onTap,
}: Props) {
  const downPos = useRef<{ x: number; y: number } | null>(null)

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    transform,
    isDragging,
  } = useDraggable({ id: blockId, data: { type: "block", blockId } })

  // Drop target for "insert before this block".
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `slot-${blockId}`,
    data: { type: "slot", blockId },
  })

  const setRefs = (el: HTMLElement | null) => {
    setDragRef(el)
    setDropRef(el)
  }

  // Once dnd-kit promotes this to a drag, drop the pressed scale immediately so
  // the drag transform owns the geometry (no double-transform fight).
  useEffect(() => {
    if (isDragging && pressed) onPressChange?.(null)
  }, [isDragging, pressed, onPressChange])

  const color = BLOCK_PALETTE[fruitIndex % BLOCK_PALETTE.length]
  const display = fruitsEnabled ? FRUIT_EMOJIS[fruitIndex % FRUIT_EMOJIS.length] : word

  // Grow-on-touch (FIX 3): scale the pressed block ~1.5x. dnd-kit owns the drag
  // transform (translate3d) via the DragOverlay clone, so we only apply our
  // pressed scale when NOT dragging — the two never fight. transform-origin
  // centers the growth; z-index lifts it above neighbors.
  const dragTransform = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
    : undefined
  const pressTransform = pressed && !isDragging ? "scale(1.5)" : undefined

  const style: React.CSSProperties = {
    transform: dragTransform ?? pressTransform,
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none",
    ["--blk" as string]: color,
    transformOrigin: "center",
    transition: dragTransform ? undefined : "transform 0.12s ease-out",
    zIndex: pressed && !isDragging ? 5 : undefined,
    ...(fontSize != null ? { fontSize: `${fontSize}px` } : {}),
  }

  // Speak on pointer-DOWN for instant audio (shipped parity). Compose with
  // dnd-kit's own pointer-down listener so drag activation still works.
  const handlePointerDown = (e: React.PointerEvent) => {
    ;(listeners as Record<string, ((e: React.PointerEvent) => void) | undefined> | undefined)
      ?.onPointerDown?.(e)
    downPos.current = { x: e.clientX, y: e.clientY }
    // Grow-on-touch: mark this as the single pressed block (others clear).
    onPressChange?.(blockId)
    if (!isOnlyPunctuation(word)) {
      onTapSpeak(word)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = downPos.current
    downPos.current = null
    onPressChange?.(null)
    if (isDragging) return
    if (!start) return
    const dx = Math.abs(e.clientX - start.x)
    const dy = Math.abs(e.clientY - start.y)
    if (dx <= TAP_MOVE_TOLERANCE && dy <= TAP_MOVE_TOLERANCE) {
      // Tap (no meaningful drag): place/remove the block.
      onTap(blockId)
    }
  }

  // If a drag starts, clear the pressed scale so it doesn't fight the drag.
  const handlePointerCancel = () => {
    downPos.current = null
    onPressChange?.(null)
  }

  return (
    <button
      ref={setRefs}
      type="button"
      className={`jsf-block${isOver ? " jsf-block--over" : ""}`}
      style={style}
      dir={rtl ? "rtl" : "ltr"}
      data-testid="word-block"
      data-word={word}
      data-block-id={blockId}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
    >
      {display}
    </button>
  )
}
