/**
 * beatlounge — General-MIDI program data.
 *
 * The full GM Level 1 melodic program set (128 patches, program 0..127) grouped
 * into the 16 canonical families, plus the 8 standard percussion KIT presets on
 * bank 128 (GM drum bank). This is PURE data — the instrument-browser UI lets a
 * user pick a voice by name, and dispatches a `setInstrument` with the matching
 * `program` / `bank`. A SoundFont addresses voices by exactly these GM numbers,
 * so the names here line up with whatever GM-compatible SF2/SF3 is loaded.
 *
 * No emoji; ASCII names so they read on every device + the LLM tool surface.
 */

export interface GmProgram {
  /** GM program number, 0..127. */
  program: number
  /** Canonical GM instrument name. */
  name: string
}

export interface GmFamily {
  /** Stable id (used as a key + LLM token). */
  id: string
  /** Display label. */
  label: string
  /** Members in GM program order. */
  programs: GmProgram[]
}

/** The 128 GM Level-1 melodic instrument names, in program order (0-based). */
export const GM_PROGRAM_NAMES: readonly string[] = [
  // Piano (0-7)
  "Acoustic Grand Piano",
  "Bright Acoustic Piano",
  "Electric Grand Piano",
  "Honky-tonk Piano",
  "Electric Piano 1",
  "Electric Piano 2",
  "Harpsichord",
  "Clavinet",
  // Chromatic Percussion (8-15)
  "Celesta",
  "Glockenspiel",
  "Music Box",
  "Vibraphone",
  "Marimba",
  "Xylophone",
  "Tubular Bells",
  "Dulcimer",
  // Organ (16-23)
  "Drawbar Organ",
  "Percussive Organ",
  "Rock Organ",
  "Church Organ",
  "Reed Organ",
  "Accordion",
  "Harmonica",
  "Tango Accordion",
  // Guitar (24-31)
  "Acoustic Guitar (nylon)",
  "Acoustic Guitar (steel)",
  "Electric Guitar (jazz)",
  "Electric Guitar (clean)",
  "Electric Guitar (muted)",
  "Overdriven Guitar",
  "Distortion Guitar",
  "Guitar Harmonics",
  // Bass (32-39)
  "Acoustic Bass",
  "Electric Bass (finger)",
  "Electric Bass (pick)",
  "Fretless Bass",
  "Slap Bass 1",
  "Slap Bass 2",
  "Synth Bass 1",
  "Synth Bass 2",
  // Strings (40-47)
  "Violin",
  "Viola",
  "Cello",
  "Contrabass",
  "Tremolo Strings",
  "Pizzicato Strings",
  "Orchestral Harp",
  "Timpani",
  // Ensemble (48-55)
  "String Ensemble 1",
  "String Ensemble 2",
  "Synth Strings 1",
  "Synth Strings 2",
  "Choir Aahs",
  "Voice Oohs",
  "Synth Voice",
  "Orchestra Hit",
  // Brass (56-63)
  "Trumpet",
  "Trombone",
  "Tuba",
  "Muted Trumpet",
  "French Horn",
  "Brass Section",
  "Synth Brass 1",
  "Synth Brass 2",
  // Reed (64-71)
  "Soprano Sax",
  "Alto Sax",
  "Tenor Sax",
  "Baritone Sax",
  "Oboe",
  "English Horn",
  "Bassoon",
  "Clarinet",
  // Pipe (72-79)
  "Piccolo",
  "Flute",
  "Recorder",
  "Pan Flute",
  "Blown Bottle",
  "Shakuhachi",
  "Whistle",
  "Ocarina",
  // Synth Lead (80-87)
  "Lead 1 (square)",
  "Lead 2 (sawtooth)",
  "Lead 3 (calliope)",
  "Lead 4 (chiff)",
  "Lead 5 (charang)",
  "Lead 6 (voice)",
  "Lead 7 (fifths)",
  "Lead 8 (bass + lead)",
  // Synth Pad (88-95)
  "Pad 1 (new age)",
  "Pad 2 (warm)",
  "Pad 3 (polysynth)",
  "Pad 4 (choir)",
  "Pad 5 (bowed)",
  "Pad 6 (metallic)",
  "Pad 7 (halo)",
  "Pad 8 (sweep)",
  // Synth Effects (96-103)
  "FX 1 (rain)",
  "FX 2 (soundtrack)",
  "FX 3 (crystal)",
  "FX 4 (atmosphere)",
  "FX 5 (brightness)",
  "FX 6 (goblins)",
  "FX 7 (echoes)",
  "FX 8 (sci-fi)",
  // Ethnic (104-111)
  "Sitar",
  "Banjo",
  "Shamisen",
  "Koto",
  "Kalimba",
  "Bagpipe",
  "Fiddle",
  "Shanai",
  // Percussive (112-119)
  "Tinkle Bell",
  "Agogo",
  "Steel Drums",
  "Woodblock",
  "Taiko Drum",
  "Melodic Tom",
  "Synth Drum",
  "Reverse Cymbal",
  // Sound Effects (120-127)
  "Guitar Fret Noise",
  "Breath Noise",
  "Seashore",
  "Bird Tweet",
  "Telephone Ring",
  "Helicopter",
  "Applause",
  "Gunshot",
]

