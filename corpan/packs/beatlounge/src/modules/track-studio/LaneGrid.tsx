/**
 * beatlounge — LaneGrid: the reusable SELECTABLE lane grid shared by the
 * track-studio pages (Drums and Phrase Jam).
 *
 * One row per lane: a SELECTABLE head (tap to toggle — the selection re-points
 * whatever groove you scatter) + a row of step cells you paint on. The head is a
 * single-line <button> centered the bulletproof way (line-height == height, NOT
 * flex — WebKit/Safari won't center text inside a <button> via flex), and the
 * SELECTED state is ONE uniform full-row accent band (`.bl-lane.is-selected`) so
 * the head + cells share the exact same highlight and nothing looks misaligned.
 * DO NOT reintroduce flex centering on the head — that is the regression this
 * shape exists to prevent.
 *
 * It is grid-content-agnostic: the host passes its lanes (drum pitches OR phrase
 * snippets) keyed by a stable id, plus paint-stroke handlers. Painting only
 * WRITES the grid — never auto-plays ("setup, don't play").
 */

import { useRef, type ReactNode } from "react"
import { ct } from "../../i18n/strings"

/** Per-step state for a cell in the lane grid. */
export interface LaneGridCell {
  on: boolean
  /** 0..1 — drives the on-cell glow intensity. */
  velocity: number
}

/** One lane = one selectable row. `key` is the stable identity (drum pitch or
 *  snippet id); `selectKey` is what the selection set is keyed on. */
export interface LaneGridLane {
  /** Stable React key + selection key. */
  key: string
  /** The value passed back to onToggleLane / selection lookups. */
  selectKey: string
  /** Centered single-line label (the hard-won line-height centering). */
  label: string
  /** Optional trailing chip (e.g. a language tag) shown after the label. */
  badge?: ReactNode
  /** Optional richer head content (e.g. an audition button). Rendered AFTER the
   *  label inside the head row; the head stays a single visual line. */
  title?: string
  cells: LaneGridCell[]
}

interface Props {
  lanes: ReadonlyArray<LaneGridLane>
  steps: number
  stepsPerBeat: number
  /** The live playhead column (or -1). */
  playStep: number
  /** Whether the whole track is silenced (mute / not-solo) — dims the cells. */
  silent: boolean
  /** Selection set, keyed on lane.selectKey. */
  selected: ReadonlySet<string>
  onToggleLane: (selectKey: string) => void
  /** Place / clear a cell. `on` is the target state. */
  setCell: (laneIndex: number, step: number, on: boolean) => void
  /** Is this (laneIndex, step) currently lit? Used to seed the paint stroke. */
  isCellOn: (laneIndex: number, step: number) => boolean
  // ---- SELECT MODE (Score note-selection, #331) — optional; Drums omits these,
  //      so its paint behaviour is unchanged. When `selectMode` is true a cell
  //      stroke toggles the SELECTION of lit notes instead of painting.
  selectMode?: boolean
  /** Selected cell keys, formatted "laneIndex:step". */
  selectedCells?: ReadonlySet<string>
  /** Set a lit cell's SELECTED state to `sel` (only called for on cells). */
  setCellSelected?: (laneIndex: number, step: number, sel: boolean) => void
}

/**
 * The selectable lane grid. Owns the paint-stroke state internally (a single
 * pointer stroke paints many cells) so both pages get identical paint behavior.
 */
