/**
 * beatlounge — the CLOSED LLM tool catalog.
 *
 * The 4B model only ever picks one of these tools and supplies a few scalar
 * args; ALL musical logic is deterministic and lives here in `build()`. Every
 * `build()` returns a list of valid `Command`s plus a one-line summary, after
 * clamping/validating its own args against the doc — so a malformed-but-parsed
 * tool call can never produce an illegal mutation.
 *
 * This is the contract the protocol (system prompt + parser + validator) and the
 * keyword fallback both target. Keep the catalog SMALL and reliable: the headline
 * feature is "something musical ALWAYS happens", not breadth.
 */

import type { Command } from "../model/command"
import type { BeatloungeDoc, Id, NoteEvent, ParamTarget } from "../model/document"
import { DRUM_PITCH, createModulator, findTrack, isInstrumentTrack } from "../model/document"
import { stepsInLoop, tickForStep } from "../model/timing"
import { euclidIndices } from "../music/euclid"
import { parseNoteName, SCALE_NAMES, type ScaleName } from "../music/harmony"
import { TEMPLATE_NAMES, renderTemplate } from "../music/templates"
import { jam as composeJam, progressionTicks, type JamFeel } from "../music/jam"
import {
  AGENT_NAMES,
  AGENT_META,
  agentCommands,
  chaosCommands,
  type AgentName,
} from "../modulation/agents"

/** Deterministic RNG: same shape as runAction's mulberry32 stream. */
export type Rng = () => number

// ----------------------------------------------------------------- param schema
export type ToolParamType = "number" | "int" | "enum" | "drum"

export interface ToolParam {
  type: ToolParamType
  /** Inclusive clamp bounds (number/int). */
  min?: number
  max?: number
  /** Allowed values for an enum. */
  options?: readonly string[]
  /** Default applied when the arg is missing/unparseable. */
  default?: unknown
  /** Optional — if false (default) a missing value falls back to `default`. */
  required?: boolean
  /** One line the system prompt renders for the model. */
  describe: string
}

export interface ToolBuildResult {
  commands: Command[]
  summary: string
}

export interface ToolSpec {
  name: string
  /** One line the system prompt renders. */
  describe: string
  params: Record<string, ToolParam>
  /** Pure-ish given `rng`: validates/clamps args itself, returns valid commands. */
  build(args: Record<string, unknown>, doc: BeatloungeDoc, rng: Rng): ToolBuildResult
}

// ----------------------------------------------------------------- helpers
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const round = (v: number) => Math.round(v)

/** The drum-pad pitch a friendly drum name maps to (closed set). */
export const DRUM_ALIASES: Record<string, keyof typeof DRUM_PITCH> = {
  kick: "kick",
  bass: "kick",
  bd: "kick",
  boom: "kick",
  snare: "snare",
  sd: "snare",
  clap: "clap",
  hat: "hat",
  hats: "hat",
  hihat: "hat",
  hihats: "hat",
  hh: "hat",
  cymbal: "hat",
}

/** Resolve a free-text drum name to a pad pitch, defaulting to hi-hat. */
export const resolveDrumPitch = (name?: string): number => {
  if (!name) return DRUM_PITCH.hat
  const key = String(name).toLowerCase().replace(/[^a-z]/g, "")
  const alias = DRUM_ALIASES[key]
  return alias ? DRUM_PITCH[alias] : DRUM_PITCH.hat
}

/** The first drum-sampler track, else the first instrument track. */
export const resolveDrumTrack = (doc: BeatloungeDoc, trackId?: Id) => {
  if (trackId) {
    const t = findTrack(doc, trackId)
    if (t && isInstrumentTrack(t)) return t
  }
  const drum = doc.tracks.find((t) => isInstrumentTrack(t) && t.instrument.kind === "drumSampler")
  if (drum && isInstrumentTrack(drum)) return drum
  const any = doc.tracks.find(isInstrumentTrack)
  return any && isInstrumentTrack(any) ? any : undefined
}

/** Any instrument track by id, else the first instrument track. */
const resolveInstrumentTrack = (doc: BeatloungeDoc, trackId?: Id) => {
  if (trackId) {
    const t = findTrack(doc, trackId)
    if (t && isInstrumentTrack(t)) return t
  }
  const any = doc.tracks.find(isInstrumentTrack)
  return any && isInstrumentTrack(any) ? any : undefined
}

