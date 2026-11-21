import { useQueries, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { SessionList as Sessions } from "../../../../schools/live/contracts";
import { Button } from "../../../ui/Button";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { sessionsOptions } from "../../live/api";
import { percentText } from "../../live/format";
import { standing } from "../../../lib/AppError";
import { currentSession } from "../api";
import { classYearOptions } from "../org/org-api";
import { useStaffSession } from "./api";
import { useClassView } from "./teacher-shared";
import styles from "./SessionReport.module.css";

type Place = { org: string; class: string };
type Row = Sessions["sessions"][number];

const PAGE = 20;
const when = (at: string) =>
  new Date(at).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const minutes = (row: Row) =>
  Math.max(
    0,
    Math.round(
      (Date.parse(row.endedAt ?? row.endsAt) - Date.parse(row.startedAt)) /
        60_000,
    ),
  );

/**
 * A class's live sessions, newest first, each a row (when, how long, who
 * was there, problems, percent correct) opening its report; a running one
 * opens the live view on Today. Twenty at a time, with More for older
 * ones. Nothing renders before the class's first session (ia.md rule 1).
 * Space-neutral: the place is any class, a family's too.
 */
export function SessionList({
  place,
  title = "Sessions",
}: {
  place: Place;
  title?: string;
}) {
  const session = useStaffSession();
  const navigate = useNavigate();
  const [view, set] = useClassView();
  const pages = Math.max(
    1,
    typeof view.sessionPages === "number" ? view.sessionPages : 1,
  );
  // Only someone who may read the class's sessions asks for them.
  const readable = (
    standing(
      useQuery({
        ...classYearOptions(currentSession(), place.class),
        refetchOnMount: false,
      }),
    )?.can ?? []
  ).includes("session.read");
  const reads = useQueries({
    queries: Array.from({ length: pages }, (_, page) => ({
      ...sessionsOptions(session, place, page * PAGE),
      enabled: readable,
    })),
  });
  const rows = reads.flatMap((read) => read.data?.sessions ?? []);
  const last = reads.at(-1);
  if (rows.length === 0) return null;
  const open = (row: Row) =>
    row.endedAt === null
      ? navigate({ to: "/school/$org/classes/$class/today", params: place })
      : navigate({
          to: "/school/$org/classes/$class/sessions/$session",
          params: { ...place, session: row.id },
        });
  const columns: DataGridColumn<Row>[] = [
    {
      id: "when",
      header: "Started",
      width: 200,
      cell: (row) =>
        row.endedAt === null ? (
          <Link
            to="/school/$org/classes/$class/today"
            params={place}
            className={styles.person}
          >
            {when(row.startedAt)} · running
          </Link>
        ) : (
          <Link
            to="/school/$org/classes/$class/sessions/$session"
            params={{ ...place, session: row.id }}
            className={styles.person}
          >
            {when(row.startedAt)}
          </Link>
        ),
    },
    {
      id: "length",
      header: "Length",
      width: 88,
      align: "end",
      cell: (row) => (row.endedAt === null ? "—" : `${minutes(row)} min`),
    },
    {
      id: "here",
      header: "Here",
      width: 88,
      align: "end",
      cell: (row) =>
        row.totals ? `${row.totals.present} of ${row.totals.students}` : "—",
    },
    {
      id: "problems",
      header: "Problems",
      width: 96,
      align: "end",
      cell: (row) => (row.totals ? row.totals.problems : "—"),
    },
    {
      id: "correct",
      header: "Correct",
      width: 88,
      align: "end",
      cell: (row) =>
        row.totals ? percentText(row.totals.correct, row.totals.problems) : "—",
    },
  ];
  return (
    <section
      className={`${styles.section} ${styles.listSection}`}
      aria-labelledby="class-sessions"
    >
      <h2 id="class-sessions">{title}</h2>
      <DataGrid
        label={title}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        onRowActivate={(row) => void open(row)}
        cardLayout="list"
        cardsSort={false}
      />
      {(last?.isPending || last?.data?.nextOffset != null) && (
        <Button
          variant="secondary"
          className={styles.more}
          aria-busy={last.isFetching || undefined}
          onClick={() => set({ sessionPages: pages + 1 })}
        >
          Older sessions
        </Button>
      )}
    </section>
  );
}