export const LaneGrid = ({
  lanes,
  steps,
  stepsPerBeat,
  playStep,
  silent,
  selected,
  onToggleLane,
  setCell,
  isCellOn,
  selectMode = false,
  selectedCells,
  setCellSelected,
}: Props) => {
  const paintMode = useRef<null | "add" | "remove">(null)
  // Select-stroke intent: true = selecting, false = deselecting (mirrors paint).
  const selectStroke = useRef<null | boolean>(null)
  const touched = useRef(new Set<string>())

  const onCellDown = (laneIndex: number, step: number) => {
    if (selectMode) {
      // Only lit notes are selectable; toggle this one and seed the stroke.
      if (!isCellOn(laneIndex, step)) return
      const key = `${laneIndex}:${step}`
      const want = !(selectedCells?.has(key) ?? false)
      selectStroke.current = want
      touched.current = new Set([key])
      setCellSelected?.(laneIndex, step, want)
      return
    }
    const isOn = isCellOn(laneIndex, step)
    paintMode.current = isOn ? "remove" : "add"
    touched.current = new Set([`${laneIndex}:${step}`])
    setCell(laneIndex, step, !isOn)
  }
  const onCellEnter = (laneIndex: number, step: number) => {
    const key = `${laneIndex}:${step}`
    if (selectMode) {
      if (selectStroke.current === null || touched.current.has(key)) return
      if (!isCellOn(laneIndex, step)) return // drag only over notes
      touched.current.add(key)
      setCellSelected?.(laneIndex, step, selectStroke.current)
      return
    }
    if (!paintMode.current || touched.current.has(key)) return
    touched.current.add(key)
    setCell(laneIndex, step, paintMode.current === "add")
  }
  const endStroke = () => {
    paintMode.current = null
    selectStroke.current = null
    touched.current.clear()
  }
  // Touch drag-to-SELECT: iOS WebView won't reliably fire pointerenter on sibling
  // cells mid-drag (the press captures the pointer), so during a select stroke we
  // hit-test the finger position and extend the selection to whatever cell it's
  // over. (Paint keeps its tap behaviour; this is gated on an active select stroke.)
  const onBodyPointerMove = (e: React.PointerEvent) => {
    if (selectStroke.current === null) return
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const cell = el?.closest<HTMLElement>("[data-lane]")
    if (!cell) return
    const li = Number(cell.dataset.lane)
    const s = Number(cell.dataset.step)
    if (Number.isNaN(li) || Number.isNaN(s)) return
    onCellEnter(li, s)
  }

  return (
    <div
      className="bl-grid-body"
      style={{ ["--bl-steps" as string]: String(steps) }}
      onPointerMove={onBodyPointerMove}
      onPointerUp={endStroke}
      onPointerLeave={endStroke}
      onPointerCancel={endStroke}
    >
      {lanes.map((lane, laneIndex) => {
        const isSel = selected.has(lane.selectKey)
        return (
          <div className={`bl-lane${isSel ? " is-selected" : ""}`} key={lane.key}>
            <button
              type="button"
              className={`bl-lane-head${isSel ? " is-selected" : ""}`}
              data-bl-nocapture
              aria-pressed={isSel}
              title={
                lane.title ??
                (isSel
                  ? ct("trackStudio.laneSelected", { label: lane.label })
                  : ct("trackStudio.laneSelectHint", { label: lane.label }))
              }
              onClick={() => onToggleLane(lane.selectKey)}
            >
              <span className="bl-lane-name">{lane.label}</span>
              {lane.badge}
            </button>
            <div
              className={`bl-lane-cells${silent ? " is-silent" : ""}`}
              role="row"
            >
              {lane.cells.map((cell, s) => (
                <button
                  key={s}
                  type="button"
                  role="gridcell"
                  aria-pressed={cell.on}
                  aria-label={ct("trackStudio.laneStep", { label: lane.label, n: String(s + 1) })}
                  className={
                    "bl-cell" +
                    (cell.on ? " is-on" : "") +
                    (s === playStep ? " is-active" : "") +
                    (s % stepsPerBeat === 0 ? " is-beat" : "") +
                    (selectMode && cell.on && selectedCells?.has(`${laneIndex}:${s}`)
                      ? " is-selected-cell"
                      : "")
                  }
                  data-bl-nocapture
                  data-lane={laneIndex}
                  data-step={s}
                  style={
                    cell.on
                      ? ({ "--bl-cell-vel": String(0.45 + cell.velocity * 0.55) } as React.CSSProperties)
                      : undefined
                  }
                  onPointerDown={(e) => {
                    if (e.button != null && e.button > 0) return
                    onCellDown(laneIndex, s)
                  }}
                  // Desktop drag-paint/select goes through enter; touch drag-select is
                  // handled reliably by the body's pointermove hit-test. onCellEnter
                  // no-ops unless a stroke is active, so a plain hover is inert.
                  onPointerEnter={() => onCellEnter(laneIndex, s)}
                >
                  <span className="bl-cell-core" />
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
