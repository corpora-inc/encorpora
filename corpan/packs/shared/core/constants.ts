// ── Camera & Scene ──────────────────────────────────────────────────

/** Camera field of view (radians) */
export const CAMERA_FOV = 0.8

/** Camera position Z — sits behind the now-plane at z=0 */
export const CAMERA_Z = -5

/** Glow layer intensity */
export const GLOW_INTENSITY = 0.5

/** Number of background starfield particles */
export const STARFIELD_COUNT = 2000

/** Starfield bounding box size (world units) */
export const STARFIELD_SIZE = 100

// ── Timeline & Layout ──────────────────────────────────────────────

/** Milliseconds per z-unit — controls depth spacing between words */
export const MS_PER_Z_UNIT = 200

/** How far ahead (z-units) to render words */
export const LOOK_AHEAD_Z = 60

/** How far behind (z-units) to keep words before recycling */
export const LOOK_BEHIND_Z = 30

/** Crawl curve max height (world units) at the far end of look-ahead */
export const CRAWL_HEIGHT = 30

/** Crawl curve power — higher = flatter near camera, steeper at distance */
export const CRAWL_POWER = 2.5

/** Fade-in start (z-units from camera) */
export const FADE_IN_Z = 50

/** Fade-out end (z-units behind now-plane, fully transparent) */
export const FADE_OUT_Z = -25

// ── Word Stream ────────────────────────────────────────────────────

/** Maximum word meshes in the pool */
export const WORD_POOL_SIZE = 120

/** DynamicTexture width (px) — words are drawn centered on this */
export const WORD_TEXTURE_SIZE = 512

/** Default font size (px) — long words shrink to fit the texture */
export const WORD_FONT_SIZE = 128

/** Scale for the currently-spoken word */
export const CURRENT_WORD_SCALE = 1.0

/** Scale for non-current words */
export const WORD_SCALE = 1.0

/** Y position the active word holds at (dead center on oscilloscope) */
export const HOLD_Y = 0

/** Z pull toward camera at peak effect (subtle ~10% perspective bump) */
export const HOLD_Z_PULL = -0.4

/** Envelope attack: fraction of word duration for ease-in */
export const HOLD_ATTACK = 0.15

/** Envelope release: fraction of word duration for ease-out */
export const HOLD_RELEASE = 0.15

// ── Oscilloscope ───────────────────────────────────────────────────

/** FFT sample count (powers of 2) */
export const OSCILLOSCOPE_SAMPLES = 256

/** Ribbon width (world units) */
export const OSCILLOSCOPE_WIDTH = 12

/** Ribbon segment count — Catmull-Rom subdivides 4× further */
export const OSCILLOSCOPE_SEGMENTS = 64

/** Max amplitude swing (world units) */
export const OSCILLOSCOPE_AMPLITUDE = 5.0

/** Ribbon trace thickness (world units) */
export const OSCILLOSCOPE_TRACE_WIDTH = 0.023

/** Vertical center position (world units) */
export const OSCILLOSCOPE_Y = 0

// ── Waveform Stream (amplitude tube) ──────────────────────────────

/** Sample points along Z — each ~0.23 z-units apart */
export const WAVEFORM_STREAM_SAMPLES = 300

/** Tube radius at silence (world units) — 0 = invisible when quiet */
export const WAVEFORM_STREAM_MIN_RADIUS = 0

/** Tube radius at peak amplitude (world units) */
export const WAVEFORM_STREAM_MAX_RADIUS = 1

/** Cross-section sides — 24 is visually round at low opacity */
export const WAVEFORM_STREAM_TESSELLATION = 24

/** Tube opacity */
export const WAVEFORM_STREAM_ALPHA = 0.005

/** Box-filter smoothing radius (samples per pass) — 0 = disabled */
export const WAVEFORM_STREAM_SMOOTH_RADIUS = 0

/** Number of smoothing passes — 0 = disabled */
export const WAVEFORM_STREAM_SMOOTH_PASSES = 0

/** Fallback amplitude when envelope data isn't decoded yet — 0 = silent */
export const WAVEFORM_STREAM_FALLBACK_AMP = 0

// ── Pulse Ring (amplitude circle at NOW plane) ────────────────────

/** Max radius at peak amplitude (world units) */
export const PULSE_RING_MAX_RADIUS = 1

/** Line segments around the circle — higher = smoother */
export const PULSE_RING_SEGMENTS = 128

/** Number of ghost rings in the pool */
export const PULSE_RING_GHOST_COUNT = 48

/** Ghost fade duration (ms) — how long each ghost takes to disappear */
export const PULSE_RING_FADE_MS = 200

/** Line color RGB */
export const PULSE_RING_COLOR_R = 0.6
export const PULSE_RING_COLOR_G = 0.95
export const PULSE_RING_COLOR_B = 1.0

// ── Audio ──────────────────────────────────────────────────────────

/** Number of segments to preload ahead of playback */
export const PRELOAD_AHEAD = 2

/** Amplitude bins per word envelope */
export const ENVELOPE_BINS = 64

// ── Display name maps ────────────────────────────────────────────

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Español", fr: "Français", de: "Deutsch",
  it: "Italiano", pt: "Português", ja: "日本語", ko: "한국어",
  zh: "中文", ar: "العربية", ru: "Русский", hi: "हिन्दी",
}

export const VOICE_NAMES: Record<string, string> = {
  "ian-narration": "Ian",
}

/** Resolve a voice ID to a display name.
 *  Tries exact match first, then prefix match, then extracts the first word. */
export function resolveVoiceName(voiceId: string): string {
  if (VOICE_NAMES[voiceId]) return VOICE_NAMES[voiceId]
  // Prefix match: "ian-new-narration-spanish-loud" starts with "ian-narration"? No.
  // Better: extract first segment before "-" and capitalize.
  for (const [key, name] of Object.entries(VOICE_NAMES)) {
    const prefix = key.split("-")[0]
    if (voiceId.startsWith(prefix + "-")) return name
  }
  // Fallback: capitalize first word
  const first = voiceId.split("-")[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export const BOOK_NAMES: Record<string, string> = {
  book_monte_alban: "The Mystery of Monte Albán",
}
