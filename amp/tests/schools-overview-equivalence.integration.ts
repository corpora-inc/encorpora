import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { seedCalendar, seedSchools } from "../scripts/school-org-fixture.js";
import { SETTLED_SD } from "../src/schools/growth.js";
import {
  classMembers,
  orgScope,
  readOverview,
  SQL_ACTIVE_STUDENTS,
  studentFacts,
  termInUse,
  type StudentFact,
  type Term,
} from "../src/schools/org-reads.js";
import {
  medianOf,
  practiced,
  practicedSql,
} from "../src/schools/practice-rules.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { startLevelSql } from "../src/schools/start-level.js";
import { drawsFor } from "../src/schools/standing-math.js";
import { weekStart } from "../src/schools/today.js";
import { PLACEMENT_ATTEMPTS } from "../src/learning/placement.js";
import { referenceMedianInterval } from "./helpers/median-interval-reference.js";

const DAY = 86_400_000;
const iso = (offset: number) =>
  new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);

/* The Overview's reads as they were before (#2195 on main): one query for
   every student's facts, the trend by an array of the learners it returned,
   and each group's growth interval drawn afresh. The new reads must give the
   same numbers, bit for bit. */
const scanGrowthSql = (learner: string, from: string, to: string) =>
  `(SELECT CASE WHEN n < 2 OR sxx <= 0 OR elapsed <= 0 THEN NULL
       ELSE ARRAY[(sxy / sxx) * elapsed, elapsed / sqrt(sxx)] END
     FROM (
       SELECT n, elapsed, swxx - swx * swx / sw AS sxx, swxy - swx * swy / sw AS sxy
       FROM (
         SELECT count(*)::int AS n, (${to}::date - ${from}::date)::float8 AS elapsed,
                sum(w) AS sw, sum(w * x) AS swx, sum(w * y) AS swy,
                sum(w * x * x) AS swxx, sum(w * x * y) AS swxy
         FROM (
           SELECT (d.day - ${from}::date)::float8 AS x, d.overall_level::float8 AS y,
                  1.0 / power(d.overall_sd, 2) AS w
           FROM amp_level_days d
           WHERE d.learner_id=${learner} AND d.day >= ${from}::date AND d.day <= ${to}::date
             AND d.overall_sd > 0 AND d.overall_sd <= ${SETTLED_SD}
         ) points
       ) sums
       WHERE sw > 0
     ) fit)`;
