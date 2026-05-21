import { useProjectStore } from "../storage/projectStore"
import { PIANO_ROLL_PITCHES, PIANO_ROLL_PITCH_LABELS } from "../model/project"

type Props = {
  playheadStep: number
  onPreviewNote: (midi: number) => void
}

export const PianoRoll = ({ playheadStep, onPreviewNote }: Props) => {
  const synth = useProjectStore((s) => s.project.synth)
  const lengthSteps = useProjectStore((s) => s.project.lengthSteps)
  const setSynthNote = useProjectStore((s) => s.setSynthNote)
  const clearSynthNotes = useProjectStore((s) => s.clearSynthNotes)
  const setSynthVolume = useProjectStore((s) => s.setSynthVolume)
  const toggleSynthMute = useProjectStore((s) => s.toggleSynthMute)

  const handleCellClick = (step: number, pitch: number) => {
    const currentlyAt = synth.notes[step]
    if (currentlyAt === pitch) {
      // toggle off
      setSynthNote(step, null)
    } else {
      setSynthNote(step, pitch)
      onPreviewNote(pitch)
    }
  }

  return (
    <div className="mp-grid-wrap mp-piano-roll">
      <div className="mp-piano-roll-head">
        <div className="mp-row-label">
          <span className="mp-row-emoji">♪</span>
          <span>{synth.name}</span>
          {synth.mute && <span style={{ opacity: 0.5, fontSize: 12 }}>(muted)</span>}
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
          const label = PIANO_ROLL_PITCH_LABELS[rowIdx]
          return (
            <div key={pitch} className="mp-piano-row">
              <div
                className="mp-piano-key"
                onClick={() => onPreviewNote(pitch)}
                title={`Preview ${label}`}
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
                      onClick={() => handleCellClick(step, pitch)}
                      aria-label={`${label} step ${step + 1}`}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
