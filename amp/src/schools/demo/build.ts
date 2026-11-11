/**
 * Demo places (docs/schools.md#demo-places): a class or a whole school, fully
 * alive, for a signed-in account to explore before any agreement or payment.
 * One transaction writes the place, its people and twelve weeks of believable
 * practice; then the hero class gets a stack of real workbooks. Everything in
 * a demo org is synthetic: made-up students, `demo` grants that are never
 * revenue, no mail, and no way to add a real student.
 */
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { Repository } from "../../server/repository.js";
import { generateProblem, templates } from "../../math/engine.js";
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
import { seedClassHistory, type DemoStudent } from "./history.js";
import { namePairs, TEACHER_NAMES } from "./names.js";
import {
  DAY,
  GRADE_5_CLASS,
  hash,
  persona,
  SHARED_GAP,
  STUCK,
  wrongResponse,
  type Persona,
} from "./personas.js";
import {
  seedCalendar,
  seedStaffEvents,
  seedEngineTerm,
  SHORT_LAST_WEEK,
  sumWeeks,
} from "./term.js";

export const demoKinds = ["class", "school"] as const;
export type DemoKind = (typeof demoKinds)[number];
export type DemoPlace = { orgId: string; classId: string; created: boolean };

const SCHOOL_NAME = "Brightwater Elementary";
const HERO = { name: "Grade 5 Math", grade: 5 };
/** The other classes of a demo school: who teaches them is only a name. */
const SCHOOL_CLASSES = [
  { name: "Grade 1 Math", grade: 1, teacher: 0, size: 21 },
  { name: "Grade 2 Math", grade: 2, teacher: 0, size: 23 },
  { name: "Grade 3 Math", grade: 3, teacher: 1, size: 22 },
  { name: "Grade 4 Math", grade: 4, teacher: 1, size: 25 },
  { name: "Grade 6 Math", grade: 6, teacher: 2, size: 24 },
] as const;
/** The demo school's quiet class. */
const QUIET_GRADE = 3;
const DEMO_TEACHERS = [
  TEACHER_NAMES[4]!,
  TEACHER_NAMES[2]!,
  TEACHER_NAMES[10]!,
];

/** The name a demo greets its owner by: the account's own, else none. */
async function ownerName(client: PoolClient, accountId: string) {
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

/** The caller's demo of this kind: the one they have, or a new one. */
export async function createDemo(
  pool: Pool,
  input: { accountId: string; kind: DemoKind; timezone?: string },
  learning?: Repository,
  now = Date.now(),
): Promise<DemoPlace> {
  const timezone = input.timezone ?? "America/New_York";
  // The workbook worker starts while the class is written.
  const warming = learning
    ? workbookWorker()
        .warm()
        .catch(() => undefined)
    : null;
  const place = await transaction(pool, async (client) => {
    // A second request (a double-click) waits for the first to finish,
    // then returns what it made.
    // The school persona replays the estimator over a term of answers. A second
    // click waits for that transaction instead of starting another.
    await client.query("SET LOCAL lock_timeout='120s'");
    await client.query("SET LOCAL statement_timeout='120s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `school-demo:${input.accountId}:${input.kind}`,
    ]);
    await client.query("SET LOCAL lock_timeout='5s'");
    const existing = (
      await client.query(
        `UPDATE amp_orgs SET demo_seen_at=now() WHERE demo AND created_by=$1 AND demo_kind=$2
         RETURNING id,(SELECT e.class_id FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
           JOIN amp_people p ON p.id=e.person_id
           WHERE c.org_id=amp_orgs.id AND e.role='teacher' AND p.account_id=$1 ORDER BY c.created_at LIMIT 1) AS class_id`,
        [input.accountId, input.kind],
      )
    ).rows[0];
    if (existing)
      return { orgId: existing.id, classId: existing.class_id, created: false };
    return build(client, { ...input, timezone }, now);
  });
  await warming;
  if (place.created && learning)
    await seedWorkbooks(pool, learning, place, timezone, now).catch((error) =>
      // The class stands without them; the stack is one tap to make.
      console.error(JSON.stringify({ demoWorkbooks: String(error) })),
    );
  return place;
}

