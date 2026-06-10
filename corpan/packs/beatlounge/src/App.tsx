import { useEffect, useState } from "react"
import type { HostApi } from "./sdk/types"
import { createCommandBus } from "./model/commandBus"
import { createDefaultDoc, type BeatloungeDoc } from "./model/document"

/**
 * Wave 0 boot shell — proves the command-bus spine wires up and renders the
 * default document. Team SHELL replaces this with the Stage + Rail + immersive
 * system in Wave 1; the contracts it consumes (commandBus, document) are frozen.
 */
export const App = ({ hostApi }: { hostApi: HostApi }) => {
  const [bus] = useState(() => createCommandBus(createDefaultDoc(Date.now())))
  const [doc, setDoc] = useState<BeatloungeDoc>(() => bus.snapshot())

  useEffect(() => bus.subscribe((d) => setDoc(d)), [bus])

  const skin = "midnight"
  void hostApi

  return (
    <div className="bl-root" data-skin={skin}>
      <div className="bl-boot">
        <div className="bl-wordmark">beatlounge</div>
        <div style={{ color: "var(--bl-text-dim)", fontSize: "var(--bl-fs-label)" }}>
          {doc.name} · {doc.bpm} bpm · {doc.tracks.length} tracks
        </div>
        <div className="bl-boot-tracks">
          {doc.tracks.map((t) => (
            <div className="bl-boot-track" key={t.id}>
              <span className="bl-boot-dot" style={{ background: t.color }} />
              <span className="bl-boot-name">{t.name}</span>
              <span className="bl-boot-meta">
                {t.kind === "instrument" ? t.instrument.kind : "tts"} ·{" "}
                {t.kind === "instrument" ? t.notes.length : t.fragments.length} events
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
