import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import type { Cycle, Unit } from "../core"
import { PRESETS, totalPulses, subdivide } from "../core"
import { roleColor } from "../theme"
import { colorRoleForLength } from "../notation"

const UNITS: Unit[] = [4, 8, 16]
const MAX_GROUP = 16

type Props = {
  cycle: Cycle
  onChange: (cycle: Cycle) => void
}

const isPresetCycle = (cycle: Cycle): boolean => PRESETS.some((p) => p.id === cycle.id)

// Presets listed chronologically by length, so the picker reads 3, 4, 5, 6, 7
// and upward.
const PRESETS_BY_LENGTH = [...PRESETS].sort((a, b) => totalPulses(a) - totalPulses(b))

// Editing the cycle restarts it from the top; the shell says so next to this
// editor. Any edit also detaches it from its preset (id becomes "custom") so the
// header stops claiming a dance name it no longer matches. Groups are positive
// integers, held to a sane 1..16 in the stepper.
export function GroupEditor({ cycle, onChange }: Props) {
  // Merge a change and mark the result custom, since it no longer is the preset.
  const edit = (patch: Partial<Cycle>) =>
    onChange({ ...cycle, ...patch, id: "custom", name: "Custom" })

  const setGroups = (groups: number[]) => edit({ groups })

  const bump = (index: number, delta: number) => {
    const next = cycle.groups.slice()
    next[index] = Math.max(1, Math.min(MAX_GROUP, next[index] + delta))
    setGroups(next)
  }
  const remove = (index: number) => setGroups(cycle.groups.filter((_, i) => i !== index))
  const add = () => setGroups([...cycle.groups, 2])

  // Break a group of four or more into 2s and 3s in place.
  const split = (index: number) => {
    const next = cycle.groups.slice()
    next.splice(index, 1, ...subdivide(cycle.groups[index]))
    setGroups(next)
  }

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (p) onChange({ ...p })
  }

  // Drag to reorder groups, with mouse or finger. Pointer capture routes the
  // move/up to the grip so a touch-drag does not scroll the controls instead,
  // and the dragged pill just translates under the pointer; the order is
  // committed once on drop, so nothing is fragile mid-drag.
  const pillRefs = useRef<(HTMLDivElement | null)[]>([])
  const groupsRef = useRef(cycle.groups)
  groupsRef.current = cycle.groups
  const [drag, setDrag] = useState<{ index: number; dx: number; target: number } | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag
  const startX = useRef(0)

  const onGripDown = (i: number, e: ReactPointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    startX.current = e.clientX
    setDrag({ index: i, dx: 0, target: i })
  }
  const onGripMove = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const cx = e.clientX
    let target = d.index
    for (let j = 0; j < groupsRef.current.length; j++) {
      if (j === d.index) continue
      const el = pillRefs.current[j]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (cx >= r.left && cx <= r.right) {
        target = j
        break
      }
    }
    setDrag({ index: d.index, dx: cx - startX.current, target })
  }
  const onGripUp = (e: ReactPointerEvent) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    const d = dragRef.current
    if (d && d.target !== d.index) {
      const next = groupsRef.current.slice()
      const [moved] = next.splice(d.index, 1)
      next.splice(d.target, 0, moved)
      setGroups(next)
    }
    setDrag(null)
  }

  return (
    <div className="kp-editor">
      <div className="kp-editor-top">
        <label className="kp-field">
          <span className="kp-label">Preset</span>
          <select
            className="kp-select"
            value={isPresetCycle(cycle) ? cycle.id : "custom"}
            onChange={(e) => applyPreset(e.target.value)}
          >
            {!isPresetCycle(cycle) && <option value="custom">Custom</option>}
            {PRESETS_BY_LENGTH.map((p) => (
              <option key={p.id} value={p.id}>
                {totalPulses(p)} · {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="kp-field">
          <span className="kp-label">Pulse</span>
          <div className="kp-seg" role="group" aria-label="Pulse value">
            {UNITS.map((u) => (
              <button
                key={u}
                className={`kp-seg-btn ${cycle.unit === u ? "is-on" : ""}`}
                onClick={() => edit({ unit: u })}
              >
                1/{u}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="kp-groups">
        {cycle.groups.map((g, i) => {
          const color = roleColor(colorRoleForLength(g))
          return (
            <div
              className={`kp-group ${drag?.index === i ? "is-dragging" : ""} ${
                drag && drag.index !== i && drag.target === i ? "is-drop-target" : ""
              }`}
              key={i}
              ref={(el) => {
                pillRefs.current[i] = el
              }}
              style={{
                borderColor: color,
                transform:
                  drag?.index === i ? `translateX(${drag.dx}px) scale(1.06)` : undefined,
              }}
            >
              <span
                className="kp-grip"
                onPointerDown={(e) => onGripDown(i, e)}
                onPointerMove={onGripMove}
                onPointerUp={onGripUp}
                onPointerCancel={onGripUp}
                aria-label="Drag to reorder"
                title="Drag to reorder"
              >
                ⠿
              </span>
              <button className="kp-group-btn" onClick={() => bump(i, +1)} aria-label="Longer">
                +
              </button>
              <span className="kp-group-n" style={{ color }}>
                {g}
              </span>
              <button className="kp-group-btn" onClick={() => bump(i, -1)} aria-label="Shorter">
                &minus;
              </button>
              {g >= 4 && (
                <button
                  className="kp-group-x"
                  onClick={() => split(i)}
                  aria-label="Subdivide into 2s and 3s"
                  title="Subdivide into 2s and 3s"
                >
                  &divide;
                </button>
              )}
              <button className="kp-group-x" onClick={() => remove(i)} aria-label="Remove group">
                &times;
              </button>
            </div>
          )
        })}
        <button className="kp-add" onClick={add} aria-label="Add group">
          + group
        </button>
      </div>

      <p className="kp-hint">Drag a group by its handle to reorder. Editing restarts the cycle.</p>
    </div>
  )
}