async function transaction<T>(
  pool: Pool,
  run: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function build(
  client: PoolClient,
  input: { accountId: string; kind: DemoKind; timezone: string },
  now: number,
): Promise<DemoPlace> {
  const school = input.kind === "school";
  const orgId = randomUUID();
  await client.query(
    `INSERT INTO amp_orgs(id,kind,path,name,timezone,solo,setup_pending,created_by,demo,demo_kind,demo_seen_at,created_at)
     VALUES($1,'school',ARRAY[$1]::uuid[],$2,$3,$4,false,$5,true,$6,now(),now()-interval '84 days')`,
    [
      orgId,
      school ? SCHOOL_NAME : HERO.name,
      input.timezone,
      !school,
      input.accountId,
      input.kind,
    ],
  );
  const year = await seedCalendar(client, orgId, now);
  // Its students are made up, and nothing can add a real one, so AMP itself
  // stands behind the data agreement here; a real class's comes from its
  // school (docs/schools.md#demo-places).
  await client.query(
    `INSERT INTO amp_data_agreements(id,org_id,version,signer_name,signer_title,accepted_at)
     VALUES($1,$2,$3,'AMP','for this demo',$4::date+interval '8 hours')`,
    [randomUUID(), orgId, AGREEMENT_VERSION, year.start],
  );
  const clock = (
    await client.query(
      "SELECT ((now() AT TIME ZONE $1)::date)::text AS day,extract(hour FROM now() AT TIME ZONE $1)::int AS hour",
      [input.timezone],
    )
  ).rows[0] as { day: string; hour: number };
  const today = clock.day;

  // The owner, and the teachers who are only names.
  const owner = randomUUID();
  await client.query(
    `INSERT INTO amp_people(id,tenant_id,given_name,handle,account_id,timezone) VALUES($1,$2,$3,$4,$5,$6)`,
    [
      owner,
      orgId,
      (await ownerName(client, input.accountId)) ?? "Teacher",
      generateHandle(),
      input.accountId,
      input.timezone,
    ],
  );
  const teachers = school ? DEMO_TEACHERS.map(() => randomUUID()) : [];
  for (const [index, id] of teachers.entries()) {
    const [title, family] = DEMO_TEACHERS[index]!.split(" ") as [
      string,
      string,
    ];
    await client.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,family_name,display_name,handle,timezone) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        orgId,
        title,
        family,
        `${title} ${family}`,
        generateHandle(),
        input.timezone,
      ],
    );
  }
  await client.query(
    `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on)
     SELECT gen_random_uuid(),p,$2,r,$3 FROM unnest($1::uuid[],$4::text[]) AS t(p,r)`,
    [
      [owner, owner, ...teachers],
      orgId,
      year.start,
      ["admin", "teacher", ...teachers.map(() => "teacher")],
    ],
  );

  // Classes and their students: the hero class is the owner's.
  const heroId = await insertClass(client, {
    orgId,
    sessionId: year.year,
    ...HERO,
  });
  const classes: Planned[] = [];
  const plan = (
    classId: string,
    grade: number,
    personas: readonly Persona[],
  ): Planned => ({
    classId,
    grade,
    people: personas.map((entry) => ({
      personId: randomUUID(),
      learnerId: randomUUID(),
      persona: entry,
      joined:
        entry.joined === undefined
          ? year.start
          : new Date(Date.parse(`${today}T12:00:00Z`) - entry.joined * DAY)
              .toISOString()
              .slice(0, 10),
    })),
  });
  classes.push(plan(heroId, HERO.grade, GRADE_5_CLASS));
  const enrollments: [string, string, string, string][] = [
    [heroId, owner, "teacher", year.start],
  ];
  if (school) {
    const taken = new Set(GRADE_5_CLASS.map((entry) => entry.name.join(" ")));
    let offset = 3;
    for (const klass of SCHOOL_CLASSES) {
      const classId = await insertClass(client, {
        orgId,
        sessionId: year.year,
        ...klass,
      });
      const names = namePairs(klass.size, offset, taken);
      offset += klass.size * 5;
      for (const name of names) taken.add(name.join(" "));
      classes.push(
        plan(
          classId,
          klass.grade,
          names.map(([given, family], index) =>
            persona(
              given,
              family,
              klass.grade + (hash(`${given}${family}`) - 0.55) * 1.8,
              {
                identifier: `S-${20410 + offset + index}`,
              },
            ),
          ),
        ),
      );
      enrollments.push([
        classId,
        teachers[klass.teacher]!,
        "teacher",
        year.start,
      ]);
    }
  }
  const people = classes.flatMap((klass) =>
    klass.people.map((person) => ({
      ...person,
      classId: klass.classId,
      grade: klass.grade,
    })),
  );
  const date = new Date(now);
  await client.query(
    `INSERT INTO amp_learners(id,account_id,name,birth_year,created_at)
     SELECT l,'school:'||p,n,y,$5::date FROM unnest($1::text[],$2::uuid[],$3::text[],$4::int[]) AS t(l,p,n,y)`,
    [
      people.map((person) => person.learnerId),
      people.map((person) => person.personId),
      people.map((person) => person.persona.name.join(" ")),
      people.map((person) => birthYearForGrade(person.grade, date)),
      year.start,
    ],
  );
  await client.query(
    `INSERT INTO amp_people(id,tenant_id,given_name,family_name,handle,identifier,grade_level,learner_id,timezone,created_at)
     SELECT p,$1,g,f,h,i,gr,l,$2,j::date FROM unnest($3::uuid[],$4::text[],$5::text[],$6::text[],$7::text[],$8::int[],$9::text[],$10::text[]) AS t(p,g,f,h,i,gr,l,j)`,
    [
      orgId,
      input.timezone,
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
  // Every demo student's pictures are fox, boat and kite.
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

  // Twelve weeks of practice: the hero class from its personas, with real
  // answers lately; every other class straight to the rollups.
  const hero = classes[0]!;
  // The week triggers wait; each week is summed once below.
  await client.query("SET LOCAL amp.rollup_weeks='deferred'");
  await seedClassHistory(client, {
    students: hero.people.map((person): DemoStudent => ({
      personId: person.personId,
      learnerId: person.learnerId,
      persona: person.persona,
    })),
    timezone: input.timezone,
    termStart: year.start,
    today,
    gradeLevel: hero.grade,
    weekShape: SHORT_LAST_WEEK,
    now,
    workToday: clock.hour >= 9,
  });
  await sumWeeks(client, "SELECT unnest($1::text[])", [
    hero.people.map((person) => person.learnerId),
  ]);
  await client.query(
    `CREATE TEMP TABLE seed_class(id uuid,org uuid,teacher uuid) ON COMMIT DROP;
     CREATE TEMP TABLE seed_student(person uuid,learner text,class uuid,grade int,ability float8,diligence float8,pace float8,index bigint) ON COMMIT DROP`,
  );
  await client.query(
    `INSERT INTO seed_class SELECT c,$2,t FROM unnest($1::uuid[],$3::uuid[]) AS x(c,t)`,
    [
      enrollments.filter((row) => row[2] === "teacher").map((row) => row[0]),
      orgId,
      enrollments.filter((row) => row[2] === "teacher").map((row) => row[1]),
    ],
  );
  const others = people.filter((person) => person.classId !== heroId);
  await client.query(
    `INSERT INTO seed_student SELECT p,l,c,g,a,d,0.4+d*0.5,n
     FROM unnest($1::uuid[],$2::text[],$3::uuid[],$4::int[],$5::float8[],$6::float8[]) WITH ORDINALITY AS t(p,l,c,g,a,d,n)`,
    [
      others.map((person) => person.personId),
      others.map((person) => person.learnerId),
      others.map((person) => person.classId),
      others.map((person) => person.grade),
      others.map((person) => person.persona.ability - person.grade),
      others.map((person) => {
        const roll = hash(`${person.persona.name.join(" ")} drive`);
        // One class barely practices, so the overview has something to say.
        if (person.grade === QUIET_GRADE) return roll * 0.08;
        return roll < 0.06 ? 0 : 0.5 + roll * 0.85;
      }),
    ],
  );
  if (others.length)
    await seedEngineTerm(client, {
      yearStart: year.start,
      skillsPerDay: 2,
      weekShape: SHORT_LAST_WEEK,
      now,
    });
  // The hero class's students join the event log's sample too.
  await client.query(
    `INSERT INTO seed_student SELECT p,l,$3::uuid,$4,0,1,1,n FROM unnest($1::uuid[],$2::text[]) WITH ORDINALITY AS t(p,l,n)`,
    [
      hero.people.map((person) => person.personId),
      hero.people.map((person) => person.learnerId),
      heroId,
      hero.grade,
    ],
  );
  await seedStaffEvents(client, input.timezone);
  await client.query(
    `INSERT INTO amp_school_events(id,org_id,actor_person_id,action,target_kind,target_id,detail,"at")
     SELECT gen_random_uuid(),$1,$2,'class.created','class',c::text,'{}'::jsonb,$4::date+interval '8 hours'
     FROM unnest($3::uuid[]) AS t(c)`,
    [orgId, owner, classes.map((klass) => klass.classId), year.start],
  );
  return { orgId, classId: heroId, created: true };
}

/** The skills a demo student keeps missing (`SHARED_GAP`, `STUCK`). */
const skillOfTemplate = new Map(
  templates.map((template) => [template.id, template.skillId]),
);
function missedSkills(given: string): Set<string> {
  return new Set(
    [
      SHARED_GAP.people.includes(given) ? SHARED_GAP.template : null,
      STUCK.person === given ? STUCK.template : null,
    ].flatMap((template) =>
      template ? [skillOfTemplate.get(template) ?? ""] : [],
    ),
  );
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
async function seedWorkbooks(
  pool: Pool,
  learning: Repository,
  place: DemoPlace,
  timezone: string,
  now: number,
) {
  const { rows } = await pool.query<{
    id: string;
    learner_id: string;
    given_name: string;
    level: number | null;
  }>(
    `SELECT p.id,p.learner_id,p.given_name,
       (SELECT d.overall_level FROM amp_level_days d WHERE d.learner_id=p.learner_id ORDER BY d.day DESC LIMIT 1) AS level
     FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
     WHERE e.class_id=$1 AND e.role='student' AND p.learner_id IS NOT NULL ORDER BY 4 NULLS FIRST,p.given_name`,
    [place.classId],
  );
  if (!rows.length) return;
  const today: string = (
    await pool.query("SELECT ((now() AT TIME ZONE $1)::date)::text AS day", [
      timezone,
    ])
  ).rows[0].day;
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
  const at = now - back * DAY;
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
              { date, minutes: 30, paper: "letter", number: 1 },
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
    const missing = missedSkills(student.given_name);
    const slipped = new Set<string>();
    const items = record.spec.sections.flatMap((section) =>
      section.items.map((item) => ({ item, section: section.kind })),
    );
    for (const [index, { item }] of items.entries()) {
      const problem = printed(item);
      const slip =
        missing.has(item.skillId) ||
        (!shown.has(item.skillId) &&
          !slipped.has(item.skillId) &&
          hash(`${student.given_name}${index}`) > 0.72);
      if (slip) slipped.add(item.skillId);
      const kind = problem.public.response.kind;
      const graded =
        kind === "number" || kind === "fraction" || kind === "choice";
      // A mark counts half, so on a skill they've shown it would follow their
      // screen work weaker; those wait to be marked.
      if (!graded && shown.has(item.skillId) && !missing.has(item.skillId))
        continue;
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
