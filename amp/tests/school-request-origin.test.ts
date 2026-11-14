import test from "node:test";
import assert from "node:assert/strict";
import { forgedPost, pageOrigins } from "../src/schools/request-origin.js";

/* The school routes' CSRF guard (src/schools/request-origin.ts). A request
   with its own bearer credential is never a forgery, whatever its origin: a
   student's heartbeat from a private preview host or a native app used to be
   refused with 403, so no minutes were recorded. */
const AMP = "https://amp.example.test";
const post = (headers: Record<string, string>) => ({ method: "POST", headers });

test("a bearer request passes from any origin", () => {
  for (const origin of [
    AMP,
    "https://phone.example.test",
    "capacitor://localhost",
  ])
    assert.equal(
      forgedPost(
        post({ authorization: "Bearer st_fixture", origin, cookie: "a=b" }),
        AMP,
      ),
      false,
      origin,
    );
  assert.equal(
    forgedPost(
      post({
        authorization: "Bearer st_fixture",
        "sec-fetch-site": "cross-site",
      }),
      AMP,
    ),
    false,
  );
});

test("a cookie sign-in from elsewhere is refused", () => {
  assert.equal(
    forgedPost(
      post({ cookie: "a=b", origin: "https://evil.example.test" }),
      AMP,
    ),
    true,
  );
  assert.equal(forgedPost(post({ cookie: "a=b" }), AMP), true);
  assert.equal(forgedPost(post({ "sec-fetch-site": "cross-site" }), AMP), true);
  assert.equal(
    forgedPost(post({ origin: "https://evil.example.test" }), AMP),
    true,
  );
  assert.equal(forgedPost(post({ cookie: "a=b", origin: AMP }), AMP), false);
  assert.equal(
    forgedPost({ method: "GET", headers: { cookie: "a=b" } }, AMP),
    false,
  );
});

test("strict refuses a cookie sign-in when AMP's origin isn't known", () => {
  assert.equal(forgedPost(post({ cookie: "a=b" }), "", true), true);
  assert.equal(forgedPost(post({ cookie: "a=b" }), ""), false);
});

test("only a bearer token exempts a request: Basic rides along like a cookie", () => {
  assert.equal(
    forgedPost(
      post({
        authorization: "Basic Zml4dHVyZTpmaXh0dXJl",
        cookie: "a=b",
        origin: "https://evil.example.test",
      }),
      AMP,
    ),
    true,
  );
  assert.equal(
    forgedPost(
      post({
        authorization: "bearer st_fixture",
        origin: "https://phone.example.test",
      }),
      AMP,
    ),
    false,
  );
});

/* The preview is reached at a private host that sign-in already trusts
   (AMP_ACCOUNTS_TRUSTED_ORIGINS). Every child's code lookup from it was
   refused with 403 request_origin_invalid, and the join screen said "AMP
   isn't answering". The school guard accepts what sign-in accepts. */
test("a cookie or plain post from any origin sign-in trusts passes", () => {
  const PREVIEW = "https://preview.example.test:8443";
  const origins = pageOrigins({ baseURL: AMP, trustedOrigins: [PREVIEW] });
  assert.deepEqual(origins, [AMP, PREVIEW]);
  for (const from of [AMP, PREVIEW]) {
    assert.equal(forgedPost(post({ origin: from }), origins), false, from);
    assert.equal(
      forgedPost(post({ origin: from, cookie: "a=b" }), origins, true),
      false,
      from,
    );
  }
  assert.equal(
    forgedPost(post({ origin: "https://evil.example.test" }), origins),
    true,
  );
  assert.equal(forgedPost(post({ cookie: "a=b" }), origins), true);
  assert.equal(forgedPost(post({ cookie: "a=b" }), [], true), true);
  assert.equal(forgedPost(post({ cookie: "a=b" }), []), false);
  assert.deepEqual(pageOrigins(null), []);
});
