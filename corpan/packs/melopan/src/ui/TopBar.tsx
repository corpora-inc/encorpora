import { useEffect, useRef, useState } from "react"
import { useProjectStore } from "../storage/projectStore"
import { availableStepCounts } from "../model/project"
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

const BPM_MIN = 40
const BPM_MAX = 240

export const TopBar = ({ isPlaying, onTogglePlay }: Props) => {
  const project = useProjectStore((s) => s.project)
  const setBpm = useProjectStore((s) => s.setBpm)
  const setMasterVolume = useProjectStore((s) => s.setMasterVolume)
  const setTimeSignature = useProjectStore((s) => s.setTimeSignature)
  const setLengthSteps = useProjectStore((s) => s.setLengthSteps)
  const resetProject = useProjectStore((s) => s.resetProject)

  // Two-stage confirm — tap once to arm (button shows "?"), tap again
  // within 3s to actually reset. Avoids window.confirm(), which is
  // unreliable inside the Tauri webview / iOS host.
  const [resetArmed, setResetArmed] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearResetTimer = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
      resetTimerRef.current = null
    }
  }
  useEffect(() => clearResetTimer, [])

  const onReset = () => {
    if (resetArmed) {
      clearResetTimer()
      setResetArmed(false)
      resetProject()
      return
    }
    setResetArmed(true)
    clearResetTimer()
    resetTimerRef.current = setTimeout(() => {
      setResetArmed(false)
      resetTimerRef.current = null
    }, 3000)
  }

  const stepOptions = availableStepCounts(
    project.timeSignature[0],
    project.timeSignature[1]
  )

  // Local BPM input state — only commit on blur / Enter / ± buttons so
  // typing "5" intending "50" doesn't get clamped to 40 mid-keystroke.
  const [bpmDraft, setBpmDraft] = useState(String(project.bpm))
  useEffect(() => {
    setBpmDraft(String(project.bpm))
  }, [project.bpm])

  const commitBpm = () => {
    const parsed = Number(bpmDraft)
    if (!Number.isFinite(parsed)) {
      setBpmDraft(String(project.bpm))
      return
    }
    const clamped = Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(parsed)))
    setBpm(clamped)
    setBpmDraft(String(clamped))
  }

  const bumpBpm = (delta: number) => {
    const next = Math.max(BPM_MIN, Math.min(BPM_MAX, project.bpm + delta))
    setBpm(next)
  }

  return (
    <div className="mp-top-bar">
      <button
        className="mp-btn mp-btn--exit"
        onClick={requestExit}
        aria-label="Exit Melopán"
        title="Exit Melopán"
      >
        ‹
      </button>
      <button
        className={`mp-btn mp-btn--reset ${resetArmed ? "is-armed" : ""}`}
        onClick={onReset}
        aria-label={resetArmed ? "Tap again to confirm reset" : "Reset to default"}
        title={resetArmed ? "Tap again to confirm" : "Reset to default"}
      >
        {resetArmed ? "?" : "↺"}
      </button>
      <div className="mp-brand">MELOPÁN</div>

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

      <div className="mp-control mp-bpm" title="Beats per minute">
        <span>BPM</span>
        <button
          className="mp-btn mp-btn--step"
          onClick={() => bumpBpm(-1)}
          aria-label="Decrease BPM"
          title="−1"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={bpmDraft}
          onChange={(e) => setBpmDraft(e.target.value.replace(/[^0-9]/g, ""))}
          onBlur={commitBpm}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
        <button
          className="mp-btn mp-btn--step"
          onClick={() => bumpBpm(1)}
          aria-label="Increase BPM"
          title="+1"
        >
          +
        </button>
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
          <option value="2/4">2/4</option>
          <option value="3/4">3/4</option>
          <option value="4/4">4/4</option>
          <option value="5/4">5/4</option>
          <option value="7/4">7/4</option>
          <option value="10/4">10/4</option>
          <option value="11/4">11/4</option>
          <option value="13/4">13/4</option>
          <option value="3/8">3/8</option>
          <option value="5/8">5/8</option>
          <option value="6/8">6/8</option>
          <option value="7/8">7/8</option>
          <option value="9/8">9/8</option>
          <option value="10/8">10/8</option>
          <option value="11/8">11/8</option>
          <option value="12/8">12/8</option>
          <option value="13/8">13/8</option>
        </select>
      </div>

      <div className="mp-control" title="Steps per bar (subdivision)">
        <span>STEPS</span>
        <select
          value={project.lengthSteps}
          onChange={(e) => setLengthSteps(Number(e.target.value))}
        >
          {stepOptions.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
          {!stepOptions.includes(project.lengthSteps) && (
            <option value={project.lengthSteps}>{project.lengthSteps}</option>
          )}
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
