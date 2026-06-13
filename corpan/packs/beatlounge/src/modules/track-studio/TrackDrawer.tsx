/**
 * beatlounge — TrackDrawer: the reusable bottom PIPELINE DRAWER shared by the
 * track-studio pages (Drums and Phrase Jam).
 *
 * It is a full-width bottom drawer that overlays the grid: an oversized drag
 * handle + a tab bar + the active tab's body. The host supplies the TABS (Drums
 * passes Grooves / Kit / Effects / Mixer; Phrase Jam passes Grooves / Effects /
 * Mixer — no Kit), so the two pages share ONE drawer and can't drift.
 *
 * Three states — peek (handle + tab bar only, grid full-height), open (working
 * height) and expanded (taller, for the iPad). Drag the handle (or tap it) to
 * cycle; arrow keys nudge between states. It lives INSIDE the page container
 * (never document.body), uses the one z-scale + safe-area insets, and honors
 * prefers-reduced-motion (CSS drops the transition; the height still snaps).
 *
 * The drawer never starts playback — it only hosts the setup tools. Pointer
 * capture on the handle bails on chrome (`data-bl-nocapture` carriers).
 */

import { useRef, type PointerEvent, type ReactNode } from "react"
import { ct } from "../../i18n/strings"

/** peek = handle + tabs only (grid full-height); open = working height;
 *  expanded = taller (uses the extra height on a big iPad). */
export type DrawerState = "peek" | "open" | "expanded"

/** One drawer tab: a stable id, a label, and a lazy body renderer (only the
 *  active tab renders, so heavy panels mount on demand). */
export interface DrawerTabDef {
  id: string
  label: string
  render: () => ReactNode
}

interface Props {
  /** Accessible label for the whole drawer region. */
  label: string
  /** Accessible label for the tab list. */
  tabsLabel: string
  tabs: ReadonlyArray<DrawerTabDef>
  activeTab: string
  onTab: (id: string) => void
  state: DrawerState
  setState: (s: DrawerState) => void
}

const PX_DRAG_THRESHOLD = 28 // px — beyond this is a drag, not a tap

export const TrackDrawer = ({
  label,
  tabsLabel,
  tabs,
  activeTab,
  onTab,
  state,
  setState,
}: Props) => {
  // Drag the handle vertically to change state. We track total dy and snap on
  // release; a tap (tiny dy) cycles to the next state.
  const dragStart = useRef<number | null>(null)
  const dragMoved = useRef(0)

  const cycle = () => {
    // peek → open → expanded → peek
    setState(state === "peek" ? "open" : state === "open" ? "expanded" : "peek")
  }
  const grow = () => setState(state === "peek" ? "open" : "expanded")
  const shrink = () => setState(state === "expanded" ? "open" : "peek")

  const onHandleDown = (e: PointerEvent) => {
    dragStart.current = e.clientY
    dragMoved.current = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onHandleMove = (e: PointerEvent) => {
    if (dragStart.current == null) return
    dragMoved.current = e.clientY - dragStart.current
  }
  const onHandleUp = (e: PointerEvent) => {
    if (dragStart.current == null) return
    const dy = dragMoved.current
    dragStart.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    if (dy < -PX_DRAG_THRESHOLD) grow()
    else if (dy > PX_DRAG_THRESHOLD) shrink()
    else cycle() // a tap cycles
  }

  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0]

  return (
    <section className={`bl-trackdrawer is-${state}`} aria-label={label}>
      <div
        className="bl-trackdrawer-handle"
        data-bl-nocapture
        role="button"
        tabIndex={0}
        aria-label={
          state === "peek"
            ? ct("trackStudio.openDrawer", { label })
            : state === "open"
              ? ct("trackStudio.expandDrawer", { label })
              : ct("trackStudio.collapseDrawer", { label })
        }
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            cycle()
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            grow()
          } else if (e.key === "ArrowDown") {
            e.preventDefault()
            shrink()
          }
        }}
      >
        <span className="bl-trackdrawer-grip" aria-hidden="true" />
      </div>

      <div
        className="bl-trackdrawer-tabs"
        data-bl-nocapture
        role="tablist"
        aria-label={tabsLabel}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active.id === t.id}
            className={`bl-trackdrawer-tab${active.id === t.id ? " is-on" : ""}`}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {state !== "peek" && (
        <div className="bl-trackdrawer-body">{active.render()}</div>
      )}
    </section>
  )
}
