/**
 * The shared demo school (docs/schools.md#demo-places): a whole school, fully
 * alive, written once a day per demo zone from the static term (`roster.ts`,
 * `shift.ts`). One transaction writes the place, its made-up people and twelve
 * weeks of practice; then the hero class gets a stack of real workbooks.
 * Visitors join it (`shared.ts`). Everything in it is synthetic: made-up
 * students, `demo` grants that are never revenue, no mail, and no way to add
 * a real student.
 */
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Repository } from "../../server/repository.js";
import { generateProblem } from "../../math/engine.js";
import { workbookWorker } from "../../workbook/off-thread.js";
import { findOrMakeWorkbook } from "../../workbook/routes.js";
import type { WorkbookRecord } from "../../workbook/contracts.js";
import { PAPER_MARK_WEIGHT, paperProblemId } from "../../workbook/results.js";
import { defaultPracticeSettings } from "../../learning/practice-settings.js";
import {
  birthYearForGrade,
  generateHandle,
  generateJoinCode,
} from "../repository.js";
import { schoolAccountId } from "../principal.js";
import { AGREEMENT_VERSION } from "../agreement.js";
import { hashPictures } from "../sign-in.js";
import { writeClassHistory } from "./history.js";
import { TEACHER_NAMES } from "./names.js";
import { DAY, hash, wrongResponse, type Persona } from "./personas.js";
import {
  demoRoster,
  joinedOn,
  SCHOOL_NAME,
  sharedDay,
  zonedInstant,
  type DemoKind,
} from "./roster.js";
import { shiftTerms } from "./shift.js";
import { demoTerms } from "./snapshot.js";
import type { Simulation } from "./simulate.js";
import { seedCalendar, seedStaffEvents, sumWeeks } from "./term.js";

export { demoKinds, type DemoKind } from "./roster.js";

const DEMO_TEACHERS = [
  TEACHER_NAMES[4]!,
  TEACHER_NAMES[2]!,
  TEACHER_NAMES[10]!,
];

/** The name a demo greets its owner by: the account's own, else none. */
export async function ownerName(client: PoolClient, accountId: string) {
  if (!accountId.startsWith("amp|")) return null;
  const table = await client.query(
    "SELECT to_regclass('amp_auth_users') IS NOT NULL AS present",
  );
  if (!table.rows[0].present) return null;
  const row = (
    await client.query(`SELECT name,email FROM amp_auth_users WHERE id=$1`, [
      accountId.slice(4),
    ])
  ).rows[0] as { name?: string | null; email?: string | null } | undefined;
  const name = row?.name?.trim();
  if (!name || name.includes("@") || name === row?.email) return null;
  return name.slice(0, 100);
}

async function insertClass(
  client: PoolClient,
  input: { orgId: string; sessionId: string; name: string; grade: number },
) {
  const id = randomUUID();
  for (let attempt = 0; attempt < 6; attempt++) {
    const inserted = await client.query(
      `INSERT INTO amp_classes(id,org_id,session_id,name,course_bands,grading_kind,join_code,created_at)
       VALUES($1,$2,$3,$4,$5,'semester',$6,now()-interval '84 days') ON CONFLICT (join_code) DO NOTHING RETURNING id`,
      [
        id,
        input.orgId,
        input.sessionId,
        input.name,
        [String(input.grade)],
        generateJoinCode(),
      ],
    );
    if (inserted.rowCount) return id;
  }
  throw new Error("No unused class code was found");
}

type Planned = {
  classId: string;
  grade: number;
  people: {
    personId: string;
    learnerId: string;
    persona: Persona;
    joined: string;
  }[];
};

export type SharedPlace = {
  orgId: string;
  heroClassId: string;
  classIds: string[];
};

/** Writes a zone's shared school for `day` (today in `timezone`) from its
 * terms, already moved to that day, one per student in roster order. Nobody
 * teaches the hero class until visitors join it. */
