/**
 * Rasmapan — stroke scoring.
 *
 * Two scoring modes:
 *   - "median": Hanzipan-style — the target stroke has a polyline
 *     ("median") through it. Each user-stroke sample point is
 *     compared to the nearest median segment. A user stroke is
 *     "good" if (a) its endpoints land near the median endpoints
 *     and (b) the average min-distance from samples to median is
 *     under a threshold relative to the median's length.
 *   - "outline": the glyph has only an outline polygon, no median.
 *     Score by how many user-stroke samples land inside the
 *     outline's bounding polygon. Permissive — for v0.1.0 every
 *     letter traces, even if scoring quality varies.
 *
 * All canvas geometry uses the 0..1000 viewBox the builder emits,
 * mapped to layout-pixel space by the trace layer.
 */

const distSq = (ax, ay, bx, by) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

const segmentDistance = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.sqrt(distSq(px, py, ax, ay));
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return Math.sqrt(distSq(px, py, qx, qy));
};

const polylineLength = (pts) => {
  let total = 0;
  for (let i = 1; i < pts.length; i += 1) {
    total += Math.sqrt(distSq(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  }
  return total;
};

export const minDistanceToPolyline = (px, py, pts) => {
  if (!pts || pts.length === 0) return Infinity;
  if (pts.length === 1) return Math.sqrt(distSq(px, py, pts[0][0], pts[0][1]));
  let best = Infinity;
  for (let i = 1; i < pts.length; i += 1) {
    const d = segmentDistance(
      px, py,
      pts[i - 1][0], pts[i - 1][1],
      pts[i][0], pts[i][1],
    );
    if (d < best) best = d;
  }
  return best;
};

/**
 * Score a user stroke against a median polyline. Both are in the
 * same coordinate space (0..1000 viewBox).
 * Returns { quality: 0..1, accepted: boolean }.
 */
export const scoreAgainstMedian = (userPoints, median) => {
  if (!userPoints || userPoints.length < 2) {
    return { quality: 0, accepted: false };
  }
  if (!median || median.length < 2) {
    return { quality: 0, accepted: false };
  }

  const medianLen = polylineLength(median);
  const userLen = polylineLength(userPoints);

  // Endpoint proximity: start and end of the user stroke should be
  // somewhere near either end of the median. We don't require the
  // user to draw in a specific direction — they get full credit
  // either way.
  const startNear = Math.min(
    Math.sqrt(distSq(userPoints[0][0], userPoints[0][1], median[0][0], median[0][1])),
    Math.sqrt(distSq(userPoints[0][0], userPoints[0][1], median[median.length - 1][0], median[median.length - 1][1])),
  );
  const endNear = Math.min(
    Math.sqrt(distSq(userPoints[userPoints.length - 1][0], userPoints[userPoints.length - 1][1], median[0][0], median[0][1])),
    Math.sqrt(distSq(userPoints[userPoints.length - 1][0], userPoints[userPoints.length - 1][1], median[median.length - 1][0], median[median.length - 1][1])),
  );

  // Mean distance from each sample to the median.
  let sumDist = 0;
  for (const p of userPoints) {
    sumDist += minDistanceToPolyline(p[0], p[1], median);
  }
  const meanDist = sumDist / userPoints.length;

  // Permissive thresholds (in 0..1000 viewBox units).
  const TOL_END = 220;
  const TOL_MEAN = 140;
  const LEN_RATIO_MIN = 0.5;
  const LEN_RATIO_MAX = 2.4;

  const endpointGood = startNear < TOL_END && endNear < TOL_END;
  const trackingGood = meanDist < TOL_MEAN;
  const lengthRatio = medianLen > 1 ? userLen / medianLen : 1;
  const lengthGood =
    lengthRatio >= LEN_RATIO_MIN && lengthRatio <= LEN_RATIO_MAX;

  const accepted = endpointGood && trackingGood && lengthGood;
  // Quality 0..1 — soft combination, useful for the score bar fill.
  const q1 = Math.max(0, 1 - meanDist / TOL_MEAN);
  const q2 = Math.max(
    0,
    1 - Math.max(startNear, endNear) / TOL_END,
  );
  const q3 = Math.max(0, 1 - Math.abs(lengthRatio - 1));
  const quality = Math.max(0, Math.min(1, (q1 * 0.5 + q2 * 0.3 + q3 * 0.2)));
  return { quality, accepted };
};

/**
 * Score a user stroke against a glyph outline by checking how many
 * sample points fall inside the outline polygon (computed from the
 * outline's bounding box of sampled points). Very permissive — used
 * when no precise median exists.
 *
 * `bbox` is [xmin, ymin, xmax, ymax] in viewBox coords.
 */
export const scoreAgainstBbox = (userPoints, bbox) => {
  if (!userPoints || userPoints.length < 2 || !bbox) {
    return { quality: 0, accepted: false };
  }
  const [xmin, ymin, xmax, ymax] = bbox;
  const padX = (xmax - xmin) * 0.25 + 60;
  const padY = (ymax - ymin) * 0.25 + 60;
  let inside = 0;
  for (const [x, y] of userPoints) {
    if (
      x >= xmin - padX &&
      x <= xmax + padX &&
      y >= ymin - padY &&
      y <= ymax + padY
    ) {
      inside += 1;
    }
  }
  const ratio = inside / userPoints.length;
  const minLen = Math.min(xmax - xmin, ymax - ymin) * 0.25;
  const userLen = polylineLength(userPoints);
  const lengthGood = userLen >= Math.max(60, minLen);
  return {
    quality: Math.max(0, Math.min(1, ratio)),
    accepted: ratio >= 0.7 && lengthGood,
  };
};

/**
 * Top-level scorer — picks median vs. outline based on the writer
 * record's `scoring` field, with a median per stroke (matched by
 * index) or a fallback bbox.
 */
export const scoreStroke = (userPoints, writer, strokeIndex) => {
  if (!writer) return { quality: 0, accepted: false };
  if (writer.scoring === "median" && Array.isArray(writer.medians)) {
    const median = writer.medians[strokeIndex];
    if (median && median.length >= 2) {
      return scoreAgainstMedian(userPoints, median);
    }
  }
  return scoreAgainstBbox(userPoints, writer.bbox || [0, 0, 1000, 1000]);
};

/**
 * v0.3 "your turn" — score the user's WHOLE free-drawing composition
 * against the target glyph's outline polygon. Combines two metrics:
 *
 *   - **precision**: fraction of user points that land INSIDE the
 *     outline polygon (i.e. the strokes hit the letter shape).
 *   - **coverage**: fraction of probe points sampled along the outline
 *     edge that have a user point within `RECALL_TOL` viewBox units
 *     (i.e. the user actually drew the WHOLE letter, not just one
 *     corner).
 *
 * Pure JS, no recognition model. Works for any writer that has at
 * least one outline path. The caller passes in:
 *   - `userStrokesView` — list of strokes in 0..1000 viewBox space
 *     (use trace.js's _canvasToView to convert).
 *   - `writer` — the writer record with outline + bbox.
 *
 * Returns `{ quality, precision, coverage, message }`. `quality` is
 * a 0..1 score suitable for the score bar; `message` is a localized-
 * agnostic short status string the caller can show as a banner.
 */
const VIEWBOX = 1000;
const RECALL_TOL = 90;          // viewBox units — "pen passes near here"
const PROBE_COUNT = 80;          // sample density along the outline

// Pre-compute a list of (x, y) probe points sampled along an SVG path
// `d`. We use a hidden Path2D rendered to an offscreen canvas at
// 1000x1000 and then walk a sparse grid for cells the path touches.
// Cheap and good enough — exact arclength sampling would be more work
// and isn't needed for an inexact match score.
const sampleOutlinePoints = (writer) => {
  if (!writer || !Array.isArray(writer.outline) || !writer.outline.length) {
    return [];
  }
  const canvas = document.createElement("canvas");
  canvas.width = VIEWBOX;
  canvas.height = VIEWBOX;
  const ctx = canvas.getContext("2d");
  // Render the outline as a filled silhouette in solid red — we walk
  // its boundary by sampling pixels and finding edges.
  ctx.fillStyle = "#ff0000";
  for (const d of writer.outline) {
    try {
      const p = new Path2D(d);
      ctx.fill(p, "evenodd");
    } catch {
      // ignore unparseable paths
    }
  }
  // Sample a grid. For each grid cell, check if it's an EDGE pixel:
  // one of its 4 neighbors is empty while the cell itself is filled.
  const step = Math.max(8, Math.floor(VIEWBOX / Math.sqrt(PROBE_COUNT * 12)));
  const probes = [];
  const img = ctx.getImageData(0, 0, VIEWBOX, VIEWBOX).data;
  const filled = (x, y) =>
    x >= 0 && x < VIEWBOX && y >= 0 && y < VIEWBOX &&
    img[(y * VIEWBOX + x) * 4 + 3] > 0;
  for (let y = 0; y < VIEWBOX; y += step) {
    for (let x = 0; x < VIEWBOX; x += step) {
      if (!filled(x, y)) continue;
      if (
        !filled(x - step, y) ||
        !filled(x + step, y) ||
        !filled(x, y - step) ||
        !filled(x, y + step)
      ) {
        probes.push([x, y]);
      }
    }
  }
  return probes;
};

// Build an isPointInPath tester from the writer's outline.
const makeOutlineTester = (writer) => {
  if (!writer || !Array.isArray(writer.outline) || !writer.outline.length) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = VIEWBOX;
  canvas.height = VIEWBOX;
  const ctx = canvas.getContext("2d");
  const paths = [];
  for (const d of writer.outline) {
    try { paths.push(new Path2D(d)); } catch { /* ignore */ }
  }
  if (!paths.length) return null;
  return (x, y) => {
    for (const p of paths) {
      if (ctx.isPointInPath(p, x, y, "evenodd")) return true;
    }
    return false;
  };
};

// --- Shared Arabic-text fitting (used by WordTraceLayer + scoring) ----
//
// fitArabicText sizes an Arabic string to fit inside (innerW × innerH).
//
// Width: uses `m.width` from `measureText` — reliable across all
// WebViews.
//
// Height: uses an empirical 1.6 × fontPx multiplier instead of
// `actualBoundingBoxAscent` / `Descent`. The modern metrics SHOULD
// return per-string ink height but in practice many Tauri WebKit /
// Blink builds return font-design ascent (~1.0 × fontPx) instead,
// under-reporting Arabic glyphs with marks above the body (ث, ش,
// خبز) and descenders below. 1.6× is a conservative upper bound
// for Amiri's ink extent including dots-above + descenders-below.
// Picking a fixed ratio yields predictable rendering on every
// WebView at the cost of words being slightly smaller than optimal
// on cooperative engines.
//
// Returns: { fontPx, yOffset } for use with textAlign="center" +
// textBaseline="middle". `yOffset` shifts the EM-line midpoint
// down a bit so Arabic glyphs (whose ink center sits below the
// EM middle because of the high marks zone) end up visually
// centered.
//
// Usage:
//   ctx.font = `${fit.fontPx}px "Amiri", Georgia, serif`;
//   ctx.fillText(text, cx, cy + fit.yOffset);
const ARABIC_HEIGHT_RATIO = 1.6;
const ARABIC_Y_OFFSET_RATIO = 0.10;  // ~half of (ascent-descent)/h

export const fitArabicText = (ctx, text, innerW, innerH) => {
  if (!text || innerW <= 0 || innerH <= 0) return null;
  const FONT = (px) => `${px}px "Amiri", Georgia, serif`;
  // Probe at a reasonable size to measure width. We pick a probe
  // size that should comfortably fit innerH (innerH / 1.6) so the
  // probe measurement is well-formed.
  const probePx = innerH / ARABIC_HEIGHT_RATIO;
  ctx.font = FONT(probePx);
  const m = ctx.measureText(text);
  const probeW = m.width;
  if (probeW <= 0) return null;
  // Compute the scale that fits both axes. Width via measured
  // probeW (linear in fontPx). Height via the empirical ratio.
  const scaleW = innerW / probeW;
  const scaleH = innerH / (probePx * ARABIC_HEIGHT_RATIO);
  // scaleH is always 1.0 by construction (probePx was chosen so it
  // exactly fits innerH); the real constraint is scaleW. Pick the
  // smaller so width-limited words shrink.
  const scale = Math.min(scaleW, scaleH);
  const fontPx = probePx * scale;
  const realH = fontPx * ARABIC_HEIGHT_RATIO;
  // yOffset: with textBaseline="middle", the EM-line midpoint sits
  // at `y`. Arabic ink center is below that midpoint because the
  // ink extends further up (marks above the body) than down. Shift
  // y down by ~10% of realH so the ink center coincides with the
  // canvas center.
  const yOffset = realH * ARABIC_Y_OFFSET_RATIO;
  return { fontPx, yOffset, realW: probeW * scale, realH };
};

// --- Word-text target (v0.4) ------------------------------------------
//
// Words mode renders the ghost as canvas `fillText` with the Amiri
// font instead of slotting per-letter SVG outlines. For "Score me"
// in Words mode we rasterize the same text to an offscreen canvas
// at the SAME aspect ratio as the on-screen ghost canvas, and reuse
// the precision + coverage flow against the rasterized mask. Aspect
// matching is required so the user's strokes (passed in
// `canvasToView` CSS pixels — see `WordTraceLayer._canvasToView`)
// line up with the rasterized text positions.
const rasterizeWordText = (text, width, height) => {
  const W = Math.max(32, Math.round(width || VIEWBOX));
  const H = Math.max(32, Math.round(height || VIEWBOX));
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const margin = Math.min(W, H) * 0.06;
  const innerW = W - 2 * margin;
  const innerH = H - 2 * margin;
  const fit = fitArabicText(ctx, text, innerW, innerH);
  if (!fit) {
    return { mask: new Uint8ClampedArray(W * H * 4), width: W, height: H };
  }
  ctx.font = `${fit.fontPx}px "Amiri", Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if ("direction" in ctx) ctx.direction = "rtl";
  ctx.fillStyle = "#ff0000";
  ctx.fillText(text, W / 2, H / 2 + fit.yOffset);
  return { mask: ctx.getImageData(0, 0, W, H).data, width: W, height: H };
};

const makeTextTester = (maskData, W, H) => (x, y) => {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return false;
  return maskData[(iy * W + ix) * 4 + 3] > 0;
};

const sampleTextProbes = (maskData, W, H) => {
  const refDim = Math.min(W, H);
  const step = Math.max(8, Math.floor(refDim / Math.sqrt(PROBE_COUNT * 12)));
  const probes = [];
  const filled = (x, y) =>
    x >= 0 && x < W && y >= 0 && y < H &&
    maskData[(y * W + x) * 4 + 3] > 0;
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      if (!filled(x, y)) continue;
      if (
        !filled(x - step, y) ||
        !filled(x + step, y) ||
        !filled(x, y - step) ||
        !filled(x, y + step)
      ) {
        probes.push([x, y]);
      }
    }
  }
  return probes;
};

// --- Generic score-me ------------------------------------------------
//
// `target` can be either:
//   { kind: "writer", writer }                       — letter outline (v0.3)
//   { kind: "text",   text, width, height }          — word fillText (v0.4)
// or a bare writer object for backwards compat with v0.3 callers.
// Returns { isInside, probes, recallTol } — recallTol is scaled
// proportionally for word targets where the canvas isn't 1000-tall.
const buildTesterAndProbes = (target) => {
  // Backwards-compat: bare writer object as second arg.
  if (target && target.outline && !target.kind) {
    return {
      isInside: makeOutlineTester(target),
      probes: sampleOutlinePoints(target),
      recallTol: RECALL_TOL,
    };
  }
  if (target && target.kind === "writer" && target.writer) {
    return {
      isInside: makeOutlineTester(target.writer),
      probes: sampleOutlinePoints(target.writer),
      recallTol: RECALL_TOL,
    };
  }
  if (target && target.kind === "text" && target.text) {
    const { mask, width, height } = rasterizeWordText(
      target.text, target.width, target.height,
    );
    // Scale the recall tolerance so it represents the same fraction
    // of the canvas's shorter dimension as in letter mode (where the
    // shorter dim is VIEWBOX = 1000 and tol = 90 → 9%).
    const refDim = Math.min(width, height);
    const tol = (RECALL_TOL / VIEWBOX) * refDim;
    return {
      isInside: makeTextTester(mask, width, height),
      probes: sampleTextProbes(mask, width, height),
      recallTol: tol,
    };
  }
  return { isInside: null, probes: [], recallTol: RECALL_TOL };
};

export const scoreFreeDrawing = (userStrokesView, target) => {
  if (!target || !userStrokesView || !userStrokesView.length) {
    return { quality: 0, precision: 0, coverage: 0, message: "draw_to_score" };
  }
  // Flatten user strokes into a single point cloud.
  const userPoints = [];
  for (const s of userStrokesView) {
    for (const p of s) userPoints.push([p[0], p[1]]);
  }
  if (userPoints.length < 6) {
    return { quality: 0, precision: 0, coverage: 0, message: "draw_to_score" };
  }

  const { isInside, probes, recallTol } = buildTesterAndProbes(target);

  let inside = 0;
  if (isInside) {
    for (const [x, y] of userPoints) {
      if (isInside(x, y)) inside += 1;
    }
  }
  const precision = isInside ? inside / userPoints.length : 0;

  // Coverage: probe points along the target edge; for each, was
  // there a user point within recallTol? recallTol is scaled per-target
  // (smaller for short word canvases so the same physical pen-width
  // covers the same fraction of the glyph).
  const tolSq = recallTol * recallTol;
  let recallHits = 0;
  if (probes.length) {
    for (const [px, py] of probes) {
      let hit = false;
      for (const [ux, uy] of userPoints) {
        const dx = ux - px;
        const dy = uy - py;
        if (dx * dx + dy * dy < tolSq) {
          hit = true;
          break;
        }
      }
      if (hit) recallHits += 1;
    }
  }
  const coverage = probes.length ? recallHits / probes.length : 0;

  // Quality: weighted toward coverage (don't reward scribbling inside
  // one corner of the target and ignoring the rest). 60% coverage,
  // 40% precision. Capped at 0..1.
  const quality = Math.max(0, Math.min(1, 0.6 * coverage + 0.4 * precision));

  let message = "ok";
  if (quality < 0.35) message = "try_again";
  else if (quality < 0.65) message = "getting_there";
  else if (quality < 0.85) message = "good_match";
  else message = "great_match";

  return { quality, precision, coverage, message };
};
