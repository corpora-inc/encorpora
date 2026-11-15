import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { FamilyRepository } from "../src/family/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { startSchoolClass } from "../src/schools/pilots.js";
import { AGREEMENT_VERSION } from "../src/schools/agreement.js";
import { schoolAccountId } from "../src/schools/principal.js";
import { buildApp } from "../src/server/app.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { generateProblem } from "../src/math/engine.js";
import {
  PERSONA_STEPS,
  recordActivation,
  recordLearnerActivation,
} from "../src/analytics/activation.js";
import { purgeFunnelEvents } from "../src/analytics/retention.js";

/* Activation milestones (docs/engagement-measurement.md#activation-milestones):
   the server records the first time each account reaches a first-run step,
   once, never in a demo, and the weekly report reads them. Names are made up. */
const database = { skip: !process.env.AMP_TEST_DATABASE_URL };
const year = new Date().getUTCFullYear();

async function fixture(t: TestContext) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `amp_activation_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(scoped.href);
  const repository = new PostgresRepository(scoped.href, { development: true });
  const db = repository.pool;
  const accounts = new Set<string>();
  const authenticate = async (request: {
    headers: { authorization?: string };
  }) => {
    const signedIn = request.headers.authorization?.replace(/^Bearer /, "");
    if (!signedIn || !accounts.has(signedIn))
      throw new ApiError(401, "Sign in to continue");
    return signedIn;
  };
  const app = buildApp({ repository, authenticate });
  await registerFamilyRoutes(app, { pool: db, authenticate });
  await registerSchoolRoutes(app, {
    pool: db,
    authenticate,
    services: {
      secret: "0".repeat(64),
      origin: "https://amp.example",
      learning: repository,
      renderer: { render: async () => Buffer.from("%PDF-1.7 fixture") },
    },
  });
  await app.ready();
  t.after(async () => {
    await app.close();
    await repository.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  const user = async () => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
       VALUES($1,'Fixture Adult',$2,true,now(),now())`,
      [id, `${id}@activation.example`],
    );
    const account = `amp|${id}`;
    accounts.add(account);
    await recordActivation(db, { accountId: account, step: "account_created" });
    return account;
  };
  const post = async (account: string, url: string, payload: object) => {
    const response = await app.inject({
      method: "POST",
      url,
      payload,
      headers: { authorization: `Bearer ${account}` },
    });
    assert.ok(response.statusCode < 300, response.body);
    return response.body ? response.json() : null;
  };
  const milestones = async (account: string) =>
    Object.fromEntries(
      (
        await db.query<{ step: string; persona: string | null }>(
          "SELECT step,persona FROM amp_activation_milestones WHERE account_id=$1",
          [account],
        )
      ).rows.map((row) => [row.step, row.persona]),
    );
  /** `n` answers by `learnerId`, through the one writer of answers. */
  const answer = async (account: string, learnerId: string, n: number) => {
    for (let i = 0; i < n; i++)
      await repository.transaction(account, learnerId, async (tx) => {
        const problem = generateProblem("count-objects", randomUUID());
        await tx.saveProblem(problem);
        await tx.saveAttempt({
          id: randomUUID(),
          requestId: randomUUID(),
          problemId: problem.public.id,
          skillId: problem.public.skillId,
          templateId: "count-objects",
          response: problem.answer,
          correct: true,
          assisted: false,
          answer: problem.answer,
          explanation: problem.explanation,
          createdAt: new Date().toISOString(),
        } as never);
      });
  };
  return { db, repository, user, post, milestones, answer };
}

test(
  "a parent's first run: persona, child, first answer, 20 answers and a workbook, each once",
  database,
  async (t) => {
    const { db, user, post, milestones, answer } = await fixture(t);
    const parent = await user();
    await post(parent, "/api/v1/start/choice", { answer: "parent" });
    // A later tap changes nothing: the first choice is the persona.
    await post(parent, "/api/v1/start/choice", { answer: "myself" });
    const started = await post(parent, "/api/v1/start", {
      as: "parent",
      children: [{ birthYear: year - 8 }, { birthYear: year - 10 }],
    });
    const child = started.learnerId as string;
    assert.deepEqual(await milestones(parent), {
      account_created: null,
      persona_chosen: "parent",
      learner_added: "parent",
    });
    await answer(parent, child, 1);
    assert.equal((await milestones(parent)).first_answer, "parent");
    assert.equal((await milestones(parent)).answers_20, undefined);
    await answer(parent, child, 18);
    assert.equal((await milestones(parent)).answers_20, undefined);
    await answer(parent, child, 1);
    assert.equal((await milestones(parent)).answers_20, "parent");
    await recordLearnerActivation(db, child, "workbook");
    assert.equal((await milestones(parent)).workbook_opened, "parent");
    const first = (
      await db.query(
        "SELECT step,first_at FROM amp_activation_milestones WHERE account_id=$1 ORDER BY step",
        [parent],
      )
    ).rows;
    await answer(parent, child, 2);
    assert.deepEqual(
      (
        await db.query(
          "SELECT step,first_at FROM amp_activation_milestones WHERE account_id=$1 ORDER BY step",
          [parent],
        )
      ).rows,
      first,
      "a repeat never moves a milestone",
    );
  },
);

