import type { Pool, PoolClient } from "pg";
import type { BoardScope, StandingsBoard } from "./classroom-contracts.js";
import { SchoolError } from "./contracts.js";
import { enrollmentSettings } from "./enrollment-settings.js";
import { activeToday } from "./principal.js";
import {
  resolveSettings,
  studentLevelVisibility,
  type ResolvedSettings,
  type SchoolSettings,
  type SettingsScope,
} from "./settings.js";
import { STUDENT_NAME } from "./sign-in.js";
import { PLACEMENT_ATTEMPTS } from "../learning/placement.js";
import { startLevelSql } from "./start-level.js";

/** Standings read from `amp_skill_days` and `amp_level_days`, independent work
 * only, and nothing here feeds what's scheduled next. A board is the top ten and
 * your own line. It is never a ranked list down to last place: a small board
 * lists its top three quarters, and nobody's rank shows unless they're listed. */
type Database = Pick<PoolClient, "query">;
type Measure = SchoolSettings["measure"];
type Roster = { personId: string; learnerId: string };
type Term = { from: string; to: string };
type Row = { personId: string; name: string; value: number };

const LEFT_OFF_SQL = `"values"->'leftOff' ? $2`;
const scopeRank: Record<SchoolSettings["standings"], number> = {
  off: 0,
  class: 1,
  school: 2,
  district: 3,
};
const LIST_LIMIT = 10;
/** A hidden or student-chosen level doesn't go on a board for others to read. */
const measureFor = (
  measure: Measure,
  levels: SchoolSettings["levels"],
): Measure => (measure === "level" && levels !== "shown" ? "growth" : measure);

/** How many of `count` a board lists: ten, or fewer so the end never shows. */
export const listedCount = (count: number) =>
  Math.min(LIST_LIMIT, count - Math.ceil(count / 4));

type StudentClass = {
  id: string;
  name: string;
  org_id: string;
  session_id: string;
  grading_kind: string;
  path: string[];
};
type Place = {
  person: {
    id: string;
    learner_id: string;
    handle: string;
    name: string;
    grade_level: number | null;
  };
  classes: StudentClass[];
  settings: ResolvedSettings[];
  /** This student's classes whose teacher left them off. */
  leftOff: Set<string>;
};

async function studentPlace(
  db: Database,
  personId: string,
): Promise<Place | null> {
  const person = (
    await db.query(
      `SELECT p.id,p.learner_id,p.handle,p.grade_level,${STUDENT_NAME} AS name FROM amp_people p
       WHERE p.id=$1 AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL`,
      [personId],
    )
  ).rows[0];
  const home = (
    await db.query(
      `SELECT o.path FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
       WHERE r.person_id=$1 AND r.role='student' AND ${activeToday("r", "o")}
       ORDER BY r.begin_on DESC,o.id LIMIT 1`,
      [personId],
    )
  ).rows[0];
  if (!person || !home) return null;
  const classes = (
    await db.query(
      `SELECT c.id,c.name,c.org_id,c.session_id,c.grading_kind,o.path FROM amp_enrollments e
       JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
       WHERE e.person_id=$1 AND e.role='student' AND c.archived_at IS NULL AND ${activeToday("e", "o")}
       ORDER BY e.begin_on DESC,c.name,c.id`,
      [personId],
    )
  ).rows as StudentClass[];
  const settings = await enrollmentSettings(db, personId, home, classes);
  const left = classes.length
    ? await db.query(
        `SELECT scope_id FROM amp_scope_settings
         WHERE scope_kind='class' AND scope_id=ANY($1::uuid[]) AND ${LEFT_OFF_SQL}`,
        [classes.map((c) => c.id), personId],
      )
    : { rows: [] };
  return {
    person,
    classes,
    settings,
    leftOff: new Set(left.rows.map((row) => row.scope_id)),
  };
}

const boardScope = (setting: SchoolSettings["standings"]) =>
  setting === "off" ? null : (setting as BoardScope);
/** A student left off anywhere stays off every board wider than a class. */
const boardOpen = (place: Place, index: number) => {
  const klass = place.classes[index]!;
  const scope = boardScope(place.settings[index]!.standings.value);
  if (!scope || place.leftOff.has(klass.id)) return null;
  return scope !== "class" && place.leftOff.size > 0 ? null : scope;
};

/** For `/me`, which already holds the student's classes and settings: whether
 * `/standings` has anything for them. Nothing more is read unless a class has a
 * board at all, and `/me` runs for a whole class at the bell. */
