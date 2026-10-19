import { useEffect, useState } from "react";

const query = "(max-width: 419px)";
/** Phones lay figures out at a narrower width, so labels keep their size
 * instead of shrinking with the figure. Read before the first paint, so the
 * choice never shifts the page; it changes only when the viewport does. */
export function useCompact() {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const change = () => setCompact(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return compact;
}
/** The width a scene lays out at: its own, capped on phones. */
export const COMPACT_WIDTH = 300;
