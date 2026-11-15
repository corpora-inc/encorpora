import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app.js";
import type { Repository } from "../src/server/repository.js";
import { trialLimits } from "../src/server/trials.js";
import { catalogSchema } from "../src/web/features/pathways/model.js";

const app = () =>
  buildApp({
    repository: { limits: trialLimits(100) } as Repository,
    authenticate: async () => {
      throw Error("Public resources must not authenticate");
    },
    development: false,
  });

// Pathways, the skill layers and the inventory read only skills and problem
// types, yet waited on the whole catalog with every lesson's text: 1.17 MB
// compressed in production, about 6 s on a phone's 4G before the map shows.
test("the curriculum map carries what the map reads and no lesson text", async () => {
  const server = app();
  try {
    const [full, map] = await Promise.all(
      ["/api/v1/catalog", "/api/v1/catalog/map"].map((url) =>
        server.inject({ url, headers: { "accept-encoding": "gzip" } }),
      ),
    );
    assert.equal(map.statusCode, 200);
    assert.equal(map.headers["content-encoding"], "gzip");
    assert.match(String(map.headers["cache-control"]), /public/);
    const fullBody = (
      await server.inject({ url: "/api/v1/catalog" })
    ).json() as Record<string, unknown>;
    const mapBody = (
      await server.inject({ url: "/api/v1/catalog/map" })
    ).json() as Record<string, unknown>;
    assert.deepEqual(Object.keys(mapBody).sort(), [
      "skills",
      "templates",
      "trial",
    ]);
    // What the screens parse is identical either way.
    assert.deepEqual(
      catalogSchema.parse(mapBody),
      catalogSchema.parse(fullBody),
    );
    assert.ok(
      map.rawPayload.length * 4 < full.rawPayload.length,
      `map ${map.rawPayload.length} B vs catalog ${full.rawPayload.length} B`,
    );
  } finally {
    await server.close();
  }
});
