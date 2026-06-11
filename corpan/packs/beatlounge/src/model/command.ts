/**
 * beatlounge — the Command union. THE ONE WRITE PATH.
 *
 * Every mutation — UI gesture, LLM tool call, phrase-sampler placement —
 * is one of these typed commands, applied by the pure `reduce` (./reduce).
 * The LLM tool DSL is a thin schema over this union; the phrase-sampler
 * emits `placeFragment` / `registerFragment`. Nothing else touches the doc.
 */

import type {
  Bus,
  EffectNode,
  FragmentEvent,
  FragmentRef,
  Grid,
  HarmonyChordEvent,
  HarmonyMode,
  HarmonyReference,
  HarmonyScaleFamily,
  HarmonyTuningId,
  Id,
  InstrumentConfig,
  Midi,
  Modulator,
  NoteEvent,
  Normalized,
  ParamTarget,
  Send,
  Tick,
  TimeSignature,
  Track,
} from "./document"

/** Omit that distributes over a union, preserving each member's own keys. */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

/** A track stub the bus can flesh out with ids (union-preserving). */
export type TrackInit = DistributiveOmit<Track, "id"> & { id?: Id }

export type Command =
  // ---- transport / global ----
  | { t: "setTempo"; bpm: number }
  | { t: "addTempoEvent"; tick: Tick; bpm: number }
  | { t: "setMeter"; tick: Tick; sig: TimeSignature }
  | { t: "setLoopLength"; ticks: Tick }
  | { t: "setSwing"; amount: Normalized; grid?: Grid }
  | { t: "setMasterVolume"; v: Normalized }
  | { t: "renameSong"; name: string }
  // ---- tracks ----
  | { t: "addTrack"; track: TrackInit; atIndex?: number }
  | { t: "removeTrack"; trackId: Id }
  | {
      t: "setTrackProp"
      trackId: Id
      prop: "volume" | "pan" | "mute" | "solo" | "name" | "grid" | "lengthTicks" | "color"
      value: unknown
    }
  | { t: "setInstrument"; trackId: Id; config: InstrumentConfig }
  // ---- notes (instrument tracks) ----
  | { t: "addNote"; trackId: Id; note: Omit<NoteEvent, "id"> }
  | { t: "removeNote"; trackId: Id; noteId: Id }
  | { t: "editNote"; trackId: Id; noteId: Id; patch: Partial<Omit<NoteEvent, "id">> }
  | { t: "clearTrack"; trackId: Id }
  /** Grid-sugar: toggle the cell at `step` (compiles to tick) to `pitch`. */
  | { t: "toggleStep"; trackId: Id; step: number; pitch?: Midi; velocity?: Normalized }
  /** Replace a track's whole note set (used by generative/LLM fills). */
  | { t: "setNotes"; trackId: Id; notes: Omit<NoteEvent, "id">[] }
  // ---- fragments (phrase-sampler) ----
  | { t: "registerFragment"; ref: FragmentRef }
  /** Remove a saved snippet from the bank (library) + any placed events using it. */
  | { t: "removeFragmentRef"; refId: Id }
  | { t: "placeFragment"; trackId: Id; frag: Omit<FragmentEvent, "id"> }
  | { t: "removeFragment"; trackId: Id; fragId: Id }
  | {
      t: "editFragment"
      trackId: Id
      fragId: Id
      patch: Partial<Omit<FragmentEvent, "id">>
    }
  // ---- effects / sends / buses ----
  | { t: "addInsert"; trackId: Id; effect: Omit<EffectNode, "id">; atIndex?: number }
  | { t: "removeInsert"; trackId: Id; insertId: Id }
  | { t: "setEffectParams"; trackId: Id; insertId: Id; params: Record<string, number | string | boolean>; enabled?: boolean }
  | { t: "addSend"; trackId: Id; send: Omit<Send, "id"> }
  | { t: "removeSend"; trackId: Id; sendId: Id }
  | { t: "addBus"; bus: Omit<Bus, "id"> }
  | { t: "removeBus"; busId: Id }
  // ---- automation ----
  | { t: "addAutomationPoint"; target: ParamTarget; tick: Tick; value: number }
  // ---- modulators (autonomous knob-tweakers) ----
  | { t: "addModulator"; modulator: Modulator }
  | { t: "removeModulator"; modulatorId: Id }
  | { t: "editModulator"; modulatorId: Id; patch: Partial<Omit<Modulator, "id" | "target">> }
  | { t: "setModulatorEnabled"; modulatorId: Id; enabled: boolean }
  /** Clear all modulators, or only those whose target matches. */
  | { t: "clearModulators"; target?: ParamTarget }
  // ---- harmony (the global pitch world) ----
  /** Switch which editor's output the resolver consumes (modal ⇄ chordal). */
  | { t: "setHarmonyMode"; mode: HarmonyMode }
  /** Set the global tonic (pitch class 0..11). Shared by modal + chordal. */
  | { t: "setTonic"; pc: number }
  /** Pick a modal scale: a corpus mode id + its family. */
  | { t: "setScale"; family: HarmonyScaleFamily; id: string }
  /** Set the modal tuning (equal12 | pythagorean | just). */
  | { t: "setTuning"; tuning: HarmonyTuningId }
  /** Set the reference pitch (A4 = 440 / 442 / drone anchor). */
  | { t: "setReference"; reference: HarmonyReference }
  /** Replace the whole chord timeline (chord-fill / browse-994 drop). */
  | { t: "setProgression"; chords: Omit<HarmonyChordEvent, "id">[] }
  /** Add or REPLACE the chord at a tick (visual grid tap). */
  | { t: "setChordAt"; tick: Tick; symbol: string; durationTicks?: Tick }
  /** Add a chord to the timeline. */
  | { t: "addChord"; chord: Omit<HarmonyChordEvent, "id"> }
  /** Remove a chord by id. */
  | { t: "removeChord"; chordId: Id }
  // ---- atomic multi-command transaction (one undo step) ----
  | { t: "batch"; commands: Command[]; label?: string }
