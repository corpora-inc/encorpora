/**
 * beatlounge — the ribbon performance controller (IMMERSIVE).
 *
 * Thin wrapper: the ribbon's whole gesture/harmony/record surface now lives in
 * the reusable <InstrumentRibbon> (modules/instrument-surface), shared with the
 * Instruments page. This is the quick-perform surface — it plays/records through
 * the bound melodic track's real instrument (polyphonic, through its FX + mixer).
 *
 * It binds to the PERSISTED selected voice (`useSelectedInstrument`) — the SAME
 * track the Instruments page, the Shell DockRail Record button, and the home
 * Ribbon widget arm and record into. That keeps Record-arm consistent across
 * every surface (fixes #391: turning Record off on one surface no longer leaves
 * it armed here, because they were pointing at different tracks). The mount's
 * `trackId` is only a fallback for when nothing is selected yet.
 */

import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { Id } from "../../model/document"
import { useBeatloungeStore } from "../../store/store"
import { useSelectedInstrument } from "../../store/selectedInstrument"
import { InstrumentRibbon } from "../instrument-surface/InstrumentRibbon"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  /** Fallback melodic track when no voice is selected yet. */
  trackId: Id
}

export const RibbonImmersive = ({ host, store, audio, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  // Reactive: re-render on a selection change (slice) AND a doc change, so the
  // strip always performs — and records into — the page's current voice.
  const { trackId: selected } = useSelectedInstrument(doc)
  const bound = selected ?? trackId
  return (
    <InstrumentRibbon
      // Remount on a voice change so no note dangles across the switch.
      key={bound}
      host={host}
      store={store}
      audio={audio}
      trackId={bound}
    />
  )
}
