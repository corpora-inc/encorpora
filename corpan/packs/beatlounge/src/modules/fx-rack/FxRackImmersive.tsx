/**
 * beatlounge — the fx-rack IMMERSIVE view: the full per-track effects rack.
 *
 *  • Track switcher (chips) so one rack module edits any track.
 *  • Insert chain: an ordered list of effect cards. Each card has an enable
 *    toggle, reorder up/down, remove, and a knob per param (specs drive both
 *    the knob ranges AND the engine setters, so they can't drift).
 *  • Add menu: a chip per EffectKind (dispatches addInsert).
 *  • Sends: a level fader per fx/group bus (addSend / setEffectParams-style
 *    level via removeSend+addSend isn't needed — send level updates re-dispatch).
 *
 * Every gesture is one command → one undo step. The store is the only write path.
 */

import { useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import {
  findTrack,
  type Bus,
  type EffectNode,
  type Id,
  type Send,
  type Track,
} from "../../model/document"
import { newId } from "../../model/ids"
import { Knob } from "../../bl-ui"
import {
  EFFECT_KINDS,
  EFFECT_SPECS,
  defaultEffectParams,
  numParam,
  strParam,
  type EffectParamSpec,
} from "../../effects/params"
import { addInsertAction, clearInsertsAction } from "./actions"
import { runAction } from "../runAction"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  trackId: Id
}

export const FxRackImmersive = ({ host, store, trackId: initialTrackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const [trackId, setTrackId] = useState<Id>(initialTrackId)
  const [adding, setAdding] = useState(false)

  const track = findTrack(doc, trackId) ?? doc.tracks[0]
  if (!track) return <div className="bl-grid-empty">No track.</div>

  const addInsert = (kind: (typeof EFFECT_KINDS)[number]) => {
    store.dispatch({
      t: "addInsert",
      trackId: track.id,
      effect: { kind, enabled: true, params: defaultEffectParams(kind) },
    })
    setAdding(false)
  }

  return (
    <div className="bl-fxrack">
      <div className="bl-fxrack-bar" data-bl-nocapture>
        <div className="bl-fxrack-tracks">
          {doc.tracks.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`bl-chip${t.id === track.id ? " is-on" : ""}`}
              onClick={() => setTrackId(t.id)}
            >
              <span className="bl-dot" style={{ background: t.color ?? "var(--bl-accent)" }} />
              {t.name}
            </button>
          ))}
        </div>
        {track.inserts.length > 0 && (
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
        )}
      </div>

      <div className="bl-fxrack-chain">
        {track.inserts.map((fx, i) => (
          <EffectCard
            key={fx.id}
            store={store}
            host={host}
            trackId={track.id}
            fx={fx}
            index={i}
            count={track.inserts.length}
          />
        ))}

        <div className="bl-fxrack-add" data-bl-nocapture>
          {adding ? (
            <div className="bl-fxrack-menu" role="menu">
              {EFFECT_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="bl-chip"
                  role="menuitem"
                  onClick={() => addInsert(kind)}
                >
                  {EFFECT_SPECS[kind].label}
                </button>
              ))}
              <button
                type="button"
                className="bl-chip"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="bl-fxrack-addbtn"
              onClick={() => {
                if (host.form() === "phone") {
                  // Phone: a quick default (filter) via the action; long-list menu
                  // still available by re-tapping. Keeps the FAB-light layout.
                  runAction(store, addInsertAction, { doc, targetTrackId: track.id })
                } else {
                  setAdding(true)
                }
              }}
            >
              + Add effect
            </button>
          )}
        </div>
      </div>

      <SendsPanel store={store} host={host} track={track} buses={doc.buses} />
    </div>
  )
}

// ----------------------------------------------------------- effect card
interface CardProps {
  store: BeatloungeStore
  host: BeatloungeHost
  trackId: Id
  fx: EffectNode
  index: number
  count: number
}

