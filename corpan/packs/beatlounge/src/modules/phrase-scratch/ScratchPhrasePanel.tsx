/**
 * beatlounge — phrase-SCRATCH "Phrases" drawer tab: DISCOVER from the whole
 * CATALOG (not just owned phrases) and load a NEW phrase onto a deck.
 *
 * The per-deck picker dropdown already chooses among the OWNED (already-rendered)
 * snippets — that covers what's on the table. This tab is phrase DISCOVERY: it
 * REUSES the full `PhraseSamplerImmersive` flow verbatim (search the whole corpus
 * → drill a language → audition → save a combo, which renders TTS + caches in IDB
 * + registers a FragmentRef). When a phrase is saved its ref enters the bank, and
 * we auto-load it onto the requested deck so "discover → on the platter" is one
 * gesture. No owned-list duplication; the same discovery code every screen uses.
 *
 * It mounts inside the SHARED drawer body, so it shares the drawer's open/close +
 * scrim conventions (one surface type, no bespoke popover).
 */

import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioSource } from "../../phrase/audioSource"
import type { EntryOut } from "../../sdk/types"
import { PhraseSamplerImmersive } from "../phrase-sampler/PhraseSamplerImmersive"
import { ct } from "../../i18n/strings"
import "../phrase-sampler/phrase-sampler.css"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audioSource: AudioSource
  /** The deck a freshly-discovered phrase should land on (the active deck). */
  loadDeck: "a" | "b"
  /** Aim the load at a deck (only shown when a second deck is up). */
  onAimDeck: (deck: "a" | "b") => void
  /** True when a second deck exists (offer the A/B aim toggle). */
  showDeckB: boolean
  /** Called after a save with the saved snippet's identity so the deck can load it. */
  onDiscovered: (saved: { text: string; language: string }) => void
}

export const ScratchPhrasePanel = ({
  host,
  store,
  audioSource,
  loadDeck,
  onAimDeck,
  showDeckB,
  onDiscovered,
}: Props) => {
  // PhraseSamplerImmersive fires onPlaced(entry, summary) AFTER a combo is saved
  // to the bank. The exact combo text/lang is encoded in the summary the combo
  // view emits (`Saved "<text>"`); we resolve it back to the bank ref via the
  // last-registered fragment, which is the one just added.
  const onPlaced = (_entry: EntryOut, _summary: string) => {
    const lib = store.vanilla.getState().doc.fragmentLibrary ?? []
    const last = lib[lib.length - 1]
    if (last && last.text && last.language) {
      onDiscovered({ text: last.text, language: last.language })
    }
  }

  return (
    <div className="bl-scrphrase">
      {showDeckB && (
        <div className="bl-scrphrase-aim" data-bl-nocapture role="group" aria-label={ct("scratch.loadOntoDeck")}>
          <span className="bl-scrphrase-aim-label">{ct("scratch.loadOnto")}</span>
          {(["a", "b"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={`bl-scrphrase-aim-btn${loadDeck === d ? " is-on" : ""}`}
              aria-pressed={loadDeck === d}
              onClick={() => onAimDeck(d)}
            >
              {ct("scratch.deck", { id: d.toUpperCase() })}
            </button>
          ))}
        </div>
      )}
      <PhraseSamplerImmersive
        host={host}
        store={store}
        audioSource={audioSource}
        onPlaced={onPlaced}
      />
    </div>
  )
}