export async function buildSharedSchool(
  client: PoolClient,
  input: {
    timezone: string;
    day: string;
    /** "class" is the hero class alone, for a fixture (`buildFixtureClass`). */
    kind?: DemoKind;
  },
  terms: readonly Simulation[],
): Promise<SharedPlace> {
  const { timezone } = input;
  const kind = input.kind ?? "school";
  const school = kind === "school";
  const orgId = randomUUID();
  // Midday of the school's today: the calendar's term starts on the Monday
  // twelve weeks before this one, as the term does.
  const noon = Date.parse(`${input.day}T12:00:00Z`);
  await client.query(
    `INSERT INTO amp_orgs(id,kind,path,name,timezone,solo,setup_pending,created_by,demo,demo_kind,demo_seen_at,created_at)
     VALUES($1,'school',ARRAY[$1]::uuid[],$2,$3,$4,false,'amp-demo:'||$1,true,$5,now(),now()-interval '84 days')`,
    [
      orgId,
      school ? SCHOOL_NAME : demoRoster("class")[0]!.name,
      timezone,
      !school,
      kind,
    ],
  );
  const year = await seedCalendar(client, orgId, noon);
  // Its students are made up, and nothing can add a real one, so AMP itself
  // stands behind the data agreement here; a real class's comes from its
  // school (docs/schools.md#demo-places).
  await client.query(
    `INSERT INTO amp_data_agreements(id,org_id,version,signer_name,signer_title,accepted_at)
     VALUES($1,$2,$3,'AMP','for this demo',$4::date+interval '8 hours')`,
    [randomUUID(), orgId, AGREEMENT_VERSION, year.start],
  );
  // The teachers who are only names.
  const teachers = school ? DEMO_TEACHERS.map(() => randomUUID()) : [];
  for (const [index, id] of teachers.entries()) {
    const [title, family] = DEMO_TEACHERS[index]!.split(" ") as [
      string,
      string,
    ];
    await client.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,family_name,display_name,handle,timezone) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [id, orgId, title, family, `${title} ${family}`, generateHandle(), timezone],
    );
  }
  await client.query(
    `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on)
     SELECT gen_random_uuid(),p,$2,'teacher',$3 FROM unnest($1::uuid[]) AS t(p)`,
    [teachers, orgId, year.start],
  );

  // Classes and their students, in roster order: the hero class first. Each
  // student's term is `terms` at the same place.
  const classes: Planned[] = [];
  const enrollments: [string, string, string, string][] = [];
  const teacherOf = new Map<string, string | null>();
  for (const klass of demoRoster(kind)) {
    const classId = await insertClass(client, {
      orgId,
      sessionId: year.year,
      name: klass.name,
      grade: klass.grade,
    });
    classes.push({
      classId,
      grade: klass.grade,
      people: klass.personas.map((entry) => ({
        personId: randomUUID(),
        learnerId: randomUUID(),
        persona: entry,
        joined:
          entry.joined === undefined
            ? year.start
            : joinedOn(input.day, entry.joined),
      })),
    });
    const teacher = klass.teacher === null ? null : teachers[klass.teacher]!;
    teacherOf.set(classId, teacher);
    if (teacher) enrollments.push([classId, teacher, "teacher", year.start]);
  }
  const heroId = classes[0]!.classId;
  const people = classes.flatMap((klass) =>
    klass.people.map((person) => ({
      ...person,
      classId: klass.classId,
      grade: klass.grade,
    })),
  );
  await client.query(
    `INSERT INTO amp_learners(id,account_id,name,birth_year,created_at)
     SELECT l,'school:'||p,n,y,$5::date FROM unnest($1::text[],$2::uuid[],$3::text[],$4::int[]) AS t(l,p,n,y)`,
    [
      people.map((person) => person.learnerId),
      people.map((person) => person.personId),
      people.map((person) => person.persona.name.join(" ")),
      people.map((person) => birthYearForGrade(person.grade, new Date(noon))),
      year.start,
    ],
  );
  await client.query(
    `INSERT INTO amp_people(id,tenant_id,given_name,family_name,handle,identifier,grade_level,learner_id,timezone,created_at)
     SELECT p,$1,g,f,h,i,gr,l,$2,j::date FROM unnest($3::uuid[],$4::text[],$5::text[],$6::text[],$7::text[],$8::int[],$9::text[],$10::text[]) AS t(p,g,f,h,i,gr,l,j)`,
    [
      orgId,
      timezone,
      people.map((person) => person.personId),
      people.map((person) => person.persona.name[0]),
      people.map((person) => person.persona.name[1]),
      people.map(() => generateHandle()),
      people.map((person) => person.persona.identifier ?? null),
      people.map((person) => person.grade),
      people.map((person) => person.learnerId),
      people.map((person) => person.joined),
    ],
  );
  await client.query(
    `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on)
     SELECT gen_random_uuid(),p,$2,'student',j::date FROM unnest($1::uuid[],$3::text[]) AS t(p,j)`,
    [
      people.map((person) => person.personId),
      orgId,
      people.map((person) => person.joined),
    ],
  );
  for (const person of people)
    enrollments.push([
      person.classId,
      person.personId,
      "student",
      person.joined,
    ]);
  await client.query(
    `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
     SELECT gen_random_uuid(),c,p,r,b::date FROM unnest($1::uuid[],$2::uuid[],$3::text[],$4::text[]) AS t(c,p,r,b)`,
    [0, 1, 2, 3].map((index) => enrollments.map((row) => row[index])),
  );

  // A demo license, every student seated on a `demo` grant.
  const licenseId = randomUUID();
  const seats = school ? Math.ceil((people.length + 20) / 10) * 10 : 30;
  await client.query(
    `INSERT INTO amp_school_licenses(id,org_id,seats,starts_at,ends_at,reference)
     VALUES($1,$2,$3,$4::date,$5::date,'Demo')`,
    [licenseId, orgId, seats, year.start, year.end],
  );
  const seatIds = people.map(() => randomUUID());
  await client.query(
    `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
     SELECT 'demo-seat:'||s,l,'demo',s::text,'active',$3::date,$4::date FROM unnest($1::uuid[],$2::text[]) AS t(s,l)`,
    [seatIds, people.map((person) => person.learnerId), year.start, year.end],
  );
  await client.query(
    `INSERT INTO amp_seats(id,license_id,person_id,grant_id,assigned_at)
     SELECT s,$1,p,'demo-seat:'||s,$4::date FROM unnest($2::uuid[],$3::uuid[]) AS t(s,p)`,
    [licenseId, seatIds, people.map((person) => person.personId), year.start],
  );

  // The hero class as its teacher set it up: the course, a weekly target,
  // standings on and levels shown.
  await client.query(
    `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values") VALUES('class',$1,$2)`,
    [
      heroId,
      {
        levels: "shown",
        standings: "class",
        measure: "growth",
        weeklyTargetMinutes: 60,
      },
    ],
  );
  // Signed in this term, most of the hero class here today; pictures chosen
  // and cards printed, apart from a late joiner and a few still to do it.
  // Every demo student's pictures are fox, boat and kite. Presence moves
  // with the clock (`shared.ts`), so "here today" stays true all day.
  const notYet = new Set(["Zara", "Elias", "Theo", "Tomas"]);
  const pictured = people.filter(
    (person) =>
      !notYet.has(person.persona.name[0]) &&
      hash(`${person.persona.name.join(" ")} pictures`) < 0.9,
  );
  await client.query(
    `INSERT INTO amp_student_sessions(id,token_hash,person_id,mode,expires_at,last_seen_at,created_at)
     SELECT gen_random_uuid(),encode(sha256(convert_to(gen_random_uuid()::text||clock_timestamp()::text,'UTF8')),'hex'),p,'shared',
       now()+interval '12 hours',now()-make_interval(mins=>m),j::date
     FROM unnest($1::uuid[],$2::int[],$3::text[]) AS t(p,m,j)`,
    [
      people.map((person) => person.personId),
      people.map((person, index) => {
        const roll = hash(`${person.persona.name.join(" ")} seen`);
        return person.classId === heroId && index % 7 !== 3
          ? 4 + Math.floor(roll * 50)
          : 1440 + Math.floor(roll * 400);
      }),
      people.map((person) => person.joined),
    ],
  );
  await client.query(
    `INSERT INTO amp_person_credentials(id,person_id,kind,lookup_hash,secret_hash,created_at)
     SELECT gen_random_uuid(),p,'picture',encode(sha256(convert_to(p::text,'UTF8')),'hex'),$2,j::date+interval '9 hours'
     FROM unnest($1::uuid[],$3::text[]) AS t(p,j)`,
    [
      pictured.map((person) => person.personId),
      await hashPictures(["fox", "boat", "kite"]),
      pictured.map((person) => person.joined),
    ],
  );
  const carded = people.filter(
    (person) =>
      person.classId === heroId && person.persona.joined === undefined,
  );
  await client.query(
    `INSERT INTO amp_person_credentials(id,person_id,kind,lookup_hash,expires_at,created_at)
     SELECT gen_random_uuid(),p,'card',encode(sha256(convert_to(gen_random_uuid()::text,'UTF8')),'hex'),
       $2::date+interval '366 days',$2::date+interval '3 days 8 hours'
     FROM unnest($1::uuid[]) AS t(p)`,
    [carded.map((person) => person.personId), year.start],
  );

  // Twelve weeks for every class, from the one dose model. The week
  // triggers wait; each week is summed once below.
  await client.query("SET LOCAL amp.rollup_weeks='deferred'");
  if (terms.length !== people.length)
    throw new Error("The demo's terms are for another roster");
  await writeClassHistory(
    client,
    people.map((person) => person.learnerId),
    terms,
  );
  await sumWeeks(client, "SELECT unnest($1::text[])", [
    people.map((person) => person.learnerId),
  ]);
  await client.query(
    `CREATE TEMP TABLE seed_class(id uuid,org uuid,teacher uuid) ON COMMIT DROP;
     CREATE TEMP TABLE seed_student(person uuid,learner text,class uuid,grade int,ability float8,diligence float8,pace float8,index bigint) ON COMMIT DROP`,
  );
  await client.query(
    `INSERT INTO seed_class SELECT c,$2,t FROM unnest($1::uuid[],$3::uuid[]) AS x(c,t)`,
    [
      classes.map((klass) => klass.classId),
      orgId,
      classes.map((klass) => teacherOf.get(klass.classId) ?? null),
    ],
  );
  await client.query(
    `INSERT INTO seed_student SELECT p,l,c,g,0,1,1,n
     FROM unnest($1::uuid[],$2::text[],$3::uuid[],$4::int[]) WITH ORDINALITY AS t(p,l,c,g,n)`,
    [
      people.map((person) => person.personId),
      people.map((person) => person.learnerId),
      people.map((person) => person.classId),
      people.map((person) => person.grade),
    ],
  );
  if (teachers.length) await seedStaffEvents(client, timezone, input.day);
  await client.query(
    `INSERT INTO amp_school_events(id,org_id,actor_person_id,action,target_kind,target_id,detail,"at")
     SELECT gen_random_uuid(),$1,NULL,'class.created','class',c::text,'{}'::jsonb,$3::date+interval '8 hours'
     FROM unnest($2::uuid[]) AS t(c)`,
    [orgId, classes.map((klass) => klass.classId), year.start],
  );
  return {
    orgId,
    heroClassId: heroId,
    classIds: classes.map((klass) => klass.classId),
  };
}

