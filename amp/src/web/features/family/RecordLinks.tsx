import { Link, useRouterState } from "@tanstack/react-router";
import type { FamilyPlace } from "./FamilyFrame";
import styles from "./Family.module.css";

/** Where a progress record is, from the open address: the family's page
 * leaf, and which record it is. */
function useRecord(place: FamilyPlace) {
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
  const record =
    !!place.data && (child || time || reports || workbooks || leaf === "map");
  return { base, children, child, time, reports, workbooks, record };
}

/** Related records stay beside the record, without becoming family tabs. */
export function FamilyRecordLinks({ place }: { place: FamilyPlace }) {
  const { base, children, child, time, reports, workbooks, record } =
    useRecord(place);
  if (!record) return null;
  return (
    <nav className={styles.recordLinks} aria-label="Progress records">
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
    </nav>
  );
}
