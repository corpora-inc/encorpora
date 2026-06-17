import { useEffect, useMemo, useRef, useState } from "react"
import type { HostApi } from "./sdk/types"
import { useProjectStore, hydrateProject } from "./storage/projectStore"
import { createAudioEngine, type AudioEngine } from "./engine/audioEngine"
import { TopBar } from "./ui/TopBar"
import { StepGrid } from "./ui/StepGrid"
import { PianoRoll } from "./ui/PianoRoll"
import { VoicePadControls } from "./ui/VoicePadControls"
import { ResizeHandle } from "./ui/ResizeHandle"
import { DelayPanel } from "./ui/DelayPanel"
import { ReverbPanel } from "./ui/ReverbPanel"
import {
  findSample,
  isVoiceTrack,
  type TrackId,
  type VoiceTrackId,
  type VoiceId,
} from "./model/project"
import { loadPackAssetUrl } from "./sdk/packAssets"
import manifest from "../manifest.json"

const GAME_ID = "melopan"

const resolvePackBaseUrl = (): string => {
  const script =
    document.querySelector<HTMLScriptElement>(`script[data-corp-game-id="${GAME_ID}"]`) ||
    (document.currentScript as HTMLScriptElement | null)
  const dataset = script?.dataset
  if (dataset?.corpGameBaseUrl) return dataset.corpGameBaseUrl
  if (dataset?.corpGameSrc) return new URL(".", dataset.corpGameSrc).toString()
  if (script?.src) return new URL(".", script.src).toString()
  return window.location.href
}

const ASSET_PREFIX = import.meta.env.PROD ? "dist/" : ""
const PACK_BASE_URL = resolvePackBaseUrl()

const resolvePackAsset = (path: string): string =>
  new URL(`${ASSET_PREFIX}${path}`, PACK_BASE_URL).toString()

type Props = { hostApi: HostApi }

type SampleState = { voice: string; word: string | null; dispose: () => void }

