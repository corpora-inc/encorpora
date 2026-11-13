import test from "node:test";
import assert from "node:assert/strict";
import { forgedPost } from "../src/schools/request-origin.js";

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
