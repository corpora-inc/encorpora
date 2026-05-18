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