async function oneQueryFacts(
  db: Pool,
  orgId: string,
  term: Term,
  today: string,
): Promise<StudentFact[]> {
  const thisWeek = weekStart(today);
  const through = term.endsOn < today ? term.endsOn : today;
  const from = "GREATEST($2::date, r.begin_on)";
  const { rows } = await db.query(
    `WITH roster AS MATERIALIZED (${SQL_ACTIVE_STUDENTS})
     SELECT r.id,r.learner_id AS learner,r.org_id AS org,r.grade_level AS grade,
       COALESCE(w."thisMs",0)::float8 AS "thisMs",COALESCE(w."lastMs",0)::float8 AS "lastMs",
       COALESCE(w."thisAttempts",0)::int AS "thisAttempts",COALESCE(w."lastAttempts",0)::int AS "lastAttempts",
       latest.overall_level::float8 AS level,first.overall_level::float8 AS "startLevel",
       latest.sd AS "levelSd",first.sd AS "startSd",
       growth.mu AS "growthMu",growth.sd AS "growthSd",
       r.begin_on::text AS since,seat.person_id IS NOT NULL AS seated,
       session.id IS NOT NULL AS "signedIn"
     FROM roster r
     LEFT JOIN LATERAL (
       SELECT sum(w.active_ms) FILTER (WHERE w.week=$3::date) AS "thisMs",
         sum(w.active_ms) FILTER (WHERE w.week=$4::date) AS "lastMs",
         sum(w.attempts) FILTER (WHERE w.week=$3::date) AS "thisAttempts",
         sum(w.attempts) FILTER (WHERE w.week=$4::date) AS "lastAttempts"
       FROM amp_learner_weeks w
       WHERE w.learner_id=r.learner_id AND w.week=ANY(ARRAY[$3::date,$4::date])
     ) w ON true
     LEFT JOIN LATERAL (
       SELECT d.overall_level,d.overall_sd AS sd FROM amp_level_days d
       WHERE d.learner_id=r.learner_id AND d.overall_answered>=${PLACEMENT_ATTEMPTS}
       ORDER BY d.day DESC LIMIT 1
     ) latest ON true
     LEFT JOIN LATERAL (
       SELECT ${startLevelSql({ select: "d.overall_level", learner: "r.learner_id", from, to: "$5::date" })} AS overall_level,
         ${startLevelSql({ select: "d.overall_sd", learner: "r.learner_id", from, to: "$5::date" })} AS sd
     ) first ON true
     LEFT JOIN LATERAL (
       SELECT raw.pair[1] AS mu, raw.pair[2] AS sd FROM (
         SELECT ${scanGrowthSql("r.learner_id", from, "$5::date")} AS pair OFFSET 0
       ) raw
     ) growth ON true
     LEFT JOIN (
       SELECT s.person_id FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
       WHERE s.released_at IS NULL AND l.status='active' AND l.starts_at<=now() AND l.ends_at>now()
     ) seat ON seat.person_id=r.id
     LEFT JOIN LATERAL (
       SELECT n.id FROM amp_student_sessions n WHERE n.person_id=r.id LIMIT 1
     ) session ON true`,
    [
      orgId,
      term.startsOn,
      thisWeek,
      new Date(Date.parse(`${thisWeek}T00:00:00Z`) - 7 * DAY)
        .toISOString()
        .slice(0, 10),
      through,
    ],
  );
  return rows.map((row) => ({
    ...row,
    growthMu: row.growthMu === null ? null : Number(row.growthMu),
    growthSd: row.growthSd === null ? null : Number(row.growthSd),
  }));
}
async function arrayTrend(
  db: Pool,
  students: readonly StudentFact[],
  term: Term,
) {
  const first = weekStart(term.startsOn);
  const last = weekStart(term.endsOn);
  const { rows } = await db.query(
    `SELECT week::text AS week,round(sum(active_ms)/60000.0)::int AS minutes,
       count(*) FILTER (WHERE ${practicedSql("active_ms", "attempts")})::int AS students,
       sum(attempts)::int AS problems,sum(assisted)::int AS assisted
     FROM amp_learner_weeks
     WHERE learner_id=ANY($1::text[]) AND week BETWEEN $2::date AND $3::date
     GROUP BY week`,
    [students.map((student) => student.learner), first, last],
  );
  const byWeek = new Map(rows.map((row) => [row.week as string, row]));
  const weeks = [];
  for (
    let week = first;
    week <= last;
    week = new Date(Date.parse(`${week}T00:00:00Z`) + 7 * DAY)
      .toISOString()
      .slice(0, 10)
  )
    weeks.push({
      week,
      minutes: byWeek.get(week)?.minutes ?? 0,
      students: byWeek.get(week)?.students ?? 0,
      problems: byWeek.get(week)?.problems ?? 0,
      assisted: byWeek.get(week)?.assisted ?? 0,
    });
  return weeks;
}
/** `usageOf` as it was, with each interval drawn afresh. */
function freshUsage(students: readonly StudentFact[], interval: boolean) {
  let active = 0;
  let minutes = 0;
  const gains: { mu: number; sd: number }[] = [];
  for (const student of students) {
    if (practiced(student.thisMs / 60_000, student.thisAttempts)) active++;
    minutes += student.thisMs / 60_000;
    if (student.growthMu !== null && student.growthSd !== null)
      gains.push({ mu: student.growthMu, sd: student.growthSd });
  }
  const growth = medianOf(gains.map((gain) => gain.mu));
  const band = interval
    ? referenceMedianInterval(gains, { mode: "bootstrap" })
    : null;
  const hundredth = (value: number) => Math.round(value * 100) / 100;
  return {
    students: students.length,
    active,
    minutes: Math.round(minutes),
    growth: growth === null ? null : hundredth(growth),
    growthLow: band ? hundredth(band.low) : null,
    growthHigh: band ? hundredth(band.high) : null,
    placed: gains.length,
  };
}

