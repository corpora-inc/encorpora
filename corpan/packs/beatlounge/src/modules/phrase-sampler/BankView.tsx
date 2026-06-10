/**
 * beatlounge — the BANK (Library) tab: the user's accumulated, rendered TTS
 * snippets. Each saved snippet can be auditioned (Web Audio only) and removed.
 * Reads `doc.fragmentLibrary` reactively. Removing a ref also clears any placed
 * events (the reducer handles that). This is interface #1's endpoint — the
 * sequencer (interface #2) reads this same bank to place snippets on the grid.
 */

import { useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { bankSnippets } from "../../phrase/bank"
import { auditionPhrase } from "../../phrase/audition"
import { languageLabel } from "./langLabel"
import { Glyph } from "../../bl-ui"
import type { AudioSource } from "../../phrase/audioSource"

const LOG = "[beatlounge/phrase-discovery]"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audioSource: AudioSource
  nativeCode?: string
}

export const BankView = ({ host, store, audioSource, nativeCode }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const snippets = bankSnippets(doc)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (snippets.length === 0) {
    return (
      <div className="bl-disc-body">
        <div className="bl-disc-bank-empty">
          <span className="bl-disc-bank-emptyglyph">
            <Glyph name="wave" size={28} />
          </span>
          <p className="bl-disc-bank-emptytitle">Your bank is empty</p>
          <p className="bl-disc-empty-sm">
            Find a phrase in Discover, drill a language, and save combos here. The
            sequencer places them on the beat.
          </p>
        </div>
      </div>
    )
  }

  const audition = (text: string, lang: string, voiceId?: string) => {
    setBusyId(`${lang}:${text}:${voiceId ?? ""}`)
    void auditionPhrase(host.audioContext(), audioSource, text, lang, { voiceId })
      .catch((err) => {
        console.warn(`${LOG} bank audition failed:`, err)
        host.toast("Couldn't play that")
      })
      .finally(() => setBusyId(null))
  }

  const remove = (refId: string, text: string) => {
    store.dispatch({ t: "removeFragmentRef", refId })
    host.toast(`Removed "${text}"`, { undo: () => store.undo() })
  }

  return (
    <div className="bl-disc-body">
      <div className="bl-disc-bank-head">
        <span className="bl-disc-section-h">
          {snippets.length} {snippets.length === 1 ? "snippet" : "snippets"} in your bank
        </span>
      </div>
      <div className="bl-disc-bank-list">
        {[...snippets].reverse().map((ref) => {
          const text = ref.text ?? ""
          const lang = ref.language ?? ""
          const key = `${lang}:${text}:${ref.voiceId ?? ""}`
          const busy = busyId === key
          const dur = ref.durationSec ? `${ref.durationSec.toFixed(1)}s` : null
          const synth = ref.source !== "ttsRender" && ref.source !== "userSample"
          return (
            <div className="bl-disc-bank-row" key={ref.id}>
              <button
                type="button"
                className="bl-disc-iconbtn"
                onClick={() => audition(text, lang, ref.voiceId)}
                aria-label={`Play "${text}"`}
                title="Hear it"
                disabled={busy}
              >
                {busy ? <span className="bl-disc-spin" /> : <Glyph name="play" size={18} />}
              </button>
              <div className="bl-disc-bank-text">
                <div className="bl-disc-bank-phrase" lang={lang}>
                  {text || "—"}
                </div>
                <div className="bl-disc-bank-meta">
                  <span className="bl-disc-lang-tag">{languageLabel(lang, nativeCode)}</span>
                  {dur && <span className="bl-disc-bank-dur">{dur}</span>}
                  {synth && <span className="bl-disc-tag">synth</span>}
                </div>
              </div>
              <button
                type="button"
                className="bl-disc-iconbtn is-danger"
                onClick={() => remove(ref.id, text)}
                aria-label={`Remove "${text}" from bank`}
                title="Remove"
              >
                <Trash />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const Trash = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 7h14M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M7 7l.7 11A1.5 1.5 0 0 0 9.2 19.5h5.6A1.5 1.5 0 0 0 16.3 18L17 7" />
  </svg>
)
