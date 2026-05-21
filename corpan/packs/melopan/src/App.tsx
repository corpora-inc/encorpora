import { useEffect, useMemo, useRef, useState } from "react"
import type { HostApi } from "./sdk/types"
import { useProjectStore, hydrateProject } from "./storage/projectStore"
import { createAudioEngine, type AudioEngine } from "./engine/audioEngine"
import { TopBar } from "./ui/TopBar"
import { StepGrid } from "./ui/StepGrid"
import { PianoRoll } from "./ui/PianoRoll"
import { VoicePadControls } from "./ui/VoicePadControls"
import { findSample, type DrumTrackId, type VoiceId } from "./model/project"
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

// In dev, vite serves public/ at the server root (no dist/ prefix).
// In prod (loaded via corpan-pack://{packId}/), the host's baseUrl is the
// pack root and assets live under dist/.
const ASSET_PREFIX = import.meta.env.PROD ? "dist/" : ""
const PACK_BASE_URL = resolvePackBaseUrl()

const resolvePackAsset = (path: string): string =>
  new URL(`${ASSET_PREFIX}${path}`, PACK_BASE_URL).toString()

type Props = { hostApi: HostApi }

export const App = ({ hostApi: _hostApi }: Props) => {
  const project = useProjectStore((s) => s.project)
  const ready = useProjectStore((s) => s.ready)
  const setVoicePadWord = useProjectStore((s) => s.setVoicePadWord)
  const setVoicePadVoice = useProjectStore((s) => s.setVoicePadVoice)

  const engineRef = useRef<AudioEngine | null>(null)
  const blobDisposeRef = useRef<(() => void) | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playheadStep, setPlayheadStep] = useState<number>(-1)
  const [sampleLoaded, setSampleLoaded] = useState(false)

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

  useEffect(() => {
    if (!engineRef.current) return
    const { voice, word } = project.voicePad
    const sample = findSample(voice, word)
    const url = sample ? resolvePackAsset(`voice-kit/${sample.file}`) : null

    blobDisposeRef.current?.()
    blobDisposeRef.current = null

    if (!url) {
      setSampleLoaded(false)
      void engineRef.current.voicePad.loadSample(null)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const resolved = await loadPackAssetUrl(url)
        if (cancelled) {
          resolved.dispose()
          return
        }
        blobDisposeRef.current = resolved.dispose
        await engineRef.current!.voicePad.loadSample(resolved.effective)
        if (cancelled) return
        setSampleLoaded(engineRef.current?.voicePad.isSampleLoaded() ?? false)
      } catch (err) {
        if (cancelled) return
        setSampleLoaded(false)
        console.warn("[melopan] voice sample load failed:", err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [project.voicePad.voice, project.voicePad.word])

  useEffect(() => {
    return () => {
      blobDisposeRef.current?.()
      blobDisposeRef.current = null
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

  const handlePreview = (trackId: DrumTrackId) => {
    engineRef.current?.previewTrack(trackId)
  }

  const handlePickSample = (v: VoiceId, w: string | null) => {
    setVoicePadVoice(v)
    setVoicePadWord(w)
    setTimeout(() => engineRef.current?.previewTrack("voice"), 80)
  }

  const handlePreviewVoice = () => engineRef.current?.previewTrack("voice")

  const handlePreviewNote = (midi: number) => {
    engineRef.current?.previewSynthNote(midi)
  }

  const skin = project.skin
  const className = useMemo(() => "melopan-root", [])

  if (!ready) {
    return <div className={className} data-skin={skin}><div style={{ padding: 20 }}>Loading…</div></div>
  }

  return (
    <div className={className} data-skin={skin}>
      <TopBar isPlaying={isPlaying} onTogglePlay={togglePlay} />
      <div className="mp-stage">
        <StepGrid playheadStep={playheadStep} onPreview={handlePreview} />
        <PianoRoll playheadStep={playheadStep} onPreviewNote={handlePreviewNote} />
        <VoicePadControls
          sampleLoaded={sampleLoaded}
          onPick={handlePickSample}
          onPreview={handlePreviewVoice}
        />
      </div>
      <div className="mp-footer">
        <span>{project.name}</span>
        <span>·</span>
        <span>{project.lengthSteps} steps</span>
        <span className="mp-build">melopan v{manifest.version}</span>
      </div>
    </div>
  )
}
