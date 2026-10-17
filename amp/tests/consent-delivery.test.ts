import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  ResendConsentTransport,
  resendConfiguration,
} from "../src/parent-consent/resend.js";
import { consentFixture } from "./parent-consent.fixture.js";
import type { ConsentMail } from "../src/parent-consent/contracts.js";
const config = {
  apiKey: "re_synthetic_credential_for_tests",
  sender: "notice@example.com",
};
const mail: ConsentMail = {
  idempotencyKey: "amp-consent:synthetic-outbox",
  recipient: "parent@example.com",
  subject: "Synthetic private notice",
  text: "Synthetic fragment https://example.com/#token=private",
};

test("real mail opt-in requires explicit production, sender, tracking and disclosed processor", () => {
  const policy = structuredClone(consentFixture);
  const env = {
    NODE_ENV: "production",
    AMP_CONSENT_DELIVERY: "resend",
    AMP_CONSENT_RESEND_API_KEY: config.apiKey,
    AMP_CONSENT_SENDER: config.sender,
    AMP_CONSENT_RESEND_TRACKING_DISABLED: "true",
  };
  assert.equal(resendConfiguration({}, policy), null);
  assert.throws(() => resendConfiguration(env, policy), /processor/);
  policy.notice.processors.push({
    name: "Resend",
    service: "Transactional mail",
    data: "Parent address and direct notice",
    purpose: "Two consent notices",
    retention: "Reviewed provider retention",
  });
  assert.deepEqual(resendConfiguration(env, policy), config);
  for (const change of [
    { NODE_ENV: "development" },
    { AMP_CONSENT_DELIVERY: "other" },
    { AMP_CONSENT_SENDER: "bad\r\n@example.com" },
    { AMP_CONSENT_RESEND_API_KEY: "" },
    { AMP_CONSENT_RESEND_TRACKING_DISABLED: "false" },
  ])
    assert.throws(() => resendConfiguration({ ...env, ...change }, policy));
  assert.throws(() => resendConfiguration(env, null));
});

test("published SDK sends exact immutable body/key to pinned origin, refuses redirects, and sanitizes every outcome", async () => {
  const previousEnv = process.env.NODE_ENV,
    previousBase = process.env.RESEND_BASE_URL,
    originalFetch = globalThis.fetch,
    originalError = console.error;
  process.env.NODE_ENV = "production";
  process.env.RESEND_BASE_URL = "https://untrusted.invalid";
  const logs: unknown[][] = [];
  console.error = (...args) => {
    logs.push(args);
  };
  let response: Response | Error = new Response(
    JSON.stringify({ id: randomUUID() }),
    { status: 200 },
  );
  let calls = 0;
  globalThis.fetch = async (input, options) => {
    calls++;
    assert.equal(input, "https://api.resend.com/emails");
    assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "error");
    const h = new Headers(options?.headers);
    assert.equal(h.get("Authorization"), `Bearer ${config.apiKey}`);
    assert.equal(h.get("Idempotency-Key"), mail.idempotencyKey);
    assert.deepEqual(JSON.parse(String(options?.body)), {
      from: config.sender,
      to: [mail.recipient],
      subject: mail.subject,
      text: mail.text,
    });
    assert.ok(options?.signal);
    if (response instanceof Error) throw response;
    return response;
  };
  try {
    const mutable = { ...config };
    const adapter = new ResendConsentTransport(mutable);
    mutable.sender = "changed@example.com";
    const send = () =>
      adapter.send(mail, { signal: new AbortController().signal });
    assert.equal((await send()).kind, "accepted");
    response = new Response(
      JSON.stringify({
        name: "invalid_idempotent_request",
        message: mail.text,
      }),
      { status: 409 },
    );
    assert.deepEqual(await send(), { kind: "conflict" });
    response = new Response(
      JSON.stringify({ name: "validation_error", message: mail.recipient }),
      { status: 422 },
    );
    assert.deepEqual(await send(), { kind: "rejected" });
    for (const error of [
      "concurrent_idempotent_requests",
      "rate_limit_exceeded",
      "application_error",
      "unrecognized",
    ]) {
      response = new Response(
        JSON.stringify({ name: error, message: mail.text }),
        { status: 500 },
      );
      assert.deepEqual(await send(), { kind: "unknown" });
    }
    response = new Response("not-json", {
      status: 302,
      headers: { Location: "https://untrusted.invalid" },
    });
    assert.deepEqual(await send(), { kind: "unknown" });
    response = new Error(mail.text);
    assert.deepEqual(await send(), { kind: "unknown" });
    response = new Response(JSON.stringify({ id: "malformed" }), {
      status: 200,
    });
    assert.deepEqual(await send(), { kind: "unknown" });
    const before = calls;
    const controller = new AbortController();
    controller.abort();
    assert.deepEqual(await adapter.send(mail, { signal: controller.signal }), {
      kind: "unknown",
    });
    assert.equal(calls, before);
    globalThis.fetch = async (_input, options) =>
      new Promise((_resolve, reject) => {
        options!.signal!.addEventListener(
          "abort",
          () => reject(new Error("synthetic aborted send")),
          { once: true },
        );
      });
    const active = new AbortController();
    const interrupted = adapter.send(mail, { signal: active.signal });
    active.abort();
    assert.deepEqual(await interrupted, { kind: "unknown" });
    process.env.NODE_ENV = "development";
    assert.deepEqual(await send(), { kind: "unknown" });
    assert.equal(calls, before);
    assert.deepEqual(logs, []);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
    if (previousBase === undefined) delete process.env.RESEND_BASE_URL;
    else process.env.RESEND_BASE_URL = previousBase;
  }
});
