import { Link } from "@tanstack/react-router";
import type { ReactNode, Ref } from "react";
import styles from "./PageHeader.module.css";

/** A header's way back: "up" to the screen's logical parent, a route and
 * its params computed from canonical state (never history, never where the
 * screen was opened from; the browser's Back covers that), or a step back
 * within the screen itself (a receipt back to its list). */
export type PageBack =
  { to: string; params?: Record<string, string> } | (() => void);

/**
 * A screen's header, the one anatomy every page uses: the way back on its
 * own row at the top left, always "‹ Back" (founder, 2026-11-16), going up
 * to the screen's declared parent; then the title in the app's serif, an optional subtitle under it,
 * and optional actions at the right of the title (they wrap under it on a
 * phone). It is the first thing in a Page's column, so every screen's title
 * starts at the same place. `titleId` and `titleRef` let a screen label its
 * sections by the title and move focus to it after a change.
 */
export function PageHeader({
  back,
  title,
  subtitle,
  actions,
  titleId,
  titleRef,
}: {
  back?: PageBack | null;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  titleRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className={styles.header} data-page-header="">
      {back && <BackLink back={back} />}
      <div className={styles.row}>
        <div className={styles.heading}>
          <h1
            id={titleId}
            ref={titleRef}
            tabIndex={titleRef ? -1 : undefined}
            className={styles.title}
          >
            {title}
          </h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}

function BackLink({ back }: { back: PageBack }) {
  const label = (
    <>
      <span className={styles.chevron} aria-hidden="true">
        ‹
      </span>
      Back
    </>
  );
  if (typeof back === "function")
    return (
      <button type="button" className={styles.back} onClick={back}>
        {label}
      </button>
    );
  return (
    <Link
      to={back.to as never}
      params={back.params as never}
      className={styles.back}
    >
      {label}
    </Link>
  );
}
