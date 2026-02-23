/** Milliseconds per z-unit: controls how spread out words are in depth */
export const MS_PER_Z_UNIT = 200

/** How far ahead (in z-units) to render words */
export const LOOK_AHEAD_Z = 60

/** How far behind (in z-units) to keep words before recycling */
export const LOOK_BEHIND_Z = 10

/** Waterslide curve height: max y at the far end of the look-ahead range */
export const CRAWL_HEIGHT = 30

/** Waterslide curve power: higher = flatter top, steeper middle */
export const CRAWL_POWER = 2.5

/** Fade start distance (z-units from camera, starts fading in) */
export const FADE_IN_Z = 50

/** Fade end distance (z-units behind now-plane, fully faded out) */
export const FADE_OUT_Z = -8

/** Scale for the currently-spoken word (same as normal — color change is enough) */
export const CURRENT_WORD_SCALE = 1.0

/** Normal word scale */
export const WORD_SCALE = 1.0

/** Maximum number of word meshes in the pool */
export const WORD_POOL_SIZE = 120

/** DynamicTexture resolution for word rendering */
export const WORD_TEXTURE_SIZE = 512

/** Font size for word text on DynamicTexture */
export const WORD_FONT_SIZE = 80

/** Font family for word text */
export const WORD_FONT = `bold ${WORD_FONT_SIZE}px 'Trebuchet MS', 'Lucida Sans Unicode', sans-serif`

/** Maximum plane width (world units) — long words compress to fit */
export const WORD_MAX_PLANE_WIDTH = 12

/** Oscilloscope sample count */
export const OSCILLOSCOPE_SAMPLES = 256

/** Oscilloscope ribbon width (world units) */
export const OSCILLOSCOPE_WIDTH = 12

/** Oscilloscope ribbon segments */
export const OSCILLOSCOPE_SEGMENTS = 64

/** Oscilloscope max amplitude (world units) — swings wildly across the screen */
export const OSCILLOSCOPE_AMPLITUDE = 23.0

/** Oscilloscope trace width (world units) — thin ribbon band */
export const OSCILLOSCOPE_TRACE_WIDTH = 0.023


/** Oscilloscope vertical position (world units) — shifted ~10% below center */
export const OSCILLOSCOPE_Y = 0

/** Number of background starfield particles */
export const STARFIELD_COUNT = 2000

/** Starfield box size */
export const STARFIELD_SIZE = 100

/** Camera field of view (radians) */
export const CAMERA_FOV = 0.8

/** Camera position Z (behind the now-plane) */
export const CAMERA_Z = -5

/** Number of segments to preload ahead */
export const PRELOAD_AHEAD = 2

/** Glow layer intensity */
export const GLOW_INTENSITY = 0.5

/** Number of amplitude bins per word envelope */
export const ENVELOPE_BINS = 64

/** Waveform stream sample count along Z — 1 per ~0.35 Z-units, smoothing fills the rest */
export const WAVEFORM_STREAM_SAMPLES = 300

/** Vertical offset — lifts tube so words sit inside and big diameters fill toward camera */
export const WAVEFORM_STREAM_Y_OFFSET = 0

/** Tube radius during silence (world units) — thin wire */
export const WAVEFORM_STREAM_MIN_RADIUS = 0

/** Tube radius at peak amplitude (world units) */
export const WAVEFORM_STREAM_MAX_RADIUS = 1

/** Tube tessellation (sides around cross-section, 32 = visually round) */
export const WAVEFORM_STREAM_TESSELLATION = 24

/** Tube opacity — very low so words remain readable through it */
export const WAVEFORM_STREAM_ALPHA = 0.01

/** Fade zone near z=0 to yield to the real-time oscilloscope */
export const WAVEFORM_STREAM_OSC_FADE_Z = 1

/** Smoothing kernel radius per pass (samples) — wider to compensate for fewer samples */
export const WAVEFORM_STREAM_SMOOTH_RADIUS = 0

/** Number of smoothing passes — 1 pass, minimal blur, gaps between words stay sharp */
export const WAVEFORM_STREAM_SMOOTH_PASSES = 0

/** Fallback amplitude when envelope not yet decoded */
export const WAVEFORM_STREAM_FALLBACK_AMP = 0
