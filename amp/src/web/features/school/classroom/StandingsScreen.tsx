import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useSearch } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import type { StandingsBoard } from "../../../../schools/classroom-contracts";
import { sessionOptions } from "../../../lib/query";
import { Button, buttonClass } from "../../../ui/Button";
import { Loading } from "../../../ui/Loading";
import { NavigationDrawer } from "../../navigation/NavigationDrawer";
import { StudentSignOut } from "../../practice/StudentSignOut";
import { gradeLabel } from "../parts";
import { say, standingsBoardOptions, standingsBoardsOptions } from "./api";
import styles from "./Standings.module.css";

const measureTitle: Record<StandingsBoard["board"]["measure"], string> = {
  growth: "Growth this term",
  practice: "Practice this term",
  level: "Working level",
};
const measureNote: Record<StandingsBoard["board"]["measure"], string> = {
  growth: "100 points is a full grade’s worth of math.",
  practice: "Counts problems you did without help.",
  level: "Counts your level from work you did without help.",
};
const valueText = (
  measure: StandingsBoard["board"]["measure"],
  value: number,
) =>
  measure === "growth"
    ? `+${value}`
    : measure === "level"
      ? value.toFixed(1)
      : String(value);
const valueUnit: Record<StandingsBoard["board"]["measure"], string> = {
  growth: "points",
  practice: "problems",
  level: "level",
};

/** Your own line, in your own terms: never a place on a list. */
function yourLine({ board, you }: StandingsBoard) {
  if (!you.value)
    return "Your line starts with your first problem done without help.";
  const week = you.thisWeek;
  const place = you.rank ? `You’re number ${you.rank}. ` : "";
  if (board.measure === "growth")
    return `${place}You’ve grown ${you.value} ${you.value === 1 ? "point" : "points"} this term${week ? `, ${week} of them this week` : ""}.`;
  if (board.measure === "practice")
    return `${place}You’ve done ${you.value} ${you.value === 1 ? "problem" : "problems"} on your own this term${week ? `, ${week} of them this week` : ""}.`;
  return `${place}You’re working at level ${you.value.toFixed(1)}${week ? `, up ${(week / 100).toFixed(1)} this week` : ""}.`;
}

function Row({
  row,
  top,
  measure,
}: {
  row: StandingsBoard["top"][number];
  top: number;
  measure: StandingsBoard["board"]["measure"];
}) {
  const reach = top > 0 ? Math.max(0.12, row.value / top) : 0.12;
  return (
    <li
      className={styles.row}
      data-you={row.you || undefined}
      data-rank={row.rank <= 3 ? row.rank : undefined}
    >
      <span className={styles.rank}>{row.rank}</span>
      <span className={styles.who}>
        <span className={styles.name}>
          {row.name}
          {row.you && <span className={styles.youTag}>You</span>}
        </span>
        <span
          className={styles.track}
          style={{ "--reach": `${Math.round(reach * 100)}%` } as CSSProperties}
          aria-hidden="true"
        />
      </span>
      <span className={styles.value}>
        {valueText(measure, row.value)}
        <span className={styles.srOnly}> {valueUnit[measure]}</span>
      </span>
    </li>
  );
}

function Board({ data }: { data: StandingsBoard }) {
  const { board, top, you } = data;
  const wide = board.scope !== "class";
  const heading = wide
    ? `${board.gradeLevel === null ? "Students" : gradeWord(board.gradeLevel)} at ${board.placeName}`
    : board.placeName;
  return (
    <>
      <div className={styles.head}>
        <h1>{measureTitle[board.measure]}</h1>
        <p>{heading}</p>
      </div>
      {top.length > 0 ? (
        <ol className={styles.list} aria-label="Top of the board">
          {top.map((row) => (
            <Row
              key={`${row.rank}:${row.name}`}
              row={row}
              top={top[0]!.value}
              measure={board.measure}
            />
          ))}
        </ol>
      ) : (
        <p className={styles.empty}>
          The board fills in as {wide ? "students" : "your class"} work without
          help.
        </p>
      )}
      <section className={styles.you} aria-label="Your line">
        <h2>{you.name}</h2>
        <p>{yourLine(data)}</p>
      </section>
      <p className={styles.note}>
        {measureNote[board.measure]}
        {wide
          ? ` Everyone on this board has a made-up name. Yours is ${you.name}.`
          : ""}
      </p>
    </>
  );
}
const gradeWord = (grade: number) =>
  grade === 0
    ? "Kindergarten"
    : grade === 13
      ? "College level"
      : `Grade ${gradeLabel(grade)}`;

/** `/standings`: for a student whose class turned it on, and never during a
 * problem. The top ten and your own line. */
export function StandingsScreen() {
  const { data: session } = useQuery(sessionOptions);
  const search = useSearch({ from: "/standings" });
  const boards = useQuery(standingsBoardsOptions(session ?? null));
  const list = boards.data?.boards ?? [];
  const chosen =
    list.find((entry) => entry.classId === search.class) ?? list[0] ?? null;
  const board = useQuery({
    ...standingsBoardOptions(session ?? null, chosen?.classId ?? ""),
    enabled: !!session && !!chosen,
  });
  if (boards.isSuccess && !list.length)
    return <Navigate to="/$" params={{ _splat: "practice" }} replace />;
  const failed = boards.error ?? board.error;
  return (
    <div className={styles.frame}>
      <header className={styles.bar}>
        <NavigationDrawer />
        <Link to="/" className={styles.brand} aria-label="AMP home">
          AMP
        </Link>
        <span className={styles.spacer} />
        <StudentSignOut inBar />
        <Link
          to="/$"
          params={{ _splat: "practice" }}
          className={buttonClass("secondary", styles.back)}
        >
          Back to practice
        </Link>
      </header>
      <main className={styles.main}>
        {list.length > 1 && chosen && (
          <div className={styles.picker} role="group" aria-label="Which class">
            {list.map((entry) => (
              <Link
                key={entry.classId}
                to="/standings"
                search={{ class: entry.classId }}
                aria-current={
                  entry.classId === chosen.classId ? "page" : undefined
                }
                className={styles.pick}
              >
                {entry.className}
              </Link>
            ))}
          </div>
        )}
        {boards.isPending ? (
          <Loading>Opening the board…</Loading>
        ) : board.data ? (
          <Board data={board.data} />
        ) : failed ? (
          <div className={styles.problem} role="alert">
            <h1>The board didn’t load</h1>
            <p>{say(failed, "Your standings couldn’t be read.")}</p>
            <Button
              variant="primary"
              onClick={() => {
                void boards.refetch();
                void board.refetch();
              }}
            >
              Try again
            </Button>
          </div>
        ) : (
          <div aria-busy="true" role="status" aria-label="Loading the board">
            <div className={styles.head}>
              <h1 className="amp-skeleton">&nbsp;</h1>
              <p className="amp-skeleton">&nbsp;</p>
            </div>
            <ol className={styles.list} aria-hidden="true">
              {Array.from({ length: 10 }, (_, index) => (
                <li key={index} className={`${styles.row} amp-skeleton`} />
              ))}
            </ol>
          </div>
        )}
      </main>
    </div>
  );
}
