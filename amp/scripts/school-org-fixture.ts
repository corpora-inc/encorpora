/**
 * Synthetic schools for the school and district verification, written straight
 * to the database: a head's or superintendent's screens need a term of realistic
 * practice, and a district needs 10,000 students, far past what a browser or the
 * API should be asked to make. Every name here is made up.
 */
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  FAMILY_NAMES,
  GIVEN_NAMES,
  TEACHER_NAMES,
} from "../src/schools/demo/names";
import {
  seedStaffEvents,
  seedTermEvidence as seedTerm,
} from "../src/schools/demo/term";
import type { SchoolRepository } from "../src/schools/repository";

const FIRST = GIVEN_NAMES.slice(0, 50);
const LAST = FAMILY_NAMES.slice(0, 50);
const TEACHERS = TEACHER_NAMES;

export {
  iso,
  mondayOf,
  seedCalendar,
  TERM_SHAPE,
} from "../src/schools/demo/term";

export type SeedSchool = {
  name: string;
  grades: readonly number[];
  classesPerGrade: number;
  studentsPerClass: number;
};
const gradeName = (grade: number) =>
  grade === 0 ? "Kindergarten" : `Grade ${grade}`;

/** Classes, teachers, students, seats, sign-ins and a term of evidence for each
 * school. `seatShare` of the students hold seats, and `signedInShare` have signed
 * in. One class in `quietEvery` hardly practices, and one in `untaughtEvery` has
 * no teacher, so the attention list has something real to say. */