export async function hasOpenBoard(
  db: Database,
  personId: string,
  classes: readonly { id: string }[],
  settings: readonly ResolvedSettings[],
): Promise<boolean> {
  const on = classes.filter(
    (_, index) => settings[index]?.standings.value !== "off",
  );
  if (!on.length) return false;
  const left = await db.query(
    `SELECT scope_id FROM amp_scope_settings
     WHERE scope_kind='class' AND scope_id=ANY($1::uuid[]) AND ${LEFT_OFF_SQL}`,
    [classes.map((c) => c.id), personId],
  );
  const leftOff = new Set(left.rows.map((row) => row.scope_id));
  return classes.some((klass, index) => {
    const scope = boardScope(settings[index]?.standings.value ?? "off");
    if (!scope || leftOff.has(klass.id)) return false;
    return scope === "class" || leftOff.size === 0;
  });
}

/** The boards this student can open. Empty: `/standings` isn't for them. */
export async function studentBoards(db: Database, personId: string) {
  const place = await studentPlace(db, personId);
  if (!place) return [];
  return place.classes.flatMap((klass, index) => {
    const scope = boardOpen(place, index);
    return scope ? [{ classId: klass.id, className: klass.name, scope }] : [];
  });
}

/** The class's term today: the part of its session matching how it grades, or
 * the session itself. Never runs past today. */
async function termFor(db: Database, klass: StudentClass): Promise<Term> {
  const found = (
    await db.query(
      `WITH RECURSIVE tree AS (
         SELECT id,kind,starts_on,ends_on FROM amp_academic_sessions WHERE id=$1
         UNION ALL
         SELECT s.id,s.kind,s.starts_on,s.ends_on FROM amp_academic_sessions s JOIN tree ON s.parent_id=tree.id
       ), today AS (
         SELECT (now() AT TIME ZONE timezone)::date AS day FROM amp_orgs WHERE id=$2
       )
       SELECT t.starts_on::text AS "from",LEAST(t.ends_on,today.day)::text AS "to"
       FROM tree t CROSS JOIN today
       ORDER BY (t.starts_on<=today.day AND t.ends_on>=today.day) DESC,(t.kind=$3) DESC,t.ends_on-t.starts_on,t.id
       LIMIT 1`,
      [klass.session_id, klass.org_id, klass.grading_kind],
    )
  ).rows[0] as Term;
  return found;
}

const shiftDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

/** One number per student, for students with something to show. Growth is a
 * hundredth of a grade per point, so it reads as a whole number and says nothing
 * of the level itself. A term's growth starts where the teacher's does
 * (`start-level.ts`); a week's runs from the last settled level before it. */
async function measured(
  db: Database,
  roster: Roster[],
  measure: Measure,
  { from, to }: Term,
  span: "term" | "week" = "term",
): Promise<Map<string, number>> {
  const person = new Map(roster.map((m) => [m.learnerId, m.personId]));
  const values = new Map<string, number>();
  const learners = [...person.keys()];
  if (!learners.length) return values;
  const independent = await db.query(
    `SELECT learner_id,sum(independent)::int AS done FROM amp_skill_days
     WHERE learner_id=ANY($1::text[]) AND day BETWEEN $2::date AND $3::date
     GROUP BY learner_id HAVING sum(independent)>0`,
    [learners, from, to],
  );
  if (measure === "practice") {
    for (const row of independent.rows)
      values.set(person.get(row.learner_id)!, row.done);
    return values;
  }
  if (measure === "level") {
    const latest = await db.query(
      `SELECT DISTINCT ON (learner_id) learner_id,frontier->'overall' AS overall FROM amp_level_days
       WHERE learner_id=ANY($1::text[]) AND day<=$2::date ORDER BY learner_id,day DESC`,
      [learners, to],
    );
    for (const row of latest.rows)
      if (
        Number(row.overall?.independent) > 0 &&
        Number(row.overall?.level) > 0
      )
        values.set(
          person.get(row.learner_id)!,
          Math.round(Number(row.overall.level) * 10) / 10,
        );
    return values;
  }
  const worked = new Set(independent.rows.map((row) => row.learner_id));
  const ends = await db.query(
    `SELECT l.learner_id,
       (SELECT d.overall_level::float8 FROM amp_level_days d
        WHERE d.learner_id=l.learner_id AND d.day<=$3::date ORDER BY d.day DESC LIMIT 1) AS latest,
       ${
         span === "term"
           ? startLevelSql({
               select: "d.overall_level::float8",
               learner: "l.learner_id",
               from: "$2::date",
               to: "$3::date",
             })
           : `COALESCE(
         (SELECT d.overall_level::float8 FROM amp_level_days d
          WHERE d.learner_id=l.learner_id AND d.day<$2::date AND d.overall_answered>=${PLACEMENT_ATTEMPTS} ORDER BY d.day DESC LIMIT 1),
         ${startLevelSql({ select: "d.overall_level::float8", learner: "l.learner_id", from: "$2::date", to: "$3::date" })}
       )`
       } AS start
     FROM unnest($1::text[]) AS l(learner_id)`,
    [[...worked], from, to],
  );
  for (const row of ends.rows) {
    // Still placing: no start, so nothing to show rather than a zero.
    if (row.start === null || row.latest === null) continue;
    const points = Math.round((row.latest - row.start) * 100);
    if (points > 0) values.set(person.get(row.learner_id)!, points);
  }
  return values;
}

