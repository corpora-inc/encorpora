/**
 * A glyph atlas baked into a canvas at boot, so in-world text (damage numbers,
 * the answer orbs, PERFECT) draws in the same instanced pass as everything
 * else and costs nothing.
 *
 * The typeface is a heavy geometric sans, deliberately. The catalogue that
 * came before this one shipped engraved serif numerals on fast-moving targets
 * a child has under half a second to read. Ornament never eats legibility.
 */

export const GLYPH_CHARS = "0123456789+-−×÷=?!%.,×ABCDEFGHIJKLMNOPQRSTUVWXYZ"

export type GlyphMetric = { u0: number; v0: number; u1: number; v1: number; aw: number; ah: number }

export type Atlas = {
  canvas: HTMLCanvasElement
  size: number
  metrics: Map<string, GlyphMetric>
  /** Height of a cell in atlas pixels, used to normalise draw scale. */
  cell: number
}

export function buildAtlas(): Atlas {
  const cell = 72
  const cols = 8
  const rows = Math.ceil(GLYPH_CHARS.length / cols)
  const size = 1 << Math.ceil(Math.log2(Math.max(cell * cols, cell * rows)))
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const g = canvas.getContext("2d")!
  g.clearRect(0, 0, size, size)
  g.textAlign = "center"
  g.textBaseline = "middle"
  g.fillStyle = "#fff"

  const px = Math.round(cell * 0.72)
  g.font = `900 ${px}px ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`

  const metrics = new Map<string, GlyphMetric>()
  const seen = new Set<string>()
  let idx = 0
  for (const ch of GLYPH_CHARS) {
    if (seen.has(ch)) continue
    seen.add(ch)
    const cx = (idx % cols) * cell
    const cy = Math.floor(idx / cols) * cell
    g.fillText(ch, cx + cell / 2, cy + cell / 2)
    const w = g.measureText(ch).width
    metrics.set(ch, {
      u0: cx / size,
      v0: cy / size,
      u1: (cx + cell) / size,
      v1: (cy + cell) / size,
      // Advance as a fraction of the drawn cell height, so callers scale by
      // one number (the text height in world units) and spacing follows.
      aw: Math.min(1.05, w / cell + 0.1),
      ah: 1,
    })
    idx++
  }
  return { canvas, size, metrics, cell }
}
