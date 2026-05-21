import { useProjectStore } from "../storage/projectStore"
import type { Track, TrackId } from "../model/project"

type Props = {
  playheadStep: number
  onPreview: (trackId: TrackId) => void
}

const Row = ({
  track,
  playheadStep,
  onToggle,
  onVolume,
  onMute,
  onPreview,
}: {
  track: Track
  playheadStep: number
  onToggle: (i: number) => void
  onVolume: (v: number) => void
  onMute: () => void
  onPreview: () => void
}) => {
  return (
    <div className="mp-row">
      <div className="mp-row-label" onClick={onPreview} title={`Preview ${track.name}`}>
        <span className="mp-row-emoji">{track.emoji}</span>
        <span>{track.name}</span>
        {track.mute && <span style={{ opacity: 0.5, fontSize: 12 }}>(muted)</span>}
      </div>
      <div
        className="mp-cells"
        style={{ gridTemplateColumns: `repeat(${track.steps.length}, 1fr)` }}
      >
        {track.steps.map((on, i) => {
          const isBeatStart = i % 4 === 0
          const isPlayhead = i === playheadStep
          const cls = [
            "mp-cell",
            on ? "is-on" : "",
            isBeatStart ? "is-beat-start" : "",
            isPlayhead ? "is-playhead" : "",
          ].filter(Boolean).join(" ")
          return (
            <div
              key={i}
              className={cls}
              onClick={() => onToggle(i)}
              role="button"
              aria-label={`${track.name} step ${i + 1}`}
              aria-pressed={on}
            />
          )
        })}
      </div>
      <div className="mp-row-side">
        <button
          className="mp-btn"
          onClick={onMute}
          style={{ padding: "2px 8px", fontSize: 12 }}
          title="Mute"
        >
          {track.mute ? "Unmute" : "Mute"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={track.volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          title={`Volume: ${Math.round(track.volume * 100)}%`}
        />
      </div>
    </div>
  )
}

export const StepGrid = ({ playheadStep, onPreview }: Props) => {
  const tracks = useProjectStore((s) => s.project.tracks)
  const toggleStep = useProjectStore((s) => s.toggleStep)
  const setTrackVolume = useProjectStore((s) => s.setTrackVolume)
  const toggleMute = useProjectStore((s) => s.toggleMute)

  return (
    <div className="mp-grid-wrap">
      {tracks.map((t) => (
        <Row
          key={t.id}
          track={t}
          playheadStep={playheadStep}
          onToggle={(i) => toggleStep(t.id, i)}
          onVolume={(v) => setTrackVolume(t.id, v)}
          onMute={() => toggleMute(t.id)}
          onPreview={() => onPreview(t.id)}
        />
      ))}
    </div>
  )
}
