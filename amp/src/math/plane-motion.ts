import type { PlaneMotion } from "./contracts";

/** The image of a point under a motion; every center is the origin. */
export function applyMotion(
  motion: PlaneMotion,
  p: { x: number; y: number },
): { x: number; y: number } {
  switch (motion.kind) {
    case "translate":
      return { x: p.x + motion.dx, y: p.y + motion.dy };
    case "reflect":
      return motion.axis === "x" ? { x: p.x, y: -p.y } : { x: -p.x, y: p.y };
    case "rotate":
      return motion.degrees === 90
        ? { x: -p.y, y: p.x }
        : motion.degrees === 180
          ? { x: -p.x, y: -p.y }
          : { x: p.y, y: -p.x };
    case "dilate":
      return {
        x: (p.x * motion.numerator) / motion.denominator,
        y: (p.y * motion.numerator) / motion.denominator,
      };
  }
}
