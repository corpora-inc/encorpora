/** Milliseconds per z-unit: controls how spread out words are in depth */
export const MS_PER_Z_UNIT = 200

/** How far ahead (in z-units) to render words */
export const LOOK_AHEAD_Z = 60

/** How far behind (in z-units) to keep words before recycling */
export const LOOK_BEHIND_Z = 10

/** Star Wars crawl curve strength: y = baseY - curveStrength * z² */
export const CRAWL_CURVE_STRENGTH = 0.003

/** Base Y position for word stream */
export const WORD_BASE_Y = 0

/** Fade start distance (z-units from camera, starts fading in) */
export const FADE_IN_Z = 50

/** Fade end distance (z-units behind now-plane, fully faded out) */
export const FADE_OUT_Z = -8

/** Scale boost for the currently-spoken word */
export const CURRENT_WORD_SCALE = 1.3

/** Normal word scale */
export const WORD_SCALE = 1.0

/** Maximum number of word meshes in the pool */
export const WORD_POOL_SIZE = 120

/** DynamicTexture resolution for word rendering */
export const WORD_TEXTURE_SIZE = 512

/** Font size for word text on DynamicTexture */
export const WORD_FONT_SIZE = 64

/** Font family for word text */
export const WORD_FONT = "bold 64px 'Trebuchet MS', 'Lucida Sans Unicode', sans-serif"

/** Oscilloscope sample count */
export const OSCILLOSCOPE_SAMPLES = 256

/** Oscilloscope ribbon width (world units) */
export const OSCILLOSCOPE_WIDTH = 16

/** Oscilloscope ribbon segments */
export const OSCILLOSCOPE_SEGMENTS = 128

/** Oscilloscope max amplitude (world units) */
export const OSCILLOSCOPE_AMPLITUDE = 1.5

/** Number of background starfield particles */
export const STARFIELD_COUNT = 2000

/** Starfield box size */
export const STARFIELD_SIZE = 100

/** Camera field of view (radians) */
export const CAMERA_FOV = 0.8

/** Camera position Z (behind the now-plane) */
export const CAMERA_Z = -5

/** Number of segments to preload ahead */
export const PRELOAD_AHEAD = 3

/** Glow layer intensity */
export const GLOW_INTENSITY = 0.6

/** Words per line before wrapping */
export const WORDS_PER_LINE = 8

/** Horizontal spacing between words (world units) */
export const WORD_SPACING_X = 2.2

/** Vertical spacing between lines (world units) */
export const LINE_SPACING_Y = 1.8
