/**
 * Synthetic schools for the school and district verification, written straight
 * to the database: a head's or superintendent's screens need a term of realistic
 * practice, and a district needs 10,000 students, far past what a browser or the
 * API should be asked to make. Every name here is made up.
 */
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { SchoolRepository } from "../src/schools/repository";

const FIRST =
  "Amara Caleb Diego Elias Eli Felix Hana Imani Isaac Jonah Kai Lena Marcus Mei Nadia Noor Owen Priya Ruth Sam Sofia Theo Tomas Zara Ada Bram Cleo Dara Emre Farah Gus Hugo Ines Jada Kofi Lila Milo Nia Omar Pia Quinn Rafi Sana Tess Uma Vik Wren Xan Yara Zeke".split(
    " ",
  );
const LAST =
  "Osei Ortiz Salas Frost Novak Grant Sato Clarke Moreno Reyes Nakamura Fischer Bell Tran Petrov Haddad Hartley Raman Adeyemi Whitlock Marin Lindqvist Vega Mensah Abara Beck Cruz Dahl Eze Flores Gupta Holm Ito Jones Kim Lund Mora Ng Obi Park Quist Rossi Silva Tate Ueda Voss Wolfe Xu Yates Zhou".split(
    " ",
  );
const TEACHERS =
  "Ms. Okafor,Mr. Lindgren,Ms. Tanaka,Mr. Abara,Ms. Rivera,Mr. Dube,Ms. Novak,Mr. Haddad,Ms. Ferreira,Mr. Oyelaran,Ms. Kowalski,Mr. Ito,Ms. Shah,Mr. Moreau,Ms. Bianchi,Mr. Nguyen,Ms. Larsen,Mr. Castillo".split(
    ",",
  );

const DAY = 86_400_000;
export const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
export const mondayOf = (time: number) => {
  const date = new Date(time);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - ((date.getUTCDay() + 6) % 7),
  );
};

export type SeedSchool = {
  name: string;
  grades: readonly number[];
  classesPerGrade: number;
  studentsPerClass: number;
};
const gradeName = (grade: number) =>
  grade === 0 ? "Kindergarten" : `Grade ${grade}`;

