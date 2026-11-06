import type { ReactNode } from "react";

/** The AMP wave. Two wavelengths wider than its box, so a loop joins cleanly. */
export const WAVE_PATH =
  "M-23 14C-19 0-15 0-11 14S-3 28 1 14S9 0 13 14S21 28 25 14S33 0 37 14S45 28 49 14S57 0 61 14S69 28 73 14";

export function Wave() {
  return (
    <svg className="amp-wave" viewBox="0 0 44 28" aria-hidden="true">
      <path d={WAVE_PATH} />
    </svg>
  );
}

/**
 * A wait inside a screen: the moving wave beside what is being fetched. It
 * fades in after a moment, so a fast response never flashes it, and it holds
 * its space from the first frame, so nothing moves when it appears.
 */
export function Loading({
  children,
  inline = false,
  className = "",
}: {
  children?: ReactNode;
  /** Inside a line of text or a heading, where a paragraph can't go. Whatever
   * holds it announces the wait. */
  inline?: boolean;
  className?: string;
}) {
  if (inline)
    return (
      <span className={`amp-loading amp-loading-inline ${className}`}>
        <Wave />
        <span>{children}</span>
      </span>
    );
  return (
    <p className={`amp-loading ${className}`} role="status" aria-busy="true">
      <Wave />
      {children && <span>{children}</span>}
    </p>
  );
}
