import test from "node:test";
import assert from "node:assert/strict";
import {
  existingAccountEmail,
  methodList,
  resetPasswordEmail,
  signInLink,
} from "../src/server/sign-in-methods.js";

const base = "https://amp.example.test";

test("sign-in links keep only a same-origin, plain continuation", () => {
  assert.equal(signInLink(base, "/access"), `${base}/sign-in?return=access`);
  assert.equal(
    signInLink(base, "/family/security"),
    `${base}/sign-in?return=security`,
  );
  assert.equal(
    signInLink(base, "/start?return=free-practice&program=az-esa"),
    `${base}/sign-in?return=free-practice&program=az-esa`,
  );
  assert.equal(
    signInLink(base, "/reset-password?return=access", "/sign-in/forgot"),
    `${base}/sign-in/forgot?return=access`,
  );
  for (const unsafe of [
    "https://elsewhere.example/access",
    "//elsewhere.example/access",
    "/start?return=%3Cscript%3E",
    undefined,
    42,
    "/" + "a".repeat(3000),
  ])
    assert.equal(signInLink(base, unsafe), `${base}/sign-in`, String(unsafe));
});

test("methods are named the way a person says them", () => {
  assert.equal(methodList(["google"]), "Google");
  assert.equal(methodList(["google", "passkey"]), "Google or a passkey");
  assert.equal(
    methodList(["google", "apple", "password"]),
    "Google, Apple, or a password",
  );
});

test("the existing-account email offers a reset only when a password exists", () => {
  const links = { signIn: `${base}/sign-in`, forgot: `${base}/sign-in/forgot` };
  const google = existingAccountEmail("AMP", ["google"], links);
  assert.equal(google.url, links.signIn);
  assert.doesNotMatch(google.text, /password/i);
  const password = existingAccountEmail("AMP", ["password"], links);
  assert.ok(password.text.includes(links.forgot));
  // An account with no usable method can still get in by setting a password.
  assert.ok(existingAccountEmail("AMP", [], links).text.includes(links.forgot));
  assert.equal(
    resetPasswordEmail("AMP", null, links.signIn).subject,
    "Reset your AMP password",
  );
  assert.equal(
    resetPasswordEmail("AMP", ["passkey"], links.signIn).subject,
    "Sign in to AMP",
  );
});