test(
  "learning for yourself and a tutor's students count for that account",
  database,
  async (t) => {
    const { user, post, milestones, answer } = await fixture(t);
    const adult = await user();
    const own = await post(adult, "/api/v1/start", {
      as: "myself",
      timezone: "America/New_York",
      birthYear: year - 30,
    });
    await answer(adult, own.learnerId, 1);
    assert.deepEqual(await milestones(adult), {
      account_created: null,
      persona_chosen: "myself",
      first_answer: "myself",
    });

    const tutor = await user();
    await post(tutor, "/api/v1/start", {
      as: "tutor",
      students: [{ birthYear: year - 9, nickname: "AB" }],
    });
    assert.equal((await milestones(tutor)).learner_added, "tutor");
  },
);

test(
  "a teacher's class: created, first student, first answer and 20 answers in it, never in a demo",
  database,
  async (t) => {
    const { db, repository, user, milestones, answer } = await fixture(t);
    const schools = new SchoolRepository(db);
    const teacher = await user();
    const start = (account: string, names: string[]) =>
      startSchoolClass(schools, account, {
        requestId: randomUUID(),
        schoolName: "Fixture school",
        newSchool: true,
        className: "Room 1",
        timezone: "America/New_York",
        signerName: "Fixture Adult",
        signerTitle: "Teacher",
        agreementVersion: AGREEMENT_VERSION,
        authorized: true,
        names,
        gradeLevel: 4,
      });
    const created = await start(teacher, ["Ada Example", "Bea Example"]);
    assert.deepEqual(Object.keys(await milestones(teacher)).sort(), [
      "account_created",
      "class_created",
      "student_joined",
    ]);
    const students = (
      await db.query(
        `SELECT p.id,p.learner_id FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
         WHERE e.class_id=$1 AND e.role='student' ORDER BY p.id`,
        [created.classId],
      )
    ).rows;
    await answer(schoolAccountId(students[0].id), students[0].learner_id, 12);
    assert.equal(
      (await milestones(teacher)).class_first_answer,
      null,
      "recorded, without a persona chosen",
    );
    assert.equal((await milestones(teacher)).class_answers_20, undefined);
    await answer(schoolAccountId(students[1].id), students[1].learner_id, 8);
    assert.ok("class_answers_20" in (await milestones(teacher)));
    // A family's class is never a teacher's.
    assert.equal((await milestones(teacher)).first_answer, undefined);

    // The same work in a demo counts for nobody.
    const visitor = await user();
    const demo = await start(visitor, ["Cy Example"]);
    await db.query(
      "DELETE FROM amp_activation_milestones WHERE account_id=$1 AND step<>'account_created'",
      [visitor],
    );
    await db.query(
      `UPDATE amp_orgs SET demo=true,demo_kind='school',demo_seen_at=now(),created_by=$2
       WHERE id=$1`,
      [demo.orgId, visitor],
    );
    const pupil = (
      await db.query(
        `SELECT p.id,p.learner_id FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
         WHERE e.class_id=$1 AND e.role='student'`,
        [demo.classId],
      )
    ).rows[0];
    await answer(schoolAccountId(pupil.id), pupil.learner_id, 1);
    await recordActivation(db, {
      accountId: visitor,
      step: "teacher_added",
      orgId: demo.orgId,
    });
    assert.deepEqual(Object.keys(await milestones(visitor)), [
      "account_created",
    ]);
    void repository;
  },
);

