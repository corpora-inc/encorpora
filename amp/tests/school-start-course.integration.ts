import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { startSchoolClass } from "../src/schools/pilots.js";
import { PostgresRepository } from "../src/server/repository.js";

test(
  "a teacher's class keeps the course chosen at setup, and a retry never changes it",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `start_course_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    await db.query("UPDATE amp_course_placement SET enabled=true");
    t.after(async () => {
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const repo = new SchoolRepository(db);
    const input = {
      requestId: randomUUID(),
      schoolName: "Birchwood Elementary",
      className: "Grade 4 Math",
      timezone: "UTC",
      signerName: "Rosa Lindqvist",
      signerTitle: "Teacher",
      agreementVersion: AGREEMENT_VERSION,
      authorized: true,
      names: ["Ana Brook"],
      courseBands: ["4"],
    };
    const first = await startSchoolClass(repo, "fixture-teacher", input);
    const bands = async (classId: string) =>
      (
        await db.query("SELECT course_bands FROM amp_classes WHERE id=$1", [
          classId,
        ])
      ).rows[0].course_bands as string[];
    assert.deepEqual(await bands(first.classId), ["4"]);
    // Its student, with no birth year, begins at grade 4 (SPEC R14): the
    // starting level the practice estimate is built from, not the column.
    const ana = (
      await db.query(
        `SELECT p.id AS "personId",p.learner_id AS "learnerId" FROM amp_people p
         JOIN amp_enrollments e ON e.person_id=p.id AND e.role='student'
         WHERE e.class_id=$1`,
        [first.classId],
      )
    ).rows[0] as { personId: string; learnerId: string };
    const start = await learning.transaction(
      `school:${ana.personId}`,
      ana.learnerId,
      (tx) => tx.frontier(),
    );
    assert.ok(
      start.overall.level >= 3.5 && start.overall.level <= 4.5,
      `a grade 4 class's student starts at grade 4, not ${start.overall.level}`,
    );
    assert.equal(
      (
        await db.query(
          "SELECT starting_course_level,birth_year FROM amp_learners WHERE id=$1",
          [ana.learnerId],
        )
      ).rows[0].birth_year,
      null,
      "a course never invents a birth year",
    );
    // The same request again is the same class, course unchanged.
    const again = await startSchoolClass(repo, "fixture-teacher", {
      ...input,
      courseBands: ["7"],
    });
    assert.equal(again.classId, first.classId);
    assert.deepEqual(await bands(first.classId), ["4"]);
    // No course: each student's own grade, as before.
    const own = await startSchoolClass(repo, "fixture-teacher", {
      ...input,
      requestId: randomUUID(),
      className: "Math support",
      courseBands: undefined,
    });
    assert.deepEqual(await bands(own.classId), []);
  },
);
