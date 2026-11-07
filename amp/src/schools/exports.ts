import { Readable } from "node:stream";
import type { Pool } from "pg";
import { gradebookColumns, type GradebookColumn } from "./teacher-contracts.js";
import type { GradeComponentId } from "./grade-policy.js";
import type { ClassContext, GradebookRow, Term } from "./term-grades.js";

/** A cell a spreadsheet won't run as a formula. Teachers and imports write
 * these values, so a leading `=`, `+`, `-` or `@` is kept as text. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
const line = (cells: readonly (string | number | null | undefined)[]) =>
  `${cells.map(csvCell).join(",")}\r\n`;
/** So a spreadsheet reads the file as UTF-8. Machine formats go without. */
const BOM = "﻿";

const HEADERS: Record<GradebookColumn, string> = {
  sis: "SIS ID",
  name: "Student",
  final: "Final",
  low: "Suggested low",
  high: "Suggested high",
  course: "Course progress",
  growth: "Growth",
  practice: "Practice",
  retention: "Retention",
  minutes: "Active minutes",
};
const componentScore = (row: GradebookRow, id: GradeComponentId) =>
  row.suggestion.components.find((component) => component.id === id)?.score ??
  null;
const gradebookCell = (row: GradebookRow, column: GradebookColumn) => {
  switch (column) {
    case "sis":
      return row.student.identifier;
    case "name":
      return row.student.name;
    case "final":
      return row.final;
    case "low":
      return row.suggestion.low;
    case "high":
      return row.suggestion.high;
    case "minutes":
      return Math.round(row.suggestion.inputs.activeMinutes);
    default:
      return componentScore(row, column);
  }
};

/** One line at a time: a whole district's export never sits in memory. */
export function gradebookCsv(
  rows: readonly GradebookRow[],
  columns: readonly GradebookColumn[] = gradebookColumns,
): Readable {
  return Readable.from(
    (function* () {
      yield `${BOM}${line(columns.map((column) => HEADERS[column]))}`;
      for (const row of rows)
        yield line(columns.map((column) => gradebookCell(row, column)));
    })(),
    { objectMode: false },
  );
}

export type TimeRow = {
  identifier: string | null;
  name: string;
  day: string;
  minutes: number;
  problems: number;
};
export function timeCsv(rows: Iterable<TimeRow>): Readable {
  return Readable.from(
    (function* () {
      yield `${BOM}${line(["SIS ID", "Student", "Date", "Active minutes", "Problems"])}`;
      for (const row of rows)
        yield line([
          row.identifier,
          row.name,
          row.day,
          Math.round(row.minutes * 10) / 10,
          row.problems,
        ]);
    })(),
    { objectMode: false },
  );
}

/* A ZIP of stored files. The CSVs here are small, and a stored entry can be read
   by every tool an SIS import runs on. */
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const UTF8_NAMES = 0x0800;
function* zipChunks(files: readonly { name: string; content: string }[]) {
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name);
    const data = Buffer.from(file.content);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(UTF8_NAMES, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    yield local;
    yield name;
    yield data;
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(UTF8_NAMES, 8);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(central);
  yield directory;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  yield end;
}

const LINE_ITEM_COLUMNS = [
  "sourcedId",
  "status",
  "dateLastModified",
  "title",
  "description",
  "assignDate",
  "dueDate",
  "classSourcedId",
  "categorySourcedId",
  "gradingPeriodSourcedId",
  "resultValueMin",
  "resultValueMax",
];
const RESULT_COLUMNS = [
  "sourcedId",
  "status",
  "dateLastModified",
  "lineItemSourcedId",
  "studentSourcedId",
  "scoreStatus",
  "score",
  "textScore",
  "scoreDate",
  "comment",
];
const FINAL_CATEGORY = "amp-final-grades";
/** Every file a OneRoster 1.2 manifest accounts for. */
const ONEROSTER_FILES = [
  "academicSessions",
  "categories",
  "classes",
  "classResources",
  "courses",
  "courseResources",
  "demographics",
  "enrollments",
  "lineItemLearningObjectiveIds",
  "lineItems",
  "lineItemScoreScales",
  "orgs",
  "resources",
  "resultLearningObjectiveIds",
  "results",
  "resultScoreScales",
  "roles",
  "scoreScales",
  "userProfiles",
  "userResources",
  "users",
];
/** A numeric final is a score; B+ or Pass goes in the text score. */
export function oneRosterScore(final: string) {
  return /^\d+(\.\d+)?$/.test(final)
    ? { score: final, textScore: "" }
    : { score: "", textScore: final };
}
type OneRosterIds = {
  classId: string;
  termId: string;
  student: (row: GradebookRow) => string;
};
/** OneRoster 1.2 gradebook CSV: one line item for the term's final grade, and
 * one result per final entered. A suggestion is not a grade, so it isn't sent. */
