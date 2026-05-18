/**
 * Rasmapan — letter trace layer.
 *
 * Renders an Arabic glyph's ghost outline (extracted from Amiri) on
 * a 0..1000 viewBox canvas and tracks which stroke the user is on.
 * Reuses the brush canvas from hanzipan's brush module — see
 * `brush/` (presets + pressure curves + canvas physics). The trace
 * layer owns rendering of (a) the ghost outline and (b) the
 * active-stroke highlight, and reports per-stroke scoring via the
 * scorer in `./scoring.js`.
 */

import { scoreStroke } from "./scoring.js";

const VIEWBOX = 1000;

const buildPath2D = (d) => {
  try {
    return new Path2D(d);
  } catch {
    return null;
  }
};

export class LetterTraceLayer {
  /**
   * @param {HTMLCanvasElement} ghostCanvas
   * @param {() => { strokeGhost: string, strokeHighlight: string, strokeUser: string }} getColors
   */
  constructor(ghostCanvas, getColors) {
    this.ghostCanvas = ghostCanvas;
    this.getColors = getColors || (() => ({
      strokeGhost: "rgba(107, 76, 42, 0.22)",
      strokeHighlight: "rgba(139, 105, 20, 0.85)",
      strokeUser: "#1a1410",
    }));
    this.ctx = ghostCanvas.getContext("2d");

    this.writer = null;            // current glyph's writer record
    this.outlinePaths = [];        // Path2D objects for each contour
    this.strokeIndex = 0;          // index of the next expected stroke
    this.completedStrokes = [];    // per-stroke quality results
    this.layout = { width: 0, height: 0, padding: 0 };
    this.ghostVisible = true;
    this.dirEnabled = false;       // freedraw turns this off
  }

  setWriter(writer) {
    this.writer = writer || null;
    this.strokeIndex = 0;
    this.completedStrokes = [];
    this.outlinePaths = [];
    if (writer && Array.isArray(writer.outline)) {
      for (const d of writer.outline) {
        const p = buildPath2D(d);
        if (p) this.outlinePaths.push({ d, path2d: p });
      }
    }
    this.redraw();
  }

  setLayout(layout) {
    this.layout = layout || this.layout;
    this.redraw();
  }

  setGhostVisible(visible) {
    this.ghostVisible = !!visible;
    this.redraw();
  }

  setFreeDraw(free) {
    this.dirEnabled = !free;
    if (free) {
      this.strokeIndex = 0;
      this.completedStrokes = [];
    }
    this.redraw();
  }

  /** Total stroke count expected for the current glyph. */
  totalStrokes() {
    if (!this.writer) return 0;
    if (Array.isArray(this.writer.medians) && this.writer.medians.length) {
      return this.writer.medians.length;
    }
    return this.outlinePaths.length || 1;
  }

  /** Whether the user has completed all strokes. */
  isComplete() {
    return this.totalStrokes() > 0 && this.strokeIndex >= this.totalStrokes();
  }

  /**
   * Convert a user stroke (in canvas pixels) into viewBox space and
   * score it against the next expected stroke. Returns:
   *   { quality, accepted, complete, strokeIndex }
   */
  consumeUserStroke(canvasPoints) {
    if (!this.writer || !this.dirEnabled) {
      return { quality: 0, accepted: false, complete: false, strokeIndex: -1, ignored: true };
    }
    const viewPoints = canvasPoints.map((p) => this._canvasToView(p.x, p.y));
    const score = scoreStroke(viewPoints, this.writer, this.strokeIndex);
    const idx = this.strokeIndex;
    if (score.accepted) {
      this.completedStrokes.push({ strokeIndex: idx, quality: score.quality });
      this.strokeIndex += 1;
      this.redraw();
      return {
        quality: score.quality,
        accepted: true,
        complete: this.isComplete(),
        strokeIndex: idx,
      };
    }
    return {
      quality: score.quality,
      accepted: false,
      complete: false,
      strokeIndex: idx,
    };
  }

