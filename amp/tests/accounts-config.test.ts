import test from "node:test";
import assert from "node:assert/strict";
import {
  accountSecrets,
  accountsConfiguration,
  enabledProviders,
  microsoftEmailVerified,
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

test("Microsoft email is verified only by xms_edov or a verified-address claim", () => {
  const email = "parent@example.com";
  assert.equal(microsoftEmailVerified({ email }), false, "email claim alone");
  assert.equal(microsoftEmailVerified({ email, xms_edov: false }), false);
  assert.equal(microsoftEmailVerified({ email, xms_edov: true }), true);
  assert.equal(microsoftEmailVerified({ email, xms_edov: "true" }), true);
  assert.equal(
    microsoftEmailVerified({
      email,
      verified_primary_email: ["PARENT@example.com"],
    }),
    true,
  );
  assert.equal(
    microsoftEmailVerified({
      email,
      verified_secondary_email: "other@example.com",
    }),
    false,
  );
  assert.equal(microsoftEmailVerified({ xms_edov: true }), false, "no email");
});

test("account secrets: a current version and retired ones that only decrypt", () => {
  const one = "1".repeat(40);
  const two = "2".repeat(40);
  const today = accountsConfiguration(base);
  assert.equal(today.secretVersion, 1, "today's secret is version 1");
  assert.deepEqual(today.previousSecrets, []);
  assert.deepEqual(accountSecrets(today), {
    secrets: [{ version: 1, value: base.AMP_ACCOUNTS_SECRET }],
    legacySecret: base.AMP_ACCOUNTS_SECRET,
  });
  const rotated = accountsConfiguration({
    ...base,
    AMP_ACCOUNTS_SECRET: two,
    AMP_ACCOUNTS_SECRET_VERSION: "2",
    AMP_ACCOUNTS_PREVIOUS_SECRETS: `1:${one}`,
  });
  // Untagged values were written by version 1, so it stays their key.
  assert.deepEqual(accountSecrets(rotated), {
    secrets: [
      { version: 2, value: two },
      { version: 1, value: one },
    ],
    legacySecret: one,
  });
  // Version 1 retired: nothing is left that only it can read.
  assert.equal(
    accountSecrets({ secret: two, secretVersion: 2 }).legacySecret,
    undefined,
  );
  for (const [env, message] of [
    [{ AMP_ACCOUNTS_SECRET_VERSION: "0" }, /whole number from 1/],
    [{ AMP_ACCOUNTS_SECRET_VERSION: "two" }, /whole number from 1/],
    [{ AMP_ACCOUNTS_PREVIOUS_SECRETS: one }, /<version>:<secret/],
    [{ AMP_ACCOUNTS_PREVIOUS_SECRETS: "1:short" }, /<version>:<secret/],
    [{ AMP_ACCOUNTS_PREVIOUS_SECRETS: `1:${one}` }, /each version once/],
    [
      {
        AMP_ACCOUNTS_SECRET_VERSION: "2",
        AMP_ACCOUNTS_PREVIOUS_SECRETS: `1:${base.AMP_ACCOUNTS_SECRET}`,
      },
      /not the current one/,
    ],
    [
      {
        AMP_ACCOUNTS_SECRET_VERSION: "3",
        AMP_ACCOUNTS_PREVIOUS_SECRETS: `1:${one},1:${two}`,
      },
      /each version once/,
    ],
  ] as const)
    assert.throws(() => accountsConfiguration({ ...base, ...env }), message);
});
