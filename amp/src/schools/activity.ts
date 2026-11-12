import type { Pool } from "pg";
import type {
  ActivityKind,
  ActivityQuery,
  ActivityResponse,
} from "./org-contracts.js";
import { PERSON_NAME } from "./term-grades.js";
import { visibleToSql } from "./demo/sql.js";

export const ACTIVITY_PAGE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Which actions each filter means. An action nobody listed still shows under
 * "All", in the plainest sentence below. */
const KIND_PREFIXES: Record<ActivityKind, readonly string[]> = {
  grades: ["grade.", "term.", "workbook."],
  students: [
    "student.added",
    "student.updated",
    "student.transferred",
    "student.removed",
    "student.graduated",
    "student.moved-school",
    "seat.",
  ],
  classes: ["class.", "settings.", "standings."],
  staff: ["staff."],
  "sign-in": [
    "student.pictures",
    "student.card",
    "student.sessions",
    "signin.",
  ],
  calendar: ["calendar.", "year.", "setup.", "org.", "school."],
  license: ["license.", "integration."],
  privacy: ["privacy.", "agreement.", "student.share"],
};
const kindPatterns = (kind: ActivityKind) =>
  KIND_PREFIXES[kind].map((prefix) => `${prefix}%`);

type Detail = {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};
export type EventWords = {
  action: string;
  actor: string | null;
  person: string | null;
  className: string | null;
  orgName: string | null;
  sessionName: string | null;
  detail: Detail;
  /** Other orgs and classes a detail refers to, by id. */
  names: ReadonlyMap<string, string>;
};
const has = (value: unknown): value is string | number =>
  typeof value === "string" || typeof value === "number";
const words = (value: number | undefined | null, one: string, many: string) =>
  `${(value ?? 0).toLocaleString("en-US")} ${value === 1 ? one : many}`;
const grade = (value: unknown) =>
  value === 0
    ? "kindergarten"
    : value === 13
      ? "college level"
      : `grade ${String(value)}`;
const possessive = (name: string) => `${name}’s`;
const roleWord: Record<string, string> = {
  admin: "an admin",
  teacher: "a teacher",
  aide: "an aide",
  viewer: "a viewer",
};
const dateWords = (iso: unknown) =>
  typeof iso === "string"
    ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

/** One line of the log, in words. Names come from the people and classes as they
 * are today, and nothing here is ever stored: a tombstone reads "Removed". */
