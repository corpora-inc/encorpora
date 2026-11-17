import { Link } from "@tanstack/react-router";
import type { ReactNode, Ref } from "react";
import styles from "./PageHeader.module.css";

/** A header's way back: to the screen it names, or a step back in place
 * (a receipt back to its list, a close that goes Back). */
export type PageBack = { label: string } & (
  { to: string } | { onClick: () => void }
);

/**
 * A screen's header, the one anatomy every page uses: the way back on its
 * own row at the top left ("‹ Settings", named for the screen it returns
 * to), then the title in the app's serif, an optional subtitle under it,
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
      {back.label}
    </>
  );
  if ("onClick" in back)
    return (
      <button type="button" className={styles.back} onClick={back.onClick}>
        {label}
      </button>
    );
  const [path, query = ""] = back.to.split("?");
  return (
    <Link
      to={path as never}
      // The query apart from the path, so its keys stay search keys.
      search={Object.fromEntries(new URLSearchParams(query)) as never}
      className={styles.back}
    >
      {label}
    </Link>
  );
}
