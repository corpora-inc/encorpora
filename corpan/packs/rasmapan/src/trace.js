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

import { scoreStroke, fitArabicText } from "./scoring.js";

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

    this.fxCanvas = null;          // overlay for stroke-order animation
    this.fxCtx = null;
    this._animOpId = 0;            // bumped to cancel in-flight animations

    this.writer = null;            // current glyph's writer record
    this.outlinePaths = [];        // Path2D objects for each contour
    this.strokeIndex = 0;          // index of the next expected stroke
    this.completedStrokes = [];    // per-stroke quality results
    this.layout = { width: 0, height: 0, padding: 0 };
    this.ghostVisible = true;
    this.dirEnabled = false;       // freedraw turns this off
  }

  setFxCanvas(fxCanvas) {
    this.fxCanvas = fxCanvas || null;
    this.fxCtx = fxCanvas ? fxCanvas.getContext("2d") : null;
  }

  /**
   * Animate the canonical stroke order on the fx canvas. Each
   * median polyline is traced by a moving "pen tip" over
   * `strokeDuration` ms, with `gapDuration` ms between strokes.
   * Single-point medians (dots) render as a tap-and-hold pulse.
   *
   * Trajectories come from Calliar (MIT, https://github.com/ARBML/Calliar)
   * via the build-side extractor — real calligraphers' hands, not
   * font-outline guesses. Stroke order is classical Naskh: base
   * shape first, then dots.
   *
   * Timing chosen for learning, not snappiness: 1.1 s per stroke
   * gives the eye time to track the pen tip, and a 1.5 s hold at
   * the end lets the learner study the finished letter before
   * the canvas clears.
   *
   * No-ops if the writer has no medians (i.e. letters not yet
   * Calliar-derived). The Play/Speak button still fires TTS in
   * parallel — the animation is additive.
   */
  /** Total variants for this writer (0 if no `variants` array). */
  variantCount() {
    if (!this.writer || !Array.isArray(this.writer.variants)) return 0;
    return this.writer.variants.length;
  }

  playStrokeOrder({
    strokeDuration = 1100,
    gapDuration = 250,
    holdMs = 1500,
    variantIndex = null,
  } = {}) {
    this.cancelAnimation();
    if (!this.writer || !this.fxCtx) return;
    // Only animate writers backed by REAL stroke-order data (Calliar).
    // Writer records carry auto-derived medians from the Amiri outline
    // as a fallback for scoring, but those are geometric centerlines —
    // not actual stroke order. Showing those as a preview would teach
    // a fake order. The builder sets `scoring: "median"` only when an
    // override from `stroke_orders_seed.json` (Calliar-derived) is in
    // place; positional forms (initial / medial / final) without
    // overrides stay at "outline" and silently skip animation here.
    if (this.writer.scoring !== "median") return;
    // Pick which stroke list to animate. variantIndex=null → the
    // canonical `writer.medians`. variantIndex=0..N → that entry
    // from `writer.variants` (3 alternative calligraphers' takes).
    let medians = Array.isArray(this.writer.medians) ? this.writer.medians : null;
    if (
      variantIndex != null &&
      Array.isArray(this.writer.variants) &&
      this.writer.variants[variantIndex] &&
      Array.isArray(this.writer.variants[variantIndex])
    ) {
      medians = this.writer.variants[variantIndex];
    }
    if (!medians || !medians.length) return;
    // Skip animation if any stroke is empty.
    if (medians.some((m) => !Array.isArray(m) || m.length === 0)) return;

    const layout = this._effectiveLayout();
    const dpr = window.devicePixelRatio || 1;
    const toCanvas = ([x, y]) => [
      (layout.x + x * (layout.size / VIEWBOX)) * dpr,
      (layout.y + y * (layout.size / VIEWBOX)) * dpr,
    ];

    // Pre-project each stroke into canvas pixels and pre-compute
    // cumulative segment lengths for fast progress lookup.
    const segments = medians.map((m) => m.map(toCanvas));
    const cumLengths = segments.map((seg) => {
      const lens = [0];
      for (let i = 1; i < seg.length; i += 1) {
        const dx = seg[i][0] - seg[i - 1][0];
        const dy = seg[i][1] - seg[i - 1][1];
        lens.push(lens[lens.length - 1] + Math.sqrt(dx * dx + dy * dy));
      }
      return lens;
    });
    const totalLens = cumLengths.map((c) => c[c.length - 1]);

    const colors = this.getColors();
    const trailColor = colors.strokeHighlight || "rgba(139, 105, 20, 0.85)";
    const tipColor = colors.strokeUser || "#1a1410";

    // Each stroke takes strokeDuration; dots get a shorter pulse so
    // they don't feel artificially long.
    const stepDurations = segments.map((seg) =>
      seg.length <= 1 ? Math.round(strokeDuration * 0.45) : strokeDuration,
    );
    const startedAt = performance.now();
    let totalDuration = 0;
    for (let i = 0; i < stepDurations.length; i += 1) {
      totalDuration += stepDurations[i];
      if (i < stepDurations.length - 1) totalDuration += gapDuration;
    }

    this._animOpId += 1;
    const opId = this._animOpId;

    const tick = (now) => {
      if (opId !== this._animOpId) return;
      const elapsed = now - startedAt;
      this._clearFx();
      // Walk strokes in order, drawing each at its current progress.
      let cursor = 0;
      for (let s = 0; s < segments.length; s += 1) {
        const startT = cursor;
        cursor += stepDurations[s];
        if (s < segments.length - 1) cursor += gapDuration;
        const dur = stepDurations[s];
        const localT = (elapsed - startT) / dur;
        const progress = Math.max(0, Math.min(1, localT));
        if (progress <= 0) continue;
        if (segments[s].length === 1) {
          // Dot — fade-in pulse.
          this._drawAnimatedDot(segments[s][0], progress, tipColor);
        } else {
          this._drawAnimatedStroke(
            segments[s], cumLengths[s], totalLens[s],
            progress, trailColor, tipColor,
          );
        }
      }

      if (elapsed >= totalDuration) {
        // Hold the final state so the learner can study the
        // completed letter before the canvas clears.
        setTimeout(() => {
          if (opId !== this._animOpId) return;
          this._clearFx();
        }, holdMs);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  cancelAnimation() {
    this._animOpId += 1;
    this._clearFx();
  }

  _clearFx() {
    if (!this.fxCtx || !this.fxCanvas) return;
    this.fxCtx.save();
    this.fxCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.fxCtx.clearRect(0, 0, this.fxCanvas.width, this.fxCanvas.height);
    this.fxCtx.restore();
  }

  _drawAnimatedStroke(seg, cumLen, totalLen, progress, trailColor, tipColor) {
    if (!this.fxCtx || seg.length < 2) return;
    const ctx = this.fxCtx;
    const targetLen = totalLen * progress;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Trail: a refined calligraphy line — wide enough to read at a
    // glance, fine enough not to swamp the underlying glyph outline.
    // 4 CSS px @ dpr=2 = 8 device px; on a 400-px-wide trace canvas
    // that's ~1% of canvas width, comparable to a 0.5 mm qalam tip.
    ctx.strokeStyle = trailColor;
    ctx.lineWidth = 4 * dpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(seg[0][0], seg[0][1]);
    let tip = seg[0];
    for (let i = 1; i < seg.length; i += 1) {
      if (cumLen[i] <= targetLen) {
        ctx.lineTo(seg[i][0], seg[i][1]);
        tip = seg[i];
      } else {
        const prev = seg[i - 1];
        const cur = seg[i];
        const segLen = cumLen[i] - cumLen[i - 1];
        const remain = targetLen - cumLen[i - 1];
        const f = segLen > 1e-6 ? remain / segLen : 0;
        const px = prev[0] + (cur[0] - prev[0]) * f;
        const py = prev[1] + (cur[1] - prev[1]) * f;
        ctx.lineTo(px, py);
        tip = [px, py];
        break;
      }
    }
    ctx.stroke();
    // Pen tip — bright halo + solid center. Sized to match the
    // refined stroke width so the moving point reads as a pen nib,
    // not a marker.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(200, 169, 110, 0.5)";  // halo
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], 8 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tipColor;  // solid sumi-ink core
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], 4 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawAnimatedDot(pt, progress, color) {
    if (!this.fxCtx) return;
    const ctx = this.fxCtx;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Two-phase: grow to peak at 60% of the dot's duration, then hold.
    // Sized to match the visible dot in the ghost glyph — i.e. about
    // 2-3× the line width, so it reads as "a real dot" not a pen
    // touch-down. Halo + core mirrors the moving pen tip.
    const peak = Math.min(1, progress / 0.6);
    const r_core = (3 + peak * 3) * dpr;
    const r_halo = r_core + 5 * dpr;
    ctx.globalAlpha = Math.min(1, progress * 2);
    ctx.fillStyle = "rgba(200, 169, 110, 0.5)";
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], r_halo, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pt[0], pt[1], r_core, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  setWriter(writer) {
    this.writer = writer || null;
    this.strokeIndex = 0;
    this.completedStrokes = [];
    this.outlinePaths = [];
    // Build BOTH per-contour Path2Ds (for the per-stroke highlight)
    // AND a single combined Path2D containing every contour as a
    // subpath. Filling the combined path once with `evenodd` is the
    // ONLY way to subtract inner counter contours (the visible holes
    // inside ه م ظ و ف ق ل etc.) from the outer body fill. Filling
    // each contour separately just paints the counter on top of the
    // body, making the glyph look like a solid blob.
    this.outlineCombined = null;
    if (writer && Array.isArray(writer.outline)) {
      const combined = new Path2D();
      for (const d of writer.outline) {
        const p = buildPath2D(d);
        if (!p) continue;
        this.outlinePaths.push({ d, path2d: p });
        combined.addPath(p);
      }
      this.outlineCombined = combined;
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

    const layout = this._glyphLayout();
    const colors = this.getColors();

    // Map viewBox (0..1000) → canvas pixels via the glyph-bbox fit,
    // accounting for DPR. With the bbox-based layout, tall-narrow
    // letters like alif fill the canvas vertically with minimal
    // padding; wide-low letters fill horizontally.
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(
      layout.scale * dpr, 0, 0, layout.scale * dpr,
      layout.tx * dpr, layout.ty * dpr,
    );

    // Fill the ghost outline in faded sepia. ONE fill call with the
    // combined path + even-odd rule so inner counter contours
    // subtract from the outer body fill, leaving visible holes
    // empty (parchment shows through the counter of ه م ظ و etc.).
    ctx.fillStyle = colors.strokeGhost;
    if (this.outlineCombined) {
      ctx.fill(this.outlineCombined, "evenodd");
    }

    // Highlight the current (next) stroke's contour, if we have one
    // and freedraw mode is off. CLIP to the target contour's area,
    // then FILL the combined path with the highlight color. That way
    // counters still subtract within the highlighted region — the
    // hole stays visible during the highlight (avoids the v0.4.4
    // bug where highlighting the body filled the counter solid and
    // erased the hole).
    if (this.dirEnabled && this.strokeIndex < this.outlinePaths.length) {
      const target = this.outlinePaths[this.strokeIndex];
      if (target && this.outlineCombined) {
        ctx.save();
        ctx.clip(target.path2d, "evenodd");
        ctx.fillStyle = colors.strokeHighlight;
        ctx.fill(this.outlineCombined, "evenodd");
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /**
   * Compute the canvas-pixel transform that maps the writer's actual
   * glyph bbox into the canvas with a tight ~4% safety margin. Reads
   * `writer.bbox = [minX, minY, maxX, maxY]` in 0..1000 viewBox coords
   * and centers the rendered glyph inside the canvas. Falls back to a
   * full-viewBox layout when the bbox is missing or degenerate.
   *
   * Returns `{ scale, tx, ty, w, h }` in CSS pixels — multiply by
   * DPR at the actual `setTransform` call site.
   */
  _glyphLayout() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.ghostCanvas.width / dpr;
    const h = this.ghostCanvas.height / dpr;
    if (w <= 0 || h <= 0) {
      // ResizeObserver race — return a null-fit that redraw() can
      // safely ignore (it guards on c.width / c.height already).
      return { scale: 1, tx: 0, ty: 0, w, h };
    }
    // 7% of the canvas's smaller dim, floored at 16 CSS px. The
    // canvas-layer is inset 12px from the shell; the dashed border
    // (canvas-shell::after) is inset 20px — 8 CSS px inside the
    // canvas edge on every device. A 16-px floor guarantees the
    // glyph stays well inside the dashed visible border on small
    // phones; the 7% percentage scales gracefully on iPad.
    const pad = Math.max(Math.min(w, h) * 0.07, 16);
    const bbox = this.writer && Array.isArray(this.writer.bbox)
      ? this.writer.bbox
      : null;
    if (bbox && bbox.length === 4) {
      const [minX, minY, maxX, maxY] = bbox;
      const gw = maxX - minX;
      const gh = maxY - minY;
      if (gw > 0 && gh > 0) {
        const scale = Math.min((w - 2 * pad) / gw, (h - 2 * pad) / gh);
        const ox = (w - gw * scale) / 2;
        const oy = (h - gh * scale) / 2;
        return {
          scale,
          tx: ox - minX * scale,
          ty: oy - minY * scale,
          w, h,
        };
      }
    }
    // Fallback: square fit of the full 0..1000 viewBox.
    const size = Math.min(w, h) - 2 * pad;
    const scale = size / VIEWBOX;
    return {
      scale,
      tx: (w - size) / 2,
      ty: (h - size) / 2,
      w, h,
    };
  }

  /** Legacy alias for callers that still expect _effectiveLayout. */
  _effectiveLayout() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.ghostCanvas.width / dpr;
    const h = this.ghostCanvas.height / dpr;
    const padding = Math.max(Math.min(w, h) * 0.07, 16);
    const size = Math.min(w, h) - padding * 2;
    const x = (w - size) / 2;
    const y = (h - size) / 2;
    return { w, h, padding, size, x, y };
  }

  _canvasToView(canvasX, canvasY) {
    const dpr = window.devicePixelRatio || 1;
    const layout = this._glyphLayout();
    const x = (canvasX / dpr - layout.tx) / layout.scale;
    const y = (canvasY / dpr - layout.ty) / layout.scale;
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
/**
 * v0.4: word ghost = a single big elegant Amiri-rendered word filling
 * the canvas. We drop the per-letter outline-slot layout (which read
 * as "separate disconnected glyphs side-by-side") and let the
 * browser's text engine shape the full Arabic string properly with
 * RTL connecting forms, ligatures, and kerning.
 *
 * `letters` is still tracked for the score-me word-target raster
 * (we use the same Amiri rendering against an offscreen mask) and
 * for any future per-letter UI affordances. The `text` field is the
 * raw Arabic string the user is tracing.
 */
export class WordTraceLayer extends LetterTraceLayer {
  constructor(ghostCanvas, getColors) {
    super(ghostCanvas, getColors);
    this.letters = [];
    this.text = "";
    this._fontReady = false;
    this._fontPending = null;
  }

  /**
   * Set the active word.
   *   `letters`: optional array of letter writer records (for UI
   *     metadata; not used in rendering).
   *   `text`: the raw Arabic string to render in the ghost canvas.
   */
  setWord(letters, text) {
    this.letters = letters || [];
    this.text = String(text || "");
    this.strokeIndex = 0;
    this.completedStrokes = [];
    this._ensureFont();
    this.redraw();
  }

  setWriter(_) {
    /* no-op — words use setWord instead */
  }

  /** Returns the raw Arabic string currently rendered. */
  getText() {
    return this.text;
  }

  /**
   * Words mode lives in CSS-pixel coords (the canvas aspect is 16:7,
   * not square, so we DON'T map to the 0..1000 letter viewBox). The
   * score-me rasterizer below mirrors these dimensions so the
   * rasterized text and the user's strokes share the same coord
   * space.
   */
  _canvasToView(canvasX, canvasY) {
    const dpr = window.devicePixelRatio || 1;
    return [canvasX / dpr, canvasY / dpr];
  }

  /** CSS-pixel canvas dimensions — paired with `_canvasToView`. */
  getViewportSize() {
    const dpr = window.devicePixelRatio || 1;
    return {
      width: this.ghostCanvas.width / dpr,
      height: this.ghostCanvas.height / dpr,
    };
  }

  totalStrokes() {
    // Approximate — number of "writing units" in the word so the
    // stroke counter in the toolbar reads sensibly.
    return this.letters.length || (this.text ? this.text.length : 0);
  }

  consumeUserStroke(_canvasPoints) {
    // Per-stroke scoring isn't useful for whole-word free draw —
    // the user's stroke order is loose. We just count strokes so
    // the score bar progresses; the "Score me" button (main.js)
    // runs the real word-shape scorer at the end.
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

  /**
   * Compute the fitted font size + center-offset for the current
   * text. Uses the shared `fitArabicText` helper from scoring.js so
   * the on-screen ghost and the offscreen score-me raster share
   * the exact same fit math. Returns null when no text or empty
   * canvas. Coordinates are in canvas device pixels (post-DPR).
   */
  _wordLayout() {
    const c = this.ghostCanvas;
    if (!c.width || !c.height || !this.text) return null;
    const dpr = window.devicePixelRatio || 1;
    const cw = c.width;
    const ch = c.height;
    // Mirror LetterTraceLayer's margin (7% of canvas's smaller dim,
    // floored at 16 device px × dpr to stay inside the dashed border
    // on small phones).
    const margin = Math.max(Math.min(cw, ch) * 0.07, 16 * dpr);
    const innerW = cw - 2 * margin;
    const innerH = ch - 2 * margin;
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const fit = fitArabicText(ctx, this.text, innerW, innerH);
    ctx.restore();
    if (!fit) return null;
    return {
      fontPx: fit.fontPx,
      yOffset: fit.yOffset,
      cx: cw / 2,
      cy: ch / 2,
      cw,
      ch,
      dpr,
    };
  }

  /** Wait for Amiri to load (FontFaceSet) then redraw once. */
  _ensureFont() {
    if (this._fontReady) return;
    if (this._fontPending) return;
    if (typeof document === "undefined" || !document.fonts ||
        typeof document.fonts.load !== "function") {
      this._fontReady = true;
      return;
    }
    // Use a representative size; FontFaceSet is size-keyed but
    // loading one size warms up the font face for all sizes.
    this._fontPending = document.fonts.load(`64px "Amiri"`, this.text || "ا")
      .then(() => {
        this._fontReady = true;
        this._fontPending = null;
        this.redraw();
      })
      .catch(() => {
        // Font failed to load — fall back to Georgia. Move on.
        this._fontReady = true;
        this._fontPending = null;
      });
  }

  redraw() {
    const ctx = this.ctx;
    const c = this.ghostCanvas;
    if (!c.width || !c.height) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();

    if (!this.ghostVisible || !this.text) return;

    const layout = this._wordLayout();
    if (!layout) return;
    const colors = this.getColors();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `${layout.fontPx}px "Amiri", Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Explicit RTL hint for the engine; canvas honors the string's
    // bidi codepoints either way, but this is documented behavior.
    if ("direction" in ctx) ctx.direction = "rtl";
    ctx.fillStyle = colors.strokeGhost;
    // yOffset shifts the EM-line midpoint so the ACTUAL ink center
    // (which can be asymmetric for Arabic words with high dots /
    // low descenders) sits at the canvas midpoint.
    ctx.fillText(this.text, layout.cx, layout.cy + (layout.yOffset || 0));
    ctx.restore();
  }
}
