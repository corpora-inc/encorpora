import { useEffect, useRef, useState } from "react"
import type { HostApi } from "./sdk/types"
import type { Cycle } from "./core"
import { PRESETS, presetById, additiveSignature, collapsedSignature } from "./core"
import { InternalClock, type Clock, type ClickDensity, type VoiceKitId } from "./audio"
import {
  LinearView,
  RingView,
  SpiralView,
  type LabelMode,
  type NotationMode,
  type ViewMode,
} from "./views"
import { TransportBar, MIN_BPM, MAX_BPM } from "./ui/TransportBar"
import { GroupEditor } from "./ui/GroupEditor"
import { setSkin, DEFAULT_SKIN, type SkinId } from "./theme"

const DEFAULT_CYCLE: Cycle = presetById("lesnoto") ?? PRESETS[0]
const DEFAULT_BPM = 100

type Props = {
  hostApi: HostApi
}

export function App(_props: Props) {
  const [cycle, setCycle] = useState<Cycle>(DEFAULT_CYCLE)
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [density, setDensity] = useState<ClickDensity>("pulse")
  const [voiceKit, setVoiceKit] = useState<VoiceKitId>("tonal")
  const [volume, setVolume] = useState(0.9)
  const [playing, setPlaying] = useState(false)
  const [labelMode, setLabelMode] = useState<LabelMode>("number")
  const [notationMode, setNotationMode] = useState<NotationMode>("bars")
  const [view, setView] = useState<ViewMode>("linear")
  const [skin, setSkinState] = useState<SkinId>(DEFAULT_SKIN)

  // Mirrors bpm for the keyboard handler, so rapid arrow repeats read the
  // current tempo instead of a stale closure value.
  const bpmRef = useRef(bpm)
  bpmRef.current = bpm

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

  const changeVoiceKit = (kit: VoiceKitId) => {
    setVoiceKit(kit)
    clock.setVoiceKit(kit)
    // Let the musician hear the new voice right away.
    void clock.previewVoice()
  }

  // Skins are purely cosmetic: a palette swap (canvas plus CSS chrome) and a
  // faint starfield on the sparkly ones. Nothing about timing or layout changes.
  const changeSkin = (s: SkinId) => {
    setSkin(s)
    setSkinState(s)
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
        changeBpm(bpmRef.current + step)
      } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault()
        changeBpm(bpmRef.current - step)
      } else if (e.key === "1") {
        setView("linear")
      } else if (e.key === "2") {
        setView("ring")
      } else if (e.key === "3") {
        setView("spiral")
      } else if (e.key === "4") {
        setView("spin")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // togglePlay reads `playing`, so resubscribe when it changes; bpm is read
    // through bpmRef to avoid a stale closure on rapid key repeats.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  const isEmpty = cycle.groups.length === 0
  const activePreset = PRESETS.find((p) => p.id === cycle.id)
  // Show the dance name for a named preset, nothing extra for a preset whose
  // name is just its figure (the figure already shows above), and "Custom" once
  // the cycle has been edited away from any preset.
  const nameLabel = !activePreset
    ? "Custom"
    : activePreset.name === additiveSignature(cycle)
      ? null
      : activePreset.name

  return (
    <div className="kp-root" data-theme="dark" data-skin={skin}>
      <header className="kp-header">
        <div className="kp-brand">Kronopán</div>
        <div className="kp-sig">
          <div className="kp-sig-main">
            <span className="kp-sig-add">{isEmpty ? "empty" : additiveSignature(cycle)}</span>
            <span className="kp-sig-over">over {cycle.unit}</span>
          </div>
          <div className="kp-sig-side">
            {!isEmpty && <span className="kp-sig-frac">{collapsedSignature(cycle)}</span>}
            {!isEmpty && nameLabel && <span className="kp-sig-name">{nameLabel}</span>}
          </div>
        </div>
      </header>

      <main className="kp-stage">
        {view === "linear" && (
          <LinearView
            cycle={cycle}
            clock={clock}
            labelMode={labelMode}
            notationMode={notationMode}
          />
        )}
        {view === "ring" && (
          <RingView
            cycle={cycle}
            clock={clock}
            labelMode={labelMode}
            notationMode={notationMode}
          />
        )}
        {view === "spiral" && <SpiralView cycle={cycle} clock={clock} />}
        {view === "spin" && <SpiralView cycle={cycle} clock={clock} spin />}
      </main>

      <section className="kp-controls">
        <TransportBar
          playing={playing}
          onTogglePlay={togglePlay}
          bpm={bpm}
          onBpm={changeBpm}
          density={density}
          onDensity={changeDensity}
          voiceKit={voiceKit}
          onVoiceKit={changeVoiceKit}
          volume={volume}
          onVolume={changeVolume}
          labelMode={labelMode}
          onLabelMode={setLabelMode}
          notationMode={notationMode}
          onNotationMode={setNotationMode}
          view={view}
          onView={setView}
          skin={skin}
          onSkin={changeSkin}
        />
        <GroupEditor cycle={cycle} onChange={changeCycle} />
      </section>
    </div>
  )
}
