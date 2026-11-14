import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { cleverConfiguration } from "../src/server/clever.js";
import { serverBuildOptions } from "../scripts/build-server.js";

const account = { baseURL: "https://amp.example.test", production: true };
const env = {
  AMP_CLEVER_CLIENT_ID: "fixture-app",
  AMP_CLEVER_CLIENT_SECRET: "fixture-secret",
  AMP_CLEVER_ENVIRONMENT: "sandbox",
};

test("Clever configuration is disabled when absent and rejects partial credentials", () => {
  assert.equal(cleverConfiguration({}), null);
  assert.equal(cleverConfiguration({}, account), null);
  for (const missing of Object.keys(env)) {
    const partial: NodeJS.ProcessEnv = { ...env };
    delete partial[missing];
    assert.throws(
      () => cleverConfiguration(partial, account),
      new RegExp(missing),
    );
  }
  assert.throws(() => cleverConfiguration(env), /AMP_AUTH_MODE=accounts/);
  assert.throws(
    () =>
      cleverConfiguration({ ...env, AMP_CLEVER_ENVIRONMENT: "test" }, account),
    /sandbox or production/,
  );
  assert.throws(
    () =>
      cleverConfiguration(
        { ...env, AMP_CLEVER_CLIENT_SECRET: " fixture-secret" },
        account,
      ),
    /AMP_CLEVER_CLIENT_SECRET/,
  );
  const loaded = cleverConfiguration(env, account)!;
  assert.equal(loaded.origin, account.baseURL);
  assert.equal(loaded.environment, "sandbox");
  assert.equal(
    cleverConfiguration(
      { ...env, AMP_CLEVER_ENVIRONMENT: "production" },
      account,
    )!.environment,
    "production",
  );
});
test("Clever uses the configured AMP origin and only an official district signup URL", () => {
  assert.throws(
    () =>
      cleverConfiguration(env, {
        ...account,
        baseURL: "http://amp.example.test",
      }),
    /validated AMP_ACCOUNTS_URL/,
  );
  assert.throws(
    () =>
      cleverConfiguration(env, {
        ...account,
        baseURL: "https://amp.example.test/subpath",
      }),
    /validated AMP_ACCOUNTS_URL/,
  );
  assert.throws(
    () =>
      cleverConfiguration(env, {
        ...account,
        baseURL: "http://127.0.0.1:4311",
      }),
    /validated AMP_ACCOUNTS_URL/,
  );
  assert.equal(
    cleverConfiguration(env, {
      production: false,
      baseURL: "http://127.0.0.1:4311",
    })!.origin,
    "http://127.0.0.1:4311",
  );
  const districtSignupUrl = "https://schools.clever.com/signup/example-app";
  assert.equal(
    cleverConfiguration(
      { ...env, AMP_CLEVER_DISTRICT_SIGNUP_URL: districtSignupUrl },
      account,
    )!.districtSignupUrl,
    districtSignupUrl,
  );
  for (const bad of [
    "http://schools.clever.com/signup/example",
    "https://schools.clever.com.evil.test/signup/example",
    "https://clever.com/signup/example",
    "https://user:password@schools.clever.com/signup/example",
    "https://schools.clever.com:8443/signup/example",
    "https://schools.clever.com/signup/example#secret",
    "not a URL",
  ]) {
    assert.throws(
      () =>
        cleverConfiguration(
          { ...env, AMP_CLEVER_DISTRICT_SIGNUP_URL: bad },
          account,
        ),
      /AMP_CLEVER_DISTRICT_SIGNUP_URL/,
    );
  }
});
test("production server bundle includes Clever auth, configuration and the source resolver", async () => {
  const result = await build({
    ...serverBuildOptions({}),
    write: false,
    metafile: true,
  });
  assert.ok(result.metafile?.inputs["src/server/clever.ts"]);
  assert.ok(result.metafile?.inputs["src/schools/clever-auth.ts"]);
  assert.ok(result.metafile?.inputs["src/schools/clever/identity.ts"]);
  assert.ok(
    result.outputFiles?.some((file) => file.path.endsWith("server/main.mjs")),
  );
});