export function describeEvent({
  action,
  actor,
  person,
  className,
  orgName,
  sessionName,
  detail,
  names,
}: EventWords): string {
  const who = actor ?? "AMP";
  const student = person ?? "a student";
  const klass = className ?? "a class";
  const after = detail.after ?? {};
  const before = detail.before ?? {};
  const school = orgName ?? "the school";
  const nameOf = (id: unknown) =>
    typeof id === "string" ? (names.get(id) ?? null) : null;
  switch (action) {
    case "grade.final-set":
      return after.value === null || after.value === undefined
        ? `${who} cleared ${possessive(student)} final grade${nameOf(after.classId) ? ` in ${nameOf(after.classId)}` : ""}`
        : `${who} set ${possessive(student)} grade to ${String(after.value)}${nameOf(after.classId) ? ` in ${nameOf(after.classId)}` : ""}`;
    case "grade.curve-set":
      return after.curve === null || after.curve === undefined
        ? `${who} returned ${klass} to the standard scale for ${nameOf(after.sessionId) ?? "a term"}`
        : `${who} set the grade curve for ${klass} in ${nameOf(after.sessionId) ?? "a term"}`;
    case "term.closed":
      return `${who} closed ${nameOf(after.sessionId) ?? "a term"} for ${klass}, freezing ${words(after.students as number, "grade", "grades")}`;
    case "student.added":
      return `${who} added ${student}${after.seated === false ? ", who needs a seat" : ""}`;
    case "student.updated":
      return has(after.gradeLevel)
        ? `${who} moved ${student} to ${grade(after.gradeLevel)}`
        : `${who} updated ${possessive(student)} details`;
    case "student.transferred":
      return `${who} changed ${possessive(student)} classes`;
    case "student.removed":
      return `${who} removed a student and deleted their learning data`;
    case "student.graduated":
      return `${student} finished at ${school} and graduated`;
    case "student.moved-school":
      return `${who} moved ${student} from ${nameOf(before.orgId) ?? "one school"} to ${nameOf(after.orgId) ?? "another"}${after.seat === "needs" ? ", who now needs a seat" : ""}`;
    case "student.pictures-set":
      return `${student} chose sign-in pictures`;
    case "student.pictures-reset":
      return `${who} reset ${possessive(student)} sign-in pictures`;
    case "student.sessions-revoked":
      return `${who} signed ${student} out everywhere`;
    case "student.card-issued":
      return `${who} made a sign-in card for ${student}`;
    case "student.card-reissued":
      return `${who} made a new sign-in card for ${student}`;
    case "student.share-created":
      return `${who} made a family link for ${student}`;
    case "student.share-rotated":
      return `${who} made a new family link for ${student}`;
    case "student.share-revoked":
      return `${who} turned off ${possessive(student)} family link`;
    case "standings.left_off":
      return after.leftOff
        ? `${who} left ${student} off the standings`
        : `${who} put ${student} back on the standings`;
    case "standings.teacher_shown":
      return after.shown
        ? `${who} showed their own practice in ${klass}`
        : `${who} took their own practice off ${klass}’s map and board`;
    case "workbook.marked":
      return `${who} marked ${words(after.marks as number, "answer", "answers")} in ${possessive(student)} workbook`;
    case "seat.released":
      return `${who} released ${possessive(student)} seat`;
    case "class.created":
      return `${who} added ${klass}`;
    case "class.updated":
      return `${who} changed ${klass}`;
    case "class.code-rotated":
      return `${who} made a new class code for ${klass}`;
    case "class.join-locked":
      return `Sign-in to ${klass} paused after too many wrong tries`;
    case "settings.changed":
      return `${who} changed student experience settings`;
    case "staff.added":
      return `${person ?? "Someone"} joined${has(after.role) ? ` as ${roleWord[after.role] ?? "staff"}` : ""}`;
    case "staff.invited":
      return `${who} invited ${person ?? "someone"}${has(after.role) ? ` as ${roleWord[after.role] ?? "staff"}` : ""}`;
    case "staff.accepted":
      return `${person ?? "Someone"} accepted their invitation`;
    case "staff.ended":
      return person
        ? `${who} ended ${possessive(person)} access`
        : `${who} ended someone’s access`;
    case "staff.classes-changed":
      return `${who} changed which classes ${person ?? "someone"} teaches`;
    case "staff.updated":
      return `${who} updated ${possessive(person ?? "a staff member")} details`;
    case "calendar.set":
      return `${who} set the calendar`;
    case "calendar.grading":
      return `${who} set the school’s grading periods`;
    case "calendar.session-changed":
      return `${who} changed the dates of ${sessionName ?? "a term"}`;
    case "year.rolled-over":
      return `${who} started ${sessionName ?? "a new year"}: ${words(after.classes as number, "class", "classes")} carried over, ${words(after.advanced as number, "student", "students")} moved up a grade, ${words(after.graduated as number, "graduate", "graduates")}`;
    case "school.added":
      return `${who} added ${school}`;
    case "org.created":
      return `${school} was set up`;
    case "setup.finished":
      return `${who} finished setting up ${school}`;
    case "agreement.accepted":
      return actor
        ? `${actor} accepted the data agreement`
        : "The data agreement was accepted";
    case "license.issued":
      return `A license for ${words(after.seats as number, "seat", "seats")} began, through ${dateWords(after.endsAt)}`;
    case "license.seats-changed":
      return `The license changed to ${words(after.seats as number, "seat", "seats")}`;
    case "license.extended":
      return `The license now runs through ${dateWords(after.endsAt)}`;
    case "license.requested":
      return `${who} asked for ${words(after.seats as number, "more seat", "more seats")}`;
    case "integration.requested":
      return `${who} asked to set up ${String(after.label ?? "an integration")}`;
    case "signin.provider-changed":
      return `${who} turned ${after.enabled ? "on" : "off"} ${String(after.label ?? "outside")} sign-in`;
    case "privacy.exported":
      return `${who} exported all student data for ${school}`;
    case "privacy.erase-started":
      return `${who} began deleting all student data at ${school}`;
    case "privacy.erase-finished":
      return `All student data at ${school} was deleted`;
    default:
      return `${who} made a change`;
  }
}

