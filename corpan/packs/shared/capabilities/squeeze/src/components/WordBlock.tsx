/**
 * WordBlock — a single draggable word tile.
 *
 * Tap vs drag (shipped parity):
 *  - On pointer-DOWN: immediately speak the word in blockLang (INSTANT audio on
 *    touch, not on release), UNLESS the word is only punctuation.
 *  - On a TAP (pointer up with no drag started, movement under the tap
 *    tolerance): fire onTap(blockId) — the consumer places a bank block at the
 *    end of the sentence, or returns a sentence block to the bank, then
 *    re-checks win.
 *  - A drag (>= sensor activation distance) moves/reorders the block via the
 *    consumer's DndContext routing.
 * The DndContext sensors use distance activation, so a tap never starts a drag.
 *
 * Per-block color: each block gets a fruit color from the palette via the
 * `--capSqz-blk` CSS custom property; the capability stylesheet renders the glossy
 * pill from it.
 *
 * Fruit-flip (fruitsEnabled): show a fruit emoji instead of the word text.
 * Purely visual — the underlying word/order is unchanged.
 *
 * Also acts as a drop target ("insert before this block") via useDroppable so
 * blocks can be reordered precisely within a row or the bank.
 *
 * MOVED from packs/juice-squeeze/src/components (capability-modules.md §4.2).
 */
import { useEffect, useRef } from "react"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { isOnlyPunctuation } from "../tokenizer"

// Vibrant fruit palette (shipped juice-squeeze), assigned per block by index.
export const BLOCK_PALETTE = [
  "#FF6B35",
  "#FF4D6D",
  "#FFCE00",
  "#7CB518",
  "#9B5DE5",
  "#00BBF9",
]

// Emoji set for fruit-flip mode (moved with the block tile it decorates;
// juice-squeeze re-exports it from useGameLogic for its own call sites).
export const FRUIT_EMOJIS = ["🍊", "🥭", "🍍", "🍋", "🍇", "🍎", "🍓", "🍑"]

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

  // Grow-on-touch: scale the pressed block ~1.5x. dnd-kit owns the drag
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
    ["--capSqz-blk" as string]: color,
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

  const handlePointerUp = () => {
    downPos.current = null
    onPressChange?.(null)
    // If dnd-kit's 8px distance sensor never activated a drag, this IS a tap —
    // place/remove the block. (A 6px tap-tolerance previously left a 6–8px dead
    // zone where a slight touch neither dragged nor tapped — "barely touched but
    // it didn't move". Any non-drag now counts as a tap.)
    if (isDragging) return
    onTap(blockId)
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
      className={`capSqz-block${isOver ? " capSqz-block--over" : ""}`}
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
