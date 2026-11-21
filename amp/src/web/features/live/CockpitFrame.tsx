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
 * moves. (The brief's 2fr/1fr rail can't hold the grid's twelve columns at
 * 1280 px: they need about 1,100 px.)
 */
export function CockpitFrame({
  control,
  totals,
  strip,
  roster,
  stickyTop = 0,
  height,
}: {
  control: ReactNode;
  /** Absent at rest: the control alone. */
  totals?: ReactNode;
  strip?: ReactNode;
  roster?: ReactNode;
  /** Px from the viewport's top where the bar sticks (under an app bar). */
  stickyTop?: number;
  /** The desktop frame's height, in CSS; by default the viewport under
   * `stickyTop`. */
  height?: string;
}) {
  const style = {
    "--live-sticky-top": `${stickyTop}px`,
    ...(height ? { "--live-frame-height": height } : {}),
  } as CSSProperties;
  return (
    <div className={styles.container} style={style}>
      <div
        className={styles.frame}
        data-live-frame=""
        data-resting={roster === undefined || undefined}
      >
        <div className={styles.control}>{control}</div>
        {totals !== undefined && <div className={styles.totals}>{totals}</div>}
        {strip !== undefined && <div className={styles.strip}>{strip}</div>}
        {roster !== undefined && <div className={styles.roster}>{roster}</div>}
      </div>
    </div>
  );
}
