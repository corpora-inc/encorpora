import test from "node:test";
import assert from "node:assert/strict";
import { buildInfo } from "../src/server/build-info.js";
import { buildApp } from "../src/server/app.js";
import type { Repository } from "../src/server/repository.js";

const commit = "0123456789abcdef0123456789abcdef01234567";

test("build info reports a full commit and a UTC build time", () => {
  assert.deepEqual(
    buildInfo({
      AMP_BUILD_COMMIT: commit.toUpperCase(),
      AMP_BUILD_TIME: "2026-10-19T20:32:07Z",
    }),
    { commit, builtAt: "2026-10-19T20:32:07Z" },
  );
});

test("a local or malformed build reports no commit rather than a guess", () => {
  assert.deepEqual(buildInfo({}), { commit: null, builtAt: null });
  assert.deepEqual(
    buildInfo({ AMP_BUILD_COMMIT: "0123456", AMP_BUILD_TIME: "yesterday" }),
    { commit: null, builtAt: null },
  );
  assert.deepEqual(
    buildInfo({ AMP_BUILD_COMMIT: "", AMP_BUILD_TIME: "2026-13-40T99:99:99Z" }),
    { commit: null, builtAt: null },
  );
});

test("health names the running release and nothing else", async () => {
  const saved = { ...process.env };
  process.env.AMP_BUILD_COMMIT = commit;
  process.env.AMP_BUILD_TIME = "2026-10-19T20:32:07Z";
  const app = buildApp({
    repository: {} as Repository,
    authenticate: async () => {
      throw Object.assign(new Error("unused"), { statusCode: 401 });
    },
  });
  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      ok: true,
      product: "AMP",
      version: 1,
      commit,
      builtAt: "2026-10-19T20:32:07Z",
    });
  } finally {
    await app.close();
    process.env.AMP_BUILD_COMMIT = saved.AMP_BUILD_COMMIT;
    process.env.AMP_BUILD_TIME = saved.AMP_BUILD_TIME;
    if (saved.AMP_BUILD_COMMIT === undefined)
      delete process.env.AMP_BUILD_COMMIT;
    if (saved.AMP_BUILD_TIME === undefined) delete process.env.AMP_BUILD_TIME;
  }
});
