/**
 * The clock school reads take "today" from. Production always reads the wall
 * clock. A local preview or test may pin it with AMP_SCHOOL_NOW (an ISO
 * instant), so the views of a given week, mid-week, can be seen on
 * any day; set anywhere else, the server refuses to start rather than report
 * a made-up day.
 */
export function schoolClock(env: {
  AMP_SCHOOL_NOW?: string;
  NODE_ENV?: string;
  AMP_HOST?: string;
}): (() => Date) | undefined {
  const pinned = env.AMP_SCHOOL_NOW;
  if (!pinned) return undefined;
  const loopback = ["127.0.0.1", "::1"].includes(env.AMP_HOST ?? "127.0.0.1");
  if (env.NODE_ENV === "production" || !loopback)
    throw new Error("AMP_SCHOOL_NOW is for a local preview or test only");
  const at = new Date(pinned);
  if (Number.isNaN(at.getTime()))
    throw new Error(`AMP_SCHOOL_NOW is not a date: ${pinned}`);
  return () => at;
}
