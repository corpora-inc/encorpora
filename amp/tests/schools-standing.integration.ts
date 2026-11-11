import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { termGrowth } from "../src/schools/growth.js";
import { SchoolRepository } from "../src/schools/repository.js";
import {
  readClassStanding,
  readOrgStanding,
} from "../src/schools/standing-reads.js";

const DAY = 86_400_000;
const day = (offset: number) =>
  new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const peak = (density: number[]) => Math.max(...density);

test(
  "a new school is a flat, wide curve with every student on it, and it narrows as answers come in",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_standing_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    const schools = new SchoolRepository(db);
    try {
      const org = await schools.createOrg(
        { kind: "school", name: "Fixture School", timezone: "UTC" },
        {
          version: "fixture-1",
          signerName: "Fixture Signer",
          signerTitle: "Head of School",
        },
      );
      const year = randomUUID();
      await db.query(
        `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on) VALUES
           ($1,$2,NULL,'year','This year',$3,$4)`,
        [year, org.id, day(-30), day(200)],
      );
      const klass = await schools.createClass(org.id, {
        name: "Grade 5 Math",
        courseBands: ["5"],
        gradingKind: "year",
        sessionId: year,
      });
      const students = await Promise.all(
        Array.from({ length: 12 }, (_, index) =>
          schools.provisionStudent(org.id, {
            givenName: `Student${String(index).padStart(2, "0")}`,
            gradeLevel: 5,
            classId: klass.id,
          }),
        ),
      );
      // Day one: half have opened practice (a stored starting guess, no
      // answers, the estimator's wide prior); half never have.
      const level = (
        learnerId: string,
        offset: number,
        value: number,
        sd: number,
        answered: number,
      ) =>
        db.query(
          `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'fixture')
           ON CONFLICT(learner_id,day) DO UPDATE SET frontier=EXCLUDED.frontier`,
          [
            learnerId,
            day(offset),
            JSON.stringify({
              overall: { level: value, sd, answered, independent: 0 },
              strands: {},
            }),
          ],
        );
      await db.query(
        `UPDATE amp_org_roles SET begin_on=$1 WHERE org_id=$2 AND role='student'`,
        [day(-30), org.id],
      );
      await db.query(
        `UPDATE amp_enrollments SET begin_on=$1 WHERE class_id=$2`,
        [day(-30), klass.id],
      );
      for (const student of students.slice(0, 6))
        await level(student.learnerId, -20, 5, 2.5, 0);

      const first = await readOrgStanding(db, org.id);
      // Nobody is left out, and nobody is "at grade level" on a guess.
      assert.equal(first.all.n, 12);
      assert.equal(first.all.settling, 12);
      assert.ok(first.all.sd! >= 1.9, `sd ${first.all.sd}`);
      assert.ok(first.all.within < 0.4 * 12, `within ${first.all.within}`);
      // A flat curve on an honest axis: it reaches past ±5 grades.
      assert.ok(first.grid.from <= -6 && first.grid.to >= 6);
      assert.ok(peak(first.all.density) < 0.25);
      // The median's band says "somewhere in there".
      const band = first.all.middle!;
      assert.ok(band.high - band.low > 1, `${band.low} to ${band.high}`);
      assert.equal(first.groups.length, 1);
      assert.equal(first.groups[0]!.curve.n, 12);

      // Weeks later, every student has a placed estimate.
      for (const [index, student] of students.entries()) {
        await level(student.learnerId, -15, 4.5 + index / 10, 0.45, 25);
        await level(student.learnerId, -1, 4.8 + index / 10, 0.3, 160);
      }
      const later = await readOrgStanding(db, org.id);
      assert.equal(later.all.n, 12);
      assert.equal(later.all.settling, 0);
      assert.ok(later.all.sd! < 0.6, `sd ${later.all.sd}`);
      assert.ok(peak(later.all.density) > 2.5 * peak(first.all.density));
      const tight = later.all.middle!;
      assert.ok(tight.high - tight.low < (band.high - band.low) / 3);

      // The class drill: each student a band, sorted, with growth this term.
      const drill = await readClassStanding(db, klass.id);
      assert.equal(drill.students.length, 12);
      assert.deepEqual(
        drill.students.map((row) => row.mu),
        [...drill.students.map((row) => row.mu)].sort((a, b) => a - b),
      );
      assert.ok(drill.students.every((row) => row.sd === 0.3));
      const pace = termGrowth(
        [
          { day: 15, level: 4.5, sd: 0.45 },
          { day: 29, level: 4.8, sd: 0.3 },
        ],
        30,
      )!;
      const hundredth = (value: number) => Math.round(value * 100) / 100;
      assert.equal(drill.growth!.n, 12);
      assert.equal(drill.growth!.median, hundredth(pace.mu));
      assert.ok(drill.growth!.low < pace.mu && drill.growth!.high > pace.mu);
      for (const row of drill.students) {
        assert.equal(row.growth!.mu, hundredth(pace.mu));
        assert.equal(row.growth!.sd, hundredth(pace.sd));
      }
      // One grade 5 class: the axis stops at K and at 13.
      assert.ok(drill.grid.from >= -6 && drill.grid.to <= 8);
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);

test(
  "ten thousand students: one read and a small numeric pass",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_standing_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    const schools = new SchoolRepository(db);
    try {
      const org = await schools.createOrg(
        { kind: "school", name: "Large School", timezone: "UTC" },
        {
          version: "fixture-1",
          signerName: "Fixture Signer",
          signerTitle: "Head of School",
        },
      );
      const year = randomUUID();
      await db.query(
        `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on) VALUES
           ($1,$2,NULL,'year','This year',$3,$4)`,
        [year, org.id, day(-30), day(200)],
      );
      const classes = await Promise.all(
        Array.from({ length: 40 }, (_, index) =>
          schools.createClass(org.id, {
            name: `Class ${index + 1}`,
            courseBands: [String((index % 8) + 1)],
            gradingKind: "year",
            sessionId: year,
          }),
        ),
      );
      // One student provisioned the usual way, then ten thousand copies of
      // their rows, as a roster import and a term of practice leave them.
      const seed = await schools.provisionStudent(org.id, {
        givenName: "Seed",
        gradeLevel: 5,
        classId: classes[0]!.id,
      });
      const clone = (table: string, where: string, patch: string) =>
        db.query(
          `INSERT INTO ${table}
           SELECT (jsonb_populate_record(NULL::${table},to_jsonb(t)||${patch})).*
           FROM ${table} t,generate_series(1,10000) i WHERE ${where}`,
          [seed.learnerId, seed.personId, classes.map((row) => row.id)],
        );
      await clone(
        "amp_learners",
        "t.id=$1 AND $2::uuid IS NOT NULL AND $3::uuid[] IS NOT NULL",
        "jsonb_build_object('id','bulk-'||i)",
      );
      await clone(
        "amp_people",
        "t.id=$2 AND $1::text IS NOT NULL AND $3::uuid[] IS NOT NULL",
        `jsonb_build_object('id',md5('p'||i)::uuid,'learner_id','bulk-'||i,
           'handle','bulk'||i,'grade_level',(i%8)+1)`,
      );
      await clone(
        "amp_org_roles",
        "t.person_id=$2 AND $1::text IS NOT NULL AND $3::uuid[] IS NOT NULL",
        "jsonb_build_object('id',md5('r'||i)::uuid,'person_id',md5('p'||i)::uuid)",
      );
      await clone(
        "amp_enrollments",
        "t.person_id=$2 AND $1::text IS NOT NULL",
        `jsonb_build_object('id',md5('e'||i)::uuid,'person_id',md5('p'||i)::uuid,
           'class_id',($3::uuid[])[(i%40)+1])`,
      );
      await db.query(
        `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
         SELECT 'bulk-'||i,$1::date,jsonb_build_object('overall',jsonb_build_object(
           'level',((i%8)+1)+sin(i)*1.5,'sd',0.3+abs(cos(i))*0.5,'answered',(i%300),'independent',0),
           'strands','{}'::jsonb),'fixture'
         FROM generate_series(1,10000) i`,
        [day(-1)],
      );
      await db.query("ANALYZE");
      const started = performance.now();
      const view = await readOrgStanding(db, org.id);
      const elapsed = performance.now() - started;
      // The seed has no level day: on the curve all the same, at the
      // national spread for grade 5.
      assert.equal(view.all.n, 10001);
      assert.equal(view.groups.length, 40);
      assert.deepEqual(
        view.groups.map((group) => group.curve.n).sort((a, b) => b - a),
        [251, ...Array(39).fill(250)],
      );
      console.log(`10,001 students read and drawn in ${Math.round(elapsed)} ms`);
      assert.ok(elapsed < 3000, `${Math.round(elapsed)} ms`);
    } finally {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