// ----------------------------------------------------------------- tools

/** setTempo — set the song BPM (clamped to the musical range). */
const setTempo: ToolSpec = {
  name: "setTempo",
  describe: "Set the tempo in beats per minute (40–220).",
  params: {
    bpm: { type: "int", min: 40, max: 220, required: true, describe: "Target BPM, e.g. 120." },
  },
  build(args, doc) {
    const bpm = clamp(round(Number(args.bpm ?? doc.bpm)), 40, 220)
    return { commands: [{ t: "setTempo", bpm }], summary: `Tempo → ${bpm} BPM` }
  },
}

/** setSwing — set the global swing amount, 0 = straight .. 0.66 = heavy shuffle. */
const setSwing: ToolSpec = {
  name: "setSwing",
  describe: "Set swing/shuffle feel, 0 (straight) to 0.66 (heavy shuffle).",
  params: {
    amount: {
      type: "number",
      min: 0,
      max: 0.66,
      required: true,
      describe: "Swing amount 0–0.66.",
    },
  },
  build(args) {
    const amount = clamp(Number(args.amount ?? 0), 0, 0.66)
    const pct = Math.round((amount / 0.66) * 100)
    return { commands: [{ t: "setSwing", amount }], summary: `Swing → ${pct}%` }
  },
}

/**
 * density — add or remove hits on a drum lane ("more hihats" / "less kick").
 * "more" fills empty steps of the lane (denser, evenly spread); "less" thins the
 * existing hits. `amount` is the number of hits to add/remove (1..16); when
 * omitted it nudges by a musical default. Always resolves a concrete pad pitch.
 */
const density: ToolSpec = {
  name: "density",
  describe:
    'Add or remove hits on a drum lane. dir "more" thickens, "less" thins; drum picks the lane (kick/snare/hat/clap).',
  params: {
    dir: { type: "enum", options: ["more", "less"], default: "more", describe: '"more" or "less".' },
    drum: {
      type: "drum",
      default: "hat",
      describe: "Which drum lane: kick, snare, hat, or clap.",
    },
    amount: { type: "int", min: 1, max: 16, describe: "How many hits to add/remove (optional)." },
    trackId: { type: "enum", describe: "Optional explicit track id." },
  },
  build(args, doc, rng) {
    const track = resolveDrumTrack(doc, args.trackId as Id | undefined)
    if (!track) return { commands: [], summary: "No drum track" }
    const pitch = resolveDrumPitch(args.drum as string | undefined)
    const dir = args.dir === "less" ? "less" : "more"
    const steps = stepsInLoop(doc.loopLengthTicks, track.grid)
    if (steps <= 0) return { commands: [], summary: "Empty loop" }

    // Which steps on this lane are currently hit?
    const hit = new Set<number>()
    for (const n of track.notes) {
      if (n.pitch !== pitch) continue
      const step = Math.round(n.tick / (tickForStep(1, track.grid) || 1))
      if (step >= 0 && step < steps) hit.add(step)
    }

    const nudge = Math.max(1, Math.round(steps / 4))
    const amount =
      args.amount != null ? clamp(round(Number(args.amount)), 1, steps) : nudge

    const commands: Command[] = []
    if (dir === "more") {
      const empties: number[] = []
      for (let s = 0; s < steps; s++) if (!hit.has(s)) empties.push(s)
      // Prefer an even spread: shuffle deterministically, then pick.
      shuffle(empties, rng)
      const pick = empties.slice(0, Math.min(amount, empties.length)).sort((a, b) => a - b)
      for (const s of pick)
        commands.push({ t: "toggleStep", trackId: track.id, step: s, pitch, velocity: 0.55 })
      const drumName = pitchName(pitch)
      return {
        commands: wrapBatch(commands, "More hits"),
        summary: pick.length ? `+${pick.length} ${drumName}` : `${drumName} lane full`,
      }
    } else {
      const present = [...hit].sort((a, b) => a - b)
      shuffle(present, rng)
      const pick = present.slice(0, Math.min(amount, present.length)).sort((a, b) => a - b)
      for (const s of pick)
        commands.push({ t: "toggleStep", trackId: track.id, step: s, pitch })
      const drumName = pitchName(pitch)
      return {
        commands: wrapBatch(commands, "Fewer hits"),
        summary: pick.length ? `−${pick.length} ${drumName}` : `${drumName} lane empty`,
      }
    }
  },
}

