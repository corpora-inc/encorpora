/**
 * beatlounge — the pure reducer. `reduce(doc, cmd) => doc'`.
 *
 * Immutable with structural sharing: untouched tracks/arrays keep their
 * references, so two adjacent docs diff to a minimal patch (the audioGraph
 * reconciler and undo/redo rely on this). NEVER mutates the input doc.
 */

import type { Command, TrackInit } from "./command"
import type {
  BeatloungeDoc,
  Bus,
  EffectNode,
  FragmentEvent,
  FragmentTrack,
  Id,
  InstrumentTrack,
  NoteEvent,
  Send,
  Track,
} from "./document"
import { isFragmentTrack, isInstrumentTrack } from "./document"
import { newId } from "./ids"
import {
  clampLoopTicks,
  gridTicks,
  tickForStep,
  type Grid,
} from "./timing"

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const clampBpm = (v: number) => Math.max(20, Math.min(300, v))

/** Insert into a tick-sorted array, returning a new array. */
const insertSorted = <T extends { tick: number }>(arr: readonly T[], item: T): T[] => {
  const out = arr.slice()
  let i = out.length
  while (i > 0 && out[i - 1].tick > item.tick) i--
  out.splice(i, 0, item)
  return out
}

const bumpTimestamp = (doc: BeatloungeDoc): BeatloungeDoc => doc // updatedAt set by bus

/** Replace one track by id with the result of `fn`, sharing all others. */
const mapTrack = (
  doc: BeatloungeDoc,
  trackId: Id,
  fn: (t: Track) => Track
): BeatloungeDoc => {
  let changed = false
  const tracks = doc.tracks.map((t) => {
    if (t.id !== trackId) return t
    const next = fn(t)
    if (next !== t) changed = true
    return next
  })
  return changed ? { ...doc, tracks } : doc
}

const mapInstrumentTrack = (
  doc: BeatloungeDoc,
  trackId: Id,
  fn: (t: InstrumentTrack) => InstrumentTrack
): BeatloungeDoc =>
  mapTrack(doc, trackId, (t) => (isInstrumentTrack(t) ? fn(t) : t))

const mapFragmentTrack = (
  doc: BeatloungeDoc,
  trackId: Id,
  fn: (t: FragmentTrack) => FragmentTrack
): BeatloungeDoc =>
  mapTrack(doc, trackId, (t) => (isFragmentTrack(t) ? fn(t) : t))

const materializeTrack = (init: TrackInit): Track => {
  const id = init.id ?? newId("trk")
  return { ...(init as Track), id }
}

