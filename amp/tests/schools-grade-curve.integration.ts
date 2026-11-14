import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
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
const DAY = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) =>
  new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

test(
  "AMP for Schools: the teacher's grade curve, stored per term and frozen with it",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_curve_${randomUUID().replaceAll("-", "")}`;
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
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();

    const as = (token: string) => ({ authorization: `Bearer ${token}` });
    const get = (path: string, token: string) =>
      app.inject({ method: "GET", url: path, headers: as(token) });
    const post = (path: string, token: string, payload: object = {}) =>
      app.inject({ method: "POST", url: path, headers: as(token), payload });

    async function school(name: string) {
      const org = (await schoolAdmin(schools, "create-org", {
        kind: "school",
        name,
        timezone: "UTC",
        agreement,
      })) as { id: string };
      await schoolAdmin(schools, "issue-license", {
        orgId: org.id,
        seats: 100,
        endsAt: YEAR_AHEAD,
      });
      return org.id;
    }
    /** A year around today, split into two terms that meet at `boundary`. */
    async function calendar(orgId: string) {
      const year = randomUUID(),
        first = randomUUID(),
        second = randomUUID();
      const insert = (
        id: string,
        parent: string | null,
        kind: string,
        name: string,
        from: string,
        to: string,
      ) =>
        db.query(
          `INSERT INTO amp_academic_sessions(id,org_id,parent_id,kind,name,starts_on,ends_on)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [id, orgId, parent, kind, name, from, to],
        );
      await insert(
        year,
        null,
        "year",
        "This year",
        daysAgo(120),
        daysAgo(-180),
      );
      await insert(
        first,
        year,
        "semester",
        "Semester 1",
        daysAgo(120),
        daysAgo(-30),
      );
      await insert(
        second,
        year,
        "semester",
        "Semester 2",
        daysAgo(-29),
        daysAgo(-180),
      );
      return { year, first, second };
    }
    const staff = async (
      orgId: string,
      role: "teacher" | "admin" | "viewer" | "aide",
      classId?: string,
    ) => {
      const account = `amp|${role}-${randomUUID()}`;
      await schools.addStaff({
        orgId,
        role,
        givenName: "Fixture",
        familyName: role,
        accountId: account,
        ...(classId ? { classId } : {}),
      });
      return account;
    };
    let fixtureIds = 0;
    /** Enrolled from `from`: the seat and learner are real; the date is set back. */
    async function student(
      orgId: string,
      classId: string,
      givenName: string,
      options: { from?: string; identifier?: string; grade?: number } = {},
    ) {
      // A fixed id per student, in the order they're made: the curve's
      // simulated draws are seeded from it, so a run is reproducible.
      const made = await schools.transaction((client) =>
        schools.provisionStudentIn(
          client,
          orgId,
          {
            givenName,
            familyName: "Fixture",
            gradeLevel: options.grade ?? 5,
            classId,
            ...(options.identifier ? { identifier: options.identifier } : {}),
          },
          null,
          new Date(),
          `00000000-0000-4000-8000-${String(++fixtureIds).padStart(12, "0")}`,
        ),
      );
      const from = options.from ?? daysAgo(100);
      await db.query(
        "UPDATE amp_enrollments SET begin_on=$2 WHERE person_id=$1 AND class_id=$3",
        [made.personId, from, classId],
      );
      await db.query(
        "UPDATE amp_org_roles SET begin_on=$2 WHERE person_id=$1",
        [made.personId, from],
      );
      return made;
    }
    type Answer = {
      skill: string;
      at: string;
      correct: boolean;
      assisted?: boolean;
      reason?: string;
      template?: string;
    };
    /** An answer in the facts table, as the app stores one; the trigger rolls it up. */
    async function answer(learnerId: string, a: Answer) {
      const id = randomUUID();
      await db.query(
        "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3)",
        [
          id,
          learnerId,
          {
            public: {
              id,
              skillId: a.skill,
              prompt: "What is 2/3 + 1/6?",
              response: { kind: "fraction", label: "Your answer" },
            },
            answer: "5/6",
            selection: { reason: a.reason },
          },
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
            skillId: a.skill,
            templateId: a.template ?? "fixture-template",
            correct: a.correct,
            assisted: a.assisted ?? false,
            response: a.correct ? "5/6" : "3/9",
            answer: "5/6",
            createdAt: a.at,
          },
        ],
      );
    }
    const levelDay = (learnerId: string, day: string, level: number) =>
      db.query(
        `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'fixture')
         ON CONFLICT(learner_id,day) DO UPDATE SET frontier=EXCLUDED.frontier`,
        [
          learnerId,
          day,
          {
            overall: { level, sd: 0.3, answered: 200, independent: 150 },
            strands: {
              fractions: { level, sd: 0.4, answered: 90, independent: 60 },
              number: { level, sd: 0.4, answered: 110, independent: 90 },
            },
          },
        ],
      );
    const activeDay = (learnerId: string, day: string, minutes: number) =>
      db.query(
        `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms) VALUES($1,$2,'practice','',$3)
         ON CONFLICT(learner_id,day,surface,skill_id) DO UPDATE SET active_ms=EXCLUDED.active_ms`,
        [learnerId, day, minutes * 60_000],
      );
    /** A steady term: time most weeks, review answers, a level that rises. */
    async function steady(learnerId: string, from: number, gain = 0.4) {
      await levelDay(learnerId, daysAgo(from), 4.6);
      await levelDay(learnerId, daysAgo(2), 4.6 + gain);
      for (let n = from; n > 2; n -= 3)
        await activeDay(learnerId, daysAgo(n), 25);
      for (let n = 0; n < 8; n++)
        await answer(learnerId, {
          skill: "fraction-addition",
          at: new Date(Date.now() - (from - n) * DAY).toISOString(),
          correct: n % 4 !== 3,
          reason: "review",
        });
    }

    t.after(async () => {
      await app.close();
      await learning.pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const home = await school("Alder Street School");
    const sessions = await calendar(home);
    const klass = (await schools.createClass(home, {
      name: "Grade 5 Math",
      courseBands: ["5"],
      gradingKind: "semester",
      sessionId: sessions.year,
    })) as { id: string };
    const teacher = await staff(home, "teacher", klass.id);
    const viewer = await staff(home, "viewer");
    const CLASS = `/api/v1/school/classes/${klass.id}`;
    /** A term's work at a level: time every third day, reviews, a rise. */
    async function worked(learnerId: string, at: number, gain: number) {
      await levelDay(learnerId, daysAgo(100), at);
      await levelDay(learnerId, daysAgo(2), at + gain);
      for (let n = 100; n > 2; n -= 3)
        await activeDay(learnerId, daysAgo(n), 25);
      for (let n = 0; n < 12; n++)
        await answer(learnerId, {
          skill: "fraction-addition",
          at: new Date(Date.now() - (100 - n) * DAY).toISOString(),
          correct: n % 4 !== 3,
          reason: "review",
        });
    }
    const names = ["Ana", "Ben", "Cyd", "Dee", "Eli", "Fay"];
    const people: Record<string, { personId: string; learnerId: string }> = {};
    for (const [index, name] of names.entries()) {
      people[name] = await student(home, klass.id, name);
      await worked(
        people[name]!.learnerId,
        5.2 - index * 0.35,
        0.5 - index * 0.06,
      );
    }
    // Enrolled, with no work: never ranked.
    people.Gus = await student(home, klass.id, "Gus");

    type Book = {
      term: { id: string };
      curve: {
        own: unknown;
        proposed: { size: number; ranges: Record<string, [number, number]> };
      } | null;
      students: {
        first: string;
        suggestion: {
          status: string;
          low: number | null;
          high: number | null;
          letters: string | null;
          curve: {
            ranked: number;
            rankLow: number;
            rankHigh: number;
            letters: Record<string, number>;
          } | null;
        };
      }[];
    };
    const book = async (): Promise<Book> => {
      const response = await get(`${CLASS}/gradebook`, teacher);
      assert.equal(response.statusCode, 200, response.body);
      return response.json();
    };
    const row = (data: Book, first: string) =>
      data.students.find((entry) => entry.first === first)!;
    const CURVE = {
      size: 7,
      ranges: { A: [1, 2], B: [2, 3], C: [1, 3], D: [0, 1], F: [0, 1] },
    };
    const setCurve = (curve: unknown, token = teacher, term = sessions.first) =>
      post(`${CLASS}/gradebook/curve`, token, { term, curve });

    await t.test(
      "without a curve the standard scale stands, with a proposal from the class",
      async () => {
        const data = await book();
        assert.equal(data.curve!.own, null);
        assert.equal(data.curve!.proposed.size, 7);
        const ranges = Object.values(data.curve!.proposed.ranges);
        assert.ok(ranges.reduce((sum, [low]) => sum + low, 0) <= 7);
        assert.ok(ranges.reduce((sum, [, high]) => sum + high, 0) >= 7);
        assert.equal(row(data, "Ana").suggestion.status, "ready");
        assert.equal(row(data, "Ana").suggestion.curve, null);
        assert.equal(row(data, "Gus").suggestion.status, "not-enough-work");
      },
    );

    await t.test(
      "a curve that can't hold the class is refused, and so is a reader",
      async () => {
        const impossible = await setCurve({
          size: 7,
          ranges: { A: [3, 3], B: [3, 3], C: [2, 3], D: [0, 0], F: [0, 0] },
        });
        assert.equal(impossible.statusCode, 400, impossible.body);
        assert.equal((await setCurve(CURVE, viewer)).statusCode, 404);
        assert.equal(
          (await setCurve(CURVE, teacher, sessions.second)).statusCode,
          404,
        );
      },
    );

    await t.test(
      "a saved curve is stored beside the class's settings and ranks the class",
      async () => {
        // The weekly target lives in the same row; neither write may drop the other.
        assert.equal(
          (await post(`${CLASS}/target`, teacher, { minutes: 90 })).statusCode,
          200,
        );
        const saved = await setCurve(CURVE);
        assert.equal(saved.statusCode, 200, saved.body);
        assert.equal(
          (await post(`${CLASS}/target`, teacher, { minutes: 75 })).statusCode,
          200,
        );
        const stored = (
          await db.query(
            `SELECT "values" FROM amp_scope_settings WHERE scope_kind='class' AND scope_id=$1`,
            [klass.id],
          )
        ).rows[0].values;
        assert.equal(stored.weeklyTargetMinutes, 75);
        assert.deepEqual(stored.gradeCurves, { [sessions.first]: CURVE });
        const event = (
          await db.query(
            "SELECT detail FROM amp_school_events WHERE action='grade.curve-set' AND target_id=$1",
            [klass.id],
          )
        ).rows;
        assert.equal(event.length, 1);
        assert.deepEqual(event[0].detail.after, {
          curve: CURVE,
          sessionId: sessions.first,
        });

        const data = await book();
        assert.deepEqual(data.curve!.own, CURVE);
        const ranked = names.map((name) => row(data, name).suggestion);
        for (const suggestion of ranked) {
          assert.equal(suggestion.curve!.ranked, 6);
          assert.ok(suggestion.low! <= suggestion.high!);
        }
        assert.equal(ranked[0]!.curve!.rankLow, 1);
        // Each grade is an 80% interval from simulated draws: the strongest
        // student's sits above the weakest's at both ends and in the middle.
        // Intervals may overlap (both are uncertain); they never invert.
        const [strongest, weakest] = [ranked[0]!, ranked[5]!];
        assert.ok(
          strongest.low! >= weakest.low! &&
            strongest.high! >= weakest.high! &&
            strongest.low! + strongest.high! > weakest.low! + weakest.high!,
          "the strongest is graded above the weakest",
        );
        assert.equal(row(data, "Gus").suggestion.curve, null);
        // Seeded: a second read is the same, to the draw.
        assert.deepEqual(await book(), data);

        const evidence = (
          await get(
            `${CLASS}/students/${people.Ana!.personId}/evidence?term=${sessions.first}`,
            teacher,
          )
        ).json();
        assert.match(
          evidence.basis,
          /^Ranks 1st( to \d+(st|nd|rd|th))? of 6 on the composite; your curve gives that (place|band) an? [A-F][+−]?( to [A-F][+−]?)?\.$/,
        );
      },
    );

    await t.test("clearing the curve returns the standard scale", async () => {
      assert.equal((await setCurve(null)).statusCode, 200);
      const data = await book();
      assert.equal(data.curve!.own, null);
      assert.equal(row(data, "Ana").suggestion.curve, null);
      assert.equal(
        (
          await db.query(
            `SELECT "values"->'gradeCurves' AS curves FROM amp_scope_settings WHERE scope_kind='class' AND scope_id=$1`,
            [klass.id],
          )
        ).rows[0].curves[sessions.first],
        undefined,
      );
      assert.equal((await setCurve(CURVE)).statusCode, 200);
    });

    await t.test(
      "closing the term freezes inputs, curve and policy version",
      async () => {
        const open = await book();
        const closed = await post(`${CLASS}/gradebook/close`, teacher, {
          term: sessions.first,
        });
        assert.equal(closed.statusCode, 200, closed.body);
        const frozen = (
          await db.query(
            "SELECT suggested FROM amp_term_grades WHERE class_id=$1 AND session_id=$2 AND person_id=$3",
            [klass.id, sessions.first, people.Ana!.personId],
          )
        ).rows[0].suggested;
        assert.equal(frozen.policyVersion, "school-grades-v4");
        assert.deepEqual(frozen.curve.teacher, CURVE);
        assert.equal(typeof frozen.inputs.endLevel.sd, "number");
        const closeEvent = (
          await db.query(
            "SELECT detail FROM amp_school_events WHERE action='term.closed' AND target_id=$1",
            [klass.id],
          )
        ).rows[0].detail;
        assert.equal(closeEvent.after.policyVersion, "school-grades-v4");

        // Nothing that changes afterwards reaches it: the stored curve, new work.
        assert.equal(
          (await setCurve({ ...CURVE, ranges: { ...CURVE.ranges, A: [0, 0] } }))
            .statusCode,
          409,
        );
        await db.query(
          `UPDATE amp_scope_settings SET "values"="values"-'gradeCurves' WHERE scope_kind='class' AND scope_id=$1`,
          [klass.id],
        );
        await worked(people.Fay!.learnerId, 6.5, 0.4);
        const after = await book();
        assert.deepEqual(after.curve!.own, CURVE);
        for (const name of names)
          assert.deepEqual(
            { ...row(after, name).suggestion },
            { ...row(open, name).suggestion },
            name,
          );
      },
    );

    await t.test(
      "report cards and exports carry the final grade, never the curve",
      async () => {
        const cards = await get(
          `${CLASS}/report-cards?term=${sessions.first}`,
          teacher,
        );
        assert.equal(cards.statusCode, 200, cards.body);
        assert.doesNotMatch(cards.body, /rank|curve|letters/i);
        const csv = await get(
          `${CLASS}/exports/gradebook.csv?term=${sessions.first}`,
          teacher,
        );
        assert.equal(csv.statusCode, 200);
        assert.doesNotMatch(csv.body.split("\n")[0]!, /rank|curve/i);
        const roster = await get(
          `${CLASS}/exports/oneroster.zip?term=${sessions.first}`,
          teacher,
        );
        assert.equal(roster.statusCode, 200);
        assert.doesNotMatch(
          roster.rawPayload.toString("latin1"),
          /rank|curve/i,
        );
      },
    );
  },
);
