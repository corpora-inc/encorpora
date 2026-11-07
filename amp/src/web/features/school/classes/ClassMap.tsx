import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { levelRange } from "../../../../learning/level-check";
import type {
  MapResponse,
  MapStudent,
} from "../../../../schools/teacher-contracts";
import { Avatar } from "../../../ui/Avatar";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import {
  LevelAxis,
  LevelBand,
  levelScale,
  type LevelEstimate,
} from "../../../ui/LevelChart";
import { Menu, MenuItem } from "../../../ui/Menu";
import {
  parseSort,
  studentUrl,
  TipZone,
  useClassSearch,
} from "./teacher-shared";
import styles from "./Teacher.module.css";

const axisName = (level: number) => String(level);
/** Before any work, a wide band around where they should be, drawn dashed. */
const UNKNOWN_SD = 0.9;
const SCALE_SD = 0.3;
const SCALE_MOST_SD = 1.2;
const middleOf = (reference: MapStudent["reference"]) =>
  reference ? (reference.from + reference.to) / 2 : null;

function estimateOf(
  student: MapStudent,
  strand: string,
  center: number,
): { estimate: LevelEstimate; estimated: boolean } {
  const known =
    strand === "overall"
      ? student.level?.overall
      : (student.level?.strands[strand] ?? student.level?.overall);
  return known
    ? {
        estimate: known,
        estimated:
          student.provisional ||
          (strand !== "overall" && !student.level?.strands[strand]),
      }
    : {
        estimate: {
          level: middleOf(student.reference) ?? center,
          sd: UNKNOWN_SD,
        },
        estimated: true,
      };
}

/** Every student a row, each strand a column, on one scale. The stripe down each
 * column is this course (or, in a mixed class, each student's own grade), so who
 * is behind it, on it or past it reads at a glance. On a phone: one strand at a
 * time, as flush rows. */
export function ClassMap({
  data,
  limitStrands,
}: {
  data: MapResponse;
  /** On Today the map is a glance, with the strands that have the most work. */
  limitStrands?: number;
}) {
  const [search, set] = useClassSearch();
  const strands = limitStrands
    ? data.strands.slice(0, limitStrands)
    : data.strands;
  const org = data.class.orgId;
  const classId = data.class.id;
  const courseLevel = data.class.course?.level;
  const center = useMemo(() => {
    if (courseLevel !== undefined) return courseLevel;
    const middles = data.students
      .map((student) => middleOf(student.reference))
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    return middles[Math.floor(middles.length / 2)] ?? 5;
  }, [courseLevel, data.students]);
  // Wide enough for every best guess: a strand with few answers has a wide band
  // that runs off the edge rather than shrinking everyone else's.
  const scale = useMemo(
    () =>
      levelScale(
        center,
        data.students.flatMap((student) =>
          student.level
            ? [
                student.level.overall,
                ...strands.flatMap((strand) => {
                  const known = student.level!.strands[strand.id];
                  return known && known.sd <= SCALE_MOST_SD ? [known] : [];
                }),
              ].map(({ level, sd }) => ({
                level,
                sd: Math.min(sd, SCALE_SD),
              }))
            : [],
        ),
      ),
    // `strands` is a slice of this response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [center, data, limitStrands],
  );
  const label = (id: string) =>
    data.strands.find((strand) => strand.id === id)?.label ?? "Overall";
  const reading = (student: MapStudent, strand: string) => {
    const { estimate, estimated } = estimateOf(student, strand, center);
    if (estimated) return `${label(strand)}: not enough work yet`;
    const [from, to] = levelRange(estimate);
    const where = !student.reference
      ? ""
      : to < student.reference.from
        ? ", below this course"
        : from > student.reference.to
          ? ", past this course"
          : ", around this course";
    return `${label(strand)}: likely grade ${from.toFixed(1)} to ${to.toFixed(1)}${where}`;
  };
  const band = (student: MapStudent, strand: string) => {
    const { estimate, estimated } = estimateOf(student, strand, center);
    return (
      <span
        className={styles.bandCell}
        data-strand={strand === "overall" ? undefined : strand}
        data-tip={`${student.first}. ${reading(student, strand)}`}
      >
        <LevelBand
          estimate={estimate}
          scale={scale}
          course={
            student.reference
              ? [student.reference.from, student.reference.to]
              : undefined
          }
          estimated={estimated}
          strong={strand === "overall"}
        />
      </span>
    );
  };
  const name = (student: MapStudent) => (
    <Link
      to="/$"
      params={{ _splat: studentUrl(org, student.id) }}
      search={{ class: classId } as never}
      className={styles.student}
    >
      <Avatar name={student.name} size="small" />
      <span>{student.name}</span>
    </Link>
  );
  // Who has too little work to place goes after everyone who has.
  const level = (student: MapStudent, strand: string) =>
    student.level && !student.provisional
      ? strand === "overall"
        ? student.level.overall.level
        : (student.level.strands[strand]?.level ?? student.level.overall.level)
      : -1;
  const columns = useMemo<DataGridColumn<MapStudent>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        width: 150,
        compare: (a, b) => a.name.localeCompare(b.name, "en"),
        cell: name,
      },
      {
        id: "overall",
        header: "Overall",
        width: 100,
        firstSort: "descending",
        compare: (a, b) => level(a, "overall") - level(b, "overall"),
        headerDetail: <LevelAxis scale={scale} name={axisName} />,
        cell: (student) => band(student, "overall"),
        cellLabel: (student) => reading(student, "overall"),
      },
      ...strands.map((strand): DataGridColumn<MapStudent> => ({
        id: strand.id,
        header: strand.label,
        width: 108,
        firstSort: "descending",
        compare: (a, b) => level(a, strand.id) - level(b, strand.id),
        headerDetail: (
          <LevelAxis
            scale={scale}
            name={(at) => (at === scale.center ? String(at) : "")}
          />
        ),
        cell: (student) => band(student, strand.id),
        cellLabel: (student) => reading(student, strand.id),
      })),
    ],
    // The cells close over this response, and only change with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, scale],
  );
  const lens =
    typeof search.lens === "string" &&
    data.strands.some((strand) => strand.id === search.lens)
      ? search.lens
      : "overall";
  const lenses = ["overall", ...strands.map((strand) => strand.id)];
  return (
    <TipZone className={styles.mapGrid}>
      <DataGrid
        label="Class map"
        columns={columns}
        rows={data.students}
        rowKey={(student) => student.id}
        sort={
          parseSort(search.sort) ?? {
            column: "overall",
            direction: "descending",
          }
        }
        onSortChange={(next) =>
          set({ sort: `${next.column}:${next.direction}` }, { replace: true })
        }
        rules={false}
        cardLayout="row"
        cardsSort={false}
        cardsToolbar={
          <Menu align="start" label={`Showing ${label(lens)}`}>
            {lenses.map((id) => (
              <MenuItem
                key={id}
                onSelect={() =>
                  set({ lens: id, sort: `${id}:descending` }, { replace: true })
                }
              >
                {label(id)}
              </MenuItem>
            ))}
          </Menu>
        }
        cardsHeader={
          <div className={styles.mapRow} aria-hidden="true">
            <span />
            <LevelAxis scale={scale} name={axisName} />
          </div>
        }
        card={(student) => (
          <div className={styles.mapRow}>
            {name(student)}
            <span aria-label={reading(student, lens)} role="img">
              {band(student, lens)}
            </span>
          </div>
        )}
      />
    </TipZone>
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
