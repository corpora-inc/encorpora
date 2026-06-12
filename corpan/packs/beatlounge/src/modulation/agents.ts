/**
 * beatlounge — AGENT PRESETS: named bundles of autonomous knob-tweakers.
 *
 * Each agent inspects the live doc and returns a list of `addModulator`
 * Commands that drive a sensible set of targets with shapes/rates/depths chosen
 * to feel like that agent's personality. This is the ONE source of truth shared
 * by the Tweakers panel buttons AND the LLM `vibe`/`chaos` tools — the UI and
 * the model spawn identical modulators.
 *
 * Targets are picked from what the doc actually has: effect-insert params when
 * present, otherwise track volume/pan and the master. Everything is pure +
 * deterministic (no RNG; per-modulator `seed` makes the stochastic shapes vary
 * across targets), so the same doc always yields the same bundle.
 */

import type { Command } from "../model/command"
import type {
  BeatloungeDoc,
  Modulator,
  ParamTarget,
  Track,
} from "../model/document"
import { createModulator, isInstrumentTrack } from "../model/document"
import { EFFECT_SPECS } from "../effects/params"

export type AgentName = "breathe" | "drift" | "chaos" | "evolve" | "pulse"

export const AGENT_NAMES: readonly AgentName[] = [
  "breathe",
  "drift",
  "chaos",
  "evolve",
  "pulse",
]

export interface AgentMeta {
  name: AgentName
  label: string
  describe: string
}

/** Display + LLM metadata for each agent (calm, no hype). */
export const AGENT_META: Record<AgentName, AgentMeta> = {
  breathe: { name: "breathe", label: "Breathe", describe: "Slow swells on the mix — gentle, living motion." },
  drift: { name: "drift", label: "Drift", describe: "Pans and a filter wander slowly, never repeating." },
  chaos: { name: "chaos", label: "Chaos", describe: "Fast random jumps across effects and sends — unstable, wild." },
  evolve: { name: "evolve", label: "Evolve", describe: "Many slow, mixed shapes — the loop reshapes itself over minutes." },
  pulse: { name: "pulse", label: "Pulse", describe: "Tempo-synced square/triangle on volumes — rhythmic throb." },
}

// ----------------------------------------------------------------- doc probes
/** A pad/synth-ish track to breathe on: prefer a synth, else any instrument. */
const padTrack = (doc: BeatloungeDoc): Track | undefined => {
  const synth = doc.tracks.find(
    (t) => isInstrumentTrack(t) && (t.instrument.kind === "synth" || t.instrument.kind === "fmSynth" || t.instrument.kind === "wavetable")
  )
  if (synth) return synth
  return doc.tracks.find(isInstrumentTrack) ?? doc.tracks[0]
}

/** Every (track, insert, numeric-param) tuple in the doc, as insert targets. */
interface InsertParamRef {
  target: ParamTarget
  /** A "sweepable" continuous param (a mix/wet/cutoff/feedback-style knob). */
  sweepable: boolean
}
const insertParamTargets = (doc: BeatloungeDoc): InsertParamRef[] => {
  const out: InsertParamRef[] = []
  for (const track of doc.tracks) {
    for (const fx of track.inserts) {
      const spec = EFFECT_SPECS[fx.kind]
      for (const p of spec.params) {
        if (p.type !== "number") continue
        // Prefer 0..1 "feel" params (mix/wet/depth/feedback) for musical sweeps.
        const sweepable = p.min === 0 && p.max === 1
        out.push({
          target: { scope: "insert", trackId: track.id, insertId: fx.id, param: p.key },
          sweepable,
        })
      }
    }
  }
  return out
}

/** A "filter cutoff"-like insert target, if the doc has one (for drift sweeps). */
const filterTargets = (doc: BeatloungeDoc): ParamTarget[] => {
  const out: ParamTarget[] = []
  for (const track of doc.tracks) {
    for (const fx of track.inserts) {
      if (fx.kind === "filter") {
        out.push({ scope: "insert", trackId: track.id, insertId: fx.id, param: "frequency" })
      }
    }
  }
  return out
}

const instrumentTracks = (doc: BeatloungeDoc): Track[] =>
  doc.tracks.filter(isInstrumentTrack)

// ----------------------------------------------------------------- assembly
const toCommands = (mods: Modulator[]): Command[] =>
  mods.map((modulator) => ({ t: "addModulator", modulator }))

const mk = (target: ParamTarget, patch: Partial<Omit<Modulator, "id" | "target">>): Modulator =>
  createModulator(target, patch)

// ----------------------------------------------------------------- agents
/**
 * breathe — slow sine swells: one on the master, one on a pad/synth track's
 * volume. Shallow depth, multi-bar cycle, opposed phases so the mix "inhales".
 */
const breathe = (doc: BeatloungeDoc): Modulator[] => {
  const mods: Modulator[] = [
    mk({ scope: "master", param: "volume" }, {
      shape: "sine",
      syncBeats: 16,
      depth: 0.22,
      center: 0.82,
      phase: 0,
    }),
  ]
  const pad = padTrack(doc)
  if (pad) {
    mods.push(
      mk({ scope: "track", trackId: pad.id, param: "volume" }, {
        shape: "sine",
        syncBeats: 12,
        depth: 0.3,
        center: 0.7,
        phase: 0.5,
      })
    )
  }
  return mods
}

