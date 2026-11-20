import { continuationUrl } from "../lib/funded-entry";

/**
 * A deployment without its own accounts hands its auth screens straight to
 * its external authority. Returns the address that hand-off leaves behind,
 * or `null` when the screen stays.
 *
 * - Accounts mode: the screen is AMP's own; it stays.
 * - A preload (a link to `/sign-in` under the pointer, `defaultPreload:
 *   "intent"`): nobody asked to go there yet. Navigating now would take the
 *   screen they are on (`/school/connect`'s "Sign in again" after a refused
 *   Clever link went to `/`).
 * - Otherwise: the gate's own continuation (`/school/connect`), so the
 *   authority's return lands back where sign-in was asked for. With none,
 *   `/`.
 */
export function externalSignInFrom(
  mode: string,
  { preload, search }: { preload: boolean; search: Record<string, unknown> },
): string | null {
  if (mode === "accounts" || preload) return null;
  return continuationUrl(search);
}