test(
  "A district's and a school's Overview give the numbers the one-query read gave, bit for bit",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_overview_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 8 });
    const schools = new SchoolRepository(db);
    try {
      // The verification district's shape (scripts/verify-school-org-ui.ts),
      // smaller: four schools, big enough that a school's interval reads the
      // kept bootstrap stream, and a term of practice from the same generator.
      const district = await schools.createOrg(
        {
          kind: "district",
          name: "Fixture District",
          timezone: "America/Chicago",
        },
        {
          version: "fixture-1",
          signerName: "Fixture Signer",
          signerTitle: "Superintendent",
        },
      );
      const license = await schools.issueLicense({
        orgId: district.id,
        seats: 1500,
        endsAt: new Date(Date.now() + 300 * DAY).toISOString(),
      });
      const client = await db.connect();
      const year = await seedCalendar(client, district.id).finally(() =>
        client.release(),
      );
      const made = [];
      for (const [name, grades, perClass] of [
        ["Aspen Elementary", [1, 2, 3, 4], 26],
        ["Birch Elementary", [3, 4, 5], 24],
        ["Cedar Middle School", [6, 7, 8], 30],
        ["Dogwood High School", [9, 10], 28],
      ] as const) {
        const school = await schools.createOrg({
          kind: "school",
          name,
          parentId: district.id,
        });
        made.push({
          id: school.id,
          name,
          grades: [...grades],
          classesPerGrade: 3,
          studentsPerClass: perClass,
        });
      }
      await seedSchools(
        schools,
        { id: district.id, timezone: "America/Chicago" },
        year,
        made,
        {
          licenseId: license.licenseId,
          seatShare: 0.97,
          signedInShare: 0.95,
          quietEvery: 5,
          untaughtEvery: 7,
          emailDomain: "fixture.example",
        },
      );
      // Some students joined mid-term, so their window starts later.
      await db.query(
        `UPDATE amp_org_roles SET begin_on=$1::date WHERE role='student' AND person_id IN (
           SELECT id FROM amp_people WHERE learner_id IS NOT NULL ORDER BY id LIMIT 80)`,
        [iso(-30)],
      );

      const org = await orgScope(db, district.id);
      const term = await termInUse(db, org);
      const facts = await studentFacts(db, district.id, term, org.today);
      const before = await oneQueryFacts(db, district.id, term, org.today);
      const byId = (rows: readonly StudentFact[]) =>
        [...rows].sort((a, b) => a.id.localeCompare(b.id));
      assert.deepEqual(byId(facts), byId(before));
      assert.ok(facts.length > 900, `${facts.length} students`);
      const fitted = facts.filter((row) => row.growthMu !== null).length;
      assert.ok(fitted > facts.length / 2, `${fitted} with growth`);
      assert.ok(
        facts.some(
          (row) => row.growthMu === 0 || Math.abs(row.growthMu ?? 1) < 1e-9,
        ),
      );

      // The district Overview: each school's row, the week, the trend.
      const overview = await readOverview(db, district.id, null, true);
      for (const school of overview.schools!) {
        const { id, name: _name, classes: _classes, ...shown } = school;
        assert.deepEqual(
          shown,
          freshUsage(
            before.filter((row) => row.org === id),
            true,
          ),
          school.name,
        );
      }
      assert.ok(
        overview.schools!.every(
          (school) => school.placed * drawsFor(school.placed) >= 65_536,
        ),
        "each school's interval reads the kept stream",
      );
      assert.deepEqual(overview.trend, await arrayTrend(db, before, term));
      assert.equal(
        overview.seats.waiting,
        before.filter((row) => !row.seated).length,
      );
      assert.equal(overview.week.students, before.length);

      // A school's Overview: its classes, each with its interval.
      const aspen = made[0]!.id;
      const schoolOverview = await readOverview(db, aspen, null, true);
      const schoolScope = await orgScope(db, aspen);
      const schoolTerm = await termInUse(db, schoolScope);
      const schoolFacts = await oneQueryFacts(
        db,
        aspen,
        schoolTerm,
        schoolScope.today,
      );
      const members = await classMembers(
        db,
        schoolOverview.classes!.map((row) => row.id),
      );
      for (const row of schoolOverview.classes!) {
        const here = new Set(
          members
            .filter((member) => member.class === row.id)
            .map((member) => member.person),
        );
        const { id: _id, name: _name, teachers: _teachers, ...shown } = row;
        assert.deepEqual(
          shown,
          freshUsage(
            schoolFacts.filter((fact) => here.has(fact.id)),
            true,
          ),
          row.name,
        );
      }
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
