import {
  createContext,
  useContext,
  type CSSProperties,
  type ReactNode,
} from "react";
import styles from "./ColumnList.module.css";

/**
 * One column of a ColumnList: its key in each row's `cells`, its width as a
 * grid track from 720 px up (`minmax(0, 1fr)`, `auto`…), and its part in
 * the row. The `title` names the row (a child's name) and the `action` is
 * the row's one action; every other column is a figure.
 */
export type Column = {
  key: string;
  track: string;
  part?: "title" | "action";
};

const ColumnsContext = createContext<readonly Column[]>([]);

/**
 * A list whose rows share named columns (a family's children: name, this
 * week, last practiced, access, action). Every row puts each value in its
 * own column and leaves an empty cell where it has none, so the columns
 * line up down the list whatever a row holds. From 720 px a row is one
 * line on the list's tracks (CSS subgrid); narrower, its title takes the
 * first line (with the action beside it from 560 px), the figures sit
 * under it in equal columns (two below 340 px), and the action takes the
 * last line, the same width on every row. Hairlines between rows.
 */
export function ColumnList({
  label,
  columns,
  children,
  ...data
}: {
  label: string;
  columns: readonly Column[];
  children: ReactNode;
} & { [key: `data-${string}`]: string | undefined }) {
  const figures = columns.filter((column) => !column.part).length;
  return (
    <div className={styles.frame}>
      <ul
        className={styles.list}
        aria-label={label}
        style={
          {
            "--columns": columns.map((column) => column.track).join(" "),
            "--figures": Math.max(figures, 1),
            "--figures-narrow": Math.min(Math.max(figures, 1), 2),
          } as CSSProperties
        }
        {...data}
      >
        <ColumnsContext.Provider value={columns}>
          {children}
        </ColumnsContext.Provider>
      </ul>
    </div>
  );
}

/** One row of a ColumnList: a cell for every column, in the list's order;
 * a column the row has nothing for stays an empty cell. */
export function ColumnRow({
  cells,
  ...data
}: {
  cells: Partial<Record<string, ReactNode>>;
} & { [key: `data-${string}`]: string | undefined }) {
  const columns = useContext(ColumnsContext);
  return (
    <li className={styles.row} {...data}>
      {columns.map((column) => (
        <span
          key={column.key}
          className={styles.cell}
          data-part={column.part ?? "figure"}
          data-column={column.key}
        >
          {cells[column.key] ?? null}
        </span>
      ))}
    </li>
  );
}
