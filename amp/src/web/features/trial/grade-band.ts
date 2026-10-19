/** The coarse grade band for analytics, from a frontier level. */
export function gradeBand(level: number) {
  const g = Math.round(level);
  if (g <= 0) return "K" as const;
  if (g <= 8) return String(g) as "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
  return (["algebra-1", "geometry", "algebra-2"] as const)[Math.min(g - 9, 2)]!;
}