  redraw() {
    const ctx = this.ctx;
    const c = this.ghostCanvas;
    if (!c.width || !c.height) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();

    if (!this.writer || !this.ghostVisible || !this.outlinePaths.length) return;

    const layout = this._effectiveLayout();
    const colors = this.getColors();

    // Map viewBox (0..1000) → canvas pixels, accounting for DPR.
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    const scale = (layout.size * dpr) / VIEWBOX;
    const tx = layout.x * dpr;
    const ty = layout.y * dpr;
    ctx.setTransform(scale, 0, 0, scale, tx, ty);

    // Fill the ghost outline in faded sepia.
    ctx.fillStyle = colors.strokeGhost;
    for (let i = 0; i < this.outlinePaths.length; i += 1) {
      ctx.fill(this.outlinePaths[i].path2d, "evenodd");
    }

    // Highlight the current (next) stroke's contour, if we have one
    // and freedraw mode is off.
    if (this.dirEnabled && this.strokeIndex < this.outlinePaths.length) {
      const target = this.outlinePaths[this.strokeIndex];
      if (target) {
        ctx.fillStyle = colors.strokeHighlight;
        ctx.fill(target.path2d, "evenodd");
      }
    }

    ctx.restore();
  }

  _effectiveLayout() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.ghostCanvas.width / dpr;
    const h = this.ghostCanvas.height / dpr;
    const padding = Math.min(w, h) * 0.08;
    const size = Math.min(w, h) - padding * 2;
    const x = (w - size) / 2;
    const y = (h - size) / 2;
    return { w, h, padding, size, x, y };
  }

  _canvasToView(canvasX, canvasY) {
    const dpr = window.devicePixelRatio || 1;
    const layout = this._effectiveLayout();
    const x = (canvasX / dpr - layout.x) * (VIEWBOX / layout.size);
    const y = (canvasY / dpr - layout.y) * (VIEWBOX / layout.size);
    return [x, y];
  }
}

/**
 * Word trace layer — same idea, but lays out multiple letter glyphs
 * along an RTL baseline so the user can trace a whole 2–4 letter
 * word as a continuous run. The hero canvas in Words mode is wider
 * (aspect 16:7), giving each letter ~280 viewBox units of horizontal
 * room.
 */
export class WordTraceLayer extends LetterTraceLayer {
  constructor(ghostCanvas, getColors) {
    super(ghostCanvas, getColors);
    this.letters = [];  // [{ writer, offsetX, scale }]
  }

  setWord(letters) {
    this.letters = letters || [];
    // Per-letter outline paths are built lazily during redraw.
    this.strokeIndex = 0;
    this.completedStrokes = [];
    this.redraw();
  }

  setWriter(_) {
    /* no-op — words use setWord instead */
  }

  totalStrokes() {
    // Approximate — total contours across all letters.
    let total = 0;
    for (const l of this.letters) {
      if (l.writer && Array.isArray(l.writer.outline)) {
        total += l.writer.outline.length;
      }
    }
    return total;
  }

  consumeUserStroke(_canvasPoints) {
    // Permissive scoring in word mode for v0.1.0: any user stroke
    // counts toward the total. Real per-letter scoring is a follow-up.
    if (this.strokeIndex < this.totalStrokes()) {
      this.completedStrokes.push({ strokeIndex: this.strokeIndex, quality: 0.6 });
      this.strokeIndex += 1;
      this.redraw();
      return {
        quality: 0.6,
        accepted: true,
        complete: this.isComplete(),
        strokeIndex: this.strokeIndex - 1,
      };
    }
    return { quality: 0, accepted: false, complete: true, strokeIndex: -1 };
  }

  redraw() {
    const ctx = this.ctx;
    const c = this.ghostCanvas;
    if (!c.width || !c.height) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();

    if (!this.ghostVisible || !this.letters.length) return;

    const colors = this.getColors();
    const dpr = window.devicePixelRatio || 1;
    const w = c.width / dpr;
    const h = c.height / dpr;
    const padding = Math.min(w, h) * 0.06;
    const inner_w = w - padding * 2;
    const inner_h = h - padding * 2;
    // Lay out letters RTL: the first letter sits on the right.
    const slot_w = inner_w / this.letters.length;
    const slot_size = Math.min(slot_w * 0.92, inner_h);

    for (let i = 0; i < this.letters.length; i += 1) {
      const letter = this.letters[i];
      if (!letter || !letter.writer) continue;
      const slotIndex = i;  // 0 is the first written → rightmost
      const xCenter = w - padding - slot_w * (slotIndex + 0.5);
      const yCenter = h / 2;
      const scale = slot_size / VIEWBOX;
      const tx = (xCenter - slot_size / 2) * dpr;
      const ty = (yCenter - slot_size / 2) * dpr;

      ctx.save();
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, tx, ty);
      ctx.fillStyle = colors.strokeGhost;
      for (const d of letter.writer.outline || []) {
        const path = buildPath2D(d);
        if (path) ctx.fill(path, "evenodd");
      }
      ctx.restore();
    }
  }
}
