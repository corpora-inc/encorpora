import { useState } from "react"
import { useProjectStore } from "../storage/projectStore"
import { VOICES, findSample, type VoiceId, type VoiceTrackId } from "../model/project"
import { SampleBrowser } from "./SampleBrowser"

type Props = {
  trackId: VoiceTrackId
  sampleLoaded: boolean
  onPick: (trackId: VoiceTrackId, voice: VoiceId, word: string | null) => void
  onPreview: (trackId: VoiceTrackId) => void
}

export const VoicePadControls = ({ trackId, sampleLoaded, onPick, onPreview }: Props) => {
  const track = useProjectStore((s) =>
    s.project.tracks.find((t) => t.kind === "voice" && t.id === trackId)
  )
  const setPitch = useProjectStore((s) => s.setVoicePadPitch)
  const [browserOpen, setBrowserOpen] = useState(false)

  if (!track || track.kind !== "voice") return null

  const voiceLabel = VOICES.find((v) => v.id === track.voice)?.name ?? track.voice
  const sample = findSample(track.voice, track.word)
  const summary = track.word
    ? `${track.word} · ${voiceLabel}${sample ? ` · ${sample.language}` : ""}`
    : `${voiceLabel} · synth-vox`

  return (
    <div className="mp-voice-card">
      <div className="mp-voice-card-head">
        <h4>{track.name.toUpperCase()}</h4>
        <button
          className="mp-voice-sample-chip"
          onClick={() => setBrowserOpen(true)}
          title="Open sample browser"
        >
          ♪ {summary}
        </button>
        <span
          className="mp-voice-status"
          style={{
            color: sampleLoaded ? "var(--mp-success)" : "var(--mp-text-dim)",
          }}
        >
          {sampleLoaded ? "[sample]" : "[synth-vox]"}
        </span>
      </div>

      <div className="mp-voice-pitch">
        <span className="mp-voice-pitch-label">pitch</span>
        <input
          type="range"
          min={-24}
          max={24}
          step={1}
          value={track.pitchSemis}
          onChange={(e) => setPitch(trackId, Number(e.target.value))}
          aria-label="Pitch shift in semitones"
        />
        <span className="mp-voice-pitch-value">
          {track.pitchSemis > 0 ? `+${track.pitchSemis}` : track.pitchSemis}
        </span>
      </div>

      <SampleBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        currentVoice={track.voice}
        currentWord={track.word}
        onPick={(v, w) => {
          onPick(trackId, v, w)
          setBrowserOpen(false)
        }}
        onPreview={() => onPreview(trackId)}
      />
    </div>
  )
}