/**
 * euclid — replace a drum lane with a Euclidean rhythm (pulses spread across
 * steps). The classic "give me a tresillo / 5-over-8" intent. Operates on ONE
 * lane (pitch); leaves the rest of the track's notes intact.
 */
const euclidTool: ToolSpec = {
  name: "euclid",
  describe:
    "Lay a Euclidean rhythm on a drum lane: `pulses` hits spread evenly over `steps`. e.g. 3 over 8 = tresillo.",
  params: {
    drum: { type: "drum", default: "hat", describe: "Lane: kick, snare, hat, or clap." },
    pulses: { type: "int", min: 0, max: 32, required: true, describe: "Number of hits." },
    steps: { type: "int", min: 1, max: 32, default: 8, describe: "Steps to spread across." },
    rotate: { type: "int", min: 0, max: 31, default: 0, describe: "Rotate the pattern (optional)." },
    trackId: { type: "enum", describe: "Optional explicit track id." },
  },
  build(args, doc) {
    const track = resolveDrumTrack(doc, args.trackId as Id | undefined)
    if (!track) return { commands: [], summary: "No drum track" }
    const pitch = resolveDrumPitch(args.drum as string | undefined)
    const loopSteps = stepsInLoop(doc.loopLengthTicks, track.grid)
    const steps = clamp(round(Number(args.steps ?? 8)), 1, Math.max(1, loopSteps || 16))
    const pulses = clamp(round(Number(args.pulses ?? Math.ceil(steps / 2))), 0, steps)
    const rotate = clamp(round(Number(args.rotate ?? 0)), 0, steps - 1)
    const indices = euclidIndices(pulses, steps, rotate)

    // Rebuild the lane: keep all OTHER pitches, replace this pitch's hits.
    const kept = track.notes.filter((n) => n.pitch !== pitch)
    const fresh: Omit<NoteEvent, "id">[] = indices
      .filter((s) => s < (loopSteps || steps))
      .map((s) => ({
        tick: tickForStep(s, track.grid),
        duration: Math.max(1, Math.round(tickForStep(1, track.grid) / 2)),
        pitch,
        velocity: 0.7,
      }))
    const notes: Omit<NoteEvent, "id">[] = [
      ...kept.map(stripId),
      ...fresh,
    ].sort((a, b) => a.tick - b.tick)
    return {
      commands: [{ t: "setNotes", trackId: track.id, notes }],
      summary: `${pitchName(pitch)}: ${pulses} over ${steps}`,
    }
  },
}

/**
 * humanize — apply small, deterministic micro-timing + velocity variation to a
 * track's notes so a stiff grid breathes. Uses `editNote` per note (one undo).
 */
const humanize: ToolSpec = {
  name: "humanize",
  describe: "Loosen a track's timing + velocity slightly so it feels played, not programmed.",
  params: {
    amount: {
      type: "number",
      min: 0,
      max: 1,
      default: 0.4,
      describe: "How much to humanize, 0–1.",
    },
    trackId: { type: "enum", describe: "Optional explicit track id." },
  },
  build(args, doc, rng) {
    const track = resolveInstrumentTrack(doc, args.trackId as Id | undefined)
    if (!track) return { commands: [], summary: "No track" }
    const amount = clamp(Number(args.amount ?? 0.4), 0, 1)
    if (track.notes.length === 0) return { commands: [], summary: "Track is empty" }
    // Max micro offset ≈ ±1/24 note (snappy) scaled by amount.
    const maxMicro = Math.round((tickForStep(1, track.grid) / 4) * amount) || 1
    const commands: Command[] = []
    for (const n of track.notes) {
      const micro = Math.round((rng() * 2 - 1) * maxMicro)
      const velJitter = (rng() * 2 - 1) * 0.2 * amount
      const velocity = clamp(n.velocity + velJitter, 0.05, 1)
      commands.push({
        t: "editNote",
        trackId: track.id,
        noteId: n.id,
        patch: { micro, velocity },
      })
    }
    return {
      commands: wrapBatch(commands, "Humanize"),
      summary: `Humanized ${track.notes.length} notes`,
    }
  },
}

