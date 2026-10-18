import test from "node:test";
import assert from "node:assert/strict";
import {
  accountsConfiguration,
  enabledProviders,
  providerSignupRefused,
} from "../src/server/accounts.js";
import { redactUrl } from "../src/server/app.js";

const base = {
  AMP_ACCOUNTS_URL: "https://amp.example.com",
  AMP_ACCOUNTS_SECRET: "s".repeat(40),
};

test("account settings: origin, secret, providers and passwords", () => {
  const minimal = accountsConfiguration({ ...base, NODE_ENV: "production" });
  assert.deepEqual(enabledProviders(minimal), []);
  // Production without mail cannot verify or reset: passwords are off.
  assert.equal(minimal.passwords, false);
  assert.equal(
    accountsConfiguration({
      ...base,
      NODE_ENV: "production",
      AMP_MAIL_RESEND_API_KEY: "re_x",
      AMP_MAIL_FROM: "AMP <hello@example.com>",
    }).passwords,
    true,
  );
  assert.equal(accountsConfiguration(base).passwords, true, "development");

  const all = accountsConfiguration({
    ...base,
    AMP_GOOGLE_CLIENT_ID: "g",
    AMP_GOOGLE_CLIENT_SECRET: "gs",
    AMP_GITHUB_CLIENT_ID: "h",
    AMP_GITHUB_CLIENT_SECRET: "hs",
    AMP_MICROSOFT_CLIENT_ID: "m",
    AMP_MICROSOFT_CLIENT_SECRET: "ms",
    AMP_APPLE_CLIENT_ID: "a",
    AMP_APPLE_TEAM_ID: "t",
    AMP_APPLE_KEY_ID: "k",
    // Keys pasted with escaped newlines are restored.
    AMP_APPLE_PRIVATE_KEY: "line-one\\nline-two",
  });
  assert.deepEqual(enabledProviders(all), [
    "google",
    "apple",
    "microsoft",
    "github",
  ]);
  assert.equal(all.microsoft?.tenantId, "common");
  assert.equal(all.apple!.privateKey, "line-one\nline-two");

  // A provider is all or nothing; insecure origins and weak secrets fail.
  assert.throws(
    () => accountsConfiguration({ ...base, AMP_GOOGLE_CLIENT_ID: "g" }),
    /AMP_GOOGLE_CLIENT_SECRET/,
  );
  assert.throws(
    () =>
      accountsConfiguration({
        ...base,
        AMP_ACCOUNTS_URL: "http://amp.example.com",
      }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      accountsConfiguration({
        ...base,
        NODE_ENV: "production",
        AMP_ACCOUNTS_URL: "http://127.0.0.1:4310",
      }),
    /HTTPS/,
  );
  assert.throws(
    () => accountsConfiguration({ ...base, AMP_ACCOUNTS_SECRET: "short" }),
    /32/,
  );
  assert.equal(
    accountsConfiguration({
      ...base,
      AMP_ACCOUNTS_URL: "http://127.0.0.1:4310",
    }).baseURL,
    "http://127.0.0.1:4310",
  );
});

test("providers cannot create accounts for emails they have not verified", () => {
  const unverified = { emailVerified: false };
  assert.equal(providerSignupRefused(unverified, "/callback/microsoft"), true);
  assert.equal(providerSignupRefused(unverified, "/sign-in/social"), true);
  assert.equal(
    providerSignupRefused({ emailVerified: true }, "/callback/google"),
    false,
  );
  // Email sign-up proves the address separately, by confirmation link.
  assert.equal(providerSignupRefused(unverified, "/sign-up/email"), false);
});

test("request logs never carry one-time tokens", () => {
  assert.equal(
    redactUrl("/api/auth/reset-password/abc123?callbackURL=%2F%3Freset"),
    "/api/auth/reset-password/[redacted]?callbackURL=[redacted]",
  );
  assert.equal(
    redactUrl("/api/auth/verify-email?token=eyJ.secret&callbackURL=/"),
    "/api/auth/verify-email?token=[redacted]&callbackURL=[redacted]",
  );
  assert.equal(
    redactUrl("/api/auth/callback/github?code=c0de&state=s7"),
    "/api/auth/callback/github?code=[redacted]&state=[redacted]",
  );
  assert.equal(redactUrl("/api/v1/learners"), "/api/v1/learners");
});
