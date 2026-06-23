/**
 * beatlounge — TrackParamKnob: the shared "live track Volume / Pan" knob used by
 * the sequencer foot rows (drum-pads, piano-roll, step-grid).
 *
 * It drives the track's audio node in REAL TIME as the finger moves
 * (`host.applyParam({scope:"track", trackId, param})` ramps the gain/pan node —
 * NO document write, NO undo spam) and persists ONE `setTrackProp` on release
 * (one clean undo step). Local `live` state keeps the dial tracking the finger
 * before the doc write lands. This is the unified realtime-param pattern (mirror
 * of the fx-rack ParamKnob and the mixer LiveFader).
 */

import { useState } from "react"
import type { BeatloungeHost } from "../contracts/module"
import type { BeatloungeStore } from "../store/store"
import type { Id } from "../model/document"
import { Knob } from "../bl-ui"
import { ct } from "../i18n/strings"

const volFmt = (v: number): string => `${Math.round(v * 100)}`
const panFmt = (v: number): string =>
  v === 0 ? "C" : `${v > 0 ? "R" : "L"}${Math.round(Math.abs(v) * 100)}`

export const TrackParamKnob = ({
  host,
  store,
  trackId,
  param,
  value,
}: {
  host: BeatloungeHost
  store: BeatloungeStore
  trackId: Id
  param: "volume" | "pan"
  value: number
}) => {
  const [live, setLive] = useState<number | null>(null)
  const isPan = param === "pan"
  return (
    <Knob
      label={isPan ? ct("trackStudio.pan") : ct("trackStudio.volume")}
      value={live ?? value}
      min={isPan ? -1 : 0}
      max={1}
      step={isPan ? 0.02 : 0.01}
      defaultValue={isPan ? 0 : 0.8}
      format={isPan ? panFmt : volFmt}
      onChange={(v) => {
        setLive(v)
        host.applyParam({ scope: "track", trackId, param }, v)
      }}
      onCommit={(v) => {
        setLive(null)
        store.dispatch({ t: "setTrackProp", trackId, prop: param, value: v })
      }}
    />
  )
}