/** A year and two semesters that began 13 weeks ago, so a term chart has shape. */
export async function seedCalendar(client: PoolClient, orgId: string) {
  const start = mondayOf(Date.now()) - 12 * 7 * DAY;
  const year = randomUUID();
  const end = start + 300 * DAY;
  const middle = start + 150 * DAY;
  const insert = (
    id: string,
    parent: string | null,
    kind: string,
    name: string,
    from: number,
    to: number,
  ) =>
    client.query(
      `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [id, orgId, parent, kind, name, iso(from), iso(to)],
    );
  const first = new Date(start).getUTCFullYear();
  await insert(
    year,
    null,
    "year",
    `${first}–${String(first + 1).slice(2)}`,
    start,
    end,
  );
  await insert(randomUUID(), year, "semester", "Semester 1", start, middle);
  await insert(randomUUID(), year, "semester", "Semester 2", middle + DAY, end);
  return { year, start: iso(start) };
}

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
      "ALTER TABLE amp_active_days DISABLE TRIGGER amp_active_days_week",
    );
    await client.query(
      "ALTER TABLE amp_skill_days DISABLE TRIGGER amp_skill_days_week",
    );
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
    // A term with a shape: a slow start, a strong middle, a dip for a break.
    await client.query(
      `CREATE TEMP TABLE seed_day ON COMMIT DROP AS
       SELECT d::date AS day,
         ((ARRAY[0.55,0.68,0.8,0.86,0.92,0.82,0.96,1.02,0.58,0.94,1.04,1.08,1.1])[1+floor((d::date-$1::date)/7)::int])::float8 AS factor
       FROM generate_series($1::date,LEAST((now()::date)-0,$1::date+90),interval '1 day') d
       WHERE extract(isodow FROM d)<6`,
      [year.start],
    );
    await client.query(
      `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
       SELECT s.learner,d.day,'practice','skill-'||k,
         floor((7+random()*9)*60000*s.diligence*d.factor)::bigint
       FROM seed_student s CROSS JOIN seed_day d CROSS JOIN generate_series(1,$1::int) k
       WHERE s.diligence>0 AND random()<0.82`,
      [skillsPerDay],
    );
    await client.query(
      `INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent)
       SELECT s.learner,d.day,'skill-'||k,n,floor(n*0.8),floor(n*0.7),floor(n*0.1),floor(n*0.2),floor(n*0.15)
       FROM seed_student s CROSS JOIN seed_day d CROSS JOIN generate_series(1,$1::int) k
       CROSS JOIN LATERAL (SELECT (2+floor(random()*9))::int AS n) a
       WHERE s.diligence>0 AND random()<0.7`,
      [skillsPerDay],
    );
    await client.query(
      `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
       SELECT s.learner,d.day,jsonb_build_object(
           'overall',jsonb_build_object('level',round((s.grade+s.ability+(d.day-$1::date)/90.0*0.45*s.diligence*s.pace)::numeric,2),'sd',0.35,'answered',120,'independent',90),
           'strands',jsonb_build_object(
             'operations',jsonb_build_object('level',s.grade+s.ability,'sd',0.4,'answered',30,'independent',22),
             'fractions',jsonb_build_object('level',s.grade+s.ability-0.2,'sd',0.45,'answered',30,'independent',20),
             'numbers',jsonb_build_object('level',s.grade+s.ability+0.1,'sd',0.4,'answered',30,'independent',24),
             'measurement',jsonb_build_object('level',s.grade+s.ability+0.2,'sd',0.5,'answered',20,'independent',14),
             'algebra',jsonb_build_object('level',s.grade+s.ability-0.1,'sd',0.5,'answered',10,'independent',8))),
         'fixture'
       FROM seed_student s CROSS JOIN seed_day d
       WHERE s.diligence>0 AND extract(isodow FROM d.day) IN (1,3,5)`,
      [year.start],
    );
    await client.query(
      `INSERT INTO amp_learner_weeks(learner_id,week,active_ms,attempts)
       SELECT learner_id,week,sum(active_ms)::bigint,sum(attempts)::int FROM (
         SELECT learner_id,date_trunc('week',day)::date AS week,active_ms,0 AS attempts FROM amp_active_days
           WHERE learner_id IN (SELECT learner FROM seed_student)
         UNION ALL
         SELECT learner_id,date_trunc('week',day)::date,0,attempts FROM amp_skill_days
           WHERE learner_id IN (SELECT learner FROM seed_student)
       ) facts GROUP BY learner_id,week
       ON CONFLICT(learner_id,week) DO UPDATE SET active_ms=EXCLUDED.active_ms,attempts=EXCLUDED.attempts`,
    );
    await client.query(
      "ALTER TABLE amp_active_days ENABLE TRIGGER amp_active_days_week",
    );
    await client.query(
      "ALTER TABLE amp_skill_days ENABLE TRIGGER amp_skill_days_week",
    );
    // A week of what staff really do, for the log.
    await client.query(
      `INSERT INTO amp_school_events(id,org_id,actor_person_id,action,target_kind,target_id,detail,"at")
       SELECT gen_random_uuid(),c.org,c.teacher,e.action,e.kind,
         CASE e.kind WHEN 'person' THEN s.person::text ELSE c.id::text END,
         CASE e.action
           WHEN 'grade.final-set' THEN jsonb_build_object('after',jsonb_build_object('value',(ARRAY['A','A-','B+','B','B-','C+','Pass'])[1+floor(random()*7)::int],'classId',c.id))
           WHEN 'student.updated' THEN jsonb_build_object('after',jsonb_build_object('gradeLevel',s.grade))
           ELSE '{}'::jsonb END,
         ((now() AT TIME ZONE $1)::date-1-(g/6)+interval '8 hours 20 minutes'+(g%6)*interval '71 minutes') AT TIME ZONE $1
       FROM generate_series(1,40) g
       CROSS JOIN LATERAL (SELECT * FROM seed_class c WHERE c.teacher IS NOT NULL ORDER BY c.id OFFSET (g*7)%(SELECT count(*) FROM seed_class WHERE teacher IS NOT NULL) LIMIT 1) c
       CROSS JOIN LATERAL (SELECT * FROM seed_student s WHERE s.class=c.id ORDER BY s.index OFFSET g%5 LIMIT 1) s
       CROSS JOIN LATERAL (SELECT * FROM (VALUES
           ('grade.final-set','person'),('grade.final-set','person'),('student.card-issued','person'),
           ('student.pictures-reset','person'),('class.code-rotated','class'),('student.updated','person')
         ) AS v(action,kind) OFFSET g%6 LIMIT 1) e`,
      [tenant.timezone],
    );
    // Setup happened back when the year began, not this morning.
    await client.query(
      "ALTER TABLE amp_school_events DISABLE TRIGGER amp_school_events_immutable",
    );
    await client.query(
      `UPDATE amp_school_events SET "at"="at"-interval '75 days'
       WHERE action=ANY($1::text[]) AND org_id IN (SELECT id FROM amp_orgs WHERE path[1]=$2)`,
      [
        ["org.created", "agreement.accepted", "license.issued", "staff.added"],
        tenant.id,
      ],
    );
    await client.query(
      "ALTER TABLE amp_school_events ENABLE TRIGGER amp_school_events_immutable",
    );
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
