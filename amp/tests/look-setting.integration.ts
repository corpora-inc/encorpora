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
        lookHue: number | null;
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
      "nobody has chosen: a child through grade 5 starts in Colorful, an older one and an adult in Calm",
      async () => {
        const parent = `amp|parent-${randomUUID()}`;
        const year = new Date().getUTCFullYear();
        const young = await learning.create(parent, "Pip", year - 7);
        const older = await learning.create(parent, "Theo", year - 15);
        const youngState = await stateOf(young.id, parent);
        assert.deepEqual(
          [youngState.look, youngState.effectiveLook, youngState.lookLocked],
          [null, "bold", false],
        );
        assert.equal((await stateOf(older.id, parent)).effectiveLook, "calm");
        // The start is not a choice: Calm is one change away and stays.
        const calm = await choose(young.id, parent, "calm");
        assert.equal(calm.statusCode, 200, calm.body);
        assert.equal((await stateOf(young.id, parent)).effectiveLook, "calm");
      },
    );

    await t.test(
      "a parent chooses for their child and can clear it",
      async () => {
        const parent = `amp|parent-${randomUUID()}`;
        // In grade 6 or later, so she starts in Calm (the youngest start in
        // Colorful: the case below).
        const child = await learning.create(parent, "Maya", 2012);
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

    const classView = async (classId: string, token: string) =>
      (
        await get(`/api/v1/school/classes/${classId}/experience`, token)
      ).json() as {
        lockable: string[];
        canLock: boolean;
        settings: {
          look: {
            value: string;
            own: boolean;
            lockedBy: { name: string } | null;
          };
        };
      };
    const OFF = { values: { look: "calm" }, locks: { look: true } };
    const ON = { values: { look: null }, locks: { look: false } };
    const sendClass = (classId: string, token: string, body: object) =>
      post(`/api/v1/school/classes/${classId}/experience`, token, body);
    const stored = async (kind: string, scope: string) =>
      (
        await db.query(
          `SELECT "values"->>'look' AS look, 'look'=ANY(locked) AS held
           FROM amp_scope_settings WHERE scope_kind=$1 AND scope_id=$2`,
          [kind, scope],
        )
      ).rows[0] as { look: string | null; held: boolean } | undefined;

    await t.test(
      "Colorful is allowed unless an adult turns it off: the look is the student's own, and a class keeps nothing else",
      async () => {
        assert.equal(
          (await classView(period.id, teacher)).settings.look.lockedBy,
          null,
        );
        const first = await stateOf(bo.learnerId, bo.token);
        assert.deepEqual([first.look, first.lookLocked], [null, false]);
        // An adult no longer chooses a starting look for anyone else: a
        // look sent for the class, with or without a hold, is not kept.
        for (const body of [
          { values: { look: "bold" } },
          { values: { look: "bold" }, locks: { look: true } },
          { values: { look: "calm" } },
          { locks: { look: false } },
        ]) {
          const sent = await sendClass(period.id, teacher, body);
          assert.equal(sent.statusCode, 200, sent.body);
          assert.deepEqual(
            [sent.json().settings.look.own, sent.json().settings.look.lockedBy],
            [false, null],
            JSON.stringify(body),
          );
          const kept = await stored("class", period.id);
          assert.deepEqual(
            [kept?.look ?? null, kept?.held ?? false],
            [null, false],
          );
          assert.deepEqual(await stateOf(bo.learnerId, bo.token), first);
        }
        // Ada chooses, either way, as the learner.
        for (const look of ["bold", "calm", "bold"]) {
          const own = await choose(ada.learnerId, ada.token, look);
          assert.equal(own.statusCode, 200, own.body);
          assert.equal(
            (await stateOf(ada.learnerId, ada.token)).effectiveLook,
            look,
          );
        }
        // A student can't write the class's setting.
        const refused = await writeClass(period.id, ada.token, "calm");
        assert.notEqual(refused.statusCode, 200);
      },
    );

    await t.test(
      "off at the school: every class below is off and says who set it; nobody below turns it on; students are in Calm and can't set Colorful",
      async () => {
        const off = await writeOrg(school.id, districtAdmin, OFF);
        assert.equal(off.statusCode, 200, off.body);
        assert.deepEqual(await stored("org", school.id), {
          look: "calm",
          held: true,
        });
        const below = await classView(period.id, teacher);
        assert.equal(below.settings.look.lockedBy?.name, "Alder Street School");
        for (const body of [ON, OFF, { values: { look: "bold" } }]) {
          const refused = await sendClass(period.id, teacher, body);
          assert.equal(refused.statusCode, 409);
          assert.deepEqual(refused.json(), { error: "setting_locked" });
        }
        // Ada had chosen Colorful, Bo nothing: both are in Calm.
        for (const student of [ada, bo]) {
          const state = await stateOf(student.learnerId, student.token);
          assert.deepEqual(
            [
              state.effectiveLook,
              state.lookLocked,
              (state as { lookLockedBy?: string }).lookLockedBy,
            ],
            ["calm", true, "class"],
          );
          const blocked = await choose(
            student.learnerId,
            student.token,
            "bold",
          );
          assert.equal(blocked.statusCode, 409, blocked.body);
        }
        // Ada's own choice was kept, and is hers again when it is allowed.
        assert.equal((await stateOf(ada.learnerId, ada.token)).look, "bold");
        const on = await writeOrg(school.id, districtAdmin, ON);
        assert.equal(on.statusCode, 200, on.body);
        const kept = await stored("org", school.id);
        assert.deepEqual(
          [kept?.look ?? null, kept?.held ?? false],
          [null, false],
        );
        assert.deepEqual(
          [
            (await stateOf(ada.learnerId, ada.token)).effectiveLook,
            (await stateOf(ada.learnerId, ada.token)).lookLocked,
          ],
          ["bold", false],
        );
        assert.equal(
          (await choose(bo.learnerId, bo.token, "bold")).statusCode,
          200,
        );
      },
    );

    await t.test("a student in two classes: off in either is off", async () => {
      await db.query(
        `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
         SELECT $4,$1,$2,'student',begin_on FROM amp_enrollments WHERE class_id=$3 AND person_id=$2`,
        [second.id, both.personId, period.id, randomUUID()],
      );
      assert.equal(
        (await choose(both.learnerId, both.token, "bold")).statusCode,
        200,
      );
      const off = await sendClass(second.id, secondTeacher, OFF);
      assert.equal(off.statusCode, 200, off.body);
      const state = await stateOf(both.learnerId, both.token);
      assert.deepEqual([state.effectiveLook, state.lookLocked], ["calm", true]);
      // The other class's students are untouched.
      assert.equal((await stateOf(bo.learnerId, bo.token)).lookLocked, false);
      assert.equal(
        (await sendClass(second.id, secondTeacher, ON)).statusCode,
        200,
      );
      assert.deepEqual(
        [
          (await stateOf(both.learnerId, both.token)).effectiveLook,
          (await stateOf(both.learnerId, both.token)).lookLocked,
        ],
        ["bold", false],
      );
    });

    await t.test(
      "a teacher turns it off for the class; stored before the switch, a hold beside Colorful holds nothing, above or here",
      async () => {
        const read = await classView(period.id, teacher);
        assert.deepEqual(read.lockable, ["look"]);
        assert.equal(read.canLock, false);
        const off = await sendClass(period.id, teacher, OFF);
        assert.equal(off.statusCode, 200, off.body);
        assert.equal(off.json().settings.look.lockedBy.name, "Grade 5 Math");
        // A teacher holds nothing but this.
        const other = await sendClass(period.id, teacher, {
          locks: { levels: true },
        });
        assert.equal(other.statusCode, 400, other.body);
        for (const student of [ada, bo]) {
          const state = await stateOf(student.learnerId, student.token);
          assert.deepEqual(
            [
              state.effectiveLook,
              state.lookLocked,
              (state as { lookLockedBy?: string }).lookLockedBy,
            ],
            ["calm", true, "class"],
          );
          assert.equal(
            (await choose(student.learnerId, student.token, "bold")).statusCode,
            409,
          );
        }
        // A school's Colorful with a lock, as the earlier lock stored it:
        // it holds nothing. The class is still off by its own switch, and
        // its teacher is not refused when turning it on.
        const legacy = (kind: string, scope: string) =>
          db.query(
            `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values",locked)
             VALUES($1,$2,'{"look":"bold"}','{look}')
             ON CONFLICT(scope_kind,scope_id) DO UPDATE SET "values"=EXCLUDED."values",locked=EXCLUDED.locked`,
            [kind, scope],
          );
        await legacy("org", school.id);
        const under = await classView(period.id, teacher);
        assert.equal(under.settings.look.lockedBy?.name, "Grade 5 Math");
        assert.equal(
          (await writeOrg(school.id, districtAdmin, {})).statusCode,
          200,
        );
        const on = await sendClass(period.id, teacher, ON);
        assert.equal(on.statusCode, 200, on.body);
        assert.equal(on.json().settings.look.lockedBy, null);
        assert.deepEqual(
          [
            (await stateOf(ada.learnerId, ada.token)).effectiveLook,
            (await stateOf(ada.learnerId, ada.token)).lookLocked,
          ],
          ["bold", false],
        );
        // The same pair stored at the class itself: allowed, and the
        // student still chooses.
        await legacy("class", period.id);
        assert.equal(
          (await classView(period.id, teacher)).settings.look.lockedBy,
          null,
        );
        assert.equal((await stateOf(bo.learnerId, bo.token)).lookLocked, false);
        assert.equal(
          (await choose(bo.learnerId, bo.token, "calm")).statusCode,
          200,
        );
        assert.equal(
          (await choose(bo.learnerId, bo.token, "bold")).statusCode,
          200,
        );
        // Calm that nobody holds (a class's old starting look): allowed.
        await db.query(
          `UPDATE amp_scope_settings SET "values"='{"look":"calm"}',locked='{}' WHERE scope_kind='class' AND scope_id=$1`,
          [period.id],
        );
        assert.equal(
          (await stateOf(bo.learnerId, bo.token)).effectiveLook,
          "bold",
        );
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
        // Points come from the answers, whatever the look: with Colorful
        // off (no chip, no moments) a right answer still counts.
        assert.equal(
          (await sendClass(period.id, teacher, OFF)).statusCode,
          200,
        );
        assert.equal(
          (await stateOf(ada.learnerId, ada.token)).lookLocked,
          true,
        );
        await answer(true);
        assert.equal(await points(), before + 2, "Colorful off takes no point");
        assert.equal((await sendClass(period.id, teacher, ON)).statusCode, 200);
        // The look change's answer carries the same total.
        const changed = await post(`${path}/practice-state`, ada.token, {
          kind: "look",
          look: "bold",
          revision: (await stateOf(ada.learnerId, ada.token)).revision,
          requestId: randomUUID(),
        });
        assert.equal(changed.statusCode, 200, changed.body);
        assert.equal(changed.json().points, before + 2);
        // The learner keeps one color, then lets it go: their own choice,
        // from their own sign-in.
        assert.equal(changed.json().lookHue, null);
        const keep = async (hue: unknown) =>
          post(`${path}/practice-state`, ada.token, {
            kind: "lookHue",
            hue,
            revision: (await stateOf(ada.learnerId, ada.token)).revision,
            requestId: randomUUID(),
          });
        const kept = await keep(202);
        assert.equal(kept.statusCode, 200, kept.body);
        assert.equal(kept.json().lookHue, 202);
        assert.equal(kept.json().effectiveLook, "bold");
        assert.equal(
          (await stateOf(ada.learnerId, ada.token)).lookHue,
          202,
          "it is stored, so it follows them to any device",
        );
        for (const bad of [360, -1, 12.5, "blue"])
          assert.equal((await keep(bad)).statusCode, 400, String(bad));
        const freed = await keep(null);
        assert.equal(freed.statusCode, 200, freed.body);
        assert.equal(freed.json().lookHue, null);
      },
    );
  },
);