/**
 * setMood — a curated, opinionated bundle: tempo + swing + a density tweak per
 * mood. The most "natural language" tool: "make it dreamy", "latin feel",
 * "darker". Deterministic; never empty.
 */
type MoodName = "chill" | "hype" | "dark" | "dreamy" | "latin" | "lofi"

interface MoodRecipe {
  bpm: number
  swing: number
  /** Per-lane density nudge applied after tempo/swing. */
  density?: { drum: keyof typeof DRUM_PITCH; dir: "more" | "less"; amount: number }
  label: string
}

const MOODS: Record<MoodName, MoodRecipe> = {
  chill: { bpm: 84, swing: 0.18, density: { drum: "hat", dir: "less", amount: 2 }, label: "chill" },
  hype: { bpm: 140, swing: 0.0, density: { drum: "hat", dir: "more", amount: 4 }, label: "hype" },
  dark: { bpm: 92, swing: 0.0, density: { drum: "kick", dir: "more", amount: 2 }, label: "dark" },
  dreamy: { bpm: 76, swing: 0.3, density: { drum: "hat", dir: "less", amount: 3 }, label: "dreamy" },
  latin: { bpm: 102, swing: 0.12, density: { drum: "clap", dir: "more", amount: 3 }, label: "latin" },
  lofi: { bpm: 72, swing: 0.34, density: { drum: "hat", dir: "more", amount: 2 }, label: "lo-fi" },
}

export const MOOD_NAMES = Object.keys(MOODS) as MoodName[]

const setMood: ToolSpec = {
  name: "setMood",
  describe:
    "Apply a vibe bundle (tempo + swing + a drum tweak): chill, hype, dark, dreamy, latin, lofi.",
  params: {
    mood: {
      type: "enum",
      options: MOOD_NAMES,
      required: true,
      describe: "One of: chill, hype, dark, dreamy, latin, lofi.",
    },
  },
  build(args, doc, rng) {
    const raw = String(args.mood ?? "").toLowerCase()
    const mood = (MOOD_NAMES.includes(raw as MoodName) ? raw : "chill") as MoodName
    const recipe = MOODS[mood]
    const commands: Command[] = [
      { t: "setTempo", bpm: clamp(recipe.bpm, 40, 220) },
      { t: "setSwing", amount: clamp(recipe.swing, 0, 0.66) },
    ]
    if (recipe.density) {
      const d = density.build(
        { dir: recipe.density.dir, drum: recipe.density.drum, amount: recipe.density.amount },
        doc,
        rng,
      )
      // density returns a (possibly batched) command list; unwrap one batch level.
      for (const c of d.commands) {
        if (c.t === "batch") commands.push(...c.commands)
        else commands.push(c)
      }
    }
    return {
      commands: [{ t: "batch", commands, label: `Mood: ${recipe.label}` }],
      summary: `Mood → ${recipe.label}`,
    }
  },
}

// ----------------------------------------------------------------- modulation
/**
 * vibe — set an AUTONOMOUS modulation agent loose so the loop evolves itself,
 * or "calm" to clear all tweakers. The headline of Wave 3: "make it breathe",
 * "let it evolve", "go chaotic". Reuses the shared agent presets so the LLM and
 * the Tweakers UI spawn identical modulators.
 */
const VIBE_NAMES = [...AGENT_NAMES, "calm"] as const

const vibe: ToolSpec = {
  name: "vibe",
  describe:
    "Set an autonomous knob-tweaker agent loose so the loop evolves itself (breathe, drift, chaos, evolve, pulse) — or 'calm' to clear all tweakers.",
  params: {
    name: {
      type: "enum",
      options: VIBE_NAMES,
      default: "evolve",
      required: true,
      describe: "One of: breathe, drift, chaos, evolve, pulse, calm.",
    },
  },
  build(args, doc) {
    const raw = String(args.name ?? "evolve").toLowerCase()
    if (raw === "calm") {
      const n = (doc.modulators ?? []).length
      return {
        commands: n ? [{ t: "clearModulators" }] : [],
        summary: n ? "Calmed (cleared tweakers)" : "Already calm",
      }
    }
    const name = (AGENT_NAMES.includes(raw as AgentName) ? raw : "evolve") as AgentName
    const commands = agentCommands(name, doc)
    return {
      commands,
      summary: commands.length
        ? `${AGENT_META[name].label} — ${commands.length} tweaker${commands.length === 1 ? "" : "s"}`
        : "Nothing to modulate",
    }
  },
}