export function oneRosterZip(
  term: Pick<Term, "id" | "name" | "startsOn" | "endsOn">,
  className: string,
  rows: readonly GradebookRow[],
  ids: OneRosterIds,
  now: Date,
): Readable {
  const stamp = now.toISOString();
  const lineItem = `amp-final-${ids.classId}-${ids.termId}`;
  const lineItems =
    line(LINE_ITEM_COLUMNS) +
    line([
      lineItem,
      "active",
      stamp,
      `${className}: ${term.name} final grade`,
      "Final grade decided by the teacher",
      term.startsOn,
      term.endsOn,
      ids.classId,
      FINAL_CATEGORY,
      ids.termId,
      0,
      100,
    ]);
  const results =
    line(RESULT_COLUMNS) +
    rows
      .filter((row) => row.final !== null)
      .map((row) =>
        line([
          `${lineItem}-${row.student.id}`,
          "active",
          stamp,
          lineItem,
          ids.student(row),
          "fully graded",
          oneRosterScore(row.final!).score,
          oneRosterScore(row.final!).textScore,
          stamp.slice(0, 10),
          "",
        ]),
      )
      .join("");
  const categories =
    line(["sourcedId", "status", "dateLastModified", "title"]) +
    line([FINAL_CATEGORY, "active", stamp, "Final grades"]);
  const sent = new Set(["categories", "lineItems", "results"]);
  const manifest =
    line(["propertyName", "value"]) +
    line(["manifest.version", "1.0"]) +
    line(["oneroster.version", "1.2"]) +
    ONEROSTER_FILES.map((file) =>
      line([`file.${file}`, sent.has(file) ? "bulk" : "absent"]),
    ).join("") +
    line(["source.systemName", "AMP"]) +
    line(["source.systemCode", "amp"]);
  return Readable.from(
    zipChunks([
      { name: "manifest.csv", content: manifest },
      { name: "categories.csv", content: categories },
      { name: "lineItems.csv", content: lineItems },
      { name: "results.csv", content: results },
    ]),
    { objectMode: false },
  );
}

/** The IDs an SIS knows, from `amp_external_refs` where a row was imported. */
export async function oneRosterIds(
  pool: Pool,
  context: Pick<ClassContext, "id" | "path">,
  termId: string,
  rows: readonly GradebookRow[],
): Promise<OneRosterIds> {
  const { rows: refs } = await pool.query(
    `SELECT local_id,sourced_id FROM amp_external_refs
     WHERE tenant_id=$1 AND local_id=ANY($2::uuid[]) ORDER BY created_at DESC`,
    [
      context.path[0],
      [context.id, termId, ...rows.map((row) => row.student.id)],
    ],
  );
  const known = new Map<string, string>();
  for (const ref of refs)
    if (!known.has(ref.local_id)) known.set(ref.local_id, ref.sourced_id);
  return {
    classId: known.get(context.id) ?? context.id,
    termId: known.get(termId) ?? termId,
    student: (row) =>
      known.get(row.student.id) ?? row.student.identifier ?? row.student.id,
  };
}

/** What a browser calls the file: plain words only. */
export const fileSlug = (...parts: readonly string[]) =>
  parts
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "export";
