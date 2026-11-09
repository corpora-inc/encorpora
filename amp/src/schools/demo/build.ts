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
import { findOrMakeWorkbook } from "../../workbook/routes.js";
import { recordPaperResults } from "../../workbook/results.js";
import {
  birthYearForGrade,
  generateHandle,
  generateJoinCode,
} from "../repository.js";
import { schoolAccountId } from "../principal.js";
import { seedClassHistory, type DemoStudent } from "./history.js";
import { namePairs, TEACHER_NAMES } from "./names.js";
import { DAY, GRADE_5_CLASS, hash, persona, type Persona } from "./personas.js";
import {
  seedCalendar,
  seedStaffEvents,
  seedTermEvidence,
  SHORT_LAST_WEEK,
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
  const place = await transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      `school-demo:${input.accountId}:${input.kind}`,
    ]);
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
  // Signed in this term; most of the hero class is here today.
  await client.query(
    `INSERT INTO amp_student_sessions(id,token_hash,person_id,mode,expires_at,last_seen_at,created_at)
     SELECT gen_random_uuid(),encode(sha256(convert_to(gen_random_uuid()::text||clock_timestamp()::text,'UTF8')),'hex'),p,'shared',now()+interval '12 hours',
       CASE WHEN h THEN now()-interval '12 minutes' ELSE now()-interval '1 day' END,j::date
     FROM unnest($1::uuid[],$2::boolean[],$3::text[]) AS t(p,h,j)`,
    [
      people.map((person) => person.personId),
      people.map(
        (person, index) => person.classId === heroId && index % 7 !== 3,
      ),
      people.map((person) => person.joined),
    ],
  );

  // Twelve weeks of practice: the hero class from its personas, with real
  // answers lately; every other class straight to the rollups.
  const hero = classes[0]!;
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
        return roll < 0.06 ? 0 : 0.5 + roll * 0.85;
      }),
    ],
  );
  if (others.length)
    await seedTermEvidence(client, {
      yearStart: year.start,
      skillsPerDay: 2,
      weekShape: SHORT_LAST_WEEK,
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

/** The hero class's workbooks from two school days ago: printed for everyone,
 * most marked, a few still waiting. Through the real workbook path, after the
 * place exists, a few students at a time. */
async function seedWorkbooks(
  pool: Pool,
  learning: Repository,
  place: DemoPlace,
  timezone: string,
  now: number,
) {
  const { rows } = await pool.query(
    `SELECT p.id,p.learner_id,p.given_name FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
     WHERE e.class_id=$1 AND e.role='student' AND p.learner_id IS NOT NULL ORDER BY p.given_name`,
    [place.classId],
  );
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
  const waiting = new Set(["Marcus", "Theo", "Tomas", "Elias", "Zara"]);
  const queue = [...rows];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let row = queue.shift(); row; row = queue.shift()) {
        const student = row;
        await learning.transaction(
          schoolAccountId(student.id),
          student.learner_id,
          async (tx) => {
            const { record } = await findOrMakeWorkbook(
              tx,
              student.learner_id,
              { date, minutes: 30, paper: "letter", number: 1 },
              now - back * DAY,
              { allowed: () => undefined },
            );
            if (waiting.has(student.given_name)) return;
            const items = record.spec.sections.flatMap(
              (section) => section.items,
            );
            await recordPaperResults(
              tx,
              record,
              items.map((_, index) => ({
                n: index + 1,
                mark:
                  hash(`${student.given_name}${index}`) < 0.78
                    ? ("right" as const)
                    : ("not-yet" as const),
              })),
              new Date(Date.parse(`${date}T19:00:00Z`)),
              { by: "teacher" },
            );
          },
        );
      }
    }),
  );
}