/**
 * automate — add ONE autonomous modulator to a sensible target. Defaults to a
 * slow sine on the master volume; `target` ("master"|"pan"|"filter"|"volume")
 * picks a doc-resolved param. The catch-all single-knob version of `vibe`.
 */
type AutomateTarget = "master" | "volume" | "pan" | "filter"

const resolveAutomateTarget = (which: AutomateTarget, doc: BeatloungeDoc): ParamTarget | undefined => {
  const inst = doc.tracks.find(isInstrumentTrack)
  switch (which) {
    case "master":
      return { scope: "master", param: "volume" }
    case "volume":
      return inst ? { scope: "track", trackId: inst.id, param: "volume" } : { scope: "master", param: "volume" }
    case "pan":
      return inst ? { scope: "track", trackId: inst.id, param: "pan" } : undefined
    case "filter": {
      for (const track of doc.tracks) {
        const fx = track.inserts.find((i) => i.kind === "filter")
        if (fx) return { scope: "insert", trackId: track.id, insertId: fx.id, param: "frequency" }
      }
      // No filter insert → sweep a track pan instead so the intent isn't lost.
      return inst ? { scope: "track", trackId: inst.id, param: "pan" } : undefined
    }
    default:
      return { scope: "master", param: "volume" }
  }
}

const automate: ToolSpec = {
  name: "automate",
  describe:
    "Add one autonomous tweaker to a param. target: master, volume, pan, or filter. shape + depth optional.",
  params: {
    target: {
      type: "enum",
      options: ["master", "volume", "pan", "filter"],
      default: "master",
      describe: "Which param to drive.",
    },
    shape: {
      type: "enum",
      options: ["sine", "triangle", "saw", "square", "random", "drift"],
      default: "sine",
      describe: "Modulation shape.",
    },
    depth: { type: "number", min: 0, max: 1, default: 0.4, describe: "Swing amount 0–1." },
  },
  build(args, doc) {
    const which = (["master", "volume", "pan", "filter"].includes(String(args.target))
      ? String(args.target)
      : "master") as AutomateTarget
    const target = resolveAutomateTarget(which, doc)
    if (!target) return { commands: [], summary: "No param to automate" }
    const shape = (
      ["sine", "triangle", "saw", "square", "random", "drift"].includes(String(args.shape))
        ? String(args.shape)
        : "sine"
    ) as "sine" | "triangle" | "saw" | "square" | "random" | "drift"
    const depth = clamp(Number(args.depth ?? 0.4), 0, 1)
    const center = target.scope === "track" && target.param === "pan" ? 0.5 : 0.75
    const modulator = createModulator(target, { shape, depth, center, syncBeats: 8 })
    return { commands: [{ t: "addModulator", modulator }], summary: `Automating ${which}` }
  },
}

/** chaos — spawn the chaos agent, scaled up by `amount`. "go wild". */
const chaosTool: ToolSpec = {
  name: "chaos",
  describe: "Spawn fast random tweakers across effects and sends. amount scales the intensity (0.25–3).",
  params: {
    amount: { type: "number", min: 0.25, max: 3, default: 1, describe: "Intensity, 0.25–3." },
  },
  build(args, doc) {
    const amount = clamp(Number(args.amount ?? 1), 0.25, 3)
    const commands = chaosCommands(doc, amount)
    return { commands, summary: commands.length ? `Chaos × ${amount}` : "Nothing to modulate" }
  },
}

// ----------------------------------------------------------------- jam (harmony)
/**
 * The musical "feels" the composer offers + the keys/modes the model picks from.
 * All CLOSED sets so the 4B model only ever selects a label; the deterministic
 * composer (music/jam.ts) does the actual music.
 */
export const JAM_FEELS: readonly JamFeel[] = ["melody", "arp", "chords", "bass"]
export const JAM_MODES: readonly ScaleName[] = SCALE_NAMES
export const JAM_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const

