import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { templates } from "../src/math/engine.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { applyFixtureMigration } from "./helpers/fixture-migration.js";

/* Every learner is measured the same way (migration 0144): a child on a
   parent's account in no class gets exactly the rollups a school student gets
   for the same activity. Every name is made up. */
const skillOf = (template: string) =>
  templates.find((t) => t.id === template)!.skillId;
const SKILL = skillOf("add-within-20");
const ROLLUPS = [
  "amp_skill_days",
  "amp_active_days",
  "amp_help_days",
  "amp_learner_weeks",
] as const;

/** A fresh schema for one test, dropped after it. */
async function scopedSchema(t: test.TestContext, prefix: string) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  assertTestDatabaseTarget(url);
  const schema = `${prefix}_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  t.after(async () => {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  return scoped.href;
}

type Answer = {
  at: string;
  correct: boolean;
  assisted?: boolean;
  help?: string[];
  reason?: string;
};
/** Stores an answer as `/attempts` does, so the trigger is what is tested. */
async function answer(
  db: Pick<Pool, "query">,
  learnerId: string,
  a: Answer,
  createdAt?: string,
) {
  const id = randomUUID();
  await db.query(
    "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3)",
    [
      id,
      learnerId,
      { public: { id, skillId: SKILL }, selection: { reason: a.reason } },
    ],
  );
  await db.query(
    `INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome,created_at)
     VALUES($1,$2,$3,$3,$4,COALESCE($5::timestamptz,now()))`,
    [
      randomUUID(),
      learnerId,
      id,
      {
        id,
        problemId: id,
        requestId: id,
        skillId: SKILL,
        templateId: "add-within-20",
        correct: a.correct,
        assisted: a.assisted ?? false,
        createdAt: a.at,
        ...(a.help ? { help: a.help } : {}),
      },
      createdAt ?? null,
    ],
  );
}
const ANSWERS: Answer[] = [
  { at: "2026-03-10T15:00:00Z", correct: true },
  { at: "2026-03-10T15:01:00Z", correct: true, reason: "review" },
  {
    at: "2026-03-10T15:02:00Z",
    correct: true,
    assisted: true,
    help: ["hint", "video"],
  },
  { at: "2026-03-11T05:30:00Z", correct: false, help: ["lesson"] },
];
/** One learner's rows in a rollup, without the learner, in a stable order. */
async function rollup(
  db: Pick<Pool, "query">,
  table: (typeof ROLLUPS)[number] | "amp_level_days",
  learnerId: string,
) {
  const { rows } = await db.query(
    `SELECT to_jsonb(r)-'learner_id'-'frontier'-'overall_level'-'overall_answered'-'overall_sd' AS row
     FROM ${table} r WHERE learner_id=$1`,
    [learnerId],
  );
  return rows.map((r) => JSON.stringify(r.row)).sort();
}

test(
  "every learner is measured the same way: a child in no class matches a school student",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = await scopedSchema(t, "amp_equal");
    await migrate(url);
    const learning = new PostgresRepository(url);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
    });
    const post = (path: string, token: string, payload: object = {}) =>
      app.inject({
        method: "POST",
        url: path,
        headers: { authorization: `Bearer ${token}` },
        payload,
      });

    // A school student, in a New York school.
    const org = (await schoolAdmin(schools, "create-org", {
      kind: "school",
      name: "Fixture Equal School",
      timezone: "America/New_York",
      agreement: {
        version: "fixture-1",
        signerName: "Fixture Signer",
        signerTitle: "Head of School",
      },
    })) as { id: string };
    await schoolAdmin(schools, "issue-license", {
      orgId: org.id,
      seats: 5,
      endsAt: new Date(Date.now() + 200 * 86_400_000).toISOString(),
    });
    const klass = (await schools.createClass(org.id, {
      name: "Period 1",
    })) as { id: string };
    const student = await schools.provisionStudent(org.id, {
      givenName: "Fixture",
      gradeLevel: 4,
      classId: klass.id,
    });
    const { token: studentToken } = await schools.issueStudentSession({
      personId: student.personId,
      mode: "shared",
    });

    // A child on a parent's account in no class (one from before family
    // classes, as an adopted trial's can be): no roster row and no adult.
    // Its day is its family's, New York, as the school's is.
    const parent = `amp|parent-${randomUUID()}`;
    await db.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','fixture')",
      [parent],
    );
    // A child added today is in the family's class from the start, and
    // practices on the parent's device under the parent's sign-in.
    const added = await post("/api/v1/learners", parent, {
      birthYear: new Date().getUTCFullYear() - 8,
    });
    assert.equal(added.statusCode, 201, added.body);
    const classed = added.json().id as string;
    const child = randomUUID();
    await db.query(
      "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Fixture',$3)",
      [child, parent, new Date().getUTCFullYear() - 9],
    );
    const roster = async (id: string) =>
      (await db.query("SELECT 1 FROM amp_people WHERE learner_id=$1", [id]))
        .rowCount;
    assert.equal(await roster(child), 0);
    assert.equal(await roster(classed), 1);

    await t.test("each answer rolls up into the same day rows", async () => {
      for (const learner of [student.learnerId, child])
        for (const a of ANSWERS) await answer(db, learner, a);
      const studentDays = await rollup(db, "amp_skill_days", student.learnerId);
      assert.equal(studentDays.length, 2, "two New York days");
      assert.deepEqual(await rollup(db, "amp_skill_days", child), studentDays);
      const [day] = (
        await db.query(
          "SELECT day::text,attempts,correct,independent,assisted,review,with_hint,with_video,with_lesson FROM amp_skill_days WHERE learner_id=$1 ORDER BY day",
          [child],
        )
      ).rows;
      assert.deepEqual(day, {
        day: "2026-03-10",
        attempts: 3,
        correct: 3,
        independent: 2,
        assisted: 1,
        review: 1,
        with_hint: 1,
        with_video: 1,
        with_lesson: 0,
      });
    });

    await t.test(
      "the same heartbeat credits the same time and help",
      async () => {
        const beat = {
          deltas: [
            { surface: "practice", skillId: SKILL, activeMs: 9_000 },
            { surface: "video", skillId: SKILL, activeMs: 4_000 },
            { surface: "hint", skillId: SKILL, activeMs: 2_000 },
            { surface: "lesson", skillId: SKILL, activeMs: 3_000 },
            { surface: "example", skillId: SKILL, activeMs: 1_000 },
          ],
          events: [
            {
              kind: "video",
              source: "lessons",
              ref: "add-within-20",
              ageMs: 0,
            },
            {
              kind: "hint",
              source: "practice",
              ref: "add-within-20",
              step: 1,
              ageMs: 0,
            },
            {
              kind: "lesson",
              source: "pathways",
              ref: "add-within-20",
              ageMs: 0,
            },
          ],
        };
        // A minute since each clock last ran, so the cap doesn't bite.
        await db.query(
          "UPDATE amp_student_sessions SET last_seen_at=now()-interval '60 seconds' WHERE person_id=$1",
          [student.personId],
        );
        const school = await post(
          "/api/v1/school/student/activity",
          studentToken,
          beat,
        );
        assert.equal(school.statusCode, 204, school.body);
        // The child's first heartbeat starts its clock a full heartbeat back.
        const home = await post(
          `/api/v1/learners/${child}/activity`,
          parent,
          beat,
        );
        assert.equal(home.statusCode, 204, home.body);
        await learning.recordPrint(student.learnerId, "counting", "workbook");
        await learning.recordPrint(child, "counting", "workbook");

        for (const table of ["amp_active_days", "amp_help_days"] as const) {
          const theirs = await rollup(db, table, student.learnerId);
          assert.ok(theirs.length > 0, table);
          assert.deepEqual(await rollup(db, table, child), theirs, table);
        }
        const surfaces = (
          await db.query(
            "SELECT surface,sum(active_ms)::int AS ms FROM amp_active_days WHERE learner_id=$1 GROUP BY 1 ORDER BY 1",
            [child],
          )
        ).rows;
        assert.deepEqual(surfaces, [
          { surface: "example", ms: 1_000 },
          { surface: "hint", ms: 2_000 },
          { surface: "lesson", ms: 3_000 },
          { surface: "practice", ms: 9_000 },
          { surface: "video", ms: 4_000 },
        ]);
        const kinds = (
          await db.query(
            "SELECT kind::text FROM amp_help_events WHERE learner_id=$1 ORDER BY 1",
            [child],
          )
        ).rows.map((r) => r.kind);
        assert.deepEqual(kinds, ["hint", "lesson", "print", "video"]);

        // A family-class child on the parent's sign-in: rostered, so its
        // answers always rolled up, and now its time and help do too.
        const family = await post(
          `/api/v1/learners/${classed}/activity`,
          parent,
          beat,
        );
        assert.equal(family.statusCode, 204, family.body);
        const [credited] = (
          await db.query(
            `SELECT (SELECT sum(active_ms)::int FROM amp_active_days WHERE learner_id=$1) AS ms,
               (SELECT sum(opened)::int FROM amp_help_days WHERE learner_id=$1) AS opened`,
            [classed],
          )
        ).rows;
        assert.deepEqual(credited, { ms: 19_000, opened: 3 });
      },
    );

    await t.test("weeks sum the same days", async () => {
      const theirs = await rollup(db, "amp_learner_weeks", student.learnerId);
      assert.equal(theirs.length, 2, "the answers' week and this week");
      assert.deepEqual(await rollup(db, "amp_learner_weeks", child), theirs);
    });

    await t.test("a mixed batch stores today's level for both", async () => {
      for (const [learner, token] of [
        [student.learnerId, studentToken],
        [child, parent],
      ] as const) {
        const served = await post(
          `/api/v1/learners/${learner}/batches`,
          token,
          {
            count: 1,
            figureCapabilities: ["scenes-v1"],
          },
        );
        assert.equal(served.statusCode, 200, served.body);
      }
      const today = (
        await db.query(
          "SELECT to_char(now() AT TIME ZONE 'America/New_York','YYYY-MM-DD') AS d",
        )
      ).rows[0].d as string;
      for (const learner of [student.learnerId, child]) {
        const days = await db.query(
          "SELECT day::text,policy_version FROM amp_level_days WHERE learner_id=$1",
          [learner],
        );
        assert.equal(days.rows.length, 1, learner);
        assert.equal(days.rows[0].day, today);
      }
    });

    await t.test("the learner heartbeat is the account's own", async () => {
      const body = { deltas: [{ surface: "practice", activeMs: 1_000 }] };
      const path = `/api/v1/learners/${child}/activity`;
      // Another parent, a student token and nobody are refused.
      const stranger = `amp|parent-${randomUUID()}`;
      await db.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','fixture')",
        [stranger],
      );
      assert.equal((await post(path, stranger, body)).statusCode, 404);
      assert.equal(
        (
          await post(
            `/api/v1/learners/${student.learnerId}/activity`,
            studentToken,
            body,
          )
        ).statusCode,
        403,
      );
      assert.equal(
        (await app.inject({ method: "POST", url: path, payload: body }))
          .statusCode,
        401,
      );
      // Its clock caps it as a student's is: straight after, only the slack.
      const credited = async () =>
        Number(
          (
            await db.query(
              "SELECT COALESCE(sum(active_ms),0) AS ms FROM amp_active_days WHERE learner_id=$1",
              [child],
            )
          ).rows[0].ms,
        );
      const before = await credited();
      await post(path, parent, {
        deltas: [{ surface: "practice", activeMs: 90_000 }],
      });
      const gained = (await credited()) - before;
      assert.ok(gained > 0 && gained <= 6_000, String(gained));
      // Shape is enforced.
      assert.equal(
        (await post(path, parent, { deltas: [{ surface: "tv", activeMs: 1 }] }))
          .statusCode,
        400,
      );
    });

    await t.test(
      "a learner's day follows its family, then its adult",
      async () => {
        const zone = async (learner: string) =>
          (await db.query("SELECT amp_learner_zone($1) AS z", [learner]))
            .rows[0].z as string;
        assert.equal(await zone(student.learnerId), "America/New_York");
        assert.equal(await zone(child), "America/New_York");
        // A child of an account with no family and no adult: the default.
        const account = `amp|parent-${randomUUID()}`;
        const loose = randomUUID();
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Fixture',2017)",
          [loose, account],
        );
        assert.equal(await zone(loose), "America/New_York");
        // The account's adult, practicing in Chicago, sets the child's day.
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name,adult,timezone) VALUES($1,$2,'Fixture',true,'America/Chicago')",
          [randomUUID(), account],
        );
        assert.equal(await zone(loose), "America/Chicago");
        // A family's own zone comes before the adult's.
        const familyOrg = randomUUID();
        await db.query(
          "INSERT INTO amp_orgs(id,kind,path,name,timezone) VALUES($1,'family',ARRAY[$1::uuid],'Fixture Family','America/Denver')",
          [familyOrg],
        );
        const familyClass = (
          (await schools.createClass(familyOrg, {
            name: "Fixture Family",
          })) as { id: string }
        ).id;
        await db.query(
          "INSERT INTO amp_families(account_id,org_id,class_id) VALUES($1,$2,$3)",
          [account, familyOrg, familyClass],
        );
        assert.equal(await zone(loose), "America/Denver");
        // A learner nobody knows still has a day.
        assert.equal(await zone(randomUUID()), "America/New_York");
      },
    );
  },
);

test(
  "migration 0144 backfills exactly the answers the old trigger skipped",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = await scopedSchema(t, "amp_equal_backfill");
    const db = new Pool({ connectionString: url, max: 1 });
    t.after(() => db.end());
    // Every migration before 0144, with receipts, as production has them.
    const directory = new URL("../migrations/", import.meta.url);
    await db.query(
      "CREATE TABLE amp_migrations(name text PRIMARY KEY, checksum text NOT NULL)",
    );
    for (const name of (await readdir(directory))
      .filter((name) => name.endsWith(".sql") && name < "0144")
      .sort()) {
      const sql = await readFile(new URL(name, directory), "utf8");
      await applyFixtureMigration(db, sql);
      await db.query("INSERT INTO amp_migrations VALUES($1,$2)", [
        name,
        createHash("sha256").update(sql).digest("hex"),
      ]);
    }
    const learner = async (account: string, adult = false) => {
      const id = randomUUID();
      await db.query(
        adult
          ? "INSERT INTO amp_learners(id,account_id,name,adult,timezone) VALUES($1,$2,'Fixture',true,'America/New_York')"
          : "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Fixture',2016)",
        [id, account],
      );
      return id;
    };
    const org = randomUUID();
    await db.query(
      "INSERT INTO amp_orgs(id,kind,path,name,timezone) VALUES($1,'school',ARRAY[$1::uuid],'Fixture School','America/New_York')",
      [org],
    );
    const rostered = async (id: string, createdAt: string) =>
      db.query(
        `INSERT INTO amp_people(id,tenant_id,given_name,handle,learner_id,timezone,created_at)
         VALUES($1::uuid,$2,'Fixture',$1::text,$3,'America/New_York',$4)`,
        [randomUUID(), org, id, createdAt],
      );
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString();

    // A school student: every answer rolled up as it came.
    const pupil = await learner(`school:${randomUUID()}`);
    await rostered(pupil, day(-10));
    // A child in no class: nothing rolled up.
    const child = await learner(`amp|parent-${randomUUID()}`);
    // A child who joined a family class later: only answers after joining.
    const joiner = await learner(`amp|parent-${randomUUID()}`);
    // An adult: everything rolled up.
    const adult = await learner(`amp|adult-${randomUUID()}`, true);
    // A trial that became an adult: only answers after the adoption.
    const adopted = await learner(`trial:${randomUUID()}`);
    // A child removed from another family's class: its roster row lets go of
    // it, which hides that its answers did roll up.
    const removed = await learner(`amp|parent-${randomUUID()}`);
    await rostered(removed, day(-10));
    // A deleted learner keeps no rollups.
    const gone = await learner(`amp|parent-${randomUUID()}`);

    for (const id of [pupil, child, joiner, adult, adopted, gone, removed])
      for (const a of ANSWERS) await answer(db, id, a, day(-3));
    await db.query(
      "UPDATE amp_people SET learner_id=NULL WHERE learner_id=$1",
      [removed],
    );
    await rostered(joiner, day(-2));
    await db.query(
      "UPDATE amp_learners SET adult=true,birth_year=NULL,account_id=$2 WHERE id=$1",
      [adopted, `amp|adopter-${randomUUID()}`],
    );
    await db.query(
      `INSERT INTO amp_trials(id,token_hash,learner_id,expires_at,adopted_at,adopted_by)
       VALUES($1,$2,$3,now()+interval '1 day',$4,'amp|adopter')`,
      [randomUUID(), "a".repeat(64), adopted, day(-2)],
    );
    for (const id of [pupil, joiner, adult, adopted, removed])
      await answer(db, id, ANSWERS[0]!, day(-1));
    await db.query("UPDATE amp_learners SET deleted_at=now() WHERE id=$1", [
      gone,
    ]);

    const attempts = async (id: string) =>
      Number(
        (
          await db.query(
            "SELECT COALESCE(sum(attempts),0) AS n FROM amp_skill_days WHERE learner_id=$1",
            [id],
          )
        ).rows[0].n,
      );
    const before = new Map<string, number>();
    for (const id of [pupil, child, joiner, adult, adopted, gone, removed])
      before.set(id, await attempts(id));
    assert.deepEqual(
      [pupil, child, joiner, adult, adopted, gone, removed].map((id) =>
        before.get(id),
      ),
      [5, 0, 1, 5, 1, 0, 4],
    );

    await db.query(
      "INSERT INTO amp_adult_activity(learner_id,seen_at) VALUES($1,'2026-03-10T15:00:00Z')",
      [adult],
    );
    await migrate(url);

    // Every live learner now holds every answer, once.
    assert.deepEqual(
      await Promise.all(
        [pupil, child, joiner, adult, adopted, gone, removed].map(attempts),
      ),
      // The removed child's day already counts its rolled-up answers: adding
      // them again would pass what is stored, so it is left as it was (its
      // one answer after leaving, on that same day, stays uncounted).
      [5, 4, 5, 5, 5, 0, 4],
    );
    // The backfilled rows are the rows the trigger writes for the same answers.
    const fresh = await learner(`amp|parent-${randomUUID()}`);
    for (const a of ANSWERS) await answer(db, fresh, a);
    assert.deepEqual(
      await rollup(db, "amp_skill_days", child),
      await rollup(db, "amp_skill_days", fresh),
    );
    // Weeks follow the day rows.
    const weekAttempts = async (id: string) =>
      Number(
        (
          await db.query(
            "SELECT COALESCE(sum(attempts),0) AS n FROM amp_learner_weeks WHERE learner_id=$1",
            [id],
          )
        ).rows[0].n,
      );
    for (const id of [pupil, child, joiner, adult, adopted])
      assert.equal(await weekAttempts(id), await attempts(id), id);
    // The adult's clock moved over to the one every learner has.
    assert.deepEqual(
      (
        await db.query(
          "SELECT seen_at FROM amp_learner_activity WHERE learner_id=$1",
          [adult],
        )
      ).rows.map((r) => (r.seen_at as Date).toISOString()),
      ["2026-03-10T15:00:00.000Z"],
    );
    await migrate(url);
    assert.equal(await attempts(child), 4, "a second run changes nothing");
  },
);