/** A fixture's own copy of the demo's hero class, alone, with `accountId`
 * its admin and teacher, written now (`scripts/design-personas.ts` makes it
 * a real class). Never served to visitors: they join the shared school. */
export async function buildFixtureClass(
  pool: Pool,
  input: { accountId: string; timezone: string; now?: number },
  learning?: Repository,
) {
  const day = sharedDay(input.now ?? Date.now(), input.timezone);
  const terms = shiftTerms(
    await demoTerms(pool, "class", day.weekday),
    day.shiftDays,
    day.timezone,
  );
  const client = await pool.connect();
  let place: SharedPlace;
  try {
    await client.query("BEGIN");
    place = await buildSharedSchool(
      client,
      { timezone: day.timezone, day: day.day, kind: "class" },
      terms,
    );
    const owner = randomUUID();
    await client.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,handle,account_id,timezone) VALUES($1,$2,$3,$4,$5,$6)`,
      [
        owner,
        place.orgId,
        (await ownerName(client, input.accountId)) ?? "Teacher",
        generateHandle(),
        input.accountId,
        day.timezone,
      ],
    );
    await client.query(
      `WITH year AS (SELECT starts_on FROM amp_academic_sessions WHERE org_id=$2 AND kind='year' LIMIT 1)
       INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on)
       SELECT gen_random_uuid(),$1,$2,r,(SELECT starts_on FROM year) FROM unnest(ARRAY['admin','teacher']) AS t(r)`,
      [owner, place.orgId],
    );
    await client.query(
      `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
       SELECT gen_random_uuid(),$1,$2,'teacher',starts_on FROM amp_academic_sessions WHERE org_id=$3 AND kind='year' LIMIT 1`,
      [place.heroClassId, owner, place.orgId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  if (learning)
    await seedWorkbooks(
      pool,
      learning,
      { classId: place.heroClassId },
      day.timezone,
      day.day,
    );
  return place;
}

/** A printed problem, made once per process: students share a workbook. */
const printedProblems = new Map<string, ReturnType<typeof generateProblem>>();
const printed = (item: {
  templateId: string;
  seed: string;
  templateVersion: number;
}) => {
  const key = `${item.templateId}:${item.seed}:${item.templateVersion}`;
  let found = printedProblems.get(key);
  if (!found) {
    found = generateProblem(item.templateId, item.seed, item.templateVersion);
    if (printedProblems.size > 500) printedProblems.clear();
    printedProblems.set(key, found);
  }
  return found;
};

/** The hero class's workbooks from two school days ago: printed for everyone,
 * most marked, a few still waiting. Composing is a second of CPU on the pod's
 * one workbook worker, so two are composed, for the class's lower and upper
 * levels, and each student gets the one nearest their level; marks go
 * through the real paper-results path, a few students at a time. */
export async function seedWorkbooks(
  pool: Pool,
  learning: Repository,
  place: { classId: string },
  timezone: string,
  today: string,
) {
  const { rows } = await pool.query<{
    id: string;
    learner_id: string;
    given_name: string;
    family_name: string | null;
    level: number | null;
  }>(
    `SELECT p.id,p.learner_id,p.given_name,p.family_name,
       (SELECT d.overall_level FROM amp_level_days d WHERE d.learner_id=p.learner_id ORDER BY d.day DESC LIMIT 1) AS level
     FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
     WHERE e.class_id=$1 AND e.role='student' AND p.learner_id IS NOT NULL ORDER BY 5 NULLS FIRST,p.given_name`,
    [place.classId],
  );
  if (!rows.length) return;
  await workbookWorker()
    .warm()
    .catch(() => undefined);
  let back = 0;
  let date = today;
  for (let found = 0; found < 2;) {
    back++;
    date = new Date(Date.parse(`${today}T12:00:00Z`) - back * DAY)
      .toISOString()
      .slice(0, 10);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) found++;
  }
  // Printed that morning.
  const at = zonedInstant(date, 8, timezone);
  // The static school's workbooks roll as on its anchor day, so every day's
  // are the same (`roster.ts`).
  const day = sharedDay(zonedInstant(today, 12, timezone), timezone);
  const anchorDate = new Date(
    Date.parse(`${date}T12:00:00Z`) - day.shiftDays * DAY,
  )
    .toISOString()
    .slice(0, 10);
  const picks = [
    ...new Set([Math.floor(rows.length * 0.25), Math.floor(rows.length * 0.8)]),
  ].map((index) => rows[index]!);
  const made: { level: number; record: WorkbookRecord }[] = [];
  for (const pick of picks)
    made.push({
      level: pick.level ?? 0,
      record: await learning.transaction(
        schoolAccountId(pick.id),
        pick.learner_id,
        async (tx) =>
          (
            await findOrMakeWorkbook(
              tx,
              pick.learner_id,
              {
                date,
                minutes: 30,
                paper: "letter",
                number: 1,
                seedKey: {
                  learnerKey: `demo:${pick.given_name} ${pick.family_name ?? ""}`,
                  date: anchorDate,
                },
              },
              at,
              { allowed: () => undefined },
            )
          ).record,
      ),
    });
  const nearest = (level: number | null) =>
    made.reduce((best, entry) =>
      Math.abs(entry.level - (level ?? 0)) < Math.abs(best.level - (level ?? 0))
        ? entry
        : best,
    ).record;
  const others = rows.filter((row) => !picks.includes(row));
  const workbookOf = new Map(
    made.map((entry, index) => [picks[index]!.learner_id, entry.record]),
  );
  for (const row of others)
    workbookOf.set(row.learner_id, {
      ...nearest(row.level),
      id: randomUUID(),
    });
  await pool.query(
    `INSERT INTO amp_workbooks(id,learner_id,workbook_date,number,minutes,paper,spec,code,created_at)
     SELECT i::uuid,l,$2::date,1,30,'letter',s::jsonb,c,$3::timestamptz
     FROM unnest($1::text[],$4::text[],$5::text[],$6::text[]) AS t(l,s,c,i)
     ON CONFLICT(learner_id,workbook_date,number,minutes) DO NOTHING`,
    [
      others.map((row) => row.learner_id),
      date,
      new Date(at).toISOString(),
      others.map((row) => JSON.stringify(workbookOf.get(row.learner_id)!.spec)),
      others.map((row) => workbookOf.get(row.learner_id)!.code),
      others.map((row) => workbookOf.get(row.learner_id)!.id),
    ],
  );
  // Their teacher's results, as the paper-results path records them, in one
  // statement: typed answers graded like the app's, so a right one is
  // independent work. A slip lands only on ground they haven't shown on
  // screen, once a skill, so it never reads as stuck; what they keep missing
  // on screen, they miss on paper too. A few are still waiting to be marked.
  const waiting = new Set(["Marcus", "Theo", "Tomas", "Elias", "Zara"]);
  const marked = rows.filter((row) => !waiting.has(row.given_name));
  const shownRows = (
    await pool.query<{ learner_id: string; skill_id: string }>(
      "SELECT learner_id,skill_id FROM amp_skill_evidence WHERE learner_id=ANY($1::text[])",
      [marked.map((row) => row.learner_id)],
    )
  ).rows;
  const settings = defaultPracticeSettings();
  const recordedAt = new Date(Date.parse(`${date}T19:00:00Z`)).toISOString();
  const papers: {
    learner: string;
    id: string;
    content: string;
    outcome: string;
  }[] = [];
  for (const student of marked) {
    const record = workbookOf.get(student.learner_id)!;
    const shown = new Set(
      shownRows
        .filter((row) => row.learner_id === student.learner_id)
        .map((row) => row.skill_id),
    );
    const slipped = new Set<string>();
    const items = record.spec.sections.flatMap((section) =>
      section.items.map((item) => ({ item, section: section.kind })),
    );
    for (const [index, { item }] of items.entries()) {
      const problem = printed(item);
      const slip =
        !shown.has(item.skillId) &&
        !slipped.has(item.skillId) &&
        hash(`${student.given_name}${index}`) > 0.72;
      if (slip) slipped.add(item.skillId);
      const kind = problem.public.response.kind;
      const graded =
        kind === "number" || kind === "fraction" || kind === "choice";
      // A mark counts half, so on a skill they've shown it would follow their
      // screen work weaker; those wait to be marked.
      if (!graded && shown.has(item.skillId)) continue;
      const id = paperProblemId(record.id, index + 1);
      papers.push({
        learner: student.learner_id,
        id,
        content: JSON.stringify({
          ...problem,
          public: { ...problem.public, id },
          practiceEpoch: settings.epoch,
          practiceRevision: settings.revision,
          selection: {
            reason: "paper",
            workbookId: record.id,
            workbookDate: date,
            problemNumber: index + 1,
            enteredBy: "teacher",
          },
        }),
        outcome: JSON.stringify({
          id: randomUUID(),
          problemId: id,
          requestId: id,
          skillId: problem.public.skillId,
          templateId: problem.public.templateId,
          response: graded
            ? slip
              ? wrongResponse(problem as never)
              : problem.answer
            : "",
          correct: !slip,
          assisted: false,
          explanation: problem.explanation,
          answer: problem.answer,
          createdAt: recordedAt,
          evidenceSource: "paper",
          ...(graded ? {} : { evidenceWeight: PAPER_MARK_WEIGHT }),
          ...(problem.variant ? { variant: problem.variant } : {}),
        }),
      });
    }
  }
  await pool.query(
    `INSERT INTO amp_instances(id,learner_id,content,created_at)
     SELECT i,l,c::jsonb,$4::timestamptz FROM unnest($1::text[],$2::text[],$3::text[]) AS t(i,l,c)`,
    [
      papers.map((paper) => paper.id),
      papers.map((paper) => paper.learner),
      papers.map((paper) => paper.content),
      recordedAt,
    ],
  );
  await pool.query(
    `INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome,created_at)
     SELECT o::jsonb->>'id',l,i,i,o::jsonb,$4::timestamptz
     FROM unnest($1::text[],$2::text[],$3::text[]) WITH ORDINALITY AS t(l,i,o,n) ORDER BY n`,
    [
      papers.map((paper) => paper.learner),
      papers.map((paper) => paper.id),
      papers.map((paper) => paper.outcome),
      recordedAt,
    ],
  );
  // Paper marks are answers. A level day the estimator already wrote from
  // the term's answers stays. A row from an older writer, with no reported-sd
  // version, does not.
  await pool.query(
    `DELETE FROM amp_level_days WHERE learner_id=ANY($1::text[])
       AND NOT (frontier ? 'sdVersion')`,
    [rows.map((row) => row.learner_id)],
  );
}
