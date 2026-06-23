/**
 * beatlounge — the Ribbon HOME WIDGET (live tile): a comfortable play strip that
 * performs the SAME voice the Instruments page is editing.
 *
 * It binds to the PERSISTED selected synth via `useSelectedInstrument` (the same
 * reactive slice the Instruments page uses), NOT the first track — so picking a
 * synth on the Instruments page and coming Home leaves the ribbon playing that
 * voice, and a new selection re-points the strip LIVE. Keying `InstrumentRibbon`
 * on the track id remounts it cleanly (releasing any in-flight voice) on switch.
 *
 * The shell owns the corner "expand" control — it opens the Instruments page
 * (where the voice is managed), so this widget renders only the play strip.
 */

import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { useSelectedInstrument } from "../../store/selectedInstrument"
import { InstrumentRibbon } from "../instrument-surface/InstrumentRibbon"
import { ct } from "../../i18n/strings"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
}

export const RibbonWidget = ({ host, store, audio }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  // Reactive: re-renders on a selection change (slice) AND a doc change (resolver
  // reads the live doc) — so the strip always plays the page's current voice.
  const { trackId } = useSelectedInstrument(doc)

  if (!trackId) {
    return (
      <div className="bl-tile-grid bl-ribbonwidget">
        <div className="bl-grid-empty">{ct("ribbon.noMelodicTrack")}</div>
      </div>
    )
  }

  return (
    <div className="bl-tile-grid bl-ribbonwidget">
      <InstrumentRibbon
        // Remount on a voice change so no note dangles across the switch.
        key={trackId}
        host={host}
        store={store}
        audio={audio}
        trackId={trackId}
        showRecord={false}
      />
    </div>
  )
}
