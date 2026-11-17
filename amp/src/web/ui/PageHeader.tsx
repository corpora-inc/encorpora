import { Link } from "@tanstack/react-router";
import { useCloseClick } from "../nav/links";
import type { ReactNode, Ref } from "react";
import styles from "./PageHeader.module.css";

/** A header's way back: the screen's logical parent (an app address),
 * where it goes when there is no previous screen to go Back to; or a step
 * back within the screen itself (a receipt back to its list). */
export type PageBack = string | (() => void);

/**
 * A screen's header, the one anatomy every page uses: the way back on its
 * own row at the top left, always "‹ Back" (founder, 2026-11-16), going to
 * the previous screen or step; then the title in the app's serif, an optional subtitle under it,
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
  const close = useCloseClick(typeof back === "string" ? back : "/");
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
  const [path, query = ""] = back.split("?");
  return (
    // Back where the screen was opened, else to its parent; the parent's
    // address stays the link's own, for a new tab.
    <Link
      to={path as never}
      // The query apart from the path, so its keys stay search keys.
      search={Object.fromEntries(new URLSearchParams(query)) as never}
      className={styles.back}
      onClick={close}
    >
      {label}
    </Link>
  );
}
