import { Link, useRouterState } from "@tanstack/react-router";
import type { FamilyPlace } from "./FamilyFrame";
import styles from "./Family.module.css";

/** Related records stay beside the record, without becoming family tabs. */
export function FamilyRecordLinks({ place }: { place: FamilyPlace }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const base = `family/${place.family}`;
  const leaf = pathname.slice(base.length + 2);
  const children = place.data?.children ?? [];
  const child = /^kids\/[^/]+$/.test(leaf);
  const time = leaf === "time";
  const reports = leaf === "reports" || leaf.startsWith("reports/");
  const workbooks = leaf === "workbooks" || leaf.startsWith("workbooks/");
  if (!place.data || !(child || time || reports || workbooks || leaf === "map"))
    return null;
  const overview =
    children.length === 1 ? `${base}/kids/${children[0]!.id}` : `${base}/map`;
  return (
    <nav className={styles.recordLinks} aria-label="Progress records">
      {(time || reports || workbooks || (child && children.length > 1)) && (
        <Link
          to="/$"
          params={{ _splat: overview }}
          className={styles.recordBack}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m10 3-5 5 5 5" />
          </svg>
          {child ? "All children" : "Progress"}
        </Link>
      )}
      <span className={styles.recordRelated}>
        {!time && (
          <Link to="/$" params={{ _splat: `${base}/time` }}>
            Practice time
          </Link>
        )}
        {!reports && (
          <Link to="/$" params={{ _splat: `${base}/reports` }}>
            Report cards
          </Link>
        )}
        {!workbooks &&
          !child &&
          children.some((entry) => entry.capabilities.readWorkbooks) && (
            <Link to="/$" params={{ _splat: `${base}/workbooks` }}>
              Workbooks
            </Link>
          )}
      </span>
    </nav>
  );
}
