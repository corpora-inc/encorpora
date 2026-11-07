import { Link } from "@tanstack/react-router";
import { useMemo, useState, type FocusEvent, type PointerEvent } from "react";
import { levelRange } from "../../../../learning/level-check";
import { Avatar } from "../../../ui/Avatar";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import { LevelAxis, LevelBand } from "../../../ui/LevelChart";
import { Menu, MenuItem } from "../../../ui/Menu";
import { course, scale, strands, students, type Student } from "./fixture";
import { usePreviewSearch } from "./search";
import styles from "./Preview.module.css";

const axisName = (level: number) => String(level);
/** A strand column names only its stripe; the ends are on Overall. */
const stripeName = (level: number) =>
  level === course.level ? String(level) : "";
const estimateOf = (student: Student, strand: string) =>
  strand === "overall"
    ? student.overall
    : student.strands[strand as keyof Student["strands"]];
const strandLabel = (strand: string) =>
  strands.find((entry) => entry.id === strand)?.label ?? "Overall";

/** The band in words, for assistive technology and the hover readout. */
function reading(student: Student, strand: string) {
  const [from, to] = levelRange(estimateOf(student, strand));
  const where =
    to < course.band[0]
      ? "below this course"
      : from > course.band[1]
        ? "past this course"
        : "around this course";
  return `${strandLabel(strand)}: likely grade ${from.toFixed(1)} to ${to.toFixed(1)}, ${where}`;
}

function Band({ student, strand }: { student: Student; strand: string }) {
  return (
    <span
      className={styles.bandCell}
      data-strand={strand === "overall" ? undefined : strand}
      data-tip={`${student.first}. ${reading(student, strand)}`}
    >
      <LevelBand
        estimate={estimateOf(student, strand)}
        scale={scale}
        course={course.band}
        estimated={student.notEnoughWork}
        strong={strand === "overall"}
      />
    </span>
  );
}

function StudentLink({ student }: { student: Student }) {
  const [{ lone }] = usePreviewSearch();
  return (
    <Link
      to="/$"
      params={{ _splat: "school/preview/gradebook" }}
      search={{ student: student.id, ...(lone ? { lone: 1 } : {}) }}
      className={styles.student}
    >
      <Avatar name={student.name} size="small" />
      <span>{student.name}</span>
    </Link>
  );
}

const compareNames = (a: Student, b: Student) =>
  a.name.localeCompare(b.name, "en");
const compareLevels = (strand: string) => (a: Student, b: Student) =>
  estimateOf(a, strand).level - estimateOf(b, strand).level;

/** Every student a row, each strand a column, on one scale: the stripe down
 * each column is this course, so who is behind it, on it or past it reads at
 * a glance. On a phone: one strand at a time, as flush rows. */
export function ClassMap() {
  const [search, set] = usePreviewSearch();
  const [tip, setTip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const columns = useMemo<DataGridColumn<Student>[]>(
    () => [
      {
        id: "student",
        header: "Student",
        width: 115,
        compare: compareNames,
        cell: (student) => <StudentLink student={student} />,
      },
      {
        id: "overall",
        header: "Overall",
        width: 100,
        firstSort: "descending",
        compare: compareLevels("overall"),
        headerDetail: <LevelAxis scale={scale} name={axisName} />,
        cell: (student) => <Band student={student} strand="overall" />,
        cellLabel: (student) => reading(student, "overall"),
      },
      ...strands.map((strand): DataGridColumn<Student> => ({
        id: strand.id,
        header: strand.label,
        width: 101,
        firstSort: "descending",
        compare: compareLevels(strand.id),
        headerDetail: <LevelAxis scale={scale} name={stripeName} />,
        cell: (student) => <Band student={student} strand={strand.id} />,
        cellLabel: (student) => reading(student, strand.id),
      })),
    ],
    [],
  );
  const showTip = (element: Element | null) => {
    const target = element?.closest<HTMLElement>("[data-tip]");
    if (!target) return setTip(null);
    const box = target.getBoundingClientRect();
    setTip({
      text: target.dataset.tip!,
      x: Math.min(innerWidth - 150, Math.max(150, box.left + box.width / 2)),
      y: box.top,
    });
  };
  const lens = search.lens;
  return (
    <div
      className={styles.mapGrid}
      onPointerOver={(event: PointerEvent) =>
        event.pointerType === "mouse" && showTip(event.target as Element | null)
      }
      onPointerLeave={() => setTip(null)}
      onFocus={(event: FocusEvent) =>
        showTip(
          (event.target as HTMLElement).querySelector?.("[data-tip]") ?? null,
        )
      }
      onBlur={() => setTip(null)}
    >
      <DataGrid
        label="Class map"
        columns={columns}
        rows={students}
        rowKey={(student) => student.id}
        sort={search.sort ?? { column: "overall", direction: "descending" }}
        onSortChange={(next) =>
          set({ sort: `${next.column}:${next.direction}` }, { replace: true })
        }
        rules={false}
        cardLayout="row"
        cardsSort={false}
        cardsToolbar={
          <Menu align="start" label={`Showing ${strandLabel(lens)}`}>
            {["overall", ...strands.map((strand) => strand.id)].map((id) => (
              <MenuItem
                key={id}
                onSelect={() =>
                  set({ lens: id, sort: `${id}:descending` }, { replace: true })
                }
              >
                {strandLabel(id)}
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
            <StudentLink student={student} />
            <span aria-label={reading(student, lens)} role="img">
              <Band student={student} strand={lens} />
            </span>
          </div>
        )}
      />
      {tip && (
        <div
          className={styles.tip}
          style={{ left: tip.x, top: tip.y }}
          aria-hidden="true"
        >
          {tip.text}
        </div>
      )}
    </div>
  );
}

/** What the marks mean. */
export function MapKey() {
  return (
    <div className={styles.key}>
      <span className={styles.keyItem}>
        <span className={styles.keyCourse} />
        {course.name}, this course
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
