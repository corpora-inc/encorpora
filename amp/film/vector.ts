/** Endpoint arrows, planned in display coordinates after all figure transforms.
 * Recomputing from endpoints and draw progress makes seeking order-independent.
 * A zero vector has no direction and therefore no arrowhead.
 */
export type VectorPoint = [number, number];
export type VectorPlan = {
  tail: VectorPoint;
  tip: VectorPoint;
  wings: [VectorPoint, VectorPoint];
};

export function planVector(tail: VectorPoint, head: VectorPoint, progress = 1, headSize = 20): VectorPlan | null {
  const u = Math.min(1, Math.max(0, progress));
  const dx = head[0] - tail[0], dy = head[1] - tail[1];
  const length = Math.hypot(dx, dy);
  if (length * u < 1e-8) return null;
  const ux = dx / length, uy = dy / length;
  const tip: VectorPoint = [tail[0] + dx * u, tail[1] + dy * u];
  // Short arrows and the start of a trace cannot grow a head behind the tail.
  const size = Math.min(Math.max(0, headSize), length * u * 0.4);
  const base: VectorPoint = [tip[0] - ux * size, tip[1] - uy * size];
  return {
    tail: [...tail], tip,
    wings: [
      [base[0] - uy * size * 0.52, base[1] + ux * size * 0.52],
      [base[0] + uy * size * 0.52, base[1] - ux * size * 0.52],
    ],
  };
}

/** One stroked path: the shaft and an open head, with the tip at the endpoint. */
export function vectorPath(p: VectorPlan | null): string {
  if (!p) return "";
  const xy = (v: VectorPoint) => `${v[0].toFixed(3)} ${v[1].toFixed(3)}`;
  return `M${xy(p.tail)}L${xy(p.tip)}M${xy(p.wings[0])}L${xy(p.tip)}L${xy(p.wings[1])}`;
}