/** Family boundaries: [id, label, firstProgram] — each spans 8 GM programs. */
const FAMILY_DEFS: ReadonlyArray<readonly [string, string, number]> = [
  ["piano", "Piano", 0],
  ["chromatic", "Chromatic", 8],
  ["organ", "Organ", 16],
  ["guitar", "Guitar", 24],
  ["bass", "Bass", 32],
  ["strings", "Strings", 40],
  ["ensemble", "Ensemble", 48],
  ["brass", "Brass", 56],
  ["reed", "Reed", 64],
  ["pipe", "Pipe", 72],
  ["synth-lead", "Synth Lead", 80],
  ["synth-pad", "Synth Pad", 88],
  ["synth-fx", "Synth FX", 96],
  ["ethnic", "Ethnic", 104],
  ["percussive", "Percussive", 112],
  ["sound-fx", "Sound FX", 120],
]

/** The 16 GM families, each holding its 8 programs in order. */
export const GM_FAMILIES: readonly GmFamily[] = FAMILY_DEFS.map(([id, label, start]) => ({
  id,
  label,
  programs: Array.from({ length: 8 }, (_, i) => ({
    program: start + i,
    name: GM_PROGRAM_NAMES[start + i] ?? `Program ${start + i}`,
  })),
}))

/** The standard GM bank-select MSB for the percussion (drum) kits. */
export const GM_DRUM_BANK = 128

/** GM Level-1 percussion KIT presets (selected on the drum bank by program). */
export const GM_DRUM_KITS: readonly GmProgram[] = [
  { program: 0, name: "Standard Kit" },
  { program: 8, name: "Room Kit" },
  { program: 16, name: "Power Kit" },
  { program: 24, name: "Electronic Kit" },
  { program: 25, name: "TR-808 Kit" },
  { program: 32, name: "Jazz Kit" },
  { program: 40, name: "Brush Kit" },
  { program: 48, name: "Orchestra Kit" },
]

/** Look up the GM name for a (program, bank). Drum bank → kit name. */
export const gmProgramName = (program: number, bank = 0): string => {
  if (bank === GM_DRUM_BANK) {
    const kit = GM_DRUM_KITS.find((k) => k.program === program)
    return kit ? kit.name : `Drum Kit ${program}`
  }
  const p = ((program % 128) + 128) % 128
  return GM_PROGRAM_NAMES[p] ?? `Program ${p}`
}

/** The family that owns a melodic GM program (undefined for the drum bank). */
export const gmFamilyOf = (program: number): GmFamily | undefined => {
  const p = ((program % 128) + 128) % 128
  return GM_FAMILIES.find((f) => p >= f.programs[0].program && p <= f.programs[7].program)
}