const sorted = (rows: Row[]) =>
  rows.sort(
    (a, b) => b.value - a.value || a.personId.localeCompare(b.personId),
  );

/* Wider boards reach across a whole school or district, so one computes for
   every grade at once and everyone reads the same answer for a minute. */
type WideBoard = { byGrade: Map<number | null, Row[]> };
const WIDE_TTL_MS = 60_000;
const WIDE_LIMIT = 200;
const wideCache = new Map<string, { at: number; board: Promise<WideBoard> }>();
/** A setting changed on this pod. Other pods catch up within a minute. */
export function clearStandingsCache() {
  wideCache.clear();
}
function cachedWide(key: string, load: () => Promise<WideBoard>) {
  const now = Date.now();
  const hit = wideCache.get(key);
  if (hit && now - hit.at < WIDE_TTL_MS) return hit.board;
  const board = load();
  wideCache.set(key, { at: now, board });
  void board.catch(() => wideCache.delete(key));
  if (wideCache.size > WIDE_LIMIT)
    wideCache.delete(wideCache.keys().next().value!);
  return board;
}

/** Everyone on a school or district board: students of that org whose own class
 * says at least this wide, and whose teachers haven't left them off. */
async function loadWide(
  db: Database,
  orgId: string,
  scope: BoardScope,
  measure: Measure,
  term: Term,
): Promise<WideBoard> {
  const people = (
    await db.query(
      `SELECT DISTINCT p.id,p.learner_id,p.handle,p.grade_level
       FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
       JOIN amp_people p ON p.id=r.person_id AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
       WHERE r.role='student' AND o.path @> ARRAY[$1]::uuid[] AND ${activeToday("r", "o")}`,
      [orgId],
    )
  ).rows as {
    id: string;
    learner_id: string;
    handle: string;
    grade_level: number | null;
  }[];
  const enrolled = (
    await db.query(
      `SELECT e.person_id,c.id AS class_id,o.path FROM amp_enrollments e
       JOIN amp_classes c ON c.id=e.class_id AND c.archived_at IS NULL JOIN amp_orgs o ON o.id=c.org_id
       WHERE e.role='student' AND o.path @> ARRAY[$1]::uuid[] AND ${activeToday("e", "o")}`,
      [orgId],
    )
  ).rows as { person_id: string; class_id: string; path: string[] }[];
  const orgIds = [...new Set(enrolled.flatMap((row) => row.path))];
  const classIds = [...new Set(enrolled.map((row) => row.class_id))];
  const stored = (
    await db.query(
      `SELECT scope_kind AS kind,scope_id AS id,"values",locked FROM amp_scope_settings
       WHERE (scope_kind='org' AND scope_id=ANY($1::uuid[]))
          OR (scope_kind='class' AND scope_id=ANY($2::uuid[]))
          OR (scope_kind='person' AND scope_id=ANY($3::uuid[]))`,
      [orgIds, classIds, people.map((p) => p.id)],
    )
  ).rows as (SettingsScope & { id: string })[];
  const scopes = new Map(stored.map((row) => [`${row.kind}:${row.id}`, row]));
  const found = (kind: string, id: string) => {
    const row = scopes.get(`${kind}:${id}`);
    return row ? [row] : [];
  };
  const eligible = new Set<string>();
  const leftOff = new Set<string>();
  for (const row of stored)
    if (row.kind === "class")
      for (const id of ((row.values as Record<string, unknown>).leftOff as
        string[] | undefined) ?? [])
        leftOff.add(id);
  for (const { person_id, class_id, path } of enrolled) {
    if (eligible.has(person_id) || leftOff.has(person_id)) continue;
    const settings = resolveSettings([
      ...path.flatMap((id) => found("org", id)),
      ...found("class", class_id),
      ...found("person", person_id),
    ]);
    if (scopeRank[settings.standings.value] < scopeRank[scope]) continue;
    if (measure === "level" && settings.levels.value !== "shown") continue;
    eligible.add(person_id);
  }
  const onBoard = people.filter((p) => eligible.has(p.id));
  const values = await measured(
    db,
    onBoard.map((p) => ({ personId: p.id, learnerId: p.learner_id })),
    measure,
    term,
  );
  const byGrade = new Map<number | null, Row[]>();
  for (const person of onBoard) {
    const value = values.get(person.id);
    if (value === undefined) continue;
    const group = byGrade.get(person.grade_level) ?? [];
    group.push({ personId: person.id, name: person.handle, value });
    byGrade.set(person.grade_level, group);
  }
  for (const group of byGrade.values()) sorted(group);
  return { byGrade };
}

