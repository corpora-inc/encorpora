import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { insightsReport } from "../src/analytics/insights.js";
import { registerAnalyticsRoutes } from "../src/analytics/routes.js";
import { registerUnavailableBilling } from "../src/billing/stripe/routes.js";
import { FamilyRepository } from "../src/family/repository.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { initialLevel } from "../src/learning/frontier.js";
import { generateProblem } from "../src/math/engine.js";
import { purgeInactiveLearners } from "../src/privacy/retention.js";
import { recordEvent } from "../src/schools/events.js";
import { can, loadActor } from "../src/schools/authz.js";
import { schoolAccountId } from "../src/schools/principal.js";
import {
  birthYearForGrade,
  SchoolRepository,
} from "../src/schools/repository.js";
import { registerSchoolRoutes, schoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

const YEAR_AHEAD = new Date(Date.now() + 365 * 86_400_000).toISOString();
const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};

test(
  "AMP for Schools: roster, student token, consent, seats and authorization",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_schools_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const families = new FamilyRepository(db);
    // Stands in for AMP accounts, where a session cookie answers any request
    // whose bearer token it doesn't recognise.
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      const cookie = request.headers.cookie?.match(/parent=(amp\|[\w-]+)/)?.[1];
      if (cookie) return cookie;
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await registerUnavailableBilling(app, authenticate);
    await registerAnalyticsRoutes(app, { pool: db, authenticate });
    await app.ready();

    const as = (token: string, cookie?: string) => ({
      authorization: `Bearer ${token}`,
      ...(cookie ? { cookie } : {}),
    });
    const get = (path: string, headers: Record<string, string>) =>
      app.inject({ method: "GET", url: path, headers });
    const post = (
      path: string,
      headers: Record<string, string>,
      payload: object = {},
    ) => app.inject({ method: "POST", url: path, headers, payload });
    async function school(name: string, seats = 30) {
      const org = (await schoolAdmin(schools, "create-org", {
        kind: "school",
        name,
        timezone: "America/New_York",
        agreement,
      })) as { id: string };
      const license = (await schoolAdmin(schools, "issue-license", {
        orgId: org.id,
        seats,
        endsAt: YEAR_AHEAD,
      })) as { licenseId: string };
      return { orgId: org.id, licenseId: license.licenseId };
    }
    /** A tombstone keeps only what maps a final grade to the school's record. */
    async function assertScrubbed(personId: string, handle: string) {
      const person = (
        await db.query("SELECT * FROM amp_people WHERE id=$1", [personId])
      ).rows[0];
      assert.equal(person.learner_id, null);
      assert.ok(person.deleted_at);
      assert.equal(person.given_name, "Removed");
      assert.equal(person.family_name, null);
      assert.equal(person.display_name, null);
      assert.equal(person.email, null);
      assert.equal(person.identifier, "SIS-1001");
      assert.equal(person.handle, handle);
    }
    const handleOf = async (personId: string) =>
      (await db.query("SELECT handle FROM amp_people WHERE id=$1", [personId]))
        .rows[0].handle as string;
    const personal = {
      displayName: "Fixture S.",
      email: "fixture-student@example.test",
      identifier: "SIS-1001",
    };
    async function enrolled(
      orgId: string,
      classId?: string,
      gradeLevel = 4,
      extra: object = {},
    ) {
      const student = await schools.provisionStudent(orgId, {
        givenName: "Fixture",
        familyName: "Student",
        gradeLevel,
        ...(classId ? { classId } : {}),
        ...extra,
      });
      const { token } = await schools.issueStudentSession({
        personId: student.personId,
        mode: "shared",
      });
      return { ...student, token };
    }

    try {
      await t.test(
        "a provisioned student practices, then deletion leaves a tombstone and frees the seat",
        async () => {
          const { orgId, licenseId } = await school("Practice School");
          const period = await schools.createClass(orgId, { name: "Period 1" });
          const student = await enrolled(orgId, period.id, 4, personal);
          const handle = await handleOf(student.personId);
          assert.equal(student.seated, true);
          const grantId = (
            await db.query(
              "SELECT grant_id FROM amp_seats WHERE person_id=$1",
              [student.personId],
            )
          ).rows[0].grant_id;
          const seatGrant = (
            await db.query("SELECT * FROM amp_grants WHERE id=$1", [grantId])
          ).rows[0];
          assert.equal(seatGrant.channel, "pilot");
          assert.equal(grantId, `school-seat:${seatGrant.external_order_id}`);

          // A grade alone gives the learner the prior of a child at that grade.
          const birthYear = birthYearForGrade(4);
          assert.equal(initialLevel({ birthYear }), 4);

          const me = (await get("/api/v1/me", as(student.token))).json();
          assert.equal(me.account.kind, "student");
          assert.equal(me.account.id, schoolAccountId(student.personId));
          assert.equal(me.account.email, null);
          assert.equal(me.consent.status, "active");
          assert.equal(me.family.consent.status, "active");
          assert.equal(me.next, "practice");
          assert.equal(me.school.orgName, "Practice School");
          assert.equal(me.school.className, "Period 1");
          assert.equal(me.school.levels, "hidden");
          assert.equal(me.learners[0].birthYear, birthYear);
          assert.equal(me.learners[0].entitlement.active, true);

          const path = `/api/v1/learners/${student.learnerId}`;
          const batch = await post(`${path}/batches`, as(student.token), {
            templateId: "add-within-20",
            count: 1,
          });
          assert.equal(batch.statusCode, 200);
          const problem = batch.json().problems[0];
          const attempt = await post(`${path}/attempts`, as(student.token), {
            problemId: problem.id,
            requestId: randomUUID(),
            response: generateProblem(problem.templateId, problem.seed).answer,
          });
          assert.equal(attempt.statusCode, 200);
          assert.equal(attempt.json().correct, true);
          const progress = await get(`${path}/progress`, as(student.token));
          assert.equal(progress.statusCode, 200);
          assert.ok(
            progress
              .json()
              .skills.some((skill: { attempts: number }) => skill.attempts > 0),
          );

          const receipt = await families.deleteLearning(
            schoolAccountId(student.personId),
            student.learnerId,
          );
          assert.equal(receipt.deletedLearners, 1);
          await assertScrubbed(student.personId, handle);
          const seat = (
            await db.query("SELECT * FROM amp_seats WHERE person_id=$1", [
              student.personId,
            ])
          ).rows[0];
          assert.ok(seat.released_at);
          assert.equal(seat.grant_id, null);
          assert.equal(
            (await db.query("SELECT 1 FROM amp_grants WHERE id=$1", [grantId]))
              .rowCount,
            0,
          );
          assert.equal(
            (await get("/api/v1/me", as(student.token))).statusCode,
            401,
          );
          const open = await db.query(
            "SELECT count(*)::int AS open FROM amp_seats WHERE license_id=$1 AND released_at IS NULL",
            [licenseId],
          );
          assert.equal(open.rows[0].open, 0);
        },
      );

      await t.test(
        "retention reaches a school learner without an FK failure, and the person survives",
        async () => {
          const { orgId } = await school("Retention School");
          const student = await enrolled(orgId, undefined, 4, personal);
          const handle = await handleOf(student.personId);
          // Not yet: the license is still running.
          assert.deepEqual(await purgeInactiveLearners(db), {
            expiredLearners: 0,
          });
          // 24 months after the license ends, a year from now.
          const later = new Date(Date.now() + 1100 * 86_400_000);
          assert.ok(
            (await purgeInactiveLearners(db, later)).expiredLearners >= 1,
          );
          await assertScrubbed(student.personId, handle);
          assert.equal(
            (
              await db.query("SELECT 1 FROM amp_learners WHERE id=$1", [
                student.learnerId,
              ])
            ).rowCount,
            0,
          );
          assert.ok(
            (
              await db.query(
                "SELECT released_at FROM amp_seats WHERE person_id=$1",
                [student.personId],
              )
            ).rows[0].released_at,
          );
        },
      );

      await t.test(
        "a student token gets 401 from every parent route, even with a parent's cookie",
        async () => {
          const { orgId } = await school("Shared Device School");
          const student = await enrolled(orgId);
          const cookie = "parent=amp|shared-device-parent";
          // The fixture answers a parent's cookie when no student token is sent.
          assert.equal(
            (await get("/api/v1/family", { cookie })).statusCode,
            200,
          );
          for (const headers of [
            as(student.token),
            as(student.token, cookie),
            as("st_not-a-real-token", cookie),
          ]) {
            for (const [method, path] of [
              ["GET", "/api/v1/family"],
              ["POST", "/api/v1/family/consent/withdraw"],
              ["POST", "/api/v1/family/export-ticket"],
              ["GET", "/api/v1/billing/offer"],
              ["GET", "/api/v1/billing/enrollment"],
              ["GET", "/api/v1/session"],
              ["POST", "/api/v1/trials/current"],
              ["POST", "/api/v1/trials/adopt"],
              ["GET", "/api/v1/school/orgs"],
            ] as const) {
              const response = await app.inject({
                method,
                url: path,
                headers,
                ...(method === "POST" ? { payload: {} } : {}),
              });
              assert.equal(response.statusCode, 401, `${method} ${path}`);
            }
          }
        },
      );

      await t.test(
        "a bad token answers 401, not signedIn:false, whether revoked, expired or removed",
        async () => {
          const { orgId } = await school("Token School");
          const cookie = "parent=amp|token-school-parent";
          const bad = async (token: string) => {
            for (const headers of [as(token), as(token, cookie)]) {
              const me = await get("/api/v1/me", headers);
              assert.equal(me.statusCode, 401);
              assert.equal(me.json().error, "sign_in_required");
            }
          };
          await bad("st_malformed");
          await bad(`st_${"a".repeat(43)}`);
          const revoked = await enrolled(orgId);
          assert.equal(
            (await get("/api/v1/me", as(revoked.token))).statusCode,
            200,
          );
          await db.query(
            "UPDATE amp_student_sessions SET revoked_at=now() WHERE person_id=$1",
            [revoked.personId],
          );
          await bad(revoked.token);
          const expired = await enrolled(orgId);
          await db.query(
            "UPDATE amp_student_sessions SET expires_at=now()-interval '1 second' WHERE person_id=$1",
            [expired.personId],
          );
          await bad(expired.token);
          const removed = await enrolled(orgId);
          await db.query(
            "UPDATE amp_org_roles SET end_on=begin_on WHERE person_id=$1",
            [removed.personId],
          );
          await bad(removed.token);
          assert.equal(
            (
              await post(
                `/api/v1/learners/${removed.learnerId}/batches`,
                as(removed.token),
              )
            ).statusCode,
            401,
          );
          const untrusted = await get("/api/v1/me", { cookie });
          assert.equal(untrusted.statusCode, 200);
          assert.equal(untrusted.json().account.id, "amp|token-school-parent");
        },
      );

      await t.test(
        "sessions last 12 hours when shared and 90 days when personal",
        async () => {
          const { orgId } = await school("Session School");
          const student = await enrolled(orgId);
          const hours = async (mode: "shared" | "personal") => {
            const session = await schools.issueStudentSession({
              personId: student.personId,
              mode,
            });
            assert.match(session.token, /^st_[A-Za-z0-9_-]{43}$/);
            const row = (
              await db.query(
                "SELECT token_hash FROM amp_student_sessions WHERE expires_at=$1",
                [session.expiresAt],
              )
            ).rows[0];
            assert.notEqual(row.token_hash, session.token);
            return (Date.parse(session.expiresAt) - Date.now()) / 3_600_000;
          };
          assert.ok(Math.abs((await hours("shared")) - 12) < 0.1);
          assert.ok(Math.abs((await hours("personal")) - 2160) < 0.1);
          // A session's own row notes when it was last seen, at most every five
          // minutes, so a class answering together doesn't write on every answer.
          const seen = () =>
            db.query(
              "SELECT last_seen_at FROM amp_student_sessions WHERE token_hash=encode(sha256($1::bytea),'hex')",
              [student.token],
            );
          const recent = (await seen()).rows[0].last_seen_at;
          await get("/api/v1/me", as(student.token));
          assert.deepEqual((await seen()).rows[0].last_seen_at, recent);
          await db.query(
            "UPDATE amp_student_sessions SET last_seen_at=now()-interval '6 minutes' WHERE person_id=$1",
            [student.personId],
          );
          await get("/api/v1/me", as(student.token));
          assert.ok(
            (await seen()).rows[0].last_seen_at > new Date(Date.now() - 60_000),
          );
        },
      );

      await t.test(
        "a student can't do what a family decides; working together stays allowed",
        async () => {
          const { orgId } = await school("Managed School");
          const student = await enrolled(orgId);
          const headers = as(student.token);
          const path = `/api/v1/learners/${student.learnerId}`;
          const state = (
            await get(`${path}/practice-state`, headers)
          ).json() as { revision: number };
          for (const [route, body] of [
            ["/api/v1/learners", { name: "Sneaky sibling" }],
            [`${path}/birth-year`, { birthYear: 2000 }],
            [`${path}/starting-point`, { band: "9–12" }],
            [
              `${path}/practice-state`,
              {
                kind: "reset",
                requestId: randomUUID(),
                revision: state.revision,
              },
            ],
            [
              `${path}/workbooks/${randomUUID()}/results`,
              { entries: [{ n: 1, mark: "right" }] },
            ],
          ] as const) {
            const refused = await post(route, headers, body);
            assert.equal(refused.statusCode, 403, route);
          }
          const together = await post(`${path}/practice-state`, headers, {
            kind: "together",
            enabled: true,
            requestId: randomUUID(),
            revision: state.revision,
          });
          assert.equal(together.statusCode, 200);
          assert.equal(together.json().workingTogether, true);
        },
      );

      await t.test(
        "consent follows the nearest agreement up the path and the student's own role",
        async () => {
          const district = await schools.createOrg({
            kind: "district",
            name: "Fixture District",
            timezone: "America/Chicago",
          });
          const campus = await schools.createOrg({
            kind: "school",
            name: "Fixture Campus",
            parentId: district.id,
          });
          await schools.issueLicense({
            orgId: district.id,
            seats: 5,
            endsAt: YEAR_AHEAD,
          });
          const student = await enrolled(campus.id);
          assert.equal(student.seated, true);
          const path = `/api/v1/learners/${student.learnerId}`;
          const batch = () => post(`${path}/batches`, as(student.token));
          const canPractice = async () =>
            (await get("/api/v1/me", as(student.token))).json().family
              .learners[0].canPractice;
          // No agreement anywhere up the path yet.
          assert.equal((await batch()).statusCode, 403);
          assert.equal(await canPractice(), false);
          // The district's agreement reaches the campus.
          await schools.recordDataAgreement(district.id, agreement);
          assert.equal((await batch()).statusCode, 200);
          assert.equal(await canPractice(), true);
          // The campus's own ended agreement is the nearest, and it wins.
          const own = await schools.recordDataAgreement(campus.id, agreement);
          await db.query(
            "UPDATE amp_data_agreements SET ended_at=now() WHERE id=$1",
            [own.id],
          );
          assert.equal((await batch()).statusCode, 403);
          assert.equal(await canPractice(), false);
          const me = (await get("/api/v1/me", as(student.token))).json();
          assert.equal(me.family.consent.status, "active");
          assert.equal(me.learners[0].entitlement.active, false);
          // A newer agreement there reopens practice.
          await schools.recordDataAgreement(campus.id, agreement);
          assert.equal((await batch()).statusCode, 200);
          // Removing the student ends it, and their token with it.
          await db.query(
            "UPDATE amp_org_roles SET end_on=begin_on WHERE person_id=$1",
            [student.personId],
          );
          assert.equal((await batch()).statusCode, 401);
          assert.equal(
            await learning.hasConsent(schoolAccountId(student.personId)),
            false,
          );
        },
      );

      await t.test(
        "seats: the count holds under concurrency; overflow is rostered, flagged and filled later",
        async () => {
          const { orgId, licenseId } = await school("Seat School", 2);
          const added = await Promise.all(
            Array.from({ length: 5 }, (_, i) =>
              schools.provisionStudent(orgId, { givenName: `Student${i}` }),
            ),
          );
          assert.equal(added.filter((s) => s.seated).length, 2);
          assert.equal(added.length, 5);

          const owner = `amp|seat-admin-${randomUUID()}`;
          await schools.addStaff({
            orgId,
            role: "admin",
            givenName: "Fixture",
            accountId: owner,
          });
          const roster = (
            await get(`/api/v1/school/orgs/${orgId}/students`, as(owner))
          ).json().students as { id: string; seated: boolean }[];
          assert.equal(roster.length, 5);
          assert.equal(roster.filter((s) => s.seated).length, 2);

          const waiting = added.find((s) => !s.seated)!;
          const { token } = await schools.issueStudentSession({
            personId: waiting.personId,
            mode: "personal",
          });
          const me = (await get("/api/v1/me", as(token))).json();
          assert.equal(me.learners[0].entitlement.active, false);
          assert.equal(
            (
              await post(
                `/api/v1/learners/${waiting.learnerId}/batches`,
                as(token),
              )
            ).statusCode,
            403,
          );

          await assert.rejects(
            schoolAdmin(schools, "set-seats", { licenseId, seats: 1 }),
            /seats_in_use/,
          );
          assert.deepEqual(
            await schoolAdmin(schools, "set-seats", { licenseId, seats: 4 }),
            { licenseId, seats: 4, assigned: 2 },
          );
          const seated = (
            await get(`/api/v1/school/orgs/${orgId}/students`, as(owner))
          ).json().students as { seated: boolean }[];
          assert.equal(seated.filter((s) => s.seated).length, 4);

          const holder = added.find((s) => s.seated)!;
          assert.deepEqual(await schools.releaseSeat(holder.personId), {
            released: true,
          });
          assert.equal(
            (
              await db.query(
                `SELECT status FROM amp_grants WHERE learner_id=$1`,
                [holder.learnerId],
              )
            ).rows[0].status,
            "revoked",
          );
          assert.deepEqual(await schools.releaseSeat(holder.personId), {
            released: false,
          });

          // A renewal gives waiting students a seat on the new license.
          await db.query(
            "UPDATE amp_school_licenses SET ends_at=now() WHERE id=$1",
            [licenseId],
          );
          const renewed = await schools.issueLicense({
            orgId,
            seats: 10,
            endsAt: YEAR_AHEAD,
          });
          assert.equal(renewed.assigned, 5);
        },
      );

      await t.test(
        "the event log is append-only and holds no names",
        async () => {
          const { orgId } = await school("Event School");
          const event = (
            await db.query(
              "SELECT id FROM amp_school_events WHERE org_id=$1 LIMIT 1",
              [orgId],
            )
          ).rows[0];
          await assert.rejects(
            db.query("UPDATE amp_school_events SET action='x' WHERE id=$1", [
              event.id,
            ]),
            /append-only/,
          );
          await assert.rejects(
            db.query("DELETE FROM amp_school_events WHERE id=$1", [event.id]),
            /append-only/,
          );
          await assert.rejects(
            recordEvent(db, {
              orgId,
              action: "fixture",
              targetKind: "person",
              targetId: "fixture",
              detail: { after: { nested: { givenName: "A child" } } },
            }),
            /never hold names/,
          );
        },
      );

      await t.test(
        "a student's level setting resolves across scopes, with the most restrictive winning",
        async () => {
          const { orgId } = await school("Settings School");
          const a = await schools.createClass(orgId, { name: "Math" });
          const b = await schools.createClass(orgId, { name: "Intervention" });
          const student = await enrolled(orgId, a.id);
          await db.query(
            `INSERT INTO amp_enrollments(id,class_id,person_id,role,begin_on)
             SELECT gen_random_uuid(),$1,person_id,'student',begin_on FROM amp_org_roles WHERE person_id=$2`,
            [b.id, student.personId],
          );
          const set = (
            kind: string,
            id: string,
            values: object,
            locked: string[] = [],
          ) =>
            db.query(
              `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values",locked) VALUES($1,$2,$3,$4)
               ON CONFLICT (scope_kind,scope_id) DO UPDATE SET "values"=$3,locked=$4`,
              [kind, id, JSON.stringify(values), locked],
            );
          const levels = async () =>
            (await get("/api/v1/me", as(student.token))).json().school.levels;
          assert.equal(await levels(), "hidden");
          await set("org", orgId, { levels: "shown" });
          assert.equal(await levels(), "shown");
          await set("class", a.id, { levels: "choice" });
          assert.equal(await levels(), "choice");
          await set("class", b.id, { levels: "hidden" });
          assert.equal(await levels(), "hidden");
          await set("class", b.id, {});
          await set("org", orgId, { levels: "shown" }, ["levels"]);
          assert.equal(await levels(), "shown");
        },
      );

      await t.test(
        "analytics ignores student tokens and family reports leave school learners out",
        async () => {
          const { orgId } = await school("Quiet School");
          const student = await enrolled(orgId);
          const events = await post("/api/v1/events", as(student.token), {
            events: [],
          });
          assert.equal(events.statusCode, 204);
          const family = randomUUID();
          await db.query(
            "INSERT INTO amp_learners(id,account_id,name) VALUES($1,'amp|quiet-family','Fixture learner')",
            [family],
          );
          const band = (id: string, value: string) =>
            db.query(
              "UPDATE amp_learners SET starting_band=$2,starting_policy=1,starting_excluded_strands='{}' WHERE id=$1",
              [id, value],
            );
          await band(student.learnerId, "3–5");
          await band(family, "6–8");
          const report = await insightsReport(db, {
            from: new Date(Date.now() - 86_400_000),
            to: new Date(Date.now() + 86_400_000),
          });
          const bands = report.startingBands.map((row) => row.band);
          assert.ok(bands.includes("6–8"));
          assert.ok(!bands.includes("3–5"));
        },
      );

      await t.test(
        "the route table: another tenant's teacher gets 404 everywhere; a teacher sees only their class",
        async () => {
          const home = await school("Home School");
          const away = await school("Away School");
          const period1 = await schools.createClass(home.orgId, {
            name: "Period 1",
          });
          const period2 = await schools.createClass(home.orgId, {
            name: "Period 2",
          });
          const awayClass = await schools.createClass(away.orgId, {
            name: "Away class",
          });
          const student1 = await enrolled(home.orgId, period1.id);
          const student2 = await enrolled(home.orgId, period2.id);
          const teacher = `amp|teacher-${randomUUID()}`;
          const teacherPerson = await schoolAdmin(schools, "add-staff", {
            orgId: home.orgId,
            role: "teacher",
            givenName: "Home",
            accountId: teacher,
            classId: period1.id,
          });
          const aide = `amp|aide-${randomUUID()}`;
          await schools.addStaff({
            orgId: home.orgId,
            role: "aide",
            givenName: "Home",
            accountId: aide,
            classId: period1.id,
          });
          const viewer = `amp|viewer-${randomUUID()}`;
          await schools.addStaff({
            orgId: home.orgId,
            role: "viewer",
            givenName: "Home",
            accountId: viewer,
          });
          const stranger = `amp|stranger-${randomUUID()}`;
          await schools.addStaff({
            orgId: away.orgId,
            role: "teacher",
            givenName: "Away",
            accountId: stranger,
            classId: awayClass.id,
          });
          const strangerAdmin = `amp|stranger-admin-${randomUUID()}`;
          await schools.addStaff({
            orgId: away.orgId,
            role: "admin",
            givenName: "Away",
            accountId: strangerAdmin,
          });
          const parent = `amp|parent-${randomUUID()}`;

          const fixtures: Record<string, string> = {
            org: home.orgId,
            class: period1.id,
            student: student1.personId,
            person: randomUUID(),
            session: randomUUID(),
            workbook: randomUUID(),
          };
          const known = new Set(Object.keys(fixtures));
          assert.ok(schoolRoutes.length >= 6);
          for (const route of schoolRoutes) {
            const params = [...route.url.matchAll(/:(\w+)/g)].map((m) => m[1]!);
            for (const param of params)
              assert.ok(
                known.has(param),
                `The walk needs a fixture for :${param} (${route.url})`,
              );
            const path = route.url.replace(/:(\w+)/g, (_, k) => fixtures[k]!);
            const self =
              route.target({ params: fixtures, body: {} }).kind === "self";
            for (const account of [stranger, strangerAdmin, parent]) {
              const response = await app.inject({
                method: route.method,
                url: path,
                headers: as(account),
                ...(route.method === "POST"
                  ? { payload: { name: "Probe", givenName: "Probe" } }
                  : {}),
              });
              if (self) {
                // The probe's body isn't a valid setup or acceptance.
                assert.equal(
                  response.statusCode,
                  route.method === "GET" ? 200 : 400,
                  route.url,
                );
                assert.equal(
                  response.body.includes(home.orgId),
                  false,
                  `${route.url} leaked another tenant`,
                );
              } else {
                assert.equal(
                  response.statusCode,
                  404,
                  `${route.url} ${account}`,
                );
                assert.deepEqual(response.json(), { error: "not_found" });
              }
            }
            const signedOut = await app.inject({
              method: route.method,
              url: path,
              ...(route.method === "POST" ? { payload: {} } : {}),
            });
            assert.equal(signedOut.statusCode, 401, route.url);
          }
          // A class in another school can't be reached by naming your own org.
          const crossed = await post(
            `/api/v1/school/orgs/${away.orgId}/students`,
            as(strangerAdmin),
            { givenName: "Probe", classId: period1.id },
          );
          assert.equal(crossed.statusCode, 404);
          // Malformed identifiers are also just not found.
          assert.equal(
            (await get("/api/v1/school/orgs/not-a-uuid", as(strangerAdmin)))
              .statusCode,
            404,
          );

          const rosterOf = async (account: string) =>
            (
              await get(
                `/api/v1/school/orgs/${home.orgId}/students`,
                as(account),
              )
            ).json().students as { id: string; classIds: string[] }[];
          const classesOf = async (account: string) =>
            (
              await get(
                `/api/v1/school/orgs/${home.orgId}/classes`,
                as(account),
              )
            ).json().classes as { id: string }[];
          for (const staff of [teacher, aide]) {
            assert.deepEqual(
              (await rosterOf(staff)).map((s) => s.id),
              [student1.personId],
            );
            assert.deepEqual(
              (await classesOf(staff)).map((c) => c.id),
              [period1.id],
            );
          }
          assert.deepEqual((await rosterOf(teacher))[0]!.classIds, [
            period1.id,
          ]);
          assert.equal((await rosterOf(viewer)).length, 2);
          assert.equal((await classesOf(viewer)).length, 2);
          assert.ok(
            !(await rosterOf(teacher)).some((s) => s.id === student2.personId),
          );

          // What each role can change.
          const students = `/api/v1/school/orgs/${home.orgId}/students`;
          const classes = `/api/v1/school/orgs/${home.orgId}/classes`;
          const add = (account: string, classId?: string) =>
            post(students, as(account), {
              givenName: "New",
              ...(classId ? { classId } : {}),
            });
          assert.equal((await add(teacher, period1.id)).statusCode, 201);
          assert.equal((await add(teacher, period2.id)).statusCode, 404);
          assert.equal((await add(teacher)).statusCode, 404);
          assert.equal((await add(aide, period1.id)).statusCode, 404);
          assert.equal((await add(viewer, period1.id)).statusCode, 404);
          assert.equal(
            (await post(classes, as(teacher), { name: "Mine" })).statusCode,
            404,
          );
          assert.equal(
            (await post(classes, as(viewer), { name: "Mine" })).statusCode,
            404,
          );

          // An admin at the root sees every descendant; a child's admin doesn't
          // see its sibling or its parent.
          const district = await schools.createOrg({
            kind: "district",
            name: "Walk District",
            timezone: "America/Denver",
          });
          const north = await schools.createOrg({
            kind: "school",
            name: "North",
            parentId: district.id,
          });
          const south = await schools.createOrg({
            kind: "school",
            name: "South",
            parentId: district.id,
          });
          const northClass = await schools.createClass(north.id, {
            name: "North class",
          });
          const superintendent = `amp|super-${randomUUID()}`;
          await schools.addStaff({
            orgId: district.id,
            role: "admin",
            givenName: "Root",
            accountId: superintendent,
          });
          const southAdmin = `amp|south-${randomUUID()}`;
          await schools.addStaff({
            orgId: south.id,
            role: "admin",
            givenName: "South",
            accountId: southAdmin,
          });
          assert.deepEqual(
            (
              await get(
                `/api/v1/school/orgs/${district.id}/classes`,
                as(superintendent),
              )
            )
              .json()
              .classes.map((c: { id: string }) => c.id),
            [northClass.id],
          );
          assert.equal(
            (await get(`/api/v1/school/orgs/${north.id}`, as(superintendent)))
              .statusCode,
            200,
          );
          for (const org of [north.id, district.id])
            assert.equal(
              (await get(`/api/v1/school/orgs/${org}`, as(southAdmin)))
                .statusCode,
              404,
            );
          // A district admin adding through the district lands in the class's school.
          const placed = await post(
            `/api/v1/school/orgs/${district.id}/students`,
            as(superintendent),
            { givenName: "Placed", classId: northClass.id },
          );
          assert.equal(placed.statusCode, 201);
          assert.equal(placed.json().student.orgId, north.id);

          // Role and enrollment dates are read on every request.
          const orgs = await get("/api/v1/school/orgs", as(teacher));
          assert.deepEqual(
            orgs.json().orgs.map((o: { id: string; roles: string[] }) => ({
              id: o.id,
              roles: o.roles,
            })),
            [{ id: home.orgId, roles: ["teacher"] }],
          );
          const { personId } = teacherPerson as { personId: string };
          await db.query(
            "UPDATE amp_enrollments SET end_on=begin_on WHERE person_id=$1",
            [personId],
          );
          assert.deepEqual(await rosterOf(teacher), []);
          await db.query(
            "UPDATE amp_enrollments SET end_on=NULL WHERE person_id=$1",
            [personId],
          );
          assert.equal((await rosterOf(teacher)).length, 2);
          await db.query(
            "UPDATE amp_org_roles SET end_on=begin_on WHERE person_id=$1",
            [personId],
          );
          assert.equal((await get(students, as(teacher))).statusCode, 404);
          assert.deepEqual(
            (await get("/api/v1/school/orgs", as(teacher))).json().orgs,
            [],
          );
          // `can` itself never passes a student, whatever the actor holds.
          const actor = await loadActor(db, viewer);
          assert.equal(
            can(actor, "org.read", {
              kind: "org",
              orgId: home.orgId,
              path: [home.orgId],
            }),
            true,
          );
          assert.equal(
            can(
              { ...actor, accountId: schoolAccountId(randomUUID()) },
              "org.read",
              { kind: "org", orgId: home.orgId, path: [home.orgId] },
            ),
            false,
          );
        },
      );
    } finally {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
