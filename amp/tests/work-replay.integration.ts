import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import type { PublicProblem } from "../src/math/contracts.js";
import { generateProblem, templates } from "../src/math/engine.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import {
  studentRecordResponse,
  workReplayResponse,
} from "../src/schools/teacher-contracts.js";
import { problemDigest } from "../src/schools/work-replay.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* A student's answer, replayed for the staff who can read them: the same
   problem that was served (template, version, seed and digest), the answer
   as given, and nobody else's eyes. Every name is made up. */
test(
  "work replay: served problems replay exactly, only to who may read them",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_replay_${randomUUID().replaceAll("-", "")}`;
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
      seats: 10,
      endsAt: new Date(Date.now() + 200 * 86_400_000).toISOString(),
    });
    const ownClass = (await schools.createClass(org.id, {
      name: "Period 1",
    })) as { id: string };
    const otherClass = (await schools.createClass(org.id, {
      name: "Period 5",
    })) as { id: string };
    const student = await schools.provisionStudent(org.id, {
      givenName: "Tamsin",
      gradeLevel: 3,
      classId: ownClass.id,
    });
    const classmate = await schools.provisionStudent(org.id, {
      givenName: "Odile",
      gradeLevel: 3,
      classId: ownClass.id,
    });
    const teacher = async (name: string, classId: string) => {
      const account = `amp|teacher-${randomUUID()}`;
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,$2,$3,true,now(),now())`,
        [account.slice(4), name, `${account.slice(4)}@replay.example`],
      );
      await schools.addStaff({
        orgId: org.id,
        role: "teacher",
        givenName: name,
        accountId: account,
        classId,
      });
      return account;
    };
    const ownTeacher = await teacher("Rook", ownClass.id);
    const otherTeacher = await teacher("Fen", otherClass.id);
    const session = async (personId: string) =>
      (await schools.issueStudentSession({ personId, mode: "shared" })).token;
    const token = await session(student.personId);
    const classmateToken = await session(classmate.personId);

    // Two real problems through the practice API: one right, one missed.
    const learnerPath = `/api/v1/learners/${student.learnerId}`;
    const served = await post(`${learnerPath}/batches`, token, {
      templateId: "add-within-20",
      count: 2,
      figureCapabilities: ["scenes-v1"],
    });
    assert.equal(served.statusCode, 200, served.body);
    const [first, second] = served.json().problems as PublicProblem[];
    const answer = async (problem: PublicProblem, right: boolean) => {
      const stored = await learning.pool.query(
        "SELECT content->>'answer' AS answer FROM amp_instances WHERE id=$1",
        [problem.id],
      );
      const truth = stored.rows[0].answer as string;
      const response = right ? truth : String(Number(truth) + 1);
      const result = await post(`${learnerPath}/attempts`, token, {
        problemId: problem.id,
        requestId: randomUUID(),
        response,
        ...(right ? {} : { hintViewed: true }),
      });
      assert.equal(result.statusCode, 200, result.body);
      return { id: result.json().id as string, response, truth };
    };
    const right = await answer(first!, true);
    const missed = await answer(second!, false);
    const replayPath = (attempt: string, personId = student.personId) =>
      `/api/v1/school/students/${personId}/work/${encodeURIComponent(attempt)}`;

    await t.test(
      "the record's work rows carry the attempt id and its time",
      async () => {
        const record = await get(
          `/api/v1/school/students/${student.personId}/record`,
          ownTeacher,
        );
        assert.equal(record.statusCode, 200, record.body);
        const { work } = studentRecordResponse.parse(record.json());
        assert.deepEqual(
          work.map((item) => item.id),
          [missed.id, right.id],
        );
        assert.equal(work[0]!.prompt, second!.prompt);
        assert.ok(Date.parse(work[0]!.at) > 0);
        assert.equal(work[0]!.skill.length > 0, true);
      },
    );

    await t.test(
      "an attempt replays to the problem that was served",
      async () => {
        for (const [problem, given] of [
          [first!, right],
          [second!, missed],
        ] as const) {
          const response = await get(replayPath(given.id), ownTeacher);
          assert.equal(response.statusCode, 200, response.body);
          const replay = workReplayResponse.parse(response.json());
          const drawn = replay.problem as unknown as PublicProblem;
          assert.equal(replay.source, "served");
          assert.deepEqual(drawn, problem);
          assert.equal(drawn.prompt, problem.prompt);
          assert.deepEqual(replay.origin, {
            templateId: problem.templateId,
            version: problem.templateVersion,
            seed: problem.seed,
            digest: problemDigest(problem),
          });
          // The same template, version and seed draw the same problem again,
          // and the version is the catalog's, the one practice drew at.
          assert.equal(
            problemDigest(
              generateProblem(
                problem.templateId,
                problem.seed,
                problem.templateVersion,
              ).public,
            ),
            replay.origin!.digest,
          );
          assert.equal(
            problem.templateVersion,
            templates.find((t) => t.id === problem.templateId)!.version,
          );
          assert.equal(replay.outcome.response, given.response);
          assert.equal(replay.outcome.answer, given.truth);
          assert.equal(replay.student.first, "Tamsin");
        }
        const rightReplay = workReplayResponse.parse(
          (await get(replayPath(right.id), ownTeacher)).json(),
        );
        assert.equal(rightReplay.item.result, "independent");
        assert.equal(rightReplay.previous, null);
        assert.equal(rightReplay.next, missed.id);
        const missedReplay = workReplayResponse.parse(
          (await get(replayPath(missed.id), ownTeacher)).json(),
        );
        assert.equal(missedReplay.item.result, "missed");
        assert.equal(missedReplay.outcome.correct, false);
        assert.deepEqual(missedReplay.help, ["hint"]);
        assert.equal(missedReplay.previous, right.id);
        assert.equal(missedReplay.next, null);
        // Answered seconds apart: the time since the answer before.
        assert.ok(
          missedReplay.seconds !== null && missedReplay.seconds <= 60,
          String(missedReplay.seconds),
        );
        // Narrowed to another skill, there's nothing either side.
        const narrowed = workReplayResponse.parse(
          (
            await get(
              `${replayPath(missed.id)}?skill=count-objects`,
              ownTeacher,
            )
          ).json(),
        );
        assert.equal(narrowed.previous, null);
      },
    );

    await t.test(
      "only staff who can read the student see it; never a student",
      async () => {
        const refused = [
          await get(replayPath(right.id), otherTeacher),
          await get(replayPath(right.id), token),
          await get(replayPath(right.id), classmateToken),
          // Another student's address can't reach this student's answer.
          await get(replayPath(right.id, classmate.personId), ownTeacher),
          await get(replayPath("no-such-attempt"), ownTeacher),
        ];
        for (const response of refused) {
          assert.ok(
            [401, 403, 404].includes(response.statusCode),
            `${response.statusCode} ${response.body}`,
          );
          assert.ok(!response.body.includes(first!.seed));
        }
      },
    );

    await t.test(
      "an answer whose problem wasn't kept says so, and draws nothing",
      async () => {
        const id = randomUUID();
        await db.query(
          `INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3)`,
          [
            id,
            student.learnerId,
            JSON.stringify({
              public: {
                id,
                skillId: first!.skillId,
                templateId: "add-within-20",
                prompt: "",
                response: { kind: "number" },
              },
              answer: "1",
              explanation: [],
            }),
          ],
        );
        await db.query(
          `INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome) VALUES($1,$2,$3,$3,$4)`,
          [
            `${id}:a`,
            student.learnerId,
            id,
            JSON.stringify({
              id: `${id}:a`,
              problemId: id,
              requestId: id,
              skillId: first!.skillId,
              templateId: "add-within-20",
              correct: false,
              assisted: false,
              response: "0",
              answer: "1",
              explanation: [],
              createdAt: new Date().toISOString(),
            }),
          ],
        );
        const response = await get(replayPath(`${id}:a`), ownTeacher);
        assert.equal(response.statusCode, 200, response.body);
        const replay = workReplayResponse.parse(response.json());
        assert.equal(replay.source, "unavailable");
        assert.equal(replay.problem, null);
        assert.equal(replay.origin, null);
        assert.equal(replay.outcome.response, "0");
        assert.equal(replay.item.answer, "1");
        assert.equal(replay.previous, missed.id);
      },
    );
  },
);
