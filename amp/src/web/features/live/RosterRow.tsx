import type { ReactNode } from "react";
import styles from "./RosterRow.module.css";

/** What opens a student: the screen's own link primitive (EntityLink with
 * the student entity), drawn around the row's content. */
export type StudentLink = (props: {
  personId: string;
  name: string;
  className: string;
  children: ReactNode;
}) => ReactNode;

/**
 * One student in the live roster on a phone or tablet: the status mark,
 * the name over one line of detail, then the facts at the end. Its height
 * is fixed (64 px phone, 56 px tablet), so a long name or a changing
 * figure never moves the rows below it.
 *
 * Its props match the shared learner row's slots (name, mark, facts,
 * action), so it can be swapped for it without touching LiveRoster.
 */
export function RosterRow({
  personId,
  name,
  mark,
  detail,
  badge,
  aside,
  facts,
  density,
  link,
}: {
  personId: string;
  name: string;
  /** The status-mark slot. */
  mark: ReactNode;
  /** One line under the name. */
  detail: ReactNode;
  /** Beside the name, in a fixed slot: an open request. */
  badge?: ReactNode;
  /** At the end of the name's line, in a fixed width of its own: a screen's
   * small marks (a family's "help opened" on a phone). The name stops
   * before it, so what shows there moves nothing. */
  aside?: ReactNode;
  /** The end of the row: fixed-width figures. */
  facts: ReactNode;
  density: "phone" | "tablet";
  /** Opens the student; without it the row is not a link. */
  link?: StudentLink;
}) {
  const body = (
    <>
      <span className={styles.mark}>{mark}</span>
      <span className={styles.who}>
        <span className={styles.nameLine}>
          <span className={styles.name}>{name}</span>
          <span className={styles.badge}>{badge}</span>
          {aside ? <span className={styles.aside}>{aside}</span> : null}
        </span>
        <span className={styles.detail}>{detail}</span>
      </span>
      <span className={styles.facts}>{facts}</span>
    </>
  );
  return (
    <li className={styles.row} data-density={density} data-live-row={personId}>
      {link ? (
        link({ personId, name, className: styles.body, children: body })
      ) : (
        <div className={styles.body}>{body}</div>
      )}
    </li>
  );
}
