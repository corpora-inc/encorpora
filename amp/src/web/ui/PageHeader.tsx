import type { ReactNode, Ref } from "react";
import styles from "./PageHeader.module.css";

/**
 * A screen's header, the one anatomy every page uses: the title in the
 * app's serif, an optional subtitle under it,
 * and optional actions at the right of the title (they wrap under it on a
 * phone). It is the first thing in a Page's column, so every screen's title
 * starts at the same place. There is no in-page Back: tabs, menus and the
 * browser navigate, a flow shows ui/FlowSteps, and a contextual screen is
 * an overlay that closes to the screen behind it. `titleId` and `titleRef` let a screen label its
 * sections by the title and move focus to it after a change.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  titleId,
  titleRef,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  titleRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className={styles.header} data-page-header="">
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
