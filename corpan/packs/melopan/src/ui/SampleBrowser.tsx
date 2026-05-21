import { useMemo, useState } from "react"
import { useProjectStore } from "../storage/projectStore"
import {
  VOICES,
  KIT_SAMPLES,
  KIT_CATEGORIES,
  type VoiceId,
} from "../model/project"

type Props = {
  open: boolean
  onClose: () => void
  onPick: (voice: VoiceId, word: string | null) => void
  onPreview: () => void
}

export const SampleBrowser = ({ open, onClose, onPick, onPreview }: Props) => {
  const voice = useProjectStore((s) => s.project.voicePad.voice)
  const word = useProjectStore((s) => s.project.voicePad.word)
  const [query, setQuery] = useState("")
  const [voiceFilter, setVoiceFilter] = useState<"all" | VoiceId>("all")

  const lowerQ = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    return KIT_SAMPLES.filter((s) => {
      if (voiceFilter !== "all" && s.voice !== voiceFilter) return false
      if (!lowerQ) return true
      return (
        s.word.toLowerCase().includes(lowerQ) ||
        s.voice.toLowerCase().includes(lowerQ) ||
        s.language.toLowerCase().includes(lowerQ) ||
        (s.gloss ?? "").toLowerCase().includes(lowerQ)
      )
    })
  }, [lowerQ, voiceFilter])

  const byCategory = useMemo(() => {
    const groups = new Map<string, typeof KIT_SAMPLES>()
    for (const s of filtered) {
      const existing = groups.get(s.category) ?? []
      groups.set(s.category, [...existing, s] as typeof KIT_SAMPLES)
    }
    return KIT_CATEGORIES
      .map((cat) => ({ ...cat, items: groups.get(cat.id) ?? [] }))
      .filter((cat) => cat.items.length > 0)
  }, [filtered])

  if (!open) return null

  return (
    <div className="mp-sample-browser-backdrop" onClick={onClose}>
      <div className="mp-sample-browser" onClick={(e) => e.stopPropagation()}>
        <div className="mp-sample-browser-head">
          <h3>Sample browser</h3>
          <button className="mp-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="mp-sample-browser-toolbar">
          <div className="mp-control" style={{ minWidth: 160 }}>
            <span>voice</span>
            <select
              value={voiceFilter}
              onChange={(e) => setVoiceFilter(e.target.value as "all" | VoiceId)}
            >
              <option value="all">All voices</option>
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}{v.subtitle ? ` — ${v.subtitle}` : ""}
                </option>
              ))}
            </select>
          </div>
          <input
            type="search"
            placeholder="search word / language / voice…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mp-search"
            autoFocus
          />
          <button
            className={`mp-btn ${word === null ? "is-playing" : ""}`}
            onClick={() => onPick(voice as VoiceId, null)}
            title="Use synth-vox fallback"
          >
            ~ synth
          </button>
          <button className="mp-btn" onClick={onPreview} title="Preview current pad">
            ▶ preview
          </button>
        </div>

        <div className="mp-sample-browser-body">
          {byCategory.length === 0 && (
            <div style={{ padding: 16, opacity: 0.6 }}>
              no matches{query ? ` for "${query}"` : ""}
            </div>
          )}
          {byCategory.map((cat) => (
            <section key={cat.id} className="mp-sample-cat">
              <h4>{cat.label}</h4>
              <div className="mp-sample-cards">
                {cat.items.map((s) => {
                  const isActive = word === s.word && voice === s.voice
                  return (
                    <button
                      key={`${s.voice}/${s.word}`}
                      className={`mp-sample-card ${isActive ? "is-active" : ""}`}
                      onClick={() => onPick(s.voice, s.word)}
                      title={`${s.word} — ${s.gloss ?? ""} (${s.language}, ${s.voice})`}
                    >
                      <span className="mp-sample-card-word">{s.word}</span>
                      <span className="mp-sample-card-meta">
                        <span className="mp-sample-card-lang">{s.language}</span>
                        <span className="mp-sample-card-voice">{s.voice}</span>
                      </span>
                      {s.gloss && (
                        <span className="mp-sample-card-gloss">{s.gloss}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
