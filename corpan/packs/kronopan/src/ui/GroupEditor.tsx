import type { Cycle, Unit } from "../core"
import { PRESETS } from "../core"
import { roleColor } from "../theme"
import { colorRoleForLength } from "../notation"

const UNITS: Unit[] = [4, 8, 16]
const MAX_GROUP = 16

type Props = {
  cycle: Cycle
  onChange: (cycle: Cycle) => void
}

// Editing the cycle restarts it from the top; the shell says so next to this
// editor. Groups are positive integers, held to a sane 1..16 in the stepper.
export function GroupEditor({ cycle, onChange }: Props) {
  const setGroups = (groups: number[]) => onChange({ ...cycle, groups })

  const bump = (index: number, delta: number) => {
    const next = cycle.groups.slice()
    next[index] = Math.max(1, Math.min(MAX_GROUP, next[index] + delta))
    setGroups(next)
  }
  const remove = (index: number) => setGroups(cycle.groups.filter((_, i) => i !== index))
  const add = () => setGroups([...cycle.groups, 2])

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (p) onChange({ ...p })
  }

  return (
    <div className="kp-editor">
      <div className="kp-editor-top">
        <label className="kp-field">
          <span className="kp-label">Preset</span>
          <select
            className="kp-select"
            value={PRESETS.find((p) => p.id === cycle.id)?.id ?? ""}
            onChange={(e) => applyPreset(e.target.value)}
          >
            <option value="" disabled>
              Choose
            </option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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
                onClick={() => onChange({ ...cycle, unit: u })}
              >
                1/{u}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="kp-groups">
        {cycle.groups.map((g, i) => (
          <div className="kp-group" key={i} style={{ borderColor: roleColor(colorRoleForLength(g)) }}>
            <button className="kp-group-btn" onClick={() => bump(i, +1)} aria-label="Longer">
              +
            </button>
            <span className="kp-group-n" style={{ color: roleColor(colorRoleForLength(g)) }}>
              {g}
            </span>
            <button className="kp-group-btn" onClick={() => bump(i, -1)} aria-label="Shorter">
              &minus;
            </button>
            <button className="kp-group-x" onClick={() => remove(i)} aria-label="Remove group">
              &times;
            </button>
          </div>
        ))}
        <button className="kp-add" onClick={add} aria-label="Add group">
          + group
        </button>
      </div>

      <p className="kp-hint">Editing the cycle restarts it from the top.</p>
    </div>
  )
}
