import { useRef, type PointerEvent } from "react"
import { useProjectStore } from "../storage/projectStore"
import type { LayoutHeights } from "../model/project"

type Props = {
  /** Which layout key this handle resizes (the section directly above it). */
  targetKey: keyof LayoutHeights
  /** Default initial height when layout has no value yet (px). */
  defaultPx: number
  minPx?: number
  maxPx?: number
}

/**
 * Drag handle (touch + mouse) that resizes the section above it by
 * mutating one key on `project.layout`. Heights persist via the
 * regular project save path so the layout survives reloads.
 */
export const ResizeHandle = ({
  targetKey,
  defaultPx,
  minPx = 80,
  maxPx = 800,
}: Props) => {
  const setLayout = useProjectStore((s) => s.setLayout)
  const layout = useProjectStore((s) => s.project.layout)
  const startRef = useRef<{ y: number; h: number } | null>(null)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = {
      y: e.clientY,
      h: layout?.[targetKey] ?? defaultPx,
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return
    const delta = e.clientY - startRef.current.y
    const next = Math.max(minPx, Math.min(maxPx, startRef.current.h + delta))
    setLayout({ [targetKey]: next })
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (startRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    startRef.current = null
  }

  return (
    <div
      className="mp-resize-handle"
      role="separator"
      aria-orientation="horizontal"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title="Drag to resize"
    >
      <div className="mp-resize-grip" />
    </div>
  )
}
