import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { startSchoolClass } from "../src/schools/pilots.js";

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
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    t.after(async () => {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    await migrate(scoped.href);
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
