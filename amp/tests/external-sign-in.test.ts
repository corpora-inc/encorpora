import assert from "node:assert/strict";
import test from "node:test";
import { externalSignInFrom } from "../src/web/app/external-sign-in";

// /school/connect's "Sign in again" after a refused Clever link
// (`reauth_required`): the sign-in gate's link back to the same screen.
const schoolConnect = { return: "school", next: "/school/connect" };

test("a preloaded auth screen never hands off: the screen asked from stays", () => {
  for (const mode of ["development", "oidc"])
    assert.equal(
      externalSignInFrom(mode, { preload: true, search: schoolConnect }),
      null,
    );
});

test("an opened auth screen hands off from the place sign-in was asked for", () => {
  assert.equal(
    externalSignInFrom("development", {
      preload: false,
      search: schoolConnect,
    }),
    "/school/connect",
  );
  assert.equal(
    externalSignInFrom("development", { preload: false, search: {} }),
    "/",
  );
  // A continuation that isn't a safe same-origin path is never followed.
  assert.equal(
    externalSignInFrom("development", {
      preload: false,
      search: { return: "school", next: "https://example.com/" },
    }),
    "/school",
  );
});

test("AMP's own accounts keep their auth screens", () => {
  for (const preload of [true, false])
    assert.equal(
      externalSignInFrom("accounts", { preload, search: schoolConnect }),
      null,
    );
});
