import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { measurementTemplates } from "../src/math/measurement-practice.js";
import { generateProblemFor } from "../src/math/engine.js";
import type { FigureCapability } from "../src/math/contracts.js";
import { sceneCapabilitiesIn } from "../src/math/scene/index.js";
const url = process.env.AMP_TEST_DATABASE_URL;

const clients: { name: string; figureCapabilities: FigureCapability[] }[] = [
  { name: "legacy", figureCapabilities: ["measurement-models-v1"] },
  {
    name: "scene-capable",
    figureCapabilities: ["measurement-models-v1", "scenes-v2"],
  },
];

for (const client of clients)
  test(
    `${client.name} measurement figures require advertised client support and preserve owned immutable grading`,
    { skip: !url },
    async () => {
      await migrate(url!);
      const repository = new PostgresRepository(url!, { development: true });
      const account = `measurement:${randomUUID()}`;
      const learner = await repository.create(account, "Measurement explorer");
      const app = buildApp({
        repository,
        development: true,
        authenticate: async (request) =>
          String(request.headers["x-test-account"] ?? account),
      });
      const path = `/api/v1/learners/${learner.id}`;
      try {
        const batch = (payload: unknown, foreign = false) =>
          app.inject({
            method: "POST",
            url: `${path}/batches`,
            payload: payload as object,
            ...(foreign ? { headers: { "x-test-account": "foreign" } } : {}),
          });
        const count = async () =>
          (
            await repository.pool.query(
              "SELECT count(*)::int AS n FROM amp_instances WHERE learner_id=$1",
              [learner.id],
            )
          ).rows[0].n;
        for (const meta of measurementTemplates.filter(
          (t) => t.requiredFigureCapability,
        )) {
          const before = await count();
          const input = {
            templateId: meta.id,
            count: 1,
            responseCapabilities: ["single-choice-v1"],
          };
          assert.equal((await batch(input)).statusCode, 400);
          assert.equal(
            (await batch({ ...input, figureCapabilities: ["unknown-v1"] }))
              .statusCode,
            400,
          );
          assert.equal(await count(), before);
          const capable = {
            ...input,
            figureCapabilities: client.figureCapabilities,
          };
          assert.equal((await batch(capable, true)).statusCode, 404);
          const response = await batch(capable);
          assert.equal(response.statusCode, 200, response.body);
          const p = response.json().problems[0];
          assert.equal("answer" in p, false);
          const expected = generateProblemFor(
            p.templateId,
            p.seed,
            capable.figureCapabilities,
          );
          assert.deepEqual(p, expected.public);
          assert.ok(
            sceneCapabilitiesIn(p).every((capability) =>
              capable.figureCapabilities.includes(capability),
            ),
          );
          const attempt = {
            problemId: p.id,
            requestId: randomUUID(),
            response: expected.answer,
          };
          const foreign = await app.inject({
            method: "POST",
            url: `${path}/attempts`,
            headers: { "x-test-account": "foreign" },
            payload: attempt,
          });
          assert.equal(foreign.statusCode, 404);
          const save = () =>
            app.inject({
              method: "POST",
              url: `${path}/attempts`,
              payload: attempt,
            });
          const [first, replay] = await Promise.all([save(), save()]);
          assert.equal(first.statusCode, 200);
          assert.deepEqual(first.json(), replay.json());
          assert.equal(first.json().correct, true);
        }
        const legacy = await batch({
          count: 5,
          responseCapabilities: ["single-choice-v1"],
        });
        assert.equal(legacy.statusCode, 200);
        const unsupported = new Set(
          measurementTemplates
            .filter((t) => t.requiredFigureCapability)
            .map((t) => t.id),
        );
        assert.ok(
          legacy
            .json()
            .problems.every(
              (p: { templateId: string }) => !unsupported.has(p.templateId),
            ),
        );
        assert.equal(
          await count(),
          13,
          "Replayed attempts must not create extra instances",
        );
      } finally {
        await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
          learner.id,
        ]);
        await app.close();
        await repository.close();
      }
    },
  );
