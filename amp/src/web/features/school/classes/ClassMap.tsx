import { Link } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import type {
  MapResponse,
  MapStudent,
} from "../../../../schools/teacher-contracts";
import {
  fitScale,
  LevelAxis,
  LevelBar,
  likelyRange,
  type Estimate,
} from "../../../ui/level-range";
import { Menu, MenuItem } from "../../../ui/Menu";
import { parseSort, studentUrl, useClassSearch } from "./teacher-shared";
import styles from "./ClassMap.module.css";

/** Before any work, a wide band around where they should be, drawn dashed. */
const UNKNOWN_SD = 0.9;
const middleOf = (reference: MapStudent["reference"]) =>
  reference ? (reference.from + reference.to) / 2 : null;

type Placed = {
  student: MapStudent;
  estimate: Estimate;
  /** Too little work to place: a starting guess, drawn dashed. */
  estimated: boolean;
};

function place(student: MapStudent, lens: string, center: number): Placed {
  const known =
    lens === "overall"
      ? student.level?.overall
      : (student.level?.strands[lens] ?? student.level?.overall);
  return known
    ? {
        student,
        estimate: known,
        estimated:
          student.provisional ||
          (lens !== "overall" && !student.level?.strands[lens]),
      }
    : {
        student,
        estimate: {
          level: middleOf(student.reference) ?? center,
          sd: UNKNOWN_SD,
        },
        estimated: true,
      };
}

/**
 * The class on one scale: a row per student, one error bar each, for the
 * whole of their work or one area at a time. The scale spans the class's
 * real range, so a student far behind or far ahead has a whole bar like
 * everyone else; the stripe behind each bar is this course, or in a mixed
 * class the student's own grade. Only students: a teacher's own practice is
 * theirs, on `/me`.
 */
