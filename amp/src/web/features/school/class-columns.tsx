import { Link } from "@tanstack/react-router";
import type { DataGridColumn } from "../../ui/DataGrid";
import { compareClassNames } from "./sort";
import styles from "./School.module.css";

/** The caller's own name reads "You" in a list of teachers. */
export const teacherNames = (
  teachers: readonly string[],
  self: string | null | undefined,
) => teachers.map((name) => (self && name === self ? "You" : name)).join(", ");

/** One Class column for every table of classes (the Overview's and the
 * Classes tab's), so they read the same: the name, a link to the class. */
export function classColumn<T extends { id: string; name: string }>(
  href: (row: T) => string,
): DataGridColumn<T> {
  return {
    id: "name",
    header: "Class",
    width: 200,
    compare: (a, b) => compareClassNames(a.name, b.name),
    cell: (row) => (
      <Link to="/$" params={{ _splat: href(row) }} className={styles.rowLink}>
        {row.name}
      </Link>
    ),
  };
}

/** One Teacher column, beside it: who teaches the class today. */
export function teacherColumn<T extends { teachers: readonly string[] }>(
  self: string | null | undefined,
): DataGridColumn<T> {
  return {
    id: "teacher",
    header: "Teacher",
    width: 150,
    compare: (a, b) =>
      (a.teachers[0] ?? "").localeCompare(b.teachers[0] ?? "", "en"),
    cell: (row) =>
      row.teachers.length ? (
        teacherNames(row.teachers, self)
      ) : (
        <span className={styles.quiet}>No teacher</span>
      ),
  };
}
