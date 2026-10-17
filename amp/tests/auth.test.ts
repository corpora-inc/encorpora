import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, type JWTPayload } from "jose";
import {
  verifyAccessToken,
  oidcAuth,
  developmentAuth,
} from "../src/server/auth";
import type { FastifyRequest } from "fastify";
const config = { issuer: "https://accounts.example.test", audience: "amp-api" };
const pair = await generateKeyPair("ES256");
const keys = async () => pair.publicKey;
const now = Math.floor(Date.now() / 1000);
const claims = (): JWTPayload => ({
  iss: config.issuer,
  aud: config.audience,
  sub: "parent-1",
  iat: now,
  exp: now + 600,
});
const signed = (payload: JWTPayload, typ = "at+jwt") =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256", typ })
    .sign(pair.privateKey);

test("requires a signed API access token with issuer, audience, lifetime and subject", async () => {
  assert.equal(
    await verifyAccessToken(await signed(claims()), keys, config),
    `${config.issuer}|parent-1`,
  );
  for (const name of ["exp", "iat", "sub", "aud", "iss"]) {
    const payload = claims();
    delete payload[name];
    await assert.rejects(
      verifyAccessToken(await signed(payload), keys, config),
      `missing ${name}`,
    );
  }
  for (const changes of [
    { exp: now - 1 },
    { iat: now + 300 },
    { sub: "" },
    { aud: "another-api" },
    { iss: "https://wrong.example.test" },
    { nbf: now + 300 },
  ]) {
    await assert.rejects(
      verifyAccessToken(
        await signed({ ...claims(), ...changes }),
        keys,
        config,
      ),
    );
  }
  const other = await generateKeyPair("ES256");
  const forged = await new SignJWT(claims())
    .setProtectedHeader({ alg: "ES256", typ: "at+jwt" })
    .sign(other.privateKey);
  await assert.rejects(verifyAccessToken(forged, keys, config));
});
test("rejects an ID token even if its other claims satisfy API checks", async () => {
  await assert.rejects(
    verifyAccessToken(await signed(claims(), "JWT"), keys, config),
  );
  const alternate = {
    ...config,
    accessTokenProfile: "token-use-access" as const,
  };
  assert.equal(
    await verifyAccessToken(
      await signed({ ...claims(), token_use: "access" }, "JWT"),
      keys,
      alternate,
    ),
    `${config.issuer}|parent-1`,
  );
  await assert.rejects(
    verifyAccessToken(
      await signed({ ...claims(), token_use: "id" }, "JWT"),
      keys,
      alternate,
    ),
  );
  await assert.rejects(
    verifyAccessToken(await signed(claims(), "JWT"), keys, alternate),
  );
  // A provider using client_id without an API audience must be explicitly adapted, never silently accepted.
  const noAudience = { ...claims(), client_id: "amp-api" };
  delete noAudience.aud;
  await assert.rejects(
    verifyAccessToken(await signed(noAudience, "JWT"), keys, alternate),
  );
});
test("rejects insecure key sources and malformed authorization before network calls", async () => {
  assert.throws(() =>
    oidcAuth({ ...config, jwksUrl: "http://keys.example.test" }),
  );
  const authenticate = oidcAuth({
    ...config,
    jwksUrl: "https://keys.example.test",
  });
  await assert.rejects(
    authenticate({ headers: {} } as FastifyRequest),
    /Sign in/,
  );
  await assert.rejects(
    authenticate({ headers: { authorization: "Basic abc" } } as FastifyRequest),
    /Sign in/,
  );
});
test("development authentication rejects non-loopback requests", async () => {
  const prior = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "test";
    const authenticate = developmentAuth();
    await assert.rejects(
      authenticate({
        ip: "203.0.113.1",
        headers: { authorization: "Bearer amp-local-development" },
      } as FastifyRequest),
    );
    await assert.rejects(
      authenticate({ ip: "127.0.0.1", headers: {} } as FastifyRequest),
    );
    assert.equal(
      await authenticate({
        ip: "127.0.0.1",
        headers: { authorization: "Bearer amp-local-development" },
      } as FastifyRequest),
      "development-household",
    );
    process.env.NODE_ENV = "production";
    assert.throws(developmentAuth);
  } finally {
    if (prior === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prior;
  }
});
