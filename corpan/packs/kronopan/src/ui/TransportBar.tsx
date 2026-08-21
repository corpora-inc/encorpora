import type { ClickDensity } from "../audio"
import type { LabelMode, NotationMode, ViewMode } from "../views"

export const MIN_BPM = 30
export const MAX_BPM = 300

const DENSITIES: { value: ClickDensity; label: string }[] = [
  { value: "cycle", label: "Cycle" },
  { value: "group-heads", label: "Heads" },
  { value: "pulse", label: "Pulse" },
  { value: "subdivision", label: "Subdiv" },
]

type Props = {
  playing: boolean
  onTogglePlay: () => void
  bpm: number
  onBpm: (bpm: number) => void
  density: ClickDensity
  onDensity: (d: ClickDensity) => void
  volume: number
  onVolume: (v: number) => void
  labelMode: LabelMode
  onLabelMode: (m: LabelMode) => void
  notationMode: NotationMode
  onNotationMode: (m: NotationMode) => void
  view: ViewMode
  onView: (v: ViewMode) => void
}

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "ring", label: "Ring" },
  { value: "spiral", label: "Spiral" },
]

export function TransportBar({
  playing,
  onTogglePlay,
  bpm,
  onBpm,
  density,
  onDensity,
  volume,
  onVolume,
  labelMode,
  onLabelMode,
  notationMode,
  onNotationMode,
  view,
  onView,
}: Props) {
  const clampBpm = (n: number) => Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(n)))

  return (
    <div className="kp-transport">
      <button
        className={`kp-play ${playing ? "is-playing" : ""}`}
        onClick={onTogglePlay}
        aria-label={playing ? "Stop" : "Start"}
      >
        {playing ? "Stop" : "Start"}
      </button>

      <div className="kp-tempo">
        <span className="kp-label">Tempo</span>
        <div className="kp-tempo-row">
          <button className="kp-step" onClick={() => onBpm(clampBpm(bpm - 1))} aria-label="Slower">
            &minus;
          </button>
          <span className="kp-bpm">{bpm}</span>
          <span className="kp-bpm-unit">bpm</span>
          <button className="kp-step" onClick={() => onBpm(clampBpm(bpm + 1))} aria-label="Faster">
            +
          </button>
        </div>
        <input
          className="kp-slider"
          type="range"
          min={MIN_BPM}
          max={MAX_BPM}
          value={bpm}
          onChange={(e) => onBpm(clampBpm(Number(e.target.value)))}
          aria-label="Tempo"
        />
      </div>

      <div className="kp-density">
        <span className="kp-label">Click</span>
        <div className="kp-seg" role="group" aria-label="Click density">
          {DENSITIES.map((d) => (
            <button
              key={d.value}
              className={`kp-seg-btn ${density === d.value ? "is-on" : ""}`}
              onClick={() => onDensity(d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kp-volume">
        <span className="kp-label">Level</span>
        <input
          className="kp-slider"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          aria-label="Click level"
        />
      </div>

      <div className="kp-labels">
        <span className="kp-label">View</span>
        <div className="kp-seg" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              className={`kp-seg-btn ${view === v.value ? "is-on" : ""}`}
              onClick={() => onView(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="kp-labels">
        <span className="kp-label">Notation</span>
        <div className="kp-seg" role="group" aria-label="Notation mode">
          <button
            className={`kp-seg-btn ${notationMode === "bars" ? "is-on" : ""}`}
            onClick={() => onNotationMode("bars")}
          >
            Bars
          </button>
          <button
            className={`kp-seg-btn ${notationMode === "dots" ? "is-on" : ""}`}
            onClick={() => onNotationMode("dots")}
          >
            Dots
          </button>
        </div>
      </div>

      <div className="kp-labels">
        <span className="kp-label">Show</span>
        <div className="kp-seg" role="group" aria-label="Bar labels">
          <button
            className={`kp-seg-btn ${labelMode === "number" ? "is-on" : ""}`}
            onClick={() => onLabelMode("number")}
            disabled={notationMode === "dots"}
          >
            1 2 3
          </button>
          <button
            className={`kp-seg-btn ${labelMode === "shortlong" ? "is-on" : ""}`}
            onClick={() => onLabelMode("shortlong")}
            disabled={notationMode === "dots"}
          >
            S L
          </button>
        </div>
      </div>
    </div>
  )
}
