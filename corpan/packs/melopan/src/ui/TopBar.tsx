import { useProjectStore } from "../storage/projectStore"
import { SkinPicker } from "./SkinPicker"

type Props = {
  isPlaying: boolean
  onTogglePlay: () => void
}

const requestExit = () => {
  try {
    window.dispatchEvent(new CustomEvent("corpan:exit"))
  } catch {
    // Host not present (vite dev); ignore.
  }
}

export const TopBar = ({ isPlaying, onTogglePlay }: Props) => {
  const project = useProjectStore((s) => s.project)
  const setBpm = useProjectStore((s) => s.setBpm)
  const setMasterVolume = useProjectStore((s) => s.setMasterVolume)
  const setTimeSignature = useProjectStore((s) => s.setTimeSignature)

  return (
    <div className="mp-top-bar">
      <button
        className="mp-btn mp-btn--exit"
        onClick={requestExit}
        aria-label="Exit Melopan"
        title="Exit Melopan"
      >
        ‹
      </button>
      <div className="mp-brand">MELOPAN</div>

      <div className="mp-transport">
        <button
          className={`mp-btn mp-btn--play ${isPlaying ? "is-playing" : ""}`}
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Stop" : "Play"}
          title={isPlaying ? "Stop" : "Play"}
        >
          {isPlaying ? "■" : "▶"}
        </button>
      </div>

      <div className="mp-control" title="Beats per minute">
        <span>BPM</span>
        <input
          type="number"
          min={40}
          max={240}
          value={project.bpm}
          onChange={(e) => setBpm(Number(e.target.value) || project.bpm)}
        />
      </div>

      <div className="mp-control" title="Time signature">
        <span>SIG</span>
        <select
          value={`${project.timeSignature[0]}/${project.timeSignature[1]}`}
          onChange={(e) => {
            const [t, b] = e.target.value.split("/").map(Number)
            setTimeSignature(t, b)
          }}
        >
          <option value="3/4">3/4</option>
          <option value="4/4">4/4</option>
          <option value="5/4">5/4</option>
          <option value="6/8">6/8</option>
          <option value="7/8">7/8</option>
        </select>
      </div>

      <div className="mp-control" title="Master volume">
        <span>VOL</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={project.masterVolume}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
        />
      </div>

      <div className="mp-spacer" />

      <SkinPicker />
    </div>
  )
}
