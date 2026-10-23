import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { buildApp, GLOBAL_RATE_LIMIT } from "../src/server/app.js";
import type { Repository } from "../src/server/repository.js";
import { trialLimits } from "../src/server/trials.js";

function repository(free: number): Repository {
  return { limits: trialLimits(free) } as Repository;
}

function app(free = 100, development = false) {
  return buildApp({
    repository: repository(free),
    authenticate: async () => {
      throw Error("Public resources must not authenticate");
    },
    development,
  });
}

test("catalog memo uses exact identity and gzip representations with distinct ETags", async () => {
  const server = app();
  try {
    const plain = await server.inject({ url: "/api/v1/catalog" });
    const repeated = await server.inject({ url: "/api/v1/catalog" });
    const compressed = await server.inject({
      url: "/api/v1/catalog",
      headers: { "accept-encoding": "gzip, br" },
    });
    assert.equal(plain.statusCode, 200);
    assert.equal(
      plain.headers["cache-control"],
      "public, max-age=60, s-maxage=300",
    );
    assert.equal(plain.headers.vary, "Accept-Encoding");
    assert.equal(plain.headers["content-encoding"], undefined);
    assert.deepEqual(repeated.rawPayload, plain.rawPayload);
    assert.equal(repeated.headers.etag, plain.headers.etag);
    assert.equal(compressed.statusCode, 200);
    assert.equal(compressed.headers["content-encoding"], "gzip");
    assert.equal(compressed.headers.vary, "Accept-Encoding");
    assert.notEqual(compressed.headers.etag, plain.headers.etag);
    assert.deepEqual(gunzipSync(compressed.rawPayload), plain.rawPayload);
    assert.ok(compressed.rawPayload.length < plain.rawPayload.length);
    assert.deepEqual(plain.json().trial, trialLimits());
  } finally {
    await server.close();
  }
});

test("conditional public lessons use weak GET matching, lists and wildcard", async () => {
  const server = app();
  const path = "/api/v1/problem-lessons/polynomial-addition";
  try {
    const plain = await server.inject({ url: path });
    assert.equal(plain.statusCode, 200, plain.body);
    assert.equal(plain.json().lesson.templateId, "polynomial-addition");
    const tag = String(plain.headers.etag);
    for (const match of [tag, `W/${tag}`, `"other", W/${tag}`, "*"]) {
      const response = await server.inject({
        url: path,
        headers: { "if-none-match": match },
      });
      assert.equal(response.statusCode, 304);
      assert.equal(response.rawPayload.length, 0);
      assert.equal(response.headers.etag, tag);
      assert.equal(
        response.headers["cache-control"],
        plain.headers["cache-control"],
      );
      assert.equal(response.headers.vary, "Accept-Encoding");
    }
    const gzip = await server.inject({
      url: path,
      headers: { "accept-encoding": "gzip", "if-none-match": tag },
    });
    assert.equal(gzip.statusCode, 200);
    assert.deepEqual(
      JSON.parse(gunzipSync(gzip.rawPayload).toString()),
      plain.json(),
    );
    const gzipTag = String(gzip.headers.etag);
    assert.notEqual(gzipTag, tag);
    const gzip304 = await server.inject({
      url: path,
      headers: { "accept-encoding": "gzip", "if-none-match": `W/${gzipTag}` },
    });
    assert.equal(gzip304.statusCode, 304);
    assert.equal(gzip304.rawPayload.length, 0);
    const refused = await server.inject({
      url: path,
      headers: { "accept-encoding": "gzip;q=0, *;q=1", "if-none-match": tag },
    });
    assert.equal(refused.statusCode, 304);
    assert.equal(refused.headers.etag, tag);
    const wildcard = await server.inject({
      url: path,
      headers: { "accept-encoding": "br;q=1, *;q=0.5" },
    });
    assert.equal(wildcard.statusCode, 200);
    assert.equal(wildcard.headers["content-encoding"], "gzip");
    const optionalWhitespace = await server.inject({
      url: path,
      headers: { "accept-encoding": "gzip ;q=1, identity;q=0" },
    });
    assert.equal(optionalWhitespace.statusCode, 200);
    assert.equal(optionalWhitespace.headers["content-encoding"], "gzip");
    for (const header of ["gzip;q=bogus", "gzip;q=0.5, identity;q=1"]) {
      const identity = await server.inject({
        url: path,
        headers: { "accept-encoding": header },
      });
      assert.equal(identity.statusCode, 200);
      assert.equal(identity.headers["content-encoding"], undefined);
    }
    const unacceptable = await server.inject({
      url: path,
      headers: { "accept-encoding": "gzip;q=0, identity;q=0" },
    });
    assert.equal(unacceptable.statusCode, 406);
    assert.equal(unacceptable.headers["cache-control"], "no-store");
    assert.equal(unacceptable.headers.etag, undefined);
  } finally {
    await server.close();
  }
});

test("catalog snapshots are scoped to each app's mode and trial limits", async () => {
  const hosted = app(25);
  const development = app(40, true);
  try {
    const first = await hosted.inject({ url: "/api/v1/catalog" });
    const second = await development.inject({ url: "/api/v1/catalog" });
    assert.equal(first.json().mode, "hosted");
    assert.deepEqual(first.json().trial, trialLimits(25));
    assert.equal(second.json().mode, "development");
    assert.deepEqual(second.json().trial, trialLimits(40));
    assert.notEqual(first.headers.etag, second.headers.etag);
    const authorized = await hosted.inject({
      url: "/api/v1/catalog",
      headers: { authorization: "Bearer synthetic-test-token" },
    });
    assert.deepEqual(authorized.rawPayload, first.rawPayload);
    assert.equal(authorized.headers.etag, first.headers.etag);
  } finally {
    await hosted.close();
    await development.close();
  }
});

test("invalid, missing, failed and rate-limited requests are never public-cacheable", async () => {
  const server = app();
  try {
    for (const path of [
      `/api/v1/problem-lessons/${"x".repeat(101)}`,
      "/api/v1/problem-lessons/no-such-template",
      "/api/v1/no-such-route",
      "/api/v1/session",
    ]) {
      const response = await server.inject({ url: path });
      assert.ok(response.statusCode >= 400);
      assert.equal(response.headers["cache-control"], "no-store");
      assert.equal(response.headers.etag, undefined);
      assert.equal(response.headers["content-encoding"], undefined);
    }
  } finally {
    await server.close();
  }

  const broken = buildApp({
    repository: Object.defineProperty({}, "limits", {
      get() {
        throw Error("synthetic catalog failure");
      },
    }) as Repository,
    authenticate: async () => "synthetic",
  });
  try {
    const failure = await broken.inject({ url: "/api/v1/catalog" });
    assert.equal(failure.statusCode, 500);
    assert.equal(failure.headers["cache-control"], "no-store");
    assert.equal(failure.headers.etag, undefined);
  } finally {
    await broken.close();
  }

  const limited = app();
  try {
    for (let i = 0; i < GLOBAL_RATE_LIMIT; i++)
      assert.equal(
        (await limited.inject({ url: "/api/v1/health" })).statusCode,
        200,
      );
    const denied = await limited.inject({ url: "/api/v1/catalog" });
    assert.equal(denied.statusCode, 429);
    assert.equal(denied.headers["cache-control"], "no-store");
    assert.equal(denied.headers.etag, undefined);
  } finally {
    await limited.close();
  }
});
