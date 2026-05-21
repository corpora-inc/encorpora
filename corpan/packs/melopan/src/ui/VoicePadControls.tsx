import { useState } from "react"
import { useProjectStore } from "../storage/projectStore"
import { VOICES, findSample, type VoiceId } from "../model/project"
import { SampleBrowser } from "./SampleBrowser"

type Props = {
  sampleLoaded: boolean
  onPick: (voice: VoiceId, word: string | null) => void
  onPreview: () => void
}

export const VoicePadControls = ({ sampleLoaded, onPick, onPreview }: Props) => {
  const voice = useProjectStore((s) => s.project.voicePad.voice)
  const word = useProjectStore((s) => s.project.voicePad.word)
  const pitchSemis = useProjectStore((s) => s.project.voicePad.pitchSemis)
  const setPitch = useProjectStore((s) => s.setVoicePadPitch)
  const [browserOpen, setBrowserOpen] = useState(false)

  const voiceLabel = VOICES.find((v) => v.id === voice)?.name ?? voice
  const sample = findSample(voice, word)
  const summary = word
    ? `${word} · ${voiceLabel}${sample ? ` · ${sample.language}` : ""}`
    : `${voiceLabel} · synth-vox`

  return (
    <div className="mp-voice-card">
      <h4>VOICE PAD</h4>

      <button
        className="mp-btn"
        onClick={() => setBrowserOpen(true)}
        title="Open sample browser"
      >
        ⤢ {summary}
      </button>

      <div className="mp-control" title="Pitch shift in semitones">
        <span>pitch</span>
        <input
          type="range"
          min={-24}
          max={24}
          step={1}
          value={pitchSemis}
          onChange={(e) => setPitch(Number(e.target.value))}
        />
        <span style={{ minWidth: 30, textAlign: "right" }}>
          {pitchSemis > 0 ? `+${pitchSemis}` : pitchSemis}
        </span>
      </div>

      <button className="mp-btn" onClick={onPreview} title="Preview">
        ▶ preview
      </button>

      <span style={{
        fontFamily: "var(--mp-font-mono)",
        fontSize: 14,
        color: sampleLoaded ? "var(--mp-success)" : "var(--mp-text-dim)",
      }}>
        {sampleLoaded ? "[sample loaded]" : "[synth-vox]"}
      </span>

      <SampleBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onPick={(v, w) => { onPick(v, w); setBrowserOpen(false) }}
        onPreview={onPreview}
      />
    </div>
  )
}
