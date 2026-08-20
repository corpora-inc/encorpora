import { useEffect, useRef, useState } from "react"
import type { HostApi } from "./sdk/types"
import type { Cycle } from "./core"
import { PRESETS, presetById, additiveSignature, collapsedSignature } from "./core"
import { InternalClock, type Clock, type ClickDensity } from "./audio"
import { LinearView, type LabelMode } from "./views/LinearView"
import { TransportBar, MIN_BPM, MAX_BPM } from "./ui/TransportBar"
import { GroupEditor } from "./ui/GroupEditor"

const DEFAULT_CYCLE: Cycle = presetById("lesnoto") ?? PRESETS[0]
const DEFAULT_BPM = 100

type Props = {
  hostApi: HostApi
}

export function App(_props: Props) {
  const [cycle, setCycle] = useState<Cycle>(DEFAULT_CYCLE)
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [density, setDensity] = useState<ClickDensity>("pulse")
  const [volume, setVolume] = useState(0.9)
  const [playing, setPlaying] = useState(false)
  const [labelMode, setLabelMode] = useState<LabelMode>("number")

  // One clock for the life of the shell. Created lazily so its AudioContext is
  // built on mount (suspended until the first gesture resumes it).
  const clockRef = useRef<Clock | null>(null)
  if (clockRef.current === null) {
    clockRef.current = new InternalClock(DEFAULT_CYCLE, DEFAULT_BPM)
  }
  const clock = clockRef.current

  useEffect(() => {
    return () => clock.dispose()
  }, [clock])

  const togglePlay = async () => {
    if (playing) {
      clock.stop()
      setPlaying(false)
    } else {
      await clock.start()
      setPlaying(true)
    }
  }

  const changeBpm = (next: number) => {
    const clamped = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(next)))
    setBpm(clamped)
    clock.setTempo(clamped)
  }

  const changeCycle = (next: Cycle) => {
    setCycle(next)
    clock.setCycle(next)
  }

  const changeDensity = (d: ClickDensity) => {
    setDensity(d)
    clock.setClickDensity(d)
  }

  const changeVolume = (v: number) => {
    setVolume(v)
    clock.setVolume(v)
  }

  // Keyboard: space starts and stops, arrows nudge the tempo (shift for a jump
  // of five). Ignore keys while a control has focus so typing in a field is not
  // hijacked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault()
        void togglePlay()
        return
      }
      const step = e.shiftKey ? 5 : 1
      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault()
        changeBpm(bpm + step)
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault()
        changeBpm(bpm - step)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm, playing])

  const isEmpty = cycle.groups.length === 0
  const activePreset = PRESETS.find((p) => p.id === cycle.id)
  const danceName =
    activePreset && activePreset.name !== additiveSignature(cycle) ? activePreset.name : null

  return (
    <div className="kp-root" data-theme="dark">
      <header className="kp-header">
        <div className="kp-brand">Kronopán</div>
        <div className="kp-sig">
          <div className="kp-sig-main">
            <span className="kp-sig-add">{isEmpty ? "empty" : additiveSignature(cycle)}</span>
            <span className="kp-sig-over">over {cycle.unit}</span>
          </div>
          <div className="kp-sig-side">
            {!isEmpty && <span className="kp-sig-frac">{collapsedSignature(cycle)}</span>}
            {!isEmpty && <span className="kp-sig-name">{danceName ?? "Custom"}</span>}
          </div>
        </div>
      </header>

      <main className="kp-stage">
        <LinearView cycle={cycle} clock={clock} labelMode={labelMode} />
      </main>

      <section className="kp-controls">
        <TransportBar
          playing={playing}
          onTogglePlay={togglePlay}
          bpm={bpm}
          onBpm={changeBpm}
          density={density}
          onDensity={changeDensity}
          volume={volume}
          onVolume={changeVolume}
          labelMode={labelMode}
          onLabelMode={setLabelMode}
        />
        <GroupEditor cycle={cycle} onChange={changeCycle} />
      </section>
    </div>
  )
}
