import { isCancelledError } from "@tanstack/react-query";

/**
 * A read or a screen's code asked for ahead of its screen that didn't
 * arrive. The screen asks again itself and says so in place; this is the
 * log's line for it (noisy errors: every real failure is logged).
 *
 * A read that was only cancelled is not a failure and says nothing: its
 * observer unmounted while it was on its way (the person moved on), or a
 * newer ask took its place (TanStack Query's `CancelledError`). Logging it
 * told a calm page it had an error.
 *
 * Every "didn't load ahead" and "did not preload" catch goes through here.
 */
export function logAhead(
  what: string,
  error: unknown,
  level: "warn" | "error" = "warn",
  ...context: unknown[]
): void {
  if (isCancelledError(error)) return;
  console[level](what, ...context, error);
}
