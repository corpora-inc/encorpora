import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, type CSSProperties } from "react";
import type { PracticeResponse } from "../../../../schools/org-contracts";
import { summarize } from "../../../../schools/practice-stats";
import { DataGrid, type DataGridColumn } from "../../../ui/DataGrid";
import {
  number,
  parseSort,
  shortDay,
  tipAttributes,
  TipZone,
  type TipCard,
} from "../classes/teacher-shared";
import { classPath, orgPath } from "../paths";
import {
  figure,
  HeatCell,
  HeatLegend,
  statsCells,
  unitWord,
  type HeatMeasure,
} from "../practice/heat";
import { compareClassNames } from "../sort";
import styles from "./Org.module.css";

type Data = PracticeResponse;
type Row = Data["rows"][number] & {
  /** The mean of its finished weeks' means, per student. */
  mean: number | null;
  weeklyMeans: number[];
};
const valueOf = (
  cell: NonNullable<Data["rows"][number]["cells"][number]>,
  measure: HeatMeasure,
) => (measure === "minutes" ? cell.minutes : cell.problems);

/** Classes (or a district's schools) by week of the term, each cell the mean
 * per rostered student that week, coloured cold to hot against the class's
 * weekly target. Every number is a hover or a tap away; rows sort by name or
 * by their weekly mean, and the order is in the address bar. */
