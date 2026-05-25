import { useRef, useState } from "react"
import { useProjectStore } from "../storage/projectStore"
import {
  PIANO_ROLL_PITCHES,
  PIANO_ROLL_PITCH_LABELS,
  effectivePitch,
} from "../model/project"

type Props = {
  playheadStep: number
  onPreviewNote: (midi: number) => void
}

const LONG_PRESS_MS = 480

const labelWithAccidental = (rowIdx: number, acc: number): string => {
  const base = PIANO_ROLL_PITCH_LABELS[rowIdx] ?? ""
  if (acc === -1) return `${base[0]}♭${base.slice(1)}`
  if (acc === 1) return `${base[0]}♯${base.slice(1)}`
  return base
}

export const PianoRoll = ({ playheadStep, onPreviewNote }: Props) => {
  const synth = useProjectStore((s) => s.project.synth)
  const lengthSteps = useProjectStore((s) => s.project.lengthSteps)
  const setSynthNote = useProjectStore((s) => s.setSynthNote)
  const clearSynthNotes = useProjectStore((s) => s.clearSynthNotes)
  const setSynthVolume = useProjectStore((s) => s.setSynthVolume)
  const toggleSynthMute = useProjectStore((s) => s.toggleSynthMute)
  const setAccidental = useProjectStore((s) => s.setAccidental)

  const [popoverRow, setPopoverRow] = useState<number | null>(null)
  /** "idle" | "pressing" | "longpressed" */
  const longPressStateRef = useRef<"idle" | "pressing" | "longpressed">("idle")
  const pressTimerRef = useRef<number | null>(null)

  const startPress = (rowIdx: number) => {
    longPressStateRef.current = "pressing"
    pressTimerRef.current = window.setTimeout(() => {
      longPressStateRef.current = "longpressed"
      setPopoverRow(rowIdx)
    }, LONG_PRESS_MS)
  }

  const cancelPress = () => {
    if (pressTimerRef.current != null) {
      window.clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  const endPress = (rowIdx: number) => {
    cancelPress()
    if (longPressStateRef.current === "pressing") {
      // Short tap — preview
      const midi = effectivePitch(rowIdx, synth.accidentals)
      onPreviewNote(midi)
    }
    longPressStateRef.current = "idle"
  }

  const handleCellClick = (step: number, basePitch: number, rowIdx: number) => {
    const currentlyAt = synth.notes[step]
    if (currentlyAt === basePitch) {
      setSynthNote(step, null)
    } else {
      setSynthNote(step, basePitch)
      onPreviewNote(effectivePitch(rowIdx, synth.accidentals))
    }
  }

  return (
    <div className="mp-grid-wrap mp-piano-roll">
      <div className="mp-piano-roll-head">
        <div className="mp-row-label">
          <span className="mp-row-emoji">♪</span>
          <span>{synth.name}</span>
        </div>
        <div className="mp-piano-roll-controls">
          <button className="mp-btn" onClick={toggleSynthMute} style={{ padding: "2px 8px", fontSize: 12 }}>
            {synth.mute ? "Unmute" : "Mute"}
          </button>
          <button className="mp-btn" onClick={clearSynthNotes} style={{ padding: "2px 8px", fontSize: 12 }}>
            Clear
          </button>
          <div className="mp-control" style={{ fontSize: 14 }}>
            <span>VOL</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={synth.volume}
              onChange={(e) => setSynthVolume(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </div>
        </div>
      </div>

      <div className="mp-piano-roll-grid">
        {PIANO_ROLL_PITCHES.map((pitch, rowIdx) => {
          const acc = synth.accidentals[rowIdx] ?? 0
          const label = labelWithAccidental(rowIdx, acc)
          return (
            <div key={pitch} className="mp-piano-row">
              <div
                className={`mp-piano-key ${acc !== 0 ? "is-altered" : ""}`}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId)
                  startPress(rowIdx)
                }}
                onPointerUp={() => endPress(rowIdx)}
                onPointerCancel={cancelPress}
                onPointerLeave={cancelPress}
                onContextMenu={(e) => e.preventDefault()}
                title={`Tap to preview ${label}, hold for ♭/♮/♯`}
              >
                {label}
              </div>
              <div className="mp-piano-cells">
                {Array.from({ length: lengthSteps }, (_, step) => {
                  const noteAtStep = synth.notes[step]
                  const isActive = noteAtStep === pitch
                  const isOccupiedElsewhere = noteAtStep != null && !isActive
                  const isBeatStart = step % 4 === 0
                  const isPlayhead = step === playheadStep
                  const cls = [
                    "mp-piano-cell",
                    isActive ? "is-on" : "",
                    isOccupiedElsewhere ? "is-shadow" : "",
                    isBeatStart ? "is-beat-start" : "",
                    isPlayhead ? "is-playhead" : "",
                  ].filter(Boolean).join(" ")
                  return (
                    <div
                      key={step}
                      className={cls}
                      onClick={() => handleCellClick(step, pitch, rowIdx)}
                      aria-label={`${label} step ${step + 1}`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {popoverRow != null && (
        <>
          <div
            className="mp-popover-backdrop"
            onClick={() => setPopoverRow(null)}
            onPointerDown={() => setPopoverRow(null)}
          />
          <div className="mp-accidental-popover" role="menu">
            <button
              className={`mp-acc-btn ${synth.accidentals[popoverRow] === -1 ? "is-active" : ""}`}
              onClick={() => { setAccidental(popoverRow, -1); setPopoverRow(null) }}
              aria-label="Flatten"
            >
              ♭
            </button>
            <button
              className={`mp-acc-btn ${synth.accidentals[popoverRow] === 0 ? "is-active" : ""}`}
              onClick={() => { setAccidental(popoverRow, 0); setPopoverRow(null) }}
              aria-label="Natural"
            >
              ♮
            </button>
            <button
              className={`mp-acc-btn ${synth.accidentals[popoverRow] === 1 ? "is-active" : ""}`}
              onClick={() => { setAccidental(popoverRow, 1); setPopoverRow(null) }}
              aria-label="Sharpen"
            >
              ♯
            </button>
          </div>
        </>
      )}
    </div>
  )
}
