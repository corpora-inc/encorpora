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
    // Trail: a soft, wide brush stroke that builds up behind the tip.
    ctx.strokeStyle = trailColor;
    ctx.lineWidth = 18 * dpr;
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
    // Pen tip — bright halo + solid center. The two-layer approach
    // makes the moving point pop against any background.
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(200, 169, 110, 0.5)";  // halo
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], 20 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tipColor;  // solid sumi-ink core
    ctx.beginPath();
    ctx.arc(tip[0], tip[1], 10 * dpr, 0, Math.PI * 2);
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
    // Halo + core mirrors the moving pen tip so dots feel like they
    // were placed by the same pen.
    const peak = Math.min(1, progress / 0.6);
    const r_core = (8 + peak * 4) * dpr;
    const r_halo = r_core + 10 * dpr;
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
    const layout = this._layoutSlots();
    const dpr = window.devicePixelRatio || 1;

    for (let i = 0; i < this.letters.length; i += 1) {
      const letter = this.letters[i];
      if (!letter || !letter.writer) continue;
      const slot = layout.slots[i];
      ctx.save();
      ctx.setTransform(slot.scale * dpr, 0, 0, slot.scale * dpr, slot.tx, slot.ty);
      ctx.fillStyle = colors.strokeGhost;
      for (const d of letter.writer.outline || []) {
        const path = buildPath2D(d);
        if (path) ctx.fill(path, "evenodd");
      }
      ctx.restore();
    }
  }

  /**
   * Pre-compute the per-letter slot transforms used by both
   * `redraw()` and `playStrokeOrder()`. Layout is RTL: slot 0 = the
   * first-written letter sits on the right.
   */
  _layoutSlots() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.ghostCanvas.width / dpr;
    const h = this.ghostCanvas.height / dpr;
    const padding = Math.min(w, h) * 0.06;
    const inner_w = w - padding * 2;
    const inner_h = h - padding * 2;
    const slot_w = inner_w / Math.max(1, this.letters.length);
    const slot_size = Math.min(slot_w * 0.92, inner_h);
    const slots = this.letters.map((_letter, i) => {
      const xCenter = w - padding - slot_w * (i + 0.5);
      const yCenter = h / 2;
      const scale = slot_size / VIEWBOX;
      return {
        scale,
        tx: (xCenter - slot_size / 2) * dpr,
        ty: (yCenter - slot_size / 2) * dpr,
      };
    });
    return { slots };
  }

  /**
   * Animate the canonical stroke order across every letter in the
   * current word, in RTL writing order (first-written rightmost,
   * last-written leftmost). Each letter's strokes are pre-projected
   * onto the canvas using its slot transform, then drawn through
   * the same per-stroke animation loop as `LetterTraceLayer`.
   *
   * Letters whose writers don't carry `scoring: "median"` data
   * (e.g. non-connector letters in initial/medial positions, which
   * don't exist typographically and fall back to the geometric
   * Amiri medians) are silently skipped — the next letter starts
   * after the prior letter's gap, so the pen "jumps" past them
   * without showing a fake animation.
   */
  playStrokeOrder({
    strokeDuration = 750,
    gapDuration = 200,
    letterGapMs = 350,
    holdMs = 1500,
  } = {}) {
    this.cancelAnimation();
    if (!this.fxCtx || !this.letters || !this.letters.length) return;
    const layout = this._layoutSlots();
    const dpr = window.devicePixelRatio || 1;

    // Build per-letter projected stroke lists, skipping letters
    // without real Calliar-derived medians.
    const letterPlans = [];
    for (let i = 0; i < this.letters.length; i += 1) {
      const letter = this.letters[i];
      const w = letter && letter.writer;
      if (!w || w.scoring !== "median" || !Array.isArray(w.medians) || !w.medians.length) {
        continue;
      }
      const slot = layout.slots[i];
      const projected = w.medians.map((m) =>
        m.map(([x, y]) => [x * slot.scale * dpr + slot.tx, y * slot.scale * dpr + slot.ty]),
      );
      // Pre-compute cumulative segment lengths per stroke.
      const cumLens = projected.map((seg) => {
        const lens = [0];
        for (let s = 1; s < seg.length; s += 1) {
          lens.push(lens[s - 1] + Math.hypot(seg[s][0] - seg[s - 1][0], seg[s][1] - seg[s - 1][1]));
        }
        return lens;
      });
      const totalLens = cumLens.map((c) => c[c.length - 1]);
      // Duration per stroke — dots get the shorter pulse like the
      // letter-mode animation.
      const stepDur = projected.map((seg) =>
        seg.length <= 1 ? Math.round(strokeDuration * 0.45) : strokeDuration,
      );
      letterPlans.push({ projected, cumLens, totalLens, stepDur });
    }
    if (!letterPlans.length) return;

    // Total run time = sum of all step durations + intra-letter gaps
    // + inter-letter gaps.
    let totalDur = 0;
    for (let l = 0; l < letterPlans.length; l += 1) {
      const plan = letterPlans[l];
      for (let s = 0; s < plan.projected.length; s += 1) {
        totalDur += plan.stepDur[s];
        if (s < plan.projected.length - 1) totalDur += gapDuration;
      }
      if (l < letterPlans.length - 1) totalDur += letterGapMs;
    }

    const colors = this.getColors();
    const trailColor = colors.strokeHighlight || "rgba(139, 105, 20, 0.85)";
    const tipColor = colors.strokeUser || "#1a1410";

    this._animOpId += 1;
    const opId = this._animOpId;
    const startedAt = performance.now();

    const tick = (now) => {
      if (opId !== this._animOpId) return;
      const elapsed = now - startedAt;
      this._clearFx();
      let cursor = 0;
      for (let l = 0; l < letterPlans.length; l += 1) {
        const plan = letterPlans[l];
        for (let s = 0; s < plan.projected.length; s += 1) {
          const startT = cursor;
          const dur = plan.stepDur[s];
          cursor += dur;
          if (s < plan.projected.length - 1) cursor += gapDuration;
          const localT = (elapsed - startT) / dur;
          const progress = Math.max(0, Math.min(1, localT));
          if (progress <= 0) continue;
          if (plan.projected[s].length === 1) {
            this._drawAnimatedDot(plan.projected[s][0], progress, tipColor);
          } else {
            this._drawAnimatedStroke(
              plan.projected[s],
              plan.cumLens[s],
              plan.totalLens[s],
              progress,
              trailColor,
              tipColor,
            );
          }
        }
        if (l < letterPlans.length - 1) cursor += letterGapMs;
      }
      if (elapsed >= totalDur) {
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
}