const CLOCK = `to_char(e."at" AT TIME ZONE $2::text,'FMHH12:MI AM')`;
const DAY = `to_char(e."at" AT TIME ZONE $2::text,'YYYY-MM-DD')`;
const CURSOR = `to_char(e."at" AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/** The log, newest first, a page at a time by (at, id) at the database. One index
 * scan per org, merged, so paging stays quick however long the history is. A
 * filter by person goes through their own indexes instead. */
export async function readActivity(
  pool: Pool,
  org: { orgId: string; path: string[]; timezone: string },
  query: ActivityQuery,
  /** The reader's account: what another visitor of a shared demo did, or
   * was done to them, isn't shown. */
  viewer: string | null = null,
): Promise<ActivityResponse> {
  const [beforeAt, beforeId] = query.before?.split("_") ?? [null, null];
  const params: unknown[] = [
    org.orgId,
    org.timezone,
    beforeAt,
    beforeId,
    query.kind ? kindPatterns(query.kind) : null,
    query.from ?? null,
    query.to ?? null,
    viewer,
  ];
  const filters = `($3::timestamptz IS NULL OR (e."at",e.id)<($3::timestamptz,$4::uuid))
    AND ($5::text[] IS NULL OR e.action LIKE ANY($5::text[]))
    AND ($6::date IS NULL OR e."at">=($6::date::timestamp AT TIME ZONE $2::text))
    AND ($7::date IS NULL OR e."at"<(($7::date+1)::timestamp AT TIME ZONE $2::text))
    AND NOT EXISTS(SELECT 1 FROM amp_people vp
      WHERE vp.id IN (e.actor_person_id,CASE WHEN e.target_kind='person' AND e.target_id ~ '^[0-9a-f-]{36}$' THEN e.target_id::uuid END)
        AND vp.demo_visitor AND vp.account_id IS DISTINCT FROM $8::text)`;
  const select = `e.id,e.org_id,e.action,e.target_kind,e.target_id,e.detail,e.actor_person_id,${CURSOR} AS cursor,${DAY} AS day,${CLOCK} AS time`;
  const { rows } = query.person
    ? await pool.query(
        `SELECT ${select} FROM amp_school_events e
         WHERE e.org_id=ANY(ARRAY(SELECT id FROM amp_orgs WHERE path @> ARRAY[$1]::uuid[]))
           AND (e.actor_person_id=$9::uuid OR (e.target_kind='person' AND e.target_id=$9::text))
           AND ${filters}
         ORDER BY e."at" DESC,e.id DESC LIMIT ${ACTIVITY_PAGE + 1}`,
        [...params, query.person],
      )
    : await pool.query(
        `SELECT ${select} FROM amp_orgs o CROSS JOIN LATERAL (
           SELECT * FROM amp_school_events e WHERE e.org_id=o.id AND ${filters}
           ORDER BY e."at" DESC,e.id DESC LIMIT ${ACTIVITY_PAGE + 1}
         ) e WHERE o.path @> ARRAY[$1]::uuid[]
         ORDER BY e."at" DESC,e.id DESC LIMIT ${ACTIVITY_PAGE + 1}`,
        params,
      );
  const page = rows.slice(0, ACTIVITY_PAGE);
  const people = new Set<string>();
  const others = new Set<string>();
  for (const row of page) {
    if (row.actor_person_id) people.add(row.actor_person_id);
    if (row.target_kind === "person") people.add(row.target_id);
    else others.add(row.target_id);
    others.add(row.org_id);
    for (const side of [row.detail?.before, row.detail?.after])
      for (const key of ["classId", "orgId", "sessionId"])
        if (typeof side?.[key] === "string") others.add(side[key]);
  }
  if (query.person) people.add(query.person);
  const ids = [...others].filter((id) => UUID.test(id));
  const [personRows, nameRows] = await Promise.all([
    pool.query(
      `SELECT p.id,${PERSON_NAME} AS name FROM amp_people p WHERE p.id=ANY($1::uuid[]) AND p.tenant_id=$2
         AND ${visibleToSql("p", "$3::text")}`,
      [[...people], org.path[0], viewer],
    ),
    pool.query(
      `SELECT c.id,c.name FROM amp_classes c WHERE c.id=ANY($1::uuid[])
       UNION ALL SELECT o.id,o.name FROM amp_orgs o WHERE o.id=ANY($1::uuid[])
       UNION ALL SELECT s.id,s.name FROM amp_academic_sessions s WHERE s.id=ANY($1::uuid[])`,
      [ids],
    ),
  ]);
  const personName = new Map<string, string>(
    personRows.rows.map((row) => [row.id, row.name]),
  );
  const names = new Map<string, string>(
    nameRows.rows.map((row) => [row.id, row.name]),
  );
  const last = page.at(-1);
  return {
    events: page.map((row) => ({
      id: row.id,
      at: row.cursor,
      day: row.day,
      time: row.time,
      sentence: describeEvent({
        action: row.action,
        actor: row.actor_person_id
          ? (personName.get(row.actor_person_id) ?? null)
          : null,
        person:
          row.target_kind === "person"
            ? (personName.get(row.target_id) ?? null)
            : null,
        className:
          row.target_kind === "class"
            ? (names.get(row.target_id) ?? null)
            : null,
        orgName: names.get(row.org_id) ?? null,
        sessionName:
          row.target_kind === "session"
            ? (names.get(row.target_id) ?? null)
            : null,
        detail: row.detail ?? {},
        names,
      }),
    })),
    next:
      rows.length > ACTIVITY_PAGE && last ? `${last.cursor}_${last.id}` : null,
    person:
      query.person && personName.has(query.person)
        ? { id: query.person, name: personName.get(query.person)! }
        : null,
  };
}

/** Who a person filter can name: people at this org or below, staff and students. */
export async function activityPeople(
  pool: Pool,
  org: { orgId: string; path: string[] },
  q: string,
  viewer: string | null = null,
) {
  const needle = `%${q.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
  const { rows } = await pool.query(
    `SELECT p.id,${PERSON_NAME} AS name,
       (SELECT r.role FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
         WHERE r.person_id=p.id AND o.path @> ARRAY[$1]::uuid[] ORDER BY r.begin_on DESC LIMIT 1) AS role
     FROM amp_people p
     WHERE p.tenant_id=$2 AND p.deleted_at IS NULL
       AND EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
         WHERE r.person_id=p.id AND o.path @> ARRAY[$1]::uuid[])
       AND lower(concat_ws(' ',p.display_name,p.given_name,p.family_name)) LIKE $3
       AND ${visibleToSql("p", "$4::text")}
     ORDER BY lower(${PERSON_NAME}),p.id LIMIT 8`,
    [org.orgId, org.path[0], needle, viewer],
  );
  return { people: rows };
}
