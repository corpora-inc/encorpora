import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository, ApiError } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { generateProblem } from "../src/math/engine.js";
import { earnedCount } from "../src/learning/earned.js";
import { learnerWhere } from "../src/web/lib/learner-where.js";
import { practiceMinutes } from "../src/web/lib/practice-minutes.js";
import { frontierRange } from "../src/web/features/pathways/model.js";
import { schoolDay } from "./helpers/school-day.js";
import { config as billingConfig } from "./stripe-fixtures.js";

/*
 * One child, one story (product grabs 2026-11-17, #15, #16, #18): the
 * family's child page, Today and the child's Pathways read the same
 * learner and must say the same thing about them. Skills earned is one
 * count, where they are is one answer, and practice time is one figure.
 */
test(
  "a child's page, Today and Pathways tell one story: earned, where and minutes",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_results_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, {
      renderer: { render: async () => Buffer.from("%PDF-fixture") },
      billingConfig,
      pool: db,
      authenticate,
      approvals: {
        secret: "fixture-secret-for-results-tests-only",
        origin: "https://amp.example.test",
      },
    });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const get = async (path: string, account: string) => {
      const response = await app.inject({
        method: "GET",
        url: path,
        headers: { authorization: `Bearer ${account}` },
      });
      assert.equal(response.statusCode, 200, response.body);
      return response.json();
    };

    const id = randomUUID();
    await db.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,'Parent',$2,true,now(),now())`,
      [id, `${id}@example.test`],
    );
    const account = `amp|${id}`;
    await db.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','fixture')",
      [account],
    );
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/learners",
      headers: { authorization: `Bearer ${account}` },
      payload: { name: "Maya", birthYear: 2016 },
    });
    assert.equal(created.statusCode, 201, created.body);
    const child = created.json().id as string;
    const family = (
      await db.query("SELECT org_id FROM amp_families WHERE account_id=$1", [
        account,
      ])
    ).rows[0].org_id as string;

    // Answers as practice records them: one skill earned at its first
    // success on its own, one shown twice, one answered with help, one
    // missed. A grade would count only the one shown twice.
    const now = Date.now();
    const answers: [string, boolean, boolean][] = [
      ["multiply-facts", true, false],
      ["linear-equation", true, false],
      ["linear-equation", true, false],
      ["fraction-equivalence-choice", true, true],
      ["mean-data", false, false],
    ];
    await learning.transaction(account, child, async (tx) => {
      for (const [index, [templateId, correct, assisted]] of answers.entries()) {
        const problem = generateProblem(templateId, randomUUID());
        await tx.saveProblem(problem);
        const wrong =
          problem.public.response.kind === "choice"
            ? problem.public.response.options.find(
                (o) => o.id !== problem.answer,
              )!.id
            : problem.answer === "99999"
              ? "99998"
              : "99999";
        await tx.saveAttempt({
          id: randomUUID(),
          requestId: randomUUID(),
          problemId: problem.public.id,
          skillId: problem.public.skillId,
          templateId,
          response: correct ? problem.answer : wrong,
          correct,
          assisted,
          answer: problem.answer,
          explanation: problem.explanation,
          createdAt: new Date(now - (answers.length - index) * 1000).toISOString(),
        });
      }
      // The day's level, stored as practice stores it after answers.
      await tx.saveLevelDay(await tx.frontier());
    });
    // 40 seconds of practice: less than a minute, never "1 min".
    await db.query(
      "INSERT INTO amp_active_days(learner_id,day,surface,active_ms) VALUES($1,$2,'practice',40000)",
      [child, schoolDay()],
    );

    const record = await get(
      `/api/v1/families/${family}/children/${child}/progress`,
      account,
    );
    const progress = await get(`/api/v1/learners/${child}/progress`, account);
    const frontier = await get(`/api/v1/learners/${child}/frontier`, account);
    const projection = await get(`/api/v1/families/${family}`, account);

    // #15: skills earned is one count on the child page, on Pathways and in
    // the family's week.
    const pathwaysEarned = earnedCount(progress.skills);
    assert.equal(pathwaysEarned, 2);
    assert.equal(record.earned, pathwaysEarned);
    assert.deepEqual(
      record.objectives.map((o: { skillId: string }) => o.skillId).sort(),
      progress.skills
        .filter((s: { independentCorrect: number }) => s.independentCorrect >= 1)
        .map((s: { skillId: string }) => s.skillId)
        .sort(),
    );
    assert.equal(projection.today.week.objectives, pathwaysEarned);

    // #16: where the child is, one answer: the child page's estimate and
    // Pathways' grades view and 3D map (which read the frontier).
    const page = learnerWhere(record.level.overall);
    const map = learnerWhere(frontier.overall);
    assert.ok(page && map);
    assert.deepEqual(map, page);
    const bands = frontierRange(frontier);
    assert.deepEqual(
      { lo: bands!.lo, hi: bands!.hi, best: bands!.best },
      { lo: page.range.from, hi: page.range.to, best: page.best },
    );

    // #18: practice time, one source and one formatter: Today's card, the
    // family's week and the child page's daily chart all say "<1 min".
    const card = projection.children.find(
      (entry: { id: string }) => entry.id === child,
    ).week;
    const time = await get(
      `/api/v1/families/${family}/children/${child}/time?period=week&from=${projection.today.week.from}`,
      account,
    );
    const day = time.days.find(
      (entry: { day: string }) => entry.day === schoolDay(),
    );
    assert.ok(card.minutes > 0 && card.minutes < 1, `exact: ${card.minutes}`);
    assert.equal(practiceMinutes(card.minutes, card.problems), "<1 min");
    assert.equal(practiceMinutes(day.minutes, day.problems), "<1 min");
    assert.equal(
      practiceMinutes(
        projection.today.week.minutes,
        projection.today.week.problems,
      ),
      "<1 min",
    );
    assert.equal(card.problems, day.problems);
  },
);
