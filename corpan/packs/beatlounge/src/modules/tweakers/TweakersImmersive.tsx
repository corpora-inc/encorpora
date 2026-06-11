/**
 * beatlounge — the tweakers IMMERSIVE view: the autonomous-modulation panel.
 *
 *  • A prominent row of AGENT buttons (breathe / drift / chaos / evolve / pulse)
 *    that spawn a bundle of modulators via applyCommands (one undo step each),
 *    plus "Clear all". The agents share `modulation/agents.ts` with the LLM.
 *  • A list of every active modulator: target label + shape picker + a depth
 *    Knob + a rate control + enable toggle + remove. Each gesture is one command.
 *
 * Every write goes through the store (the one write path). Live values mirror via
 * the zustand selector, so adding an agent immediately repopulates the list.
 */

import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { Knob, Glyph } from "../../bl-ui"
import type { Modulator, ModulatorShape } from "../../model/document"
import { applyCommands } from "../runAction"
import { AGENT_META, AGENT_NAMES, agentCommands, type AgentName } from "../../modulation/agents"
import { targetLabel } from "./targetLabel"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
}

const SHAPES: ModulatorShape[] = ["sine", "triangle", "saw", "square", "random", "drift"]
const SHAPE_LABEL: Record<ModulatorShape, string> = {
  sine: "Sine",
  triangle: "Tri",
  saw: "Saw",
  square: "Sqr",
  random: "Rand",
  drift: "Drift",
}

/** Tempo-sync rate choices, in beats per cycle (the musical menu). */
const SYNC_CHOICES = [0.5, 1, 2, 4, 8, 12, 16, 24, 32]

export const TweakersImmersive = ({ host, store }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const mods = doc.modulators ?? []
  const liveCount = mods.filter((m) => m.enabled).length

  const runAgent = (name: AgentName) => {
    const before = store.vanilla.getState().doc
    const cmds = agentCommands(name, store.vanilla.getState().doc)
    if (cmds.length === 0) {
      host.toast("Nothing to modulate yet")
      return
    }
    applyCommands(store, cmds, `Agent: ${name}`)
    host.toast(`${AGENT_META[name].label} — ${cmds.length} tweaker${cmds.length === 1 ? "" : "s"}`, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

  const clearAll = () => {
    if (mods.length === 0) return
    const before = store.vanilla.getState().doc
    store.dispatch({ t: "clearModulators" })
    host.toast("Cleared all tweakers", {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

  return (
    <div className="bl-twk">
      <div className="bl-twk-agents" data-bl-nocapture>
        <div className="bl-twk-agents-head">
          <span className="bl-twk-agents-title">Agents</span>
          <span className="bl-twk-live">{liveCount} live</span>
        </div>
        <div className="bl-twk-agent-row">
          {AGENT_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              className="bl-twk-agent"
              title={AGENT_META[name].describe}
              onClick={() => runAgent(name)}
            >
              <Glyph name="wave" size={18} />
              <span className="bl-twk-agent-label">{AGENT_META[name].label}</span>
            </button>
          ))}
          <button
            type="button"
            className="bl-twk-agent is-danger"
            onClick={clearAll}
            disabled={mods.length === 0}
            title="Remove every tweaker"
          >
            <span className="bl-twk-agent-label">Clear all</span>
          </button>
        </div>
      </div>

      <div className="bl-twk-list">
        {mods.length === 0 ? (
          <div className="bl-twk-empty">
            No tweakers yet. Set an agent loose, and the loop evolves itself.
          </div>
        ) : (
          mods.map((mod) => (
            <ModulatorRow key={mod.id} host={host} store={store} mod={mod} />
          ))
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------- one modulator row
const ModulatorRow = ({
  host,
  store,
  mod,
}: {
  host: BeatloungeHost
  store: BeatloungeStore
  mod: Modulator
}) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const label = targetLabel(mod.target, doc)
  const syncBeats = mod.syncBeats ?? 4

  const edit = (patch: Partial<Omit<Modulator, "id" | "target">>) =>
    store.dispatch({ t: "editModulator", modulatorId: mod.id, patch })

  const remove = () => {
    const before = store.vanilla.getState().doc
    store.dispatch({ t: "removeModulator", modulatorId: mod.id })
    host.toast(`Removed ${label}`, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

  return (
    <div className={`bl-twk-row${mod.enabled ? "" : " is-off"}`}>
      <div className="bl-twk-row-head" data-bl-nocapture>
        <button
          type="button"
          className={`bl-twk-power${mod.enabled ? " is-on" : ""}`}
          aria-pressed={mod.enabled}
          aria-label={mod.enabled ? "Disable tweaker" : "Enable tweaker"}
          title={mod.enabled ? "Disable" : "Enable"}
          onClick={() => store.dispatch({ t: "setModulatorEnabled", modulatorId: mod.id, enabled: !mod.enabled })}
        />
        <span className="bl-twk-row-target">{label}</span>
        <button
          type="button"
          className="bl-iconbtn is-danger"
          aria-label="Remove tweaker"
          onClick={remove}
        >
          ✕
        </button>
      </div>

      <div className="bl-twk-row-controls" data-bl-nocapture>
        <label className="bl-twk-field">
          <span className="bl-twk-field-label">Shape</span>
          <select
            className="bl-twk-select"
            value={mod.shape}
            onChange={(e) => edit({ shape: e.target.value as ModulatorShape })}
          >
            {SHAPES.map((s) => (
              <option key={s} value={s}>
                {SHAPE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="bl-twk-field">
          <span className="bl-twk-field-label">Rate</span>
          <select
            className="bl-twk-select"
            value={String(syncBeats)}
            onChange={(e) => edit({ syncBeats: Number(e.target.value), rateHz: undefined })}
          >
            {SYNC_CHOICES.map((b) => (
              <option key={b} value={String(b)}>
                {b < 1 ? `1/${Math.round(1 / b)} bar` : `${b} beat${b === 1 ? "" : "s"}`}
              </option>
            ))}
          </select>
        </label>

        <Knob
          label="Depth"
          value={mod.depth}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.4}
          format={(v) => `${Math.round(v * 100)}`}
          onChange={(v) => edit({ depth: v })}
          size={48}
        />
        <Knob
          label="Center"
          value={mod.center}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.5}
          format={(v) => `${Math.round(v * 100)}`}
          onChange={(v) => edit({ center: v })}
          size={48}
        />
      </div>
    </div>
  )
}
