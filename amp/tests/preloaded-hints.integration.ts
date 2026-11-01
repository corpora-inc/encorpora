import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate";
import { PostgresRepository } from "../src/server/repository";
import { buildApp } from "../src/server/app";
import { generateProblem } from "../src/math/engine";
import { publicProblemSchema } from "../src/math/contracts";

const url = process.env.AMP_TEST_DATABASE_URL;
test(
  "preloaded hints stay separate from grading data; only revealed help affects durable, idempotent evidence",
  { skip: !url },
  async () => {
    await migrate(url!);
    const repository = new PostgresRepository(url!, { development: true });
    const account = `hints:${randomUUID()}`;
    const app = buildApp({
      repository,
      development: true,
      authenticate: async (request) =>
        String(request.headers["x-test-account"] ?? account),
    });
    try {
      const learner = await repository.create(account, "Hint learner", 2016);
      const base = `/api/v1/learners/${learner.id}`;
      const batch = await app.inject({
        method: "POST",
        url: `${base}/batches`,
        payload: { templateId: "add-within-20", count: 3 },
      });
      assert.equal(batch.statusCode, 200);
      const { problems, hints } = batch.json();
      assert.deepEqual(
        Object.keys(hints).sort(),
        problems.map((p: any) => p.id).sort(),
      );
      for (const p of problems) {
        publicProblemSchema.parse(p); // unchanged strict protocol for installed clients
        const generated = generateProblem(p.templateId, p.seed);
        // Teaching content only: the hint, its cue and its term cards.
        const { glossary, glossaryLexicon, ...support } = hints[p.id];
        assert.deepEqual(support, {
          hint: generated.hint,
          ...(generated.hintCue ? { cue: generated.hintCue } : {}),
        });
        assert.ok(Array.isArray(glossary) && glossaryLexicon);
        assert.ok(!("answer" in p) && !("explanation" in p));
        const stored = await repository.transaction(account, learner.id, (tx) =>
          tx.problem(p.id),
        );
        assert.equal(
          stored?.hintViewed,
          undefined,
          "preloading is not viewing",
        );
      }
      const body = (p: any, extra = {}) => ({
        problemId: p.id,
        requestId: randomUUID(),
        response: generateProblem(p.templateId, p.seed).answer,
        ...extra,
      });
      const independent = await app.inject({
        method: "POST",
        url: `${base}/attempts`,
        payload: body(problems[0]),
      });
      assert.equal(independent.json().assisted, false);
      const input = body(problems[1], { hintViewed: true });
      const [first, retry] = await Promise.all(
        [1, 2].map(() =>
          app.inject({
            method: "POST",
            url: `${base}/attempts`,
            payload: input,
          }),
        ),
      );
      assert.equal(first.statusCode, 200);
      assert.deepEqual(first.json(), retry.json());
      assert.equal(first.json().assisted, true);
      assert.equal(
        (
          await repository.transaction(account, learner.id, (tx) =>
            tx.problem(problems[1].id),
          )
        )?.hintViewed,
        true,
      );
      const unchanged = await app.inject({
        method: "POST",
        url: `${base}/attempts`,
        payload: { ...input, hintViewed: false },
      });
      assert.deepEqual(
        unchanged.json(),
        first.json(),
        "a retry cannot rewrite immutable evidence",
      );
      await app.inject({
        method: "POST",
        url: `${base}/hints`,
        payload: { problemId: problems[2].id },
      });
      const legacy = await app.inject({
        method: "POST",
        url: `${base}/attempts`,
        payload: body(problems[2], { hintViewed: false }),
      });
      assert.equal(
        legacy.json().assisted,
        true,
        "false cannot clear a server-recorded hint",
      );
      const progress = await app.inject({
        method: "GET",
        url: `${base}/progress`,
      });
      const evidence = progress
        .json()
        .skills.find((s: any) => s.skillId === problems[0].skillId);
      assert.equal(evidence.attempts, 3);
      assert.equal(evidence.independentCorrect, 1);
      const denied = await app.inject({
        method: "POST",
        url: `${base}/batches`,
        headers: { "x-test-account": "another-household" },
        payload: {},
      });
      assert.equal(denied.statusCode, 404);
    } finally {
      await app.close();
      await repository.close();
    }
  },
);
