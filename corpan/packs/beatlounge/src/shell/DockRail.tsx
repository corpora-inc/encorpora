/**
 * beatlounge — the Dock-Rail: the one persistent strip. Transport, BPM readout
 * (drag / wheel / type), master meter, the ⌘ command button (placeholder until
 * the LLM bar lands), and a drawer button. Bottom bar on phone; left rail on
 * tablet / desktop. Safe-area aware. Stays mounted across immersive transitions
 * so transport never disappears.
 */

import { useState } from "react"
import type { FormFactor } from "../contracts/module"
import { Glyph, Meter, Transport } from "../bl-ui"
import { ct } from "../i18n/strings"

interface Props {
  form: FormFactor
  playing: boolean
  onToggle: () => void
  bpm: number
  onBpm: (bpm: number) => void
  masterLevel: number
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onCommand: () => void
  /** Open the Scenes drawer (save / load complete states). Omitted ⇒ no button. */
  onScenes?: () => void
  /** Toggle record-arm on the selected synth. Omitted ⇒ no record button. */
  onToggleRecordArm?: () => void
  /** Whether the selected synth is currently armed (drives the lit state). */
  recordArmed?: boolean
  /** Whether there is a selectable melodic track to arm (else the button is disabled). */
  recordArmAvailable?: boolean
  onExit: () => void
}

const clampBpm = (v: number) => Math.max(20, Math.min(300, Math.round(v)))

export const DockRail = ({
  form,
  playing,
  onToggle,
  bpm,
  onBpm,
  masterLevel,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onCommand,
  onScenes,
  onToggleRecordArm,
  recordArmed = false,
  recordArmAvailable = false,
  onExit,
}: Props) => {
  const [editing, setEditing] = useState(false)
  const vertical = form !== "phone"

  return (
    <div className={`bl-rail bl-rail--${vertical ? "vertical" : "horizontal"}`}>
      {/* Back to Corpán — top-left, the corpan-pack standard. */}
      <button
        type="button"
        className="bl-icon-btn bl-rail-back"
        aria-label={ct("shell.back")}
        title={ct("shell.back")}
        onClick={onExit}
      >
        <Glyph name="chevron-left" size={22} />
      </button>

      <Transport playing={playing} onToggle={onToggle} size={vertical ? "lg" : "md"} />

      {onToggleRecordArm && (
        <button
          type="button"
          className={`bl-icon-btn bl-record-btn${recordArmed ? " is-armed" : ""}`}
          aria-label={ct("shell.record")}
          aria-pressed={recordArmed}
          title={recordArmed ? ct("shell.recordOnHint") : ct("shell.recordHint")}
          disabled={!recordArmAvailable}
          onClick={onToggleRecordArm}
        >
          <Glyph name="record" size={18} />
        </button>
      )}

      <div className="bl-bpm" data-bl-nocapture>
        {editing ? (
          <input
            className="bl-bpm-input"
            type="number"
            min={20}
            max={300}
            defaultValue={bpm}
            autoFocus
            onBlur={(e) => {
              onBpm(clampBpm(Number(e.currentTarget.value)))
              setEditing(false)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onBpm(clampBpm(Number(e.currentTarget.value)))
                setEditing(false)
              } else if (e.key === "Escape") setEditing(false)
            }}
          />
        ) : (
          <button
            type="button"
            className="bl-bpm-readout"
            onClick={() => setEditing(true)}
            onWheel={(e) => {
              e.preventDefault()
              onBpm(clampBpm(bpm + (e.deltaY > 0 ? -1 : 1)))
            }}
            aria-label={ct("shell.tempoValue", { bpm: String(bpm) })}
            title={ct("shell.tempoHint")}
          >
            <span className="bl-bpm-num">{bpm}</span>
            <span className="bl-bpm-unit">BPM</span>
          </button>
        )}
      </div>

      <Meter
        level={masterLevel}
        orientation={vertical ? "vertical" : "horizontal"}
        segments={vertical ? 14 : 10}
        label={ct("shell.master")}
      />

      <div className="bl-rail-spacer" />

      <button
        type="button"
        className="bl-icon-btn"
        aria-label={ct("shell.undo")}
        title={ct("shell.undo")}
        disabled={!canUndo}
        onClick={onUndo}
      >
        <Glyph name="undo" size={20} />
      </button>
      <button
        type="button"
        className="bl-icon-btn"
        aria-label={ct("shell.redo")}
        title={ct("shell.redo")}
        disabled={!canRedo}
        onClick={onRedo}
      >
        <Glyph name="redo" size={20} />
      </button>

      {onScenes && (
        <button
          type="button"
          className="bl-icon-btn bl-scenes-btn"
          aria-label={ct("shell.scenes")}
          title={ct("shell.scenesHint")}
          onClick={onScenes}
        >
          <Glyph name="drawer" size={20} />
        </button>
      )}

      <button
        type="button"
        className="bl-icon-btn bl-cmd-btn"
        aria-label={ct("shell.command")}
        title={ct("shell.commandHint")}
        onClick={onCommand}
      >
        <Glyph name="command" size={20} />
      </button>
    </div>
  )
}
