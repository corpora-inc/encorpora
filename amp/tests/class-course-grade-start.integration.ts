import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import { SchoolRepository } from "../src/schools/repository";
import { buildApp } from "../src/server/app";
import { templateGrade } from "../src/server/mixed-practice";
import { PgTransaction, PostgresRepository } from "../src/server/repository";

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const gradeOf = (templateId: string) =>
  templateGrade(
    templates.find((t) => t.id === templateId)!,
    nodes,
  );

/* A teacher's "Grade 4" class says what grade its students are in. A student
   with no grade of their own starts there as a grade, not as a guess: the
   grade counts, and practice climbs by coverage. */
test(
  "a rostered student with no grade starts from their class's course as a grade",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `class_course_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    await learning.pool.query("UPDATE amp_course_placement SET enabled=true");
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
      seats: 20,
      endsAt: new Date(Date.now() + 86400000 * 30).toISOString(),
    });
    const student = async (klass: string | null, extra: object = {}) => {
      const made = await schools.provisionStudent(org.id, {
        givenName: "Learner",
        ...(klass ? { classId: klass } : {}),
        ...extra,
      });
      return { ...made, account: `school:${made.personId}` };
    };
    const frontierOf = (who: { account: string; learnerId: string }) =>
      learning.transaction(who.account, who.learnerId, (tx) => tx.frontier());
    /** `count` problems through the API, each answered right. */
    const practice = async (
      who: { account: string; learnerId: string },
      count: number,
    ) => {
      account = who.account;
      const grades: number[] = [];
      for (let i = 0; i < count; i++) {
        const batch = await app.inject({
          method: "POST",
          url: `/api/v1/learners/${who.learnerId}/batches`,
          payload: { count: 1 },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        const [problem] = batch.json().problems;
        grades.push(gradeOf(problem.templateId));
        const saved = await learning.transaction(
          who.account,
          who.learnerId,
          (tx) => tx.problem(problem.id),
        );
        const attempt = await app.inject({
          method: "POST",
          url: `/api/v1/learners/${who.learnerId}/attempts`,
          payload: {
            problemId: problem.id,
            requestId: randomUUID(),
            response: saved!.answer,
          },
        });
        assert.equal(attempt.statusCode, 200, attempt.body);
        assert.equal(attempt.json().correct, true, problem.templateId);
      }
      return grades;
    };

    const fourth = await schools.createClass(org.id, {
      name: "Grade 4 Math",
      courseBands: ["4"],
    });
    const plain = await schools.createClass(org.id, { name: "Room 12" });

    await t.test("in a grade 4 class: a grade start at 4", async () => {
      const child = await student(fourth.id);
      const start = await frontierOf(child);
      assert.equal(start.expected, 4);
      assert.equal(start.gradeStart, true);
      assert.equal(
        (
          await learning.pool.query(
            "SELECT birth_year FROM amp_learners WHERE id=$1",
            [child.learnerId],
          )
        ).rows[0].birth_year,
        null,
        "a course still does not make up a birth year",
      );
      // Sixteen right answers: grade 4, and a stretch from grade 5. Two
      // thirds of grade 4's skills are not earned in sixteen answers.
      const grades = await practice(child, 16);
      assert.ok(Math.max(...grades) <= 5.5, `sixteen: ${grades.join(" ")}`);
      assert.ok(
        grades.filter((grade) => grade >= 3.5 && grade < 4.5).length >= 6,
        `grade 4 problems: ${grades.join(" ")}`,
      );
      const after = await frontierOf(child);
      assert.equal(after.gradeStart, true);
      // As a guess the same answers read about grade 9.
      assert.ok(after.overall.level < 7.5, `level ${after.overall.level}`);
      // Both readers of a level agree: the stored one and a full replay.
      const now = Date.now();
      const both = await learning.transaction(
        child.account,
        child.learnerId,
        async (tx) => ({
          stored: await tx.frontier(now),
          replayed: await (tx as PgTransaction).frontier(now, 1_000_000),
        }),
      );
      assert.deepEqual(both.stored, both.replayed);
    });

    await t.test(
      "in a class with no course: a guess at grade 2, as before",
      async () => {
        const child = await student(plain.id);
        const start = await frontierOf(child);
        assert.equal(start.expected, 2);
        assert.equal(start.gradeStart, undefined);
        // A guess still climbs the faster way: past grade 4 within ten.
        const grades = await practice(child, 10);
        assert.ok(Math.max(...grades) > 4.5, `ten: ${grades.join(" ")}`);
      },
    );

    await t.test("in no class at all: a guess", async () => {
      const start = await frontierOf(await student(null));
      assert.equal(start.expected, 2);
      assert.equal(start.gradeStart, undefined);
    });

    await t.test(
      "a birth year still decides, whatever the class's course",
      async () => {
        const date = new Date();
        const schoolYear =
          date.getUTCFullYear() - (date.getUTCMonth() < 7 ? 1 : 0);
        const child = await student(fourth.id, { birthYear: schoolYear - 8 });
        const start = await frontierOf(child);
        assert.equal(start.expected, 2);
        assert.equal(start.gradeStart, true);
      },
    );

    await t.test(
      "a start kept before the class had a course stays a guess",
      async () => {
        const room = await schools.createClass(org.id, { name: "Room 14" });
        const child = await student(room.id);
        await practice(child, 1);
        await learning.pool.query(
          "UPDATE amp_classes SET course_bands=ARRAY['5'] WHERE id=$1",
          [room.id],
        );
        const after = await frontierOf(child);
        assert.equal(after.expected, 2);
        assert.equal(after.gradeStart, undefined);
      },
    );

    await t.test(
      "a course changed after the start was kept: the start stays, and stays a grade",
      async () => {
        const room = await schools.createClass(org.id, {
          name: "Grade 3 Math",
          courseBands: ["3"],
        });
        const child = await student(room.id);
        const before = await frontierOf(child);
        assert.equal(before.expected, 3);
        assert.equal(before.gradeStart, true);
        await learning.pool.query(
          "UPDATE amp_classes SET course_bands=ARRAY['5'] WHERE id=$1",
          [room.id],
        );
        // A later course is not taken up (a saved start is kept), and what was
        // a grade start is not turned back into a guess.
        const after = await frontierOf(child);
        assert.equal(after.expected, 3);
        assert.equal(after.gradeStart, true);
        assert.deepEqual(after.overall, before.overall);
      },
    );

    await t.test(
      "a grade 2 class: a grade start at 2, while it is a grade 2 class",
      async () => {
        const room = await schools.createClass(org.id, {
          name: "Grade 2 Math",
          courseBands: ["2"],
        });
        const child = await student(room.id);
        const start = await frontierOf(child);
        assert.equal(start.expected, 2);
        assert.equal(start.gradeStart, true);
        // Ten right answers: grade 2, and a stretch from grade 3.
        const grades = await practice(child, 10);
        assert.ok(Math.max(...grades) <= 3.5, `ten: ${grades.join(" ")}`);
      },
    );

    await t.test(
      "a grade 2 class that becomes a grade 3 class: the start of 2 is a guess again",
      async () => {
        const room = await schools.createClass(org.id, {
          name: "Grade 2 Math B",
          courseBands: ["2"],
        });
        const child = await student(room.id);
        await practice(child, 6);
        const before = await frontierOf(child);
        assert.equal(before.gradeStart, true);
        await learning.pool.query(
          "UPDATE amp_classes SET course_bands=ARRAY['3'] WHERE id=$1",
          [room.id],
        );
        // 2 is also where a student with no course starts, so nothing kept on
        // the student says this 2 came from a course. The answers are read
        // again from a guess: once, with the same result as a full replay.
        const after = await frontierOf(child);
        assert.equal(after.expected, 2);
        assert.equal(after.gradeStart, undefined);
        const now = Date.now();
        const both = await learning.transaction(
          child.account,
          child.learnerId,
          async (tx) => ({
            stored: await tx.frontier(now),
            replayed: await (tx as PgTransaction).frontier(now, 1_000_000),
          }),
        );
        assert.deepEqual(both.stored, both.replayed);
        assert.equal(both.stored.gradeStart, undefined);
        // And practice goes on.
        await practice(child, 2);
      },
    );

    await t.test(
      "with course placement off: a guess at grade 2, before and after the first answer",
      async () => {
        const second = await schools.createClass(org.id, {
          name: "Grade 2 Math C",
          courseBands: ["2"],
        });
        await learning.pool.query(
          "UPDATE amp_course_placement SET enabled=false",
        );
        try {
          for (const klass of [fourth.id, second.id]) {
            const child = await student(klass);
            const start = await frontierOf(child);
            assert.equal(start.expected, 2);
            assert.equal(start.gradeStart, undefined);
            // The first answer keeps a start of 2 on the student. In a grade 2
            // class that must not read as the class's course.
            await practice(child, 1);
            const after = await frontierOf(child);
            assert.equal(after.expected, 2);
            assert.equal(after.gradeStart, undefined);
          }
        } finally {
          await learning.pool.query(
            "UPDATE amp_course_placement SET enabled=true",
          );
        }
      },
    );
  },
);