/**
 * drift — slow, never-repeating wander: drift on each track's pan, plus drift on
 * a filter cutoff (or a sweepable insert param) when one exists.
 */
const drift = (doc: BeatloungeDoc): Modulator[] => {
  const mods: Modulator[] = []
  instrumentTracks(doc).slice(0, 4).forEach((t, i) => {
    mods.push(
      mk({ scope: "track", trackId: t.id, param: "pan" }, {
        shape: "drift",
        syncBeats: 14 + i * 3,
        depth: 0.7,
        center: 0.5,
        seed: 1000 + i,
      })
    )
  })
  const filters = filterTargets(doc)
  const sweeps = insertParamTargets(doc).filter((r) => r.sweepable)
  const target = filters[0] ?? sweeps[0]?.target
  if (target) {
    mods.push(
      mk(target, {
        shape: "drift",
        syncBeats: 20,
        depth: 0.6,
        center: 0.5,
        seed: 7,
      })
    )
  }
  return mods
}

/**
 * chaos — fast random (sample & hold) at high depth across several effect params
 * and sends. Unstable on purpose. Falls back to pans/volumes if there are no
 * inserts/sends, so it always does SOMETHING.
 */
const chaos = (doc: BeatloungeDoc, intensity = 1): Modulator[] => {
  const depth = Math.max(0.4, Math.min(1, 0.7 * intensity))
  const fast = Math.max(0.25, 1 / Math.max(0.5, intensity)) // beats per cycle (smaller = wilder)
  const mods: Modulator[] = []
  const inserts = insertParamTargets(doc)
  inserts.slice(0, 6).forEach((r, i) => {
    mods.push(
      mk(r.target, {
        shape: "random",
        syncBeats: fast + (i % 3) * 0.25,
        depth,
        center: 0.5,
        seed: 2000 + i,
      })
    )
  })
  // Sends, if any.
  let si = 0
  for (const track of doc.tracks) {
    for (const send of track.sends) {
      mods.push(
        mk({ scope: "send", trackId: track.id, sendId: send.id, param: "level" }, {
          shape: "random",
          syncBeats: fast,
          depth,
          center: 0.5,
          seed: 3000 + si++,
        })
      )
      if (si >= 3) break
    }
    if (si >= 3) break
  }
  // Fallback: nothing to grab → jitter pans + master so chaos is never empty.
  if (mods.length === 0) {
    mods.push(
      mk({ scope: "master", param: "volume" }, { shape: "random", syncBeats: 1, depth: depth * 0.4, center: 0.8, seed: 9 })
    )
    instrumentTracks(doc).slice(0, 3).forEach((t, i) =>
      mods.push(
        mk({ scope: "track", trackId: t.id, param: "pan" }, { shape: "random", syncBeats: fast, depth, center: 0.5, seed: 4000 + i })
      )
    )
  }
  return mods
}

/**
 * evolve — the long game: many slow, MIXED shapes across many params so the loop
 * reshapes itself over minutes. Combines breathe + drift + a couple of slow
 * triangle/saw insert sweeps with long cycles and varied seeds.
 */
const evolve = (doc: BeatloungeDoc): Modulator[] => {
  const mods: Modulator[] = [...breathe(doc), ...drift(doc)]
  const shapes = ["triangle", "saw", "sine", "drift"] as const
  const sweeps = insertParamTargets(doc).filter((r) => r.sweepable)
  sweeps.slice(0, 5).forEach((r, i) => {
    mods.push(
      mk(r.target, {
        shape: shapes[i % shapes.length],
        syncBeats: 24 + i * 7,
        depth: 0.45,
        center: 0.5,
        seed: 5000 + i,
        phase: (i * 0.17) % 1,
      })
    )
  })
  return mods
}

/**
 * pulse — rhythmic throb: tempo-synced square/triangle on track volumes (and the
 * master), short cycles so it pumps with the beat.
 */
const pulse = (doc: BeatloungeDoc): Modulator[] => {
  const mods: Modulator[] = []
  instrumentTracks(doc).slice(0, 4).forEach((t, i) => {
    mods.push(
      mk({ scope: "track", trackId: t.id, param: "volume" }, {
        shape: i % 2 === 0 ? "square" : "triangle",
        syncBeats: i % 2 === 0 ? 1 : 2,
        depth: 0.5,
        center: 0.6,
        phase: (i * 0.25) % 1,
      })
    )
  })
  if (mods.length === 0) {
    mods.push(
      mk({ scope: "master", param: "volume" }, { shape: "square", syncBeats: 1, depth: 0.35, center: 0.7 })
    )
  }
  return mods
}

const BUILDERS: Record<AgentName, (doc: BeatloungeDoc) => Modulator[]> = {
  breathe,
  drift,
  chaos: (doc) => chaos(doc, 1),
  evolve,
  pulse,
}

/** The modulators an agent would spawn for `doc` (the shared definition). */
export const agentModulators = (name: AgentName, doc: BeatloungeDoc): Modulator[] =>
  BUILDERS[name](doc)

/** The commands an agent dispatches: a bundle of addModulator (no clear). */
export const agentCommands = (name: AgentName, doc: BeatloungeDoc): Command[] =>
  toCommands(agentModulators(name, doc))

/** chaos with an explicit intensity scalar (the `chaos` LLM tool uses this). */
export const chaosCommands = (doc: BeatloungeDoc, intensity = 1): Command[] =>
  toCommands(chaos(doc, intensity))