/** The first non-drum instrument track (the synth the composer writes onto). */
export const resolveSynthTrack = (doc: BeatloungeDoc, trackId?: Id) => {
  if (trackId) {
    const t = findTrack(doc, trackId)
    if (t && isInstrumentTrack(t)) return t
  }
  const synth = doc.tracks.find(
    (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler",
  )
  if (synth && isInstrumentTrack(synth)) return synth
  // Fall back to any instrument track (never the drum track if avoidable).
  const any = doc.tracks.find(isInstrumentTrack)
  return any && isInstrumentTrack(any) ? any : undefined
}

/** Resolve a key name / note name to a pitch class (default C = 0). */
const resolveKeyPc = (raw: unknown): number => {
  const pc = parseNoteName(String(raw ?? "C"))
  return pc == null ? 0 : pc
}

/** Resolve a mode/scale label to a ScaleName (default major). */
const resolveMode = (raw: unknown): ScaleName => {
  const s = String(raw ?? "major")
  return (SCALE_NAMES.includes(s as ScaleName) ? s : "major") as ScaleName
}

/** A default template that suits a mode when the model gives none. */
const DEFAULT_TEMPLATE_FOR_MODE: Partial<Record<ScaleName, string>> = {
  major: "pop",
  minor: "epic",
  dorian: "vamp",
  phrygian: "andalusian",
  mixolydian: "blues",
  lydian: "pop",
  harmonicMinor: "epic",
  melodicMinor: "sad",
}

/**
 * Write a composed jam onto the synth track + size the loop to the progression.
 * Shared by the `jam` and `progression` tools so both paths are identical.
 */
const composeOntoSynth = (
  trackId: Id,
  templateName: string,
  keyPc: number,
  mode: ScaleName,
  feel: JamFeel,
  density: number,
  seed: number,
): { commands: Command[]; noteCount: number; loopTicks: number } => {
  const prog = renderTemplate(templateName, keyPc, mode)
  const register = feel === "bass" ? 48 : feel === "chords" ? 57 : 62
  const notes = composeJam(prog, { feel, density, register, seed, velocity: 0.72 })
  const loopTicks = progressionTicks(prog)
  const commands: Command[] = [
    { t: "setLoopLength", ticks: loopTicks },
    { t: "setNotes", trackId, notes },
  ]
  return { commands, noteCount: notes.length, loopTicks }
}

/**
 * jam — the headline harmony tool. Compose a directed, non-repetitive part in a
 * key + mode + feel over a named chord template, written onto the synth track.
 * The 4B model picks labels; the deterministic composer does the music.
 */
const jamTool: ToolSpec = {
  name: "jam",
  describe:
    "Compose a musical part on the synth in a key + mode + feel over a chord progression. feel: melody, arp, chords, bass.",
  params: {
    key: {
      type: "enum",
      options: JAM_KEYS,
      default: "C",
      describe: "Tonic key, e.g. C, G, Eb, F#.",
    },
    mode: {
      type: "enum",
      options: JAM_MODES,
      default: "major",
      describe: "Scale/mode: major, minor, dorian, mixolydian, …",
    },
    feel: {
      type: "enum",
      options: JAM_FEELS,
      default: "melody",
      describe: "What to play: melody, arp, chords, or bass.",
    },
    template: {
      type: "enum",
      options: TEMPLATE_NAMES,
      describe: "Optional named progression: pop, jazz, blues, epic, sad, …",
    },
    density: { type: "number", min: 0, max: 1, default: 0.55, describe: "How busy, 0–1." },
    trackId: { type: "enum", describe: "Optional explicit synth track id." },
  },
  build(args, doc, rng) {
    const track = resolveSynthTrack(doc, args.trackId as Id | undefined)
    if (!track) return { commands: [], summary: "No synth track" }
    const keyPc = resolveKeyPc(args.key)
    const mode = resolveMode(args.mode)
    const feel = (JAM_FEELS.includes(String(args.feel) as JamFeel)
      ? String(args.feel)
      : "melody") as JamFeel
    const template =
      typeof args.template === "string" && TEMPLATE_NAMES.includes(args.template)
        ? args.template
        : DEFAULT_TEMPLATE_FOR_MODE[mode] ?? "pop"
    const density = clamp(Number(args.density ?? 0.55), 0, 1)
    const seed = Math.floor(rng() * 0xffffffff)
    const { commands, noteCount } = composeOntoSynth(
      track.id, template, keyPc, mode, feel, density, seed,
    )
    const keyName = JAM_KEYS[keyPc] ?? "C"
    return {
      commands,
      summary: noteCount
        ? `Jam · ${keyName} ${mode} ${feel} (${noteCount} notes)`
        : "Nothing to jam",
    }
  },
}

/**
 * progression — lay a NAMED chord progression in a key/mode and jam a part over
 * it. The "give me a sad / epic / jazz progression" intent. Delegates to the
 * same composer as `jam`; defaults the feel to a tasteful melody.
 */
const progressionTool: ToolSpec = {
  name: "progression",
  describe:
    "Lay a named chord progression (pop, jazz, blues, epic, sad, doowop, vamp, andalusian, canon…) in a key/mode and play over it.",
  params: {
    template: {
      type: "enum",
      options: TEMPLATE_NAMES,
      default: "pop",
      required: true,
      describe: "Named progression: pop, jazz, blues, epic, sad, …",
    },
    key: { type: "enum", options: JAM_KEYS, default: "C", describe: "Tonic key." },
    mode: { type: "enum", options: JAM_MODES, default: "major", describe: "Scale/mode." },
    feel: {
      type: "enum",
      options: JAM_FEELS,
      default: "melody",
      describe: "What to play over it.",
    },
  },
  build(args, doc, rng) {
    const track = resolveSynthTrack(doc)
    if (!track) return { commands: [], summary: "No synth track" }
    const template =
      typeof args.template === "string" && TEMPLATE_NAMES.includes(args.template)
        ? args.template
        : "pop"
    const keyPc = resolveKeyPc(args.key)
    const mode = resolveMode(args.mode)
    const feel = (JAM_FEELS.includes(String(args.feel) as JamFeel)
      ? String(args.feel)
      : "melody") as JamFeel
    const seed = Math.floor(rng() * 0xffffffff)
    const { commands, noteCount } = composeOntoSynth(
      track.id, template, keyPc, mode, feel, 0.5, seed,
    )
    return {
      commands,
      summary: noteCount ? `${template} progression · ${JAM_KEYS[keyPc]} ${mode}` : "Nothing to lay",
    }
  },
}

/** calm — clear every autonomous tweaker (the explicit "stop tweaking"). */
const calm: ToolSpec = {
  name: "calm",
  describe: "Clear every autonomous tweaker — back to a still loop.",
  params: {},
  build(_args, doc) {
    const n = (doc.modulators ?? []).length
    return {
      commands: n ? [{ t: "clearModulators" }] : [],
      summary: n ? `Cleared ${n} tweaker${n === 1 ? "" : "s"}` : "Already calm",
    }
  },
}

// ----------------------------------------------------------------- internals
const stripId = (n: NoteEvent): Omit<NoteEvent, "id"> => {
  const { id: _id, ...rest } = n
  void _id
  return rest
}

/** In-place Fisher–Yates using a deterministic rng. */
function shuffle<T>(arr: T[], rng: Rng): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = arr[i]
    arr[i] = arr[j]
    arr[j] = t
  }
}

/** Wrap >1 command in one batch (a single undo step); pass-through otherwise. */
const wrapBatch = (commands: Command[], label: string): Command[] =>
  commands.length > 1 ? [{ t: "batch", commands, label }] : commands

const pitchName = (pitch: number): string => {
  for (const [name, p] of Object.entries(DRUM_PITCH)) if (p === pitch) return name
  return "hits"
}

// ----------------------------------------------------------------- catalog
export const TOOL_SPECS: ToolSpec[] = [
  setTempo,
  setSwing,
  density,
  setMood,
  euclidTool,
  humanize,
  jamTool,
  progressionTool,
  vibe,
  automate,
  chaosTool,
  calm,
]

export const TOOL_BY_NAME: Record<string, ToolSpec> = Object.fromEntries(
  TOOL_SPECS.map((t) => [t.name, t]),
)

export const isToolName = (name: string): boolean => name in TOOL_BY_NAME
