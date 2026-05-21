export type SkinId = "earthgate" | "stargate" | "hover-runner"

export type DrumTrackId = "kick" | "snare" | "hat"
export type VoiceTrackId = "voice1" | "voice2"
export type TrackId = DrumTrackId | VoiceTrackId

export type DrumTrack = {
  kind: "drum"
  id: DrumTrackId
  name: string
  emoji: string
  volume: number       // 0..1
  mute: boolean
  steps: boolean[]     // length = project.lengthSteps
}

export type VoiceTrack = {
  kind: "voice"
  id: VoiceTrackId
  name: string
  emoji: string
  volume: number
  mute: boolean
  steps: boolean[]
  // Each voice track carries its own sample + pitch so multiple voices
  // can layer in the sequencer.
  voice: string         // VoiceId
  word: string | null   // null = synth-vox fallback
  pitchSemis: number    // -24..+24
}

export type Track = DrumTrack | VoiceTrack

export const isVoiceTrack = (t: Track): t is VoiceTrack => t.kind === "voice"
export const isDrumTrack = (t: Track): t is DrumTrack => t.kind === "drum"

/**
 * A monophonic synth (piano roll) track.
 * notes[step] is the MIDI note (e.g. 60 for C4) at that step, or null.
 * accidentals[rowIdx] shifts the row's base pitch by -1/0/+1 semitones
 * so players can break out of strict C-major diatonic.
 */
export type SynthTrack = {
  id: "synth"
  name: string
  volume: number
  mute: boolean
  notes: (number | null)[]
  accidentals: number[]  // length = PIANO_ROLL_PITCHES.length
}

export type LayoutHeights = {
  stepGridPx?: number
  pianoRollPx?: number
  voicePadPx?: number
}

export type Project = {
  schema: 2
  id: string
  name: string
  bpm: number
  timeSignature: [number, number]
  masterVolume: number
  lengthSteps: number
  swing: number
  tracks: Track[]      // drum tracks + voice tracks, rendered in order
  synth: SynthTrack
  skin: SkinId
  layout?: LayoutHeights
  createdAt: number
  updatedAt: number
}

const emptyBool = (n: number) => Array.from({ length: n }, () => false)
const emptyNotes = (n: number): (number | null)[] => Array.from({ length: n }, () => null)

/**
 * Steps per bar at 16th-note resolution:
 *  - x/4  → x * 4   (4 sixteenths per quarter)
 *  - x/8  → x * 2   (2 sixteenths per eighth)
 * 3/4=12, 4/4=16, 5/4=20, 6/8=12, 7/8=14, 9/8=18, 11/8=22, 13/8=26.
 */
export const stepsForTimeSignature = (top: number, bottom: number): number => {
  if (bottom === 4) return top * 4
  if (bottom === 8) return top * 2
  return 16
}

const MAX_STEP_COUNT = 96

/**
 * STEPS-picker options for a given time signature. The base count is the
 * standard 16th-note resolution; doubling and quadrupling give 32nd and
 * 64th note subdivisions. Capped at 96 cells to keep individual cells
 * tappable on phone screens.
 */
export const availableStepCounts = (top: number, bottom: number): number[] => {
  const base = stepsForTimeSignature(top, bottom)
  const out = [base]
  if (base * 2 <= MAX_STEP_COUNT) out.push(base * 2)
  if (base * 4 <= MAX_STEP_COUNT) out.push(base * 4)
  return out
}

/**
 * Tone.js Loop interval string for the given step count + signature.
 * Step counts are always 1× / 2× / 4× the base, so the result is one
 * of "16n" / "32n" / "64n" — standard subdivisions Tone parses cleanly.
 */
export const intervalForSteps = (
  top: number,
  bottom: number,
  lengthSteps: number
): string => {
  const base = stepsForTimeSignature(top, bottom)
  const m = Math.max(1, Math.round(lengthSteps / base))
  // 16 * 1=16n, 16 * 2=32n, 16 * 4=64n
  return `${16 * m}n`
}