test(
  "a school step never counts in a family's org, and a failure never aborts the caller",
  database,
  async (t) => {
    const { db, user, post, milestones } = await fixture(t);
    const parent = await user();
    const started = await post(parent, "/api/v1/start", {
      as: "parent",
      children: [{ birthYear: year - 8 }],
    });
    const family = (
      await db.query("SELECT org_id FROM amp_families WHERE account_id=$1", [
        parent,
      ])
    ).rows[0].org_id;
    await recordActivation(db, {
      accountId: parent,
      step: "teacher_added",
      orgId: family,
      school: true,
    });
    assert.equal((await milestones(parent)).teacher_added, undefined);

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE amp_learners SET name='Renamed child' WHERE id=$1",
        [started.learnerId],
      );
      const errors = t.mock.method(console, "error", () => {});
      await recordActivation(client, {
        accountId: parent,
        step: "school_created",
        orgId: "not-a-uuid",
      });
      assert.equal(errors.mock.callCount(), 1, "the failure is logged");
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    assert.equal(
      (
        await db.query("SELECT name FROM amp_learners WHERE id=$1", [
          started.learnerId,
        ])
      ).rows[0].name,
      "Renamed child",
    );
    // A client outside any transaction records without a savepoint.
    const loose = await db.connect();
    try {
      await recordActivation(loose, { accountId: parent, step: "demo_opened" });
    } finally {
      loose.release();
    }
    assert.ok("demo_opened" in (await milestones(parent)));
    // Only sign-in accounts are people starting AMP.
    await recordActivation(db, {
      accountId: "trial:abc",
      step: "account_created",
    });
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM amp_activation_milestones WHERE account_id NOT LIKE 'amp|%'",
        )
      ).rows[0].n,
      0,
    );
  },
);

test(
  "milestones are exported, erased with learning data, and expire with funnel analytics",
  database,
  async (t) => {
    const { db, user, post } = await fixture(t);
    const parent = await user();
    await post(parent, "/api/v1/start", {
      as: "parent",
      children: [{ birthYear: year - 8 }],
    });
    const families = new FamilyRepository(db);
    const lines: string[] = [];
    for await (const line of families.export(parent)) lines.push(line);
    const exported = lines
      .map((line) => JSON.parse(line))
      .filter((row) => row.type === "activation-milestone");
    assert.deepEqual(exported.map((row) => row.data.step).sort(), [
      "account_created",
      "learner_added",
      "persona_chosen",
    ]);
    const count = async (account: string) =>
      (
        await db.query(
          "SELECT count(*)::int AS n FROM amp_activation_milestones WHERE account_id=$1",
          [account],
        )
      ).rows[0].n;
    await families.deleteLearning(parent);
    assert.equal(await count(parent), 0);

    const other = await user();
    await db.query(
      "UPDATE amp_activation_milestones SET first_at=now()-interval '91 days' WHERE account_id=$1",
      [other],
    );
    await purgeFunnelEvents(db);
    assert.equal(await count(other), 0);
  },
);

test(
  "the weekly report reads each persona's steps in order, with step-to-step shares",
  database,
  async (t) => {
    const { db, user, post, answer } = await fixture(t);
    const sql = await readFile(
      new URL("../scripts/activation-funnel.sql", import.meta.url),
      "utf8",
    );
    // The report's step lists are the module's.
    for (const [persona, steps] of Object.entries(PERSONA_STEPS))
      assert.deepEqual(
        [
          ...sql.matchAll(
            new RegExp(`\\('${persona}',\\d+,'([a-z0-9_]+)'\\)`, "g"),
          ),
        ].map((match) => match[1]),
        [...steps],
        persona,
      );
    const parent = await user();
    const started = await post(parent, "/api/v1/start", {
      as: "parent",
      children: [{ birthYear: year - 8 }],
    });
    await answer(parent, started.learnerId, 1);
    await user(); // signed up, never chose
    const rows = (await db.query(sql)).rows.filter((row) => row.week === "all");
    const parentRows = rows
      .filter((row) => row.persona === "parent")
      .map((row) => [row.step, row.accounts, row.of_prev]);
    assert.deepEqual(parentRows, [
      ["account_created", 1, null],
      ["persona_chosen", 1, "100.0"],
      ["learner_added", 1, "100.0"],
      ["first_answer", 1, "100.0"],
      ["answers_20", 0, "0.0"],
      ["workbook_opened", 0, null],
    ]);
    assert.deepEqual(
      rows
        .filter((row) => row.persona === "none")
        .map((row) => [row.step, row.accounts]),
      [
        ["account_created", 1],
        ["persona_chosen", 0],
      ],
    );
  },
);
