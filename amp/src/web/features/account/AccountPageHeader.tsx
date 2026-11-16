import type { ReactNode, Ref } from "react";
import { Link } from "@tanstack/react-router";
import styles from "./AccountPages.module.css";

export function AccountPageHeader({
  title,
  familyId,
  description,
  before,
  headingId,
  headingRef,
}: {
  title: string;
  familyId?: string | null;
  description?: ReactNode;
  before?: ReactNode;
  headingId?: string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className={styles.heading} data-account-heading>
      {before}
      <div className={styles.headingRow}>
        <h1
          id={headingId}
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className={styles.title}
        >
          {title}
        </h1>
        {familyId && (
          <Link
            to="/$"
            params={{ _splat: `family/${familyId}/settings` }}
            className={styles.settingsReturn}
          >
            ‹ Settings
          </Link>
        )}
      </div>
      {description && <p className={styles.lede}>{description}</p>}
    </div>
  );
}