export const resizeBoolSteps = (arr: boolean[], newLen: number): boolean[] => {
  if (newLen === arr.length) return arr
  if (newLen > arr.length) return [...arr, ...Array(newLen - arr.length).fill(false)]
  return arr.slice(0, newLen)
}

export const resizeNoteSteps = (
  arr: (number | null)[],
  newLen: number
): (number | null)[] => {
  if (newLen === arr.length) return arr
  if (newLen > arr.length) return [...arr, ...Array(newLen - arr.length).fill(null)]
  return arr.slice(0, newLen)
}

/** C major octave (white keys), MIDI numbers. Used by the piano roll. */
export const PIANO_ROLL_PITCHES = [72, 71, 69, 67, 65, 64, 62, 60] // C5, B4, A4, G4, F4, E4, D4, C4 (top → bottom)
export const PIANO_ROLL_PITCH_LABELS = ["C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4"]

/** Effective MIDI for a piano roll row, given the accidental at that row. */
export const effectivePitch = (rowIdx: number, accidentals: number[]): number => {
  const base = PIANO_ROLL_PITCHES[rowIdx] ?? 60
  const acc = accidentals[rowIdx] ?? 0
  return base + acc
}

export const createDefaultProject = (): Project => {
  const length = 16
  const kick = emptyBool(length)
  const snare = emptyBool(length)
  const hat = emptyBool(length)
  const voice1Steps = emptyBool(length)
  const voice2Steps = emptyBool(length)
  const notes = emptyNotes(length)
  const accidentals = Array(PIANO_ROLL_PITCHES.length).fill(0)

  // Four-on-the-floor kick
  kick[0] = true
  kick[4] = true
  kick[8] = true
  kick[12] = true
  // Backbeat snare
  snare[4] = true
  snare[12] = true
  // Eighths hat
  for (let i = 0; i < length; i += 2) hat[i] = true
  // Voice 1 on downbeat
  voice1Steps[0] = true

  // A simple intro melody — C E G C' on quarter notes
  notes[0] = 60   // C4
  notes[4] = 64   // E4
  notes[8] = 67   // G4
  notes[12] = 72  // C5

  const now = Date.now()
  const tracks: Track[] = [
    { kind: "drum", id: "kick",  name: "Kick",  emoji: "•", volume: 0.85, mute: false, steps: kick },
    { kind: "drum", id: "snare", name: "Snare", emoji: "○", volume: 0.75, mute: false, steps: snare },
    { kind: "drum", id: "hat",   name: "Hat",   emoji: "×", volume: 0.55, mute: false, steps: hat },
    {
      kind: "voice", id: "voice1", name: "Voice 1", emoji: "~",
      volume: 0.80, mute: false, steps: voice1Steps,
      voice: "flo", word: "letsgo", pitchSemis: 0,
    },
    {
      kind: "voice", id: "voice2", name: "Voice 2", emoji: "≈",
      volume: 0.70, mute: false, steps: voice2Steps,
      voice: "ian", word: null, pitchSemis: -3,
    },
  ]

  return {
    schema: 2,
    id: "default",
    name: "First Song",
    bpm: 96,
    timeSignature: [4, 4],
    masterVolume: 0.8,
    lengthSteps: length,
    swing: 0,
    tracks,
    synth: { id: "synth", name: "Synth", volume: 0.70, mute: false, notes, accidentals },
    skin: "earthgate",
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Migrate a persisted schema-1 project (single voicePad + tracks: kick/snare/hat/voice)
 * to schema 2 (kick/snare/hat + voice1/voice2 with embedded voice config, plus
 * synth.accidentals).
 * Unknown / malformed input returns `null` so the caller can fall back to defaults.
 */
export const migrateSchema1To2 = (raw: unknown): Project | null => {
  if (!raw || typeof raw !== "object") return null
  const old = raw as Record<string, unknown>
  if (old.schema !== 1) return null
  try {
    const oldTracks = Array.isArray(old.tracks) ? (old.tracks as Record<string, unknown>[]) : []
    const len =
      typeof old.lengthSteps === "number" && old.lengthSteps > 0 ? old.lengthSteps : 16

    const drumOf = (id: DrumTrackId, fallback: { name: string; emoji: string; volume: number }): DrumTrack => {
      const t = oldTracks.find((x) => x.id === id) ?? {}
      return {
        kind: "drum",
        id,
        name: (t.name as string) ?? fallback.name,
        emoji: (t.emoji as string) ?? fallback.emoji,
        volume: typeof t.volume === "number" ? t.volume : fallback.volume,
        mute: t.mute === true,
        steps: Array.isArray(t.steps) ? resizeBoolSteps(t.steps as boolean[], len) : emptyBool(len),
      }
    }

    const oldVoice = oldTracks.find((x) => x.id === "voice") ?? {}
    const oldVoicePad = (old.voicePad as Record<string, unknown> | undefined) ?? {}

    const voice1: VoiceTrack = {
      kind: "voice",
      id: "voice1",
      name: "Voice 1",
      emoji: "~",
      volume: typeof oldVoice.volume === "number" ? oldVoice.volume : 0.8,
      mute: oldVoice.mute === true,
      steps: Array.isArray(oldVoice.steps) ? resizeBoolSteps(oldVoice.steps as boolean[], len) : emptyBool(len),
      voice: typeof oldVoicePad.voice === "string" ? oldVoicePad.voice : "flo",
      word: typeof oldVoicePad.word === "string" ? oldVoicePad.word : null,
      pitchSemis: typeof oldVoicePad.pitchSemis === "number" ? oldVoicePad.pitchSemis : 0,
    }

    const voice2: VoiceTrack = {
      kind: "voice",
      id: "voice2",
      name: "Voice 2",
      emoji: "≈",
      volume: 0.7,
      mute: false,
      steps: emptyBool(len),
      voice: "ian",
      word: null,
      pitchSemis: -3,
    }

    const oldSynth = (old.synth as Record<string, unknown> | undefined) ?? {}
    const synthNotes = Array.isArray(oldSynth.notes)
      ? resizeNoteSteps(oldSynth.notes as (number | null)[], len)
      : emptyNotes(len)

    return {
      schema: 2,
      id: typeof old.id === "string" ? old.id : "default",
      name: typeof old.name === "string" ? old.name : "First Song",
      bpm: typeof old.bpm === "number" ? old.bpm : 96,
      timeSignature: Array.isArray(old.timeSignature) ? (old.timeSignature as [number, number]) : [4, 4],
      masterVolume: typeof old.masterVolume === "number" ? old.masterVolume : 0.8,
      lengthSteps: len,
      swing: typeof old.swing === "number" ? old.swing : 0,
      tracks: [
        drumOf("kick",  { name: "Kick",  emoji: "•", volume: 0.85 }),
        drumOf("snare", { name: "Snare", emoji: "○", volume: 0.75 }),
        drumOf("hat",   { name: "Hat",   emoji: "×", volume: 0.55 }),
        voice1,
        voice2,
      ],
      synth: {
        id: "synth",
        name: typeof oldSynth.name === "string" ? oldSynth.name : "Synth",
        volume: typeof oldSynth.volume === "number" ? oldSynth.volume : 0.7,
        mute: oldSynth.mute === true,
        notes: synthNotes,
        accidentals: Array(PIANO_ROLL_PITCHES.length).fill(0),
      },
      skin: (old.skin as SkinId) ?? "earthgate",
      createdAt: typeof old.createdAt === "number" ? old.createdAt : Date.now(),
      updatedAt: Date.now(),
    }
  } catch (err) {
    console.warn("[melopan] migrateSchema1To2 failed:", err)
    return null
  }
}

/**
 * The actual voice kit shipped — multilingual "let's go" hits harvested
 * from existing corpan voice renders.
 *
 * Extend by dropping more samples into public/voice-kit/{voice}/{word}.wav
 * and adding rows here.
 */
export type KitSample = {
  voice: VoiceId
  /** Display word, e.g. "vamos" — also used as the file name */
  word: string
  /** ISO 639-1 language code */
  language: string
  /** Optional gloss / translation in English */
  gloss?: string
  /** Path relative to public/voice-kit/ */
  file: string
  /** Group in the sample browser */
  category: string
}

export const KIT_SAMPLES: readonly KitSample[] = [
  { voice: "flo",    word: "letsgo", language: "en", gloss: "let's go",      file: "flo/letsgo.wav", category: "action" },
  { voice: "flo",    word: "vamos",  language: "es", gloss: "let's go",      file: "flo/vamos.wav",  category: "action" },
  { voice: "ian",    word: "vamos",  language: "es", gloss: "let's go",      file: "ian/vamos.wav",  category: "action" },
  { voice: "flo",    word: "dale",   language: "es", gloss: "go for it",     file: "flo/dale.wav",   category: "action" },
  { voice: "ian",    word: "dale",   language: "es", gloss: "go for it",     file: "ian/dale.wav",   category: "action" },
  { voice: "flo",    word: "bora",   language: "pt", gloss: "let's go",      file: "flo/bora.wav",   category: "action" },
  { voice: "karina", word: "allez",  language: "fr", gloss: "go (come on)",  file: "karina/allez.wav", category: "action" },
  { voice: "ian",    word: "los",    language: "de", gloss: "go",            file: "ian/los.wav",    category: "action" },
  { voice: "flo",    word: "hup",    language: "nl", gloss: "come on",       file: "flo/hup.wav",    category: "action" },
  { voice: "flo",    word: "heia",   language: "no", gloss: "cheer",         file: "flo/heia.wav",   category: "action" },
  { voice: "ian",    word: "twende", language: "sw", gloss: "let's go",      file: "ian/twende.wav", category: "action" },
  { voice: "amr",    word: "yalla",  language: "ar", gloss: "let's go",      file: "amr/yalla.wav",  category: "action" },
  { voice: "amr",    word: "hadi",   language: "ar", gloss: "come on",       file: "amr/hadi.wav",   category: "action" },
] as const

export const KIT_CATEGORIES: { id: string; label: string }[] = [
  { id: "action", label: "Let's go (multilingual)" },
]

/** Convenience: words available for a given voice. */
export const wordsForVoice = (voice: string): KitSample[] =>
  KIT_SAMPLES.filter((s) => s.voice === voice)

/** Convenience: lookup a single sample by (voice, word). */
export const findSample = (voice: string, word: string | null): KitSample | undefined => {
  if (!word) return undefined
  return KIT_SAMPLES.find((s) => s.voice === voice && s.word === word)
}

export type VoiceId =
  | "amr"
  | "karina"
  | "august"
  | "kym"
  | "sky"
  | "victor"
  | "avery"
  | "isabelle"
  | "ryan"
  | "ian"
  | "flo"

export const VOICES: { id: VoiceId; name: string; subtitle?: string }[] = [
  { id: "flo",      name: "Flo",      subtitle: "english" },
  { id: "ian",      name: "Ian",      subtitle: "chill clear" },
  { id: "august",   name: "August",   subtitle: "20s clean" },
  { id: "kym",      name: "Kym",      subtitle: "40s news" },
  { id: "sky",      name: "Sky",      subtitle: "design" },
  { id: "victor",   name: "Victor",   subtitle: "business" },
  { id: "amr",      name: "Amr",      subtitle: "syria" },
  { id: "karina",   name: "Karina",   subtitle: "quebec" },
  { id: "avery",    name: "Avery",    subtitle: "cheer" },
  { id: "isabelle", name: "Isabelle", subtitle: "gymnastic" },
  { id: "ryan",     name: "Ryan",     subtitle: "baseball" },
]
