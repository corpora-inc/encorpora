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
import type { BeatloungeDoc, Id, NoteEvent } from "../model/document"
import { DRUM_PITCH, findTrack, isInstrumentTrack } from "../model/document"
import { stepsInLoop, tickForStep } from "../model/timing"
import { euclidIndices } from "../music/euclid"

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
]

export const TOOL_BY_NAME: Record<string, ToolSpec> = Object.fromEntries(
  TOOL_SPECS.map((t) => [t.name, t]),
)

export const isToolName = (name: string): boolean => name in TOOL_BY_NAME
