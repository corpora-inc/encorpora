import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { purgeInactiveLearners } from "../src/privacy/retention.js";
import { RETENTION } from "../src/privacy/retention-periods.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { learningConsentActive } from "../src/server/account-access.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { schoolDay } from "./helpers/school-day.js";

/* Adult practice (docs/families.md, step 2): every teaching adult practices
   free on their own learner, which needs no parental consent and never counts
   as a student. Every name here is made up. */
const DAY = 86_400_000;
const daysFromNow = (n: number) => schoolDay(n);

test(
  "adult practice: who qualifies, consent, access and the school's records",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_adult_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
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
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    const as = (account: string) => ({ authorization: `Bearer ${account}` });
    const get = (path: string, account: string) =>
      app.inject({ method: "GET", url: path, headers: as(account) });
    const post = (path: string, account: string, payload: object = {}) =>
      app.inject({ method: "POST", url: path, headers: as(account), payload });
    const me = async (account: string) => {
      const response = await get("/api/v1/me", account);
      assert.equal(response.statusCode, 200, response.body);
      return response.json();
    };
    const start = (account: string, from = "algebra-1") =>
      post("/api/v1/me/practice", account, {
        start: from,
        timezone: "America/Chicago",
      });
    const batch = (account: string, learnerId: string) =>
      post(`/api/v1/learners/${learnerId}/batches`, account, { count: 1 });
    const grant = async (learnerId: string) =>
      (
        await db.query(
          "SELECT ends_at,status,offline_revision FROM amp_grants WHERE id=$1",
          [`adult:${learnerId}`],
        )
      ).rows[0];
    const user = async (name: string) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,$2,$3,true,now(),now())`,
        [id, name, `${id}@adult.example`],
      );
      return `amp|${id}`;
    };
    const consent = (account: string) =>
      db.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'policy','verified','fixture-proof')",
        [account],
      );
    /** A child of `account` with paid access until `ends`. */
    const paidChild = async (account: string, ends: Date) => {
      const child = await learning.create(account, "Rowan Fixture", 2016);
      await db.query(
        `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
         VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',$3)`,
        [`fixture:${child.id}`, child.id, ends],
      );
      return child.id;
    };

    // A school with a license through a known date, one class, a teacher who
    // teaches it and a student on a seat.
    const licenseEnds = new Date(Date.now() + 200 * DAY);
    const org = (await schoolAdmin(schools, "create-org", {
      kind: "school",
      name: "Juniper Fixture School",
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
      endsAt: licenseEnds.toISOString(),
    });
    const year = randomUUID();
    await db.query(
      `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on)
       VALUES($1,$2,NULL,'year','This year',$3,$4)`,
      [year, org.id, daysFromNow(-60), daysFromNow(200)],
    );
    const klass = (await schools.createClass(org.id, {
      name: "Grade 6 Math",
      courseBands: ["6"],
      gradingKind: "year",
      sessionId: year,
    })) as { id: string };
    const teacher = await user("Dana Fixture");
    await schools.addStaff({
      orgId: org.id,
      role: "teacher",
      givenName: "Dana",
      familyName: "Fixture",
      accountId: teacher,
      classId: klass.id,
    });
    const pupil = await schools.provisionStudent(org.id, {
      givenName: "Pia",
      familyName: "Fixture",
      gradeLevel: 6,
      classId: klass.id,
    });
    let adultId = "";

    await t.test(
      "a teacher at a licensed school starts practice and gets access",
      async () => {
        const before = await me(teacher);
        assert.deepEqual(before.adultPractice, {
          eligible: true,
          learner: null,
        });
        assert.deepEqual(before.learners, []);
        assert.equal(before.consent.status, "none");
        const started = await start(teacher);
        assert.equal(started.statusCode, 201, started.body);
        adultId = started.json().learnerId;
        // Starting again keeps the learner they have.
        assert.equal(
          (await start(teacher, "counting")).json().learnerId,
          adultId,
        );
        const after = await me(teacher);
        assert.deepEqual(after.adultPractice, {
          eligible: true,
          learner: { id: adultId, name: "Dana Fixture", active: true },
        });
        assert.deepEqual(after.learners, [], "never among the family's");
        const own = after.family.learners.find(
          (l: { id: string }) => l.id === adultId,
        );
        assert.equal(own.adult, true);
        assert.equal(own.canPractice, true);
        assert.equal(own.birthYear, null);
        const row = await grant(adultId);
        assert.equal(row.status, "active");
        assert.equal(row.ends_at.getTime(), licenseEnds.getTime());
        // Reading /me again changes nothing.
        await me(teacher);
        assert.equal(
          (await grant(adultId)).offline_revision,
          row.offline_revision,
        );
        // Where they chose to begin is their starting level.
        const frontier = await get(
          `/api/v1/learners/${adultId}/frontier`,
          teacher,
        );
        assert.equal(frontier.statusCode, 200, frontier.body);
        assert.equal(frontier.json().expected, 9);
        // The normal practice loop: a problem, an answer.
        const served = await batch(teacher, adultId);
        assert.equal(served.statusCode, 200, served.body);
        const problem = served.json().problems[0];
        const answered = await post(
          `/api/v1/learners/${adultId}/attempts`,
          teacher,
          {
            problemId: problem.id,
            requestId: randomUUID(),
            response: "1",
          },
        );
        assert.equal(answered.statusCode, 200, answered.body);
        // Their facts roll up like a student's, in their own time zone.
        const days = await db.query(
          "SELECT attempts FROM amp_skill_days WHERE learner_id=$1",
          [adultId],
        );
        assert.equal(days.rows[0]?.attempts, 1);
        const level = await db.query(
          "SELECT day::text FROM amp_level_days WHERE learner_id=$1",
          [adultId],
        );
        assert.equal(level.rowCount, 1);
        const heartbeat = await post("/api/v1/me/practice/activity", teacher, {
          deltas: [
            { surface: "practice", problemId: problem.id, activeMs: 90_000 },
          ],
        });
        assert.equal(heartbeat.statusCode, 204, heartbeat.body);
        const active = await db.query(
          "SELECT sum(active_ms)::int AS ms FROM amp_active_days WHERE learner_id=$1",
          [adultId],
        );
        assert.ok(active.rows[0].ms > 0 && active.rows[0].ms <= 90_000);
        // An adult starts again from where they chose to begin.
        const reset = await post(
          `/api/v1/learners/${adultId}/practice-state`,
          teacher,
          { requestId: randomUUID(), revision: 0, kind: "reset" },
        );
        assert.equal(reset.statusCode, 200, reset.body);
        // Their home is their own record.
        const record = await get("/api/v1/me/practice", teacher);
        assert.equal(record.statusCode, 200, record.body);
        const body = record.json();
        assert.equal(body.learner.id, adultId);
        assert.equal(body.learner.start, "algebra-1");
        assert.equal(body.learner.active, true);
        assert.ok(body.record.level, "levels from the stored day");
        assert.equal(body.record.weeks.length, 12);
        assert.equal(body.record.work.length, 1);
        assert.ok(body.time.days.length >= 1);
      },
    );

    await t.test(
      "an adult learner never appears in grades, seats, rosters or exports",
      async () => {
        const CLASS = `/api/v1/school/classes/${klass.id}`;
        const seats = await db.query(
          "SELECT person_id FROM amp_seats WHERE released_at IS NULL",
        );
        assert.deepEqual(
          seats.rows.map((r) => r.person_id),
          [pupil.personId],
        );
        const book = await get(`${CLASS}/gradebook`, teacher);
        assert.equal(book.statusCode, 200, book.body);
        assert.deepEqual(
          book.json().students.map((s: { id: string }) => s.id),
          [pupil.personId],
        );
        const roster = await get(`${CLASS}/roster`, teacher);
        assert.equal(roster.statusCode, 200, roster.body);
        assert.ok(!roster.body.includes(adultId));
        assert.ok(!roster.body.includes("Dana"));
        const term = book.json().term.id;
        for (const path of [
          `${CLASS}/exports/gradebook.csv?term=${term}`,
          `${CLASS}/exports/time.csv`,
          `${CLASS}/exports/oneroster.zip?term=${term}`,
          `${CLASS}/today`,
          `${CLASS}/time`,
        ]) {
          const response = await get(path, teacher);
          assert.equal(response.statusCode, 200, `${path}: ${response.body}`);
          assert.ok(!response.body.includes(adultId), path);
        }
        const time = (await get(`${CLASS}/time`, teacher)).json();
        assert.deepEqual(
          time.students.map((s: { id: string }) => s.id),
          [pupil.personId],
        );
      },
    );

    await t.test("access ends when the teaching role ends", async () => {
      await db.query(
        "UPDATE amp_learners SET free_online_used=100 WHERE id=$1",
        [adultId],
      );
      const role = await db.query(
        `UPDATE amp_org_roles r SET end_on=$2 FROM amp_people p
         WHERE p.id=r.person_id AND p.account_id=$1 AND r.role='teacher' RETURNING r.id`,
        [teacher, daysFromNow(0)],
      );
      assert.equal(role.rowCount, 1);
      const after = await me(teacher);
      assert.deepEqual(after.adultPractice, {
        eligible: false,
        learner: { id: adultId, name: "Dana Fixture", active: false },
      });
      assert.ok((await grant(adultId)).ends_at.getTime() <= Date.now());
      assert.equal((await batch(teacher, adultId)).statusCode, 402);
      // Their record stays theirs to read.
      assert.equal((await get("/api/v1/me/practice", teacher)).statusCode, 200);
      // A role that ends on a later date carries access to that day.
      await db.query(
        `UPDATE amp_org_roles r SET end_on=$2 FROM amp_people p
         WHERE p.id=r.person_id AND p.account_id=$1 AND r.role='teacher'`,
        [teacher, daysFromNow(10)],
      );
      assert.equal((await me(teacher)).adultPractice.learner.active, true);
      const ends = (await grant(adultId)).ends_at.getTime();
      assert.ok(ends < licenseEnds.getTime());
      assert.ok(Math.abs(ends - (Date.now() + 10 * DAY)) < 1.1 * DAY);
      assert.equal((await batch(teacher, adultId)).statusCode, 200);
    });

    await t.test("access ends when the license ends", async () => {
      await db.query(
        "UPDATE amp_school_licenses SET status='ended' WHERE org_id=$1",
        [org.id],
      );
      assert.equal((await me(teacher)).adultPractice.eligible, false);
      assert.equal((await batch(teacher, adultId)).statusCode, 402);
      await db.query(
        "UPDATE amp_school_licenses SET status='active' WHERE org_id=$1",
        [org.id],
      );
      assert.equal((await me(teacher)).adultPractice.eligible, true);
      assert.equal((await batch(teacher, adultId)).statusCode, 200);
    });

    await t.test(
      "a paid child supplies adult access; other adults start with their free allowance",
      async () => {
        const paid = await user("Avery Fixture");
        await consent(paid);
        const childEnds = new Date(Date.now() + 40 * DAY);
        const child = await paidChild(paid, childEnds);
        assert.deepEqual((await me(paid)).adultPractice, {
          eligible: true,
          learner: null,
        });
        const started = await start(paid, "precalculus");
        assert.equal(started.statusCode, 201, started.body);
        const own = started.json().learnerId;
        assert.equal((await grant(own)).ends_at.getTime(), childEnds.getTime());
        const after = await me(paid);
        assert.deepEqual(
          after.learners.map((l: { id: string }) => l.id),
          [child],
          "the family's learners are the children",
        );
        assert.equal(after.next, "practice");
        assert.equal((await batch(paid, own)).statusCode, 200);
        // The child's access ends, and so does the parent's.
        await db.query(
          "UPDATE amp_learners SET free_online_used=100 WHERE id=$1",
          [own],
        );
        await db.query(
          "UPDATE amp_grants SET status='revoked' WHERE learner_id=$1",
          [child],
        );
        assert.equal((await me(paid)).adultPractice.learner.active, false);
        assert.equal((await batch(paid, own)).statusCode, 402);

        const unpaid = await user("Morgan Fixture");
        await consent(unpaid);
        await learning.create(unpaid, "Sky Fixture", 2017);
        assert.deepEqual((await me(unpaid)).adultPractice, {
          eligible: true,
          learner: null,
        });
        const free = await start(unpaid);
        assert.equal(free.statusCode, 201);
        assert.equal(
          await grant(free.json().learnerId),
          undefined,
          "free practice does not fabricate a grant",
        );
        const nobody = await user("Quinn Fixture");
        assert.deepEqual((await me(nobody)).adultPractice, {
          eligible: true,
          learner: null,
        });
        assert.equal((await start(nobody)).statusCode, 201);
        assert.equal(
          (
            await db.query(
              "SELECT count(*)::int AS n FROM amp_learners WHERE account_id=ANY($1) AND adult",
              [[unpaid, nobody]],
            )
          ).rows[0].n,
          2,
        );
      },
    );

    await t.test(
      "an adult learner needs no parental consent; child learners keep today's rules",
      async () => {
        // The teacher has no parental consent. Their own learner practices…
        const client = await db.connect();
        try {
          assert.equal(await learningConsentActive(client, teacher), false);
          assert.equal(
            await learningConsentActive(client, teacher, false, adultId),
            true,
          );
        } finally {
          client.release();
        }
        assert.equal((await batch(teacher, adultId)).statusCode, 200);
        // …but a child learner of theirs is held to the account's consent,
        // even with access.
        const child = randomUUID();
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Ash Fixture',2015)",
          [child, teacher],
        );
        await db.query(
          `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
           VALUES($1,$2,'pilot',$1,'active',now(),now()+interval '30 days')`,
          [`fixture:${child}`, child],
        );
        assert.equal((await batch(teacher, child)).statusCode, 403);
        assert.equal(
          (
            await post("/api/v1/learners", teacher, {
              name: "New child",
              birthYear: 2016,
            })
          ).statusCode,
          403,
        );
        const view = (await me(teacher)).family.learners.find(
          (l: { id: string }) => l.id === child,
        );
        assert.equal(view.canPractice, false);
        assert.equal(view.adult, undefined);
        // Withdrawing a family's consent pauses the children, not the adult.
        const parent = await user("Jordan Fixture");
        await consent(parent);
        const kid = await paidChild(parent, new Date(Date.now() + 60 * DAY));
        const own = (await start(parent, "geometry")).json().learnerId;
        assert.equal(
          (await post("/api/v1/family/consent/withdraw", parent)).statusCode,
          200,
        );
        assert.equal((await batch(parent, kid)).statusCode, 403);
        assert.equal((await batch(parent, own)).statusCode, 200);
        // Someone else's adult learner is not theirs.
        assert.equal((await batch(parent, adultId)).statusCode, 403);
        // A birth year never attaches to an adult learner.
        assert.equal(
          (
            await post(`/api/v1/learners/${own}/birth-year`, parent, {
              birthYear: 1990,
            })
          ).statusCode,
          409,
        );
        await assert.rejects(
          db.query("UPDATE amp_learners SET birth_year=1990 WHERE id=$1", [
            own,
          ]),
          /amp_learners_adult_no_birth_year/,
        );
      },
    );

    await t.test(
      "deleting the adult's learning leaves them free to start again",
      async () => {
        const deleted = await post(
          `/api/v1/family/learners/${adultId}/delete-learning-data`,
          teacher,
          { confirmation: "delete-learning-data" },
        );
        assert.equal(deleted.statusCode, 200, deleted.body);
        assert.deepEqual((await me(teacher)).adultPractice, {
          eligible: true,
          learner: null,
        });
        assert.equal(
          (await get("/api/v1/me/practice", teacher)).statusCode,
          404,
        );
        assert.equal(
          (await post("/api/v1/me/practice/activity", teacher, { deltas: [] }))
            .statusCode,
          404,
        );
        assert.equal((await start(teacher)).statusCode, 201);
      },
    );

    await t.test(
      "free adult practice keeps no one's learning data longer",
      async () => {
        // A teacher at the licensed school whose child's plan ended long ago.
        const parent = await user("Sam Fixture");
        await consent(parent);
        await schools.addStaff({
          orgId: org.id,
          role: "teacher",
          givenName: "Sam",
          familyName: "Fixture",
          accountId: parent,
          classId: klass.id,
        });
        const child = await learning.create(parent, "Robin Fixture", 2016);
        await db.query(
          `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
           VALUES($1,$2,'stripe',$1,'active',now()-interval '400 days',now()-interval '300 days')`,
          [`fixture:${child.id}`, child.id],
        );
        const own = (await start(parent)).json().learnerId;
        assert.equal(
          (await grant(own)).ends_at.getTime(),
          licenseEnds.getTime(),
          "free through the school's license",
        );
        // The family's inactivity clock runs out ten days before the license
        // ends: the child's data goes, whatever the adult's practice says.
        const at = new Date(licenseEnds.getTime() - 10 * DAY);
        at.setUTCMonth(at.getUTCMonth() + RETENTION.learnerInactivityMonths);
        await purgeInactiveLearners(db, at);
        const kept = await db.query(
          "SELECT 1 FROM amp_learners WHERE id=$1 AND deleted_at IS NULL",
          [child.id],
        );
        assert.equal(kept.rowCount, 0);
      },
    );
  },
);