const EffectCard = ({ store, host, trackId, fx, index, count }: CardProps) => {
  const spec = EFFECT_SPECS[fx.kind]

  const setParam = (key: string, value: number | string) =>
    store.dispatch({
      t: "setEffectParams",
      trackId,
      insertId: fx.id,
      params: { [key]: value },
    })

  const remove = () => {
    const before = store.vanilla.getState().doc
    store.dispatch({ t: "removeInsert", trackId, insertId: fx.id })
    host.toast(`Removed ${spec.label}`, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

  // Reorder = remove + re-add at the new index (one undo step via batch).
  const move = (delta: number) => {
    const to = index + delta
    if (to < 0 || to >= count) return
    store.dispatch({
      t: "batch",
      label: "Reorder effect",
      commands: [
        { t: "removeInsert", trackId, insertId: fx.id },
        { t: "addInsert", trackId, effect: { kind: fx.kind, enabled: fx.enabled, params: fx.params }, atIndex: to },
      ],
    })
  }

  return (
    <div className={`bl-fxcard${fx.enabled ? "" : " is-bypassed"}`}>
      <div className="bl-fxcard-head" data-bl-nocapture>
        <button
          type="button"
          className={`bl-fxcard-power${fx.enabled ? " is-on" : ""}`}
          aria-pressed={fx.enabled}
          aria-label={fx.enabled ? "Bypass effect" : "Enable effect"}
          title={fx.enabled ? "Bypass" : "Enable"}
          onClick={() =>
            store.dispatch({
              t: "setEffectParams",
              trackId,
              insertId: fx.id,
              params: {},
              enabled: !fx.enabled,
            })
          }
        />
        <span className="bl-fxcard-name">{spec.label}</span>
        <div className="bl-fxcard-actions">
          <button
            type="button"
            className="bl-iconbtn"
            aria-label="Move up"
            disabled={index === 0}
            onClick={() => move(-1)}
          >
            ↑
          </button>
          <button
            type="button"
            className="bl-iconbtn"
            aria-label="Move down"
            disabled={index === count - 1}
            onClick={() => move(1)}
          >
            ↓
          </button>
          <button
            type="button"
            className="bl-iconbtn is-danger"
            aria-label="Remove effect"
            onClick={remove}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="bl-fxcard-params" data-bl-nocapture>
        {spec.params.map((p) =>
          p.type === "enum" ? (
            <EnumParam key={p.key} spec={p} fx={fx} onChange={(v) => setParam(p.key, v)} />
          ) : (
            <ParamKnob key={p.key} spec={p} fx={fx} onChange={(v) => setParam(p.key, v)} />
          )
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------- param controls
const ParamKnob = ({
  spec,
  fx,
  onChange,
}: {
  spec: EffectParamSpec
  fx: EffectNode
  onChange: (v: number) => void
}) => {
  const value = numParam(fx.params, spec)
  const fmt = (v: number): string => {
    if (spec.unit === "Hz") return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
    if (spec.unit === "dB") return v.toFixed(1)
    if (spec.unit === "s") return v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`
    if (spec.min === 0 && spec.max === 1) return `${Math.round(v * 100)}`
    return v.toFixed(spec.step && spec.step < 1 ? 2 : 0)
  }
  return (
    <Knob
      label={spec.label}
      value={value}
      min={spec.min ?? 0}
      max={spec.max ?? 1}
      step={spec.step}
      defaultValue={spec.default as number}
      unit={spec.unit && spec.unit !== "Hz" && spec.unit !== "dB" && spec.unit !== "s" ? spec.unit : undefined}
      format={fmt}
      onChange={onChange}
      size={50}
    />
  )
}

const EnumParam = ({
  spec,
  fx,
  onChange,
}: {
  spec: EffectParamSpec
  fx: EffectNode
  onChange: (v: string) => void
}) => {
  const value = strParam(fx.params, spec)
  return (
    <label className="bl-fxenum">
      <span className="bl-fxenum-label">{spec.label}</span>
      <select
        className="bl-fxenum-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {(spec.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
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

  const setSendLevel = (busId: Id, level: number) => {
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
                <Knob
                  label="Send"
                  value={level}
                  min={0}
                  max={1}
                  step={0.01}
                  defaultValue={0}
                  format={(v) => `${Math.round(v * 100)}`}
                  onChange={(v) => setSendLevel(bus.id, v)}
                  size={46}
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
