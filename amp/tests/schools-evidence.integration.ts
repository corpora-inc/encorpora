import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { FamilyRepository } from "../src/family/repository.js";
import { DEFAULT_FRONTIER_POLICY } from "../src/learning/frontier-policy.js";
import { schoolAccountId } from "../src/schools/principal.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

const YEAR_AHEAD = new Date(Date.now() + 365 * 86_400_000).toISOString();
const agreement = {
  version: "fixture-1",
  signerName: "Fixture Signer",
  signerTitle: "Head of School",
};
/** The calendar day of an instant in a zone, replayed independently of SQL. */
const dayIn = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));

test(
  "AMP for Schools evidence: rollups, level days, heartbeat and read routes",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_evidence_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const families = new FamilyRepository(db);
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();

    const as = (token: string) => ({ authorization: `Bearer ${token}` });
    const get = (path: string, token: string) =>
      app.inject({ method: "GET", url: path, headers: as(token) });
    const post = (path: string, token: string, payload: object = {}) =>
      app.inject({ method: "POST", url: path, headers: as(token), payload });
    async function school(name: string, timezone = "America/New_York") {
      const org = (await schoolAdmin(schools, "create-org", {
        kind: "school",
        name,
        timezone,
        agreement,
      })) as { id: string };
      await schoolAdmin(schools, "issue-license", {
        orgId: org.id,
        seats: 30,
        endsAt: YEAR_AHEAD,
      });
      return org.id;
    }
    async function enrolled(orgId: string, classId?: string) {
      const student = await schools.provisionStudent(orgId, {
        givenName: "Fixture",
        gradeLevel: 4,
        ...(classId ? { classId } : {}),
      });
      const { token } = await schools.issueStudentSession({
        personId: student.personId,
        mode: "shared",
      });
      return { ...student, token };
    }
    type Seed = {
      skill: string;
      at: string;
      correct: boolean;
      assisted?: boolean;
      weight?: number;
      reason?: string;
    };
    /** Writes an answer straight to the facts table, so the trigger is what
     * is under test. */
    async function seed(learnerId: string, s: Seed) {
      const id = randomUUID();
      await db.query(
        "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3)",
        [
          id,
          learnerId,
          { public: { id, skillId: s.skill }, selection: { reason: s.reason } },
        ],
      );
      await db.query(
        "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome) VALUES($1,$2,$3,$3,$4)",
        [
          randomUUID(),
          learnerId,
          id,
          {
            id,
            problemId: id,
            requestId: id,
            skillId: s.skill,
            templateId: "fixture-template",
            correct: s.correct,
            assisted: s.assisted ?? false,
            createdAt: s.at,
            ...(s.weight === undefined
              ? {}
              : { evidenceWeight: s.weight, evidenceSource: "paper" }),
          },
        ],
      );
    }
    const staff = async (
      orgId: string,
      role: "teacher" | "admin",
      classId?: string,
    ) => {
      const account = `amp|${role}-${randomUUID()}`;
      await schools.addStaff({
        orgId,
        role,
        givenName: "Fixture",
        accountId: account,
        ...(classId ? { classId } : {}),
      });
      return account;
    };
    const rows = async (table: string, learnerId: string) =>
      (
        await db.query(`SELECT * FROM ${table} WHERE learner_id=$1`, [
          learnerId,
        ])
      ).rows;

    try {
      const orgId = await school("Evidence School");
      const period = await schools.createClass(orgId, { name: "Period 1" });
      const student = await enrolled(orgId, period.id);
      const teacher = await staff(orgId, "teacher", period.id);

      await t.test(
        "rollup equals an aggregation replayed from amp_attempts, in the school's timezone",
        async () => {
          const seeds: Seed[] = [
            // 23:30 and 00:30 New York either side of a midnight (EDT).
            { skill: "add", at: "2026-03-10T03:30:00Z", correct: true },
            { skill: "add", at: "2026-03-10T04:30:00Z", correct: true },
            { skill: "add", at: "2026-03-10T15:00:00Z", correct: false },
            {
              skill: "add",
              at: "2026-03-10T15:05:00Z",
              correct: true,
              assisted: true,
            },
            {
              skill: "sub",
              at: "2026-03-10T15:10:00Z",
              correct: true,
              reason: "review",
            },
            {
              skill: "sub",
              at: "2026-03-10T15:11:00Z",
              correct: false,
              reason: "review",
            },
            {
              skill: "sub",
              at: "2026-03-11T15:00:00Z",
              correct: true,
              reason: "review",
            },
            // Paper: a parent's mark without the answer is practice, not
            // independent evidence; a graded answer is independent.
            {
              skill: "mul",
              at: "2026-03-11T16:00:00Z",
              correct: true,
              weight: 0.5,
            },
            {
              skill: "mul",
              at: "2026-03-11T16:01:00Z",
              correct: true,
              weight: 1,
            },
            {
              skill: "mul",
              at: "2026-03-12T16:01:00Z",
              correct: true,
              reason: "paper",
            },
          ];
          for (const s of seeds) await seed(student.learnerId, s);

          const expected = new Map<string, number[]>();
          for (const s of seeds) {
            const key = `${dayIn(s.at, "America/New_York")}|${s.skill}`;
            const independent =
              s.correct && !s.assisted && (s.weight ?? 1) >= 1;
            const review = s.reason === "review";
            const add = [
              1,
              +s.correct,
              +independent,
              +(s.assisted ?? false),
              +review,
              +(review && independent),
            ];
            const sum = expected.get(key) ?? [0, 0, 0, 0, 0, 0];
            expected.set(
              key,
              sum.map((n, i) => n + add[i]!),
            );
          }
          const actual = new Map(
            (await rows("amp_skill_days", student.learnerId)).map((r) => [
              `${new Date(r.day).toISOString().slice(0, 10)}|${r.skill_id}`,
              [
                r.attempts,
                r.correct,
                r.independent,
                r.assisted,
                r.review,
                r.review_independent,
              ],
            ]),
          );
          assert.deepEqual(actual, expected);
          // The midnight pair really landed on two days.
          assert.ok(
            actual.has("2026-03-09|add") && actual.has("2026-03-10|add"),
          );

          // Another zone reads the same instants as other days.
          const pacific = await school("Pacific School", "America/Los_Angeles");
          const west = await enrolled(pacific);
          await seed(west.learnerId, {
            skill: "add",
            at: "2026-03-10T06:59:00Z",
            correct: true,
          });
          await seed(west.learnerId, {
            skill: "add",
            at: "2026-03-10T07:01:00Z",
            correct: true,
          });
          assert.deepEqual(
            (await rows("amp_skill_days", west.learnerId))
              .map((r) => new Date(r.day).toISOString().slice(0, 10))
              .sort(),
            ["2026-03-09", "2026-03-10"],
          );
        },
      );

      await t.test("a family learner gets no rollup rows", async () => {
        const family = { id: randomUUID() };
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Kid',2016)",
          [family.id, `amp|family-${randomUUID()}`],
        );
        await seed(family.id, {
          skill: "add",
          at: "2026-03-10T15:00:00Z",
          correct: true,
        });
        for (const table of [
          "amp_skill_days",
          "amp_active_days",
          "amp_level_days",
        ])
          assert.equal((await rows(table, family.id)).length, 0, table);
      });

      await t.test(
        "the heartbeat clamps, credits the skill and refuses outsiders",
        async () => {
          const path = `/api/v1/learners/${student.learnerId}`;
          const batch = await post(`${path}/batches`, student.token, {
            templateId: "add-within-20",
            count: 1,
            figureCapabilities: ["scenes-v1"],
          });
          assert.equal(batch.statusCode, 200);
          const problem = batch.json().problems[0] as {
            id: string;
            skillId: string;
          };
          const url = "/api/v1/school/student/activity";
          const credited = async () =>
            Number(
              (
                await db.query(
                  "SELECT COALESCE(sum(active_ms),0) AS ms FROM amp_active_days WHERE learner_id=$1",
                  [student.learnerId],
                )
              ).rows[0].ms,
            );
          const age = (seconds: number) =>
            db.query(
              "UPDATE amp_student_sessions SET last_seen_at=now()-make_interval(secs=>$2) WHERE person_id=$1",
              [student.personId, seconds],
            );

          await age(20);
          const first = await post(url, student.token, {
            deltas: [
              { surface: "practice", problemId: problem.id, activeMs: 60_000 },
            ],
          });
          assert.equal(first.statusCode, 204);
          const afterFirst = await credited();
          // 20 s since last seen plus 5 s of slack.
          assert.ok(
            afterFirst >= 25_000 && afterFirst <= 27_000,
            String(afterFirst),
          );
          const bySkill = await db.query(
            "SELECT surface,skill_id FROM amp_active_days WHERE learner_id=$1",
            [student.learnerId],
          );
          assert.deepEqual(bySkill.rows, [
            { surface: "practice", skill_id: problem.skillId },
          ]);

          // Straight after: only the slack is left to claim, split across deltas.
          const second = await post(url, student.token, {
            deltas: [
              { surface: "map", activeMs: 90_000 },
              { surface: "lesson", activeMs: 90_000 },
            ],
          });
          assert.equal(second.statusCode, 204);
          const gained = (await credited()) - afterFirst;
          assert.ok(gained > 0 && gained <= 6_000, String(gained));

          // Never more than 90 s, however long the gap.
          await age(3_600);
          const before = await credited();
          await post(url, student.token, {
            deltas: [{ surface: "practice", activeMs: 90_000 }],
          });
          assert.equal((await credited()) - before, 90_000);

          // Another student's problem is not attributed to a skill.
          const other = await enrolled(orgId, period.id);
          await db.query(
            "UPDATE amp_student_sessions SET last_seen_at=now()-interval '10 seconds' WHERE person_id=$1",
            [other.personId],
          );
          const stolen = await post(url, other.token, {
            deltas: [
              { surface: "practice", problemId: problem.id, activeMs: 4_000 },
            ],
          });
          assert.equal(stolen.statusCode, 204);
          const mine = await rows("amp_active_days", other.learnerId);
          assert.deepEqual(
            mine.map((r) => r.skill_id),
            [""],
          );

          // Parent, staff and unknown or missing credentials are not students.
          const parent = `amp|parent-${randomUUID()}`;
          const body = { deltas: [{ surface: "practice", activeMs: 1_000 }] };
          for (const token of [parent, teacher, `st_${"A".repeat(43)}`])
            assert.equal((await post(url, token, body)).statusCode, 401, token);
          assert.equal(
            (await app.inject({ method: "POST", url, payload: body }))
              .statusCode,
            401,
          );
          // Shape is enforced.
          assert.equal(
            (
              await post(url, student.token, {
                deltas: Array.from({ length: 11 }, () => ({
                  surface: "other",
                  activeMs: 1,
                })),
              })
            ).statusCode,
            400,
          );
          assert.equal(
            (
              await post(url, student.token, {
                deltas: [{ surface: "tv", activeMs: 1 }],
              })
            ).statusCode,
            400,
          );
        },
      );

      await t.test(
        "a level day is written from /batches for a school student",
        async () => {
          // A focused batch plans without the frontier, so it stores no level.
          assert.equal(
            (await rows("amp_level_days", student.learnerId)).length,
            0,
          );
          await post(
            `/api/v1/learners/${student.learnerId}/batches`,
            student.token,
            { count: 1 },
          );
          const days = await rows("amp_level_days", student.learnerId);
          assert.equal(days.length, 1);
          const today = (
            await db.query(
              "SELECT (now() AT TIME ZONE 'America/New_York')::date::text AS d",
            )
          ).rows[0].d;
          assert.equal(new Date(days[0].day).toISOString().slice(0, 10), today);
          assert.equal(days[0].policy_version, DEFAULT_FRONTIER_POLICY.version);
          for (const key of ["level", "sd", "answered", "independent"])
            assert.equal(typeof days[0].frontier.overall[key], "number", key);
          assert.equal(typeof days[0].frontier.strands, "object");
          // A second batch the same day updates the row rather than adding one.
          await post(
            `/api/v1/learners/${student.learnerId}/batches`,
            student.token,
            { count: 1 },
          );
          assert.equal(
            (await rows("amp_level_days", student.learnerId)).length,
            1,
          );
        },
      );

      await t.test(
        "read routes: totals, per-day, per-skill, levels, validation and tenancy",
        async () => {
          await db.query("DELETE FROM amp_active_days WHERE learner_id=$1", [
            student.learnerId,
          ]);
          await db.query(
            "INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms) VALUES($1,'2026-03-10','practice','add',120000),($1,'2026-03-14','lesson','',30000)",
            [student.learnerId],
          );
          const query = "from=2026-03-01&to=2026-03-31";
          const klass = await get(
            `/api/v1/school/classes/${period.id}/activity?${query}`,
            teacher,
          );
          assert.equal(klass.statusCode, 200);
          const row = klass
            .json()
            .students.find(
              (s: { personId: string }) => s.personId === student.personId,
            );
          assert.equal(row.personId, student.personId);
          assert.equal(row.problems, 10);
          assert.equal(row.independent, 6);
          assert.equal(row.review, 3);
          assert.equal(row.reviewIndependent, 2);
          assert.equal(row.activeMinutes, 2.5);
          // Attempts on 9, 10, 11, 12 March and active time on the 14th.
          assert.equal(row.daysActive, 5);
          assert.equal(row.lastActive, "2026-03-14");
          // A narrower range narrows the totals; lastActive stays the latest.
          const narrow = await get(
            `/api/v1/school/classes/${period.id}/activity?from=2026-03-10&to=2026-03-10`,
            teacher,
          );
          assert.equal(
            narrow
              .json()
              .students.find(
                (s: { personId: string }) => s.personId === student.personId,
              ).problems,
            5,
          );

          const one = await get(
            `/api/v1/school/students/${student.personId}/activity?${query}`,
            teacher,
          );
          assert.equal(one.statusCode, 200);
          const detail = one.json();
          assert.equal(detail.totals.problems, 10);
          assert.deepEqual(
            detail.days.map((d: { day: string }) => d.day),
            [
              "2026-03-09",
              "2026-03-10",
              "2026-03-11",
              "2026-03-12",
              "2026-03-14",
            ],
          );
          const skills = Object.fromEntries(
            detail.skills.map((s: { skillId: string; problems: number }) => [
              s.skillId,
              s.problems,
            ]),
          );
          assert.deepEqual(skills, { "": 0, add: 4, mul: 3, sub: 3 });

          const levels = await get(
            `/api/v1/school/classes/${period.id}/levels`,
            teacher,
          );
          assert.equal(levels.statusCode, 200);
          assert.equal(levels.json().students.length, 1);
          assert.equal(
            levels.json().students[0].policyVersion,
            DEFAULT_FRONTIER_POLICY.version,
          );
          const early = await get(
            `/api/v1/school/classes/${period.id}/levels?on=2020-01-01`,
            teacher,
          );
          assert.deepEqual(early.json().students, []);
          const late = await get(
            `/api/v1/school/classes/${period.id}/levels?on=2999-01-01`,
            teacher,
          );
          assert.equal(late.json().students.length, 1);

          for (const bad of [
            "",
            "from=2026-03-01",
            "from=2026-03-31&to=2026-03-01",
            "from=x&to=y",
            "from=2020-01-01&to=2026-03-01",
          ])
            assert.equal(
              (
                await get(
                  `/api/v1/school/classes/${period.id}/activity?${bad}`,
                  teacher,
                )
              ).statusCode,
              400,
              bad,
            );
          assert.equal(
            (
              await get(
                `/api/v1/school/classes/${period.id}/levels?on=nope`,
                teacher,
              )
            ).statusCode,
            400,
          );

          // Another tenant's teacher, a teacher of another class, and a student.
          const awayOrg = await school("Away School");
          const awayClass = await schools.createClass(awayOrg, {
            name: "Away",
          });
          const stranger = await staff(awayOrg, "teacher", awayClass.id);
          const sibling = await schools.createClass(orgId, {
            name: "Period 2",
          });
          const otherTeacher = await staff(orgId, "teacher", sibling.id);
          const paths = [
            `/api/v1/school/classes/${period.id}/activity?${query}`,
            `/api/v1/school/classes/${period.id}/levels`,
            `/api/v1/school/students/${student.personId}/activity?${query}`,
          ];
          for (const who of [stranger, otherTeacher, student.token])
            for (const path of paths)
              assert.equal(
                (await get(path, who)).statusCode,
                who === student.token ? 401 : 404,
                `${who} ${path}`,
              );
          // The school's admin reads all of it.
          const principal = await staff(orgId, "admin");
          for (const path of paths)
            assert.equal((await get(path, principal)).statusCode, 200, path);
        },
      );

      await t.test("deleting the learner cascades every rollup", async () => {
        for (const table of [
          "amp_skill_days",
          "amp_active_days",
          "amp_level_days",
        ])
          assert.ok((await rows(table, student.learnerId)).length > 0, table);
        await families.deleteLearning(
          schoolAccountId(student.personId),
          student.learnerId,
        );
        for (const table of [
          "amp_skill_days",
          "amp_active_days",
          "amp_level_days",
        ])
          assert.equal((await rows(table, student.learnerId)).length, 0, table);
      });
    } finally {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
