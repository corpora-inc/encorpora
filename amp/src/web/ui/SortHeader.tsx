import styles from "./SortHeader.module.css";

export type SortDirection = "ascending" | "descending";

/** What a column header tells assistive technology about its sort. */
export const ariaSort = (
  sortable: boolean,
  direction: SortDirection | undefined,
): "ascending" | "descending" | "none" | undefined =>
  !sortable ? undefined : (direction ?? "none");

/**
 * A sortable column's name: quiet text with a chevron a few pixels after it.
 * The chevron shows the direction once the column is sorted and hints on
 * hover otherwise; its room is always kept, so sorting never moves the label.
 * The header cell carries `aria-sort` (see `ariaSort`); this is its button.
 * The focus ring is the standard ring, outside the text, never a filled box.
 */
export function SortHeader({
  label,
  direction,
  align = "start",
  onSort,
}: {
  label: string;
  /** Set when this column is the sort. */
  direction?: SortDirection;
  align?: "start" | "end";
  onSort: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.sort}
      data-align={align}
      data-sorted={direction ?? undefined}
      onClick={onSort}
    >
      <span className={styles.label}>{label}</span>
      <svg className={styles.chevron} viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3 4.5 6 7.5l3-3" />
      </svg>
    </button>
  );
}
