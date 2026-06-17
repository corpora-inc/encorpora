/**
 * beatlounge — the ribbon performance controller (IMMERSIVE).
 *
 * Thin wrapper: the ribbon's whole gesture/harmony/record surface now lives in
 * the reusable <InstrumentRibbon> (modules/instrument-surface), shared with the
 * Instruments page. The standalone Ribbon module is the quick-perform surface —
 * it owns its own Record arm and plays/records the bound melodic track through
 * that track's real instrument (polyphonic, through its FX + mixer).
 */

import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { Id } from "../../model/document"
import { InstrumentRibbon } from "../instrument-surface/InstrumentRibbon"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  /** The melodic track the ribbon plays + records into. */
  trackId: Id
}

export const RibbonImmersive = ({ host, store, audio, trackId }: Props) => (
  <InstrumentRibbon host={host} store={store} audio={audio} trackId={trackId} />
)
