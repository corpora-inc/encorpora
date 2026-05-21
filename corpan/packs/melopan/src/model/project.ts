export type SkinId = "earthgate" | "stargate" | "hover-runner"

export type DrumTrackId = "kick" | "snare" | "hat" | "voice"

export type DrumTrack = {
  id: DrumTrackId
  name: string
  emoji: string
  volume: number       // 0..1
  mute: boolean
  steps: boolean[]     // length = pattern.lengthSteps (16 for now)
}

export type VoicePadConfig = {
  /** Currently selected voice ("amr" | "karina" | "august" | etc.) */
  voice: string
  /** "ahh" | "mountain" | etc. — null means use synth-vox fallback */
  word: string | null
  /** Pitch shift in semitones, -24..+24 */
  pitchSemis: number
}

/**
 * A monophonic synth (piano roll) track.
 * notes[step] is the MIDI note (e.g. 60 for C4) playing at that step,
 * or null for a rest.
 */
export type SynthTrack = {
  id: "synth"
  name: string
  volume: number
  mute: boolean
  /** length = lengthSteps */
  notes: (number | null)[]
}

export type Project = {
  schema: 1
  id: string
  name: string
  bpm: number
  timeSignature: [number, number]
  masterVolume: number
  lengthSteps: number   // 16 for now
  swing: number          // 0..1, default 0
  tracks: DrumTrack[]
  synth: SynthTrack
  voicePad: VoicePadConfig
  skin: SkinId
  createdAt: number
  updatedAt: number
}

const emptyBool = (n: number) => Array.from({ length: n }, () => false)
const emptyNotes = (n: number): (number | null)[] => Array.from({ length: n }, () => null)

/** C major octave (white keys), MIDI numbers. Used by the piano roll. */
export const PIANO_ROLL_PITCHES = [72, 71, 69, 67, 65, 64, 62, 60] // C5, B4, A4, G4, F4, E4, D4, C4 (top → bottom)
export const PIANO_ROLL_PITCH_LABELS = ["C5", "B4", "A4", "G4", "F4", "E4", "D4", "C4"]

export const createDefaultProject = (): Project => {
  const length = 16
  const kick = emptyBool(length)
  const snare = emptyBool(length)
  const hat = emptyBool(length)
  const voice = emptyBool(length)
  const notes = emptyNotes(length)

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
  // Voice on downbeat
  voice[0] = true

  // A simple intro melody — C E G C' on quarter notes, scattered
  notes[0] = 60   // C4
  notes[4] = 64   // E4
  notes[8] = 67   // G4
  notes[12] = 72  // C5

  const now = Date.now()
  return {
    schema: 1,
    id: "default",
    name: "First Song",
    bpm: 96,
    timeSignature: [4, 4],
    masterVolume: 0.8,
    lengthSteps: length,
    swing: 0,
    tracks: [
      { id: "kick",  name: "Kick",  emoji: "•", volume: 0.85, mute: false, steps: kick },
      { id: "snare", name: "Snare", emoji: "○", volume: 0.75, mute: false, steps: snare },
      { id: "hat",   name: "Hat",   emoji: "×", volume: 0.55, mute: false, steps: hat },
      { id: "voice", name: "Voice", emoji: "~", volume: 0.80, mute: false, steps: voice },
    ],
    synth: {
      id: "synth",
      name: "Synth",
      volume: 0.70,
      mute: false,
      notes,
    },
    voicePad: { voice: "flo", word: "letsgo", pitchSemis: 0 },
    skin: "earthgate",
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * The actual voice kit shipped in v0.1.0 — multilingual "let's go" hits
 * harvested from existing corpan voice renders. Each sample is a single
 * vocal word in a specific language, by one of the corpan voice clones.
 *
 * Extend by dropping more samples into public/voice-kit/{voice}/{word}.ogg
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
  { voice: "flo",    word: "letsgo", language: "en", gloss: "let's go",      file: "flo/letsgo.ogg", category: "action" },
  { voice: "flo",    word: "vamos",  language: "es", gloss: "let's go",      file: "flo/vamos.ogg",  category: "action" },
  { voice: "ian",    word: "vamos",  language: "es", gloss: "let's go",      file: "ian/vamos.ogg",  category: "action" },
  { voice: "flo",    word: "dale",   language: "es", gloss: "go for it",     file: "flo/dale.ogg",   category: "action" },
  { voice: "ian",    word: "dale",   language: "es", gloss: "go for it",     file: "ian/dale.ogg",   category: "action" },
  { voice: "flo",    word: "bora",   language: "pt", gloss: "let's go",      file: "flo/bora.ogg",   category: "action" },
  { voice: "karina", word: "allez",  language: "fr", gloss: "go (come on)",  file: "karina/allez.ogg", category: "action" },
  { voice: "ian",    word: "los",    language: "de", gloss: "go",            file: "ian/los.ogg",    category: "action" },
  { voice: "flo",    word: "hup",    language: "nl", gloss: "come on",       file: "flo/hup.ogg",    category: "action" },
  { voice: "flo",    word: "heia",   language: "no", gloss: "cheer",         file: "flo/heia.ogg",   category: "action" },
  { voice: "ian",    word: "twende", language: "sw", gloss: "let's go",      file: "ian/twende.ogg", category: "action" },
  { voice: "amr",    word: "yalla",  language: "ar", gloss: "let's go",      file: "amr/yalla.ogg",  category: "action" },
  { voice: "amr",    word: "hadi",   language: "ar", gloss: "come on",       file: "amr/hadi.ogg",   category: "action" },
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