export const reduce = (doc: BeatloungeDoc, cmd: Command): BeatloungeDoc => {
  switch (cmd.t) {
    // ---------------------------------------------------------- transport
    case "setTempo":
      return { ...doc, bpm: clampBpm(cmd.bpm) }

    case "addTempoEvent": {
      const ev = { id: newId("tmp"), tick: Math.max(0, cmd.tick), bpm: clampBpm(cmd.bpm) }
      return { ...doc, tempoMap: insertSorted(doc.tempoMap, ev) }
    }

    case "setMeter": {
      const ev = { id: newId("met"), tick: Math.max(0, cmd.tick), sig: cmd.sig }
      // Replace any meter event at the same tick, else insert.
      const existing = doc.meterMap.filter((m) => m.tick !== ev.tick)
      return { ...doc, meterMap: insertSorted(existing, ev) }
    }

    case "setLoopLength":
      return { ...doc, loopLengthTicks: clampLoopTicks(cmd.ticks) }

    case "setSwing":
      return {
        ...doc,
        swing: {
          amount: clamp01(cmd.amount),
          grid: cmd.grid ?? doc.swing.grid,
        },
      }

    case "setMasterVolume":
      return { ...doc, masterVolume: clamp01(cmd.v) }

    case "renameSong":
      return { ...doc, name: cmd.name }

    // ---------------------------------------------------------- tracks
    case "addTrack": {
      const track = materializeTrack(cmd.track)
      const tracks = doc.tracks.slice()
      const at = cmd.atIndex ?? tracks.length
      tracks.splice(Math.max(0, Math.min(tracks.length, at)), 0, track)
      return { ...doc, tracks }
    }

    case "removeTrack": {
      const tracks = doc.tracks.filter((t) => t.id !== cmd.trackId)
      return tracks.length === doc.tracks.length ? doc : { ...doc, tracks }
    }

    case "setTrackProp": {
      return mapTrack(doc, cmd.trackId, (t) => {
        switch (cmd.prop) {
          case "volume":
            return { ...t, volume: clamp01(cmd.value as number) }
          case "pan":
            return { ...t, pan: Math.max(-1, Math.min(1, cmd.value as number)) }
          case "mute":
            return { ...t, mute: Boolean(cmd.value) }
          case "solo":
            return { ...t, solo: Boolean(cmd.value) }
          case "name":
            return { ...t, name: String(cmd.value) }
          case "color":
            return { ...t, color: String(cmd.value) }
          case "grid":
            return { ...t, grid: cmd.value as Grid }
          case "lengthTicks": {
            const v = cmd.value
            return { ...t, lengthTicks: v == null ? undefined : Math.max(1, Math.round(v as number)) }
          }
          default:
            return t
        }
      })
    }

    case "setInstrument":
      return mapTrack(doc, cmd.trackId, (t) => {
        if (cmd.config.kind === "ttsFragment") {
          return isFragmentTrack(t) ? { ...t, instrument: cmd.config } : t
        }
        return isInstrumentTrack(t) ? { ...t, instrument: cmd.config } : t
      })

    // ---------------------------------------------------------- notes
    case "addNote":
      return mapInstrumentTrack(doc, cmd.trackId, (t) => ({
        ...t,
        notes: insertSorted(t.notes, { ...cmd.note, id: newId("n") } as NoteEvent),
      }))

    case "removeNote":
      return mapInstrumentTrack(doc, cmd.trackId, (t) => {
        const notes = t.notes.filter((n) => n.id !== cmd.noteId)
        return notes.length === t.notes.length ? t : { ...t, notes }
      })

    case "editNote":
      return mapInstrumentTrack(doc, cmd.trackId, (t) => {
        let touched = false
        let notes = t.notes.map((n) => {
          if (n.id !== cmd.noteId) return n
          touched = true
          return { ...n, ...cmd.patch, id: n.id }
        })
        if (!touched) return t
        // If tick changed, re-sort.
        if ("tick" in cmd.patch) notes = notes.slice().sort((a, b) => a.tick - b.tick)
        return { ...t, notes }
      })

    case "clearTrack":
      return mapTrack(doc, cmd.trackId, (t) =>
        isInstrumentTrack(t)
          ? t.notes.length === 0
            ? t
            : { ...t, notes: [] }
          : t.fragments.length === 0
            ? t
            : { ...t, fragments: [] }
      )

    case "toggleStep":
      return mapInstrumentTrack(doc, cmd.trackId, (t) => {
        const tick = tickForStep(cmd.step, t.grid)
        const existing = t.notes.find(
          (n) => n.tick === tick && (cmd.pitch == null || n.pitch === cmd.pitch)
        )
        if (existing) {
          return { ...t, notes: t.notes.filter((n) => n.id !== existing.id) }
        }
        const pitch = cmd.pitch ?? 60
        const note: NoteEvent = {
          id: newId("n"),
          tick,
          duration: Math.round(gridTicks(t.grid)),
          pitch,
          velocity: cmd.velocity ?? 0.9,
        }
        return { ...t, notes: insertSorted(t.notes, note) }
      })

    case "setNotes":
      return mapInstrumentTrack(doc, cmd.trackId, (t) => ({
        ...t,
        notes: cmd.notes
          .map((n) => ({ ...n, id: newId("n") }) as NoteEvent)
          .sort((a, b) => a.tick - b.tick),
      }))

    // ---------------------------------------------------------- fragments
    case "registerFragment": {
      const exists = doc.fragmentLibrary.some((f) => f.id === cmd.ref.id)
      return exists
        ? doc
        : { ...doc, fragmentLibrary: [...doc.fragmentLibrary, cmd.ref] }
    }

    case "placeFragment":
      return mapFragmentTrack(doc, cmd.trackId, (t) => ({
        ...t,
        fragments: insertSorted(t.fragments, {
          ...cmd.frag,
          id: newId("frg"),
        } as FragmentEvent),
      }))

    case "removeFragment":
      return mapFragmentTrack(doc, cmd.trackId, (t) => {
        const fragments = t.fragments.filter((f) => f.id !== cmd.fragId)
        return fragments.length === t.fragments.length ? t : { ...t, fragments }
      })

    case "editFragment":
      return mapFragmentTrack(doc, cmd.trackId, (t) => {
        let touched = false
        let fragments = t.fragments.map((f) => {
          if (f.id !== cmd.fragId) return f
          touched = true
          return { ...f, ...cmd.patch, id: f.id }
        })
        if (!touched) return t
        if ("tick" in cmd.patch) fragments = fragments.slice().sort((a, b) => a.tick - b.tick)
        return { ...t, fragments }
      })

    // ---------------------------------------------------------- effects
    case "addInsert":
      return mapTrack(doc, cmd.trackId, (t) => {
        const effect: EffectNode = { ...cmd.effect, id: newId("fx") }
        const inserts = t.inserts.slice()
        const at = cmd.atIndex ?? inserts.length
        inserts.splice(Math.max(0, Math.min(inserts.length, at)), 0, effect)
        return { ...t, inserts }
      })

    case "removeInsert":
      return mapTrack(doc, cmd.trackId, (t) => {
        const inserts = t.inserts.filter((fx) => fx.id !== cmd.insertId)
        return inserts.length === t.inserts.length ? t : { ...t, inserts }
      })

    case "setEffectParams":
      return mapTrack(doc, cmd.trackId, (t) => {
        let touched = false
        const inserts = t.inserts.map((fx) => {
          if (fx.id !== cmd.insertId) return fx
          touched = true
          return {
            ...fx,
            params: { ...fx.params, ...cmd.params },
            enabled: cmd.enabled ?? fx.enabled,
          }
        })
        return touched ? { ...t, inserts } : t
      })

    case "addSend":
      return mapTrack(doc, cmd.trackId, (t) => ({
        ...t,
        sends: [...t.sends, { ...cmd.send, id: newId("snd") } as Send],
      }))

    case "removeSend":
      return mapTrack(doc, cmd.trackId, (t) => {
        const sends = t.sends.filter((s) => s.id !== cmd.sendId)
        return sends.length === t.sends.length ? t : { ...t, sends }
      })

    case "addBus": {
      const bus: Bus = { ...cmd.bus, id: newId("bus") }
      return { ...doc, buses: [...doc.buses, bus] }
    }

    case "removeBus": {
      const buses = doc.buses.filter((b) => b.id !== cmd.busId)
      return buses.length === doc.buses.length ? doc : { ...doc, buses }
    }

    // ---------------------------------------------------------- automation
    case "addAutomationPoint":
      return mapTrack(doc, (cmd.target as { trackId?: Id }).trackId ?? "", (t) => {
        const laneIdx = t.automation.findIndex(
          (l) => JSON.stringify(l.target) === JSON.stringify(cmd.target)
        )
        const point = { id: newId("ap"), tick: cmd.tick, value: cmd.value }
        if (laneIdx === -1) {
          return {
            ...t,
            automation: [
              ...t.automation,
              { id: newId("lane"), target: cmd.target, points: [point], default: cmd.value },
            ],
          }
        }
        const lane = t.automation[laneIdx]
        const automation = t.automation.slice()
        automation[laneIdx] = { ...lane, points: insertSorted(lane.points, point) }
        return { ...t, automation }
      })

    // ---------------------------------------------------------- modulators
    case "addModulator":
      return { ...doc, modulators: [...(doc.modulators ?? []), cmd.modulator] }

    case "removeModulator": {
      const all = doc.modulators ?? []
      const mods = all.filter((m) => m.id !== cmd.modulatorId)
      return mods.length === all.length ? doc : { ...doc, modulators: mods }
    }

    case "editModulator": {
      let touched = false
      const mods = (doc.modulators ?? []).map((m) => {
        if (m.id !== cmd.modulatorId) return m
        touched = true
        return { ...m, ...cmd.patch, id: m.id, target: m.target }
      })
      return touched ? { ...doc, modulators: mods } : doc
    }

    case "setModulatorEnabled": {
      let touched = false
      const mods = (doc.modulators ?? []).map((m) => {
        if (m.id !== cmd.modulatorId || m.enabled === cmd.enabled) return m
        touched = true
        return { ...m, enabled: cmd.enabled }
      })
      return touched ? { ...doc, modulators: mods } : doc
    }

    case "clearModulators": {
      const all = doc.modulators ?? []
      if (all.length === 0) return doc
      if (!cmd.target) return { ...doc, modulators: [] }
      const key = JSON.stringify(cmd.target)
      const mods = all.filter((m) => JSON.stringify(m.target) !== key)
      return mods.length === all.length ? doc : { ...doc, modulators: mods }
    }

    // ---------------------------------------------------------- batch
    case "batch":
      return cmd.commands.reduce((d, c) => reduce(d, c), doc)

    default: {
      // Exhaustiveness guard.
      const _never: never = cmd
      void _never
      return doc
    }
  }
}

export { bumpTimestamp }
