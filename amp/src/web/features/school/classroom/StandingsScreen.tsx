import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useSearch } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import type { StandingsBoard } from "../../../../schools/classroom-contracts";
import { sessionOptions } from "../../../lib/query";
import { Button, buttonClass } from "../../../ui/Button";
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

type Teacher = StandingsBoard["teachers"][number];
/** A teacher's line below the list, in the same terms as your own. */
function teacherSentence(
  measure: StandingsBoard["board"]["measure"],
  { name, value }: Teacher,
) {
  if (measure === "growth")
    return `${name} has grown ${value} ${value === 1 ? "point" : "points"} this term.`;
  if (measure === "practice")
    return `${name} has done ${value} ${value === 1 ? "problem" : "problems"} on their own this term.`;
  return `${name} is working at level ${value.toFixed(1)}.`;
}

/** The mark in a teacher's rank place: a teacher is on the board, unranked. */
function TeacherMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.teacherMark}>
      <path d="M2.5 9 12 4.5 21.5 9 12 13.5Z" />
      <path d="M6.5 11.2v4.6c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.6" />
      <path d="M21.5 9v5" />
    </svg>
  );
}
const TeacherTag = () => (
  <span className={styles.teacherTag}>
    <span className={styles.srOnly}>, </span>Teacher
  </span>
);

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

type Line =
  | { teacher: false; row: StandingsBoard["top"][number] }
  | { teacher: true; row: Teacher };
/** The list as it reads: each teacher whose line reaches it sits in place by
 * value, after any student it ties, and takes no one's number. */
function linesOf(top: StandingsBoard["top"], teachers: readonly Teacher[]) {
  const waiting = teachers.filter((teacher) => teacher.inList);
  const lines: Line[] = [];
  for (const row of top) {
    while (waiting.length && waiting[0]!.value > row.value)
      lines.push({ teacher: true, row: waiting.shift()! });
    lines.push({ teacher: false, row });
  }
  for (const row of waiting) lines.push({ teacher: true, row });
  return lines;
}

function Row({
  line,
  top,
  measure,
}: {
  line: Line;
  top: number;
  measure: StandingsBoard["board"]["measure"];
}) {
  const { row } = line;
  const reach = top > 0 ? Math.min(1, Math.max(0.12, row.value / top)) : 0.12;
  const you = !line.teacher && line.row.you;
  const rank = line.teacher ? null : line.row.rank;
  return (
    <li
      className={styles.row}
      data-you={you || undefined}
      data-teacher={line.teacher || undefined}
      data-rank={rank !== null && rank <= 3 ? rank : undefined}
    >
      <span className={styles.rank}>{rank ?? <TeacherMark />}</span>
      <span className={styles.who}>
        <span className={styles.name}>
          {row.name}
          {you && <span className={styles.youTag}>You</span>}
          {line.teacher && <TeacherTag />}
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
  const { board, top, you, teachers } = data;
  const wide = board.scope !== "class";
  const lines = linesOf(top, teachers);
  // The students' top sets every wave's length, so a teacher far ahead runs
  // full width beside their number and never shrinks the students' waves.
  const most = top[0]?.value ?? 0;
  const below = teachers.filter((teacher) => !teacher.inList);
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
          {lines.map((line, index) => (
            <Row
              key={
                line.teacher
                  ? `teacher:${index}:${line.row.name}`
                  : `${line.row.rank}:${line.row.name}`
              }
              line={line}
              top={most}
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
      {below.map((teacher, index) => (
        <section
          key={`${index}:${teacher.name}`}
          className={styles.you}
          data-teacher=""
          aria-label={`${teacher.name}, teacher`}
        >
          <h2>
            {teacher.name}
            <TeacherTag />
          </h2>
          <p>{teacherSentence(board.measure, teacher)}</p>
        </section>
      ))}
      <p className={styles.note}>
        {measureNote[board.measure]}
        {wide
          ? ` ${teachers.length ? "Every student" : "Everyone"} on this board has a made-up name. Yours is ${you.name}.`
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
        {/* One wait, the board's own shape, from the first frame to the
            board: never a loader that turns into a skeleton. */}
        {board.data ? (
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
