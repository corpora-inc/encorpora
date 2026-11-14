import { EntityLink } from "../../../nav/links";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import type {
  GradeRow,
  MapResponse,
  MapStudent,
} from "../../../../schools/teacher-contracts";
import { Toast } from "../../../ui/Toast";
import { currentSession } from "../api";
import { FinalField, Suggested } from "./grade-parts";
import { gradebookOptions } from "./teacher-api";
import {
  fitScale,
  LevelAxis,
  LevelBar,
  LevelRows,
  likelyRange,
  type Estimate,
  type RangeScale,
} from "../../../ui/level-range";
import { strandNames } from "../../../BirthYearPrompt";
import { Menu, MenuItem } from "../../../ui/Menu";
import { classUrl, parseSort, useClassSearch } from "./teacher-shared";
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
  const direction = sort?.direction ?? (byName ? "ascending" : "descending");
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
  // A family or a small group: each learner's whole picture, every area,
  // stacked down the page on one shared scale.
  if (data.students.length <= SMALL_CLASS && !limitStrands)
    return (
      <SmallClassMap
        data={data}
        center={center}
        starting={starting}
        action={action}
      />
    );
  return (
    <div className={styles.map}>
      {/* Before any practice each row says "Starting" or "Not yet": no
          heading repeats it. Only the step that starts it stays. */}
      {starting && action && <div className={styles.starting}>{action}</div>}
      <div className={styles.toolbar} hidden={starting || undefined}>
        <Menu
          align="start"
          label={label(lens)}
          aria-label={`Area: ${label(lens)}`}
        >
          {lenses.map((id) => (
            <MenuItem
              key={id}
              selected={id === lens}
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
              <EntityLink
                entity={{ kind: "student", id: row.student.id }}
                className={styles.student}
                data-map-student={row.student.id}
              >
                {row.student.name}
              </EntityLink>
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

/** Up to this many learners, the map shows each one whole. */
const SMALL_CLASS = 6;
/** The curriculum's order of areas, for each learner's rows. */
const AREA_ORDER = Object.keys(strandNames);

/**
 * A small class (a family, a tutor's group): a section per learner, with
 * their overall level and every area as its own wide error bar, all on one
 * scale that spans the whole group, each over their own grade. Before
 * anyone has practiced, each learner's starting range alone.
 */
function SmallClassMap({
  data,
  center,
  starting,
  action,
}: {
  data: MapResponse;
  center: number;
  starting: boolean;
  action?: ReactNode;
}) {
  // The grade, as a line in each learner's section: a small class needs no
  // separate gradebook.
  const session = currentSession();
  const classPlace = { org: data.class.orgId, class: data.class.id };
  const book = useQuery(gradebookOptions(session, classPlace, undefined));
  const grades = new Map(
    (book.data?.students ?? []).map((row) => [row.id, row]),
  );
  const [message, setMessage] = useState("");
  const areas = [...data.strands].sort(
    (a, b) =>
      (AREA_ORDER.indexOf(a.id) + 1 || 99) -
      (AREA_ORDER.indexOf(b.id) + 1 || 99),
  );
  const learners = data.students.map((student) => ({
    student,
    overall: place(student, "overall", center),
    areas: student.level
      ? areas.map((area) => {
          const row = place(student, area.id, center);
          return {
            id: area.id,
            label: area.label,
            estimate: row.estimate,
            estimated: row.estimated,
          };
        })
      : [],
  }));
  const scale: RangeScale = fitScale(
    learners.flatMap((learner) =>
      [
        learner.overall,
        ...learner.areas.map((area) => ({
          estimate: area.estimate,
          estimated: !!area.estimated,
        })),
      ]
        .filter((row) => !row.estimated || row.estimate.sd <= UNKNOWN_SD)
        .map((row) => row.estimate),
    ),
    {
      minSpan: 6,
      include: learners.flatMap((learner) => [
        learner.overall.estimate.level,
        ...(learner.student.reference
          ? [learner.student.reference.from, learner.student.reference.to]
          : []),
      ]),
    },
  );
  return (
    <div className={styles.map}>
      <Toast message={message} onDismiss={() => setMessage("")} />
      {/* Before any practice each row says "Starting" or "Not yet": no
          heading repeats it. Only the step that starts it stays. */}
      {starting && action && <div className={styles.starting}>{action}</div>}
      {learners.map((learner) => {
        const { student, overall } = learner;
        const [from, to] = likelyRange(overall.estimate);
        return (
          <section
            key={student.id}
            className={styles.learner}
            aria-labelledby={`map-${student.id}`}
          >
            <div className={styles.learnerHead}>
              <h2 id={`map-${student.id}`} className={styles.learnerName}>
                <EntityLink
                  entity={{ kind: "student", id: student.id }}
                  className={styles.student}
                  data-map-student={student.id}
                >
                  {student.name}
                </EntityLink>
              </h2>
              {!overall.estimated && (
                <p className={styles.learnerLevel}>
                  Likely {from.toFixed(1)}–{to.toFixed(1)}
                </p>
              )}
            </div>
            <LevelRows
              overall={overall.estimate}
              overallEstimated={overall.estimated}
              areas={learner.areas}
              scale={scale}
              grade={
                student.reference
                  ? [student.reference.from, student.reference.to]
                  : null
              }
            />
            {/* A term's grade line only once there's work to grade (or a
                final set): a family's map carries no gradebook leftovers. */}
            {book.data?.term &&
              (grades.get(student.id)?.suggestion.status === "ready" ||
                grades.get(student.id)?.final != null) && (
                <GradeLine
                  session={session}
                  place={classPlace}
                  term={book.data.term}
                  editable={
                    book.data.canEdit && book.data.term.state === "open"
                  }
                  row={grades.get(student.id)}
                  student={student}
                  onMessage={setMessage}
                />
              )}
          </section>
        );
      })}
    </div>
  );
}

const COMPONENT_NAMES = {
  course: "Course progress",
  growth: "Growth",
  practice: "Practice",
  retention: "Retention",
} as const;

/** A learner's grade for the open term, in one line: the suggestion and
 * what it rests on once there is enough work, and the final grade. */
function GradeLine({
  session,
  place,
  term,
  editable,
  row,
  student,
  onMessage,
}: {
  session: ReturnType<typeof currentSession>;
  place: { org: string; class: string };
  term: { id: string; name: string };
  editable: boolean;
  row: GradeRow | undefined;
  student: MapStudent;
  onMessage: (message: string) => void;
}) {
  const ready = row?.suggestion.status === "ready";
  // A final grade is a report-card entry: it appears once the term has work
  // to grade (or already has one), never as an empty box beside "Not enough
  // work yet".
  const final = ready || row?.final != null;
  return (
    <div className={styles.gradeLine} data-grade-line>
      <span className={styles.gradeTerm}>{term.name}</span>
      <span className={styles.gradeSuggested}>
        {row ? <Suggested suggestion={row.suggestion} /> : null}
        {ready && (
          <span className={styles.gradeParts}>
            {row!.suggestion.components
              .filter((part) => part.score !== null)
              .map(
                (part) =>
                  `${COMPONENT_NAMES[part.id]} ${Math.round(part.score!)}`,
              )
              .join(" · ")}
          </span>
        )}
      </span>
      {final && (
        <span className={styles.gradeFinal}>
          <span className={styles.gradeFinalLabel}>Final grade</span>
          <FinalField
            session={session}
            place={place}
            student={{
              id: student.id,
              name: student.name,
              first: student.first,
            }}
            term={term.id}
            final={row?.final ?? null}
            editable={editable}
            onError={onMessage}
            onSaved={onMessage}
          />
        </span>
      )}
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
export function MapKey({
  data,
  family = false,
}: {
  data: MapResponse;
  /** A family's class: its learners are children. */
  family?: boolean;
}) {
  const { course } = data.class;
  return (
    <div className={styles.key}>
      <span className={styles.keyItem}>
        <span className={styles.keyCourse} />
        {course
          ? `${course.label}, this course`
          : `Each ${family ? "child" : "student"}’s own grade`}
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