export function PracticeMap({
  data,
  orgId,
  measure,
  sort: rawSort,
}: {
  data: Data;
  orgId: string;
  measure: HeatMeasure;
  sort: unknown;
}) {
  const navigate = useNavigate();
  const currentIndex = data.weeks.indexOf(data.current);
  const midpointOf = (row: Data["rows"][number]) =>
    measure === "minutes" ? row.target : data.problemsMidpoint;
  const unit = unitWord(measure);
  const kind = data.rowKind === "class" ? "Class" : "School";
  const rows = useMemo<Row[]>(
    () =>
      data.rows.map((row) => {
        const weeklyMeans = row.cells.flatMap((cell, index) =>
          cell && index < currentIndex ? [valueOf(cell, measure).mean] : [],
        );
        const summary = summarize(weeklyMeans);
        return { ...row, weeklyMeans, mean: summary ? summary.mean : null };
      }),
    [data, measure, currentIndex],
  );
  const pathOf = (row: Row) =>
    data.rowKind === "class" ? classPath(orgId, row.id) : orgPath(row.id);
  const tipFor = (row: Row, index: number): TipCard => {
    const week = data.weeks[index]!;
    const cell = row.cells[index];
    const title = `${row.name} · week of ${shortDay(week)}${index === currentIndex ? ", so far" : ""}`;
    if (index > currentIndex) return { title, note: "Still to come" };
    if (!cell) return { title, note: "Nobody on the roster yet" };
    const stat = valueOf(cell, measure);
    return {
      title,
      figure: figure(stat.mean),
      unit: `${unit} per student, mean`,
      stats: statsCells(stat, cell.n),
      share: {
        done: cell.practiced,
        of: cell.n,
        label: `${number(cell.practiced)} of ${number(cell.n)} practiced`,
      },
    };
  };
  const strip = (row: Row) => (
    <span
      className={styles.heatStrip}
      style={{ "--heat-columns": data.weeks.length } as CSSProperties}
    >
      {row.cells.map((cell, index) => (
        <HeatCell
          key={data.weeks[index]}
          value={cell ? valueOf(cell, measure).mean : null}
          midpoint={midpointOf(row)}
          future={index > currentIndex}
          current={index === currentIndex}
          tip={tipFor(row, index)}
        />
      ))}
    </span>
  );
  const meanTip = (row: Row): TipCard => {
    const summary = summarize(row.weeklyMeans);
    const title = `${row.name} · a week, on average`;
    return summary
      ? {
          title,
          figure: figure(summary.mean),
          unit: `${unit} per student, mean of ${summary.n} finished ${summary.n === 1 ? "week" : "weeks"}`,
          stats: statsCells(summary, summary.n),
        }
      : { title, note: "No finished week yet" };
  };
  const ticks = (
    <span
      className={styles.heatTicks}
      style={{ "--heat-columns": data.weeks.length } as CSSProperties}
    >
      {data.weeks.map((week, index) => (
        <span key={week}>
          {index === 0 ||
          week.slice(5, 7) !== data.weeks[index - 1]!.slice(5, 7)
            ? shortDay(week)
            : ""}
        </span>
      ))}
    </span>
  );
  const columns: DataGridColumn<Row>[] = [
    {
      id: "name",
      header: kind,
      width: 170,
      compare: (a, b) => compareClassNames(a.name, b.name),
      cell: (row) => (
        <Link
          to="/$"
          params={{ _splat: pathOf(row) }}
          className={styles.rowLink}
        >
          {row.name}
        </Link>
      ),
    },
    {
      id: "mean",
      header: "Mean a week",
      width: 96,
      align: "end",
      firstSort: "descending",
      compare: (a, b) => (a.mean ?? -1) - (b.mean ?? -1),
      cell: (row) => (
        <span className={styles.heatMean} {...tipAttributes(meanTip(row))}>
          {row.mean === null ? "—" : figure(row.mean)}
        </span>
      ),
      cellLabel: (row) =>
        row.mean === null ? "No finished week" : `${figure(row.mean)} ${unit}`,
    },
    {
      id: "weeks",
      header: "Week by week",
      headerDetail: ticks,
      width: Math.max(360, data.weeks.length * 18),
      cell: strip,
      cellLabel: (row) =>
        `${row.name}: ${row.mean === null ? "no finished week" : `${figure(row.mean)} ${unit} per student a week`}`,
    },
  ];
  const sort = parseSort(rawSort) ?? {
    column: "name",
    direction: "ascending" as const,
  };
  const targets = new Set(data.rows.map((row) => row.target));
  const legend =
    measure === "minutes" ? (
      <HeatLegend
        caption={`Active minutes per student, mean for the week`}
        midpoint={
          targets.size === 1 ? [...targets][0]! : medianOf([...targets])
        }
        midpointWord={targets.size === 1 ? "target" : "median target"}
        unit="minutes"
        empty={rows.some((row) =>
          row.cells.some((cell, index) => !cell && index <= currentIndex),
        )}
      />
    ) : data.problemsMidpoint ? (
      <HeatLegend
        caption="Problems per student, mean for the week. Midpoint: the median student-week with any problems this term"
        midpoint={data.problemsMidpoint}
        midpointWord="median"
        unit="problems"
      />
    ) : null;
  return (
    <div className={styles.heatMap}>
      {legend}
      {targets.size > 1 && measure === "minutes" && (
        <p className={styles.tableNote}>
          Each {data.rowKind}’s cells are scaled to its own weekly target.
        </p>
      )}
      <TipZone>
        <DataGrid
          label={`Practice by week, by ${data.rowKind}`}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          rowHeight={44}
          sort={sort}
          onSortChange={(next) =>
            void navigate({
              to: ".",
              replace: true,
              resetScroll: false,
              search: ((previous: Record<string, unknown>) => ({
                ...previous,
                rows: `${next.column}:${next.direction}`,
              })) as never,
            })
          }
          onRowActivate={(row) =>
            void navigate({ to: "/$", params: { _splat: pathOf(row) } })
          }
          rules={false}
          cardLayout="list"
          cardEstimate={72}
          card={(row) => (
            <div className={styles.heatCard}>
              <div className={styles.heatCardTop}>
                <Link
                  to="/$"
                  params={{ _splat: pathOf(row) }}
                  className={styles.rowLink}
                >
                  {row.name}
                </Link>
                <span
                  className={styles.heatMean}
                  {...tipAttributes(meanTip(row))}
                >
                  {row.mean === null ? "—" : `${figure(row.mean)} a week`}
                </span>
              </div>
              {strip(row)}
            </div>
          )}
        />
      </TipZone>
    </div>
  );
}

const medianOf = (values: number[]) => summarize(values)?.median ?? 60;
