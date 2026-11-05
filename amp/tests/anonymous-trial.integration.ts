import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { generateProblem } from "../src/math/engine.js";
import {
  ANONYMOUS_FREE_PROBLEMS,
  purgeExpiredTrials,
  SIGN_IN_TO_CONTINUE,
} from "../src/server/trials.js";

test(
  "hosted: a visitor answers one problem without an account; sign-in claims it and practice continues",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    assert.equal(ANONYMOUS_FREE_PROBLEMS, 1);
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_anonymous_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href);
    // Hosted mode. A parent's session is a cookie, sent alongside the
    // `Authorization: Trial` capability, as the browser does.
    const app = buildApp({
      repository,
      development: false,
      authenticate: async (request) => {
        const parent = request.headers.cookie?.match(/^session=(\S+)$/)?.[1];
        if (!parent)
          throw Object.assign(new Error("Sign in to continue"), {
            statusCode: 401,
          });
        return `parent-${parent}`;
      },
    });
    type Headers = Record<string, string>;
    const call = (
      method: "GET" | "POST",
      path: string,
      headers: Headers,
      payload?: object,
    ) => app.inject({ method, url: `/api/v1${path}`, headers, payload });
    const startAnonymous = async () => {
      const created = await call(
        "POST",
        "/trials",
        {},
        {
          birthYear: 2016,
          anonymous: true,
        },
      );
      assert.equal(created.statusCode, 201, created.body);
      return created.json() as { token: string; learnerId: string };
    };
    const correct = (problem: { templateId: string; seed: string }) =>
      generateProblem(problem.templateId, problem.seed).answer;
    const answerOne = async (learnerId: string, headers: Headers) => {
      const batch = await call(
        "POST",
        `/learners/${learnerId}/batches`,
        headers,
        {
          count: 1,
        },
      );
      assert.equal(batch.statusCode, 200, batch.body);
      const problem = batch.json().problems[0];
      const attempt = await call(
        "POST",
        `/learners/${learnerId}/attempts`,
        headers,
        {
          problemId: problem.id,
          requestId: randomUUID(),
          response: correct(problem),
        },
      );
      assert.equal(attempt.statusCode, 200, attempt.body);
      return problem;
    };
    const signIn =
      (expected: object) =>
      (response: { statusCode: number; json: () => unknown }) => {
        assert.equal(response.statusCode, 401);
        assert.deepEqual(response.json(), expected);
      };
    const saveToContinue = signIn({ error: SIGN_IN_TO_CONTINUE });
    const signedOut = signIn({ error: "Sign in to continue" });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);

      // The current web client never asks for an unowned trial: without a
      // session and without `anonymous: true`, creation still needs sign-in.
      signedOut(await call("POST", "/trials", {}, { birthYear: 2016 }));
      assert.equal(
        (
          await call(
            "POST",
            "/trials",
            {},
            { birthYear: 2016, anonymous: false },
          )
        ).statusCode,
        401,
      );

      const visitor = await startAnonymous();
      assert.match(visitor.token, /^[A-Za-z0-9_-]{40,}$/);
      const anon = { authorization: `Trial ${visitor.token}` };
      const base = `/learners/${visitor.learnerId}`;
      // Only a birth year and a random token: no name, no owner.
      const stored = await repository.pool.query(
        `SELECT t.owner_account_id,l.name,l.birth_year FROM amp_trials t
         JOIN amp_learners l ON l.id=t.learner_id WHERE l.id=$1`,
        [visitor.learnerId],
      );
      assert.deepEqual(stored.rows, [
        { owner_account_id: null, name: "Trial", birth_year: 2016 },
      ]);

      // The reads the first problem needs.
      const progress = await call("GET", `${base}/trial-progress`, anon);
      assert.equal(progress.statusCode, 200, progress.body);
      assert.equal(progress.json().totals.answered, 0);
      assert.equal(
        (await call("GET", `${base}/practice-state`, anon)).statusCode,
        200,
      );
      assert.deepEqual(
        (await call("GET", "/learners", anon))
          .json()
          .learners.map((l: { id: string }) => l.id),
        [visitor.learnerId],
      );

      // One problem, never a prefetched second; a reload gets the same one.
      const first = await call("POST", `${base}/batches`, anon, { count: 3 });
      assert.equal(first.statusCode, 200, first.body);
      assert.equal(first.json().problems.length, 1);
      const problem = first.json().problems[0];
      assert.equal(problem.answer, undefined);
      assert.ok(first.json().hints[problem.id]);
      const reload = await call("POST", `${base}/batches`, anon, { count: 3 });
      assert.equal(reload.statusCode, 200, reload.body);
      assert.deepEqual(
        reload.json().problems.map((p: { id: string }) => p.id),
        [problem.id],
      );
      // Help on that problem is part of answering it.
      assert.equal(
        (await call("POST", `${base}/hints`, anon, { problemId: problem.id }))
          .statusCode,
        200,
      );
      // Skipping it would end the free problem without an answer: sign in.
      saveToContinue(
        await call("POST", `${base}/skips`, anon, { problemId: problem.id }),
      );

      const requestId = randomUUID();
      const answered = await call("POST", `${base}/attempts`, anon, {
        problemId: problem.id,
        requestId,
        response: correct(problem),
      });
      assert.equal(answered.statusCode, 200, answered.body);
      assert.equal(answered.json().correct, true);
      assert.equal(answered.json().assisted, true, "the hint was recorded");
      // A retried submission returns the same answer.
      const retried = await call("POST", `${base}/attempts`, anon, {
        problemId: problem.id,
        requestId,
        response: correct(problem),
      });
      assert.equal(retried.statusCode, 200, retried.body);
      assert.equal(retried.json().id, answered.json().id);

      // Everything after the first answer asks the visitor to sign in.
      saveToContinue(await call("POST", `${base}/batches`, anon, { count: 1 }));
      saveToContinue(
        await call("POST", `${base}/attempts`, anon, {
          problemId: problem.id,
          requestId: randomUUID(),
          response: correct(problem),
        }),
      );
      for (const [method, path, payload] of [
        ["POST", `${base}/skips`, { problemId: problem.id }],
        ["POST", `${base}/practice-state`, { kind: "reset" }],
        ["POST", `${base}/trial-paywall`, {}],
        ["POST", `${base}/problem-flags`, { problemId: problem.id }],
        ["POST", `${base}/starting-point`, { band: "early" }],
        ["POST", `${base}/birth-year`, { birthYear: 2015 }],
        ["POST", `${base}/practice-settings`, { satMathFocus: true }],
        ["GET", `${base}/workbooks`, undefined],
        ["GET", `${base}/workbooks/areas`, undefined],
        ["POST", `${base}/workbooks`, {}],
        ["GET", `${base}/workbooks/${randomUUID()}/pdf`, undefined],
        ["GET", `${base}/publications/any/lesson`, undefined],
        ["POST", "/learners", { name: "Someone" }],
      ] as const)
        saveToContinue(await call(method, path, anon, payload));
      // The anonymous trial still holds exactly one served problem and one answer.
      const counts = await repository.pool.query(
        `SELECT (SELECT count(*)::int FROM amp_instances WHERE learner_id=$1) AS served,
                (SELECT count(*)::int FROM amp_attempts WHERE learner_id=$1) AS answers`,
        [visitor.learnerId],
      );
      assert.deepEqual(counts.rows[0], { served: 1, answers: 1 });
      // Reads stay available, so the screen can show the result.
      const after = await call("GET", `${base}/trial-progress`, anon);
      assert.equal(after.statusCode, 200);
      assert.equal(after.json().totals.answered, 1);

      // Sign-in claims the trial: problem 2 is served with answer 1 counted.
      const parentA = { cookie: "session=a" };
      const claimed = await call("POST", "/trials/current", parentA, {
        token: visitor.token,
      });
      assert.equal(claimed.statusCode, 200, claimed.body);
      assert.equal(claimed.json().claim, "claimed");
      const owned = claimed.json().trial;
      assert.equal(owned.learnerId, visitor.learnerId);
      assert.equal(owned.birthYear, 2016);
      assert.notEqual(owned.token, visitor.token);
      const parentTrial = { ...parentA, authorization: `Trial ${owned.token}` };
      const second = await call("POST", `${base}/batches`, parentTrial, {
        count: 1,
      });
      assert.equal(second.statusCode, 200, second.body);
      assert.notEqual(second.json().problems[0].id, problem.id);
      const resumed = await call("GET", `${base}/trial-progress`, parentTrial);
      assert.equal(resumed.json().totals.answered, 1);
      // A reload re-sends whichever token the device holds: no second claim.
      for (const token of [owned.token, visitor.token]) {
        const again = await call("POST", "/trials/current", parentA, { token });
        assert.equal(again.json().claim, "owned");
        assert.equal(again.json().trial.learnerId, visitor.learnerId);
      }
      // Without a token the response is unchanged.
      assert.deepEqual(
        Object.keys(
          (await call("POST", "/trials/current", parentA, {})).json(),
        ),
        ["trial"],
      );

      // The claimed token no longer works without that parent's session.
      signedOut(await call("POST", `${base}/batches`, anon, { count: 1 }));
      signedOut(await call("GET", `${base}/trial-progress`, anon));
      const parentB = { cookie: "session=b" };
      assert.equal(
        (
          await call(
            "POST",
            `${base}/batches`,
            { ...parentB, ...anon },
            {
              count: 1,
            },
          )
        ).statusCode,
        401,
      );
      assert.deepEqual(
        (
          await call("POST", "/trials/current", parentB, {
            token: visitor.token,
          })
        ).json(),
        { trial: null, claim: "unavailable" },
      );

      // A returning parent keeps their trial; a newer visitor trial is not
      // merged into it and is left to expire.
      const later = await startAnonymous();
      const laterAnon = { authorization: `Trial ${later.token}` };
      await answerOne(later.learnerId, laterAnon);
      const returning = await call("POST", "/trials/current", parentA, {
        token: later.token,
      });
      assert.equal(returning.json().claim, "kept-existing");
      assert.equal(returning.json().trial.learnerId, visitor.learnerId);
      assert.equal(
        (
          await repository.pool.query(
            "SELECT owner_account_id FROM amp_trials WHERE learner_id=$1",
            [later.learnerId],
          )
        ).rows[0].owner_account_id,
        null,
      );
      saveToContinue(
        await call("POST", `/learners/${later.learnerId}/batches`, laterAnon, {
          count: 1,
        }),
      );

      // An expired visitor trial: practice asks for sign-in; claiming it is
      // a clean empty result.
      const expired = await startAnonymous();
      await repository.pool.query(
        "UPDATE amp_trials SET expires_at=now()-interval '1 second' WHERE learner_id=$1",
        [expired.learnerId],
      );
      signedOut(
        await call(
          "POST",
          `/learners/${expired.learnerId}/batches`,
          { authorization: `Trial ${expired.token}` },
          { count: 1 },
        ),
      );
      assert.deepEqual(
        (
          await call(
            "POST",
            "/trials/current",
            { cookie: "session=c" },
            {
              token: expired.token,
            },
          )
        ).json(),
        { trial: null, claim: "unavailable" },
      );

      // Signed in from the start: an owned trial, no one-problem limit.
      const parentD = { cookie: "session=d" };
      const ownedStart = await call("POST", "/trials", parentD, {
        birthYear: 2014,
      });
      assert.equal(ownedStart.statusCode, 201, ownedStart.body);
      const ownedTrial = ownedStart.json();
      const ownedHeaders = {
        ...parentD,
        authorization: `Trial ${ownedTrial.token}`,
      };
      const batch = await call(
        "POST",
        `/learners/${ownedTrial.learnerId}/batches`,
        ownedHeaders,
        { count: 3 },
      );
      assert.equal(batch.statusCode, 200, batch.body);
      assert.equal(batch.json().problems.length, 3);
      await answerOne(ownedTrial.learnerId, ownedHeaders);
      await answerOne(ownedTrial.learnerId, ownedHeaders);
      // An account's trial id is not a visitor token.
      signedOut(
        await call(
          "POST",
          `/learners/${ownedTrial.learnerId}/batches`,
          { authorization: `Trial ${ownedTrial.token}` },
          { count: 1 },
        ),
      );

      // Retention: unclaimed visitor trials, answers included, are deleted
      // when they expire; the claimed trial stays with its parent.
      await repository.pool.query(
        "UPDATE amp_trials SET expires_at=now()-interval '1 second' WHERE learner_id=$1",
        [later.learnerId],
      );
      assert.equal(await purgeExpiredTrials(repository.pool), 2);
      const left = await repository.pool.query(
        `SELECT l.id,(SELECT count(*)::int FROM amp_attempts a WHERE a.learner_id=l.id) AS answers
         FROM amp_learners l WHERE l.id=ANY($1) ORDER BY l.id`,
        [[visitor.learnerId, later.learnerId, expired.learnerId]],
      );
      assert.deepEqual(left.rows, [{ id: visitor.learnerId, answers: 1 }]);
      assert.equal(
        (
          await repository.pool.query(
            "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
            [later.learnerId],
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
