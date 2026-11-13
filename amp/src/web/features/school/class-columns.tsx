import { Link, useNavigate } from "@tanstack/react-router";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import {
  DataGrid,
  type DataGridColumn,
  type GridSort,
} from "../../ui/DataGrid";
import { TipZone } from "./classes/teacher-shared";
import { compareClassNames } from "./sort";
import list from "./ClassList.module.css";
import styles from "./School.module.css";

/** Teachers by name. The reader's own name is theirs too, with a quiet
 * "(you)" after it, so a row never reads "You" where a name belongs. */
export function TeacherNames({
  teachers,
  self,
}: {
  teachers: readonly string[];
  self: string | null | undefined;
}) {
  if (!teachers.length) return <span className={styles.quiet}>No teacher</span>;
  return (
    <>
      {teachers.map((name, index) => (
        <Fragment key={`${name}-${index}`}>
          {index > 0 && ", "}
          {name}
          {self && name === self && <span className={list.you}> (you)</span>}
        </Fragment>
      ))}
    </>
  );
}

/** One Class column for every list of classes (the Overview's and the
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
      <Link
        to="/$"
        params={{ _splat: href(row) }}
        className={`${styles.rowLink} ${list.cellText}`}
      >
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
    cell: (row) => (
      <span className={list.cellText}>
        <TeacherNames teachers={row.teachers} self={self} />
      </span>
    ),
  };
}

/** A figure a list shows on a phone: one of its table's columns, with a
 * short label for the head and a fixed width, so it lines up down the list. */
export type ListFigure<Row> = {
  column: string;
  /** The head's word for it on a phone ("Practiced"). */
  label: string;
  /** Its column's width on a phone, in px. */
  width: number;
  /** A phone's narrower rendering of the cell, when the table's is wide. */
  cell?: (row: Row) => ReactNode;
};

/**
 * The one list of classes (or a district's schools): the Overview's, the
 * Classes tab's, a district's Schools. The table's own columns at every
 * width. Where the table fits, it is the shared table, sorted by its headers.
 * Where it doesn't, each row is one line of the same shape: the name with its
 * teacher (or detail) under it, then the figures in fixed columns, labelled
 * once in a head above them, so every row is the same height and every figure
 * sits at the same x. The whole row is the link. The sort control and the
 * list's action share the row above it.
 */
export function ClassList<Row extends { id: string; name: string }>({
  label,
  columns,
  rows,
  href,
  detail,
  figures,
  action,
  defaultSort = { column: "name", direction: "ascending" },
}: {
  label: string;
  /** The table's columns; the first is the name. */
  columns: readonly DataGridColumn<Row>[];
  rows: readonly Row[];
  href: (row: Row) => string;
  /** Under the name on a phone: the teacher, or a school's classes. */
  detail: (row: Row) => ReactNode;
  figures: readonly ListFigure<Row>[];
  action?: ReactNode;
  defaultSort?: GridSort;
}) {
  const navigate = useNavigate();
  const shown = figures.map((figure) => ({
    ...figure,
    column: columns.find((column) => column.id === figure.column)!,
  }));
  const style = {
    "--class-list-columns": `minmax(0, 1fr) ${figures.map((figure) => `${figure.width}px`).join(" ")}`,
  } as CSSProperties;
  const open = (row: Row) =>
    void navigate({ to: "/$", params: { _splat: href(row) } });
  return (
    <TipZone className={list.root}>
      <div data-class-list="" style={style}>
        <DataGrid
          label={label}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          rowHeight={52}
          defaultSort={defaultSort}
          onRowActivate={open}
          // A tablet's width shows the rows, never a table that scrolls.
          cardsBelow={Math.max(
            720,
            columns.reduce((sum, column) => sum + column.width, 0),
          )}
          cardLayout="row"
          cardEstimate={60}
          action={action}
          cardsHeader={
            <div className={list.head} aria-hidden="true" data-list-head="">
              <span data-column={columns[0]!.id}>{columns[0]!.header}</span>
              {shown.map((figure) => (
                <span key={figure.column.id} data-column={figure.column.id}>
                  {figure.label}
                </span>
              ))}
            </div>
          }
          card={(row) => (
            <div className={list.row} data-list-row="">
              <span className={list.who}>
                <Link
                  to="/$"
                  params={{ _splat: href(row) }}
                  className={list.link}
                  data-column={columns[0]!.id}
                >
                  {row.name}
                </Link>
                <span className={list.detail}>{detail(row)}</span>
              </span>
              {shown.map((figure) => (
                <span
                  key={figure.column.id}
                  className={list.figure}
                  data-column={figure.column.id}
                >
                  <span className={styles.visuallyHidden}>
                    {figure.column.header}:{" "}
                  </span>
                  {(figure.cell ?? figure.column.cell)(row)}
                </span>
              ))}
            </div>
          )}
        />
      </div>
    </TipZone>
  );
}
