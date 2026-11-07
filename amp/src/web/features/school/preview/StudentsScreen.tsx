import { useMemo } from "react";
import { Avatar } from "../../../ui/Avatar";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { EmptyState } from "../../../ui/EmptyState";
import { Meter } from "../../../ui/Meter";
import { SearchField } from "../../../ui/SearchField";
import { school, roster, type RosterRow } from "./fixture";
import { PreviewFrame } from "./PreviewFrame";
import { usePreviewSearch } from "./search";
import styles from "./Preview.module.css";

const columns: DataGridColumn<RosterRow>[] = [
  {
    id: "name",
    header: "Student",
    width: 200,
    compare: (a, b) => a.name.localeCompare(b.name, "en"),
    cell: (row) => (
      <span className={styles.rosterName}>
        <Avatar name={row.name} size="small" />
        <span>{row.name}</span>
      </span>
    ),
  },
  {
    id: "grade",
    header: "Grade",
    width: 80,
    compare: (a, b) => a.grade - b.grade,
    cell: (row) => row.grade,
  },
  {
    id: "teacher",
    header: "Teacher",
    width: 130,
    compare: (a, b) => a.teacher.localeCompare(b.teacher, "en"),
    cell: (row) => row.teacher,
  },
  {
    id: "room",
    header: "Room",
    width: 80,
    compare: (a, b) => a.room - b.room,
    cell: (row) => row.room,
  },
  {
    id: "minutes",
    header: "Minutes this week",
    width: 150,
    firstSort: "descending",
    compare: (a, b) => a.minutes - b.minutes,
    cell: (row) => (
      <Meter value={row.minutes} max={90} label={`Minutes for ${row.name}`} />
    ),
  },
  {
    id: "problems",
    header: "Problems",
    width: 100,
    firstSort: "descending",
    compare: (a, b) => a.problems - b.problems,
    align: "end",
    cell: (row) => row.problems,
  },
  {
    id: "overall",
    header: "Working level",
    width: 110,
    firstSort: "descending",
    compare: (a, b) => a.overall - b.overall,
    align: "end",
    cell: (row) => row.overall.toFixed(1),
  },
];

/** A whole school: the grid at length, virtualized, with its search. */
export function StudentsScreen() {
  const [search, set] = usePreviewSearch();
  const needle = search.q.trim().toLowerCase();
  const echoed = search.q.trim();
  const rows = useMemo(
    () =>
      needle
        ? roster.filter((row) => row.name.toLowerCase().includes(needle))
        : roster,
    [needle],
  );
  return (
    <PreviewFrame nav="students" title="Students">
      <div className={styles.gradePage}>
        <div className={styles.listHead}>
          <div className={styles.gradeTitle}>
            <h1>Students</h1>
            <p>
              {school.name}, {rows.length} of {roster.length}
            </p>
          </div>
          <SearchField
            label="Search students"
            placeholder="Search students"
            value={search.q}
            onChange={(q) => set({ q: q || undefined }, { replace: true })}
          />
        </div>
        {rows.length ? (
          <DataGrid
            label="Students"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            defaultSort={{ column: "name", direction: "ascending" }}
          />
        ) : (
          <EmptyState
            title={`No student matches “${echoed.length > 20 ? `${echoed.slice(0, 20)}…` : echoed}”`}
          >
            Check the spelling, or clear the search to see everyone.
          </EmptyState>
        )}
      </div>
    </PreviewFrame>
  );
}
