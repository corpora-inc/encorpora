/**
 * beatlounge — the DOC-BACKED adapter over the canonical FX-chain pipeline.
 *
 * This is a THIN adapter: it renders the backing-agnostic `FxChainView` (the one
 * canonical rack — add menu + insert cards + reorder + the delay note-length
 * presets) and maps every callback onto the document store. The SAME view renders
 * over the live scratch bus; this adapter is the doc half (the only one with undo
 * + sends, which target arrangement buses).
 *
 * CRITICAL — the REALTIME param wiring is preserved verbatim: as a knob/XY pad
 * MOVES we drive the live audio node through `host.applyParam` (no doc write, no
 * undo step) so the sound sweeps under the finger; on RELEASE we dispatch ONE
 * `setEffectParams` with the same final value (one undo step). Every gesture is
 * one command → one undo step. The store is the only write path. Used by:
 * fx-rack, Drums, Instruments, phrase-jam.
 */

import { useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import {
  findTrack,
  type Bus,
  type Id,
  type Send,
  type Track,
} from "../../model/document"
import { newId } from "../../model/ids"
import { Knob } from "../../bl-ui"
import { EFFECT_KINDS, EFFECT_SPECS, defaultEffectParams } from "../../effects/params"
import { clearInsertsAction, addInsertAction } from "./actions"
import { runAction } from "../runAction"
import { FxChainView, type FxForm } from "./FxChainView"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  trackId: Id
  /** Render the aux-send panel under the chain. Default true. */
  showSends?: boolean
}

/**
 * The full insert chain + add menu + sends for ONE track (no track switcher —
 * the caller decides which track this binds to). A thin map of the canonical
 * `FxChainView` onto store commands; behavior is identical to the pre-extraction
 * rack.
 */