export const App = ({ hostApi: _hostApi }: Props) => {
  const project = useProjectStore((s) => s.project)
  const ready = useProjectStore((s) => s.ready)
  const setVoicePadWord = useProjectStore((s) => s.setVoicePadWord)
  const setVoicePadVoice = useProjectStore((s) => s.setVoicePadVoice)

  const engineRef = useRef<AudioEngine | null>(null)
  /** Per-voice-track sample load state — tracks blob URL dispose + last loaded id */
  const sampleStateRef = useRef<Record<VoiceTrackId, SampleState | null>>({
    voice1: null,
    voice2: null,
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [playheadStep, setPlayheadStep] = useState<number>(-1)
  const [delayOpen, setDelayOpen] = useState(false)
  const [reverbOpen, setReverbOpen] = useState(false)
  const [sampleLoaded, setSampleLoaded] = useState<Record<VoiceTrackId, boolean>>({
    voice1: false,
    voice2: false,
  })

  const voiceTracks = useMemo(
    () => project.tracks.filter(isVoiceTrack),
    [project.tracks]
  )

  useEffect(() => {
    const engine = createAudioEngine()
    engineRef.current = engine
    const unsub = engine.onStep((s) => setPlayheadStep(s))
    return () => {
      unsub()
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    void hydrateProject()
  }, [])

  useEffect(() => {
    if (!engineRef.current) return
    engineRef.current.setProject(project)
  }, [project])

  // Load samples for each voice track. Per-track Blob URLs are tracked so we
  // only reload when voice/word actually changes (pitch changes via setProject).
  useEffect(() => {
    if (!engineRef.current) return
    const engine = engineRef.current
    let cancelled = false

    voiceTracks.forEach((vt) => {
      const prev = sampleStateRef.current[vt.id]
      if (prev && prev.voice === vt.voice && prev.word === vt.word) return

      prev?.dispose()
      sampleStateRef.current[vt.id] = null

      const sample = findSample(vt.voice, vt.word)
      const url = sample ? resolvePackAsset(`voice-kit/${sample.file}`) : null

      if (!url) {
        void engine.voicePads[vt.id].loadSample(null)
        setSampleLoaded((p) => ({ ...p, [vt.id]: false }))
        return
      }

      void (async () => {
        try {
          const resolved = await loadPackAssetUrl(url)
          if (cancelled) { resolved.dispose(); return }
          sampleStateRef.current[vt.id] = {
            voice: vt.voice,
            word: vt.word,
            dispose: resolved.dispose,
          }
          const result = await engine.voicePads[vt.id].loadSample(resolved.effective)
          if (cancelled) return
          setSampleLoaded((p) => ({ ...p, [vt.id]: result.ok }))
        } catch (err) {
          if (cancelled) return
          setSampleLoaded((p) => ({ ...p, [vt.id]: false }))
          console.warn(`[melopan] sample load failed for ${vt.id}:`, err)
        }
      })()
    })

    return () => { cancelled = true }
  }, [voiceTracks])

  useEffect(() => {
    return () => {
      sampleStateRef.current.voice1?.dispose()
      sampleStateRef.current.voice2?.dispose()
      sampleStateRef.current = { voice1: null, voice2: null }
    }
  }, [])

  const togglePlay = async () => {
    const engine = engineRef.current
    if (!engine) return
    if (engine.isPlaying()) {
      engine.stop()
      setIsPlaying(false)
    } else {
      await engine.start()
      setIsPlaying(true)
    }
  }

  const handlePreview = (trackId: TrackId) => {
    void engineRef.current?.previewTrack(trackId)
  }

  const handlePickSample = (trackId: VoiceTrackId, v: VoiceId, w: string | null) => {
    setVoicePadVoice(trackId, v)
    setVoicePadWord(trackId, w)
    setTimeout(() => {
      void engineRef.current?.previewTrack(trackId)
    }, 80)
  }

  const handlePreviewVoice = (trackId: VoiceTrackId) => {
    void engineRef.current?.previewTrack(trackId)
  }

  const handlePreviewNote = (midi: number) => {
    void engineRef.current?.previewSynthNote(midi)
  }

  const skin = project.skin
  const className = useMemo(() => "melopan-root", [])

  if (!ready) {
    return <div className={className} data-skin={skin}><div style={{ padding: 20 }}>Loading…</div></div>
  }

  return (
    <div className={className} data-skin={skin}>
      <TopBar
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onOpenDelay={() => setDelayOpen(true)}
        onOpenReverb={() => setReverbOpen(true)}
      />
      <DelayPanel open={delayOpen} onClose={() => setDelayOpen(false)} />
      <ReverbPanel open={reverbOpen} onClose={() => setReverbOpen(false)} />
      <div className="mp-stage">
        <div
          className="mp-section"
          style={project.layout?.stepGridPx ? { height: project.layout.stepGridPx } : undefined}
        >
          <StepGrid playheadStep={playheadStep} onPreview={handlePreview} />
        </div>
        <ResizeHandle targetKey="stepGridPx" defaultPx={260} minPx={120} maxPx={800} />
        <div
          className="mp-section"
          style={project.layout?.pianoRollPx ? { height: project.layout.pianoRollPx } : undefined}
        >
          <PianoRoll playheadStep={playheadStep} onPreviewNote={handlePreviewNote} />
        </div>
        <ResizeHandle targetKey="pianoRollPx" defaultPx={280} minPx={120} maxPx={900} />
        <div
          className="mp-section"
          style={project.layout?.voicePadPx ? { height: project.layout.voicePadPx } : undefined}
        >
          {voiceTracks.map((vt) => (
            <VoicePadControls
              key={vt.id}
              trackId={vt.id}
              sampleLoaded={sampleLoaded[vt.id]}
              onPick={handlePickSample}
              onPreview={handlePreviewVoice}
            />
          ))}
        </div>
      </div>
      <div className="mp-footer">
        <span>{project.name}</span>
        <span>·</span>
        <span>{project.lengthSteps} steps</span>
        <span className="mp-build">melopán v{manifest.version}</span>
      </div>
    </div>
  )
}
