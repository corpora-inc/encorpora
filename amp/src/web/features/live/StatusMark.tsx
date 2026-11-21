import { useState } from "react";
import type { LiveStatus } from "../../../schools/live/contracts";
import { STATUS_WORDS } from "./status-words";
import styles from "./StatusMark.module.css";

/** Each status's shape, so color is never the only difference: a dot
 * (working), a dot with a rising arrow (on a roll), a diamond with "!"
 * (needs help), a ring with a pause (quiet), a dashed ring (not signed in). */
function Shape({ status }: { status: LiveStatus }) {
  switch (status) {
    case "working":
      return <circle className={styles.fill} cx="12" cy="12" r="6.5" />;
    case "flying":
      return (
        <>
          <circle className={styles.fill} cx="12" cy="12" r="10" />
          <path
            className={styles.glyph}
            d="M12 17V7.5M7.75 11.5 12 7.25l4.25 4.25"
          />
        </>
      );
    case "struggling":
      return (
        <>
          <rect
            className={styles.fill}
            x="4.2"
            y="4.2"
            width="15.6"
            height="15.6"
            rx="2.6"
            transform="rotate(45 12 12)"
          />
          <path className={styles.glyph} d="M12 7.25v5.75" />
          <circle className={styles.dot} cx="12" cy="16.4" r="1.45" />
        </>
      );
    case "idle":
      return (
        <>
          <circle className={styles.ring} cx="12" cy="12" r="8.75" />
          <path className={styles.pause} d="M9.75 8.75v6.5M14.25 8.75v6.5" />
        </>
      );
    case "not_signed_in":
      return <circle className={styles.dashed} cx="12" cy="12" r="8.75" />;
  }
}

/**
 * A student's live status at a glance, readable across a room: a shape and
 * a color, changing in place (the box never changes size). It names itself
 * to assistive technology unless `decorative`, where the word beside it
 * already says it.
 */
export function StatusMark({
  status,
  size = "regular",
  decorative = false,
}: {
  status: LiveStatus;
  /** `regular` 22 px for grids; `large` 28 px for phone rows. */
  size?: "regular" | "large";
  decorative?: boolean;
}) {
  // A changed status settles in with a brief pop (none with reduced
  // motion); the first paint is still.
  const [seen, setSeen] = useState({ status, changes: 0 });
  if (seen.status !== status) setSeen({ status, changes: seen.changes + 1 });
  const words = STATUS_WORDS[status];
  return (
    <svg
      className={styles.mark}
      data-size={size}
      data-status={status}
      viewBox="0 0 24 24"
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : words.word}
    >
      {!decorative && <title>{words.word}</title>}
      <g
        key={seen.changes}
        className={seen.changes > 0 ? styles.changed : undefined}
      >
        <Shape status={status} />
      </g>
    </svg>
  );
}
