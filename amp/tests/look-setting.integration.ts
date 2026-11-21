import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { schoolAccountId } from "../src/schools/principal.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

const YEAR_AHEAD = new Date(Date.now() + 365 * 86_400_000).toISOString();
const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};

/* The look setting, end to end: a parent's choice for a child, a teacher's
   for a class (with and without a lock above), the learner's own, and the
   look recorded on an answer. Every name is made up. */
test(
  "look: parent, teacher, lock, learner and the recorded answer",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_look_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href, { development: true });
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({
      repository: learning,
      authenticate,
      development: true,
    });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    const as = (token: string) => ({ authorization: `Bearer ${token}` });
    const get = (path: string, token: string) =>
      app.inject({ method: "GET", url: path, headers: as(token) });
    const post = (path: string, token: string, payload: object = {}) =>
      app.inject({ method: "POST", url: path, headers: as(token), payload });
    const stateOf = async (learnerId: string, token: string) => {
      const response = await get(
        `/api/v1/learners/${learnerId}/practice-state`,
        token,
      );
      assert.equal(response.statusCode, 200, response.body);
      return response.json() as {
        revision: number;
        look: string | null;
        effectiveLook: string;
        lookLocked: boolean;
      };
    };
    /** Sends a look change as the one holding `token`. */
    const choose = async (
      learnerId: string,
      token: string,
      look: string | null,
    ) =>
      post(`/api/v1/learners/${learnerId}/practice-state`, token, {
        kind: "look",
        look,
        revision: (await stateOf(learnerId, token)).revision,
        requestId: randomUUID(),
      });

    await t.test(
      "a parent chooses for their child and can clear it",
      async () => {
        const parent = `amp|parent-${randomUUID()}`;
        const child = await learning.create(parent, "Maya", 2016);
        const first = await stateOf(child.id, parent);
        assert.deepEqual(
          [first.look, first.effectiveLook, first.lookLocked],
          [null, "calm", false],
        );
        const bold = await choose(child.id, parent, "bold");
        assert.equal(bold.statusCode, 200, bold.body);
        // The answer to the change is the state, with the look that applies.
        assert.deepEqual(
          [bold.json().look, bold.json().effectiveLook, bold.json().lookLocked],
          ["bold", "bold", false],
        );
        assert.equal((await stateOf(child.id, parent)).effectiveLook, "bold");
        const cleared = await choose(child.id, parent, null);
        assert.equal(cleared.statusCode, 200, cleared.body);
        assert.equal((await stateOf(child.id, parent)).effectiveLook, "calm");
        // Another account can't reach it.
        const stranger = `amp|stranger-${randomUUID()}`;
        assert.ok(
          [403, 404].includes(
            (await get(`/api/v1/learners/${child.id}/practice-state`, stranger))
              .statusCode,
          ),
        );
        assert.equal(
          (
            await post(`/api/v1/learners/${child.id}/practice-state`, parent, {
              kind: "look",
              look: "loud",
              revision: 0,
              requestId: randomUUID(),
            })
          ).statusCode,
          400,
        );
      },
    );

    const district = await schools.createOrg(
      {
        kind: "district",
        name: "Riverbend District",
        timezone: "America/New_York",
      },
      agreement,
    );
    const school = await schools.createOrg({
      kind: "school",
      name: "Alder Street School",
      parentId: district.id,
    });
    await schools.issueLicense({
      orgId: district.id,
      seats: 50,
      endsAt: YEAR_AHEAD,
    });
    const districtAdmin = `amp|district-${randomUUID()}`;
    await schools.addStaff({
      orgId: district.id,
      role: "admin",
      givenName: "Dana",
      accountId: districtAdmin,
    });
    const period = await schools.createClass(school.id, {
      name: "Grade 5 Math",
    });
    const second = await schools.createClass(school.id, {
      name: "Math Support",
    });
    const teacher = `amp|teacher-${randomUUID()}`;
    await schools.addStaff({
      orgId: school.id,
      role: "teacher",
      givenName: "Grace",
      accountId: teacher,
      classId: period.id,
    });
    const secondTeacher = `amp|teacher-${randomUUID()}`;
    await schools.addStaff({
      orgId: school.id,
      role: "teacher",
      givenName: "Oren",
      accountId: secondTeacher,
      classId: second.id,
    });
    const enroll = async (classId: string, givenName: string) => {
      const student = await schools.provisionStudent(school.id, {
        givenName,
        familyName: "Fixture",
        gradeLevel: 5,
        classId,
      });
      const { token } = await schools.issueStudentSession({
        personId: student.personId,
        mode: "shared",
      });
      return { ...student, token };
    };
    const ada = await enroll(period.id, "Ada");
    const bo = await enroll(period.id, "Bo");
    const both = await enroll(period.id, "Cy");
    await schools.enroll?.call;
    const writeClass = (classId: string, token: string, look: string | null) =>
      post(`/api/v1/school/classes/${classId}/experience`, token, {
        values: { look },
      });
    const writeOrg = (orgId: string, token: string, body: object) =>
      post(`/api/v1/school/orgs/${orgId}/experience`, token, body);

    await t.test(
      "a teacher chooses for the class; a student can still choose their own",
      async () => {
        const read = await get(
          `/api/v1/school/classes/${period.id}/experience`,
          teacher,
        );
        assert.equal(read.json().settings.look.value, "calm");
        const set = await writeClass(period.id, teacher, "bold");
        assert.equal(set.statusCode, 200, set.body);
        assert.equal(set.json().settings.look.value, "bold");
        assert.equal(set.json().settings.look.own, true);
        assert.equal(set.json().settings.look.lockedBy, null);
        const seen = await stateOf(ada.learnerId, ada.token);
        assert.deepEqual(
          [seen.look, seen.effectiveLook, seen.lookLocked],
          [null, "bold", false],
        );
        // Their own choice beats the class's, as the learner.
        const own = await choose(ada.learnerId, ada.token, "calm");
        assert.equal(own.statusCode, 200, own.body);
        assert.equal(
          (await stateOf(ada.learnerId, ada.token)).effectiveLook,
          "calm",
        );
        // Bo kept no choice and follows the class.
        assert.equal(
          (await stateOf(bo.learnerId, bo.token)).effectiveLook,
          "bold",
        );
        // A student can't write the class's setting.
        const refused = await writeClass(period.id, ada.token, "calm");
        assert.notEqual(refused.statusCode, 200);
      },
    );

    await t.test(
      "a lock above rules: the class value is ignored, no one below can change it",
      async () => {
        const locked = await writeOrg(school.id, districtAdmin, {
          values: { look: "calm" },
          locks: { look: true },
        });
        assert.equal(locked.statusCode, 200, locked.body);
        const below = await get(
          `/api/v1/school/classes/${period.id}/experience`,
          teacher,
        );
        assert.equal(below.json().settings.look.value, "calm");
        assert.equal(
          below.json().settings.look.lockedBy.name,
          "Alder Street School",
        );
        const refused = await writeClass(period.id, teacher, "bold");
        assert.equal(refused.statusCode, 409);
        assert.deepEqual(refused.json(), { error: "setting_locked" });
        // Ada chose calm, Bo follows the class's bold: the lock sets both to calm.
        for (const student of [ada, bo]) {
          const state = await stateOf(student.learnerId, student.token);
          assert.deepEqual(
            [state.effectiveLook, state.lookLocked],
            ["calm", true],
          );
        }
        const blocked = await choose(bo.learnerId, bo.token, "bold");
        assert.equal(blocked.statusCode, 409, blocked.body);
        // Unlocked, the class's own value (bold) and the students' choices are back.
        const open = await writeOrg(school.id, districtAdmin, {
          locks: { look: false },
        });
        assert.equal(open.statusCode, 200, open.body);
        const after = await stateOf(bo.learnerId, bo.token);
        assert.deepEqual(
          [after.effectiveLook, after.lookLocked],
          ["bold", false],
        );
        assert.equal(
          (await choose(bo.learnerId, bo.token, "bold")).statusCode,
          200,
        );
      },
    );

    await t.test(
      "two classes that disagree resolve to calm; locked, a locked one wins",
      async () => {
        // Cy is in the first class (bold, from above) and a second one (calm).
        await db.query(
          `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
         SELECT $4,$1,$2,'student',begin_on FROM amp_enrollments WHERE class_id=$3 AND person_id=$2`,
          [second.id, both.personId, period.id, randomUUID()],
        );
        await writeClass(second.id, secondTeacher, "calm");
        const state = await stateOf(both.learnerId, both.token);
        assert.deepEqual(
          [state.effectiveLook, state.lookLocked],
          ["calm", false],
        );
        // A lock on one class's value (set at the class through its own org
        // scope) is the only one: it wins over the other's.
        await db.query(
          `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values",locked)
         VALUES('class',$1,'{"look":"bold"}','{look}')
         ON CONFLICT(scope_kind,scope_id) DO UPDATE SET "values"=EXCLUDED."values",locked=EXCLUDED.locked`,
          [second.id],
        );
        const wins = await stateOf(both.learnerId, both.token);
        assert.deepEqual([wins.effectiveLook, wins.lookLocked], ["bold", true]);
      },
    );

    await t.test(
      "an attempt with and without look saves; the stored outcome carries it",
      async () => {
        const path = `/api/v1/learners/${ada.learnerId}`;
        const answer = async (extra: object) => {
          const batch = await post(`${path}/batches`, ada.token, {
            templateId: "add-within-20",
            count: 1,
            figureCapabilities: ["scenes-v1"],
          });
          assert.equal(batch.statusCode, 200, batch.body);
          const problem = batch.json().problems[0];
          const stored = await learning.transaction(
            schoolAccountId(ada.personId),
            ada.learnerId,
            (tx) => tx.problem(problem.id),
          );
          const requestId = randomUUID();
          const attempt = await post(`${path}/attempts`, ada.token, {
            problemId: problem.id,
            requestId,
            response: stored!.answer,
            ...extra,
          });
          assert.equal(attempt.statusCode, 200, attempt.body);
          const row = await db.query(
            "SELECT outcome FROM amp_attempts WHERE request_id=$1",
            [requestId],
          );
          return row.rows[0].outcome as Record<string, unknown>;
        };
        assert.equal(
          "look" in (await answer({})),
          false,
          "an old client omits it",
        );
        assert.equal((await answer({ look: "calm" })).look, "calm");
        assert.equal((await answer({ look: "bold" })).look, "bold");
        assert.equal(
          (await answer({ look: "bold-reduced" })).look,
          "bold-reduced",
        );
        const refused = await post(`${path}/attempts`, ada.token, {
          problemId: "x",
          requestId: randomUUID(),
          response: "1",
          look: "neon",
        });
        assert.equal(refused.statusCode, 400);
      },
    );

    await t.test(
      "practice-state carries points: every right answer without help",
      async () => {
        const path = `/api/v1/learners/${ada.learnerId}`;
        const points = async () =>
          ((await stateOf(ada.learnerId, ada.token)) as { points?: number })
            .points;
        const answer = async (right: boolean) => {
          const batch = await post(`${path}/batches`, ada.token, {
            templateId: "add-within-20",
            count: 1,
            figureCapabilities: ["scenes-v1"],
          });
          const problem = batch.json().problems[0];
          const stored = await learning.transaction(
            schoolAccountId(ada.personId),
            ada.learnerId,
            (tx) => tx.problem(problem.id),
          );
          const attempt = await post(`${path}/attempts`, ada.token, {
            problemId: problem.id,
            requestId: randomUUID(),
            response: right ? stored!.answer : "999",
          });
          assert.equal(attempt.statusCode, 200, attempt.body);
          assert.equal(attempt.json().correct, right);
        };
        // The four right answers above.
        const before = await points();
        assert.equal(before, 4);
        await answer(true);
        assert.equal(await points(), before + 1);
        await answer(false);
        assert.equal(await points(), before + 1, "a miss takes nothing");
        // The look change's answer carries the same total.
        const changed = await post(`${path}/practice-state`, ada.token, {
          kind: "look",
          look: "bold",
          revision: (await stateOf(ada.learnerId, ada.token)).revision,
          requestId: randomUUID(),
        });
        assert.equal(changed.statusCode, 200, changed.body);
        assert.equal(changed.json().points, before + 1);
      },
    );
  },
);
