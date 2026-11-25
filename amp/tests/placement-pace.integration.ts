import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate";
import { skills } from "../src/curriculum/catalog";
import { templates } from "../src/math/engine";
import { birthYearForGrade } from "../src/schools/repository";
import { buildApp } from "../src/server/app";
import { templateGrade } from "../src/server/mixed-practice";
import { PostgresRepository } from "../src/server/repository";

const nodes = new Map(skills.map((skill) => [skill.id, skill]));
const gradeOf = (templateId: string) =>
  templateGrade(
    templates.find((t) => t.id === templateId)!,
    nodes,
  );

test(
  "through the API, a new third grader who is right about everything stays at grades 3 and 4 for the first sixteen problems",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `placement_pace_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const repository = new PostgresRepository(scoped.href, {
      development: false,
      freeProblems: 1000,
    });
    try {
      // The birth year a roster grade of 3 is kept as.
      const trial = await repository.createTrial(birthYearForGrade(3));
      const account = (await repository.trialAccount(trial.token))!;
      const app = buildApp({
        repository,
        development: false,
        logger: false,
        authenticate: async () => account,
      } as never);
      await app.ready();
      const base = `/api/v1/learners/${trial.learnerId}`;
      const headers = { authorization: "Bearer test" };
      const grades: number[] = [];
      for (let i = 0; i < 16; i++) {
        const batch = await app.inject({
          method: "POST",
          url: `${base}/batches`,
          headers,
          payload: { count: 1 },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        const [problem] = batch.json().problems;
        grades.push(gradeOf(problem.templateId));
        const saved = await repository.transaction(
          account,
          trial.learnerId,
          (tx) => tx.problem(problem.id),
        );
        const attempt = await app.inject({
          method: "POST",
          url: `${base}/attempts`,
          headers,
          payload: {
            problemId: problem.id,
            requestId: randomUUID(),
            response: saved!.answer,
          },
        });
        assert.equal(attempt.statusCode, 200, attempt.body);
        assert.equal(attempt.json().correct, true, problem.templateId);
      }
      const frontier = await repository.transaction(
        account,
        trial.learnerId,
        (tx) => tx.frontier(),
      );
      assert.equal(frontier.expected, 3);
      assert.equal(frontier.gradeStart, true);
      // Sixteen problems: the grade, and a stretch from the next. Half of
      // grade 3's skills are not earned in sixteen answers.
      assert.ok(Math.max(...grades) <= 4.5, `sixteen: ${grades.join(" ")}`);
      assert.ok(
        grades.filter((grade) => grade >= 2.5 && grade < 3.5).length >= 6,
        `grade 3 problems: ${grades.join(" ")}`,
      );
      // Sixteen right answers in a row read a grade or two ahead, not high
      // school (the engine before read about grade 10 here).
      assert.ok(frontier.overall.level < 6, `level ${frontier.overall.level}`);
      await app.close();
    } finally {
      await repository.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
