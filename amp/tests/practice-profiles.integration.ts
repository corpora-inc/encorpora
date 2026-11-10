import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { StripeRepository } from "../src/billing/stripe/repository.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import {
  presetLevels,
  profileStrands,
} from "../src/learning/practice-profiles.js";
import { familyHasLearnerRoom } from "../src/learning/free-allowance.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { schoolDay } from "./helpers/school-day.js";
import { config } from "./stripe-fixtures.js";
import { syntheticDocumentProfile } from "./payment-evidence-fixtures.js";

/* Practice profiles (docs/families.md): an adult practices as someone else, at
   a grade and pace or from a student's levels, and nobody's record changes.
   Every name here is made up. */
const DAY = 86_400_000;

test(
  "practice profiles: practice, exclusion, copying a student, and access",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_profiles_${randomUUID().replaceAll("-", "")}`;
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
    const send = (
      method: "GET" | "POST" | "PATCH" | "DELETE",
      path: string,
      account: string,
      payload?: object,
    ) =>
      app.inject({
        method,
        url: path,
        headers: as(account),
        ...(payload ? { payload } : {}),
      });
    const me = async (account: string) => {
      const response = await send("GET", "/api/v1/me", account);
      assert.equal(response.statusCode, 200, response.body);
      return response.json();
    };
    const user = async (name: string) => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,$2,$3,true,now(),now())`,
        [id, name, `${id}@profiles.example`],
      );
      return `amp|${id}`;
    };
    const consent = (account: string) =>
      db.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'policy','verified','fixture-proof')",
        [account],
      );
    const makeProfile = async (
      account: string,
      label: string,
      levels: object,
    ) => {
      const response = await send("POST", "/api/v1/me/profiles", account, {
        label,
        levels,
      });
      assert.equal(response.statusCode, 201, response.body);
      return response.json().learnerId as string;
    };
    /** One served problem, answered. */
    const practice = async (account: string, learnerId: string) => {
      const served = await send(
        "POST",
        `/api/v1/learners/${learnerId}/batches`,
        account,
        { count: 1 },
      );
      assert.equal(served.statusCode, 200, served.body);
      const problem = served.json().problems[0];
      const answered = await send(
        "POST",
        `/api/v1/learners/${learnerId}/attempts`,
        account,
        { problemId: problem.id, requestId: randomUUID(), response: "1" },
      );
      assert.equal(answered.statusCode, 200, answered.body);
      return problem;
    };
    /** Everything practice writes about one learner. */
    const footprint = async (learnerId: string) =>
      (
        await db.query(
          `SELECT (SELECT count(*) FROM amp_attempts WHERE learner_id=$1)::int AS attempts,
             (SELECT count(*) FROM amp_instances WHERE learner_id=$1)::int AS problems,
             (SELECT count(*) FROM amp_skill_evidence WHERE learner_id=$1)::int AS evidence,
             (SELECT count(*) FROM amp_level_days WHERE learner_id=$1)::int AS levels,
             (SELECT state::text FROM amp_practice_settings WHERE learner_id=$1) AS settings,
             (SELECT free_online_used FROM amp_learners WHERE id=$1) AS used`,
          [learnerId],
        )
      ).rows[0];

    // A parent with consent, one child with paid access, their own practice.
    const parent = await user("Rowan Fixture");
    await consent(parent);
    const child = await learning.create(parent, "Juniper Fixture", 2017);
    const paid = `fixture:${child.id}`;
    await db.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
       VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '200 days')`,
      [paid, child.id],
    );

    let fourth = "";
    await t.test("a profile practices without touching anyone", async () => {
      // A profile before the adult's own learner never takes its place.
      fourth = await makeProfile(
        parent,
        "4th grade · behind",
        presetLevels(4, "behind"),
      );
      const started = await send("POST", "/api/v1/me/practice", parent, {
        start: "algebra-1",
        timezone: "America/Chicago",
      });
      assert.equal(started.statusCode, 201, started.body);
      const own = started.json().learnerId as string;
      assert.notEqual(own, fourth);

      // Its strands start where the profile says: every one at grade 3.
      const frontier = await send(
        "GET",
        `/api/v1/learners/${fourth}/frontier`,
        parent,
      );
      assert.equal(frontier.statusCode, 200, frontier.body);
      for (const strand of profileStrands)
        assert.ok(
          Math.abs(frontier.json().strands[strand].level - 3) < 0.5,
          `${strand} starts at grade 3`,
        );

      const childBefore = await footprint(child.id);
      const ownBefore = await footprint(own);
      for (let i = 0; i < 3; i++) await practice(parent, fourth);
      assert.equal((await footprint(fourth)).attempts, 3);
      assert.deepEqual(await footprint(child.id), childBefore);
      assert.deepEqual(await footprint(own), ownBefore);

      // Starting again keeps the profile's own levels.
      const state = await send(
        "GET",
        `/api/v1/learners/${fourth}/practice-state`,
        parent,
      );
      const reset = await send(
        "POST",
        `/api/v1/learners/${fourth}/practice-state`,
        parent,
        {
          requestId: randomUUID(),
          revision: state.json().revision,
          kind: "reset",
        },
      );
      assert.equal(reset.statusCode, 200, reset.body);
      assert.equal(reset.json().strandStarts.fractions.level, 3);
    });

    await t.test("adjusting, renaming and deleting a profile", async () => {
      const levels = { ...presetLevels(4, "behind"), measurement: 4 };
      const changed = await send(
        "PATCH",
        `/api/v1/me/profiles/${fourth}`,
        parent,
        { label: "Maya’s tutoring", levels },
      );
      assert.equal(changed.statusCode, 200, changed.body);
      assert.equal(changed.json().label, "Maya’s tutoring");
      assert.deepEqual(changed.json().levels, levels);
      const settings = JSON.parse((await footprint(fourth)).settings);
      // Only the moved strand starts again; the rest keep their answers.
      assert.equal(settings.strandStarts.measurement.level, 4);
      assert.equal(
        settings.strandStarts.measurement.revision,
        settings.revision,
      );
      assert.equal(settings.strandStarts.fractions.revision, 0);
      // The same levels again change nothing.
      await send("PATCH", `/api/v1/me/profiles/${fourth}`, parent, { levels });
      assert.equal(
        JSON.parse((await footprint(fourth)).settings).revision,
        settings.revision,
      );
      const listed = (await me(parent)).practiceProfiles;
      assert.deepEqual(listed, [
        { id: fourth, label: "Maya’s tutoring", levels },
      ]);

      // Nobody else can see, change, delete or practice it.
      const stranger = await user("Quinn Fixture");
      await consent(stranger);
      for (const response of [
        await send("PATCH", `/api/v1/me/profiles/${fourth}`, stranger, {
          label: "Mine",
        }),
        await send("DELETE", `/api/v1/me/profiles/${fourth}`, stranger),
        await send("POST", `/api/v1/learners/${fourth}/batches`, stranger, {
          count: 1,
        }),
      ])
        assert.equal(response.statusCode, 404, response.body);
      assert.equal((await me(stranger)).practiceProfiles, undefined);

      const spare = await makeProfile(
        parent,
        "Spare",
        presetLevels(0, "ahead"),
      );
      await practice(parent, spare);
      const deleted = await send(
        "DELETE",
        `/api/v1/me/profiles/${spare}`,
        parent,
      );
      assert.equal(deleted.statusCode, 204, deleted.body);
      assert.equal(
        (await db.query("SELECT 1 FROM amp_learners WHERE id=$1", [spare]))
          .rowCount,
        0,
      );
      assert.equal(
        (
          await db.query("SELECT 1 FROM amp_attempts WHERE learner_id=$1", [
            spare,
          ])
        ).rowCount,
        0,
      );
    });

    await t.test(
      "a profile is left out of every real learner's place",
      async () => {
        const account = await me(parent);
        assert.deepEqual(
          account.learners.map((l: { id: string }) => l.id),
          [child.id],
          "/me learners are the family's children",
        );
        assert.notEqual(account.adultPractice.learner.id, fourth);
        const entry = account.family.learners.find(
          (l: { id: string }) => l.id === fourth,
        );
        assert.equal(entry.simulation, true);
        assert.equal(entry.adult, true);
        assert.equal(entry.access.length, 0, "a profile has no grant");
        const listed = await send("GET", "/api/v1/learners", parent);
        assert.ok(
          !listed.json().learners.some((l: { id: string }) => l.id === fourth),
        );
        // Never a student: no roster row, enrollment or seat anywhere.
        assert.equal(
          (
            await db.query("SELECT 1 FROM amp_people WHERE learner_id=$1", [
              fourth,
            ])
          ).rowCount,
          0,
        );
        // It counts toward no limit.
        const live = (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL AND NOT simulation",
            [parent],
          )
        ).rows[0].n;
        await db.query(
          `INSERT INTO amp_learners(id,account_id,name,adult,simulation)
         SELECT gen_random_uuid()::text,$1,'Bulk profile',true,true FROM generate_series(1,$2::int)`,
          [parent, 1000 - live],
        );
        assert.equal(await familyHasLearnerRoom(db, parent), true);
        await db.query(
          "DELETE FROM amp_learners WHERE account_id=$1 AND name='Bulk profile'",
          [parent],
        );
        // Nobody buys for it: checkout, gifts and funded requests refuse it.
        const billing = new StripeRepository(db, {
          ...config,
          documentProfile: syntheticDocumentProfile,
        });
        await db.query(
          "UPDATE amp_parent_consents SET policy_version=$2 WHERE account_id=$1",
          [parent, config.consentPolicyVersion],
        );
        const client = await db.connect();
        try {
          assert.equal(
            await billing.assertPurchaseAllowed(client, parent, child.id),
            "own",
          );
          await assert.rejects(
            billing.assertPurchaseAllowed(client, parent, fourth),
            (error: { code?: string }) => error.code === "learner_not_found",
          );
          assert.equal(
            await billing.ownAdultLearner(client, parent, fourth),
            false,
          );
        } finally {
          client.release();
        }
      },
    );

    await t.test("copying a student is a one-time snapshot", async () => {
      const licenseEnds = new Date(Date.now() + 200 * DAY);
      const org = (await schoolAdmin(schools, "create-org", {
        kind: "school",
        name: "Alder Fixture School",
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
        [year, org.id, schoolDay(-60), schoolDay(200)],
      );
      const klass = async (name: string) =>
        (await schools.createClass(org.id, {
          name,
          courseBands: ["5"],
          gradingKind: "year",
          sessionId: year,
        })) as { id: string };
      const fifth = await klass("Grade 5 Math");
      const other = await klass("Grade 5 Science");
      const teacher = await user("Dana Fixture");
      await schools.addStaff({
        orgId: org.id,
        role: "teacher",
        givenName: "Dana",
        familyName: "Fixture",
        accountId: teacher,
        classId: fifth.id,
      });
      const outsider = await user("Ellis Fixture");
      await schools.addStaff({
        orgId: org.id,
        role: "teacher",
        givenName: "Ellis",
        familyName: "Fixture",
        accountId: outsider,
        classId: other.id,
      });
      const pupil = await schools.provisionStudent(org.id, {
        givenName: "Pia",
        familyName: "Fixture",
        gradeLevel: 5,
        classId: fifth.id,
      });
      const stored = (fractions: number) =>
        db.query(
          `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
           VALUES($1,$2,$3,'test') ON CONFLICT(learner_id,day) DO UPDATE SET frontier=EXCLUDED.frontier`,
          [
            pupil.learnerId,
            schoolDay(0),
            JSON.stringify({
              overall: { level: 5.2, sd: 0.4, answered: 30, independent: 20 },
              strands: {
                fractions: {
                  level: fractions,
                  sd: 0.5,
                  answered: 9,
                  independent: 5,
                },
                measurement: {
                  level: 5.6,
                  sd: 0.5,
                  answered: 9,
                  independent: 5,
                },
              },
            }),
          ],
        );
      await stored(3.4);
      const copy = (account: string) =>
        send(
          "POST",
          `/api/v1/school/students/${pupil.personId}/practice-profile`,
          account,
          { label: "Student levels · Nov 10" },
        );
      // Only someone who can read the student's record copies it.
      assert.equal((await copy(outsider)).statusCode, 404);
      assert.equal((await copy(parent)).statusCode, 404);
      const copied = await copy(teacher);
      assert.equal(copied.statusCode, 201, copied.body);
      const profile = copied.json().learnerId as string;
      const expected = {
        ...presetLevels(5, "on-level"),
        fractions: 3,
        measurement: 6,
      };
      assert.deepEqual(copied.json().levels, expected);
      const row = (
        await db.query(
          "SELECT account_id,name,birth_year,adult,simulation FROM amp_learners WHERE id=$1",
          [profile],
        )
      ).rows[0];
      assert.deepEqual(row, {
        account_id: teacher,
        name: "Student levels · Nov 10",
        birth_year: null,
        adult: true,
        simulation: true,
      });

      // The student moves on; the copy doesn't. The copy practices; the
      // student doesn't.
      const pupilBefore = await footprint(pupil.learnerId);
      await stored(5.9);
      await practice(teacher, profile);
      const after = (await me(teacher)).practiceProfiles;
      assert.deepEqual(after[0], {
        id: profile,
        label: "Student levels · Nov 10",
        levels: expected,
      });
      assert.deepEqual(
        { ...(await footprint(pupil.learnerId)), levels: 0 },
        { ...pupilBefore, levels: 0 },
      );
      // The class's records never see it: the teacher's line is their own
      // learner, once, and the roster is the students'.
      const own = await send("POST", "/api/v1/me/practice", teacher, {
        timezone: "America/New_York",
      });
      assert.equal(own.statusCode, 201, own.body);
      const map = await send(
        "GET",
        `/api/v1/school/classes/${fifth.id}/map`,
        teacher,
      );
      assert.equal(map.statusCode, 200, map.body);
      assert.deepEqual(
        map.json().students.map((s: { id: string }) => s.id),
        [pupil.personId],
      );
      assert.equal(map.json().teachers.length, 1);
      assert.equal(map.json().teachers[0].you, true);
    });

    await t.test(
      "access follows the owner; otherwise the free allowance",
      async () => {
        const entry = async (account: string, id: string) =>
          (await me(account)).family.learners.find(
            (l: { id: string }) => l.id === id,
          );
        // The parent's child has paid access: the profile is covered and
        // spends no free problem.
        assert.equal((await entry(parent, fourth)).hasAccess, true);
        const used = (await footprint(fourth)).used;
        await practice(parent, fourth);
        assert.equal((await footprint(fourth)).used, used);

        // The plan ends: the profile has its own free allowance.
        await db.query(
          "UPDATE amp_grants SET status='revoked' WHERE learner_id=$1",
          [child.id],
        );
        const lapsed = await entry(parent, fourth);
        assert.equal(lapsed.hasAccess, false);
        assert.equal(lapsed.canPractice, true);
        assert.equal(lapsed.freeAllowance.problems.remaining, 100);
        await practice(parent, fourth);
        assert.equal((await footprint(fourth)).used, used + 1);

        // Used up: the same pause as any learner, and nothing else stops.
        await db.query(
          "UPDATE amp_learners SET free_online_used=100 WHERE id=$1",
          [fourth],
        );
        assert.equal((await entry(parent, fourth)).canPractice, false);
        const paused = await send(
          "POST",
          `/api/v1/learners/${fourth}/batches`,
          parent,
          { count: 1 },
        );
        assert.equal(paused.statusCode, 402, paused.body);
        const another = await makeProfile(
          parent,
          "Another",
          presetLevels(7, "ahead"),
        );
        assert.equal((await entry(parent, another)).canPractice, true);

        // The adult's own plan covers every profile again.
        const own = (await me(parent)).adultPractice.learner.id;
        await db.query(
          `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
         VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '30 days')`,
          [`fixture:${own}`, own],
        );
        assert.equal((await entry(parent, fourth)).canPractice, true);
        await practice(parent, fourth);
      },
    );

    await t.test("a student's session never reaches a profile", async () => {
      const refused = await app.inject({
        method: "POST",
        url: "/api/v1/me/profiles",
        headers: { authorization: "Bearer st_fixture" },
        payload: { label: "Mine", levels: presetLevels(3, "on-level") },
      });
      assert.equal(refused.statusCode, 401, refused.body);
      const invalid = await send("POST", "/api/v1/me/profiles", parent, {
        label: "  ",
        levels: presetLevels(3, "on-level"),
      });
      assert.equal(invalid.statusCode, 400, invalid.body);
    });

    await t.test("account deletion takes profiles with it", async () => {
      const deleted = await send(
        "POST",
        "/api/v1/family/delete-learning-data",
        parent,
        { confirmation: "delete-learning-data" },
      );
      assert.equal(deleted.statusCode, 200, deleted.body);
      assert.equal(
        (
          await db.query(
            "SELECT 1 FROM amp_learners WHERE account_id=$1 AND simulation",
            [parent],
          )
        ).rowCount,
        0,
      );
      assert.equal((await me(parent)).practiceProfiles, undefined);
    });
  },
);