export const TrackFxChain = ({ host, store, trackId, showSends = true }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)

  const track = findTrack(doc, trackId)
  if (!track) return <div className="bl-grid-empty">No track.</div>

  // --- add (palette menu): one addInsert command (one undo step). The phone
  // quick-add goes through addInsertAction (a default filter), matching the
  // pre-extraction shortcut. ---
  const onAdd = (kind: (typeof EFFECT_KINDS)[number]) =>
    store.dispatch({
      t: "addInsert",
      trackId: track.id,
      effect: { kind, enabled: true, params: defaultEffectParams(kind) },
    })
  const onQuickAdd = () =>
    runAction(store, addInsertAction, { doc, targetTrackId: track.id })

  // --- remove: one removeInsert + a toast/undo (verbatim). ---
  const onRemove = (id: string) => {
    const fx = track.inserts.find((n) => n.id === id)
    const before = store.vanilla.getState().doc
    store.dispatch({ t: "removeInsert", trackId: track.id, insertId: id })
    host.toast(`Removed ${fx ? EFFECT_SPECS[fx.kind].label : "effect"}`, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

  // --- reorder = remove + re-add at the new index, in ONE batch (one undo step). ---
  const onMove = (id: string, dir: -1 | 1) => {
    const idx = track.inserts.findIndex((n) => n.id === id)
    if (idx < 0) return
    const to = idx + dir
    if (to < 0 || to >= track.inserts.length) return
    const fx = track.inserts[idx]
    store.dispatch({
      t: "batch",
      label: "Reorder effect",
      commands: [
        { t: "removeInsert", trackId: track.id, insertId: fx.id },
        {
          t: "addInsert",
          trackId: track.id,
          effect: { kind: fx.kind, enabled: fx.enabled, params: fx.params },
          atIndex: to,
        },
      ],
    })
  }

  // --- toggle bypass: a setEffectParams with the flipped `enabled` (verbatim). ---
  const onToggle = (id: string) => {
    const fx = track.inserts.find((n) => n.id === id)
    if (!fx) return
    store.dispatch({
      t: "setEffectParams",
      trackId: track.id,
      insertId: id,
      params: {},
      enabled: !fx.enabled,
    })
  }

  // --- live (per-move): drive the audio node straight through the engine — NO
  // doc write, NO undo step. ---
  const onParamLive = (id: string, param: string, value: number) =>
    host.applyParam(
      { scope: "insert", trackId: track.id, insertId: id, param },
      value
    )

  // --- commit (on release): ONE setEffectParams (one undo step). ---
  const onParamCommit = (id: string, params: Record<string, number | string>) =>
    store.dispatch({ t: "setEffectParams", trackId: track.id, insertId: id, params })

  const form = host.form() as FxForm

  return (
    <FxChainView
      effects={track.inserts}
      bpm={doc.bpm}
      form={form}
      onAdd={onAdd}
      onQuickAdd={onQuickAdd}
      onRemove={onRemove}
      onMove={onMove}
      onToggle={onToggle}
      onParamLive={onParamLive}
      onParamCommit={onParamCommit}
      header={
        track.inserts.length > 0 ? (
          <div className="bl-fxchain-bar" data-bl-nocapture>
            <span className="bl-fxchain-count">
              {track.inserts.length} effect{track.inserts.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="bl-chip is-danger"
              onClick={() => {
                const before = store.vanilla.getState().doc
                const r = runAction(store, clearInsertsAction, {
                  doc,
                  targetTrackId: track.id,
                })
                if (r.commands.length) {
                  host.toast(r.summary, {
                    undo: () => store.vanilla.getState().doc !== before && store.undo(),
                  })
                }
              }}
            >
              Clear
            </button>
          </div>
        ) : null
      }
      sends={
        showSends ? (
          <SendsPanel store={store} host={host} track={track} buses={doc.buses} />
        ) : null
      }
    />
  )
}

// ----------------------------------------------------------- send level knob
/**
 * A send-level knob: live during the drag (drives the send gain node via
 * applyParam when the send already exists), persisting ONE undo step on release.
 * Local `live` state tracks the dial so it follows the finger before the doc
 * write lands. When the send doesn't exist yet there is no node to drive, so the
 * first turn simply lands the send on release.
 */
const SendKnob = ({
  level,
  sendId,
  onLive,
  onCommit,
}: {
  level: number
  sendId: Id | null
  onLive: (sendId: Id, level: number) => void
  onCommit: (level: number) => void
}) => {
  const [live, setLive] = useState<number | null>(null)
  return (
    <Knob
      label="Send"
      value={live ?? level}
      min={0}
      max={1}
      step={0.01}
      defaultValue={0}
      format={(v) => `${Math.round(v * 100)}`}
      onChange={(v) => {
        setLive(v)
        if (sendId) onLive(sendId, v)
      }}
      onCommit={(v) => {
        setLive(null)
        onCommit(v)
      }}
      size={46}
    />
  )
}

// ----------------------------------------------------------- sends
const SendsPanel = ({
  store,
  host,
  track,
  buses,
}: {
  store: BeatloungeStore
  host: BeatloungeHost
  track: Track
  buses: Bus[]
}) => {
  const addBus = () => {
    store.dispatch({
      t: "addBus",
      bus: {
        name: `FX ${buses.length + 1}`,
        role: "fx",
        inserts: [
          { id: newId("fx"), kind: "reverb", enabled: true, params: defaultEffectParams("reverb") },
        ],
        sends: [],
        volume: 0.8,
        mute: false,
      },
    })
    host.toast("Added FX bus")
  }

  const sendFor = (busId: Id): Send | undefined =>
    track.sends.find((s) => s.busId === busId)

  // Live (per-move): drive the send gain node straight through the engine while
  // the send already exists — no document write, no undo step.
  const liveSendLevel = (sendId: Id, level: number) =>
    host.applyParam({ scope: "send", trackId: track.id, sendId, param: "level" }, level)

  // On release: persist the final level as ONE undo step.
  const commitSendLevel = (busId: Id, level: number) => {
    const existing = sendFor(busId)
    if (existing) {
      // Re-create the send at the new level in one undo step (sends have no
      // dedicated level command; remove + add is the model-correct path).
      store.dispatch({
        t: "batch",
        label: "Send level",
        commands: [
          { t: "removeSend", trackId: track.id, sendId: existing.id },
          { t: "addSend", trackId: track.id, send: { busId, level, preFader: existing.preFader } },
        ],
      })
    } else {
      store.dispatch({ t: "addSend", trackId: track.id, send: { busId, level } })
    }
  }

  const removeSend = (busId: Id) => {
    const existing = sendFor(busId)
    if (existing) store.dispatch({ t: "removeSend", trackId: track.id, sendId: existing.id })
  }

  return (
    <div className="bl-fxsends" data-bl-nocapture>
      <div className="bl-fxsends-head">
        <span className="bl-fxsends-title">Sends</span>
        <button type="button" className="bl-chip" onClick={addBus}>
          + Bus
        </button>
      </div>
      {buses.length === 0 ? (
        <span className="bl-fxtile-empty">No buses</span>
      ) : (
        <div className="bl-fxsends-rows">
          {buses.map((bus) => {
            const send = sendFor(bus.id)
            const level = send?.level ?? 0
            return (
              <div className="bl-fxsend" key={bus.id}>
                <span className="bl-fxsend-name">{bus.name}</span>
                <SendKnob
                  level={level}
                  sendId={send?.id ?? null}
                  onLive={liveSendLevel}
                  onCommit={(v) => commitSendLevel(bus.id, v)}
                />
                {send && (
                  <button
                    type="button"
                    className="bl-iconbtn is-danger"
                    aria-label={`Remove send to ${bus.name}`}
                    onClick={() => removeSend(bus.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
