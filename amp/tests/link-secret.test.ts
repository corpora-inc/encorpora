import test from "node:test";
import assert from "node:assert/strict";
import { linkSecretConfiguration } from "../src/server/link-secret.js";

test("hosted recoverable links use a stable shared secret across starts", () => {
  const secret = "fixture-link-secret-".repeat(3);
  for (const mode of ["accounts", "oidc"]) {
    assert.equal(
      linkSecretConfiguration({
        AMP_AUTH_MODE: mode,
        AMP_ACCOUNTS_SECRET: secret,
      }),
      secret,
    );
    assert.equal(
      linkSecretConfiguration({
        AMP_AUTH_MODE: mode,
        AMP_LINK_SECRET: secret,
        AMP_ACCOUNTS_SECRET: "another-valid-secret-".repeat(3),
      }),
      secret,
    );
    assert.throws(
      () => linkSecretConfiguration({ AMP_AUTH_MODE: mode }),
      /Hosted links require/,
    );
  }
});

test("only loopback development may use transient link signatures", () => {
  assert.match(
    linkSecretConfiguration({ AMP_AUTH_MODE: "development" }),
    /^[a-f0-9]{64}$/,
  );
  assert.throws(
    () =>
      linkSecretConfiguration({
        AMP_AUTH_MODE: "development",
        AMP_HOST: "0.0.0.0",
      }),
    /Hosted links require/,
  );
  for (const secret of ["", "short", " " + "x".repeat(32)])
    assert.throws(
      () =>
        linkSecretConfiguration({
          AMP_AUTH_MODE: "oidc",
          AMP_LINK_SECRET: secret,
        }),
      /at least 32/,
    );
});
