import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { templates } from "../src/math/engine.js";

test(
  "a rostered child without a birth year begins at the class course band",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_course_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const schools = new SchoolRepository(learning.pool);
    let account = "";
    const app = buildApp({
      repository: learning,
      authenticate: async () => account,
    });
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const org = await schools.createOrg(
      { kind: "school", name: "Course fixture", timezone: "UTC" },
      { version: "fixture", signerName: "Fixture", signerTitle: "Head" },
    );
    await schools.issueLicense({
      orgId: org.id,
      seats: 10,
      endsAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    });
    const klass = await schools.createClass(org.id, {
      name: "Grade 4 Math",
      courseBands: ["4"],
    });
    const child = await schools.provisionStudent(org.id, {
      givenName: "Learner",
      classId: klass.id,
    });
    account = `school:${child.personId}`;
    const row = (
      await learning.pool.query(
        "SELECT birth_year FROM amp_learners WHERE id=$1",
        [child.learnerId],
      )
    ).rows[0];
    assert.equal(
      row.birth_year,
      null,
      "a course must not fabricate a birth year",
    );
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/learners/${child.learnerId}/batches`,
      payload: { count: 1 },
    });
    assert.equal(response.statusCode, 200, response.body);
    const problem = response.json().problems[0];
    const template = templates.find(
      (entry) => entry.id === problem.templateId,
    )!;
    assert.notEqual(
      template.gradeBand,
      "K–2",
      "Grade 4's first problem must not be early arithmetic",
    );
    const start = (
      await learning.pool.query(
        "SELECT starting_course_level FROM amp_learners WHERE id=$1",
        [child.learnerId],
      )
    ).rows[0];
    assert.equal(start.starting_course_level, 4);
    const initial = await learning.transaction(account, child.learnerId, (tx) =>
      tx.frontier(),
    );
    await learning.pool.query(
      "UPDATE amp_classes SET course_bands=ARRAY['9'] WHERE id=$1",
      [klass.id],
    );
    const unchanged = await learning.transaction(
      account,
      child.learnerId,
      (tx) => tx.frontier(),
    );
    assert.equal(
      unchanged.overall.level,
      initial.overall.level,
      "changing classes does not change a saved course prior",
    );
    await learning.transaction(account, child.learnerId, (tx) =>
      tx.setStartingPoint("6–8"),
    );
    const explicit = await learning.transaction(
      account,
      child.learnerId,
      (tx) => tx.frontier(),
    );
    assert.ok(
      explicit.overall.level >= 6.5 && explicit.overall.level <= 7.5,
      "an explicit middle-school starting choice takes precedence",
    );
    const date = new Date();
    const schoolYear = date.getUTCFullYear() - (date.getUTCMonth() < 7 ? 1 : 0);
    const born = await schools.provisionStudent(org.id, {
      givenName: "Known year",
      birthYear: schoolYear - 7,
      classId: klass.id,
    });
    const birthStart = await learning.transaction(
      `school:${born.personId}`,
      born.learnerId,
      (tx) => tx.frontier(),
    );
    const reference = await schools.provisionStudent(org.id, {
      givenName: "Same known year",
      birthYear: schoolYear - 7,
    });
    const referenceStart = await learning.transaction(
      `school:${reference.personId}`,
      reference.learnerId,
      (tx) => tx.frontier(),
    );
    assert.deepEqual(
      birthStart.overall,
      referenceStart.overall,
      "a class's course cannot override the estimate supplied by a known birth year",
    );
  },
);
