import { readyLazy } from "../../lib/ready-lazy";
import { useSessionOrNull } from "../../lib/session";

/** The raised hand's code loads only for a school student's practice: the
 * route's loader fetches it ahead of the screen (app/router.tsx, `/$`), so
 * the practice bar paints with it, and a parent's or adult's practice never
 * downloads it. Nothing paints in its place meanwhile. */
const hand = readyLazy<Record<string, never>>(
  async () => (await import("./RaiseHand")).RaiseHand,
  "The raised hand",
);
export const preloadRaiseHand = hand.preload;
const RaiseHandCode = hand.Component;
/** The practice bar's raised hand: a school student's session only. */
export function StudentHand() {
  const session = useSessionOrNull();
  return session?.token.startsWith("st_") ? <RaiseHandCode /> : null;
}
