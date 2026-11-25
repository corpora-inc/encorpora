import type { CSSProperties, ReactNode } from "react";
import styles from "./CockpitFrame.module.css";

/**
 * Where the live session's parts sit, so every screen that composes them
 * (a class's Today, a family's Today) gets the same fixed geometry.
 *
 * Phone and tablet: the control bar, the totals, the "Needs you" strip,
 * then the rows, in the page's one scroll; the bar and the strip stay in
 * view under `stickyTop` as the rows scroll under them.
 *
 * Desktop (960 px of frame and up): the control and the totals share one
 * band, the strip runs under them, and the roster fills the rest of the
 * frame's fixed height and scrolls inside it. Fourteen rows show on a
 * laptop; thirty-five scroll inside the same frame, and nothing above them
 * moves. (The brief's 2fr/1fr rail can't hold the grid: its columns need
 * the frame's whole 960 px, and the skill's name takes what is spare.)
 */
export function CockpitFrame({
  control,
  totals,
  strip,
  roster,
  stickyTop = 0,
  height,
  flow = false,
}: {
  control: ReactNode;
  /** Absent at rest: the control alone. */
  totals?: ReactNode;
  strip?: ReactNode;
  roster?: ReactNode;
  /** Where the bar sticks, from the viewport's top (under an app bar): px,
   * or a CSS length ("var(--shell-bar)"). */
  stickyTop?: number | string;
  /** The desktop frame's height, in CSS; by default the viewport under
   * `stickyTop`. */
  height?: string;
  /** A short roster (a family's): on a desktop too, the rows follow the
   * bar and the totals at their own height; the frame is never a fixed box
   * with a roster scrolling inside it. */
  flow?: boolean;
}) {
  const style = {
    "--live-sticky-top":
      typeof stickyTop === "number" ? `${stickyTop}px` : stickyTop,
    ...(height ? { "--live-frame-height": height } : {}),
  } as CSSProperties;
  return (
    <div className={styles.container} style={style}>
      <div
        className={styles.frame}
        data-live-frame=""
        data-resting={roster === undefined || undefined}
        data-flow={flow || undefined}
      >
        <div className={styles.control}>{control}</div>
        {totals !== undefined && <div className={styles.totals}>{totals}</div>}
        {strip !== undefined && <div className={styles.strip}>{strip}</div>}
        {roster !== undefined && <div className={styles.roster}>{roster}</div>}
      </div>
    </div>
  );
}