export function ClassMap({
  data,
  limitStrands,
  action,
}: {
  data: MapResponse;
  /** On Today the map is a glance, with the areas that have the most work. */
  limitStrands?: number;
  /** Before anyone has practiced: the one step that starts it. */
  action?: ReactNode;
}) {
  const [search, set] = useClassSearch();
  const strands = limitStrands
    ? data.strands.slice(0, limitStrands)
    : data.strands;
  const lens =
    typeof search.lens === "string" &&
    strands.some((strand) => strand.id === search.lens)
      ? search.lens
      : "overall";
  const label = (id: string) =>
    data.strands.find((strand) => strand.id === id)?.label ?? "Overall";
  const center = useMemo(() => {
    const course = data.class.course?.level;
    if (course !== undefined) return course;
    const middles = data.students
      .map((student) => middleOf(student.reference))
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    return middles[Math.floor(middles.length / 2)] ?? 5;
  }, [data]);
  const placed = useMemo(
    () => data.students.map((student) => place(student, lens, center)),
    [data, lens, center],
  );
  // Every whole likely range and every own-grade stripe, so nobody's bar
  // runs off an end; only a provisional guess too wide to mean much rests
  // its band against an end, with its dot inside.
  const scale = useMemo(
    () =>
      fitScale(
        placed
          .filter((row) => !row.estimated || row.estimate.sd <= UNKNOWN_SD)
          .map((row) => row.estimate),
        {
          minSpan: 4,
          include: placed.flatMap((row) => [
            row.estimate.level,
            ...(row.student.reference
              ? [row.student.reference.from, row.student.reference.to]
              : []),
          ]),
        },
      ),
    [placed],
  );
  const starting = placed.every((row) => row.estimated);
  const sort = parseSort(search.sort);
  const byName = sort?.column === "student";
  const direction =
    sort?.direction ?? (byName ? "ascending" : "descending");
  const rows = useMemo(() => {
    const sign = direction === "ascending" ? 1 : -1;
    return [...placed].sort((a, b) => {
      if (byName)
        return sign * a.student.name.localeCompare(b.student.name, "en");
      // Who has too little work to place goes after everyone who has.
      if (a.estimated !== b.estimated) return a.estimated ? 1 : -1;
      return (
        sign * (a.estimate.level - b.estimate.level) ||
        a.student.name.localeCompare(b.student.name, "en")
      );
    });
  }, [placed, byName, direction]);
  const sortBy = (column: "student" | "level") => {
    const current = byName ? "student" : "level";
    const next =
      column === current
        ? direction === "ascending"
          ? "descending"
          : "ascending"
        : column === "student"
          ? "ascending"
          : "descending";
    set({ sort: `${column}:${next}` }, { replace: true });
  };
  const reading = (row: Placed) => {
    if (row.estimated) return "not enough work yet";
    const [from, to] = likelyRange(row.estimate);
    const reference = row.student.reference;
    const where = !reference
      ? ""
      : to < reference.from
        ? ", below this course"
        : from > reference.to
          ? ", past this course"
          : ", around this course";
    return `likely grade ${from.toFixed(1)} to ${to.toFixed(1)}${where}`;
  };
  const lenses = ["overall", ...strands.map((strand) => strand.id)];
  return (
    <div className={styles.map}>
      {starting && (
        <div className={styles.starting}>
          <div>
            <p className={styles.startingTitle}>Starting estimates</p>
            <p className={styles.startingBody}>
              Each range starts from age and grade, and narrows as each one
              practices.
            </p>
          </div>
          {action}
        </div>
      )}
      <div className={styles.toolbar} hidden={starting || undefined}>
        <Menu align="start" label={label(lens)} aria-label={`Area: ${label(lens)}`}>
          {lenses.map((id) => (
            <MenuItem
              key={id}
              onSelect={() => set({ lens: id }, { replace: true })}
            >
              {label(id)}
            </MenuItem>
          ))}
        </Menu>
      </div>
      <div
        className={styles.table}
        role="table"
        aria-label={`Class map, ${label(lens)}`}
      >
        <div className={styles.head} role="row">
          <span role="columnheader" aria-sort={byName ? direction : "none"}>
            <SortButton
              label="Student"
              active={byName}
              direction={direction}
              onClick={() => sortBy("student")}
            />
          </span>
          <span
            role="columnheader"
            aria-sort={byName ? "none" : direction}
            className={styles.levelHead}
          >
            <SortButton
              label="Level"
              active={!byName}
              direction={direction}
              onClick={() => sortBy("level")}
            />
            <span className={styles.headAxis}>
              <LevelAxis scale={scale} />
            </span>
          </span>
          <span role="columnheader" className={styles.numbersHead}>
            Likely
          </span>
        </div>
        {rows.map((row) => (
          <div
            key={row.student.id}
            className={styles.row}
            role="row"
            data-strand={lens === "overall" ? undefined : lens}
          >
            <span role="cell" className={styles.name}>
              <Link
                to="/$"
                params={{ _splat: studentUrl(data.class.orgId, row.student.id) }}
                search={{ class: data.class.id } as never}
                className={styles.student}
              >
                {row.student.name}
              </Link>
            </span>
            <span
              role="cell"
              className={styles.bar}
              aria-label={`${row.student.first}: ${reading(row)}`}
            >
              <LevelBar
                estimate={row.estimate}
                scale={scale}
                band={
                  row.student.reference
                    ? [row.student.reference.from, row.student.reference.to]
                    : null
                }
                estimated={row.estimated}
              />
            </span>
            <span role="cell" className={styles.numbers}>
              {row.estimated ? (
                <span className={styles.notYet}>
                  {starting ? "Starting" : "Not enough work"}
                </span>
              ) : (
                likelyRange(row.estimate)
                  .map((value) => value.toFixed(1))
                  .join("–")
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: "ascending" | "descending";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.sort}
      data-active={active || undefined}
      onClick={onClick}
    >
      {label}
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className={styles.chevron}
        data-direction={active ? direction : undefined}
      >
        <path d="M3 4.5 6 7.5 9 4.5" />
      </svg>
    </button>
  );
}

/** What the marks mean. */
export function MapKey({ data }: { data: MapResponse }) {
  const { course } = data.class;
  return (
    <div className={styles.key}>
      <span className={styles.keyItem}>
        <span className={styles.keyCourse} />
        {course ? `${course.label}, this course` : "Each student’s own grade"}
      </span>
      <span className={styles.keyItem}>
        <span className={styles.keyBand}>
          <span />
        </span>
        Likely range and best guess
      </span>
    </div>
  );
}
