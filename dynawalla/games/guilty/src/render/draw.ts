/**
 * Line batching.
 *
 * Canvas2D's cost is dominated by state changes and by the number of
 * `stroke()` calls, not by the number of segments inside one path. A wireframe
 * husk is 18 edges; eight husks plus debris plus the seabed is several hundred
 * segments a frame. Pushed one at a time that is several hundred strokes and
 * the frame budget is gone; bucketed by (colour, width, alpha) it is a dozen.
 *
 * Buckets are reused across frames — `reset()` sets lengths to 0 rather than
 * dropping the arrays, so a steady-state frame allocates nothing.
 */

export type LineBatch = {
  push(x1: number, y1: number, x2: number, y2: number, color: string, width: number, alpha: number): void;
  flush(ctx: CanvasRenderingContext2D): void;
  reset(): void;
};

type Bucket = { color: string; width: number; alpha: number; pts: number[]; n: number };

export function makeLineBatch(): LineBatch {
  const buckets = new Map<string, Bucket>();
  const order: Bucket[] = [];

  return {
    push(x1, y1, x2, y2, color, width, alpha) {
      if (alpha <= 0.01) return;
      // Quantise alpha so a fading particle does not create a bucket per frame.
      const qa = Math.round(alpha * 12) / 12;
      if (qa <= 0) return;
      const qw = Math.round(width * 2) / 2;
      const key = `${color}|${qw}|${qa}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { color, width: qw, alpha: qa, pts: [], n: 0 };
        buckets.set(key, bucket);
        order.push(bucket);
      }
      const p = bucket.pts;
      p[bucket.n++] = x1;
      p[bucket.n++] = y1;
      p[bucket.n++] = x2;
      p[bucket.n++] = y2;
    },
    flush(ctx) {
      ctx.lineCap = "round";
      for (const bucket of order) {
        if (bucket.n === 0) continue;
        ctx.globalAlpha = bucket.alpha;
        ctx.strokeStyle = bucket.color;
        ctx.lineWidth = bucket.width;
        ctx.beginPath();
        const p = bucket.pts;
        for (let i = 0; i < bucket.n; i += 4) {
          ctx.moveTo(p[i], p[i + 1]);
          ctx.lineTo(p[i + 2], p[i + 3]);
        }
        ctx.stroke();
        bucket.n = 0;
      }
      ctx.globalAlpha = 1;
    },
    reset() {
      for (const bucket of order) bucket.n = 0;
    },
  };
}

/** Easing, by name, so the tuning is readable. */
export const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  inQuad: (t: number) => t * t,
  outBack: (t: number) => {
    const c = 2.2;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const p = 0.34;
    return Math.pow(2, -9 * t) * Math.sin(((t - p / 4) * (Math.PI * 2)) / p) + 1;
  },
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Frame-rate independent exponential approach. */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  target + (current - target) * Math.exp(-lambda * dt);