export async function seedSchools(
  repo: SchoolRepository,
  tenant: { id: string; timezone: string },
  year: { year: string; start: string },
  schools: readonly (SeedSchool & { id: string })[],
  options: {
    seatShare?: number;
    signedInShare?: number;
    quietEvery?: number;
    untaughtEvery?: number;
    licenseId?: string;
    /** Skills practiced in a day: more is a heavier dataset. */
    skillsPerDay?: number;
    emailDomain?: string;
  } = {},
) {
  const {
    seatShare = 0.985,
    signedInShare = 0.96,
    quietEvery = 0,
    untaughtEvery = 0,
    skillsPerDay = 3,
  } = options;
  const client = await repo.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT setseed(0.42)");
    await client.query(
      `CREATE TEMP TABLE seed_class(id uuid,org uuid,grade int,quiet boolean,teacher uuid,drive float8,pace float8,lift float8) ON COMMIT DROP`,
    );
    /* No two classes or schools quite alike, the same on every run. */
    const roll = (seed: number) =>
      ((seed * 2654435761) % 4294967296) / 4294967296;
    let schoolIndex = 0;
    let classIndex = 0;
    let teacherIndex = 0;
    for (const school of schools) {
      schoolIndex++;
      const lift = (roll(schoolIndex + 3) - 0.55) * 0.9;
      const schoolDrive = 0.72 + roll(schoolIndex + 40) * 0.5;
      for (const grade of school.grades)
        for (let section = 0; section < school.classesPerGrade; section++) {
          classIndex++;
          const id = randomUUID();
          const taught = !untaughtEvery || classIndex % untaughtEvery !== 0;
          const quiet = !!quietEvery && classIndex % quietEvery === 0;
          const letter =
            school.classesPerGrade > 1
              ? ` ${String.fromCharCode(65 + section)}`
              : "";
          await client.query(
            `INSERT INTO amp_classes(id,org_id,session_id,name,course_bands,grading_kind,join_code)
             VALUES($1,$2,$3,$4,$5,'semester',$6)`,
            [
              id,
              school.id,
              year.year,
              `${gradeName(grade)} Math${letter}`,
              grade <= 8 ? [grade === 0 ? "K" : String(grade)] : [],
              randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase(),
            ],
          );
          let teacher: string | null = null;
          if (taught) {
            teacher = randomUUID();
            const [title, family] =
              TEACHERS[teacherIndex++ % TEACHERS.length]!.split(" ");
            await client.query(
              `INSERT INTO amp_people(id,tenant_id,given_name,family_name,display_name,handle,timezone)
               VALUES($1,$2,$3,$4,$5,'SteadyOwl1000',$6)`,
              [
                teacher,
                tenant.id,
                title,
                family,
                `${title} ${family}`,
                tenant.timezone,
              ],
            );
            await client.query(
              `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on) VALUES($1,$2,$3,'teacher',$4)`,
              [randomUUID(), teacher, school.id, year.start],
            );
            await client.query(
              `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on) VALUES($1,$2,$3,'teacher',$4)`,
              [randomUUID(), id, teacher, year.start],
            );
          }
          await client.query(
            `INSERT INTO seed_class VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              id,
              school.id,
              grade,
              quiet,
              teacher,
              schoolDrive * (0.72 + roll(classIndex + 11) * 0.52),
              0.25 + roll(classIndex + 77) * 1.3,
              lift,
            ],
          );
        }
    }
    const perClass = new Map(
      schools.map((school) => [school.id, school.studentsPerClass]),
    );
    await client.query(
      `CREATE TEMP TABLE seed_student ON COMMIT DROP AS
       SELECT gen_random_uuid() AS person,'seed-'||gen_random_uuid()::text AS learner,c.id AS class,c.org,c.grade,c.quiet,
         row_number() OVER () AS index,
         (random()+random()+random()+random()-2)*1.2+c.lift AS ability,
         CASE WHEN c.quiet THEN random()*0.08 WHEN random()<0.05+(1.1-c.drive)*0.22 THEN 0 ELSE (0.45+random()*0.95)*c.drive END AS diligence,
         c.pace,random() AS seat_roll,random() AS signin_roll,random() AS email_roll
       FROM seed_class c CROSS JOIN LATERAL generate_series(1,($1::jsonb->>c.org::text)::int)`,
      [JSON.stringify(Object.fromEntries(perClass))],
    );
    await client.query(
      `INSERT INTO amp_learners(id,account_id,name,birth_year)
       SELECT learner,'school:'||person,'Seed student',2014 FROM seed_student`,
    );
    await client.query(
      `INSERT INTO amp_people(id,tenant_id,given_name,family_name,handle,email,grade_level,learner_id,timezone)
       SELECT person,$1,
         ($2::text[])[1+(index%array_length($2::text[],1))],
         ($3::text[])[1+((index/50+index*7)%array_length($3::text[],1))],
         'SteadyOwl1000',
         CASE WHEN email_roll<0.92 THEN 'student'||index||'@'||$5 END,
         grade,learner,$4 FROM seed_student`,
      [
        tenant.id,
        FIRST,
        LAST,
        tenant.timezone,
        options.emailDomain ?? "school.example",
      ],
    );
    await client.query(
      `INSERT INTO amp_org_roles(id,person_id,org_id,role,begin_on)
       SELECT gen_random_uuid(),person,org,'student',$1 FROM seed_student`,
      [year.start],
    );
    await client.query(
      `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
       SELECT gen_random_uuid(),class,person,'student',$1 FROM seed_student`,
      [year.start],
    );
    if (options.licenseId) {
      await client.query(
        `CREATE TEMP TABLE seed_seat ON COMMIT DROP AS
         SELECT gen_random_uuid() AS seat,person,learner FROM seed_student WHERE seat_roll<$1`,
        [seatShare],
      );
      await client.query(
        `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
         SELECT 'school-seat:'||seat,learner,'pilot',seat::text,'active',now(),now()+interval '300 days' FROM seed_seat`,
      );
      await client.query(
        `INSERT INTO amp_seats(id,license_id,person_id,grant_id)
         SELECT seat,$1,person,'school-seat:'||seat FROM seed_seat`,
        [options.licenseId],
      );
    }
    await client.query(
      `INSERT INTO amp_student_sessions(id,token_hash,person_id,mode,expires_at,last_seen_at)
       SELECT gen_random_uuid(),md5(person::text),person,'shared',now()+interval '12 hours',now()-interval '1 day'
       FROM seed_student WHERE signin_roll<$1`,
      [signedInShare],
    );
    await seedTermEvidence(client, {
      timezone: tenant.timezone,
      tenantId: tenant.id,
      yearStart: year.start,
      skillsPerDay,
    });
    const counts = (
      await client.query(
        `SELECT (SELECT count(*)::int FROM seed_student) AS students,(SELECT count(*)::int FROM seed_class) AS classes`,
      )
    ).rows[0] as { students: number; classes: number };
    await client.query("COMMIT");
    // What autovacuum would have done by the time anyone reads a term of this.
    for (const table of [
      "amp_learner_weeks",
      "amp_level_days",
      "amp_people",
      "amp_org_roles",
      "amp_enrollments",
      "amp_seats",
      "amp_student_sessions",
    ])
      await client.query(`VACUUM ANALYZE ${table}`);
    return counts;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** A term of practice for the `seed_student` and `seed_class` temp tables,
 * inside the caller's open transaction: the product's `seedTermEvidence`, with
 * the rollups' week triggers off while it writes (it sums the weeks once, which
 * a district's 10,000 students need), then a week of staff activity, and setup
 * dated back to when the year began. Fixture databases only. */
export async function seedTermEvidence(
  client: PoolClient,
  options: {
    timezone: string;
    tenantId: string;
    yearStart: string;
    skillsPerDay: number;
    /** Activity by week from the term's start; the last entry repeats. */
    weekShape?: readonly number[];
  },
) {
  await client.query(
    "ALTER TABLE amp_active_days DISABLE TRIGGER amp_active_days_week",
  );
  await client.query(
    "ALTER TABLE amp_skill_days DISABLE TRIGGER amp_skill_days_week",
  );
  await seedTerm(client, options);
  await client.query(
    "ALTER TABLE amp_active_days ENABLE TRIGGER amp_active_days_week",
  );
  await client.query(
    "ALTER TABLE amp_skill_days ENABLE TRIGGER amp_skill_days_week",
  );
  await seedStaffEvents(client, options.timezone);
  // Setup happened back when the year began, not this morning.
  await client.query(
    "ALTER TABLE amp_school_events DISABLE TRIGGER amp_school_events_immutable",
  );
  await client.query(
    `UPDATE amp_school_events SET "at"="at"-interval '75 days'
       WHERE action=ANY($1::text[]) AND org_id IN (SELECT id FROM amp_orgs WHERE path[1]=$2)`,
    [
      ["org.created", "agreement.accepted", "license.issued", "staff.added"],
      options.tenantId,
    ],
  );
  await client.query(
    "ALTER TABLE amp_school_events ENABLE TRIGGER amp_school_events_immutable",
  );
}