async function classBoardRows(
  db: Database,
  classId: string,
  measure: Measure,
  term: Term,
): Promise<Row[]> {
  const rows = (
    await db.query(
      `SELECT p.id AS "personId",p.learner_id AS "learnerId",${STUDENT_NAME} AS name
       FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
       JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
       WHERE e.class_id=$1 AND e.role='student' AND ${activeToday("e", "o")}
         AND NOT EXISTS(SELECT 1 FROM amp_scope_settings s WHERE s.scope_kind='class' AND s.scope_id=$1
           AND s."values"->'leftOff' ? p.id::text)`,
      [classId],
    )
  ).rows as (Roster & { name: string })[];
  const values = await measured(db, rows, measure, term);
  return sorted(
    rows.flatMap((row) => {
      const value = values.get(row.personId);
      return value === undefined
        ? []
        : [{ personId: row.personId, name: row.name, value }];
    }),
  );
}

function shape(rows: readonly Row[], personId: string) {
  const listed = rows.slice(0, listedCount(rows.length));
  const place = (value: number) =>
    1 + rows.filter((row) => row.value > value).length;
  return listed.map((row) => ({
    rank: place(row.value),
    name: row.name,
    value: row.value,
    you: row.personId === personId,
  }));
}

/** One class's board, as this student may read it. Anything they may not read
 * doesn't exist. */
export async function studentBoard(
  pool: Pool,
  personId: string,
  classId: string,
): Promise<StandingsBoard> {
  const place = await studentPlace(pool, personId);
  const index = place?.classes.findIndex((klass) => klass.id === classId) ?? -1;
  const scope = place && index >= 0 ? boardOpen(place, index) : null;
  if (!place || !scope) throw new SchoolError(404, "not_found");
  const klass = place.classes[index]!;
  const settings = place.settings[index]!;
  const measure = measureFor(
    settings.measure.value,
    studentLevelVisibility(place.settings).value,
  );
  const term = await termFor(pool, klass);
  const orgId = scope === "district" ? klass.path[0]! : klass.org_id;
  const grade = scope === "class" ? null : place.person.grade_level;
  const rows =
    scope === "class"
      ? await classBoardRows(pool, classId, measure, term)
      : ((
          await cachedWide(
            `${orgId}:${scope}:${measure}:${term.from}:${term.to}`,
            () => loadWide(pool, orgId, scope, measure, term),
          )
        ).byGrade.get(grade) ?? []);
  const top = shape(rows, personId);
  const placeName =
    scope === "class"
      ? klass.name
      : (await pool.query("SELECT name FROM amp_orgs WHERE id=$1", [orgId]))
          .rows[0].name;
  const self: Roster = { personId, learnerId: place.person.learner_id };
  // Work on paper or in the last week, however the board was cached.
  const own = await measured(pool, [self], measure, term);
  const week = await measured(
    pool,
    [self],
    measure === "practice" ? "practice" : "growth",
    {
      from: [term.from, shiftDays(term.to, -6)].sort().at(-1)!,
      to: term.to,
    },
    "week",
  );
  const listed = top.find((row) => row.you);
  return {
    board: {
      classId,
      className: klass.name,
      scope,
      placeName,
      gradeLevel: grade,
      measure,
    },
    top,
    you: {
      name: scope === "class" ? place.person.name : place.person.handle,
      value: own.get(personId) ?? 0,
      thisWeek: week.get(personId) ?? 0,
      rank: listed?.rank ?? null,
    },
  };
}
